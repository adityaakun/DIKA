# Naelluxe

Deploy ke Vercel:
1. Upload SEMUA isi folder ini ke repo GitHub (index.html, api/, k.mp3, dst).
2. Vercel > Add New > Project > import repo (Framework Preset: Other).
3. Settings > Environment Variables: tambah `ADMIN_PASSWORD` (password pilihanmu).
4. Storage > Create > Upstash Redis (hubungkan ke project; env KV_REST_API_URL/TOKEN terisi otomatis).
5. Deployments > Redeploy.

Pakai: buka /#profil > masuk admin > ubah profil / tambah lagu (link Spotify atau judul lagu).
Lagu dari Spotify/iTunes hanya preview 30 detik. Untuk lagu penuh + lirik berjalan, isi kolom "Link mp3 penuh"
(taruh file mp3 di repo, contoh `/lagu.mp3`).
