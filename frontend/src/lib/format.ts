const intFormatter = new Intl.NumberFormat("tr-TR", {
  maximumFractionDigits: 0,
});

const oneDecimalFormatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const twoDecimalFormatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const ptfFormatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Örnek: 22674 -> "22.674"
 */
export function formatNumber(value: number): string {
  return intFormatter.format(Math.round(value));
}

/**
 * Örnek: 22674 -> "22.674 MW"
 */
export function formatMw(value: number): string {
  return `${intFormatter.format(Math.round(value))} MW`;
}

/**
 * İşaretli MW biçimi (denge = lisanslı üretim − tüketim için).
 * Örnek: 429 -> "+429 MW", -9304 -> "-9.304 MW"
 */
export function formatSignedMw(value: number): string {
  const rounded = Math.round(value);
  if (rounded > 0) {
    return `+${intFormatter.format(rounded)} MW`;
  }
  if (rounded < 0) {
    return `-${intFormatter.format(Math.abs(rounded))} MW`;
  }
  return "0 MW";
}

/**
 * Net dış ticaret cümlesi (+ = net ithalat, - = net ihracat, ±10 MW arası dengede).
 * Örnek: -990 -> "Türkiye şu an 990 MW net ihracat yapıyor"
 */
export function formatNetTrade(
  netImportMw: number | null | undefined
): string | null {
  if (
    netImportMw === null ||
    netImportMw === undefined ||
    Number.isNaN(netImportMw)
  ) {
    return null;
  }
  const rounded = Math.round(netImportMw);
  if (Math.abs(rounded) <= 10) {
    return "Dış ticaret dengede";
  }
  const absFormatted = intFormatter.format(Math.abs(rounded));
  if (rounded < 0) {
    return `Türkiye şu an ${absFormatted} MW net ihracat yapıyor`;
  }
  return `Türkiye şu an ${absFormatted} MW net ithalat yapıyor`;
}

/**
 * Örnek: 59.6 -> "%59,6"
 */
export function formatPercent(value: number): string {
  return `%${oneDecimalFormatter.format(value)}`;
}

/**
 * Örnek: 3.69 -> "3,69 Akkuyu"
 */
export function formatAkkuyu(value: number): string {
  return `${twoDecimalFormatter.format(value)} Akkuyu`;
}

/**
 * Örnek: 171.0 -> "171,00 TL/MWh" veya kuruşsuzsa 1 ondalık
 */
export function formatPtf(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }
  const hasCents = Math.round(value * 100) % 10 !== 0;
  return `${hasCents ? ptfFormatter.format(value) : oneDecimalFormatter.format(value)} TL/MWh`;
}

/**
 * ISO 8601 (+03:00) saat başlangıcını Türkçe tarih ve saat aralığına çevirir.
 * Örnek: "2026-11-08T10:00:00+03:00" -> { date: "08.11.2026", hour: "10:00", range: "10:00–11:00" }
 */
export function formatTimestampParts(isoTs: string): {
  date: string;
  hour: string;
  range: string;
  full: string;
} {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(isoTs);
  if (!match) {
    return { date: isoTs, hour: "", range: "", full: isoTs };
  }
  const [, year, month, day, hh, mm] = match;
  const date = `${day}.${month}.${year}`;
  const hour = `${hh}:${mm}`;
  const nextHourNum = (Number.parseInt(hh, 10) + 1) % 24;
  const nextHour = `${String(nextHourNum).padStart(2, "0")}:${mm}`;
  const range = `${hour}–${nextHour}`;
  return {
    date,
    hour,
    range,
    full: `${date} ${hour}`,
  };
}

/**
 * "2026-11-07" -> "07.11.2026"
 */
export function formatLocalDate(dateStr: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return dateStr;
  const [, year, month, day] = match;
  return `${day}.${month}.${year}`;
}

const TURKISH_MONTHS: Record<string, string> = {
  "01": "Ocak",
  "02": "Şubat",
  "03": "Mart",
  "04": "Nisan",
  "05": "Mayıs",
  "06": "Haziran",
  "07": "Temmuz",
  "08": "Ağustos",
  "09": "Eylül",
  "10": "Ekim",
  "11": "Kasım",
  "12": "Aralık",
};

/**
 * "2026-09" -> "Eylül 2026 (2026-09)"
 */
export function formatMonthLabel(monthStr: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthStr);
  if (!match) return monthStr;
  const [, year, month] = match;
  const monthName = TURKISH_MONTHS[month] ?? month;
  return `${monthName} ${year} (${monthStr})`;
}

export type FreshnessLevel = "fresh" | "warning" | "error";

export interface FreshnessStatus {
  level: FreshnessLevel;
  ageHours: number;
  label: string;
}

/**
 * Tazelik eşikleri:
 * - Ülke verisi: 4 saatte uyarı, 6 saatte hata
 * - Santral verisi: 36 saatte uyarı, 48 saatte hata
 */
export function evaluateFreshness(
  isoTs: string,
  warnHours: number,
  errorHours: number,
  referenceNow: Date = new Date()
): FreshnessStatus {
  const parsed = Date.parse(isoTs);
  if (Number.isNaN(parsed)) {
    return { level: "fresh", ageHours: 0, label: "" };
  }
  const diffMs = Math.max(0, referenceNow.getTime() - parsed);
  const ageHours = diffMs / (1000 * 60 * 60);
  const roundedHours = Math.floor(ageHours);

  if (ageHours >= errorHours) {
    return {
      level: "error",
      ageHours,
      label: `${roundedHours} saat eski`,
    };
  }
  if (ageHours >= warnHours) {
    return {
      level: "warning",
      ageHours,
      label: `${roundedHours} saat gecikmeli`,
    };
  }
  return {
    level: "fresh",
    ageHours,
    label: `${roundedHours} saat önce`,
  };
}

/**
 * ISO 8601 (+03:00) zaman damgasını İstanbul saatiyle Türkçe tarih ve saat olarak döndürür.
 * Örnek: "2026-11-10T11:51:40+03:00" -> "10.11.2026 11:51"
 */
export function formatIstanbulDateTime(isoTs: string): string {
  const parts = formatTimestampParts(isoTs);
  return parts.full;
}

/**
 * Son başarılı çalışma zamanını "x dk/saat önce" biçiminde Türkçe döndürür.
 */
export function formatRelativeTimeTr(
  isoTs: string | null,
  nowMs: number = Date.now()
): string {
  if (!isoTs) return "hiç yok";
  const parsed = Date.parse(isoTs);
  if (Number.isNaN(parsed)) return "—";
  const diffSec = Math.max(0, Math.floor((nowMs - parsed) / 1000));
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 1) {
    return "az önce";
  }
  if (diffMin < 60) {
    return `${formatNumber(diffMin)} dk önce`;
  }
  const diffHours = Math.floor(diffMin / 60);
  return `${formatNumber(diffHours)} saat önce`;
}

/**
 * Saniye cinsinden süreyi Türkçe biçimlendirir (ör. "36 sn", "1 dk 32 sn").
 */
export function formatDurationSeconds(totalSeconds: number): string {
  const sec = Math.max(0, Math.round(totalSeconds));
  if (sec < 60) {
    return `${formatNumber(sec)} sn`;
  }
  const mins = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (mins < 60) {
    return remSec > 0
      ? `${formatNumber(mins)} dk ${formatNumber(remSec)} sn`
      : `${formatNumber(mins)} dk`;
  }
  const hours = Math.floor(mins / 60);
  const remMin = mins % 60;
  return remMin > 0
    ? `${formatNumber(hours)} sa ${formatNumber(remMin)} dk`
    : `${formatNumber(hours)} sa`;
}

/**
 * Adım süresini (ended_at - started_at; çalışıyorsa started_at'ten şimdiye canlı sayaç) hesaplar.
 */
export function formatStepDuration(
  startedAt: string | null,
  endedAt: string | null,
  isRunning: boolean,
  nowMs: number = Date.now()
): string | null {
  if (!startedAt) return null;
  const startMs = Date.parse(startedAt);
  if (Number.isNaN(startMs)) return null;

  if (isRunning || !endedAt) {
    if (!isRunning && !endedAt) return null;
    const elapsedSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
    return formatDurationSeconds(elapsedSec);
  }

  const endMs = Date.parse(endedAt);
  if (Number.isNaN(endMs)) return null;
  const durationSec = Math.max(0, Math.round((endMs - startMs) / 1000));
  return formatDurationSeconds(durationSec);
}
