import { useCallback, useEffect, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { InfoDrawer } from "@/components/InfoDrawer";
import { PlaybackBar } from "@/components/PlaybackBar";
import { SourceFilterBar } from "@/components/SourceFilterBar";
import { TopLeftHud } from "@/components/TopLeftHud";
import { TurkeyMap } from "@/components/TurkeyMap";
import { DEFAULT_SOURCE_ORDER } from "@/lib/constants";
import {
  loadDashboardData,
  type DashboardInitialData,
  type DashboardMode,
  type PlaybackSpeed,
} from "@/lib/data";
import type { MapFilter } from "@/lib/visual";

const VALID_FILTERS = new Set<string>([
  "all",
  "renewable",
  "fossil",
  ...DEFAULT_SOURCE_ORDER,
]);

function readFilterFromUrl(): MapFilter {
  if (typeof window === "undefined") return "all";
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("kaynak")?.trim();
  if (raw && VALID_FILTERS.has(raw)) {
    return raw as MapFilter;
  }
  return "all";
}

export function App() {
  const [data, setData] = useState<DashboardInitialData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Mod, seçili saat, kaynak filtresi ve oynatma state'leri App seviyesinde tutulur
  const [mode, setMode] = useState<DashboardMode>("live");
  const [selectedHourIndex, setSelectedHourIndex] = useState<number>(23);
  const [activeFilter, setActiveFilter] = useState<MapFilter>(readFilterFromUrl);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);

  // Seçili filtreyi URL sorgu parametresine (?kaynak=wind) yansıt
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (activeFilter === "all") {
      url.searchParams.delete("kaynak");
    } else {
      url.searchParams.set("kaynak", activeFilter);
    }
    window.history.replaceState({}, "", url.toString());
  }, [activeFilter]);

  useEffect(() => {
    const onPopState = () => {
      setActiveFilter(readFilterFromUrl());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

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

  const handleToggleLoop = useCallback(() => {
    setIsLooping((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!isPlaying) return;

    const timer = window.setTimeout(() => {
      setSelectedHourIndex((prevHour) => {
        if (prevHour >= maxHourIndex) {
          if (!isLooping) {
            setIsPlaying(false);
          }
          return 0;
        }
        return prevHour + 1;
      });
    }, stepDurationMs);

    return () => window.clearTimeout(timer);
  }, [isPlaying, isLooping, selectedHourIndex, maxHourIndex, stepDurationMs]);

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

  const counterAnimationMs = isPlaying
    ? Math.min(400, Math.round(stepDurationMs * 0.85))
    : 280;

  return (
    <div className="relative h-dvh w-screen overflow-hidden bg-[#03060C] text-[#F8FAFC]">
      {errorMessage ? (
        <div
          role="alert"
          className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center"
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
            className="mt-1 inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-medium text-[#F8FAFC] transition-colors hover:bg-white/15"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Tekrar Dene</span>
          </button>
        </div>
      ) : (
        <>
          {/* 1. Tam Ekran Harita (İl Bazında 3D Katmanlı Bloklar) */}
          <TurkeyMap
            provincesGeoJson={data?.provincesGeoJson ?? null}
            provinceSeriesByPlate={data?.provinceSeriesByPlate ?? null}
            neighborsGeoJson={data?.neighborsGeoJson ?? null}
            sourceLabels={data?.sourceLabels ?? null}
            activeFilter={activeFilter}
            selectedHourIndex={effectiveMapHourIndex}
            selectedHourTimestamp={selectedHourTimestamp}
            isPlaying={isPlaying}
            loading={loading}
          />

          {/* 2. Sol Üst: Tek Kompakt Koyu Cam Panel + 11 Dilimli Yatay Kaynak Şeridi */}
          <TopLeftHud
            counter={activeCounter}
            sourceLabels={data?.sourceLabels ?? null}
            provinceSeriesByPlate={data?.provinceSeriesByPlate ?? null}
            selectedHourIndex={effectiveMapHourIndex}
            mode={mode}
            onModeChange={handleModeChange}
            activeFilter={activeFilter}
            onSelectFilter={setActiveFilter}
            animationDurationMs={counterAnimationMs}
            loading={loading}
          />

          {/* 3. Üst Orta (Masaüstü) / Alt Çipler (Mobil): Kaynak Filtresi Düğmeleri */}
          <SourceFilterBar
            activeFilter={activeFilter}
            onSelectFilter={setActiveFilter}
            sourceLabels={data?.sourceLabels ?? null}
            activeCounter={activeCounter}
            provinceSeriesByPlate={data?.provinceSeriesByPlate ?? null}
            selectedHourIndex={effectiveMapHourIndex}
          />

          {/* 4. Sağ Üst: Küçük Tazelik Rozeti + "i" Bilgi Çekmecesi */}
          <InfoDrawer
            snapshot={data?.snapshot ?? null}
            provinces24h={data?.provinces24h ?? null}
            selectedHourIndex={effectiveMapHourIndex}
            selectedHourTimestamp={selectedHourTimestamp}
            selectedHourTotalMw={selectedHourSnapshot?.totalMw ?? null}
            locatedPlantCount={data?.locatedPlants.length ?? 0}
            totalPlantsInCatalog={data?.totalPlantsInCatalog ?? 0}
          />

          {/* 5. Alt: İnce Oynatma Çubuğu (+ Mobilde Alttan Açılan Kaynak Şeridi) */}
          {data && activeCounter && (
            <PlaybackBar
              mode={mode}
              plantsDayDate={data.snapshot.plants_day.date}
              playbackHours={data.playbackHours}
              activeCounter={activeCounter}
              sourceLabels={data.sourceLabels}
              activeFilter={activeFilter}
              onSelectFilter={setActiveFilter}
              selectedHourIndex={effectiveMapHourIndex}
              isPlaying={isPlaying}
              isLooping={isLooping}
              speed={playbackSpeed}
              onTogglePlay={handleTogglePlay}
              onToggleLoop={handleToggleLoop}
              onSelectHour={handleSelectHour}
              onChangeSpeed={setPlaybackSpeed}
              onReturnToLive={() => handleModeChange("live")}
            />
          )}
        </>
      )}
    </div>
  );
}

export default App;
