import { memo, useEffect, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Info,
  Layers,
  Sun,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  evaluateFreshness,
  formatLocalDate,
  formatMonthLabel,
  formatMw,
  formatNumber,
  formatPercent,
  formatTimestampParts,
} from "@/lib/format";
import type { Provinces24H, SnapshotLatest } from "@/types";

interface InfoDrawerProps {
  snapshot: SnapshotLatest | null;
  provinces24h: Provinces24H | null;
  selectedHourIndex: number;
  selectedHourTimestamp: string | null;
  selectedHourTotalMw: number | null;
  locatedPlantCount: number;
  totalPlantsInCatalog: number;
}

export const InfoDrawer = memo(function InfoDrawer({
  snapshot,
  provinces24h,
  selectedHourIndex,
  selectedHourTimestamp,
  selectedHourTotalMw,
  locatedPlantCount,
  totalPlantsInCatalog,
}: InfoDrawerProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!snapshot) return null;

  const liveFreshness = evaluateFreshness(snapshot.live.ts, 4, 6);
  const plantsFreshness = evaluateFreshness(
    snapshot.plants_day.last_hour_ts,
    36,
    48
  );

  const worstFreshness =
    liveFreshness.level === "error" || plantsFreshness.level === "error"
      ? {
          level: "error" as const,
          label:
            liveFreshness.level === "error"
              ? `Ülke ${liveFreshness.label}`
              : `Santral ${plantsFreshness.label}`,
        }
      : liveFreshness.level === "warning" ||
          plantsFreshness.level === "warning"
        ? {
            level: "warning" as const,
            label:
              liveFreshness.level === "warning"
                ? `Ülke ${liveFreshness.label}`
                : `Santral ${plantsFreshness.label}`,
          }
        : {
            level: "fresh" as const,
            label: "Veri güncel",
          };

  const plantsDayDate = snapshot.plants_day.date;
  const plantsDayDateTr = formatLocalDate(plantsDayDate);
  const selectedHourParts = selectedHourTimestamp
    ? formatTimestampParts(selectedHourTimestamp)
    : null;
  const unlicensed = snapshot.unlicensed_solar;
  const displayedHourMw =
    selectedHourTotalMw ?? snapshot.plants_day.total_mw_last_hour;

  // Konumu bilinmeyen üretim: seçili saatteki MW ve ülke toplamı içindeki payı (%Y)
  const unlocatedHourMw = provinces24h?.unlocated.mw[selectedHourIndex] ?? 0;
  let locatedHourMwSum = 0;
  if (provinces24h) {
    for (const prov of provinces24h.provinces) {
      locatedHourMwSum += prov.mw[selectedHourIndex] ?? 0;
    }
  }
  const nationalPlantsHourTotal =
    locatedHourMwSum + unlocatedHourMw > 0
      ? locatedHourMwSum + unlocatedHourMw
      : displayedHourMw > 0
        ? displayedHourMw
        : 1;
  const unlocatedSharePct = (unlocatedHourMw / nationalPlantsHourTotal) * 100;

  return (
    <>
      {/* Sağ Üst: Santral Tarihi Etiketi + Küçük Tazelik Rozeti + "i" Düğmesi */}
      <div className="pointer-events-auto fixed top-2.5 right-2.5 z-20 flex items-center gap-2 md:top-4 md:right-4">
        <div className="hidden items-center gap-2 rounded-xl border border-white/12 bg-[#060B14]/78 px-3 py-1.5 text-xs shadow-xl backdrop-blur-xl xl:flex">
          <span className="font-mono-data text-[11px] text-[#94A3B8] tabular-nums">
            Santral verisi:{" "}
            <strong className="font-semibold text-[#F8FAFC]">
              {plantsDayDate}
            </strong>
            {selectedHourParts ? ` (${selectedHourParts.hour})` : ""}
          </span>

          <span className="text-white/15">·</span>

          {worstFreshness.level === "fresh" ? (
            <span className="inline-flex items-center gap-1 font-mono-data text-[11px] text-[#10B981]">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              <span>{worstFreshness.label}</span>
            </span>
          ) : (
            <Badge
              variant={worstFreshness.level === "error" ? "error" : "warning"}
              className="px-1.5 py-0 font-mono-data text-[10px] tabular-nums"
            >
              <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
              <span>{worstFreshness.label}</span>
            </Badge>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Veri detayları, konumu bilinmeyen üretim ve atıflar çekmecesini aç"
          title="Veri bilgileri, konumu bilinmeyen üretim ve atıflar"
          className={`flex h-10 w-10 items-center justify-center rounded-xl border shadow-xl backdrop-blur-xl transition-all focus-visible:outline-2 focus-visible:outline-[#38BDF8] ${
            open
              ? "border-[#38BDF8]/60 bg-[#0A1324]/95 text-[#38BDF8]"
              : "border-white/12 bg-[#060B14]/82 text-[#F8FAFC] hover:border-white/25 hover:bg-[#0D1628]/90"
          }`}
        >
          <Info className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Sağdan Açılan Koyu Cam Bilgi Çekmecesi */}
      {open && (
        <>
          <div
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px]"
          />
          <aside
            role="dialog"
            aria-label="Veri ve harita bilgi çekmecesi"
            className="pointer-events-auto fixed top-14 right-2.5 bottom-16 z-40 flex w-[calc(100vw-1.25rem)] max-w-sm flex-col justify-between overflow-y-auto rounded-2xl border border-white/15 bg-[#060B14]/92 p-4 text-xs text-[#F8FAFC] shadow-[0_24px_60px_rgba(0,0,0,0.85)] backdrop-blur-2xl md:top-16 md:right-4 md:bottom-20"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-[#38BDF8]" aria-hidden="true" />
                  <h2 className="font-display text-sm font-bold">
                    Veri, Ölçek ve Kaynak Bilgisi
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Bilgi çekmecesini kapat"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-white/10 hover:text-[#F8FAFC]"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {/* 1. Santral Verisi Tarihi ve Konumu Bilinmeyen Üretim */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center gap-1.5 font-semibold text-[#38BDF8]">
                  <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Santral verisi: {plantsDayDate}</span>
                </div>
                <div className="mt-1.5 space-y-1 text-[11px] text-[#94A3B8] tabular-nums">
                  <div className="flex justify-between">
                    <span>Yerel tarih ve saat:</span>
                    <span className="font-mono-data text-[#F8FAFC]">
                      {plantsDayDateTr}{" "}
                      {selectedHourParts ? `· ${selectedHourParts.hour}` : ""}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Seçili saat toplamı:</span>
                    <span className="font-mono-data font-semibold text-[#F8FAFC]">
                      {formatMw(displayedHourMw)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Eşleşen santral sayısı:</span>
                    <span className="font-mono-data font-semibold text-[#F8FAFC]">
                      {formatNumber(locatedPlantCount)} /{" "}
                      {formatNumber(totalPlantsInCatalog)} santral
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Veri tazeliği:</span>
                    <span className="font-mono-data text-[#F8FAFC]">
                      Ülke: {liveFreshness.label} · Santral:{" "}
                      {plantsFreshness.label}
                    </span>
                  </div>
                </div>

                {/* Zorunlu Konumu Bilinmeyen Üretim Notu */}
                <div className="mt-2.5 rounded-lg border border-white/10 bg-[#05080F]/90 px-2.5 py-2 font-mono-data text-[11px] font-medium text-[#E2E8F0] tabular-nums">
                  Konumu bilinmeyen üretim: {formatMw(unlocatedHourMw)} (
                  {formatPercent(unlocatedSharePct)})
                </div>
              </div>

              {/* 2. Lisanssız Güneş Bilgi Notu */}
              {unlicensed && (
                <div className="rounded-xl border border-[#FACC15]/30 bg-[#FACC15]/[0.05] p-3">
                  <div className="flex items-center gap-1.5 font-semibold text-[#FACC15]">
                    <Sun className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      Lisanssız güneş bilgi notu (
                      {formatMonthLabel(unlicensed.month)})
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-[#94A3B8] tabular-nums">
                    Aylık ortalama{" "}
                    <strong className="font-mono-data text-[#F8FAFC]">
                      {formatMw(unlicensed.avg_mw)}
                    </strong>{" "}
                    · Öğlen tepe{" "}
                    <strong className="font-mono-data text-[#F8FAFC]">
                      {formatMw(unlicensed.peak_mw)}
                    </strong>
                    . Gerçek zamanlı lisanslı üretim sayaçlarına dahil değildir;
                    EPİAŞ tarafından aylık gecikmeli yayımlanır.
                  </p>
                </div>
              )}

              {/* 3. Katmanlı 3D İl Blokları ve Ölçek Açıklaması */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center gap-1.5 font-semibold text-[#F8FAFC]">
                  <Layers
                    className="h-3.5 w-3.5 text-[#38BDF8]"
                    aria-hidden="true"
                  />
                  <span>Katmanlı İl Blokları ve Doğrusal Ölçek</span>
                </div>
                <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-[#94A3B8]">
                  <li>
                    <strong className="text-[#F8FAFC]">
                      Katmanlı 3B İl Blokları:
                    </strong>{" "}
                    Her il kendi sınır poligonuyla yükselen 3B bir bloktur.
                    Dilimler o ilde en büyük paya sahip kaynaktan en küçüğe
                    doğru aşağıdan yukarıya dizilir; toplam yükseklik ilin
                    seçili saatteki üretimine (MW) doğrusal olarak eşittir.
                  </li>
                  <li>
                    <strong className="text-[#F8FAFC]">
                      Dinamik Filtre Ölçeği:
                    </strong>{" "}
                    Kaynak filtresi değiştirildiğinde ölçek otomatik olarak o
                    görünümdeki en yüksek üretici ile göre yeniden normalize
                    edilir.
                  </li>
                </ul>
              </div>
            </div>

            {/* 4. Zorunlu Atıflar */}
            <div className="mt-4 border-t border-white/10 pt-3 text-[11px] leading-relaxed text-[#64748B]">
              <div className="font-semibold uppercase tracking-wider text-[#94A3B8]">
                Veri ve Harita Atıfları
              </div>
              <p className="mt-1">
                Üretim:{" "}
                <strong className="text-[#94A3B8]">
                  EPİAŞ Şeffaflık Platformu
                </strong>{" "}
                · Santral konum ve kurulu güç:{" "}
                <strong className="text-[#94A3B8]">
                  Global Energy Monitor (GEM)
                </strong>
                ,{" "}
                <strong className="text-[#94A3B8]">
                  © OpenStreetMap katkıcıları
                </strong>{" "}
                (ODbL) · İl sınırları:{" "}
                <strong className="text-[#94A3B8]">geoBoundaries</strong> (CC
                BY-SA 2.0) · Komşu ülke sınırları:{" "}
                <strong className="text-[#94A3B8]">Natural Earth</strong>.
              </p>
            </div>
          </aside>
        </>
      )}
    </>
  );
});
