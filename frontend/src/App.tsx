import { useCallback, useEffect, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { FooterAttribution } from "@/components/FooterAttribution";
import { HeaderBar } from "@/components/HeaderBar";
import { LiveCounters } from "@/components/LiveCounters";
import { PlaybackBar } from "@/components/PlaybackBar";
import { TurkeyMap } from "@/components/TurkeyMap";
import {
  loadDashboardData,
  type DashboardInitialData,
  type DashboardMode,
  type PlaybackSpeed,
} from "@/lib/data";

export function App() {
  const [data, setData] = useState<DashboardInitialData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Mod ve seçili saat state'leri App seviyesinde tutulur (kaynak grafiği ve il paneli de buradan beslenecek)
  const [mode, setMode] = useState<DashboardMode>("live");
  const [selectedHourIndex, setSelectedHourIndex] = useState<number>(23);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);

  const fetchAll = useCallback((signal?: AbortSignal) => {
    setLoading(true);
    setErrorMessage(null);
    loadDashboardData(signal)
      .then((result) => {
        setData(result);
        setSelectedHourIndex(result.defaultHourIndex);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        const message =
          err instanceof Error
            ? err.message
            : "Veri dosyaları okunurken beklenmeyen bir hata oluştu.";
        setErrorMessage(message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchAll(controller.signal);
    return () => controller.abort();
  }, [fetchAll]);

  const maxHourIndex = data ? Math.max(0, data.hours.length - 1) : 23;
  const stepDurationMs = Math.round(1000 / playbackSpeed);

  const handleModeChange = useCallback(
    (nextMode: DashboardMode) => {
      if (nextMode === "live") {
        setIsPlaying(false);
        setMode("live");
        setSelectedHourIndex(data?.defaultHourIndex ?? 23);
      } else {
        setMode("playback");
      }
    },
    [data?.defaultHourIndex]
  );

  const handleSelectHour = useCallback((hourIdx: number) => {
    setIsPlaying(false);
    setMode("playback");
    setSelectedHourIndex(hourIdx);
  }, []);

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prevPlaying) => {
      if (prevPlaying) {
        return false;
      }
      // Oynatma başlatıldığında otomatik olarak Oynatma moduna geç;
      // eğer Canlı moddaysak veya son saatteysek (23:00) günü 00:00'dan başlat.
      setMode("playback");
      setSelectedHourIndex((prevHour) => {
        if (mode === "live" || prevHour >= maxHourIndex) {
          return 0;
        }
        return prevHour;
      });
      return true;
    });
  }, [mode, maxHourIndex]);

  // Otomatik oynatma zamanlayıcısı: gün sonunda (23:00'dan sonra) başa (00:00) sarıp durur, döngüye girmez.
  useEffect(() => {
    if (!isPlaying) return;

    const timer = window.setTimeout(() => {
      setSelectedHourIndex((prevHour) => {
        if (prevHour >= maxHourIndex) {
          setIsPlaying(false);
          return 0;
        }
        return prevHour + 1;
      });
    }, stepDurationMs);

    return () => window.clearTimeout(timer);
  }, [isPlaying, selectedHourIndex, maxHourIndex, stepDurationMs]);

  // Klavye kısayolları: Boşluk = oynat/duraklat, Sol/Sağ ok = 1 saat geri/ileri
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName;
      const isTextInput =
        tagName === "TEXTAREA" ||
        tagName === "SELECT" ||
        (tagName === "INPUT" &&
          (target as HTMLInputElement).type !== "range");

      if (isTextInput || e.ctrlKey || e.altKey || e.metaKey) return;

      if (e.code === "Space") {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIsPlaying(false);
        setMode("playback");
        setSelectedHourIndex((prev) =>
          mode === "live" ? Math.max(0, maxHourIndex - 1) : Math.max(0, prev - 1)
        );
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setIsPlaying(false);
        setMode("playback");
        setSelectedHourIndex((prev) =>
          mode === "live" ? 0 : Math.min(maxHourIndex, prev + 1)
        );
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleTogglePlay, maxHourIndex, mode]);

  // Canlı modda harita generation_24h'ın son saatinde (23:00) durur, sayaçlar snapshot.live gösterir.
  // Oynatma modunda hem sayaçlar hem harita seçili saati (selectedHourIndex) gösterir.
  const effectiveMapHourIndex =
    mode === "live" ? (data?.defaultHourIndex ?? 23) : selectedHourIndex;

  const activeCounter =
    mode === "live"
      ? (data?.liveCounter ?? null)
      : (data?.playbackHours[selectedHourIndex] ??
        data?.liveCounter ??
        null);

  const selectedHourSnapshot =
    data?.playbackHours[effectiveMapHourIndex] ?? null;

  const selectedHourTimestamp =
    data?.hours[effectiveMapHourIndex] ?? data?.lastHourTimestamp ?? null;

  // Oynatma sırasında geçiş süresi adım süresine eşittir; elle kaydırırken 320 ms yumuşak geçiş kullanılır
  const transitionDurationMs = isPlaying ? stepDurationMs : 320;
  const counterAnimationMs = isPlaying
    ? Math.min(420, Math.round(stepDurationMs * 0.85))
    : 280;

  return (
    <div className="flex min-h-dvh w-full flex-col bg-[#060A12] text-[#F8FAFC]">
      {/* Üst Kontrol Odası Başlık, Mod Seçici ("Canlı" / "Oynatma (24 saat)") ve Zaman Çubuğu */}
      <HeaderBar
        snapshot={data?.snapshot ?? null}
        mode={mode}
        onModeChange={handleModeChange}
        selectedHourTimestamp={selectedHourTimestamp}
        loading={loading}
      />

      {/* Hata / Veri Yok Durumu */}
      {errorMessage ? (
        <div
          role="alert"
          className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#F87171]/40 bg-[#450A0A]/80 text-[#F87171]">
            <AlertCircle className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="font-display text-lg font-bold text-[#F8FAFC]">
            Veri Yüklenemedi
          </h2>
          <p className="max-w-md text-xs text-[#94A3B8]">{errorMessage}</p>
          <button
            type="button"
            onClick={() => fetchAll()}
            className="mt-1 inline-flex min-h-[40px] items-center gap-2 rounded-md border border-[#334155] bg-[#151F32] px-4 py-2 text-xs font-medium text-[#F8FAFC] transition-colors hover:bg-[#1E293B]"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Tekrar Dene</span>
          </button>
        </div>
      ) : (
        <>
          {/* Sayaçlar: Canlı modda snapshot_latest.live, Oynatma modunda mix_24h.plants_day[saat] */}
          <LiveCounters
            counter={activeCounter}
            sourceLabels={data?.sourceLabels ?? null}
            mode={mode}
            animationDurationMs={counterAnimationMs}
            loading={loading}
          />

          {/* Merkez: Türkiye İl Sınırları + Santral Noktaları ve Yumuşak Geçişli 3D Sütunlar */}
          <TurkeyMap
            provincesGeoJson={data?.provincesGeoJson ?? null}
            plants={data?.locatedPlants ?? []}
            totalPlantsInCatalog={data?.totalPlantsInCatalog ?? 0}
            snapshot={data?.snapshot ?? null}
            sourceLabels={data?.sourceLabels ?? null}
            mode={mode}
            selectedHourIndex={effectiveMapHourIndex}
            selectedHourTimestamp={selectedHourTimestamp}
            selectedHourTotalMw={selectedHourSnapshot?.totalMw ?? null}
            transitionDurationMs={transitionDurationMs}
            loading={loading}
          />

          {/* Alt 24 Saatlik Oynatma Çubuğu */}
          {data && (
            <PlaybackBar
              mode={mode}
              plantsDayDate={data.snapshot.plants_day.date}
              playbackHours={data.playbackHours}
              selectedHourIndex={effectiveMapHourIndex}
              isPlaying={isPlaying}
              speed={playbackSpeed}
              onTogglePlay={handleTogglePlay}
              onSelectHour={handleSelectHour}
              onChangeSpeed={setPlaybackSpeed}
              onReturnToLive={() => handleModeChange("live")}
            />
          )}
        </>
      )}

      {/* Alt Bilgi ve Zorunlu Atıflar */}
      <FooterAttribution />
    </div>
  );
}

export default App;
