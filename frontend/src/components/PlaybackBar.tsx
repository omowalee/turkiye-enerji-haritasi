import { memo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
  Repeat,
  RotateCcw,
} from "lucide-react";
import { SourceStrip } from "@/components/SourceStrip";
import type {
  DashboardMode,
  HourlyCounterSnapshot,
  PlaybackSpeed,
} from "@/lib/data";
import { formatLocalDate, formatMw, formatTimestampParts } from "@/lib/format";
import type { MapFilter } from "@/lib/visual";
import type { SourceLabels } from "@/types";

interface PlaybackBarProps {
  mode: DashboardMode;
  plantsDayDate: string;
  playbackHours: HourlyCounterSnapshot[];
  activeCounter: HourlyCounterSnapshot;
  sourceLabels: SourceLabels;
  activeFilter: MapFilter;
  onSelectFilter: (filter: MapFilter) => void;
  selectedHourIndex: number;
  isPlaying: boolean;
  isLooping: boolean;
  speed: PlaybackSpeed;
  onTogglePlay: () => void;
  onToggleLoop: () => void;
  onSelectHour: (hourIndex: number) => void;
  onChangeSpeed: (speed: PlaybackSpeed) => void;
  onReturnToLive: () => void;
}

const SPEEDS: PlaybackSpeed[] = [1, 2, 4];

export const PlaybackBar = memo(function PlaybackBar({
  mode,
  plantsDayDate,
  playbackHours,
  activeCounter,
  sourceLabels,
  activeFilter,
  onSelectFilter,
  selectedHourIndex,
  isPlaying,
  isLooping,
  speed,
  onTogglePlay,
  onToggleLoop,
  onSelectHour,
  onChangeSpeed,
  onReturnToLive,
}: PlaybackBarProps) {
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  if (playbackHours.length === 0) return null;

  const isPlayback = mode === "playback";
  const currentSnapshot =
    playbackHours[selectedHourIndex] ??
    playbackHours[playbackHours.length - 1];
  const currentParts = currentSnapshot
    ? formatTimestampParts(currentSnapshot.ts)
    : null;
  const formattedDate = plantsDayDate ? formatLocalDate(plantsDayDate) : "";

  let maxDailyMw = 1;
  for (let i = 0; i < playbackHours.length; i++) {
    if (playbackHours[i].totalMw > maxDailyMw) {
      maxDailyMw = playbackHours[i].totalMw;
    }
  }

  const progressPct =
    playbackHours.length > 1
      ? (selectedHourIndex / (playbackHours.length - 1)) * 100
      : 0;

  return (
    <section
      aria-label="24 saatlik üretim oynatma çubuğu ve mobil kaynak sayfası"
      className={`pointer-events-auto fixed right-2.5 bottom-2.5 left-2.5 z-20 rounded-2xl border bg-[#060B14]/82 px-3 py-2 shadow-[0_18px_50px_rgba(0,0,0,0.8)] backdrop-blur-xl transition-all md:right-20 md:bottom-4 md:left-4 md:px-4 md:py-2.5 ${
        isPlayback ? "border-[#38BDF8]/35" : "border-white/12"
      }`}
    >
      {/* MOBİL (< 768px): Alttan Açılan Sayfa Tutamacı (Kaynak Şeridini Açar/Kapatır) */}
      <div className="mb-1.5 flex items-center justify-between border-b border-white/8 pb-1.5 md:hidden">
        <button
          type="button"
          onClick={() => setMobileSheetOpen((v) => !v)}
          aria-expanded={mobileSheetOpen}
          className="flex w-full items-center justify-between text-[11px] font-medium text-[#94A3B8] hover:text-[#F8FAFC]"
        >
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-6 rounded-full bg-white/25" />
            <span>Kaynak Dağılımı Şeridi (11 kaynak)</span>
          </span>
          {mobileSheetOpen ? (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* MOBİL (< 768px): Alttan Açılan Kaynak Şeridi İçeriği */}
      {mobileSheetOpen && (
        <div className="mb-2.5 border-b border-white/10 pb-2.5 md:hidden">
          <SourceStrip
            counter={activeCounter}
            sourceLabels={sourceLabels}
            activeFilter={activeFilter}
            onSelectFilter={onSelectFilter}
            compact
          />
        </div>
      )}

      {/* Ana İnce Oynatma Çubuğu */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3.5">
        {/* Sol: Oynat/Duraklat + Hız (1×, 2×, 4×) + Döngü + Saat Göstergesi */}
        <div className="flex flex-wrap items-center justify-between gap-2 lg:shrink-0">
          <div className="flex items-center gap-1.5">
            {/* Oynat / Duraklat */}
            <button
              type="button"
              onClick={onTogglePlay}
              aria-label={
                isPlaying
                  ? "Oynatmayı duraklat (Boşluk)"
                  : "24 saati oynat (Boşluk)"
              }
              title="Boşluk tuşu ile oynat / duraklat"
              className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-semibold transition-all focus-visible:outline-2 focus-visible:outline-[#38BDF8] ${
                isPlaying
                  ? "border-[#38BDF8] bg-[#38BDF8] text-[#03060C] shadow-[0_0_18px_rgba(56,189,248,0.5)]"
                  : isPlayback
                    ? "border-[#38BDF8]/50 bg-[#38BDF8]/15 text-[#38BDF8] hover:bg-[#38BDF8]/25"
                    : "border-white/15 bg-white/[0.06] text-[#F8FAFC] hover:border-[#38BDF8]/50 hover:text-[#38BDF8]"
              }`}
            >
              {isPlaying ? (
                <>
                  <Pause
                    className="h-3.5 w-3.5 fill-current"
                    aria-hidden="true"
                  />
                  <span>Duraklat</span>
                </>
              ) : (
                <>
                  <Play
                    className="h-3.5 w-3.5 fill-current"
                    aria-hidden="true"
                  />
                  <span>Oynat</span>
                </>
              )}
            </button>

            {/* Hız Seçimi: 1×, 2×, 4× */}
            <div
              role="group"
              aria-label="Oynatma hızı"
              className="inline-flex items-center rounded-xl border border-white/10 bg-[#03060C]/90 p-0.5"
            >
              {SPEEDS.map((s) => {
                const active = speed === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onChangeSpeed(s)}
                    aria-pressed={active}
                    title={`Oynatma hızı: ${s}×`}
                    className={`min-h-[26px] min-w-[30px] rounded-lg px-1.5 font-mono-data text-[11px] font-semibold tabular-nums transition-colors ${
                      active
                        ? "bg-[#38BDF8]/20 text-[#38BDF8] shadow-[inset_0_0_0_1px_rgba(56,189,248,0.4)]"
                        : "text-[#94A3B8] hover:text-[#F8FAFC]"
                    }`}
                  >
                    {s}×
                  </button>
                );
              })}
            </div>

            {/* Yeni: "Döngü" Düğmesi (Açıkken 23:00'dan sonra 00:00'a dönüp oynamaya devam eder) */}
            <button
              type="button"
              onClick={onToggleLoop}
              aria-pressed={isLooping}
              aria-label="24 saatlik oynatma döngüsü"
              title={
                isLooping
                  ? "Döngü açık: 23:00'dan sonra 00:00'a dönüp devam eder"
                  : "Döngü kapalı: 23:00'dan sonra başa sarıp durur"
              }
              className={`inline-flex min-h-[34px] items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition-all focus-visible:outline-2 focus-visible:outline-[#38BDF8] ${
                isLooping
                  ? "border-[#38BDF8]/55 bg-[#38BDF8]/18 text-[#38BDF8]"
                  : "border-white/10 bg-[#03060C]/80 text-[#94A3B8] hover:border-white/20 hover:text-[#F8FAFC]"
              }`}
            >
              <Repeat className="h-3 w-3" aria-hidden="true" />
              <span className="hidden sm:inline">Döngü</span>
            </button>
          </div>

          {/* Seçili Gün, Saat ve Toplam MW */}
          <div className="flex items-center gap-1.5 font-mono-data text-xs tabular-nums">
            <div
              className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1 ${
                isPlayback
                  ? "border-[#38BDF8]/40 bg-[#38BDF8]/12 text-[#F8FAFC]"
                  : "border-white/10 bg-[#03060C]/80 text-[#94A3B8]"
              }`}
            >
              <span className="text-[11px] text-[#94A3B8]">{formattedDate}</span>
              <span
                className={`font-bold ${
                  isPlayback ? "text-[#38BDF8]" : "text-[#F8FAFC]"
                }`}
              >
                {currentParts?.hour ?? "23:00"}
              </span>
              <span className="hidden text-white/20 sm:inline">·</span>
              <span className="hidden text-[11px] font-semibold text-[#F8FAFC] sm:inline">
                {currentSnapshot ? formatMw(currentSnapshot.totalMw) : ""}
              </span>
            </div>

            {isPlayback && (
              <button
                type="button"
                onClick={onReturnToLive}
                title="Canlı moda dön"
                className="inline-flex min-h-[30px] items-center gap-1 rounded-xl border border-[#10B981]/40 bg-[#10B981]/12 px-2 py-1 font-sans-ui text-[11px] font-semibold text-[#10B981] transition-colors hover:bg-[#10B981]/20"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                <span className="hidden sm:inline">Canlı</span>
              </button>
            )}
          </div>
        </div>

        {/* Orta / Sağ: 24 Saatlik Mini Üretim Profili ve Sürüklenebilir İmleç */}
        <div className="relative flex flex-1 flex-col justify-center">
          <div className="relative h-8 w-full select-none">
            {/* Saatlik Mini Üretim Profili Çubukları */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 bottom-3.5 grid grid-cols-24 items-end gap-0.5 px-1"
            >
              {playbackHours.map((item, idx) => {
                const heightPct = Math.max(
                  16,
                  Math.round((item.totalMw / maxDailyMw) * 100)
                );
                const isSelected = idx === selectedHourIndex;
                const isPast = idx < selectedHourIndex;
                return (
                  <div
                    key={item.ts}
                    className="flex h-full w-full flex-col justify-end"
                  >
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t-[2px] transition-colors duration-150 ${
                        isSelected
                          ? "bg-[#38BDF8] shadow-[0_0_10px_rgba(56,189,248,0.9)]"
                          : isPast
                            ? isPlayback
                              ? "bg-[#38BDF8]/45"
                              : "bg-white/25"
                            : "bg-white/10"
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {/* İnce İlerleme Çizgisi */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-1 bottom-3 h-1 overflow-hidden rounded-full bg-white/10"
            >
              <div
                style={{ width: `${progressPct}%` }}
                className={`h-full transition-all duration-150 ${
                  isPlayback ? "bg-[#38BDF8]" : "bg-[#10B981]/75"
                }`}
              />
            </div>

            {/* Sürüklenebilir Range Input */}
            <input
              type="range"
              min={0}
              max={playbackHours.length - 1}
              step={1}
              value={selectedHourIndex}
              onChange={(e) => onSelectHour(Number(e.target.value))}
              aria-label="Saat seçici (00:00 - 23:00)"
              aria-valuemin={0}
              aria-valuemax={playbackHours.length - 1}
              aria-valuenow={selectedHourIndex}
              aria-valuetext={`${formattedDate} ${currentParts?.hour ?? ""}`}
              className="absolute inset-x-0 top-0 bottom-2 z-10 h-6 w-full cursor-pointer appearance-none bg-transparent accent-[#38BDF8] focus-visible:outline-none"
            />

            {/* 24 Saat İşaretleri (00 .. 23) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 grid grid-cols-24 px-0.5 text-center font-mono-data text-[9px] leading-none tabular-nums"
            >
              {playbackHours.map((item, idx) => {
                const hourStr = String(idx).padStart(2, "0");
                const isSelected = idx === selectedHourIndex;
                const showOnMobile = idx % 3 === 0 || idx === 23 || isSelected;
                return (
                  <span
                    key={item.ts}
                    className={`${
                      showOnMobile ? "opacity-100" : "opacity-0 sm:opacity-100"
                    } ${
                      isSelected
                        ? "font-bold text-[#38BDF8]"
                        : "text-[#64748B]"
                    }`}
                  >
                    {hourStr}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
