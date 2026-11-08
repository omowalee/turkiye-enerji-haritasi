# Frontend sınırları

- Frontend kodu sadece `frontend/` klasöründe yazılır. Bu klasörün dışına yazma.
- `frontend/src/types/` ve `frontend/public/data/` salt okunurdur. Bu dosyaları Claude Code'un scriptleri üretir. `contracts/` da salt okunurdur.
- Git kullanma. Commit'leri Claude Code atar.
- Veri sadece `docs/data-contract.md` dosyasında tanımlanan JSON dosyalarından okunur. Yeni bir alan gerekiyorsa uydurma. Görev sonundaki özette "Sözleşme isteği:" başlığıyla yaz.
- Hiçbir sır (API anahtarı, şifre, servis hesabı) frontend'e girmez.
- Her görevin sonunda `npm run typecheck` ve `npm run build` çalıştır ve sonucu raporla.
