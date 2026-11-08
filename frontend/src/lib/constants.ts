import type { SourceType } from "@/types";

export interface SourcePaletteItem {
  hex: string;
  rgb: [number, number, number];
  fallbackLabel: string;
  renewable: boolean;
}

/**
 * docs/tasarim-onerisi.md içinde onaylanan 11 kaynak rengi.
 * Gösterim sırası contracts/source_labels.json dosyasından gelir.
 */
export const SOURCE_PALETTE: Record<SourceType, SourcePaletteItem> = {
  solar: {
    hex: "#FACC15",
    rgb: [250, 204, 21],
    fallbackLabel: "Güneş",
    renewable: true,
  },
  wind: {
    hex: "#22D3EE",
    rgb: [34, 211, 238],
    fallbackLabel: "Rüzgâr",
    renewable: true,
  },
  hydro_dam: {
    hex: "#3B82F6",
    rgb: [59, 130, 246],
    fallbackLabel: "Hidro (barajlı)",
    renewable: true,
  },
  hydro_river: {
    hex: "#93C5FD",
    rgb: [147, 197, 253],
    fallbackLabel: "Hidro (akarsu)",
    renewable: true,
  },
  geothermal: {
    hex: "#F43F5E",
    rgb: [244, 63, 94],
    fallbackLabel: "Jeotermal",
    renewable: true,
  },
  biomass: {
    hex: "#4ADE80",
    rgb: [74, 222, 128],
    fallbackLabel: "Biyokütle",
    renewable: true,
  },
  natural_gas: {
    hex: "#F97316",
    rgb: [249, 115, 22],
    fallbackLabel: "Doğalgaz",
    renewable: false,
  },
  imported_coal: {
    hex: "#CBD5E1",
    rgb: [203, 213, 225],
    fallbackLabel: "İthal kömür",
    renewable: false,
  },
  lignite: {
    hex: "#A8A29E",
    rgb: [168, 162, 158],
    fallbackLabel: "Linyit ve yerli kömür",
    renewable: false,
  },
  nuclear: {
    hex: "#A855F7",
    rgb: [168, 85, 247],
    fallbackLabel: "Nükleer",
    renewable: false,
  },
  other: {
    hex: "#D4A373",
    rgb: [212, 163, 115],
    fallbackLabel: "Diğer",
    renewable: false,
  },
};

export const DEFAULT_SOURCE_ORDER: SourceType[] = [
  "solar",
  "wind",
  "hydro_dam",
  "hydro_river",
  "geothermal",
  "biomass",
  "natural_gas",
  "imported_coal",
  "lignite",
  "nuclear",
  "other",
];
