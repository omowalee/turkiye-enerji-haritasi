import { memo } from "react";
import { Leaf, Pin, X } from "lucide-react";
import { DEFAULT_SOURCE_ORDER, SOURCE_PALETTE } from "@/lib/constants";
import type { ProvinceHourlySlice } from "@/lib/data";
import { formatMw, formatPercent } from "@/lib/format";
import type { MapFilter } from "@/lib/visual";
import type { SourceLabels } from "@/types";

export interface FilterProvinceRankInfo {
  filterLabel: string;
  filterColorHex: string;
  provinceFilterMw: number;
  nationalFilterSharePct: number;
  provinceFilterRank: number | null;
}

export interface ProvinceFloatingPanelProps {
  plate: number;
  provinceName: string;
  hourSlice: ProvinceHourlySlice;
  totalRankInTurkey: number | null;
  hourLabel: string;
  sourceLabels: SourceLabels | null;
  activeFilter: MapFilter;
  filterRankInfo: FilterProvinceRankInfo | null;
  screenX: number;
  screenY: number;
  containerWidth: number;
  containerHeight: number;
  isPinned: boolean;
  onClose: () => void;
}

export const ProvinceFloatingPanel = memo(function ProvinceFloatingPanel({
  provinceName,
  hourSlice,
  totalRankInTurkey,
  hourLabel,
  sourceLabels,
  activeFilter,
  filterRankInfo,
  screenX,
  screenY,
  containerWidth,
  containerHeight,
  isPinned,
  onClose,
}: ProvinceFloatingPanelProps) {
  const sourceOrder = sourceLabels?.order ?? DEFAULT_SOURCE_ORDER;

  // 0 MW olan kaynakları gizle, kalanları büyükten küçüğe sırala
  const activeSources = sourceOrder
    .map((source) => {
      const mw = hourSlice.bySource[source] ?? 0;
      const sharePct =
        hourSlice.totalMw > 0 ? (mw / hourSlice.totalMw) * 100 : 0;
      const label =
        sourceLabels?.sources[source]?.label ??
        SOURCE_PALETTE[source].fallbackLabel;
      const hex = SOURCE_PALETTE[source].hex;
      return { source, label, mw, sharePct, hex };
    })
    .filter((item) => item.mw >= 0.5)
    .sort((a, b) => b.mw - a.mw);

  // Masaüstünde ilin hemen yanında (ekran dışına taşmadan) konumlandır
  const cardWidth = 304;
  const estimatedHeight = Math.min(390, 160 + activeSources.length * 32);

  const preferRight = screenX + 28 + cardWidth < containerWidth - 16;
  const left = preferRight
    ? Math.max(16, screenX + 24)
    : Math.max(16, screenX - cardWidth - 24);
  const top = Math.min(
    Math.max(76, screenY - Math.round(estimatedHeight * 0.35)),
    Math.max(80, containerHeight - estimatedHeight - 92)
  );

  const panelBody = (
    <>
      {/* Başlık: İl Adı, Saat, Sabitlenme Rozeti ve Kapat (X) Düğmesi */}
      <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-base font-bold tracking-tight text-[#F8FAFC]">
              {provinceName}
            </h3>
            <span className="rounded-md border border-white/12 bg-white/[0.05] px-1.5 py-0.5 font-mono-data text-[10px] font-semibold text-[#94A3B8] tabular-nums">
              {hourLabel}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#94A3B8] tabular-nums">
            <span className="font-mono-data text-sm font-bold text-[#F8FAFC]">
              {formatMw(hourSlice.totalMw)}
            </span>
            {totalRankInTurkey !== null && hourSlice.totalMw >= 0.5 ? (
              <>
                <span className="text-white/20">·</span>
                <span className="font-medium text-[#38BDF8]">
                  Türkiye&apos;de {totalRankInTurkey}. sırada
                </span>
              </>
            ) : (
              <>
                <span className="text-white/20">·</span>
                <span className="text-[#64748B]">Üretim yok</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {isPinned ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Sabitlenmiş il panelini kapat"
              title="Kapat (Esc)"
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-[#F8FAFC] transition-colors hover:bg-white/20"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-[#64748B]">
              <Pin className="h-2.5 w-2.5" aria-hidden="true" />
              <span>Sabitlemek için tıkla</span>
            </span>
          )}
        </div>
      </div>

      {/* Filtre Aktifse: Seçili Kaynak Özeti (Örn: "Rüzgâr · 812 MW · Türkiye rüzgârının %18,3'ü · 1. sırada") */}
      {activeFilter !== "all" && filterRankInfo && (
        <div
          style={{
            borderColor: `${filterRankInfo.filterColorHex}55`,
            backgroundColor: `${filterRankInfo.filterColorHex}14`,
          }}
          className="mt-2.5 rounded-xl border px-2.5 py-2 text-[11px] leading-snug tabular-nums"
        >
          <div className="flex flex-wrap items-center gap-1 font-medium text-[#F8FAFC]">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: filterRankInfo.filterColorHex }}
              aria-hidden="true"
            />
            <span className="font-semibold">{filterRankInfo.filterLabel}</span>
            <span className="text-white/30">·</span>
            <span className="font-mono-data font-bold">
              {formatMw(filterRankInfo.provinceFilterMw)}
            </span>
            {filterRankInfo.provinceFilterMw >= 0.5 && (
              <>
                <span className="text-white/30">·</span>
                <span className="text-[#E2E8F0]">
                  Türkiye {filterRankInfo.filterLabel.toLocaleLowerCase("tr-TR")}{" "}
                  üretiminin{" "}
                  <strong className="font-mono-data text-[#F8FAFC]">
                    {formatPercent(filterRankInfo.nationalFilterSharePct)}
                  </strong>
                  &apos;i
                </span>
                {filterRankInfo.provinceFilterRank !== null && (
                  <>
                    <span className="text-white/30">·</span>
                    <strong
                      style={{ color: filterRankInfo.filterColorHex }}
                      className="font-mono-data"
                    >
                      {filterRankInfo.provinceFilterRank}. sırada
                    </strong>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Yenilenebilir Payı Satırı */}
      <div className="mt-2.5 flex items-center justify-between rounded-lg border border-white/8 bg-[#050912]/80 px-2.5 py-1.5 text-[11px] tabular-nums">
        <span className="inline-flex items-center gap-1.5 text-[#94A3B8]">
          <Leaf className="h-3.5 w-3.5 text-[#10B981]" aria-hidden="true" />
          <span>Yenilenebilir payı</span>
        </span>
        <span className="font-mono-data font-bold text-[#10B981]">
          {formatPercent(hourSlice.renewableSharePct)}
        </span>
      </div>

      {/* Kaynak Dağılımı Listesi (Büyükten küçüğe: Renkli Çubuk + Yüzde + MW) */}
      <div className="mt-2.5 space-y-2 tabular-nums">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
          <span>Kaynak Dağılımı</span>
          <span>Pay · Üretim</span>
        </div>

        {activeSources.length === 0 ? (
          <p className="py-2 text-center text-[11px] text-[#64748B]">
            Bu saatte kayıtlı lisanslı üretim bulunmuyor.
          </p>
        ) : (
          <ul className="max-h-52 space-y-1.5 overflow-y-auto pr-0.5">
            {activeSources.map((item) => {
              const isSelectedFilterSource =
                activeFilter === item.source ||
                (activeFilter === "renewable" &&
                  (sourceLabels?.sources[item.source]?.renewable ??
                    SOURCE_PALETTE[item.source].renewable)) ||
                (activeFilter === "fossil" &&
                  !(
                    sourceLabels?.sources[item.source]?.renewable ??
                    SOURCE_PALETTE[item.source].renewable
                  ));

              return (
                <li
                  key={item.source}
                  className={`space-y-1 rounded-lg px-1.5 py-1 transition-opacity ${
                    activeFilter !== "all" && !isSelectedFilterSource
                      ? "opacity-55"
                      : "opacity-100"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="flex items-center gap-1.5 font-medium text-[#F8FAFC]">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.hex }}
                        aria-hidden="true"
                      />
                      <span>{item.label}</span>
                    </span>
                    <span className="font-mono-data text-[11px] text-[#E2E8F0]">
                      <strong className="font-semibold text-[#F8FAFC]">
                        {formatPercent(item.sharePct)}
                      </strong>{" "}
                      <span className="text-[#64748B]">·</span>{" "}
                      <span>{formatMw(item.mw)}</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      style={{
                        width: `${Math.max(3, Math.min(100, item.sharePct))}%`,
                        backgroundColor: item.hex,
                      }}
                      className="h-full rounded-full transition-all duration-300"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* MASAÜSTÜ (>= 768px): İlin yanında yüzen koyu cam panel */}
      <aside
        role={isPinned ? "dialog" : "status"}
        aria-label={`${provinceName} il üretim detayı`}
        style={{ left, top, width: cardWidth }}
        className={` fixed z-30 hidden rounded-2xl border bg-[#060B14]/92 p-3.5 text-xs shadow-[0_24px_60px_rgba(0,0,0,0.88)] backdrop-blur-2xl transition-colors md:block ${
          isPinned
            ? "pointer-events-auto border-[#38BDF8]/50 ring-1 ring-[#38BDF8]/25"
            : "pointer-events-none border-white/18"
        }`}
      >
        {panelBody}
      </aside>

      {/* MOBİL (< 768px): Alttan açılan sayfa (bottom sheet) */}
      <aside
        role="dialog"
        aria-label={`${provinceName} il üretim detayı`}
        className="pointer-events-auto fixed inset-x-2.5 bottom-20 z-30 rounded-2xl border border-[#38BDF8]/40 bg-[#060B14]/95 p-3.5 text-xs shadow-[0_24px_60px_rgba(0,0,0,0.92)] backdrop-blur-2xl md:hidden"
      >
        {panelBody}
      </aside>
    </>
  );
});
