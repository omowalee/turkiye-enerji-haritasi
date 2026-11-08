import { memo, useState } from "react";
import { SOURCE_PALETTE } from "@/lib/constants";
import type { HourlyCounterSnapshot } from "@/lib/data";
import { formatAkkuyu, formatMw, formatPercent } from "@/lib/format";
import type { MapFilter } from "@/lib/visual";
import type { SourceLabels, SourceType } from "@/types";

interface SourceStripProps {
  counter: HourlyCounterSnapshot;
  sourceLabels: SourceLabels;
  activeFilter: MapFilter;
  onSelectFilter: (filter: MapFilter) => void;
  compact?: boolean;
}

function isSourceSelectedByFilter(
  source: SourceType,
  filter: MapFilter,
  sourceLabels: SourceLabels
): boolean {
  if (filter === "all") return false;
  if (filter === "renewable") {
    return (
      sourceLabels.sources[source]?.renewable ?? SOURCE_PALETTE[source].renewable
    );
  }
  if (filter === "fossil") {
    return !(
      sourceLabels.sources[source]?.renewable ?? SOURCE_PALETTE[source].renewable
    );
  }
  return filter === source;
}

export const SourceStrip = memo(function SourceStrip({
  counter,
  sourceLabels,
  activeFilter,
  onSelectFilter,
  compact = false,
}: SourceStripProps) {
  const [hoveredKey, setHoveredKey] = useState<SourceType | null>(null);
  const sourceOrder = sourceLabels.order;
  const totalMw = counter.totalMw > 0 ? counter.totalMw : 1;

  const singleFilterSource: SourceType | null =
    activeFilter !== "all" &&
    activeFilter !== "renewable" &&
    activeFilter !== "fossil"
      ? activeFilter
      : null;

  const inspectedKey: SourceType | null = hoveredKey ?? singleFilterSource;
  const inspectedItem = inspectedKey ? counter.bySource[inspectedKey] : null;
  const inspectedPalette = inspectedKey ? SOURCE_PALETTE[inspectedKey] : null;
  const inspectedLabel = inspectedKey
    ? (sourceLabels.sources[inspectedKey]?.label ??
      SOURCE_PALETTE[inspectedKey].fallbackLabel)
    : null;
  const inspectedSharePct =
    inspectedItem && counter.totalMw > 0
      ? (inspectedItem.mw / counter.totalMw) * 100
      : 0;

  return (
    <div className="space-y-2" onMouseLeave={() => setHoveredKey(null)}>
      {/* 11 Dilimli Yatay Kaynak Şeridi (Genişlikler MW payına göre) */}
      <div
        role="img"
        aria-label="Kaynak bazında üretim payı şeridi"
        className="relative flex h-3 w-full overflow-hidden rounded-full bg-[#050914] p-[1px] ring-1 ring-white/10"
      >
        {sourceOrder.map((key) => {
          const item = counter.bySource[key];
          const mw = item?.mw ?? 0;
          const sharePct = counter.totalMw > 0 ? (mw / totalMw) * 100 : 0;
          const palette = SOURCE_PALETTE[key];
          const label =
            sourceLabels.sources[key]?.label ?? palette.fallbackLabel;
          const inActiveFilter = isSourceSelectedByFilter(
            key,
            activeFilter,
            sourceLabels
          );
          const isHighlighted =
            hoveredKey === key || (!hoveredKey && inActiveFilter);
          const isDimmed =
            (hoveredKey !== null && hoveredKey !== key) ||
            (hoveredKey === null && activeFilter !== "all" && !inActiveFilter);

          return (
            <button
              key={key}
              type="button"
              onMouseEnter={() => setHoveredKey(key)}
              onFocus={() => setHoveredKey(key)}
              onClick={() =>
                onSelectFilter(activeFilter === key ? "all" : key)
              }
              style={{
                width: `${sharePct}%`,
                minWidth: mw > 0 ? "3px" : "0px",
                backgroundColor: palette.hex,
              }}
              aria-pressed={activeFilter === key}
              aria-label={`${label}: ${formatMw(mw)} (${formatPercent(sharePct)}, ${formatAkkuyu(item?.akkuyu ?? 0)}) — Kaynak filtresi için tıkla`}
              className={`h-full transition-all duration-300 first:rounded-l-full last:rounded-r-full focus-visible:outline-none ${
                isDimmed
                  ? "opacity-25"
                  : isHighlighted
                    ? "opacity-100 brightness-110"
                    : "opacity-100"
              }`}
            />
          );
        })}
      </div>

      {/* Üzerine Gelinen / Filtrelenen Dilim Bilgi Satırı */}
      <div className="min-h-[22px] rounded-md border border-white/8 bg-[#050912]/80 px-2.5 py-1 text-[11px] tabular-nums">
        {inspectedKey && inspectedItem && inspectedPalette && inspectedLabel ? (
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
            <div className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{
                  backgroundColor: inspectedPalette.hex,
                }}
                aria-hidden="true"
              />
              <span className="font-semibold text-[#F8FAFC]">
                {inspectedLabel}
              </span>
              {activeFilter === inspectedKey && (
                <button
                  type="button"
                  onClick={() => onSelectFilter("all")}
                  className="rounded bg-white/10 px-1.5 py-0.2 text-[10px] text-[#38BDF8] hover:bg-white/20"
                >
                  Filtre aktif ×
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 font-mono-data text-[11px]">
              <span className="font-bold text-[#F8FAFC]">
                {formatMw(inspectedItem.mw)}
              </span>
              <span className="text-[#38BDF8]">
                {formatPercent(inspectedSharePct)}
              </span>
              <span className="text-[#94A3B8]">
                · {formatAkkuyu(inspectedItem.akkuyu)}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between text-[#64748B]">
            <span>Dilim/etiket: üzerine gel veya kaynak filtresi için tıkla</span>
            <span className="font-mono-data text-[10px]">
              MW · % · Akkuyu
            </span>
          </div>
        )}
      </div>

      {/* Altında Küçük Kaynak Etiketleri */}
      <div
        className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${
          compact ? "text-[10px]" : "text-[11px]"
        }`}
      >
        {sourceOrder.map((key) => {
          const item = counter.bySource[key];
          const mw = item?.mw ?? 0;
          const sharePct = counter.totalMw > 0 ? (mw / totalMw) * 100 : 0;
          const palette = SOURCE_PALETTE[key];
          const label =
            sourceLabels.sources[key]?.label ?? palette.fallbackLabel;
          const isSelected = activeFilter === key;
          const inGroupFilter = isSourceSelectedByFilter(
            key,
            activeFilter,
            sourceLabels
          );
          const isDimmed = activeFilter !== "all" && !inGroupFilter;
          const isZero = mw === 0;

          return (
            <button
              key={key}
              type="button"
              aria-pressed={isSelected}
              onMouseEnter={() => setHoveredKey(key)}
              onFocus={() => setHoveredKey(key)}
              onClick={() =>
                onSelectFilter(activeFilter === key ? "all" : key)
              }
              className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 transition-all ${
                isSelected
                  ? "border-white/30 bg-white/15 text-[#F8FAFC] shadow-sm"
                  : isDimmed
                    ? "border-transparent opacity-40 hover:opacity-80"
                    : isZero
                      ? "border-transparent text-[#64748B]/60 hover:text-[#94A3B8]"
                      : "border-transparent text-[#94A3B8] hover:bg-white/5 hover:text-[#F8FAFC]"
              }`}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{
                  backgroundColor: palette.hex,
                }}
                aria-hidden="true"
              />
              <span className="truncate font-medium">{label}</span>
              <span className="font-mono-data text-[10px] text-[#64748B] tabular-nums">
                {formatPercent(sharePct)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});
