import { memo } from "react";
import { AlertTriangle, Clock, Play, Radio, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DashboardMode } from "@/lib/data";
import {
  evaluateFreshness,
  formatLocalDate,
  formatTimestampParts,
} from "@/lib/format";
import type { SnapshotLatest } from "@/types";

interface HeaderBarProps {
  snapshot: SnapshotLatest | null;
  mode: DashboardMode;
  onModeChange: (mode: DashboardMode) => void;
  selectedHourTimestamp: string | null;
  loading: boolean;
}

export const HeaderBar = memo(function HeaderBar({
  snapshot,
  mode,
  onModeChange,
  selectedHourTimestamp,
  loading,
}: HeaderBarProps) {
  const isLive = mode === "live";
  const liveParts = snapshot ? formatTimestampParts(snapshot.live.ts) : null;
  const playbackParts = selectedHourTimestamp
    ? formatTimestampParts(selectedHourTimestamp)
    : null;
  const plantsDateFormatted = snapshot
    ? formatLocalDate(snapshot.plants_day.date)
    : null;

  const liveFreshness = snapshot
    ? evaluateFreshness(snapshot.live.ts, 4, 6)
    : null;

  return (
    <header
      className={`z-20 border-b bg-[#0D1422]/95 px-3 py-2 backdrop-blur-md transition-colors sm:px-5 ${
        isLive ? "border-[#1E293B]" : "border-[#38BDF8]/35"
      }`}
    >
      <div className="mx-auto flex max-w-[1920px] flex-wrap items-center justify-between gap-2.5">
        {/* Sol: Başlık ve Aktif Mod Rozeti */}
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors ${
              isLive
                ? "border-[#10B981]/30 bg-[#10B981]/10 text-[#10B981]"
                : "border-[#38BDF8]/40 bg-[#38BDF8]/15 text-[#38BDF8]"
            }`}
          >
            <Zap className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-sm font-bold tracking-tight text-[#F8FAFC] sm:text-base">
                Türkiye Enerji Haritası
              </h1>
              {isLive ? (
                <Badge variant="live" className="font-mono-data text-[11px]">
                  <span
                    className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse"
                    aria-hidden="true"
                  />
                  CANLI MOD
                </Badge>
              ) : (
                <Badge
                  variant="playback"
                  className="font-mono-data text-[11px] tabular-nums"
                >
                  <Play
                    className="h-2.5 w-2.5 fill-current text-[#38BDF8]"
                    aria-hidden="true"
                  />
                  OYNATMA MODU
                  {playbackParts
                    ? ` · ${playbackParts.date} ${playbackParts.hour}`
                    : ""}
                </Badge>
              )}
            </div>
            <p className="hidden text-xs text-[#94A3B8] lg:block">
              Gerçek zamanlı lisanslı elektrik üretimi ve santral izleme paneli
            </p>
          </div>
        </div>

        {/* Orta: "Canlı" / "Oynatma (24 saat)" Mod Seçici */}
        <div
          role="group"
          aria-label="Panel çalışma modu seçimi"
          className="inline-flex items-center rounded-lg border border-[#1E293B] bg-[#060A12] p-0.5"
        >
          <button
            type="button"
            onClick={() => onModeChange("live")}
            aria-pressed={isLive}
            className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all focus-visible:outline-2 focus-visible:outline-[#10B981] ${
              isLive
                ? "bg-[#10B981]/18 text-[#10B981] shadow-[inset_0_0_0_1px_rgba(16,185,129,0.45)]"
                : "text-[#94A3B8] hover:text-[#F8FAFC]"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isLive ? "bg-[#10B981] animate-pulse" : "bg-[#64748B]"
              }`}
              aria-hidden="true"
            />
            <span>Canlı</span>
          </button>

          <button
            type="button"
            onClick={() => onModeChange("playback")}
            aria-pressed={!isLive}
            className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all focus-visible:outline-2 focus-visible:outline-[#38BDF8] ${
              !isLive
                ? "bg-[#38BDF8]/18 text-[#38BDF8] shadow-[inset_0_0_0_1px_rgba(56,189,248,0.45)]"
                : "text-[#94A3B8] hover:text-[#F8FAFC]"
            }`}
          >
            <Play
              className={`h-3 w-3 ${
                !isLive ? "fill-current text-[#38BDF8]" : "text-[#64748B]"
              }`}
              aria-hidden="true"
            />
            <span>Oynatma (24 saat)</span>
          </button>
        </div>

        {/* Sağ: Zaman Damgaları ve Tazelik */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {loading ? (
            <div className="h-6 w-56 animate-pulse rounded bg-[#151F32]" />
          ) : snapshot && liveParts ? (
            isLive ? (
              <>
                <div
                  className="flex items-center gap-1.5 rounded-md border border-[#10B981]/30 bg-[#151F32]/85 px-2.5 py-1 text-[#F8FAFC]"
                  title={`Son kesinleşmiş ülke verisi saati: ${snapshot.live.ts}`}
                >
                  <Radio
                    className="h-3.5 w-3.5 text-[#10B981]"
                    aria-hidden="true"
                  />
                  <span className="text-[#94A3B8]">Sayaçlar (Canlı):</span>
                  <span className="font-mono-data font-semibold text-[#10B981] tabular-nums">
                    {liveParts.date} {liveParts.hour}
                  </span>
                </div>

                <div
                  className="hidden items-center gap-1.5 rounded-md border border-[#1E293B] bg-[#060A12]/80 px-2.5 py-1 text-[#94A3B8] xl:flex"
                  title={`Santral bazlı veri günü: ${snapshot.plants_day.last_hour_ts}`}
                >
                  <Clock
                    className="h-3.5 w-3.5 text-[#38BDF8]"
                    aria-hidden="true"
                  />
                  <span>Harita (Santral günü):</span>
                  <span className="font-mono-data font-medium text-[#F8FAFC] tabular-nums">
                    {plantsDateFormatted} 23:00
                  </span>
                </div>

                {liveFreshness && liveFreshness.level !== "fresh" && (
                  <Badge
                    variant={
                      liveFreshness.level === "error" ? "error" : "warning"
                    }
                    className="tabular-nums"
                  >
                    <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                    <span>Ülke verisi {liveFreshness.label}</span>
                  </Badge>
                )}
              </>
            ) : (
              <div
                className="flex items-center gap-1.5 rounded-md border border-[#38BDF8]/40 bg-[#151F32]/90 px-2.5 py-1 text-[#F8FAFC]"
                title="Oynatma modunda sayaçlar ve harita aynı güne ve saate senkronizedir"
              >
                <Clock
                  className="h-3.5 w-3.5 text-[#38BDF8]"
                  aria-hidden="true"
                />
                <span className="text-[#94A3B8]">Senkron saat:</span>
                <span className="font-mono-data font-semibold text-[#38BDF8] tabular-nums">
                  {playbackParts
                    ? `${playbackParts.date} ${playbackParts.hour}`
                    : `${plantsDateFormatted} 23:00`}
                </span>
                <span className="hidden text-[11px] text-[#94A3B8] sm:inline">
                  (Sayaçlar + Harita)
                </span>
              </div>
            )
          ) : null}
        </div>
      </div>
    </header>
  );
});
