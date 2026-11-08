import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DeckGL from "@deck.gl/react";
import { MapView, type MapViewState, type PickingInfo } from "@deck.gl/core";
import { GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers";
import {
  AlertTriangle,
  Calendar,
  Info,
  Minus,
  Plus,
  RotateCcw,
  Sun,
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
  lastHourTimestamp: string | null;
  loading: boolean;
}

interface HoverState {
  plant: LocatedPlantPoint;
  x: number;
  y: number;
}

const TURKEY_CENTER = {
  longitude: 35.25,
  latitude: 39.05,
};

function getInitialViewState(width: number): MapViewState {
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;
  return {
    longitude: TURKEY_CENTER.longitude,
    latitude: TURKEY_CENTER.latitude,
    zoom: isMobile ? 4.05 : isTablet ? 4.8 : 5.45,
    minZoom: 3.5,
    maxZoom: 11,
    pitch: 0,
    bearing: 0,
  };
}

/**
 * Son saat üretimine (MW) göre nokta yarıçapı (piksel).
 * Karekök ölçekleme sayesinde hem 5 MW hem 1.912 MW santraller okunaklı kalır.
 */
function computePlantRadiusPx(lastHourMw: number): number {
  if (lastHourMw <= 0) return 3.2;
  return Math.min(26, 4.2 + Math.sqrt(lastHourMw) * 0.44);
}

export function TurkeyMap({
  provincesGeoJson,
  plants,
  totalPlantsInCatalog,
  snapshot,
  sourceLabels,
  lastHourTimestamp,
  loading,
}: TurkeyMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewState, setViewState] = useState<MapViewState>(() =>
    getInitialViewState(typeof window !== "undefined" ? window.innerWidth : 1280)
  );
  const [hoveredPlant, setHoveredPlant] = useState<HoverState | null>(null);
  const [hoveredProvincePlate, setHoveredProvincePlate] = useState<
    number | null
  >(null);
  const [showUnlicensedDetail, setShowUnlicensedDetail] = useState(false);

  // Ekran boyutu ilk açılışta ölçüldüğünde haritayı uygun zoom seviyesine ayarla
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const width = el.clientWidth || window.innerWidth;
    setViewState(getInitialViewState(width));
  }, []);

  const handleZoom = useCallback((delta: number) => {
    setViewState((prev) => ({
      ...prev,
      zoom: Math.max(
        prev.minZoom ?? 3.5,
        Math.min(prev.maxZoom ?? 11, (prev.zoom ?? 5.4) + delta)
      ),
    }));
  }, []);

  const handleResetView = useCallback(() => {
    const width = containerRef.current?.clientWidth ?? window.innerWidth;
    setViewState(getInitialViewState(width));
    setHoveredPlant(null);
  }, []);

  const layers = useMemo(() => {
    if (!provincesGeoJson) return [];

    // 1. Türkiye İl Sınırları Katmanı (Harici tile servisi olmadan koyu kontrol odası altlığı)
    const provincesLayer = new GeoJsonLayer<ProvinceFeature["properties"]>({
      id: "turkey-provinces-layer",
      // GeoJsonLayer RFC 7946 FeatureCollection bekler
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
        setHoveredProvincePlate(info.object?.properties?.plate ?? null);
      },
    });

    // 2. Üretimi > 0 olan santraller için dış ışıma (glow) halkası
    const activePlants = plants.filter((p) => p.lastHourMw > 0);
    const plantGlowLayer = new ScatterplotLayer<LocatedPlantPoint>({
      id: "plants-glow-layer",
      data: activePlants,
      pickable: false,
      stroked: false,
      filled: true,
      radiusUnits: "pixels",
      radiusMinPixels: 6,
      radiusMaxPixels: 42,
      getPosition: (d) => [d.lon, d.lat],
      getRadius: (d) => computePlantRadiusPx(d.lastHourMw) * 1.75,
      getFillColor: (d) => {
        const [r, g, b] = SOURCE_PALETTE[d.source].rgb;
        return [r, g, b, 45];
      },
    });

    // 3. Ana Santral Noktaları Katmanı
    const plantsScatterLayer = new ScatterplotLayer<LocatedPlantPoint>({
      id: "plants-scatter-layer",
      data: plants,
      pickable: true,
      stroked: true,
      filled: true,
      radiusUnits: "pixels",
      lineWidthUnits: "pixels",
      lineWidthMinPixels: 1,
      radiusMinPixels: 3,
      radiusMaxPixels: 28,
      getPosition: (d) => [d.lon, d.lat],
      getRadius: (d) => computePlantRadiusPx(d.lastHourMw),
      getFillColor: (d) => {
        const [r, g, b] = SOURCE_PALETTE[d.source].rgb;
        const alpha = d.lastHourMw > 0 ? 235 : 115;
        return [r, g, b, alpha];
      },
      getLineColor: (d) => {
        if (hoveredPlant?.plant.id === d.id) {
          return [248, 250, 252, 255];
        }
        return [6, 10, 18, 210];
      },
      getLineWidth: (d) => (hoveredPlant?.plant.id === d.id ? 2 : 1),
      updateTriggers: {
        getLineColor: [hoveredPlant?.plant.id],
        getLineWidth: [hoveredPlant?.plant.id],
      },
      onHover: (info: PickingInfo<LocatedPlantPoint>) => {
        if (info.object && typeof info.x === "number" && typeof info.y === "number") {
          setHoveredPlant({
            plant: info.object,
            x: info.x,
            y: info.y,
          });
        } else {
          setHoveredPlant(null);
        }
      },
      onClick: (info: PickingInfo<LocatedPlantPoint>) => {
        if (info.object && typeof info.x === "number" && typeof info.y === "number") {
          setHoveredPlant({
            plant: info.object,
            x: info.x,
            y: info.y,
          });
        }
      },
    });

    return [provincesLayer, plantGlowLayer, plantsScatterLayer];
  }, [provincesGeoJson, plants, hoveredProvincePlate, hoveredPlant?.plant.id]);

  const plantsDayDate = snapshot?.plants_day.date ?? "";
  const plantsDayDateTr = plantsDayDate ? formatLocalDate(plantsDayDate) : "";
  const lastHourParts = lastHourTimestamp
    ? formatTimestampParts(lastHourTimestamp)
    : null;

  const plantsFreshness = snapshot
    ? evaluateFreshness(snapshot.plants_day.last_hour_ts, 36, 48)
    : null;

  const unlicensed = snapshot?.unlicensed_solar;

  return (
    <main
      ref={containerRef}
      aria-label="Türkiye santral üretim haritası"
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
          role=" status"
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-[#060A12] p-6 text-center"
        >
          <AlertTriangle className="h-8 w-8 text-[#F59E0B]" aria-hidden="true" />
          <p className="font-display text-base font-semibold text-[#F8FAFC]">
            Harita verisi bulunamadı
          </p>
          <p className="max-w-md text-xs text-[#94A3B8]">
            Santral konumları veya il sınırları verisi şu anda görüntülenemiyor.
          </p>
        </div>
      )}

      {/* deck.gl Harita Kanvası */}
      <DeckGL
        views={new MapView({ id: "turkey-map", repeat: false })}
        viewState={viewState}
        onViewStateChange={({ viewState: nextViewState }) =>
          setViewState(nextViewState as MapViewState)
        }
        controller={{
          dragRotate: false,
          touchRotate: false,
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
        <div className="pointer-events-none absolute top-3 left-3 z-10 flex max-w-[calc(100%-4rem)] flex-col items-start gap-2 sm:top-4 sm:left-5 sm:max-w-md">
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
                  {lastHourParts ? ` · ${lastHourParts.hour}` : ""})
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

      {/* Sağ Üst / Sağ Alt Harita Yakınlaştırma Kontrolleri (Min 44x44px dokunma hedefi) */}
      <div
        aria-label="Harita yakınlaştırma kontrolleri"
        className="absolute right-3 bottom-3 z-10 flex flex-col gap-1.5 sm:right-5 sm:bottom-4"
      >
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
          title="Türkiye görünümünü sıfırla"
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#1E293B] bg-[#0D1422]/90 text-[#94A3B8] shadow-md backdrop-blur-md transition-colors hover:border-[#334155] hover:bg-[#151F32] hover:text-[#F8FAFC] focus-visible:outline-2 focus-visible:outline-[#38BDF8]"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Sol Alt: Nokta Büyüklüğü ve Kaynak Renk Göstergesi (Legend) */}
      {sourceLabels && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 hidden max-w-xl rounded-lg border border-[#1E293B] bg-[#0D1422]/88 px-3 py-2 text-[11px] shadow-lg backdrop-blur-md md:block sm:left-5 sm:bottom-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold uppercase tracking-wider text-[#94A3B8]">
              Nokta boyutu = 23:00 üretimi (MW):
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono-data text-[#94A3B8] tabular-nums">
              <span className="inline-block h-2 w-2 rounded-full bg-[#94A3B8]" />
              0–25 MW
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono-data text-[#94A3B8] tabular-nums">
              <span className="inline-block h-3 w-3 rounded-full bg-[#94A3B8]" />
              250 MW
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono-data text-[#94A3B8] tabular-nums">
              <span className="inline-block h-4 w-4 rounded-full bg-[#94A3B8]" />
              1.000+ MW
            </span>
          </div>
        </div>
      )}

      {/* Santral Hover / Seçim Bilgi Kartı (Tooltip) */}
      {hoveredPlant && (
        <div
          role="tooltip"
          style={{
            left: Math.min(
              Math.max(12, hoveredPlant.x + 14),
              (containerRef.current?.clientWidth ?? 360) - 250
            ),
            top: Math.max(12, hoveredPlant.y - 10),
          }}
          className="pointer-events-none absolute z-30 w-60 rounded-lg border border-[#334155] bg-[#0D1422]/95 p-3 text-xs shadow-xl backdrop-blur-md"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="font-display text-sm font-bold leading-snug text-[#F8FAFC]">
              {hoveredPlant.plant.name}
            </span>
          </div>

          <div className="mt-1.5 flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{
                backgroundColor: SOURCE_PALETTE[hoveredPlant.plant.source].hex,
              }}
              aria-hidden="true"
            />
            <span className="font-medium text-[#F8FAFC]">
              {hoveredPlant.plant.sourceLabel}
            </span>
          </div>

          <div className="mt-2 space-y-1 border-t border-[#1E293B] pt-2 tabular-nums">
            <div className="flex items-center justify-between">
              <span className="text-[#94A3B8]">
                Son saat ({lastHourParts?.hour ?? "23:00"}):
              </span>
              <span className="font-mono-data font-semibold text-[#F8FAFC]">
                {formatMw(hoveredPlant.plant.lastHourMw)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#94A3B8]">Günlük üretim:</span>
              <span className="font-mono-data text-[#F8FAFC]">
                {formatNumber(hoveredPlant.plant.dailyTotalMwh)} MWh
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#94A3B8]">Kurulu güç:</span>
              <span className="font-mono-data text-[#94A3B8]">
                {hoveredPlant.plant.capacityMw !== null
                  ? formatMw(hoveredPlant.plant.capacityMw)
                  : "Bilinmiyor"}
              </span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
