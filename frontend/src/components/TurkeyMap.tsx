import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import DeckGL from "@deck.gl/react";
import {
  MapView,
  WebMercatorViewport,
  type MapViewState,
  type PickingInfo,
} from "@deck.gl/core";
import { GeoJsonLayer, PathLayer, TextLayer } from "@deck.gl/layers";
import { AlertTriangle, Box, Layers, Minus, Plus, RotateCcw } from "lucide-react";
import {
  ProvinceFloatingPanel,
  type FilterProvinceRankInfo,
} from "@/components/ProvinceFloatingPanel";
import { StackedSolidPolygonLayer } from "@/components/StackedSolidPolygonLayer";
import { DEFAULT_SOURCE_ORDER, SOURCE_PALETTE } from "@/lib/constants";
import type { Province24hSeries, ProvinceHourlySlice } from "@/lib/data";
import { formatTimestampParts } from "@/lib/format";
import {
  ACTIVE_PROVINCE_OPACITY,
  COAST_COUNTRY_BORDER_RGBA,
  COAST_COUNTRY_BORDER_WIDTH_PX,
  computeSingleSourceShadeRgb,
  computeSliceSourceRgb,
  DEFAULT_3D_BEARING_DEG,
  DEFAULT_3D_PITCH_DEG,
  FILTER_TRANSITION_MS,
  HOVER_HEIGHT_MULTIPLIER,
  HOVER_LIFT_RATIO,
  HOVER_MIN_LIFT_M,
  HOVER_TRANSITION_MS,
  LOW_PROVINCE_BASE_ELEVATION_M,
  LOW_PROVINCE_FILL_RGBA,
  LOW_PROVINCE_THRESHOLD_MW,
  type MapFilter,
  MAX_PROVINCE_BLOCK_ELEVATION_M,
  MOBILE_BREAKPOINT_PX,
  NEIGHBOR_BORDER_RGBA,
  NEIGHBOR_LAND_FILL_RGBA,
  OTHER_PROVINCES_DIM_OPACITY,
  PLAYBACK_TRANSITION_MS,
  PROVINCE_BORDER_RGBA,
  PROVINCE_BORDER_WIDTH_PX,
  PROVINCE_FILL_RGBA,
  PROVINCE_HOVER_BORDER_RGBA,
  PROVINCE_HOVER_BORDER_WIDTH_PX,
  PROVINCE_LABEL_ALL_MIN_ZOOM,
  PROVINCE_LABEL_COLOR_RGBA,
  PROVINCE_LABEL_DIM_COLOR_RGBA,
  PROVINCE_LABEL_ELEVATION_PADDING_M,
  PROVINCE_LABEL_FONT_SIZE_PX,
  PROVINCE_LABEL_HOVER_FONT_SIZE_PX,
  PROVINCE_LABEL_OUTLINE_RGBA,
  PROVINCE_LABEL_TOP_COUNT,
  SEA_BACKGROUND_HEX,
  TURKEY_BOUNDS,
  ZERO_SOURCE_PROVINCE_FILL_RGBA,
} from "@/lib/visual";
import type {
  ProvinceFeature,
  Provinces,
  SourceLabels,
  SourceType,
} from "@/types";

export interface TurkeyMapProps {
  provincesGeoJson: Provinces | null;
  provinceSeriesByPlate: ReadonlyMap<number, Province24hSeries> | null;
  neighborsGeoJson: GeoJSON.FeatureCollection | null;
  sourceLabels: SourceLabels | null;
  activeFilter: MapFilter;
  selectedHourIndex: number;
  selectedHourTimestamp: string | null;
  isPlaying?: boolean;
  loading: boolean;
}

export interface ProvinceLabelItem {
  plate: number;
  name: string;
  position: [number, number];
}

interface ProvincePolygonPart {
  plate: number;
  name: string;
  rings: [number, number][][];
  centroid: [number, number];
}

export interface ProvinceAreaLatTable {
  minLat: number;
  maxLat: number;
  /** 0..N kümülatif alan kesri dizisi (0.0 -> 1.0, güneyden kuzeye) */
  cumAreaFractions: Float64Array;
}

export interface ProvinceGeometryMeta {
  labels: ProvinceLabelItem[];
  centroidByPlate: Map<number, [number, number]>;
  polygonParts: ProvincePolygonPart[];
  outerBorderPaths: [number, number][][];
  featureByPlate: Map<number, ProvinceFeature>;
  areaLatTableByPlate: Map<number, ProvinceAreaLatTable>;
}

interface ProvinceSliceInstance {
  id: string;
  plate: number;
  name: string;
  source: SourceType;
  polygon: [number, number][][];
  centroid: [number, number];
}

interface SliceVisualMetrics {
  baseElevationM: number;
  sliceElevationM: number;
  bandLatBounds: [number, number];
  fillColor: [number, number, number, number];
}

interface ProvinceInteractionTarget {
  plate: number;
  x: number;
  y: number;
}

function easeCubicOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Bir poligon halkasının (ring) işaretli alanını ve alan-ağırlıklı merkezini (centroid) hesaplar.
 */
function computeRingAreaAndCentroid(ring: [number, number][]): {
  absArea: number;
  centroid: [number, number];
} {
  const n = ring.length;
  if (n === 0) return { absArea: 0, centroid: [35.25, 39.0] };

  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  let sumX = 0;
  let sumY = 0;

  for (let i = 0; i < n; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % n];
    const cross = x0 * y1 - x1 * y0;
    twiceArea += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
    sumX += x0;
    sumY += y0;
  }

  const absArea = Math.abs(twiceArea) * 0.5;
  if (absArea < 1e-7) {
    return { absArea: 0, centroid: [sumX / n, sumY / n] };
  }
  const factor = 1 / (3 * twiceArea);
  return { absArea, centroid: [cx * factor, cy * factor] };
}

function pointToSegmentDistSq(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 1e-12) {
    const ex = px - x1;
    const ey = py - y1;
    return ex * ex + ey * ey;
  }
  const t = Math.max(
    0,
    Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq)
  );
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  const ex = px - projX;
  const ey = py - projY;
  return ex * ex + ey * ey;
}

function makeUndirectedEdgeKey(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): string {
  const k1 = `${Math.round(x1 * 1000)},${Math.round(y1 * 1000)}`;
  const k2 = `${Math.round(x2 * 1000)},${Math.round(y2 * 1000)}`;
  return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
}

const AREA_LAT_STRIP_COUNT = 64;

/**
 * Bir ilin poligon halkalarını güneyden kuzeye (minY -> maxY) N yatay şeride bölerek
 * kümülatif yüzey alanı dağılım tablosunu hesaplar (Green teoremi ile tam alan hesabı).
 */
function buildProvinceAreaLatTable(
  rings: [number, number][][],
  minLat: number,
  maxLat: number
): ProvinceAreaLatTable {
  const n = AREA_LAT_STRIP_COUNT;
  const cum = new Float64Array(n + 1);
  if (!Number.isFinite(minLat) || !Number.isFinite(maxLat) || maxLat <= minLat) {
    for (let k = 0; k <= n; k++) cum[k] = k / n;
    return { minLat: 36, maxLat: 42, cumAreaFractions: cum };
  }

  const span = maxLat - minLat;
  let runningArea = 0;

  for (let k = 0; k < n; k++) {
    const latA = minLat + (k / n) * span;
    const latB = minLat + ((k + 1) / n) * span;
    let stripArea = 0;

    for (const ring of rings) {
      let signedArea = 0;
      const len = ring.length;
      for (let i = 0; i < len; i++) {
        const [x0, y0] = ring[i];
        const [x1, y1] = ring[(i + 1) % len];
        if (y0 === y1) continue;
        const ya = Math.max(latA, Math.min(latB, y0));
        const yb = Math.max(latA, Math.min(latB, y1));
        if (ya === yb) continue;
        const invDy = 1 / (y1 - y0);
        const xa = x0 + (x1 - x0) * (ya - y0) * invDy;
        const xb = x0 + (x1 - x0) * (yb - y0) * invDy;
        signedArea += 0.5 * (xa + xb) * (yb - ya);
      }
      stripArea += Math.abs(signedArea);
    }

    runningArea += stripArea;
    cum[k + 1] = runningArea;
  }

  if (runningArea > 1e-12) {
    for (let k = 1; k <= n; k++) {
      cum[k] /= runningArea;
    }
    cum[n] = 1.0;
  } else {
    for (let k = 0; k <= n; k++) {
      cum[k] = k / n;
    }
  }

  return { minLat, maxLat, cumAreaFractions: cum };
}

/**
 * Güneyden kuzeye [0..1] kümülatif alan kesrine karşılık gelen tam enlem (latitude) değerini döndürür.
 */
function interpolateLatAtAreaFraction(
  table: ProvinceAreaLatTable,
  fraction: number
): number {
  const pad = 0.0008;
  if (fraction <= 0) return table.minLat - pad;
  if (fraction >= 1) return table.maxLat + pad;

  const cum = table.cumAreaFractions;
  const n = AREA_LAT_STRIP_COUNT;
  let lo = 0;
  let hi = n;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= fraction) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const f0 = cum[lo];
  const f1 = cum[lo + 1];
  const localT = f1 > f0 ? (fraction - f0) / (f1 - f0) : 0;
  const normalizedIdx = (lo + localT) / n;
  return table.minLat + normalizedIdx * (table.maxLat - table.minLat);
}

/**
 * 81 il GeoJSON verisinden:
 * 1) Her ilin ana kara parçasının merkezini,
 * 2) 3B blok ekstrüzyonu için anlamlı büyüklükteki il poligon parçalarını,
 * 3) Türkiye'nin dış sınırını / kıyı ve ülke sınır çizgilerini (#4A6A90, 1,5 px için)
 * bir kez hesaplar.
 */
export function buildProvinceGeometryMeta(
  provincesGeoJson: Provinces | null
): ProvinceGeometryMeta {
  const labels: ProvinceLabelItem[] = [];
  const centroidByPlate = new Map<number, [number, number]>();
  const polygonParts: ProvincePolygonPart[] = [];
  const outerBorderPaths: [number, number][][] = [];
  const featureByPlate = new Map<number, ProvinceFeature>();
  const areaLatTableByPlate = new Map<number, ProvinceAreaLatTable>();

  if (!provincesGeoJson) {
    return {
      labels,
      centroidByPlate,
      polygonParts,
      outerBorderPaths,
      featureByPlate,
      areaLatTableByPlate,
    };
  }

  interface ProvinceRingsRecord {
    plate: number;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    rings: [number, number][][];
    segments: [number, number, number, number][];
  }

  const provinceRecords: ProvinceRingsRecord[] = [];
  const edgeFrequency = new Map<string, number>();

  for (const feature of provincesGeoJson.features) {
    const plate = feature.properties.plate;
    const name = feature.properties.name;
    featureByPlate.set(plate, feature);

    const rawRings: [number, number][][] = [];
    const candidatePolys: {
      rings: [number, number][][];
      area: number;
      centroid: [number, number];
    }[] = [];

    if (feature.geometry.type === "Polygon") {
      const coords = feature.geometry.coordinates as [number, number][][];
      if (coords.length > 0 && coords[0].length >= 3) {
        const { absArea, centroid } = computeRingAreaAndCentroid(coords[0]);
        candidatePolys.push({ rings: coords, area: absArea, centroid });
      }
      for (const ring of coords) {
        if (ring && ring.length >= 3) rawRings.push(ring);
      }
    } else if (feature.geometry.type === "MultiPolygon") {
      const multiCoords = feature.geometry
        .coordinates as [number, number][][][];
      for (const poly of multiCoords) {
        if (poly.length > 0 && poly[0].length >= 3) {
          const { absArea, centroid } = computeRingAreaAndCentroid(poly[0]);
          candidatePolys.push({ rings: poly, area: absArea, centroid });
        }
        for (const ring of poly) {
          if (ring && ring.length >= 3) rawRings.push(ring);
        }
      }
    }

    candidatePolys.sort((a, b) => b.area - a.area);
    for (let idx = 0; idx < candidatePolys.length; idx++) {
      // En büyük ana kara parçasını ve anlamlı büyüklükteki yarımada/adaları (İstanbul iki yakası, Çanakkale vb.) tut;
      // mikroskobik kıyı kayalıklarını (> 0.0025 derece²) eler.
      if (idx === 0 || candidatePolys[idx].area >= 0.0025) {
        polygonParts.push({
          plate,
          name,
          rings: candidatePolys[idx].rings,
          centroid: candidatePolys[idx].centroid,
        });
      }
    }

    let bestArea = -1;
    let bestCentroid: [number, number] = [35.25, 39.0];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const segments: [number, number, number, number][] = [];

    for (const ring of rawRings) {
      const { absArea, centroid } = computeRingAreaAndCentroid(ring);
      if (absArea > bestArea) {
        bestArea = absArea;
        bestCentroid = centroid;
      }

      for (let i = 0; i < ring.length - 1; i++) {
        const [x1, y1] = ring[i];
        const [x2, y2] = ring[i + 1];
        if (x1 < minX) minX = x1;
        if (x2 < minX) minX = x2;
        if (y1 < minY) minY = y1;
        if (y2 < minY) minY = y2;
        if (x1 > maxX) maxX = x1;
        if (x2 > maxX) maxX = x2;
        if (y1 > maxY) maxY = y1;
        if (y2 > maxY) maxY = y2;

        if (x1 === x2 && y1 === y2) continue;
        segments.push([x1, y1, x2, y2]);
        const key = makeUndirectedEdgeKey(x1, y1, x2, y2);
        edgeFrequency.set(key, (edgeFrequency.get(key) ?? 0) + 1);
      }
    }

    centroidByPlate.set(plate, bestCentroid);
    labels.push({
      plate,
      name,
      position: bestCentroid,
    });

    provinceRecords.push({
      plate,
      minX,
      minY,
      maxX,
      maxY,
      rings: rawRings,
      segments,
    });
    areaLatTableByPlate.set(
      plate,
      buildProvinceAreaLatTable(rawRings, minY, maxY)
    );
  }

  const proximityMargin = 0.025;
  const maxInternalDistSq = 0.011 * 0.011;

  const isInternalSegment = (
    plate: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): boolean => {
    const key = makeUndirectedEdgeKey(x1, y1, x2, y2);
    if ((edgeFrequency.get(key) ?? 0) > 1) return true;

    const q1x = x1 * 0.75 + x2 * 0.25;
    const q1y = y1 * 0.75 + y2 * 0.25;
    const q2x = x1 * 0.25 + x2 * 0.75;
    const q2y = y1 * 0.25 + y2 * 0.75;

    for (let j = 0; j < provinceRecords.length; j++) {
      const other = provinceRecords[j];
      if (other.plate === plate) continue;
      if (
        q1x < other.minX - proximityMargin ||
        q1x > other.maxX + proximityMargin ||
        q1y < other.minY - proximityMargin ||
        q1y > other.maxY + proximityMargin
      ) {
        continue;
      }

      let q1Close = false;
      let q2Close = false;
      const segs = other.segments;
      for (let s = 0; s < segs.length; s++) {
        const [sx1, sy1, sx2, sy2] = segs[s];
        if (
          !q1Close &&
          pointToSegmentDistSq(q1x, q1y, sx1, sy1, sx2, sy2) <=
            maxInternalDistSq
        ) {
          q1Close = true;
        }
        if (
          !q2Close &&
          pointToSegmentDistSq(q2x, q2y, sx1, sy1, sx2, sy2) <=
            maxInternalDistSq
        ) {
          q2Close = true;
        }
        if (q1Close && q2Close) return true;
      }
    }
    return false;
  };

  for (const rec of provinceRecords) {
    for (const ring of rec.rings) {
      let currentPath: [number, number][] = [];
      for (let i = 0; i < ring.length - 1; i++) {
        const p1 = ring[i];
        const p2 = ring[i + 1];
        if (p1[0] === p2[0] && p1[1] === p2[1]) continue;

        if (!isInternalSegment(rec.plate, p1[0], p1[1], p2[0], p2[1])) {
          if (currentPath.length === 0) {
            currentPath.push(p1, p2);
          } else {
            currentPath.push(p2);
          }
        } else if (currentPath.length >= 2) {
          outerBorderPaths.push(currentPath);
          currentPath = [];
        } else {
          currentPath = [];
        }
      }
      if (currentPath.length >= 2) {
        outerBorderPaths.push(currentPath);
      }
    }
  }

  return {
    labels,
    centroidByPlate,
    polygonParts,
    outerBorderPaths,
    featureByPlate,
    areaLatTableByPlate,
  };
}

/**
 * WebMercatorViewport.fitBounds kullanarak Türkiye sınırlarını
 * sol üst panel, üstteki filtre düğme grubu ve alt oynatma çubuğu boşluklarıyla (padding) ekrana tam sığdırır.
 */
function computeFittedViewState(
  width: number,
  height: number,
  is3DMode: boolean
): MapViewState {
  const safeWidth = Math.max(320, width);
  const safeHeight = Math.max(360, height);
  const isMobile = safeWidth < MOBILE_BREAKPOINT_PX;

  const padding = isMobile
    ? { top: 72, bottom: 136, left: 16, right: 16 }
    : { top: 92, bottom: 96, left: 444, right: 76 };

  try {
    const viewport = new WebMercatorViewport({
      width: safeWidth,
      height: safeHeight,
    }).fitBounds(TURKEY_BOUNDS, { padding });

    return {
      longitude: viewport.longitude,
      latitude: viewport.latitude,
      zoom: Math.max(3.8, Math.min(8.5, viewport.zoom)),
      minZoom: 3.5,
      maxZoom: 11.5,
      pitch: is3DMode ? DEFAULT_3D_PITCH_DEG : 0,
      bearing: is3DMode ? DEFAULT_3D_BEARING_DEG : 0,
      maxPitch: 65,
      minPitch: 0,
    };
  } catch {
    return {
      longitude: 35.25,
      latitude: 39.0,
      zoom: isMobile ? 4.1 : 5.4,
      minZoom: 3.5,
      maxZoom: 11.5,
      pitch: is3DMode ? DEFAULT_3D_PITCH_DEG : 0,
      bearing: is3DMode ? DEFAULT_3D_BEARING_DEG : 0,
      maxPitch: 65,
      minPitch: 0,
    };
  }
}

function isSourceInFilter(
  source: SourceType,
  filter: MapFilter,
  sourceLabels: SourceLabels | null
): boolean {
  if (filter === "all") return true;
  const isRen =
    sourceLabels?.sources[source]?.renewable ?? SOURCE_PALETTE[source].renewable;
  if (filter === "renewable") return isRen;
  if (filter === "fossil") return !isRen;
  return source === filter;
}

export const TurkeyMap = memo(function TurkeyMap({
  provincesGeoJson,
  provinceSeriesByPlate,
  neighborsGeoJson,
  sourceLabels,
  activeFilter,
  selectedHourIndex,
  selectedHourTimestamp,
  isPlaying = false,
  loading,
}: TurkeyMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [is3D, setIs3D] = useState<boolean>(() =>
    typeof window !== "undefined"
      ? window.innerWidth >= MOBILE_BREAKPOINT_PX
      : true
  );

  const [viewState, setViewState] = useState<MapViewState>(() => {
    const w = typeof window !== "undefined" ? window.innerWidth : 1280;
    const h = typeof window !== "undefined" ? window.innerHeight : 800;
    const initial3D = w >= MOBILE_BREAKPOINT_PX;
    return computeFittedViewState(w, h, initial3D);
  });

  const [hoveredTarget, setHoveredTarget] =
    useState<ProvinceInteractionTarget | null>(null);
  const [pinnedTarget, setPinnedTarget] =
    useState<ProvinceInteractionTarget | null>(null);

  // Geçiş süresini tetikleyen nedene göre belirle: hover = 300ms, oynatma = 400ms, filtre değişimi = 500ms
  const prevFilterRef = useRef<MapFilter>(activeFilter);
  const prevHourRef = useRef<number>(selectedHourIndex);
  let transitionDurationMs = HOVER_TRANSITION_MS;
  if (prevFilterRef.current !== activeFilter) {
    transitionDurationMs = FILTER_TRANSITION_MS;
  } else if (prevHourRef.current !== selectedHourIndex || isPlaying) {
    transitionDurationMs = PLAYBACK_TRANSITION_MS;
  }
  useEffect(() => {
    prevFilterRef.current = activeFilter;
    prevHourRef.current = selectedHourIndex;
  }, [activeFilter, selectedHourIndex]);

  // Açılışta ve pencere boyutu değiştiğinde Türkiye'yi yeniden ekrana sığdır
  useEffect(() => {
    const updateSize = () => {
      const el = containerRef.current;
      const w = el?.clientWidth || window.innerWidth;
      const h = el?.clientHeight || window.innerHeight;
      const next3D = w >= MOBILE_BREAKPOINT_PX;
      setIs3D(next3D);
      setViewState(computeFittedViewState(w, h, next3D));
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  useEffect(() => {
    if (!pinnedTarget) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPinnedTarget(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pinnedTarget]);

  const provinceMeta = useMemo<ProvinceGeometryMeta>(() => {
    return buildProvinceGeometryMeta(provincesGeoJson);
  }, [provincesGeoJson]);

  // Tüm il × aktif kaynak dilim poligonlarını BİR KEZ oluştur (GPU üçgenleme bir kez çalışır)
  const sliceInstances = useMemo<ProvinceSliceInstance[]>(() => {
    if (!provinceSeriesByPlate || provinceMeta.polygonParts.length === 0) {
      return [];
    }
    const items: ProvinceSliceInstance[] = [];
    for (let idx = 0; idx < provinceMeta.polygonParts.length; idx++) {
      const part = provinceMeta.polygonParts[idx];
      const series = provinceSeriesByPlate.get(part.plate);
      if (!series) continue;

      const activeSourcesInProvince = new Set<SourceType>();
      for (let h = 0; h < series.hours.length; h++) {
        const bySrc = series.hours[h].bySource;
        for (const src of DEFAULT_SOURCE_ORDER) {
          if ((bySrc[src] ?? 0) > 0) {
            activeSourcesInProvince.add(src);
          }
        }
      }

      for (const src of DEFAULT_SOURCE_ORDER) {
        if (!activeSourcesInProvince.has(src)) continue;
        items.push({
          id: `${part.plate}-${idx}-${src}`,
          plate: part.plate,
          name: part.name,
          source: src,
          polygon: part.rings,
          centroid: part.centroid,
        });
      }
    }
    return items;
  }, [provinceMeta.polygonParts, provinceSeriesByPlate]);

  const activeTarget = pinnedTarget ?? hoveredTarget;
  const activeProvincePlate = activeTarget?.plate ?? null;

  // Seçili saat, aktif filtre ve hover durumuna göre her ilin ve dilimin yükseklik/renk/sıralama metriklerini hesapla
  const renderComputed = useMemo(() => {
    const sliceMetricsMap = new Map<string, SliceVisualMetrics>();
    const blockTopElevationByPlate = new Map<number, number>();
    const baseFillColorByPlate = new Map<number, [number, number, number, number]>();
    const totalRankByPlate = new Map<number, number>();
    const filterRankByPlate = new Map<number, number>();
    const filteredMwByPlate = new Map<number, number>();

    if (!provinceSeriesByPlate) {
      return {
        sliceMetricsMap,
        blockTopElevationByPlate,
        baseFillColorByPlate,
        totalRankByPlate,
        filterRankByPlate,
        filteredMwByPlate,
        maxFilteredMw: 0,
        topProvinceName: null as string | null,
        topProvinceMw: 0,
        nationalFilterTotalMw: 0,
      };
    }

    const totalList: { plate: number; name: string; mw: number }[] = [];
    const filterList: { plate: number; name: string; mw: number }[] = [];
    let nationalFilterTotalMw = 0;

    for (const [plate, series] of provinceSeriesByPlate.entries()) {
      const hourSlice = series.hours[selectedHourIndex];
      const totalMw = hourSlice?.totalMw ?? 0;
      totalList.push({ plate, name: series.name, mw: totalMw });

      let filtMw = 0;
      if (hourSlice) {
        for (const src of DEFAULT_SOURCE_ORDER) {
          if (isSourceInFilter(src, activeFilter, sourceLabels)) {
            filtMw += hourSlice.bySource[src] ?? 0;
          }
        }
      }
      filteredMwByPlate.set(plate, filtMw);
      nationalFilterTotalMw += filtMw;
      filterList.push({ plate, name: series.name, mw: filtMw });
    }

    totalList.sort((a, b) => b.mw - a.mw);
    totalList.forEach((item, i) => {
      if (item.mw >= 0.5) totalRankByPlate.set(item.plate, i + 1);
    });

    filterList.sort((a, b) => b.mw - a.mw);
    filterList.forEach((item, i) => {
      if (item.mw >= 0.5) filterRankByPlate.set(item.plate, i + 1);
    });

    const maxFilteredMw = filterList[0]?.mw ?? 0;
    const topProvinceName =
      maxFilteredMw >= 0.5 ? (filterList[0]?.name ?? null) : null;
    const topProvinceMw = maxFilteredMw;

    const elevationPerMw =
      maxFilteredMw > 0 ? MAX_PROVINCE_BLOCK_ELEVATION_M / maxFilteredMw : 0;

    const isSingleSource =
      activeFilter !== "all" &&
      activeFilter !== "renewable" &&
      activeFilter !== "fossil";

    for (const [plate, series] of provinceSeriesByPlate.entries()) {
      const hourSlice = series.hours[selectedHourIndex];
      const filtMw = filteredMwByPlate.get(plate) ?? 0;
      const isHovered = activeProvincePlate === plate;
      const isDimmed =
        activeProvincePlate !== null && activeProvincePlate !== plate;

      const opacityByte = isDimmed
        ? Math.round(OTHER_PROVINCES_DIM_OPACITY * 255)
        : Math.round(ACTIVE_PROVINCE_OPACITY * 255);

      // 2B mod (veya mobil) ve taban katmanı rengi
      if (!is3D) {
        if (filtMw < 0.5) {
          baseFillColorByPlate.set(plate, ZERO_SOURCE_PROVINCE_FILL_RGBA);
        } else if (isSingleSource) {
          const ratio = maxFilteredMw > 0 ? filtMw / maxFilteredMw : 0;
          const [r, g, b] = computeSingleSourceShadeRgb(
            activeFilter as SourceType,
            ratio,
            isHovered
          );
          baseFillColorByPlate.set(plate, [r, g, b, opacityByte]);
        } else {
          // Baskın kaynağı bul
          let dominantSrc: SourceType = "natural_gas";
          let dominantVal = -1;
          if (hourSlice) {
            for (const src of DEFAULT_SOURCE_ORDER) {
              if (!isSourceInFilter(src, activeFilter, sourceLabels)) continue;
              const val = hourSlice.bySource[src] ?? 0;
              if (val > dominantVal) {
                dominantVal = val;
                dominantSrc = src;
              }
            }
          }
          const ratio = maxFilteredMw > 0 ? filtMw / maxFilteredMw : 0;
          const [r, g, b] = computeSingleSourceShadeRgb(
            dominantSrc,
            0.35 + ratio * 0.65,
            isHovered
          );
          baseFillColorByPlate.set(plate, [r, g, b, opacityByte]);
        }
      } else {
        if (filtMw <= 0) {
          baseFillColorByPlate.set(plate, ZERO_SOURCE_PROVINCE_FILL_RGBA);
        } else if (filtMw < LOW_PROVINCE_THRESHOLD_MW) {
          baseFillColorByPlate.set(plate, LOW_PROVINCE_FILL_RGBA);
        } else {
          baseFillColorByPlate.set(plate, PROVINCE_FILL_RGBA);
        }
      }

      // 3B dilimleri: o ildeki en büyük pay en altta, yukarı doğru küçülen paylar
      const sortedSources = [...DEFAULT_SOURCE_ORDER].sort((a, b) => {
        const mwA =
          isSourceInFilter(a, activeFilter, sourceLabels) && hourSlice
            ? (hourSlice.bySource[a] ?? 0)
            : 0;
        const mwB =
          isSourceInFilter(b, activeFilter, sourceLabels) && hourSlice
            ? (hourSlice.bySource[b] ?? 0)
            : 0;
        if (Math.abs(mwB - mwA) > 1e-6) return mwB - mwA;
        return (
          DEFAULT_SOURCE_ORDER.indexOf(a) - DEFAULT_SOURCE_ORDER.indexOf(b)
        );
      });

      const normalBlockHeightM =
        filtMw <= 0
          ? 0
          : filtMw < LOW_PROVINCE_THRESHOLD_MW && activeFilter === "all"
            ? Math.max(LOW_PROVINCE_BASE_ELEVATION_M, filtMw * elevationPerMw)
            : filtMw * elevationPerMw;

      const hoverLiftM =
        is3D && isHovered && filtMw > 0
          ? Math.max(HOVER_MIN_LIFT_M, normalBlockHeightM * HOVER_LIFT_RATIO)
          : 0;

      const heightMult = is3D && isHovered ? HOVER_HEIGHT_MULTIPLIER : 1.0;
      const blockHeightM =
        filtMw > 0.05 ? Math.max(120, normalBlockHeightM * heightMult) : 0;

      const areaTable = provinceMeta.areaLatTableByPlate.get(plate) ?? {
        minLat: 36,
        maxLat: 42,
        cumAreaFractions: new Float64Array([0, 1]),
      };
      const topLatBound = areaTable.maxLat + 0.0008;

      let cumMw = 0;

      for (const src of sortedSources) {
        const inFilter = isSourceInFilter(src, activeFilter, sourceLabels);
        const srcMw = inFilter && hourSlice ? (hourSlice.bySource[src] ?? 0) : 0;

        const rgb = isSingleSource
          ? computeSingleSourceShadeRgb(
              src,
              maxFilteredMw > 0 ? filtMw / maxFilteredMw : 0,
              isHovered
            )
          : computeSliceSourceRgb(src, isHovered);

        if (!is3D || filtMw <= 0.05 || srcMw <= 0.05) {
          const curFrac =
            filtMw > 0.05 ? Math.max(0, Math.min(1, cumMw / filtMw)) : 1;
          const collapseLat =
            curFrac >= 1
              ? topLatBound
              : interpolateLatAtAreaFraction(areaTable, curFrac);
          sliceMetricsMap.set(`${plate}-${src}`, {
            baseElevationM: hoverLiftM,
            sliceElevationM: is3D ? blockHeightM : 0,
            bandLatBounds: [collapseLat, collapseLat],
            fillColor: [rgb[0], rgb[1], rgb[2], opacityByte],
          });
          continue;
        }

        const startFrac = Math.max(0, Math.min(1, cumMw / filtMw));
        cumMw += srcMw;
        const endFrac = Math.max(0, Math.min(1, cumMw / filtMw));

        const startLat = interpolateLatAtAreaFraction(areaTable, startFrac);
        const endLat = interpolateLatAtAreaFraction(areaTable, endFrac);

        sliceMetricsMap.set(`${plate}-${src}`, {
          baseElevationM: hoverLiftM,
          sliceElevationM: blockHeightM,
          bandLatBounds: [startLat, endLat],
          fillColor: [rgb[0], rgb[1], rgb[2], opacityByte],
        });
      }

      blockTopElevationByPlate.set(
        plate,
        is3D && filtMw > 0.05 ? hoverLiftM + blockHeightM : 0
      );
    }

    return {
      sliceMetricsMap,
      blockTopElevationByPlate,
      baseFillColorByPlate,
      totalRankByPlate,
      filterRankByPlate,
      filteredMwByPlate,
      maxFilteredMw,
      topProvinceName,
      topProvinceMw,
      nationalFilterTotalMw,
    };
  }, [
    provinceSeriesByPlate,
    provinceMeta.areaLatTableByPlate,
    selectedHourIndex,
    activeFilter,
    sourceLabels,
    activeProvincePlate,
    is3D,
  ]);

  const handleZoom = useCallback((delta: number) => {
    setViewState((prev) => ({
      ...prev,
      zoom: Math.max(
        prev.minZoom ?? 3.5,
        Math.min(prev.maxZoom ?? 11.5, (prev.zoom ?? 5.4) + delta)
      ),
    }));
  }, []);

  const handleToggle2D3D = useCallback(() => {
    setIs3D((prev3D) => {
      const next3D = !prev3D;
      setViewState((prevView) => ({
        ...prevView,
        pitch: next3D ? DEFAULT_3D_PITCH_DEG : 0,
        bearing: next3D ? DEFAULT_3D_BEARING_DEG : 0,
      }));
      return next3D;
    });
  }, []);

  const handleResetView = useCallback(() => {
    const w = containerRef.current?.clientWidth ?? window.innerWidth;
    const h = containerRef.current?.clientHeight ?? window.innerHeight;
    const default3D = w >= MOBILE_BREAKPOINT_PX;
    setIs3D(default3D);
    setViewState(computeFittedViewState(w, h, default3D));
    setPinnedTarget(null);
    setHoveredTarget(null);
  }, []);

  const resolvePlateFromPickingInfo = useCallback(
    (info: PickingInfo): number | null => {
      if (!info.object) return null;
      if (info.layer?.id === "turkey-province-stacked-blocks-layer") {
        return (info.object as ProvinceSliceInstance).plate;
      }
      if (info.layer?.id === "turkey-provinces-base-layer") {
        return (info.object as ProvinceFeature).properties?.plate ?? null;
      }
      return null;
    },
    []
  );

  const handleDeckHover = useCallback(
    (info: PickingInfo) => {
      if (pinnedTarget) return;
      const plate = resolvePlateFromPickingInfo(info);
      if (
        plate !== null &&
        typeof info.x === "number" &&
        typeof info.y === "number"
      ) {
        setHoveredTarget((prev) => {
          if (
            prev &&
            prev.plate === plate &&
            Math.abs(prev.x - info.x) < 6 &&
            Math.abs(prev.y - info.y) < 6
          ) {
            return prev;
          }
          return { plate, x: info.x, y: info.y };
        });
      } else {
        setHoveredTarget((prev) => (prev === null ? null : null));
      }
    },
    [pinnedTarget, resolvePlateFromPickingInfo]
  );

  const handleDeckClick = useCallback(
    (info: PickingInfo) => {
      const plate = resolvePlateFromPickingInfo(info);
      if (
        plate !== null &&
        typeof info.x === "number" &&
        typeof info.y === "number"
      ) {
        setPinnedTarget((prev) =>
          prev?.plate === plate ? null : { plate, x: info.x, y: info.y }
        );
      } else {
        setPinnedTarget(null);
      }
    },
    [resolvePlateFromPickingInfo]
  );

  // 1. Komşu Ülkeler Katmanı (/geo/neighbors.geojson)
  const neighborsLayer = useMemo(() => {
    if (!neighborsGeoJson) return null;
    return new GeoJsonLayer({
      id: "neighbors-countries-layer",
      data: neighborsGeoJson,
      pickable: false,
      stroked: true,
      filled: true,
      lineWidthUnits: "pixels",
      lineWidthMinPixels: 0.75,
      getFillColor: NEIGHBOR_LAND_FILL_RGBA,
      getLineColor: NEIGHBOR_BORDER_RGBA,
      getLineWidth: 0.75,
    });
  }, [neighborsGeoJson]);

  // 2. Türkiye İl Zemini (#101A2C) ve İl Sınırları (#3A5070, 1 px, opaklık 0,8)
  const provincesBaseLayer = useMemo(() => {
    if (!provincesGeoJson) return null;
    return new GeoJsonLayer<ProvinceFeature["properties"]>({
      id: "turkey-provinces-base-layer",
      data: provincesGeoJson as unknown as GeoJSON.FeatureCollection<
        GeoJSON.Geometry,
        ProvinceFeature["properties"]
      >,
      pickable: true,
      stroked: true,
      filled: true,
      lineWidthUnits: "pixels",
      lineWidthMinPixels: PROVINCE_BORDER_WIDTH_PX,
      getFillColor: (f) => {
        const plate = f.properties?.plate;
        return (
          (plate !== undefined
            ? renderComputed.baseFillColorByPlate.get(plate)
            : undefined) ?? PROVINCE_FILL_RGBA
        );
      },
      getLineColor: PROVINCE_BORDER_RGBA,
      getLineWidth: PROVINCE_BORDER_WIDTH_PX,
      transitions: {
        getFillColor: {
          duration: transitionDurationMs,
          easing: easeCubicOut,
        },
      },
      updateTriggers: {
        getFillColor: [
          selectedHourIndex,
          activeFilter,
          activeProvincePlate,
          is3D,
        ],
      },
    });
  }, [
    provincesGeoJson,
    renderComputed.baseFillColorByPlate,
    selectedHourIndex,
    activeFilter,
    activeProvincePlate,
    is3D,
    transitionDurationMs,
  ]);

  // 3. Kıyı ve Ülke Sınırı (#4A6A90, 1,5 px)
  const coastAndCountryBorderLayer = useMemo(() => {
    if (provinceMeta.outerBorderPaths.length === 0) return null;
    return new PathLayer<[number, number][]>({
      id: "turkey-coast-country-border-layer",
      data: provinceMeta.outerBorderPaths,
      pickable: false,
      widthUnits: "pixels",
      widthMinPixels: COAST_COUNTRY_BORDER_WIDTH_PX,
      capRounded: true,
      jointRounded: true,
      getPath: (d) => d,
      getColor: COAST_COUNTRY_BORDER_RGBA,
      getWidth: COAST_COUNTRY_BORDER_WIDTH_PX,
    });
  }, [provinceMeta.outerBorderPaths]);

  // 4. Üzerine Gelinen / Sabitlenen İlin Sınır Vurgusu (#6B8DB5, 2 px)
  const hoveredProvinceFeature =
    activeProvincePlate !== null
      ? (provinceMeta.featureByPlate.get(activeProvincePlate) ?? null)
      : null;

  const hoveredProvinceBorderLayer = useMemo(() => {
    if (!hoveredProvinceFeature) return null;
    return new GeoJsonLayer<ProvinceFeature["properties"]>({
      id: "turkey-hovered-province-border-layer",
      data: hoveredProvinceFeature as unknown as GeoJSON.Feature<
        GeoJSON.Geometry,
        ProvinceFeature["properties"]
      >,
      pickable: false,
      stroked: true,
      filled: false,
      lineWidthUnits: "pixels",
      lineWidthMinPixels: PROVINCE_HOVER_BORDER_WIDTH_PX,
      getLineColor: PROVINCE_HOVER_BORDER_RGBA,
      getLineWidth: PROVINCE_HOVER_BORDER_WIDTH_PX,
    });
  }, [hoveredProvinceFeature]);

  // 5. Katmanlı 3B İl Blokları (StackedSolidPolygonLayer)
  const stackedBlocksLayer = useMemo(() => {
    if (sliceInstances.length === 0) return null;
    return new StackedSolidPolygonLayer<ProvinceSliceInstance>({
      id: "turkey-province-stacked-blocks-layer",
      data: sliceInstances,
      pickable: is3D,
      extruded: true,
      filled: true,
      wireframe: false,
      material: {
        ambient: 0.52,
        diffuse: 0.55,
        shininess: 28,
        specularColor: [45, 60, 85],
      },
      getPolygon: (d) => d.polygon,
      getBaseElevation: (d) =>
        renderComputed.sliceMetricsMap.get(`${d.plate}-${d.source}`)
          ?.baseElevationM ?? 0,
      getElevation: (d) =>
        renderComputed.sliceMetricsMap.get(`${d.plate}-${d.source}`)
          ?.sliceElevationM ?? 0,
      getBandLatBounds: (d) =>
        renderComputed.sliceMetricsMap.get(`${d.plate}-${d.source}`)
          ?.bandLatBounds ?? [0, 0],
      getFillColor: (d) =>
        renderComputed.sliceMetricsMap.get(`${d.plate}-${d.source}`)
          ?.fillColor ?? [0, 0, 0, 0],
      transitions: {
        getBaseElevation: {
          duration: transitionDurationMs,
          easing: easeCubicOut,
        },
        getElevation: {
          duration: transitionDurationMs,
          easing: easeCubicOut,
        },
        getBandLatBounds: {
          duration: transitionDurationMs,
          easing: easeCubicOut,
        },
        getFillColor: {
          duration: transitionDurationMs,
          easing: easeCubicOut,
        },
      },
      updateTriggers: {
        getBaseElevation: [
          selectedHourIndex,
          activeFilter,
          activeProvincePlate,
          is3D,
        ],
        getElevation: [
          selectedHourIndex,
          activeFilter,
          activeProvincePlate,
          is3D,
        ],
        getBandLatBounds: [
          selectedHourIndex,
          activeFilter,
          activeProvincePlate,
          is3D,
        ],
        getFillColor: [
          selectedHourIndex,
          activeFilter,
          activeProvincePlate,
          is3D,
        ],
      },
    });
  }, [
    sliceInstances,
    is3D,
    renderComputed.sliceMetricsMap,
    selectedHourIndex,
    activeFilter,
    activeProvincePlate,
    transitionDurationMs,
  ]);

  // 6. Her Bloğun Tepesinde İl Adı Etiketi (TextLayer, billboard; uzaktayken en çok üreten 15 il, zoom 7+'da hepsi)
  const isAllLabelsZoom = (viewState.zoom ?? 0) >= PROVINCE_LABEL_ALL_MIN_ZOOM;

  // Aktif filtrede 24 saatlik toplam üretime göre kararlı (stable) il sıralaması:
  // Oynatma sırasında saat değişirken etiketlerin her saniye yer değiştirmesini önler.
  const stableFilterRankByPlate = useMemo(() => {
    const rankMap = new Map<number, number>();
    if (!provinceSeriesByPlate) return rankMap;

    const list: { plate: number; dailySumMw: number }[] = [];
    for (const [plate, series] of provinceSeriesByPlate.entries()) {
      let sum = 0;
      for (let h = 0; h < series.hours.length; h++) {
        const hourSlice = series.hours[h];
        for (const src of DEFAULT_SOURCE_ORDER) {
          if (isSourceInFilter(src, activeFilter, sourceLabels)) {
            sum += hourSlice.bySource[src] ?? 0;
          }
        }
      }
      list.push({ plate, dailySumMw: sum });
    }

    list.sort((a, b) => b.dailySumMw - a.dailySumMw || a.plate - b.plate);
    list.forEach((item, idx) => {
      if (item.dailySumMw >= 1) {
        rankMap.set(item.plate, idx + 1);
      }
    });
    return rankMap;
  }, [provinceSeriesByPlate, activeFilter, sourceLabels]);

  const visiblePlateSet = useMemo(() => {
    const candidates = provinceMeta.labels.filter((item) => {
      if (activeProvincePlate === item.plate) return true;
      if (isAllLabelsZoom) return true;
      const stableRank = stableFilterRankByPlate.get(item.plate);
      const filtMw = renderComputed.filteredMwByPlate.get(item.plate) ?? 0;
      return (
        stableRank !== undefined &&
        stableRank <= PROVINCE_LABEL_TOP_COUNT &&
        filtMw >= 1
      );
    });

    candidates.sort((a, b) => {
      if (a.plate === activeProvincePlate) return -1;
      if (b.plate === activeProvincePlate) return 1;
      const rA = stableFilterRankByPlate.get(a.plate) ?? 999;
      const rB = stableFilterRankByPlate.get(b.plate) ?? 999;
      return rA - rB;
    });

    const acceptedPlates = new Set<number>();

    try {
      const w =
        containerRef.current?.clientWidth ||
        (typeof window !== "undefined" ? window.innerWidth : 1280);
      const h =
        containerRef.current?.clientHeight ||
        (typeof window !== "undefined" ? window.innerHeight : 800);
      const vp = new WebMercatorViewport({
        width: w,
        height: h,
        longitude: viewState.longitude,
        latitude: viewState.latitude,
        zoom: viewState.zoom,
        pitch: viewState.pitch ?? 0,
        bearing: viewState.bearing ?? 0,
      });

      const placedBoxes: { x: number; y: number; halfW: number }[] = [];
      for (const item of candidates) {
        const topZ = is3D
          ? (renderComputed.blockTopElevationByPlate.get(item.plate) ?? 0) +
            PROVINCE_LABEL_ELEVATION_PADDING_M
          : 0;
        const [sx, sy] = vp.project([
          item.position[0],
          item.position[1],
          topZ,
        ]);
        const halfW = item.name.length * 4.4 + 12;

        if (item.plate === activeProvincePlate) {
          placedBoxes.push({ x: sx, y: sy, halfW });
          acceptedPlates.add(item.plate);
          continue;
        }

        const collides = placedBoxes.some(
          (box) =>
            Math.abs(sx - box.x) < halfW + box.halfW &&
            Math.abs(sy - box.y) < 22
        );
        if (!collides) {
          placedBoxes.push({ x: sx, y: sy, halfW });
          acceptedPlates.add(item.plate);
        }
      }
      return acceptedPlates;
    } catch {
      for (const item of candidates) {
        acceptedPlates.add(item.plate);
      }
      return acceptedPlates;
    }
  }, [
    provinceMeta.labels,
    activeProvincePlate,
    isAllLabelsZoom,
    stableFilterRankByPlate,
    renderComputed.filteredMwByPlate,
    renderComputed.blockTopElevationByPlate,
    viewState,
    is3D,
  ]);

  // TextLayer'a her zaman sabit 81 il dizisi (provinceMeta.labels) verilir:
  // deck.gl MultiIconLayer'da değişken uzunluklu dizilerin (data) değişmesi sırasında oluşan
  // karakter tamponu kayması ("Kahramanmaraş" -> "Kahra", "Mersin" -> "Mers") böylece kökten önlenir.
  const provinceLabelsLayer = useMemo(() => {
    if (provinceMeta.labels.length === 0) return null;
    return new TextLayer<ProvinceLabelItem>({
      id: "turkey-province-top-labels-layer",
      data: provinceMeta.labels,
      pickable: false,
      billboard: true,
      characterSet: "auto",
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      fontWeight: 700,
      sizeUnits: "pixels",
      parameters: {
        depthCompare: "always",
      },
      getPosition: (d) => {
        const topZ = is3D
          ? (renderComputed.blockTopElevationByPlate.get(d.plate) ?? 0) +
            PROVINCE_LABEL_ELEVATION_PADDING_M
          : 0;
        return [d.position[0], d.position[1], topZ];
      },
      getText: (d) => d.name,
      getSize: (d) => {
        if (!visiblePlateSet.has(d.plate)) return 0;
        return d.plate === activeProvincePlate
          ? PROVINCE_LABEL_HOVER_FONT_SIZE_PX
          : PROVINCE_LABEL_FONT_SIZE_PX;
      },
      getColor: (d) => {
        if (!visiblePlateSet.has(d.plate)) return [0, 0, 0, 0];
        if (
          activeProvincePlate !== null &&
          d.plate !== activeProvincePlate
        ) {
          return PROVINCE_LABEL_DIM_COLOR_RGBA;
        }
        return PROVINCE_LABEL_COLOR_RGBA;
      },
      getTextAnchor: "middle",
      getAlignmentBaseline: "bottom",
      fontSettings: { sdf: true },
      outlineWidth: 2.5,
      outlineColor: PROVINCE_LABEL_OUTLINE_RGBA,
      transitions: {
        getPosition: {
          duration: transitionDurationMs,
          easing: easeCubicOut,
        },
      },
      updateTriggers: {
        getPosition: [
          selectedHourIndex,
          activeFilter,
          activeProvincePlate,
          is3D,
        ],
        getSize: [visiblePlateSet, activeProvincePlate],
        getColor: [visiblePlateSet, activeProvincePlate],
      },
    });
  }, [
    provinceMeta.labels,
    visiblePlateSet,
    is3D,
    renderComputed.blockTopElevationByPlate,
    activeProvincePlate,
    selectedHourIndex,
    activeFilter,
    transitionDurationMs,
  ]);

  const layers = useMemo(() => {
    const result = [];
    if (neighborsLayer) result.push(neighborsLayer);
    if (provincesBaseLayer) result.push(provincesBaseLayer);
    if (coastAndCountryBorderLayer) result.push(coastAndCountryBorderLayer);
    if (hoveredProvinceBorderLayer) result.push(hoveredProvinceBorderLayer);
    if (stackedBlocksLayer) result.push(stackedBlocksLayer);
    if (provinceLabelsLayer) result.push(provinceLabelsLayer);
    return result;
  }, [
    neighborsLayer,
    provincesBaseLayer,
    coastAndCountryBorderLayer,
    hoveredProvinceBorderLayer,
    stackedBlocksLayer,
    provinceLabelsLayer,
  ]);

  // Yüzen il paneli için seçili ilin verisi
  const activeProvinceSeries =
    activeProvincePlate !== null && provinceSeriesByPlate
      ? (provinceSeriesByPlate.get(activeProvincePlate) ?? null)
      : null;
  const activeProvinceHourSlice: ProvinceHourlySlice | null =
    activeProvinceSeries?.hours[selectedHourIndex] ?? null;

  const selectedHourParts = selectedHourTimestamp
    ? formatTimestampParts(selectedHourTimestamp)
    : null;

  // Aktif filtre bilgisi (paneldeki "Ölçek: ..." notu ve il panelindeki filtre özeti için)
  const filterMeta = useMemo(() => {
    if (activeFilter === "all") {
      return {
        label: "Toplam Üretim",
        colorHex: "#38BDF8",
      };
    }
    if (activeFilter === "renewable") {
      return {
        label: "Yenilenebilir",
        colorHex: "#10B981",
      };
    }
    if (activeFilter === "fossil") {
      return {
        label: "Fosil",
        colorHex: "#FB923C",
      };
    }
    return {
      label:
        sourceLabels?.sources[activeFilter]?.label ??
        SOURCE_PALETTE[activeFilter].fallbackLabel,
      colorHex: SOURCE_PALETTE[activeFilter].hex,
    };
  }, [activeFilter, sourceLabels]);

  const activeFilterRankInfo = useMemo<FilterProvinceRankInfo | null>(() => {
    if (activeProvincePlate === null || activeFilter === "all") return null;
    const provinceFilterMw =
      renderComputed.filteredMwByPlate.get(activeProvincePlate) ?? 0;
    const nationalFilterSharePct =
      renderComputed.nationalFilterTotalMw > 0
        ? (provinceFilterMw / renderComputed.nationalFilterTotalMw) * 100
        : 0;
    const provinceFilterRank =
      renderComputed.filterRankByPlate.get(activeProvincePlate) ?? null;

    return {
      filterLabel: filterMeta.label,
      filterColorHex: filterMeta.colorHex,
      provinceFilterMw,
      nationalFilterSharePct,
      provinceFilterRank,
    };
  }, [
    activeProvincePlate,
    activeFilter,
    renderComputed.filteredMwByPlate,
    renderComputed.nationalFilterTotalMw,
    renderComputed.filterRankByPlate,
    filterMeta,
  ]);

  const izmirScreenAttr = useMemo(() => {
    const centroid = provinceMeta.centroidByPlate.get(35);
    if (!centroid) return undefined;
    try {
      const w =
        containerRef.current?.clientWidth ||
        (typeof window !== "undefined" ? window.innerWidth : 1280);
      const h =
        containerRef.current?.clientHeight ||
        (typeof window !== "undefined" ? window.innerHeight : 800);
      const vp = new WebMercatorViewport({
        width: w,
        height: h,
        longitude: viewState.longitude,
        latitude: viewState.latitude,
        zoom: viewState.zoom,
        pitch: viewState.pitch ?? 0,
        bearing: viewState.bearing ?? 0,
      });
      const izmirTopZ = renderComputed.blockTopElevationByPlate.get(35) ?? 30000;
      const [sx, sy] = vp.project([
        centroid[0],
        centroid[1],
        izmirTopZ * 0.65,
      ]);
      return `${Math.round(sx)},${Math.round(sy)}`;
    } catch {
      return undefined;
    }
  }, [
    provinceMeta.centroidByPlate,
    renderComputed.blockTopElevationByPlate,
    viewState,
  ]);

  return (
    <main
      ref={containerRef}
      data-izmir-screen={izmirScreenAttr}
      aria-label="Türkiye il düzeyinde katmanlı enerji üretimi haritası"
      onContextMenu={(e) => e.preventDefault()}
      onMouseLeave={() => {
        if (!pinnedTarget) setHoveredTarget(null);
      }}
      style={{ backgroundColor: SEA_BACKGROUND_HEX }}
      className="fixed inset-0 h-dvh w-screen overflow-hidden select-none"
    >
      {loading && (
        <div
          role="status"
          aria-live="polite"
          style={{ backgroundColor: `${SEA_BACKGROUND_HEX}E6` }}
          className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 backdrop-blur-sm"
        >
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-[#38BDF8]" />
          <p className="font-mono-data text-xs text-[#94A3B8]">
            İl bazında enerji üretim blokları hazırlanıyor…
          </p>
        </div>
      )}

      {!loading && !provincesGeoJson && (
        <div
          role="status"
          style={{ backgroundColor: SEA_BACKGROUND_HEX }}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 p-6 text-center"
        >
          <AlertTriangle
            className="h-8 w-8 text-[#F59E0B]"
            aria-hidden="true"
          />
          <p className="font-display text-base font-semibold text-[#F8FAFC]">
            Harita verisi bulunamadı
          </p>
          <p className="max-w-md text-xs text-[#94A3B8]">
            İl sınırları veya üretim verisi şu anda görüntülenemiyor.
          </p>
        </div>
      )}

      <DeckGL
        views={new MapView({ id: "turkey-map", repeat: false })}
        viewState={viewState}
        onViewStateChange={({ viewState: nextViewState }) => {
          setViewState(nextViewState as MapViewState);
        }}
        onHover={handleDeckHover}
        onClick={handleDeckClick}
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

      {/* Sağ Alt Harita Kontrolleri: 2D / 3D Geçişi + Yakınlaştırma + Sıfırlama */}
      <div
        aria-label="Harita görünüm ve yakınlaştırma kontrolleri"
        className="pointer-events-auto fixed right-2.5 bottom-24 z-20 flex flex-col gap-1.5 md:right-4 md:bottom-4"
      >
        <button
          type="button"
          onClick={handleToggle2D3D}
          aria-pressed={is3D}
          aria-label={
            is3D ? "2B düz harita görünümüne geç" : "3B blok görünümüne geç (50°)"
          }
          title={
            is3D
              ? "3D blok görünümü aktif (50° eğim). 2D için tıkla."
              : "2D düz görünüm aktif. 3D bloklar için tıkla."
          }
          className={`flex h-10 w-10 flex-col items-center justify-center rounded-xl border font-mono-data text-[10px] font-bold shadow-xl backdrop-blur-xl transition-all focus-visible:outline-2 focus-visible:outline-[#38BDF8] md:h-11 md:w-11 ${
            is3D
              ? "border-[#38BDF8]/60 bg-[#0A1324]/95 text-[#38BDF8]"
              : "border-white/12 bg-[#060B14]/82 text-[#94A3B8] hover:border-white/25 hover:bg-[#0D1628]/90 hover:text-[#F8FAFC]"
          }`}
        >
          {is3D ? (
            <Box className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span className="mt-0.5 leading-none">{is3D ? "3D" : "2D"}</span>
        </button>

        <button
          type="button"
          onClick={() => handleZoom(0.65)}
          aria-label="Haritayı yakınlaştır"
          title="Yakınlaştır"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/12 bg-[#060B14]/82 text-[#F8FAFC] shadow-xl backdrop-blur-xl transition-colors hover:border-white/25 hover:bg-[#0D1628]/90 focus-visible:outline-2 focus-visible:outline-[#38BDF8] md:h-11 md:w-11"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => handleZoom(-0.65)}
          aria-label="Haritayı uzaklaştır"
          title="Uzaklaştır"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/12 bg-[#060B14]/82 text-[#F8FAFC] shadow-xl backdrop-blur-xl transition-colors hover:border-white/25 hover:bg-[#0D1628]/90 focus-visible:outline-2 focus-visible:outline-[#38BDF8] md:h-11 md:w-11"
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={handleResetView}
          aria-label="Harita görünümünü sıfırla"
          title="Türkiye görünümünü sıfırla"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/12 bg-[#060B14]/82 text-[#94A3B8] shadow-xl backdrop-blur-xl transition-colors hover:border-white/25 hover:bg-[#0D1628]/90 hover:text-[#F8FAFC] focus-visible:outline-2 focus-visible:outline-[#38BDF8] md:h-11 md:w-11"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Üzerine Gelince / Tıklayınca Açılan Yüzen İl Paneli */}
      {activeTarget && activeProvinceSeries && activeProvinceHourSlice && (
        <ProvinceFloatingPanel
          plate={activeProvinceSeries.plate}
          provinceName={activeProvinceSeries.name}
          hourSlice={activeProvinceHourSlice}
          totalRankInTurkey={
            renderComputed.totalRankByPlate.get(activeProvinceSeries.plate) ??
            null
          }
          hourLabel={selectedHourParts?.hour ?? "23:00"}
          sourceLabels={sourceLabels}
          activeFilter={activeFilter}
          filterRankInfo={activeFilterRankInfo}
          screenX={activeTarget.x}
          screenY={activeTarget.y}
          containerWidth={containerRef.current?.clientWidth ?? 1280}
          containerHeight={containerRef.current?.clientHeight ?? 800}
          isPinned={pinnedTarget !== null}
          onClose={() => {
            setPinnedTarget(null);
            setHoveredTarget(null);
          }}
        />
      )}
    </main>
  );
});
