import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  Clock,
  CloudUpload,
  Database,
  FileJson,
  GitBranch,
  GitMerge,
  Layers,
  PauseCircle,
  Radio,
  RefreshCw,
  RotateCcw,
  SkipForward,
  X,
} from "lucide-react";
import {
  DATA_BASE_URL,
  IS_SAMPLE_DATA,
  loadPipelineStatus,
} from "@/lib/data";
import {
  formatIstanbulDateTime,
  formatNumber,
  formatRelativeTimeTr,
  formatStepDuration,
} from "@/lib/format";
import type {
  Pipeline,
  PipelineStatus,
  Run,
  Stage,
  Step,
  StepState,
} from "@/types";

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 dakika
const POLL_BACKGROUND_MS = 60 * 1000; // Panel açıkken 60 sn
const POLL_DRAWER_OPEN_MS = 20 * 1000; // Çekmece açıkken 20 sn

export type OverallBadgeState = "success" | "running" | "failed" | "offline";

export function evaluateOverallBadgeState(
  status: PipelineStatus | null,
  nowMs: number
): OverallBadgeState {
  if (!status) return "offline";
  const generatedMs = Date.parse(status.generated_at);
  if (Number.isNaN(generatedMs) || nowMs - generatedMs > STALE_THRESHOLD_MS) {
    return "offline";
  }

  let hasRunning = false;
  let hasFailed = false;

  for (const pipeline of status.pipelines) {
    if (
      pipeline.run?.state === "running" ||
      pipeline.run?.state === "queued"
    ) {
      hasRunning = true;
    }
    if (pipeline.run?.state === "failed") {
      hasFailed = true;
    }
    for (const step of pipeline.steps) {
      if (step.state === "running" || step.state === "retrying") {
        hasRunning = true;
      }
      if (step.state === "failed") {
        hasFailed = true;
      }
    }
  }

  if (hasRunning) return "running";
  if (hasFailed) return "failed";
  return "success";
}

const BADGE_CONFIG: Record<
  OverallBadgeState,
  {
    label: string;
    shortLabel: string;
    dotClass: string;
    buttonClass: string;
  }
> = {
  success: {
    label: "Hat: başarılı",
    shortLabel: "Hat",
    dotClass: "bg-[#10B981]",
    buttonClass:
      "border-[#10B981]/35 bg-[#060B14]/85 text-[#F8FAFC] hover:border-[#10B981]/60 hover:bg-[#0D1628]/95",
  },
  running: {
    label: "Hat: çalışıyor",
    shortLabel: "Hat",
    dotClass: "bg-[#38BDF8] animate-pulse",
    buttonClass:
      "border-[#38BDF8]/50 bg-[#060B14]/90 text-[#38BDF8] hover:border-[#38BDF8]/80 hover:bg-[#0D1628]/95",
  },
  failed: {
    label: "Hat: başarısız",
    shortLabel: "Hat",
    dotClass: "bg-[#F87171]",
    buttonClass:
      "border-[#F87171]/50 bg-[#1F090D]/88 text-[#FCA5A5] hover:border-[#F87171]/80 hover:bg-[#2D0D13]/95",
  },
  offline: {
    label: "Hat: izleyici kapalı",
    shortLabel: "Hat",
    dotClass: "bg-[#64748B]",
    buttonClass:
      "border-white/15 bg-[#060B14]/82 text-[#94A3B8] hover:border-white/25 hover:bg-[#0D1628]/90 hover:text-[#F8FAFC]",
  },
};

const STAGE_CONFIG: Record<
  Stage,
  {
    label: string;
    colorHex: string;
    badgeClass: string;
    Icon: typeof Radio;
  }
> = {
  epias: {
    label: "EPİAŞ",
    colorHex: "#38BDF8",
    badgeClass: "border-[#38BDF8]/35 bg-[#38BDF8]/12 text-[#38BDF8]",
    Icon: Radio,
  },
  bigquery: {
    label: "BigQuery",
    colorHex: "#818CF8",
    badgeClass: "border-[#818CF8]/35 bg-[#818CF8]/12 text-[#A5B4FC]",
    Icon: Database,
  },
  dbt: {
    label: "dbt",
    colorHex: "#FB923C",
    badgeClass: "border-[#FB923C]/35 bg-[#FB923C]/12 text-[#FDBA74]",
    Icon: Layers,
  },
  export: {
    label: "JSON",
    colorHex: "#34D399",
    badgeClass: "border-[#34D399]/35 bg-[#34D399]/12 text-[#6EE7B7]",
    Icon: FileJson,
  },
  gcs: {
    label: "GCS Kova",
    colorHex: "#C084FC",
    badgeClass: "border-[#C084FC]/35 bg-[#C084FC]/12 text-[#D8B4FE]",
    Icon: CloudUpload,
  },
};

const STEP_STATE_CONFIG: Record<
  StepState,
  {
    label: string;
    cardClass: string;
    statePillClass: string;
    dotClass: string;
    connectorClass: string;
    Icon: typeof CheckCircle2;
  }
> = {
  pending: {
    label: "sırada",
    cardClass: "border-white/10 bg-[#080E1A]/80 text-[#94A3B8]",
    statePillClass: "border-white/12 bg-white/[0.04] text-[#94A3B8]",
    dotClass: "bg-[#64748B]",
    connectorClass: "border-[#334155] text-[#475569]",
    Icon: Clock,
  },
  running: {
    label: "çalışıyor",
    cardClass:
      "border-[#38BDF8]/75 bg-[#081B2E]/90 text-[#F8FAFC] shadow-[0_0_22px_rgba(56,189,248,0.22)] animate-pulse",
    statePillClass:
      "border-[#38BDF8]/50 bg-[#38BDF8]/18 text-[#38BDF8] font-semibold",
    dotClass: "bg-[#38BDF8] animate-pulse",
    connectorClass: "border-[#38BDF8]/60 text-[#38BDF8]",
    Icon: RefreshCw,
  },
  success: {
    label: "tamam",
    cardClass: "border-[#10B981]/30 bg-[#071517]/75 text-[#F8FAFC]",
    statePillClass: "border-[#10B981]/35 bg-[#10B981]/12 text-[#10B981]",
    dotClass: "bg-[#10B981]",
    connectorClass: "border-[#10B981]/45 text-[#10B981]/80",
    Icon: CheckCircle2,
  },
  failed: {
    label: "hata",
    cardClass:
      "border-[#F87171]/80 bg-[#2A090E]/85 text-[#F8FAFC] shadow-[0_0_24px_rgba(248,113,113,0.2)]",
    statePillClass:
      "border-[#F87171]/60 bg-[#F87171]/20 text-[#FCA5A5] font-semibold",
    dotClass: "bg-[#F87171]",
    connectorClass: "border-[#F87171]/60 text-[#F87171]",
    Icon: AlertCircle,
  },
  retrying: {
    label: "yeniden denenecek",
    cardClass: "border-[#F59E0B]/60 bg-[#271505]/80 text-[#F8FAFC]",
    statePillClass:
      "border-[#F59E0B]/50 bg-[#F59E0B]/18 text-[#FCD34D] font-semibold",
    dotClass: "bg-[#F59E0B] animate-pulse",
    connectorClass: "border-[#F59E0B]/50 text-[#F59E0B]",
    Icon: RotateCcw,
  },
  skipped: {
    label: "yeni veri yok, atlandı",
    cardClass:
      "border-dashed border-white/15 bg-[#070B14]/45 text-[#94A3B8] opacity-80",
    statePillClass:
      "border-dashed border-white/15 bg-white/[0.03] text-[#94A3B8]",
    dotClass: "bg-[#64748B]/70",
    connectorClass: "border-dashed border-white/15 text-[#475569]",
    Icon: SkipForward,
  },
  upstream_failed: {
    label: "önceki adım düştüğü için çalışmadı",
    cardClass: "border-[#F87171]/30 bg-[#1B090E]/50 text-[#CBD5E1] opacity-85",
    statePillClass: "border-[#F87171]/30 bg-[#F87171]/10 text-[#FCA5A5]/85",
    dotClass: "bg-[#F87171]/60",
    connectorClass: "border-[#F87171]/30 text-[#F87171]/60",
    Icon: AlertCircle,
  },
};

function formatTriggerLabel(trigger: Run["trigger"]): string {
  if (trigger === "scheduled") return "zamanlanmış";
  if (trigger === "manual") return "elle";
  return "diğer";
}

function formatRunStateBadge(state: Run["state"]): {
  label: string;
  className: string;
  dotClass: string;
} {
  switch (state) {
    case "running":
      return {
        label: "çalışıyor",
        className: "border-[#38BDF8]/45 bg-[#38BDF8]/15 text-[#38BDF8]",
        dotClass: "bg-[#38BDF8] animate-pulse",
      };
    case "queued":
      return {
        label: "sırada",
        className: "border-white/15 bg-white/[0.06] text-[#CBD5E1]",
        dotClass: "bg-[#94A3B8]",
      };
    case "success":
      return {
        label: "başarılı",
        className: "border-[#10B981]/40 bg-[#10B981]/12 text-[#10B981]",
        dotClass: "bg-[#10B981]",
      };
    case "failed":
      return {
        label: "başarısız",
        className: "border-[#F87171]/50 bg-[#450A0A]/80 text-[#FCA5A5]",
        dotClass: "bg-[#F87171]",
      };
  }
}

interface TreeBranchColumn {
  id: string;
  title: string;
  isDecisionBranch: boolean;
  steps: Step[];
}

type TreeSegment =
  | { type: "step"; step: Step }
  | {
      type: "branches";
      fromStepId: string;
      mergeStepId: string;
      columns: TreeBranchColumn[];
    };

function isDecisionStep(step: Step): boolean {
  return (
    step.id === "plant_day_check" ||
    step.id.endsWith("_check") ||
    step.to.toLowerCase().includes("karar")
  );
}

/**
 * Adımları depends_on kenarlarına göre akış ağacı segmentlerine ayırır.
 * Karar düğümü (plant_day_check) içeren çatallanmaları iki ayrı kol olarak ayırır
 * ve birleşme düğümünde (export) yeniden tek gövdeye birleştirir.
 */
function buildFlowSegments(steps: Step[]): TreeSegment[] {
  if (steps.length === 0) return [];

  const stepById = new Map<string, Step>();
  const childrenById = new Map<string, string[]>();

  for (const s of steps) {
    stepById.set(s.id, s);
    childrenById.set(s.id, []);
  }
  for (const s of steps) {
    for (const parentId of s.depends_on) {
      const list = childrenById.get(parentId);
      if (list) list.push(s.id);
    }
  }

  // Bir düğümden ulaşılabilen tüm düğümleri bulur (stopId hariç)
  const getReachable = (startId: string, stopId?: string): Set<string> => {
    const visited = new Set<string>();
    const queue = [startId];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr === stopId || visited.has(curr)) continue;
      visited.add(curr);
      for (const next of childrenById.get(curr) ?? []) {
        if (!visited.has(next) && next !== stopId) {
          queue.push(next);
        }
      }
    }
    return visited;
  };

  const segments: TreeSegment[] = [];
  const consumed = new Set<string>();

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (consumed.has(step.id)) continue;

    consumed.add(step.id);
    segments.push({ type: "step", step });

    const directChildren = (childrenById.get(step.id) ?? []).filter(
      (cid) => !consumed.has(cid)
    );

    if (directChildren.length >= 2) {
      // Her koldan ulaşılabilen düğümlerin kesişimini bulup tüm yolları toplayan ilk birleşme düğümünü (ör. export) seç
      const reachablePerChild = directChildren.map((cid) => getReachable(cid));

      let mergeStep: Step | null = null;
      for (let j = i + 1; j < steps.length; j++) {
        const candidate = steps[j];
        if (directChildren.includes(candidate.id)) continue;
        const inAllBranches = reachablePerChild.every((set) =>
          set.has(candidate.id)
        );
        if (!inAllBranches) continue;

        // Birleşme adayından önce gelen kol düğümlerinin aday dışındaki başka bir düğüme atlamadığını doğrula
        const betweenIds = new Set<string>();
        for (const cid of directChildren) {
          for (const nodeId of getReachable(cid, candidate.id)) {
            betweenIds.add(nodeId);
          }
        }
        const allConvergeAtCandidate = Array.from(betweenIds).every((bid) =>
          (childrenById.get(bid) ?? []).every(
            ( targetId ) => targetId === candidate.id || betweenIds.has(targetId)
          )
        );
        if (allConvergeAtCandidate) {
          mergeStep = candidate;
          break;
        }
      }

      if (mergeStep) {
        const branchNodesPerChild = directChildren.map((cid) =>
          getReachable(cid, mergeStep.id)
        );

        // Karar dalını (plant_day_check içeren kolu) belirle
        const decisionChildIdx = directChildren.findIndex((cid) => {
          const s = stepById.get(cid);
          return s ? isDecisionStep(s) : false;
        });

        const columns: TreeBranchColumn[] = [];

        if (decisionChildIdx !== -1 && directChildren.length === 2) {
          const otherIdx = decisionChildIdx === 0 ? 1 : 0;
          const decisionSet = branchNodesPerChild[decisionChildIdx];
          const mainSteps = steps.filter(
            (s) =>
              branchNodesPerChild[otherIdx].has(s.id) && !decisionSet.has(s.id)
          );
          const decisionSteps = steps.filter((s) => decisionSet.has(s.id));

          columns.push({
            id: directChildren[otherIdx],
            title: "Ülke Verisi Kolu",
            isDecisionBranch: false,
            steps: mainSteps,
          });
          columns.push({
            id: directChildren[decisionChildIdx],
            title: "Santral Dalı (Karar Kolu)",
            isDecisionBranch: true,
            steps: decisionSteps,
          });
        } else {
          const assigned = new Set<string>();
          directChildren.forEach((cid, idx) => {
            const cStep = stepById.get(cid);
            const colSteps = steps.filter(
              (s) => branchNodesPerChild[idx].has(s.id) && !assigned.has(s.id)
            );
            colSteps.forEach((s) => assigned.add(s.id));
            const isDec = cStep ? isDecisionStep(cStep) : false;
            columns.push({
              id: cid,
              title: isDec ? "Santral Dalı (Karar Kolu)" : `Kol ${idx + 1}`,
              isDecisionBranch: isDec,
              steps: colSteps,
            });
          });
        }

        for (const col of columns) {
          for (const s of col.steps) {
            consumed.add(s.id);
          }
        }

        segments.push({
          type: "branches",
          fromStepId: step.id,
          mergeStepId: mergeStep.id,
          columns,
        });
      }
    }
  }

  return segments;
}

interface StepNodeCardProps {
  step: Step;
  stepLabelById: ReadonlyMap<string, string>;
  nowMs: number;
  compact?: boolean;
}

const StepNodeCard = memo(function StepNodeCard({
  step,
  stepLabelById,
  nowMs,
  compact = false,
}: StepNodeCardProps) {
  const stageCfg = STAGE_CONFIG[step.stage] ?? STAGE_CONFIG.bigquery;
  const stateCfg = STEP_STATE_CONFIG[step.state] ?? STEP_STATE_CONFIG.pending;
  const StageIcon = stageCfg.Icon;
  const StateIcon = stateCfg.Icon;
  const isDecision = isDecisionStep(step);
  const isRunning = step.state === "running";
  const durationLabel = formatStepDuration(
    step.started_at,
    step.ended_at,
    isRunning,
    nowMs
  );

  const parentLabels = useMemo(() => {
    if (step.depends_on.length <= 1) return null;
    return step.depends_on
      .map((id) => stepLabelById.get(id) ?? id)
      .join(" + ");
  }, [step.depends_on, stepLabelById]);

  return (
    <div
      className={`relative rounded-xl border transition-all ${
        compact ? "p-2.5" : "p-3"
      } ${stateCfg.cardClass}`}
    >
      {/* Üst Satır: Katman rozeti + Karar düğümü etiketi + Deneme sayısı + Süre */}
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono-data text-[10px] font-semibold ${stageCfg.badgeClass}`}
          >
            <StageIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>{stageCfg.label}</span>
          </span>

          {isDecision && (
            <span className="inline-flex items-center gap-1 rounded-md border border-[#38BDF8]/35 bg-[#38BDF8]/10 px-1.5 py-0.5 font-mono-data text-[10px] font-semibold text-[#38BDF8]">
              <GitBranch className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
              <span>Karar düğümü</span>
            </span>
          )}

          {step.try_number > 1 && (
            <span className="inline-flex items-center gap-1 rounded-md border border-[#F59E0B]/45 bg-[#F59E0B]/15 px-1.5 py-0.5 font-mono-data text-[10px] font-semibold text-[#FCD34D] tabular-nums">
              {formatNumber(step.try_number)}. deneme
            </span>
          )}
        </div>

        {/* Süre ve Durum Rozeti */}
        <div className="flex flex-wrap items-center gap-1.5">
          {durationLabel && (
            <span
              className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono-data text-[10px] tabular-nums ${
                isRunning
                  ? "border-[#38BDF8]/45 bg-[#38BDF8]/15 font-semibold text-[#38BDF8]"
                  : "border-white/10 bg-black/30 text-[#94A3B8]"
              }`}
              title={
                step.started_at
                  ? `Başlangıç: ${formatIstanbulDateTime(step.started_at)}${
                      step.ended_at
                        ? ` · Bitiş: ${formatIstanbulDateTime(step.ended_at)}`
                        : ""
                    }`
                  : undefined
              }
            >
              <Clock className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
              <span>{durationLabel}</span>
            </span>
          )}

          <span
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono-data text-[10.5px] ${stateCfg.statePillClass}`}
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${stateCfg.dotClass}`}
              aria-hidden="true"
            />
            <StateIcon
              className={`h-3 w-3 shrink-0 ${
                isRunning ? "animate-spin" : ""
              }`}
              aria-hidden="true"
            />
            <span>{stateCfg.label}</span>
          </span>
        </div>
      </div>

      {/* Orta Satır: Adım Adı */}
      <div className="mt-1.5 font-display text-xs font-semibold text-[#F8FAFC] sm:text-[13px]">
        {step.label}
      </div>

      {/* Alt Satır: from → to */}
      <div className="mt-1 flex flex-wrap items-center gap-1 font-mono-data text-[11px] leading-snug text-[#94A3B8]">
        <span className="text-[#CBD5E1]">{step.from}</span>
        <ArrowRight
          className="h-3 w-3 shrink-0 text-[#64748B]"
          aria-hidden="true"
        />
        <span className="text-[#CBD5E1]">{step.to}</span>
      </div>

      {/* Birden fazla önceki adıma bağımlıysa (birleşme kenarları) */}
      {parentLabels && (
        <div className="mt-1.5 flex items-center gap-1 border-t border-white/8 pt-1 font-mono-data text-[10px] text-[#64748B]">
          <GitMerge className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
          <span>Bağımlı: {parentLabels}</span>
        </div>
      )}
    </div>
  );
});

function VerticalConnector({
  dashed = false,
  label,
}: {
  dashed?: boolean;
  label?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col items-center justify-center py-1"
    >
      <div
        className={`h-3.5 border-l-2 ${
          dashed ? "border-dashed border-white/20" : "border-white/20"
        }`}
      />
      {label && (
        <span className="my-0.5 rounded border border-white/10 bg-[#050912] px-1.5 py-0.2 font-mono-data text-[9.5px] text-[#94A3B8]">
          {label}
        </span>
      )}
      <ArrowDown className=" -mt-1 h-3 w-3 text-[#64748B]" />
    </div>
  );
}

interface PipelineCardProps {
  pipeline: Pipeline;
  nowMs: number;
}

const PipelineCard = memo(function PipelineCard({
  pipeline,
  nowMs,
}: PipelineCardProps) {
  const segments = useMemo(
    () => buildFlowSegments(pipeline.steps),
    [pipeline.steps]
  );

  const stepLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of pipeline.steps) {
      map.set(s.id, s.label);
    }
    return map;
  }, [pipeline.steps]);

  const runStateBadge = pipeline.run
    ? formatRunStateBadge(pipeline.run.state)
    : null;

  const lastSuccessRelative = formatRelativeTimeTr(
    pipeline.last_success_at,
    nowMs
  );
  const lastSuccessExact = pipeline.last_success_at
    ? formatIstanbulDateTime(pipeline.last_success_at)
    : null;

  return (
    <section
      aria-label={pipeline.label}
      className="rounded-2xl border border-white/12 bg-[#080F1E]/90 p-3.5 shadow-lg sm:p-4"
    >
      {/* Kart Başlığı: label, schedule_label, run.trigger, run.state, son başarılı çalışma, is_paused */}
      <div className="flex flex-col gap-2 border-b border-white/10 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-sm font-bold text-[#F8FAFC] sm:text-base">
              {pipeline.label}
            </h3>
            <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono-data text-[11px] text-[#94A3B8]">
              {pipeline.schedule_label}
            </span>
            {pipeline.is_paused && (
              <span className="inline-flex items-center gap-1 rounded-md border border-[#F59E0B]/45 bg-[#451A03]/80 px-2 py-0.5 font-mono-data text-[11px] font-semibold text-[#FCD34D]">
                <PauseCircle className="h-3 w-3" aria-hidden="true" />
                <span>duraklatıldı</span>
              </span>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#94A3B8] tabular-nums">
            <span>
              Son başarılı çalışma:{" "}
              <strong
                className="font-mono-data font-semibold text-[#E2E8F0]"
                title={lastSuccessExact ?? undefined}
              >
                {lastSuccessRelative}
              </strong>
              {lastSuccessExact && (
                <span className="ml-1 font-mono-data text-[10.5px] text-[#64748B]">
                  ({lastSuccessExact})
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Sağ: En son çalışma tetikleyicisi ve durumu */}
        <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
          {pipeline.run ? (
            <>
              <span className="rounded-md border border-white/10 bg-[#050811] px-2 py-0.5 font-mono-data text-[11px] text-[#CBD5E1]">
                Tetikleme: {formatTriggerLabel(pipeline.run.trigger)}
              </span>
              {runStateBadge && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 font-mono-data text-[11px] font-semibold ${runStateBadge.className}`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${runStateBadge.dotClass}`}
                    aria-hidden="true"
                  />
                  <span>Durum: {runStateBadge.label}</span>
                </span>
              )}
            </>
          ) : (
            <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono-data text-[11px] text-[#64748B]">
              Henüz çalışma kaydı yok
            </span>
          )}
        </div>
      </div>

      {/* Akış Ağacı (steps[] ve depends_on) */}
      <div className="mt-3.5 flex flex-col">
        {segments.map((seg, idx) => {
          const isLast = idx === segments.length - 1;

          if (seg.type === "step") {
            return (
              <div key={seg.step.id} className="flex flex-col">
                <StepNodeCard
                  step={seg.step}
                  stepLabelById={stepLabelById}
                  nowMs={nowMs}
                />
                {!isLast && <VerticalConnector />}
              </div>
            );
          }

          // Çatallanan kollar (Saatlik hatta ülke kolu + santral karar dalı -> export'ta birleşir)
          return (
            <div
              key={`branch-${seg.fromStepId}-${seg.mergeStepId}`}
              className="flex flex-col"
            >
              {/* Çatallanma başlığı / ayırıcı */}
              <div className="mb-2 flex items-center justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-[#050912] px-3 py-0.5 font-mono-data text-[10.5px] text-[#94A3B8]">
                  <GitBranch
                    className="h-3 w-3 text-[#38BDF8]"
                    aria-hidden="true"
                  />
                  <span>
                    Paralel akış kolları (dar ekranda dikey, geniş ekranda iki
                    kol)
                  </span>
                </span>
              </div>

              {/* Dar ekranda (telefon) tek sütun dikey; geniş ekranda (>= md) yan yana iki kol */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {seg.columns.map((col) => {
                  const allSkipped = col.steps.every(
                    (s) => s.state === "skipped"
                  );
                  return (
                    <div
                      key={col.id}
                      className={`flex flex-col rounded-xl border p-2.5 ${
                        col.isDecisionBranch
                          ? allSkipped
                            ? "border-dashed border-white/15 bg-[#050811]/60"
                            : "border-[#38BDF8]/30 bg-[#06101F]/70"
                          : "border-white/10 bg-[#050913]/70"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-1.5 border-b border-white/8 pb-1.5">
                        <span className="inline-flex items-center gap-1.5 font-mono-data text-[11px] font-semibold text-[#E2E8F0]">
                          <GitBranch
                            className={`h-3 w-3 ${
                              col.isDecisionBranch
                                ? "text-[#38BDF8]"
                                : "text-[#10B981]"
                            }`}
                            aria-hidden="true"
                          />
                          <span>{col.title}</span>
                        </span>
                        {col.isDecisionBranch && (
                          <span className="font-mono-data text-[10px] text-[#94A3B8]">
                            Karar dalı
                          </span>
                        )}
                      </div>

                      <div className="flex flex-1 flex-col justify-between">
                        {col.steps.map((branchStep, bIdx) => (
                          <div
                            key={branchStep.id}
                            className="flex flex-col"
                          >
                            <StepNodeCard
                              step={branchStep}
                              stepLabelById={stepLabelById}
                              nowMs={nowMs}
                              compact
                            />
                            {bIdx < col.steps.length - 1 && (
                              <VerticalConnector
                                dashed={branchStep.state === "skipped"}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Kolların birleşme oku (export adımına giriş) */}
              {!isLast && (
                <div className="my-1.5 flex flex-col items-center">
                  <div className="h-2.5 border-l-2 border-white/20" />
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-[#050912] px-2.5 py-0.5 font-mono-data text-[10px] text-[#94A3B8]">
                    <GitMerge
                      className="h-3 w-3 text-[#34D399]"
                      aria-hidden="true"
                    />
                    <span>Kollar birleşiyor</span>
                  </span>
                  <ArrowDown className="h-3.5 w-3.5 text-[#64748B]" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
});

const SOURCE_FLOW_CHAIN: Array<{
  title: string;
  sub?: string;
  stage?: Stage;
}> = [
  { title: "EPİAŞ Şeffaflık Platformu", stage: "epias" },
  { title: "BigQuery", sub: "epias_raw", stage: "bigquery" },
  { title: "dbt", sub: "epias_marts", stage: "dbt" },
  { title: "JSON", stage: "export" },
  { title: "Google Cloud Storage", stage: "gcs" },
  { title: "bu panel" },
];

export interface PipelineStatusBadgeProps {
  onOpenChange?: (open: boolean) => void;
}

export const PipelineStatusControl = memo(function PipelineStatusControl({
  onOpenChange,
}: PipelineStatusBadgeProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const handleSetOpen = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setOpen((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        onOpenChange?.(resolved);
        return resolved;
      });
    },
    [onOpenChange]
  );

  // Panel açıkken 60 sn'de bir, çekmece açıkken 20 sn'de bir pipeline_status.json oku
  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const fetchStatus = () => {
      loadPipelineStatus(controller.signal).then((res) => {
        if (!active) return;
        setStatus(res);
        setNowMs(Date.now());
      });
    };

    fetchStatus();
    const intervalMs = open ? POLL_DRAWER_OPEN_MS : POLL_BACKGROUND_MS;
    const timer = window.setInterval(fetchStatus, intervalMs);

    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [open]);

  // Çekmece açıkken veya çalışan adım varken canlı süre sayacı için her 1 saniyede bir nowMs güncelle
  const hasRunningStep = useMemo(() => {
    if (!status) return false;
    return status.pipelines.some(
      (p) =>
        p.run?.state === "running" ||
        p.steps.some((s) => s.state === "running")
    );
  }, [status]);

  useEffect(() => {
    const tickInterval = open || hasRunningStep ? 1000 : 15000;
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, tickInterval);
    return () => window.clearInterval(timer);
  }, [open, hasRunningStep]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleSetOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, handleSetOpen]);

  const badgeState = evaluateOverallBadgeState(status, nowMs);
  const badgeCfg = BADGE_CONFIG[badgeState];

  const isStale = useMemo(() => {
    if (!status) return true;
    const parsed = Date.parse(status.generated_at);
    if (Number.isNaN(parsed)) return true;
    return nowMs - parsed > STALE_THRESHOLD_MS;
  }, [status, nowMs]);

  const generatedTimeLabel = status
    ? formatIstanbulDateTime(status.generated_at)
    : "bilinmiyor";

  return (
    <>
      {/* Başlık "Hat" Rozeti */}
      <button
        type="button"
        onClick={() => handleSetOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Veri hattı durumu çekmecesini aç (${badgeCfg.label})`}
        title={`Veri hattı durumu · ${badgeCfg.label}`}
        className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 py-1.5 font-mono-data text-xs font-medium shadow-xl backdrop-blur-xl transition-all focus-visible:outline-2 focus-visible:outline-[#38BDF8] ${
          open
            ? "border-[#38BDF8]/65 bg-[#0A1324]/95 text-[#38BDF8]"
            : badgeCfg.buttonClass
        }`}
      >
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${badgeCfg.dotClass}`}
          aria-hidden="true"
        />
        <span className="hidden sm:inline">{badgeCfg.label}</span>
        <span className="sm:hidden">{badgeCfg.shortLabel}</span>
      </button>

      {/* Veri Hattı Durumu Çekmecesi / Modal */}
      {open && (
        <>
          <div
            aria-hidden="true"
            onClick={() => handleSetOpen(false)}
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Veri hattı durumu"
            className="pointer-events-auto fixed inset-x-2 top-14 bottom-3 z-50 mx-auto flex max-w-3xl flex-col overflow-x-hidden overflow-y-auto rounded-2xl border border-white/15 bg-[#050A14]/96 p-3.5 text-xs text-[#F8FAFC] shadow-[0_24px_70px_rgba(0,0,0,0.9)] backdrop-blur-2xl sm:inset-x-4 sm:top-16 sm:bottom-6 sm:p-5 md:right-4 md:left-auto md:mx-0 md:w-[calc(100vw-2rem)] md:max-w-[760px]"
          >
            {/* Üst Başlık */}
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#38BDF8]/35 bg-[#38BDF8]/12 text-[#38BDF8]">
                  <Activity className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="font-display text-sm font-bold text-[#F8FAFC] sm:text-base">
                    Veri Hattı Durumu
                  </h2>
                  <p className="font-mono-data text-[10.5px] text-[#94A3B8]">
                    Son durum güncellemesi: {generatedTimeLabel} · Çekmece
                    açıkken 20 sn&apos;de bir yenilenir
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleSetOpen(false)}
                aria-label="Veri hattı durumu çekmecesini kapat"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-[#94A3B8] transition-colors hover:bg-white/10 hover:text-[#F8FAFC]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-3.5 space-y-4">
              {/* 5 Dakika Kuralı: İzleyici Kapalı Uyarısı */}
              {isStale && (
                <div
                  role="status"
                  className="flex items-start gap-2.5 rounded-xl border border-white/15 bg-[#1E293B]/65 px-3 py-2.5 text-xs text-[#E2E8F0]"
                >
                  <Clock
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#94A3B8]"
                    aria-hidden="true"
                  />
                  <div className="leading-relaxed">
                    Hat izleyicisi çalışmıyor (Docker kapalı olabilir).
                    Gösterilen: son bilinen durum,{" "}
                    <strong className="font-mono-data font-semibold text-[#F8FAFC]">
                      {generatedTimeLabel}
                    </strong>
                    .
                  </div>
                </div>
              )}

              {/* Üstte "Veri nereden geliyor" Şeridi */}
              <div className="rounded-xl border border-white/12 bg-white/[0.03] p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                  Veri nereden geliyor
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {SOURCE_FLOW_CHAIN.map((item, idx) => {
                    const stg = item.stage ? STAGE_CONFIG[item.stage] : null;
                    return (
                      <div
                        key={item.title}
                        className="inline-flex items-center gap-1.5"
                      >
                        <span
                          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-mono-data text-[11px] ${
                            stg
                              ? stg.badgeClass
                              : "border-[#10B981]/40 bg-[#10B981]/12 font-semibold text-[#10B981]"
                          }`}
                        >
                          <span>{item.title}</span>
                          {item.sub && (
                            <span className="opacity-80">({item.sub})</span>
                          )}
                        </span>
                        {idx < SOURCE_FLOW_CHAIN.length - 1 && (
                          <ArrowRight
                            className="h-3.5 w-3.5 shrink-0 text-[#64748B]"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-white/8 pt-2 font-mono-data text-[10.5px] text-[#94A3B8]">
                  <span>Panelin okuduğu adres:</span>
                  <code className="rounded bg-black/40 px-1.5 py-0.5 text-[#E2E8F0]">
                    {DATA_BASE_URL}
                  </code>
                  {IS_SAMPLE_DATA && (
                    <span className="rounded border border-[#F59E0B]/40 bg-[#F59E0B]/15 px-1.5 py-0.5 font-semibold text-[#FCD34D]">
                      örnek veri
                    </span>
                  )}
                </div>
              </div>

              {/* Hat Kartları (pipelines[]) */}
              {status ? (
                <div className="space-y-4">
                  {status.pipelines.map((pipeline) => (
                    <PipelineCard
                      key={pipeline.id}
                      pipeline={pipeline}
                      nowMs={nowMs}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center font-mono-data text-xs text-[#94A3B8]">
                  pipeline_status.json okunamadı veya henüz üretilmedi.
                </div>
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
});
