import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DeckGL from "@deck.gl/react";
import { MapView, type MapViewState, type PickingInfo } from "@deck.gl/core";
import { ColumnLayer, GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers";
import {
  AlertTriangle,
  Box,
  Calendar,
  Info,
  Layers,
  Minus,
  Plus,
  RotateCcw,
  Sun,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SOURCE_PALETTE } from "@/lib/constants";
import type { LocatedPlantPoint } from "@/lib/data";
import {
  evaluateFreshness,
  formatLocalDate,
  formatMonthLabel,
  formatMw,
  formatNumber,
  formatTimestampParts,
} from "@/lib/format";
import type {
  ProvinceFeature,
  Provinces,
  SnapshotLatest,
  SourceLabels,
} from "@/types";

interface TurkeyMapProps {
  provincesGeoJson: Provinces | null;
  plants: LocatedPlantPoint[];
  totalPlantsInCatalog: number;
  snapshot: SnapshotLatest | null;
  sourceLabels: SourceLabels | null;
  selectedHourIndex: number;
  selectedHourTimestamp: string | null;
  loading: boolean;
}

interface PlantAtHour extends LocatedPlantPoint {
  currentHourMw: number;
}

interface SelectedPlantCardState {
  plantId: number;
  x: number;
  y: number;
}

const TURKEY_CENTER = {
  longitude: 35.25,
  latitude: 39.05,
};

const DESKTOP_DEFAULT_PITCH = 45;
const MOBILE_BREAKPOINT_PX = 768;

function getInitialViewState(width: number, is3DMode: boolean): MapViewState {
  const isSmallMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;
  return {
    longitude: TURKEY_CENTER.longitude,
    latitude: TURKEY_CENTER.latitude,
    zoom: isSmallMobile ? 4.05 : isTablet ? 4.85 : 5.45,
    minZoom: 3.5,
    maxZoom: 11,
    pitch: is3DMode ? DESKTOP_DEFAULT_PITCH : 0,
    bearing: 0,
    maxPitch: 65,
    minPitch: 0,
  };
}

/**
 * Seçili saatteki üretime (MW) göre taban nokta yarıçapı (piksel).
 * Karekök ölçekleme sayesinde hem 5 MW hem 1.912 MW santraller okunaklı kalır.
 */
function computePlantRadiusPx(mw: number): number {
  if (mw <= 0) return 3.2;
  return Math.min(24, 4.0 + Math.sqrt(mw) * 0.42);
}

/**
 * 3D sütun yüksekliği (metre) hesaplaması — KAREKÖK ÖLÇEK GEREKÇESİ:
 * Türkiye'deki santrallerin saatlik üretimi 1 MW ile ~1.912 MW (Atatürk HES / Zetes / Soma)
 * arasında yaklaşık 1:1900 oranında değişir. Doğrusal (lineer) ölçek kullanıldığında:
 * - Ya ~1.500+ MW santraller ekranın üstünden taşar,
 * - Ya da 5–50 MW aralığındaki yüzlerce güneş, rüzgâr ve akarsu santrali < 1 piksel kalıp kaybolur.
 *
 * Karekök ölçek (`4500 + sqrt(MW) * 3200` metre) dinamik aralığı ~1:19'a sıkıştırır:
 * - 0 MW üretim      → 0 m (yalnızca taban noktası görünür, sütun yükselmez)
 * - 5 MW santral     → ~11.655 m (Türkiye ölçeğinde ~6px, taban noktasının üzerinde net seçilir)
 * - 100 MW santral   → ~36.500 m (~20px)
 * - 500 MW santral   → ~76.050 m (~42px)
 * - 1.500 MW santral → ~128.435 m (~72px, Türkiye haritasında baskın ama taşmayan yükseklik)
 */
function computeColumnElevationMeters(mw: number): number {
  if (mw <= 0) return 0;
  return 4500 + Math.sqrt(mw) * 3200;
}

export function TurkeyMap({
  provincesGeoJson,
  plants,
  totalPlantsInCatalog,
  snapshot,
  sourceLabels,
  selectedHourIndex,
  selectedHourTimestamp,
  loading,
}: TurkeyMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Mobilde (< 768px) varsayılan 2D, masaüstünde (>= 768px) varsayılan 3D (~45° eğim)
  const [is3D, setIs3D] = useState<boolean>(() =>
    typeof window !== "undefined"
      ? window.innerWidth >= MOBILE_BREAKPOINT_PX
      : true
  );

  const [viewState, setViewState] = useState<MapViewState>(() => {
    const initialWidth =
      typeof window !== "undefined" ? window.innerWidth : 1280;
    const initial3D = initialWidth >= MOBILE_BREAKPOINT_PX;
    return getInitialViewState(initialWidth, initial3D);
  });

  // Hover yalnızca görsel vurgu ve imleç içindir; bilgi kartı tıklamayla (selectedPlantCard) açılır
  const [hoveredPlantId, setHoveredPlantId] = useState<number | null>(null);
  const [selectedPlantCard, setSelectedPlantCard] =
    useState<SelectedPlantCardState | null>(null);
  const [hoveredProvincePlate, setHoveredProvincePlate] = useState<
    number | null
  >(null);
  const [showUnlicensedDetail, setShowUnlicensedDetail] = useState(false);

  // Ekran boyutu ilk açılışta ölçüldüğünde haritayı uygun zoom ve 2D/3D moduna ayarla
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const width = el.clientWidth || window.innerWidth;
    const default3D = width >= MOBILE_BREAKPOINT_PX;
    setIs3D(default3D);
    setViewState(getInitialViewState(width, default3D));
  }, []);

  // Escape tuşuyla açık santral kartını kapat
  useEffect(() => {
    if (!selectedPlantCard) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedPlantCard(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedPlantCard]);

  // Seçili saatteki (selectedHourIndex) santral üretimlerini tek seferde hesapla (60fps için useMemo)
  const plantsAtHour = useMemo<PlantAtHour[]>(() => {
    return plants.map((plant) => ({
      ...plant,
      currentHourMw: plant.hourlyMw[selectedHourIndex] ?? 0,
    }));
  }, [plants, selectedHourIndex]);

  // Tıklanmış santral nesnesini seçili saatteki güncel üretimiyle bul
  const selectedPlant = useMemo<PlantAtHour | null>(() => {
    if (!selectedPlantCard) return null;
    return (
      plantsAtHour.find((p) => p.id === selectedPlantCard.plantId) ?? null
    );
  }, [plantsAtHour, selectedPlantCard]);

  const handleZoom = useCallback((delta: number) => {
    setViewState((prev) => ({
      ...prev,
      zoom: Math.max(
        prev.minZoom ?? 3.5,
        Math.min(prev.maxZoom ?? 11, (prev.zoom ?? 5.4) + delta)
      ),
    }));
  }, []);

  const handleToggle2D3D = useCallback(() => {
    setIs3D((prev3D) => {
      const next3D = !prev3D;
      setViewState((prevView) => ({
        ...prevView,
        pitch: next3D ? DESKTOP_DEFAULT_PITCH : 0,
        bearing: next3D ? prevView.bearing ?? 0 : 0,
      }));
      return next3D;
    });
  }, []);

  const handleResetView = useCallback(() => {
    const width = containerRef.current?.clientWidth ?? window.innerWidth;
    const default3D = width >= MOBILE_BREAKPOINT_PX;
    setIs3D(default3D);
    setViewState(getInitialViewState(width, default3D));
    setSelectedPlantCard(null);
  }, []);

  const handlePlantHover = useCallback(
    (info: PickingInfo<PlantAtHour>) => {
      const nextId = info.object?.id ?? null;
      setHoveredPlantId((prev) => (prev === nextId ? prev : nextId));
    },
    []
  );

  const handlePlantClick = useCallback(
    (info: PickingInfo<PlantAtHour>) => {
      if (
        info.object &&
        typeof info.x === "number" &&
        typeof info.y === "number"
      ) {
        setSelectedPlantCard({
          plantId: info.object.id,
          x: info.x,
          y: info.y,
        });
      }
    },
    []
  );

  // 1. Türkiye İl Sınırları Katmanı (Santral hover/seçim durumundan bağımsız memoize edilir)
  const provincesLayer = useMemo(() => {
    if (!provincesGeoJson) return null;
    return new GeoJsonLayer<ProvinceFeature["properties"]>({
      id: "turkey-provinces-layer",
      data: provincesGeoJson as unknown as GeoJSON.FeatureCollection<
        GeoJSON.Geometry,
        ProvinceFeature["properties"]
      >,
      pickable: true,
      stroked: true,
      filled: true,
      lineWidthUnits: "pixels",
      lineWidthMinPixels: 1,
      getFillColor: (feature) => {
        const isHovered = feature.properties?.plate === hoveredProvincePlate;
        return isHovered ? [21, 31, 50, 255] : [11, 17, 30, 255];
      },
      getLineColor: (feature) => {
        const isHovered = feature.properties?.plate === hoveredProvincePlate;
        return isHovered ? [56, 189, 248, 170] : [30, 41, 59, 230];
      },
      getLineWidth: (feature) =>
        feature.properties?.plate === hoveredProvincePlate ? 1.75 : 1,
      updateTriggers: {
        getFillColor: [hoveredProvincePlate],
        getLineColor: [hoveredProvincePlate],
        getLineWidth: [hoveredProvincePlate],
      },
      onHover: (info: PickingInfo<ProvinceFeature>) => {
        const nextPlate = info.object?.properties?.plate ?? null;
        setHoveredProvincePlate((prev) =>
          prev === nextPlate ? prev : nextPlate
        );
      },
    });
  }, [provincesGeoJson, hoveredProvincePlate]);

  // 2. Santral Taban Noktaları + 3D Sütun Katmanları (~780 santralde 60fps için optimize)
  const plantLayers = useMemo(() => {
    if (plantsAtHour.length === 0) return [];

    const selectedId = selectedPlantCard?.plantId ?? null;

    // Taban noktaları (hem 2D hem 3D modda her santralin konumunu zeminde sabitler)
    const baseScatterLayer = new ScatterplotLayer<PlantAtHour>({
      id: "plants-scatter-layer",
      data: plantsAtHour,
      pickable: true,
      stroked: true,
      filled: true,
      radiusUnits: "pixels",
      lineWidthUnits: "pixels",
      lineWidthMinPixels: 1,
      radiusMinPixels: is3D ? 2.5 : 3,
      radiusMaxPixels: is3D ? 14 : 26,
      getPosition: (d) => [d.lon, d.lat],
      getRadius: (d) =>
        is3D
          ? Math.max(3, computePlantRadiusPx(d.currentHourMw) * 0.55)
          : computePlantRadiusPx(d.currentHourMw),
      getFillColor: (d) => {
        const [r, g, b] = SOURCE_PALETTE[d.source].rgb;
        const alpha = d.currentHourMw > 0 ? (is3D ? 200 : 235) : 110;
        return [r, g, b, alpha];
      },
      getLineColor: (d) => {
        if (d.id === selectedId || d.id === hoveredPlantId) {
          return [248, 250, 252, 255];
        }
        return [6, 10, 18, 210];
      },
      getLineWidth: (d) =>
        d.id === selectedId || d.id === hoveredPlantId ? 2.2 : 1,
      updateTriggers: {
        getRadius: [selectedHourIndex, is3D],
        getFillColor: [selectedHourIndex, is3D],
        getLineColor: [selectedId, hoveredPlantId],
        getLineWidth: [selectedId, hoveredPlantId],
      },
      onHover: handlePlantHover,
      onClick: handlePlantClick,
    });

    if (!is3D) {
      // 2D modda üretimi > 0 olan santraller için hafif dış ışıma halkası
      const activePlants = plantsAtHour.filter((p) => p.currentHourMw > 0);
      const glowLayer = new ScatterplotLayer<PlantAtHour>({
        id: "plants-glow-layer",
        data: activePlants,
        pickable: false,
        stroked: false,
        filled: true,
        radiusUnits: "pixels",
        radiusMinPixels: 6,
        radiusMaxPixels: 40,
        getPosition: (d) => [d.lon, d.lat],
        getRadius: (d) => computePlantRadiusPx(d.currentHourMw) * 1.7,
        getFillColor: (d) => {
          const [r, g, b] = SOURCE_PALETTE[d.source].rgb;
          return [r, g, b, 42];
        },
        updateTriggers: {
          getRadius: [selectedHourIndex],
        },
      });
      return [glowLayer, baseScatterLayer];
    }

    // 3D Mod: Santral noktalarının üzerinde yükselen 3D üretim sütunları (ColumnLayer)
    // diskResolution: 12 ile ~780 sütunda düşük üçgen sayısı ve akıcı 60fps sağlanır.
    const columnsLayer = new ColumnLayer<PlantAtHour>({
      id: "plants-column-layer",
      data: plantsAtHour,
      pickable: true,
      extruded: true,
      stroked: false,
      diskResolution: 12,
      radius: 4200,
      elevationScale: 1,
      material: {
        ambient: 0.55,
        diffuse: 0.6,
        shininess: 32,
        specularColor: [255, 255, 255],
      },
      getPosition: (d) => [d.lon, d.lat],
      getElevation: (d) => computeColumnElevationMeters(d.currentHourMw),
      getFillColor: (d) => {
        const [r, g, b] = SOURCE_PALETTE[d.source].rgb;
        if (d.id === selectedId) {
          return [
            Math.min(255, r + 35),
            Math.min(255, g + 35),
            Math.min(255, b + 35),
            255,
          ];
        }
        if (d.id === hoveredPlantId) {
          return [
            Math.min(255, r + 20),
            Math.min(255, g + 20),
            Math.min(255, b + 20),
            250,
          ];
        }
        const alpha = d.currentHourMw > 0 ? 232 : 0;
        return [r, g, b, alpha];
      },
      updateTriggers: {
        getElevation: [selectedHourIndex],
        getFillColor: [selectedHourIndex, selectedId, hoveredPlantId],
      },
      onHover: handlePlantHover,
      onClick: handlePlantClick,
    });

    return [baseScatterLayer, columnsLayer];
  }, [
    plantsAtHour,
    is3D,
    selectedHourIndex,
    hoveredPlantId,
    selectedPlantCard?.plantId,
    handlePlantHover,
    handlePlantClick,
  ]);

  const layers = useMemo(() => {
    if (!provincesLayer) return [];
    return [provincesLayer, ...plantLayers];
  }, [provincesLayer, plantLayers]);

  const plantsDayDate = snapshot?.plants_day.date ?? "";
  const plantsDayDateTr = plantsDayDate ? formatLocalDate(plantsDayDate) : "";
  const selectedHourParts = selectedHourTimestamp
    ? formatTimestampParts(selectedHourTimestamp)
    : null;

  const plantsFreshness = snapshot
    ? evaluateFreshness(snapshot.plants_day.last_hour_ts, 36, 48)
    : null;

  const unlicensed = snapshot?.unlicensed_solar;

  return (
    <main
      ref={containerRef}
      aria-label="Türkiye santral üretim haritası"
      onContextMenu={(e) => e.preventDefault()}
      className="relative flex-1 min-h-[420px] w-full overflow-hidden bg-[#060A12] select-none"
    >
      {/* Harita Yükleniyor Durumu */}
      {loading && (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[#060A12]/90 backdrop-blur-sm"
        >
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#1E293B] border-t-[#10B981]" />
          <p className="font-mono-data text-xs text-[#94A3B8]">
            Türkiye il sınırları ve santral verileri yükleniyor…
          </p>
        </div>
      )}

      {/* Veri Yok Durumu */}
      {!loading && (!provincesGeoJson || plants.length === 0) && (
        <div
          role="status"
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-[#060A12] p-6 text-center"
        >
          <AlertTriangle
            className="h-8 w-8 text-[#F59E0B]"
            aria-hidden="true"
          />
          <p className="font-display text-base font-semibold text-[#F8FAFC]">
            Harita verisi bulunamadı
          </p>
          <p className="max-w-md text-xs text-[#94A3B8]">
            Santral konumları veya il sınırları verisi şu anda görüntülenemiyor.
          </p>
        </div>
      )}

      {/* deck.gl Harita Kanvası (Sağ tık veya Ctrl+sürükle ile döndürme ve eğme aktif) */}
      <DeckGL
        views={new MapView({ id: "turkey-map", repeat: false })}
        viewState={viewState}
        onViewStateChange={({ viewState: nextViewState }) => {
          const next = nextViewState as MapViewState;
          setViewState(next);
        }}
        onClick={(info: PickingInfo) => {
          // Santral dışındaki boş alana veya il poligonuna tıklandığında açık santral kartını kapat
          if (
            !info.object ||
            info.layer?.id === "turkey-provinces-layer"
          ) {
            setSelectedPlantCard(null);
          }
        }}
        controller={{
          dragRotate: true,
          touchRotate: true,
          doubleClickZoom: true,
          scrollZoom: true,
          dragPan: true,
          keyboard: true,
        }}
        layers={layers}
        getCursor={({ isHovering, isDragging }) =>
          isDragging ? "grabbing" : isHovering ? "pointer" : "grab"
        }
      />

      {/* Sol Üst Yüzen Rozetler: Santral Verisi Tarihi + Lisanssız Güneş Bilgi Notu */}
      {snapshot && (
        <div className="pointer-events-none absolute top-3 left-3 z-10 flex max-w-[calc(100%-4.5rem)] flex-col items-start gap-2 sm:top-4 sm:left-5 sm:max-w-md">
          {/* Zorunlu "Santral verisi: [plants_day.date]" etiketi */}
          <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-lg border border-[#1E293B] bg-[#0D1422]/90 px-3 py-2 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#F8FAFC]">
              <Calendar
                className="h-3.5 w-3.5 shrink-0 text-[#38BDF8]"
                aria-hidden="true"
              />
              <span>
                Santral verisi:{" "}
                <strong className="font-mono-data font-semibold text-[#38BDF8] tabular-nums">
                  {plantsDayDate}
                </strong>{" "}
                <span className="text-[#94A3B8]">
                  ({plantsDayDateTr}
                  {selectedHourParts ? ` · ${selectedHourParts.hour}` : ""})
                </span>
              </span>
            </div>

            <div className="flex items-center gap-2 border-l border-[#1E293B] pl-2 font-mono-data text-[11px] text-[#94A3B8] tabular-nums">
              <span>
                Son saat:{" "}
                <strong className="text-[#F8FAFC]">
                  {formatMw(snapshot.plants_day.total_mw_last_hour)}
                </strong>
              </span>
              <span>·</span>
              <span title="Haritada koordinatı eşleşen santral sayısı / toplam santral">
                Haritada:{" "}
                <strong className="text-[#F8FAFC]">
                  {formatNumber(plants.length)}
                </strong>{" "}
                / {formatNumber(totalPlantsInCatalog)} santral
              </span>
            </div>

            {plantsFreshness && plantsFreshness.level !== "fresh" && (
              <Badge
                variant={
                  plantsFreshness.level === "error" ? "error" : "warning"
                }
                className="tabular-nums"
              >
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                <span>Santral verisi {plantsFreshness.label}</span>
              </Badge>
            )}
          </div>

          {/* Zorunlu Lisanssız Güneş Bilgi Notu */}
          {unlicensed && (
            <div className="pointer-events-auto rounded-lg border border-[#FACC15]/30 bg-[#0D1422]/90 px-3 py-2 text-xs shadow-lg backdrop-blur-md">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 font-medium text-[#F8FAFC]">
                  <Sun
                    className="h-3.5 w-3.5 shrink-0 text-[#FACC15]"
                    aria-hidden="true"
                  />
                  <span>
                    Lisanssız güneş bilgi notu{" "}
                    <span className="font-mono-data text-[#FACC15] tabular-nums">
                      ({formatMonthLabel(unlicensed.month)})
                    </span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUnlicensedDetail((v) => !v)}
                  className="inline-flex min-h-[28px] items-center gap-1 rounded px-1.5 text-[11px] text-[#94A3B8] hover:bg-[#151F32] hover:text-[#F8FAFC] sm:hidden"
                  aria-expanded={showUnlicensedDetail}
                >
                  <Info className="h-3 w-3" aria-hidden="true" />
                  <span>{showUnlicensedDetail ? "Gizle" : "Detay"}</span>
                </button>
              </div>

              <div
                className={`mt-1 text-[11px] leading-relaxed text-[#94A3B8] tabular-nums ${
                  showUnlicensedDetail ? "block" : "hidden sm:block"
                }`}
              >
                Aylık ort.{" "}
                <strong className="font-mono-data text-[#F8FAFC]">
                  {formatMw(unlicensed.avg_mw)}
                </strong>{" "}
                · Öğlen tepe{" "}
                <strong className="font-mono-data text-[#F8FAFC]">
                  {formatMw(unlicensed.peak_mw)}
                </strong>
                .{" "}
                <span className="text-[#64748B]">
                  Gerçek zamanlı lisanslı üretim sayaçlarına dahil değildir
                  (gecikmeli yayımlanır).
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sağ Alt Harita Kontrolleri: 2D / 3D Geçişi + Yakınlaştırma + Sıfırlama */}
      <div
        aria-label="Harita görünüm ve yakınlaştırma kontrolleri"
        className="absolute right-3 bottom-3 z-10 flex flex-col gap-1.5 sm:right-5 sm:bottom-4"
      >
        <button
          type="button"
          onClick={handleToggle2D3D}
          aria-pressed={is3D}
          aria-label={
            is3D ? "2B düz harita görünümüne geç" : "3B sütun görünümüne geç"
          }
          title={
            is3D
              ? "3D sütun görünümü aktif (2D görünüm için tıkla)"
              : "2D düz görünüm aktif (3D sütunlar için tıkla)"
          }
          className={`flex h-11 w-11 flex-col items-center justify-center rounded-lg border font-mono-data text-[11px] font-bold shadow-md backdrop-blur-md transition-colors focus-visible:outline-2 focus-visible:outline-[#38BDF8] ${
            is3D
              ? "border-[#38BDF8]/60 bg-[#0D1422]/95 text-[#38BDF8] hover:bg-[#151F32]"
              : "border-[#1E293B] bg-[#0D1422]/90 text-[#94A3B8] hover:border-[#334155] hover:bg-[#151F32] hover:text-[#F8FAFC]"
          }`}
        >
          {is3D ? (
            <Box className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span className="leading-none">{is3D ? "3D" : "2D"}</span>
        </button>

        <button
          type="button"
          onClick={() => handleZoom(0.65)}
          aria-label="Haritayı yakınlaştır"
          title="Yakınlaştır"
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#1E293B] bg-[#0D1422]/90 text-[#F8FAFC] shadow-md backdrop-blur-md transition-colors hover:border-[#334155] hover:bg-[#151F32] focus-visible:outline-2 focus-visible:outline-[#38BDF8]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => handleZoom(-0.65)}
          aria-label="Haritayı uzaklaştır"
          title="Uzaklaştır"
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#1E293B] bg-[#0D1422]/90 text-[#F8FAFC] shadow-md backdrop-blur-md transition-colors hover:border-[#334155] hover:bg-[#151F32] focus-visible:outline-2 focus-visible:outline-[#38BDF8]"
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={handleResetView}
          aria-label="Harita görünümünü sıfırla"
          title="Türkiye görünümünü ve eğimi sıfırla"
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#1E293B] bg-[#0D1422]/90 text-[#94A3B8] shadow-md backdrop-blur-md transition-colors hover:border-[#334155] hover:bg-[#151F32] hover:text-[#F8FAFC] focus-visible:outline-2 focus-visible:outline-[#38BDF8]"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Sol Alt: Sütun / Nokta Ölçeği ve Kamera Kontrol İpucu */}
      {sourceLabels && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 hidden max-w-2xl rounded-lg border border-[#1E293B] bg-[#0D1422]/88 px-3 py-2 text-[11px] shadow-lg backdrop-blur-md md:block sm:left-5 sm:bottom-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold uppercase tracking-wider text-[#94A3B8]">
              {is3D ? "3D Sütun yüksekliği (√MW)" : "Nokta boyutu (√MW)"} · Saat{" "}
              <span className="font-mono-data text-[#F8FAFC] tabular-nums">
                {selectedHourParts?.hour ?? "23:00"}
              </span>
              :
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono-data text-[#94A3B8] tabular-nums">
              <span className="inline-block h-2 w-2 rounded-full bg-[#94A3B8]" />
              5–25 MW
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono-data text-[#94A3B8] tabular-nums">
              <span className="inline-block h-3 w-3 rounded-full bg-[#94A3B8]" />
              250 MW
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono-data text-[#94A3B8] tabular-nums">
              <span className="inline-block h-4 w-4 rounded-full bg-[#94A3B8]" />
              1.500+ MW
            </span>
            <span className="border-l border-[#1E293B] pl-3 text-[#64748B]">
              Santral detayı: <strong className="text-[#94A3B8]">Sol tık</strong>{" "}
              · Eğ / döndür:{" "}
              <strong className="text-[#94A3B8]">Sağ tık</strong> veya{" "}
              <strong className="text-[#94A3B8]">Ctrl + sürükle</strong>
            </span>
          </div>
        </div>
      )}

      {/* Tıklayınca Açılan Santral Bilgi Kartı (Ad, Kaynak Türkçe Etiketi, Kurulu Güç, O Saatteki MW) */}
      {selectedPlant && selectedPlantCard && (
        <div
          role="dialog"
          aria-label={`${selectedPlant.name} santral bilgisi`}
          style={{
            left: Math.min(
              Math.max(12, selectedPlantCard.x + 14),
              (containerRef.current?.clientWidth ?? 360) - 276
            ),
            top: Math.min(
              Math.max(12, selectedPlantCard.y - 16),
              (containerRef.current?.clientHeight ?? 420) - 180
            ),
          }}
          className="pointer-events-auto absolute z-30 w-64 rounded-lg border border-[#38BDF8]/50 bg-[#0D1422]/95 p-3.5 text-xs shadow-2xl backdrop-blur-md"
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-sm font-bold leading-snug text-[#F8FAFC]">
              {selectedPlant.name}
            </h3>
            <button
              type="button"
              onClick={() => setSelectedPlantCard(null)}
              aria-label="Santral kartını kapat"
              className="-mt-1 -mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[#94A3B8] transition-colors hover:bg-[#151F32] hover:text-[#F8FAFC]"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          {/* Kaynak (Türkçe etiket) */}
          <div className="mt-1.5 flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{
                backgroundColor: SOURCE_PALETTE[selectedPlant.source].hex,
              }}
              aria-hidden="true"
            />
            <span className="font-medium text-[#F8FAFC]">
              {selectedPlant.sourceLabel}
            </span>
          </div>

          {/* O saatteki MW ve Kurulu Güç (tr-TR biçiminde) */}
          <div className="mt-2.5 space-y-1.5 border-t border-[#1E293B] pt-2.5 tabular-nums">
            <div className="flex items-center justify-between">
              <span className="text-[#94A3B8]">
                Üretim ({selectedHourParts?.hour ?? "23:00"}):
              </span>
              <span className="font-mono-data text-sm font-bold text-[#F8FAFC]">
                {formatMw(selectedPlant.currentHourMw)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#94A3B8]">Kurulu güç:</span>
              <span className="font-mono-data font-medium text-[#F8FAFC]">
                {selectedPlant.capacityMw !== null
                  ? formatMw(selectedPlant.capacityMw)
                  : "bilinmiyor"}
              </span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
