import type {
  Generation24H,
  Mix24H,
  Plant,
  Plants,
  Provinces,
  Provinces24H,
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
  consumptionMw: number | null;
  netImportMw: number | null;
  balanceMw: number | null;
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

export interface ProvinceHourlySlice {
  totalMw: number;
  renewableMw: number;
  fossilMw: number;
  renewableSharePct: number;
  bySource: Record<SourceType, number>;
}

export interface Province24hSeries {
  plate: number;
  name: string;
  plantCount: number;
  dailyTotalMwh: number;
  dailyRank: number | null;
  dailySharePct: number;
  /** 24 saatlik il bazında kaynak dağılımı (provinces_24h.json + santral saatlik kırılımı) */
  hours: readonly ProvinceHourlySlice[];
}

export interface DashboardInitialData {
  snapshot: SnapshotLatest;
  sourceLabels: SourceLabels;
  mix24h: Mix24H;
  provincesGeoJson: Provinces;
  provinces24h: Provinces24H;
  provinceSeriesByPlate: ReadonlyMap<number, Province24hSeries>;
  neighborsGeoJson: GeoJSON.FeatureCollection | null;
  locatedPlants: LocatedPlantPoint[];
  totalPlantsInCatalog: number;
  /** generation_24h.hours (24 adet ISO zaman damgası) */
  hours: string[];
  /** Varsayılan seçili saat indeksi (son saat: 23) */
  defaultHourIndex: number;
  lastHourTimestamp: string;
  /** Canlı mod için hazır sayaç özeti (snapshot_latest.live) */
  liveCounter: HourlyCounterSnapshot;
  /** Canlı mod 24 saatlik kaynak ve tüketim serisi (mix_24h.live) */
  liveHours: HourlyCounterSnapshot[];
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

function buildEmptySourceMwMap(): Record<SourceType, number> {
  const map = {} as Record<SourceType, number>;
  for (const key of DEFAULT_SOURCE_ORDER) {
    map[key] = 0;
  }
  return map;
}

/**
 * Sürüm 1 için gerekli veri dosyalarını paralel yükler,
 * provinces_24h.json ile saatlik il×kaynak üretim matrisini hazırlar
 * ve hem canlı hem oynatma modu sayaçlarını önceden hesaplar.
 */
export async function loadDashboardData(
  signal?: AbortSignal
): Promise<DashboardInitialData> {
  const [
    snapshot,
    sourceLabelsRaw,
    mix24h,
    provincesGeoJson,
    provinces24h,
    plantsData,
    generation24h,
    neighborsGeoJson,
  ] = await Promise.all([
    fetchJson<SnapshotLatest>("snapshot_latest.json", signal),
    fetchJson<SourceLabels>("source_labels.json", signal),
    fetchJson<Mix24H>("mix_24h.json", signal),
    fetchJson<Provinces>("provinces.geojson", signal),
    fetchJson<Provinces24H>("provinces_24h.json", signal),
    fetchJson<Plants>("plants.json", signal),
    fetchJson<Generation24H>("generation_24h.json", signal),
    fetch("/geo/neighbors.geojson", { signal })
      .then((res) =>
        res.ok ? (res.json() as Promise<GeoJSON.FeatureCollection>) : null
      )
      .catch(() => null),
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
  const hourCount = generation24h.hours.length || 24;
  const lastHourIndex = Math.max(0, hourCount - 1);
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

  const liveConsumptionMw = snapshot.live.consumption_mw ?? null;
  const liveNetImportMw = snapshot.live.net_import_mw ?? null;
  const liveBalanceMw =
    snapshot.live.balance_mw !== undefined
      ? snapshot.live.balance_mw
      : liveConsumptionMw !== null
        ? snapshot.live.total_mw - liveConsumptionMw
        : null;

  const liveCounter: HourlyCounterSnapshot = {
    ts: snapshot.live.ts,
    totalMw: snapshot.live.total_mw,
    consumptionMw: liveConsumptionMw,
    netImportMw: liveNetImportMw,
    balanceMw: liveBalanceMw,
    renewableSharePct: snapshot.live.renewable_share_pct,
    ptfTlMwh: snapshot.live.ptf_tl_mwh,
    bySource: liveBySource,
  };

  const buildHourlyCounterSeries = (
    block: Mix24H["live"] | Mix24H["plants_day"]
  ): HourlyCounterSnapshot[] => {
    return block.hours.map((hourTs, hourIdx) => {
      const bySource = buildEmptySourceMap();
      let totalMw = 0;
      let renewableMw = 0;

      for (const key of sourceOrder) {
        const series = block.mw[key];
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
      const ptfTlMwh = block.ptf_tl_mwh[hourIdx] ?? null;
      const consumptionMw = block.consumption_mw?.[hourIdx] ?? null;
      const netImportMw = block.net_import_mw?.[hourIdx] ?? null;
      const rawBalance = block.balance_mw?.[hourIdx];
      const balanceMw =
        rawBalance !== undefined
          ? rawBalance
          : consumptionMw !== null
            ? totalMw - consumptionMw
            : null;

      return {
        ts: hourTs,
        totalMw,
        consumptionMw,
        netImportMw,
        balanceMw,
        renewableSharePct,
        ptfTlMwh,
        bySource,
      };
    });
  };

  // 2. Canlı mod 24 saatlik seri (mix_24h.live) ve oynatma modu 24 saatlik seri (mix_24h.plants_day)
  const liveHours: HourlyCounterSnapshot[] = buildHourlyCounterSeries(
    mix24h.live
  );
  const playbackHours: HourlyCounterSnapshot[] = buildHourlyCounterSeries(
    mix24h.plants_day
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

  // 4. İle atanmış santrallerden saatlik il × kaynak üretim toplamları (plate -> source -> number[24])
  const rawPlantHourlyByProvince = new Map<
    number,
    Record<SourceType, number[]>
  >();

  const locatedPlants: LocatedPlantPoint[] = [];

  for (const plant of plantsData.plants) {
    const gen = generationByPlantId.get(plant.id);
    const hourlySeries = gen?.hourlyMw ?? ZERO_HOURLY_MW;

    if (typeof plant.province === "number") {
      let provMap = rawPlantHourlyByProvince.get(plant.province);
      if (!provMap) {
        provMap = {} as Record<SourceType, number[]>;
        for (const key of DEFAULT_SOURCE_ORDER) {
          provMap[key] = new Array<number>(hourCount).fill(0);
        }
        rawPlantHourlyByProvince.set(plant.province, provMap);
      }
      const targetArr = provMap[plant.source];
      for (let h = 0; h < hourCount; h++) {
        targetArr[h] += hourlySeries[h] ?? 0;
      }
    }

    if (!isLocatedPlant(plant)) continue;
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
      hourlyMw: hourlySeries,
      lastHourMw: gen?.lastHourMw ?? 0,
      dailyTotalMwh: gen?.dailyTotalMwh ?? 0,
    });
  }

  locatedPlants.sort((a, b) => b.lastHourMw - a.lastHourMw);

  // 5. 81 il için provinces_24h.json tabanlı saatlik kaynak dağılımı serilerini oluştur
  const provinceDayByPlate = new Map(
    provinces24h.provinces.map((p) => [p.plate, p])
  );
  const provinceSeriesByPlate = new Map<number, Province24hSeries>();

  for (const feature of provincesGeoJson.features) {
    const plate = feature.properties.plate;
    const name = feature.properties.name;
    const provDay = provinceDayByPlate.get(plate);
    const rawHourly = rawPlantHourlyByProvince.get(plate);

    const hoursList: ProvinceHourlySlice[] = [];

    for (let h = 0; h < hourCount; h++) {
      const bySource = buildEmptySourceMwMap();
      const targetTotalMw = provDay ? (provDay.mw[h] ?? 0) : 0;

      let rawSum = 0;
      if (rawHourly) {
        for (const key of sourceOrder) {
          rawSum += rawHourly[key][h] ?? 0;
        }
      }

      if (rawHourly && rawSum > 0) {
        const scale = targetTotalMw > 0 ? targetTotalMw / rawSum : 1;
        for (const key of sourceOrder) {
          bySource[key] = (rawHourly[key][h] ?? 0) * scale;
        }
      } else if (provDay && targetTotalMw > 0 && provDay.total_mwh > 0) {
        for (const key of sourceOrder) {
          const srcMwh = provDay.mwh_by_source[key] ?? 0;
          bySource[key] = targetTotalMw * (srcMwh / provDay.total_mwh);
        }
      }

      let totalMw = 0;
      let renewableMw = 0;
      let fossilMw = 0;

      for (const key of sourceOrder) {
        const val = bySource[key];
        totalMw += val;
        const isRen =
          sourceLabels.sources[key]?.renewable ?? SOURCE_PALETTE[key].renewable;
        if (isRen) {
          renewableMw += val;
        } else {
          fossilMw += val;
        }
      }

      const renewableSharePct = totalMw > 0 ? (renewableMw / totalMw) * 100 : 0;
      hoursList.push({
        totalMw,
        renewableMw,
        fossilMw,
        renewableSharePct,
        bySource,
      });
    }

    provinceSeriesByPlate.set(plate, {
      plate,
      name: provDay?.name ?? name,
      plantCount: provDay?.plant_count ?? 0,
      dailyTotalMwh: provDay?.total_mwh ?? 0,
      dailyRank: provDay?.rank ?? null,
      dailySharePct: provDay?.share_pct ?? 0,
      hours: hoursList,
    });
  }

  return {
    snapshot,
    sourceLabels,
    mix24h,
    provincesGeoJson,
    provinces24h,
    provinceSeriesByPlate,
    neighborsGeoJson,
    locatedPlants,
    totalPlantsInCatalog: plantsData.plants.length,
    hours: generation24h.hours,
    defaultHourIndex: lastHourIndex,
    lastHourTimestamp,
    liveCounter,
    liveHours,
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
