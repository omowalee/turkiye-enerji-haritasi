import type {
  Generation24H,
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

export interface LocatedPlantPoint {
  id: number;
  name: string;
  source: SourceType;
  sourceLabel: string;
  lat: number;
  lon: number;
  province: number | null;
  capacityMw: number | null;
  lastHourMw: number;
  dailyTotalMwh: number;
}

export interface DashboardInitialData {
  snapshot: SnapshotLatest;
  sourceLabels: SourceLabels;
  provincesGeoJson: Provinces;
  locatedPlants: LocatedPlantPoint[];
  totalPlantsInCatalog: number;
  lastHourTimestamp: string;
}

async function fetchJson<T>(fileName: string, signal?: AbortSignal): Promise<T> {
  const url = `${DATA_BASE_URL}/${fileName}`;
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`${fileName} yüklenemedi (HTTP ${response.status})`);
  }
  return (await response.json()) as T;
}

/**
 * Sürüm 1 ilk adım için gerekli veri dosyalarını paralel yükler ve
 * koordinatı bilinen santralleri son saat üretimleriyle birleştirir.
 */
export async function loadDashboardData(
  signal?: AbortSignal
): Promise<DashboardInitialData> {
  const [snapshot, sourceLabels, provincesGeoJson, plantsData, generation24h] =
    await Promise.all([
      fetchJson<SnapshotLatest>("snapshot_latest.json", signal),
      fetchJson<SourceLabels>("source_labels.json", signal),
      fetchJson<Provinces>("provinces.geojson", signal),
      fetchJson<Plants>("plants.json", signal),
      fetchJson<Generation24H>("generation_24h.json", signal),
    ]);

  const lastHourIndex = generation24h.hours.length - 1;
  const lastHourTimestamp =
    generation24h.hours[lastHourIndex] ?? snapshot.plants_day.last_hour_ts;

  // plant_id -> { lastHourMw, dailyTotalMwh } hızlı arama tablosu
  const generationByPlantId = new Map<
    number,
    { lastHourMw: number; dailyTotalMwh: number }
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
    generationByPlantId.set(plantId, { lastHourMw, dailyTotalMwh });
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
      lastHourMw: gen?.lastHourMw ?? 0,
      dailyTotalMwh: gen?.dailyTotalMwh ?? 0,
    });
  }

  // Büyük santrallerin altında küçüklerin kaybolmaması ama çizim sırasının tutarlı olması için:
  // Önce yüksek üretimli noktalar altta, küçükler üstte çizilsin (hover kolaylığı için)
  locatedPlants.sort((a, b) => b.lastHourMw - a.lastHourMw);

  return {
    snapshot,
    sourceLabels: {
      ...sourceLabels,
      order:
        sourceLabels.order?.length > 0
          ? sourceLabels.order
          : DEFAULT_SOURCE_ORDER,
    },
    provincesGeoJson,
    locatedPlants,
    totalPlantsInCatalog: plantsData.plants.length,
    lastHourTimestamp,
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
