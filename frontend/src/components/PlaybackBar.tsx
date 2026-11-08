import { memo } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import type {
  DashboardMode,
  HourlyCounterSnapshot,
  PlaybackSpeed,
} from "@/lib/data";
import { formatLocalDate, formatMw, formatTimestampParts } from "@/lib/format";

interface PlaybackBarProps {
  mode: DashboardMode;
  plantsDayDate: string;
  playbackHours: HourlyCounterSnapshot[];
  selectedHourIndex: number;
  isPlaying: boolean;
  speed: PlaybackSpeed;
  onTogglePlay: () => void;
  onSelectHour: (hourIndex: number) => void;
  onChangeSpeed: (speed: PlaybackSpeed) => void;
  onReturnToLive: () => void;
}

const SPEEDS: PlaybackSpeed[] = [1, 2, 4];

export const PlaybackBar = memo(function PlaybackBar({
  mode,
  plantsDayDate,
  playbackHours,
  selectedHourIndex,
  isPlaying,
  speed,
  onTogglePlay,
  onSelectHour,
  onChangeSpeed,
  onReturnToLive,
}: PlaybackBarProps) {
  if (playbackHours.length === 0) return null;

  const isPlayback = mode === "playback";
  const currentSnapshot =
    playbackHours[selectedHourIndex] ??
    playbackHours[playbackHours.length - 1];
  const currentParts = currentSnapshot
    ? formatTimestampParts(currentSnapshot.ts)
    : null;
  const formattedDate = plantsDayDate ? formatLocalDate(plantsDayDate) : "";

  // Zaman çubuğundaki mini sütunları ölçeklemek için günün tepe MW değeri
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
      aria-label="24 saatlik üretim oynatma çubuğu"
      className={`z-20 border-t bg-[#0D1422]/95 px-3 py-2.5 backdrop-blur-md transition-colors sm:px-5 ${
        isPlayback ? "border-[#38BDF8]/40" : "border-[#1E293B]"
      }`}
    >
      <div className="mx-auto flex max-w-[1920px] flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
        {/* Sol Kontroller: Oynat/Duraklat + Hız Seçimi (1x, 2x, 4x) + Seçili Saat Özeti */}
        <div className="flex flex-wrap items-center justify-between gap-2 lg: shrink-0">
          <div className="flex items-center gap-2">
            {/* Oynat / Duraklat Düğmesi */}
            <button
              type="button"
              onClick={onTogglePlay}
              aria-label={
                isPlaying ? "Oynatmayı duraklat (Boşluk)" : "24 saati oynat (Boşluk)"
              }
              title="Boşluk tuşu ile oynat / duraklat"
              className={`inline-flex min-h-[38px] items-center gap-2 rounded-lg border px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-all focus-visible:outline-2 focus-visible:outline-[#38BDF8] ${
                isPlaying
                  ? "border-[#38BDF8] bg-[#38BDF8] text-[#060A12] shadow-[0_0_16px_rgba(56,189,248,0.45)]"
                  : isPlayback
                    ? "border-[#38BDF8]/60 bg-[#38BDF8]/15 text-[#38BDF8] hover:bg-[#38BDF8]/25"
                    : "border-[#334155] bg-[#151F32] text-[#F8FAFC] hover:border-[#38BDF8]/50 hover:text-[#38BDF8]"
              }`}
            >
              {isPlaying ? (
                <>
                  <Pause className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                  <span>Duraklat</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                  <span>Oynat</span>
                </>
              )}
            </button>

            {/* Hız Seçici: 1×, 2×, 4× */}
            <div
              role="group"
              aria-label="Oynatma hızı"
              className="inline-flex items-center rounded-lg border border-[#1E293B] bg-[#060A12] p-0.5"
            >
              {SPEEDS.map((s) => {
                const active = speed === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onChangeSpeed(s)}
                    aria-pressed={active}
                    title={`Oynatma hızı: ${s}× (saat başına ${1000 / s} ms)`}
                    className={`min-h-[30px] min-w-[34px] rounded-md px-2 font-mono-data text-xs font-semibold tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-[#38BDF8] ${
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
          </div>

          {/* Seçili Gün ve Saat Göstergesi */}
          <div className="flex items-center gap-2 font-mono-data text-xs tabular-nums">
            <div
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 ${
                isPlayback
                  ? "border-[#38BDF8]/40 bg-[#38BDF8]/10 text-[#F8FAFC]"
                  : "border-[#1E293B] bg-[#060A12]/80 text-[#94A3B8]"
              }`}
            >
              <span className="text-[#94A3B8]">{formattedDate}</span>
              <span
                className={`font-bold ${
                  isPlayback ? "text-[#38BDF8]" : "text-[#F8FAFC]"
                }`}
              >
                {currentParts?.hour ?? "23:00"}
              </span>
              <span className="hidden text-[#64748B] sm:inline">·</span>
              <span className="hidden font-semibold text-[#F8FAFC] sm:inline">
                {currentSnapshot ? formatMw(currentSnapshot.totalMw) : ""}
              </span>
            </div>

            {isPlayback && (
              <button
                type="button"
                onClick={onReturnToLive}
                title="Canlı moda geri dön"
                className="inline-flex min-h-[30px] items-center gap-1 rounded-md border border-[#10B981]/40 bg-[#10B981]/10 px-2.5 py-1 font-sans-ui text-[11px] font-semibold text-[#10B981] transition-colors hover:bg-[#10B981]/20"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                <span>Canlıya Dön</span>
              </button>
            )}
          </div>
        </div>

        {/* Orta / Sağ: 24 Saat İşaretli Sürüklenebilir Zaman Çubuğu */}
        <div className="relative flex flex-1 flex-col justify-center pt-1 pb-0.5">
          {/* 24 Saatlik Mini Üretim Profili ve Sürüklenebilir İmleç */}
          <div className="relative h-9 w-full select-none">
            {/* Arka Plan Saatlik Mini Çubuklar */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 bottom-4 grid grid-cols-24 items-end gap-0.5 px-1"
            >
              {playbackHours.map((item, idx) => {
                const heightPct = Math.max(
                  15,
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
                          ? "bg-[#38BDF8] shadow-[0_0_8px_rgba(56,189,248,0.8)]"
                          : isPast
                            ? isPlayback
                              ? "bg-[#38BDF8]/45"
                              : "bg-[#334155]"
                            : "bg-[#1E293B]"
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {/* İlerleme Çizgisi (Track) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-1 bottom-3.5 h-1.5 overflow-hidden rounded-full bg-[#1E293B]"
            >
              <div
                style={{ width: `${progressPct}%` }}
                className={`h-full transition-all duration-150 ${
                  isPlayback ? "bg-[#38BDF8]" : "bg-[#10B981]/70"
                }`}
              />
            </div>

            {/* Sürüklenebilir Range Input (Tam 24 saat üzerinde erişilebilir kontrol) */}
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
              className="absolute inset-x-0 top-0 bottom-2 z-10 h-7 w-full cursor-pointer appearance-none bg-transparent accent-[#38BDF8] focus-visible:outline-none"
            />

            {/* 24 Saat İşaretleri (00 .. 23) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 grid grid-cols-24 px-0.5 text-center font-mono-data text-[9px] leading-none tabular-nums sm:text-[10px]"
            >
              {playbackHours.map((item, idx) => {
                const hourStr = String(idx).padStart(2, "0");
                const isSelected = idx === selectedHourIndex;
                const showOnMobile = idx % 3 === 0 || idx === 23 || isSelected;
                return (
                  <span
                    key={item.ts}
                    className={`${
                      showOnMobile ? " opacity-100" : "opacity-0 sm:opacity-100"
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
