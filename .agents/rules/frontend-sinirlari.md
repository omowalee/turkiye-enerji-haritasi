# Frontend sınırları

- Frontend kodu sadece `frontend/` klasöründe yazılır.
- `contracts/` ve `frontend/src/types/` salt okunurdur. Bu dosyaları değiştirme.
- Veri sadece `docs/data-contract.md` dosyasında tanımlanan JSON dosyalarından okunur. Yeni alan gerekiyorsa `docs/ilerleme.md` içindeki "Sözleşme istekleri" bölümüne not yaz.
- Hiçbir sır (API anahtarı, şifre, servis hesabı) frontend'e girmez.
- Her görevin sonunda `npm run typecheck` ve `npm run build` çalıştır ve sonucu raporla.
