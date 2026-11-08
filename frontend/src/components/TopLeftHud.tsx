import { memo, useMemo, useState } from "react";
import { Info, Leaf, Play, Zap } from "lucide-react";
import { SourceStrip } from "@/components/SourceStrip";
import { AnimatedValue } from "@/components/ui/animated-value";
import { Skeleton } from "@/components/ui/skeleton";
import { DEFAULT_SOURCE_ORDER, SOURCE_PALETTE } from "@/lib/constants";
import type {
  DashboardMode,
  HourlyCounterSnapshot,
  Province24hSeries,
} from "@/lib/data";
import {
  formatMw,
  formatNetTrade,
  formatPercent,
  formatPtf,
  formatTimestampParts,
} from "@/lib/format";
import type { MapFilter } from "@/lib/visual";
import type { SourceLabels } from "@/types";

interface TopLeftHudProps {
  counter: HourlyCounterSnapshot | null;
  sourceLabels: SourceLabels | null;
  provinceSeriesByPlate: ReadonlyMap<number, Province24hSeries> | null;
  selectedHourIndex: number;
  mode: DashboardMode;
  onModeChange: (mode: DashboardMode) => void;
  activeFilter: MapFilter;
  onSelectFilter: (filter: MapFilter) => void;
  animationDurationMs: number;
  loading: boolean;
}

export const TopLeftHud = memo(function TopLeftHud({
  counter,
  sourceLabels,
  provinceSeriesByPlate,
  selectedHourIndex,
  mode,
  onModeChange,
  activeFilter,
  onSelectFilter,
  animationDurationMs,
  loading,
}: TopLeftHudProps) {
  const isLive = mode === "live";
  const [showConsumptionTip, setShowConsumptionTip] = useState(false);

  // Seçili filtredeki ölçek bilgisini hesapla: "Ölçek: Biyokütle · en yüksek il İstanbul · 85 MW"
  const scaleInfo = useMemo(() => {
    if (!provinceSeriesByPlate || !sourceLabels) return null;

    let filterLabel = "Tümü";
    let filterHex = "#38BDF8";
    if (activeFilter === "renewable") {
      filterLabel = "Yenilenebilir";
      filterHex = "#10B981";
    } else if (activeFilter === "fossil") {
      filterLabel = "Fosil";
      filterHex = "#FB923C";
    } else if (activeFilter !== "all") {
      filterLabel =
        sourceLabels.sources[activeFilter]?.label ??
        SOURCE_PALETTE[activeFilter].fallbackLabel;
      filterHex = SOURCE_PALETTE[activeFilter].hex;
    }

    let topName: string | null = null;
    let topMw = 0;

    for (const series of provinceSeriesByPlate.values()) {
      const hourSlice = series.hours[selectedHourIndex];
      if (!hourSlice) continue;
      let val = 0;
      if (activeFilter === "all") {
        val = hourSlice.totalMw;
      } else if (activeFilter === "renewable") {
        val = hourSlice.renewableMw;
      } else if (activeFilter === "fossil") {
        val = hourSlice.fossilMw;
      } else {
        for (const src of DEFAULT_SOURCE_ORDER) {
          if (src === activeFilter) {
            val += hourSlice.bySource[src] ?? 0;
          }
        }
      }
      if (val > topMw) {
        topMw = val;
        topName = series.name;
      }
    }

    return {
      filterLabel,
      filterHex,
      topName,
      topMw,
    };
  }, [provinceSeriesByPlate, sourceLabels, activeFilter, selectedHourIndex]);

  if (loading || !counter || !sourceLabels) {
    return (
      <aside
        aria-label="Üretim özeti yükleniyor"
        className="pointer-events-auto fixed top-3 left-3 right-16 z-20 rounded-xl border border-white/10 bg-[#070C16]/78 p-3 shadow-2xl backdrop-blur-xl md:right-auto md:w-[410px] md:p-4"
      >
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-2 h-9 w-full md:h-16" />
      </aside>
    );
  }

  const tsParts = formatTimestampParts(counter.ts);
  const fullTimeLabel = `${tsParts.date} ${tsParts.hour}`;
  const netTradeSentence = formatNetTrade(counter.netImportMw);
  const consumptionTipText =
    "Gündüz farkın çoğu lisanssız (çatı/sayaç arkası) güneşten gelir; bu üretim gerçek zamanlı veride yok. Tüketim verisi üretimden yaklaşık 1 saat sonra yayımlanır.";

  return (
    <>
      {/* MOBİL (< 768px): Üstte kompakt cam panel */}
      <aside
        aria-label="Mobil canlı üretim özeti"
        className="pointer-events-auto fixed top-2.5 left-2.5 right-14 z-20 flex flex-col gap-1.5 rounded-xl border border-white/12 bg-[#060B14]/82 px-3 py-2 shadow-2xl backdrop-blur-xl md:hidden"
      >
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onModeChange(isLive ? "playback" : "live")}
            title={isLive ? "Oynatma moduna geç" : "Canlı moda geç"}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 font-mono-data text-[10px] font-bold uppercase tracking-wider ${
              isLive
                ? "border-[#10B981]/45 bg-[#10B981]/15 text-[#10B981]"
                : "border-[#38BDF8]/45 bg-[#38BDF8]/15 text-[#38BDF8]"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isLive ? "bg-[#10B981] animate-pulse" : "bg-[#38BDF8]"
              }`}
              aria-hidden="true"
            />
            <span>{isLive ? "CANLI" : "24s"}</span>
          </button>

          <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2 tabular-nums">
            <AnimatedValue
              value={counter.totalMw}
              format={formatMw}
              durationMs={animationDurationMs}
              className="font-display text-base font-bold tracking-tight text-[#F8FAFC]"
            />
            <span className="inline-flex items-center gap-0.5 font-mono-data text-xs font-semibold text-[#10B981]">
              <Leaf className="h-3 w-3" aria-hidden="true" />
              <AnimatedValue
                value={counter.renewableSharePct}
                format={formatPercent}
                durationMs={animationDurationMs}
              />
            </span>
            <span className="truncate font-mono-data text-[11px] text-[#94A3B8]">
              {fullTimeLabel}
            </span>
          </div>
        </div>

        {/* Mobil alt bilgi: Tüketim + Dış ticaret */}
        <div className="flex flex-col gap-0.5 border-t border-white/8 pt-1 text-[10.5px] text-[#94A3B8] tabular-nums">
          <div className="flex items-center gap-1.5">
            <span>Tüketim:</span>
            {counter.consumptionMw !== null ? (
              <AnimatedValue
                value={counter.consumptionMw}
                format={formatMw}
                durationMs={animationDurationMs}
                className="font-mono-data font-semibold text-[#F8FAFC]"
              />
            ) : (
              <span className="font-mono-data text-[#64748B]">
                henüz yayımlanmadı
              </span>
            )}
            <span title={consumptionTipText} className="inline-flex text-[#64748B]">
              <Info className="h-3 w-3" aria-hidden="true" />
            </span>
          </div>
          {netTradeSentence && (
            <div className="truncate text-[10px] text-[#94A3B8]">
              {netTradeSentence}
            </div>
          )}
        </div>
      </aside>

      {/* MASAÜSTÜ (>= 768px): Sol üst tek kompakt koyu cam panel */}
      <aside
        aria-label="Türkiye Enerji Haritası kontrol ve üretim özeti"
        className={`pointer-events-auto fixed top-4 left-4 z-20 hidden w-[420px] flex-col gap-3 rounded-2xl border bg-[#060B14]/78 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.75)] backdrop-blur-xl transition-colors md:flex ${
          isLive ? "border-white/12" : "border-[#38BDF8]/35"
        }`}
      >
        {/* 1. Satır: Küçük Başlık + Mod Seçici (Canlı / Oynatma) */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-md border ${
                isLive
                  ? "border-[#10B981]/35 bg-[#10B981]/12 text-[#10B981]"
                  : "border-[#38BDF8]/40 bg-[#38BDF8]/15 text-[#38BDF8]"
              }`}
            >
              <Zap className="h-3.5 w-3.5" aria-hidden="true" />
            </div>
            <h1 className="font-display text-sm font-bold tracking-tight text-[#F8FAFC]">
              Türkiye Enerji Haritası
            </h1>
          </div>

          <div
            role="group"
            aria-label="Çalışma modu seçimi"
            className="inline-flex items-center rounded-lg border border-white/10 bg-[#03060C]/90 p-0.5"
          >
            <button
              type="button"
              onClick={() => onModeChange("live")}
              aria-pressed={isLive}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all ${
                isLive
                  ? "bg-[#10B981]/20 text-[#10B981] shadow-[inset_0_0_0_1px_rgba(16,185,129,0.45)]"
                  : "text-[#94A3B8] hover:text-[#F8FAFC]"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
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
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all ${
                !isLive
                  ? "bg-[#38BDF8]/20 text-[#38BDF8] shadow-[inset_0_0_0_1px_rgba(56,189,248,0.45)]"
                  : "text-[#94A3B8] hover:text-[#F8FAFC]"
              }`}
            >
              <Play
                className={`h-2.5 w-2.5 ${
                  !isLive ? "fill-current text-[#38BDF8]" : "text-[#64748B]"
                }`}
                aria-hidden="true"
              />
              <span>Oynatma</span>
            </button>
          </div>
        </div>

        {/* 2. Satır: Büyük Rakamla Toplam MW + Yenilenebilir % + Saat + "Lisanslı yurt içi üretim" + 2 Satır (Tüketim & Dış Ticaret) */}
        <div className="flex flex-col gap-2 border-y border-white/8 py-2.5 tabular-nums">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="flex items-baseline gap-2.5">
                <AnimatedValue
                  value={counter.totalMw}
                  format={formatMw}
                  durationMs={animationDurationMs}
                  className="font-display text-3xl font-bold leading-none tracking-tight text-[#F8FAFC]"
                />
                <span
                  className="inline-flex items-center gap-1 rounded-md border border-[#10B981]/30 bg-[#10B981]/12 px-2 py-0.5 font-mono-data text-xs font-semibold text-[#10B981]"
                  title="Yenilenebilir enerji payı"
                >
                  <Leaf className="h-3 w-3" aria-hidden="true" />
                  <AnimatedValue
                    value={counter.renewableSharePct}
                    format={formatPercent}
                    durationMs={animationDurationMs}
                  />
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[#94A3B8]">
                <span>Lisanslı yurt içi üretim</span>
                {counter.ptfTlMwh !== null && (
                  <>
                    <span className="text-[#64748B]">·</span>
                    <span className="font-mono-data text-[#94A3B8]">
                      PTF:{" "}
                      <AnimatedValue
                        value={counter.ptfTlMwh}
                        format={formatPtf}
                        durationMs={animationDurationMs}
                        className="text-[#F8FAFC]"
                      />
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="text-right font-mono-data">
              <div
                className={`text-xs font-semibold ${
                  isLive ? "text-[#10B981]" : "text-[#38BDF8]"
                }`}
              >
                {tsParts.hour}
              </div>
              <div className="text-[11px] text-[#94A3B8]">{tsParts.date}</div>
            </div>
          </div>

          {/* Toplam üretimin altında sadece iki satır: 1) Tüketim + "i" ipucu, 2) Dış ticaret cümlesi */}
          <div className="flex flex-col gap-1 border-t border-white/6 pt-2 text-[11.5px] text-[#94A3B8]">
            {/* Satır 1: Tüketim + küçük "i" ipucu */}
            <div className="relative flex items-center gap-1.5">
              <span>Tüketim:</span>
              {counter.consumptionMw !== null ? (
                <AnimatedValue
                  value={counter.consumptionMw}
                  format={formatMw}
                  durationMs={animationDurationMs}
                  className="font-mono-data font-semibold text-[#F8FAFC]"
                />
              ) : (
                <span className="font-mono-data text-[#64748B]">
                  henüz yayımlanmadı
                </span>
              )}

              <div
                className="relative inline-flex items-center"
                onMouseEnter={() => setShowConsumptionTip(true)}
                onMouseLeave={() => setShowConsumptionTip(false)}
              >
                <button
                  type="button"
                  onFocus={() => setShowConsumptionTip(true)}
                  onBlur={() => setShowConsumptionTip(false)}
                  onClick={() => setShowConsumptionTip((v) => !v)}
                  aria-label="Tüketim ve lisanssız güneş farkı açıklaması"
                  title={consumptionTipText}
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] text-[#94A3B8] transition-colors hover:border-[#38BDF8]/50 hover:text-[#F8FAFC] focus-visible:outline-2 focus-visible:outline-[#38BDF8]"
                >
                  <Info className="h-2.5 w-2.5" aria-hidden="true" />
                </button>

                {showConsumptionTip && (
                  <div
                    role="tooltip"
                    className="pointer-events-none absolute bottom-full left-0 z-40 mb-2 w-72 rounded-xl border border-white/15 bg-[#060B14]/96 p-2.5 font-sans-ui text-[11px] leading-relaxed font-normal text-[#E2E8F0] shadow-2xl backdrop-blur-xl"
                  >
                    {consumptionTipText}
                  </div>
                )}
              </div>
            </div>

            {/* Satır 2: Dış ticaret tek cümle */}
            <div className="text-[11px] text-[#94A3B8]">
              {netTradeSentence ?? "Dış ticaret verisi henüz yayımlanmadı"}
            </div>
          </div>
        </div>

        {/* 3. Satır: Tek Yatay Kaynak Şeridi (11 dilimli, MW payına göre + kaynak filtresi) */}
        <SourceStrip
          counter={counter}
          sourceLabels={sourceLabels}
          activeFilter={activeFilter}
          onSelectFilter={onSelectFilter}
        />

        {/* 4. Satır: Dinamik Ölçek Notu ("Ölçek: Biyokütle · en yüksek il İstanbul · 85 MW") */}
        {scaleInfo && scaleInfo.topName && (
          <div className="flex items-center justify-between gap-1.5 rounded-lg border border-white/8 bg-[#050912]/90 px-2.5 py-1.5 font-mono-data text-[10.5px] text-[#94A3B8] tabular-nums">
            <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: scaleInfo.filterHex }}
                aria-hidden="true"
              />
              <span className="truncate">
                Ölçek:{" "}
                <strong className="font-semibold text-[#F8FAFC]">
                  {scaleInfo.filterLabel}
                </strong>{" "}
                · en yüksek il{" "}
                <strong className="font-semibold text-[#F8FAFC]">
                  {scaleInfo.topName}
                </strong>
              </span>
            </span>
            <strong
              style={{ color: scaleInfo.filterHex }}
              className="shrink-0 font-bold"
            >
              {formatMw(scaleInfo.topMw)}
            </strong>
          </div>
        )}
      </aside>
    </>
  );
});
