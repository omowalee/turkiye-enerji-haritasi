import { memo, useState } from "react";
import { DEFAULT_SOURCE_ORDER, SOURCE_PALETTE } from "@/lib/constants";
import type { HourlyCounterSnapshot, Province24hSeries } from "@/lib/data";
import type { MapFilter } from "@/lib/visual";
import type { SourceLabels, SourceType } from "@/types";

export interface SourceFilterBarProps {
  activeFilter: MapFilter;
  onSelectFilter: (filter: MapFilter) => void;
  sourceLabels: SourceLabels | null;
  activeCounter: HourlyCounterSnapshot | null;
  provinceSeriesByPlate: ReadonlyMap<number, Province24hSeries> | null;
  selectedHourIndex: number;
}

interface FilterButtonConfig {
  id: MapFilter;
  label: string;
  colorHex: string;
  dotColorHex: string | null;
  isZeroAtHour: boolean;
  zeroTooltip: string | null;
}

export const SourceFilterBar = memo(function SourceFilterBar({
  activeFilter,
  onSelectFilter,
  sourceLabels,
  activeCounter,
  provinceSeriesByPlate,
  selectedHourIndex,
}: SourceFilterBarProps) {
  const [hoveredDisabledId, setHoveredDisabledId] = useState<MapFilter | null>(
    null
  );

  const sourceOrder = sourceLabels?.order ?? DEFAULT_SOURCE_ORDER;

  // Seçili saatte her kaynağın Türkiye genelindeki üretimini kontrol et (hem ülke sayacı hem il toplamı)
  const getSourceHourMw = (source: SourceType): number => {
    let provSum = 0;
    if (provinceSeriesByPlate) {
      for (const series of provinceSeriesByPlate.values()) {
        provSum += series.hours[selectedHourIndex]?.bySource[source] ?? 0;
      }
    }
    const counterMw = activeCounter?.bySource[source]?.mw ?? 0;
    return Math.max(provSum, counterMw);
  };

  let renewableHourSum = 0;
  let fossilHourSum = 0;
  for (const key of sourceOrder) {
    const mw = getSourceHourMw(key);
    const isRen =
      sourceLabels?.sources[key]?.renewable ?? SOURCE_PALETTE[key].renewable;
    if (isRen) {
      renewableHourSum += mw;
    } else {
      fossilHourSum += mw;
    }
  }

  const buttons: FilterButtonConfig[] = [
    {
      id: "all",
      label: "Tümü",
      colorHex: "#38BDF8",
      dotColorHex: null,
      isZeroAtHour: false,
      zeroTooltip: null,
    },
    {
      id: "renewable",
      label: "Yenilenebilir",
      colorHex: "#10B981",
      dotColorHex: "#10B981",
      isZeroAtHour: renewableHourSum < 0.5,
      zeroTooltip:
        renewableHourSum < 0.5
          ? "Seçili saatte yenilenebilir üretim yok"
          : null,
    },
    {
      id: "fossil",
      label: "Fosil",
      colorHex: "#FB923C",
      dotColorHex: "#FB923C",
      isZeroAtHour: fossilHourSum < 0.5,
      zeroTooltip:
        fossilHourSum < 0.5 ? "Seçili saatte fosil üretim yok" : null,
    },
    ...sourceOrder.map((key): FilterButtonConfig => {
      const label =
        sourceLabels?.sources[key]?.label ?? SOURCE_PALETTE[key].fallbackLabel;
      const hex = SOURCE_PALETTE[key].hex;
      const mw = getSourceHourMw(key);
      const isZero = mw < 0.5;
      const zeroTooltip = isZero
        ? key === "nuclear"
          ? "Akkuyu henüz üretimde değil"
          : `${label}: Seçili saatte üretim yok (0 MW)`
        : null;

      return {
        id: key,
        label,
        colorHex: hex,
        dotColorHex: hex,
        isZeroAtHour: isZero,
        zeroTooltip,
      };
    }),
  ];

  const renderFilterChip = (btn: FilterButtonConfig, isMobile: boolean) => {
    const isSelected = activeFilter === btn.id;
    // Seçili saatte Türkiye genelinde üretimi 0 olan kaynakların düğmesi pasif olsun
    const isDisabled = btn.isZeroAtHour && !isSelected;
    const showTooltip = hoveredDisabledId === btn.id && btn.zeroTooltip;

    return (
      <div
        key={btn.id}
        className="relative shrink-0"
        onMouseEnter={() => {
          if (isDisabled || btn.zeroTooltip) setHoveredDisabledId(btn.id);
        }}
        onMouseLeave={() => {
          setHoveredDisabledId((prev) => (prev === btn.id ? null : prev));
        }}
      >
        <button
          type="button"
          disabled={isDisabled}
          aria-pressed={isSelected}
          title={btn.zeroTooltip ?? `${btn.label} görünümü`}
          onClick={() => {
            if (isDisabled) return;
            onSelectFilter(
              isSelected && btn.id !== "all" ? "all" : btn.id
            );
          }}
          style={
            isSelected
              ? {
                  borderColor: btn.colorHex,
                  backgroundColor: `${btn.colorHex}26`,
                  color: "#F8FAFC",
                  boxShadow: `0 0 14px ${btn.colorHex}38, inset 0 0 0 1px ${btn.colorHex}66`,
                }
              : undefined
          }
          className={`inline-flex items-center gap-1.5 rounded-xl border font-medium whitespace-nowrap transition-all focus-visible:outline-2 focus-visible:outline-[#38BDF8] ${
            isMobile ? "px-2.5 py-1 text-[11px]" : "px-2.5 py-1 text-[11px]"
          } ${
            isSelected
              ? "font-semibold"
              : isDisabled
                ? "cursor-not-allowed border-white/5 bg-white/[0.02] text-[#475569] opacity-45"
                : "border-white/10 bg-[#050A14]/70 text-[#CBD5E1] hover:border-white/25 hover:bg-white/[0.08] hover:text-[#F8FAFC]"
          }`}
        >
          {btn.dotColorHex && (
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{
                backgroundColor: btn.dotColorHex,
                opacity: isDisabled ? 0.35 : 1,
              }}
              aria-hidden="true"
            />
          )}
          <span>{btn.label}</span>
        </button>

        {/* Pasif (0 MW) düğme üzerine gelince açıklama balonu */}
        {showTooltip && (
          <div
            role="tooltip"
            className="pointer-events-none absolute top-full left-1/2 z-40 mt-1.5 -translate-x-1/2 rounded-lg border border-white/15 bg-[#060B14]/95 px-2.5 py-1 text-[11px] font-medium whitespace-nowrap text-[#F8FAFC] shadow-xl backdrop-blur-xl"
          >
            {btn.zeroTooltip}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* MASAÜSTÜ (>= 768px): Haritanın üst ortasında yarı saydam cam görünümlü yatay düğme grubu */}
      <nav
        aria-label="Kaynak filtresi düğmeleri"
        className="pointer-events-auto fixed top-4 left-[444px] right-[216px] z-20 hidden justify-center md:flex"
      >
        <div className="flex max-w-full flex-wrap items-center justify-center gap-1 rounded-2xl border border-white/12 bg-[#060B14]/80 p-1.5 shadow-[0_18px_45px_rgba(0,0,0,0.75)] backdrop-blur-xl">
          {buttons.map((btn) => renderFilterChip(btn, false))}
        </div>
      </nav>

      {/* MOBİL (< 768px): Haritanın altında yatay kaydırılabilir çipler */}
      <nav
        aria-label="Mobil kaynak filtresi çipleri"
        className="pointer-events-auto fixed inset-x-2.5 bottom-[104px] z-20 md:hidden"
      >
        <div className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-white/12 bg-[#060B14]/86 px-2 py-1.5 shadow-xl backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {buttons.map((btn) => renderFilterChip(btn, true))}
        </div>
      </nav>
    </>
  );
});
