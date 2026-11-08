import type {
  Generation24H,
  Mix24H,
  Plant,
  Plants,
  Provinces,
  SnapshotLatest,
  SourceLabels,
  SourceType,
} from "@/types";
import { DEFAULT_SOURCE_ORDER, SOURCE_PALETTE } from "./constants";

/**
 * Tek veri yükleme noktası.
 * İleride gerçek veri yoluna (/data/*.json) geçildiğinde yalnızca bu sabit değişir.
 */
export const DATA_BASE_URL = "/data/sample";

export type DashboardMode = "live" | "playback";
export type PlaybackSpeed = 1 | 2 | 4;

export interface SourceCounterItem {
  mw: number;
  akkuyu: number;
}

export interface HourlyCounterSnapshot {
  ts: string;
  totalMw: number;
  renewableSharePct: number;
  ptfTlMwh: number | null;
  bySource: Record<SourceType, SourceCounterItem>;
}

export interface LocatedPlantPoint {
  id: number;
  name: string;
  source: SourceType;
  sourceLabel: string;
  lat: number;
  lon: number;
  province: number | null;
  capacityMw: number | null;
  /** 24 saatlik üretim dizisi (generation_24h.hours ile aynı sırada, MW) */
  hourlyMw: readonly number[];
  lastHourMw: number;
  dailyTotalMwh: number;
}

export interface DashboardInitialData {
  snapshot: SnapshotLatest;
  sourceLabels: SourceLabels;
  mix24h: Mix24H;
  provincesGeoJson: Provinces;
  locatedPlants: LocatedPlantPoint[];
  totalPlantsInCatalog: number;
  /** generation_24h.hours (24 adet ISO zaman damgası) */
  hours: string[];
  /** Varsayılan seçili saat indeksi (son saat: 23) */
  defaultHourIndex: number;
  lastHourTimestamp: string;
  /** Canlı mod için hazır sayaç özeti (snapshot_latest.live) */
  liveCounter: HourlyCounterSnapshot;
  /** Oynatma modu için 24 saatin önceden hesaplanmış sayaç özetleri (mix_24h.plants_day) */
  playbackHours: HourlyCounterSnapshot[];
}

const ZERO_HOURLY_MW: readonly number[] = Object.freeze(
  new Array<number>(24).fill(0)
);

async function fetchJson<T>(
  fileName: string,
  signal?: AbortSignal
): Promise<T> {
  const url = `${DATA_BASE_URL}/${fileName}`;
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`${fileName} yüklenemedi (HTTP ${response.status})`);
  }
  return (await response.json()) as T;
}

function buildEmptySourceMap(): Record<SourceType, SourceCounterItem> {
  const map = {} as Record<SourceType, SourceCounterItem>;
  for (const key of DEFAULT_SOURCE_ORDER) {
    map[key] = { mw: 0, akkuyu: 0 };
  }
  return map;
}

/**
 * Sürüm 1 için gerekli veri dosyalarını paralel yükler,
 * koordinatı bilinen santralleri 24 saatlik üretimleriyle birleştirir
 * ve hem canlı hem oynatma modu sayaçlarını önceden hazırlar.
 */
export async function loadDashboardData(
  signal?: AbortSignal
): Promise<DashboardInitialData> {
  const [
    snapshot,
    sourceLabelsRaw,
    mix24h,
    provincesGeoJson,
    plantsData,
    generation24h,
  ] = await Promise.all([
    fetchJson<SnapshotLatest>("snapshot_latest.json", signal),
    fetchJson<SourceLabels>("source_labels.json", signal),
    fetchJson<Mix24H>("mix_24h.json", signal),
    fetchJson<Provinces>("provinces.geojson", signal),
    fetchJson<Plants>("plants.json", signal),
    fetchJson<Generation24H>("generation_24h.json", signal),
  ]);

  const sourceOrder =
    sourceLabelsRaw.order?.length > 0
      ? sourceLabelsRaw.order
      : DEFAULT_SOURCE_ORDER;

  const sourceLabels: SourceLabels = {
    ...sourceLabelsRaw,
    order: sourceOrder,
  };

  const akkuyuUnitMw = snapshot.akkuyu_unit_mw || 1200;
  const lastHourIndex = Math.max(0, generation24h.hours.length - 1);
  const lastHourTimestamp =
    generation24h.hours[lastHourIndex] ?? snapshot.plants_day.last_hour_ts;

  // 1. Canlı mod sayaç verisi (snapshot_latest.live bloğundan; live.provisional kullanılmaz)
  const liveBySource = buildEmptySourceMap();
  for (const key of sourceOrder) {
    const item = snapshot.live.by_source[key];
    const mw = item?.mw ?? 0;
    const akkuyu = item?.akkuyu ?? mw / akkuyuUnitMw;
    liveBySource[key] = { mw, akkuyu };
  }

  const liveCounter: HourlyCounterSnapshot = {
    ts: snapshot.live.ts,
    totalMw: snapshot.live.total_mw,
    renewableSharePct: snapshot.live.renewable_share_pct,
    ptfTlMwh: snapshot.live.ptf_tl_mwh,
    bySource: liveBySource,
  };

  // 2. Oynatma modu için 24 saatin sayaç verileri (mix_24h.plants_day bloğundan)
  const playbackHours: HourlyCounterSnapshot[] = mix24h.plants_day.hours.map(
    (hourTs, hourIdx) => {
      const bySource = buildEmptySourceMap();
      let totalMw = 0;
      let renewableMw = 0;

      for (const key of sourceOrder) {
        const series = mix24h.plants_day.mw[key];
        const mw = series?.[hourIdx] ?? 0;
        const akkuyu = mw / akkuyuUnitMw;
        bySource[key] = { mw, akkuyu };
        totalMw += mw;

        const isRenewable =
          sourceLabels.sources[key]?.renewable ?? SOURCE_PALETTE[key].renewable;
        if (isRenewable) {
          renewableMw += mw;
        }
      }

      const renewableSharePct = totalMw > 0 ? (renewableMw / totalMw) * 100 : 0;
      const ptfTlMwh = mix24h.plants_day.ptf_tl_mwh[hourIdx] ?? null;

      return {
        ts: hourTs,
        totalMw,
        renewableSharePct,
        ptfTlMwh,
        bySource,
      };
    }
  );

  // 3. plant_id -> { hourlyMw, lastHourMw, dailyTotalMwh } hızlı arama tablosu
  const generationByPlantId = new Map<
    number,
    {
      hourlyMw: readonly number[];
      lastHourMw: number;
      dailyTotalMwh: number;
    }
  >();

  for (let i = 0; i < generation24h.plant_ids.length; i++) {
    const plantId = generation24h.plant_ids[i];
    const series = generation24h.mw[i];
    if (!series) continue;
    const lastHourMw = series[lastHourIndex] ?? 0;
    let dailyTotalMwh = 0;
    for (let h = 0; h < series.length; h++) {
      dailyTotalMwh += series[h] ?? 0;
    }
    generationByPlantId.set(plantId, {
      hourlyMw: series,
      lastHourMw,
      dailyTotalMwh,
    });
  }

  const locatedPlants: LocatedPlantPoint[] = [];

  for (const plant of plantsData.plants) {
    if (!isLocatedPlant(plant)) continue;
    const gen = generationByPlantId.get(plant.id);
    const label =
      sourceLabels.sources[plant.source]?.label ??
      SOURCE_PALETTE[plant.source].fallbackLabel;

    locatedPlants.push({
      id: plant.id,
      name: plant.name,
      source: plant.source,
      sourceLabel: label,
      lat: plant.lat,
      lon: plant.lon,
      province: plant.province,
      capacityMw: plant.capacity_mw,
      hourlyMw: gen?.hourlyMw ?? ZERO_HOURLY_MW,
      lastHourMw: gen?.lastHourMw ?? 0,
      dailyTotalMwh: gen?.dailyTotalMwh ?? 0,
    });
  }

  // Büyük santrallerin altında küçüklerin kaybolmaması ama çizim sırasının tutarlı olması için:
  // Önce yüksek üretimli noktalar altta, küçükler üstte çizilsin
  locatedPlants.sort((a, b) => b.lastHourMw - a.lastHourMw);

  return {
    snapshot,
    sourceLabels,
    mix24h,
    provincesGeoJson,
    locatedPlants,
    totalPlantsInCatalog: plantsData.plants.length,
    hours: generation24h.hours,
    defaultHourIndex: lastHourIndex,
    lastHourTimestamp,
    liveCounter,
    playbackHours,
  };
}

function isLocatedPlant(
  plant: Plant
): plant is Plant & { lat: number; lon: number } {
  return (
    typeof plant.lat === "number" &&
    typeof plant.lon === "number" &&
    Number.isFinite(plant.lat) &&
    Number.isFinite(plant.lon)
  );
}
