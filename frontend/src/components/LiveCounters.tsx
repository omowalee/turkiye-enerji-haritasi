import { Activity, Flame, Leaf, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SOURCE_PALETTE } from "@/lib/constants";
import {
  formatAkkuyu,
  formatMw,
  formatPercent,
  formatPtf,
  formatTimestampParts,
} from "@/lib/format";
import type { SnapshotLatest, SourceLabels, SourceType } from "@/types";

interface LiveCountersProps {
  snapshot: SnapshotLatest | null;
  sourceLabels: SourceLabels | null;
  loading: boolean;
}

export function LiveCounters({
  snapshot,
  sourceLabels,
  loading,
}: LiveCountersProps) {
  if (loading) {
    return (
      <section
        aria-label="Canlı üretim sayaçları yükleniyor"
        className="z-10 border-b border-[#1E293B] bg-[#0D1422]/85 px-3 py-3 backdrop-blur-md sm:px-5"
      >
        <div className="mx-auto max-w-[1920px] space-y-3">
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-11">
            {Array.from({ length: 11 }).map((_, idx) => (
              <Skeleton key={idx} className="h-16 w-full" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!snapshot || !sourceLabels) {
    return null;
  }

  const { live } = snapshot;
  const tsParts = formatTimestampParts(live.ts);
  const sourceOrder = sourceLabels.order;

  // En yüksek üretim yapan kaynağı bul
  let topSourceKey: SourceType = "hydro_dam";
  let topSourceMw = -1;
  let topSourceAkkuyu = 0;

  for (const key of sourceOrder) {
    const item = live.by_source[key];
    const mw = item?.mw ?? 0;
    if (mw > topSourceMw) {
      topSourceMw = mw;
      topSourceKey = key;
      topSourceAkkuyu = item?.akkuyu ?? 0;
    }
  }

  const topSourceLabel =
    sourceLabels.sources[topSourceKey]?.label ??
    SOURCE_PALETTE[topSourceKey].fallbackLabel;
  const topSourceColor = SOURCE_PALETTE[topSourceKey].hex;

  return (
    <section
      aria-label="Canlı ülke üretim sayaçları"
      className="z-10 border-b border-[#1E293B] bg-[#0D1422]/90 px-3 py-2.5 backdrop-blur-md sm:px-5"
    >
      <div className="mx-auto max-w-[1920px] space-y-2.5">
        {/* Üst 4 Ana Gösterge Kartı */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          {/* 1. Toplam Lisanslı Üretim */}
          <Card className="border-[#1E293B] bg-[#060A12]/85 px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                Toplam Üretim
              </span>
              <span className="font-mono-data text-[11px] text-[#10B981] tabular-nums">
                {tsParts.hour}
              </span>
            </div>
            <div className="mt-1 font-display text-xl font-bold tracking-tight text-[#F8FAFC] tabular-nums sm:text-2xl">
              {formatMw(live.total_mw)}
            </div>
            <div className="mt-0.5 flex items-center justify-between text-[11px] text-[#94A3B8]">
              <span>Lisanslı yurt içi üretim</span>
              <span className="font-mono-data text-[#64748B] tabular-nums">
                {tsParts.date}
              </span>
            </div>
          </Card>

          {/* 2. Yenilenebilir Payı */}
          <Card className="border-[#1E293B] bg-[#060A12]/85 px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                Yenilenebilir Payı
              </span>
              <Leaf className="h-3.5 w-3.5 text-[#10B981]" aria-hidden="true" />
            </div>
            <div className="mt-1 font-display text-xl font-bold tracking-tight text-[#10B981] tabular-nums sm:text-2xl">
              {formatPercent(live.renewable_share_pct)}
            </div>
            <div className="mt-0.5 flex items-center justify-between text-[11px] text-[#94A3B8]">
              <span>Lisanslı yurt içi üretim</span>
              <span className="font-mono-data text-[#64748B] tabular-nums">
                {tsParts.range}
              </span>
            </div>
          </Card>

          {/* 3. Lider Kaynak */}
          <Card className="border-[#1E293B] bg-[#060A12]/85 px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                En Büyük Kaynak
              </span>
              <Activity
                className="h-3.5 w-3.5"
                style={{ color: topSourceColor }}
                aria-hidden="true"
              />
            </div>
            <div className="mt-1 flex items-baseline gap-2 truncate">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: topSourceColor }}
                aria-hidden="true"
              />
              <span className=" truncate font-display text-base font-bold text-[#F8FAFC] sm:text-lg">
                {topSourceLabel}
              </span>
            </div>
            <div className="mt-0.5 flex items-center justify-between text-[11px] text-[#94A3B8] tabular-nums">
              <span className="font-mono-data font-medium text-[#F8FAFC]">
                {formatMw(Math.max(0, topSourceMw))}
              </span>
              <span className="font-mono-data text-[#94A3B8]">
                {formatAkkuyu(topSourceAkkuyu)}
              </span>
            </div>
          </Card>

          {/* 4. PTF (Kesinleşmiş Saat) */}
          <Card className="border-[#1E293B] bg-[#060A12]/85 px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                PTF (Kesinleşmiş)
              </span>
              <TrendingUp
                className="h-3.5 w-3.5 text-[#38BDF8]"
                aria-hidden="true"
              />
            </div>
            <div className="mt-1 font-display text-lg font-bold tracking-tight text-[#F8FAFC] tabular-nums sm:text-xl">
              {formatPtf(live.ptf_tl_mwh)}
            </div>
            <div className="mt-0.5 flex items-center justify-between text-[11px] text-[#94A3B8]">
              <span>Piyasa Takas Fiyatı</span>
              <span className="font-mono-data text-[#64748B] tabular-nums">
                {tsParts.hour}
              </span>
            </div>
          </Card>
        </div>

        {/* 11 Kaynak Kırılım Şeridi (MW + Akkuyu Eşdeğeri) */}
        <div
          aria-label="Kaynak bazında lisanslı üretim ve Akkuyu eşdeğerleri"
          className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11"
        >
          {sourceOrder.map((sourceKey) => {
            const palette = SOURCE_PALETTE[sourceKey];
            const meta = sourceLabels.sources[sourceKey];
            const label = meta?.label ?? palette.fallbackLabel;
            const isRenewable = meta?.renewable ?? palette.renewable;
            const sourceData = live.by_source[sourceKey];
            const mw = sourceData?.mw ?? 0;
            const akkuyu = sourceData?.akkuyu ?? 0;
            const sharePct =
              live.total_mw > 0 ? (mw / live.total_mw) * 100 : 0;
            const isZero = mw === 0;

            return (
              <div
                key={sourceKey}
                className={`flex flex-col justify-between rounded-md border px-2.5 py-1.5 transition-colors ${
                  isZero
                    ? "border-[#1E293B]/50 bg-[#060A12]/40 opacity-60"
                    : "border-[#1E293B] bg-[#151F32]/55 hover:border-[#334155]"
                }`}
              >
                {/* Üst satır: Renk noktası + Kaynak etiketi + yüzde */}
                <div className="flex items-center justify-between gap-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: palette.hex }}
                      aria-hidden="true"
                    />
                    <span
                      className="truncate text-xs font-medium text-[#F8FAFC]"
                      title={label}
                    >
                      {label}
                    </span>
                  </div>
                  {isRenewable ? (
                    <span
                      className="shrink-0 text-[10px] text-[#10B981]"
                      title="Yenilenebilir kaynak"
                    >
                      ●
                    </span>
                  ) : (
                    <Flame
                      className="h-2.5 w-2.5 shrink-0 text-[#64748B]"
                      aria-hidden="true"
                    />
                  )}
                </div>

                {/* Orta satır: MW ve Yüzde Payı */}
                <div className="mt-1 flex items-baseline justify-between gap-1 tabular-nums">
                  <span className="font-mono-data text-xs font-semibold text-[#F8FAFC]">
                    {formatMw(mw)}
                  </span>
                  <span className="font-mono-data text-[11px] text-[#94A3B8]">
                    {formatPercent(sharePct)}
                  </span>
                </div>

                {/* Alt satır: Akkuyu eşdeğeri */}
                <div className="mt-0.5 flex items-center justify-between text-[11px] text-[#94A3B8] tabular-nums">
                  <span className="font-mono-data">
                    {isZero ? "0,00 Akkuyu" : formatAkkuyu(akkuyu)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
