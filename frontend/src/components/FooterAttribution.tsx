export function FooterAttribution() {
  return (
    <footer className="z-20 border-t border-[#1E293B] bg-[#0D1422]/95 px-3 py-2 text-[11px] text-[#94A3B8] sm:px-5">
      <div className="mx-auto flex max-w-[1920px] flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-medium text-[#F8FAFC]">Veri ve Konum Kaynakları:</span>
          <span>EPİAŞ Şeffaflık Platformu</span>
          <span className="text-[#334155]" aria-hidden="true">
            ·
          </span>
          <span>Global Energy Monitor</span>
          <span className="text-[#334155]" aria-hidden="true">
            ·
          </span>
          <span>© OpenStreetMap katkıcıları</span>
          <span className="text-[#334155]" aria-hidden="true">
            ·
          </span>
          <span>geoBoundaries</span>
        </div>
        <div className="text-[#64748B]">
          Sadece gerçekleşen lisanslı yurt içi üretim (dış ticaret hariç)
        </div>
      </div>
    </footer>
  );
}
