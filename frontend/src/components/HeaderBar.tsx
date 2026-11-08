import { AlertTriangle, Clock, Radio, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  evaluateFreshness,
  formatLocalDate,
  formatTimestampParts,
} from "@/lib/format";
import type { SnapshotLatest } from "@/types";

interface HeaderBarProps {
  snapshot: SnapshotLatest | null;
  loading: boolean;
}

export function HeaderBar({ snapshot, loading }: HeaderBarProps) {
  const liveParts = snapshot ? formatTimestampParts(snapshot.live.ts) : null;
  const plantsDateFormatted = snapshot
    ? formatLocalDate(snapshot.plants_day.date)
    : null;

  const liveFreshness = snapshot
    ? evaluateFreshness(snapshot.live.ts, 4, 6)
    : null;

  return (
    <header className="z-20 border-b border-[#1E293B] bg-[#0D1422]/95 px-3 py-2.5 backdrop-blur-md sm:px-5">
      <div className="mx-auto flex max-w-[1920px] flex-wrap items-center justify-between gap-2">
        {/* Sol: Başlık ve Mod Rozeti */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[#10B981]/30 bg-[#10B981]/10 text-[#10B981]">
            <Zap className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-sm font-bold tracking-tight text-[#F8FAFC] sm:text-base">
                Türkiye Enerji Haritası
              </h1>
              <Badge variant="live" className="font-mono-data text-[11px]">
                <span
                  className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse"
                  aria-hidden="true"
                />
                CANLI MOD
              </Badge>
            </div>
            <p className="hidden text-xs text-[#94A3B8] sm:block">
              Gerçek zamanlı lisanslı elektrik üretimi ve santral izleme paneli
            </p>
          </div>
        </div>

        {/* Sağ: Zaman Damgaları ve Tazelik */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {loading ? (
            <div className="h-6 w-56 animate-pulse rounded bg-[#151F32]" />
          ) : snapshot && liveParts ? (
            <>
              <div
                className="flex items-center gap-1.5 rounded-md border border-[#1E293B] bg-[#151F32]/80 px-2.5 py-1 text-[#F8FAFC]"
                title={`Son kesinleşmiş ülke verisi saati: ${snapshot.live.ts}`}
              >
                <Radio
                  className="h-3.5 w-3.5 text-[#10B981]"
                  aria-hidden="true"
                />
                <span className="text-[#94A3B8]">Ülke verisi:</span>
                <span className="font-mono-data font-medium tabular-nums">
                  {liveParts.date} {liveParts.range}
                </span>
                <span className="text-[11px] text-[#64748B]">(+03:00)</span>
              </div>

              <div
                className="hidden items-center gap-1.5 rounded-md border border-[#1E293B] bg-[#060A12]/80 px-2.5 py-1 text-[#94A3B8] md:flex"
                title={`Santral bazlı veri günü: ${snapshot.plants_day.last_hour_ts}`}
              >
                <Clock className="h-3.5 w-3.5 text-[#38BDF8]" aria-hidden="true" />
                <span>Santral günü:</span>
                <span className="font-mono-data font-medium text-[#F8FAFC] tabular-nums">
                  {plantsDateFormatted} (23:00)
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
          ) : null}
        </div>
      </div>
    </header>
  );
}
