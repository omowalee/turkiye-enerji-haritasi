import { useCallback, useEffect, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { FooterAttribution } from "@/components/FooterAttribution";
import { HeaderBar } from "@/components/HeaderBar";
import { LiveCounters } from "@/components/LiveCounters";
import { TurkeyMap } from "@/components/TurkeyMap";
import { loadDashboardData, type DashboardInitialData } from "@/lib/data";

export function App() {
  const [data, setData] = useState<DashboardInitialData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchAll = useCallback((signal?: AbortSignal) => {
    setLoading(true);
    setErrorMessage(null);
    loadDashboardData(signal)
      .then((result) => {
        setData(result);
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

  return (
    <div className="flex min-h-dvh w-full flex-col bg-[#060A12] text-[#F8FAFC]">
      {/* Üst Kontrol Odası Başlık ve Zaman Çubuğu */}
      <HeaderBar snapshot={data?.snapshot ?? null} loading={loading} />

      {/* Hata / Veri Yok Durumu */}
      {errorMessage ? (
        <div
          role="alert"
          className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
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
            className="mt-1 inline-flex min-h-[40px] items-center gap-2 rounded-md border border-[#334155] bg-[#151F32] px-4 py-2 text-xs font-medium text-[#F8FAFC] transition-colors hover:bg-[#1E293B]"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Tekrar Dene</span>
          </button>
        </div>
      ) : (
        <>
          {/* Canlı Sayaçlar (Toplam MW, Yenilenebilir %, Kaynak Bazında MW + Akkuyu) */}
          <LiveCounters
            snapshot={data?.snapshot ?? null}
            sourceLabels={data?.sourceLabels ?? null}
            loading={loading}
          />

          {/* Merkez: Türkiye İl Sınırları + Santral Noktaları Haritası */}
          <TurkeyMap
            provincesGeoJson={data?.provincesGeoJson ?? null}
            plants={data?.locatedPlants ?? []}
            totalPlantsInCatalog={data?.totalPlantsInCatalog ?? 0}
            snapshot={data?.snapshot ?? null}
            sourceLabels={data?.sourceLabels ?? null}
            lastHourTimestamp={data?.lastHourTimestamp ?? null}
            loading={loading}
          />
        </>
      )}

      {/* Alt Bilgi ve Zorunlu Atıflar */}
      <FooterAttribution />
    </div>
  );
}

export default App;
