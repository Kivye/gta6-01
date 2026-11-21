[![Make.fun Competition](https://img.shields.io/badge/Make.fun-Competition-blue)](https://make.fun/competitions/gta6-01)
[![Repository](https://img.shields.io/badge/GitHub-Kivye%2Fgta6--01-green)](https://github.com/Kivye/gta6-01)
**Competition:** [GTA6-01](https://make.fun/competitions/gta6-01) on Make.fun

# Palmshade Heat

Palmshade Heat adalah game aksi open-world yang dimainkan langsung di peramban. Pemain bebas berkeliling kota pesisir Palmshade, bergantian berjalan kaki dan mengemudikan mobil, menuntaskan rangkaian misi cerita, dan berhadapan dengan polisi yang makin agresif setiap kali tingkat buronan naik. Seluruh game ditulis dengan JavaScript dan Three.js tanpa proses build: sajikan saja berkasnya lewat server statis dan permainan langsung bisa dimainkan.

## Yang bisa dilakukan di dalam game

- **Delapan misi cerita berurutan.** Setiap misi dibuka dengan briefing dan ditutup dengan outro, dan misi berikutnya hanya terbuka setelah misi sebelumnya selesai.
- **Sistem buronan bintang 1 sampai 5.** Polisi AI mengejar di jalanan, memasang blokade, dan memanggil helikopter AIR-1. Pada tingkat tertinggi muncul van SWAT lapis baja, dan khusus di bintang 5 polisi menggelar strip paku yang dapat mengempiskan ban mobil pemain.
- **Tiga senjata dan Gun Van.** Pistol dengan peluru tak terbatas, Micro SMG berisi 120 peluru yang tetap dapat ditembakkan sambil mengemudi, dan Pump Shotgun berisi 24 peluru. Gun Van yang berkeliling kota menjual senjata, amunisi, dan kevlar kepada pemain.
- **Balapan jalanan dengan taruhan.** Ada tiga lintasan bergerbang neon. Pemain memasang taruhan uang lalu beradu cepat melawan rival bernama yang masing-masing punya karakter balap sendiri.
- **Delapan tanjakan stunt.** Lompatan yang berhasil memicu efek slow-motion sesaat dan menghadiahkan bonus uang.
- **Properti yang bisa dibeli.** Tiga properti tersedia untuk dibeli, dan masing-masing membayar pemasukan pasif secara berkala kepada pemiliknya.
- **Garasi respray.** Di sini mobil bisa dicat ulang, ban yang kempes gara-gara strip paku bisa diperbaiki, dan satu mobil favorit bisa disimpan untuk dipakai lagi nanti.
- **Suasana malam neon dan hujan.** Kota tampil dalam preset malam berhias neon dengan hujan pesisir ringan yang turun terus selama permainan.
- **Acara sampingan mobil kas.** Sesekali muncul mobil kas lapis baja yang bisa dibajak untuk mengambil uang yang dibawanya.
- **Audio prosedural berlapis.** Bunyi mesin, tembakan, sirene, dan efek suara lainnya dibangkitkan langsung dari kode dan disusun berlapis mengikuti kejadian di layar.

## Menjalankan secara lokal

Cara paling sederhana adalah memakai server bawaan repo ini (membutuhkan Node 22 atau lebih baru):

```bash
node main.ts
```

Setelah itu buka `http://localhost:8080` di peramban. Port dapat diganti lewat variabel lingkungan `PORT`. Alternatifnya, sajikan folder `game/` dengan server statis apa pun, lalu buka `index.html` yang ada di dalamnya.

## Pemeriksaan otomatis

Repo ini membawa perangkat uji headless berbasis Chrome DevTools Protocol yang dirangkai di `cdp.mjs`:

- `node playtest.mjs` — memainkan game secara headless dan menjalankan 93 pemeriksaan atas misi, sistem buronan, senjata, balapan, dan fitur lainnya.
- `node shots.mjs` — merender empat screenshot resmi ke folder `screenshots/` sesuai daftar panggung di `shots.json`.
- Dossier entri dibangun dengan fungsi `buildDossier` dari `vendor/makefun-game.ts`, pustaka resmi make.fun yang disertakan apa adanya di repo ini.

## Struktur berkas

- `game/` — seluruh game: `index.html`, `style.css`, kode sumber di `game/src/` (misi, polisi, kendaraan, senjata, audio, dunia, penyimpanan, dan lain-lain), serta Three.js di `game/vendor/`.
- `main.ts` dan `serve.ts` — titik masuk dan server statis sederhana untuk menjalankan game secara lokal.
- `playtest.mjs`, `shots.mjs`, `shots.json`, `cdp.mjs` — perangkat playtest headless dan perender screenshot.
- `screenshots/` — empat tangkapan layar resmi entri ini.
- `vendor/` — pustaka make.fun untuk membangun dossier.
