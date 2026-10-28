<div align="center">

```
   ███╗   ███╗██╗   ██╗███╗   ██╗██╗███╗   ███╗███████╗██╗  ██╗
   ████╗ ████║╚██╗ ██╔╝████╗  ██║██║████╗ ████║██╔════╝██║ ██╔╝
   ██╔████╔██║ ╚████╔╝ ██╔██╗ ██║██║██╔████╔██║█████╗  █████╔╝ 
   ██║╚██╔╝██║  ╚██╔╝  ██║╚██╗██║██║██║╚██╔╝██║██╔══╝  ██╔═██╗ 
   ██║ ╚═╝ ██║   ██║   ██║ ╚████║██║██║ ╚═╝ ██║███████╗██║  ██╗
   ╚═╝     ╚═╝   ╚═╝   ╚═╝  ╚═══╝╚═╝╚═╝     ╚═╝╚══════╝╚═╝  ╚═╝
```

# MyNimeku Downloader & Scraper CLI

[![Node.js Version](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](./LICENSE)
[![Platform: Cross-Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS%20%7C%20Android%20(Termux)-informational?style=for-the-badge)](https://nodejs.org/)
[![Status](https://img.shields.io/badge/Status-Active-brightgreen.svg?style=for-the-badge)]()

**MyNimeku Downloader** adalah perkakas otomatisasi berbasis Node.js (CLI & Library) untuk mencari, mengekstrak tautan, dan mengunduh video anime langsung dari website [MyNimeku](https://www.mynimeku.com) serta tautan streaming video publik lainnya.

</div>

---

## 🌟 Fitur Unggulan

- 🌐 **Multi-Website Provider**: Mendukung scraping dan download dari berbagai website anime sekaligus:
  - **MyNimeku** (`https://www.mynimeku.com`)
  - **Otakudesu** (`https://otakudesu.blog`)
  - **Samehadaku** (`https://samehadaku.li`)
  - **Gomunime** (`https://ww2.gomunime.org`)
  - *(Mudah diperluas untuk website anime lainnya dengan arsitektur `BaseScraper`)*
- 🔍 **Pencarian Terpadu (Multi-Search)**: Cari anime di semua website sekaligus hanya dengan satu kali ketik!
- 🔀 **Peralihan Sumber Cepat**: Cukup ketik `:sumber` atau `:source` di terminal untuk beralih antar website anime favorit.
- 🔗 **Auto-Detect Provider**: Cukup tempelkan link URL dari MyNimeku, Otakudesu, atau direct video stream; sistem otomatis mengenali dan memproses unduhan.
- 🔥 **Beranda & Trending Feed**: Menampilkan daftar anime yang baru saja rilis / sedang tayang hari ini langsung di halaman utama CLI layaknya beranda YouTube.
- 📁 **Otomatis Tersimpan di Folder Downloads**: Video otomatis tersimpan di folder `Downloads` laptop/PC kamu (`C:\Users\<user>\Downloads` atau `~/Downloads`), atau langsung di folder Download HP untuk pengguna Android (**Termux**), sehingga langsung muncul di galeri atau video player!
- ⚡ **Auto-Resolver Gateway**: Secara otomatis melewati halaman perantara (seperti MyDriveKu, Desustream, Hxfile) dan langsung mengarahkan ke link direct video stream (`video/mp4`).
- 🎚️ **Multi-Resolusi**: Mendukung pilihan resolusi **360P**, **480P**, **720P (HD)**, hingga **1080P (FHD)**.
- 📦 **Batch Downloader**: Unduh seluruh episode dalam satu serial anime sekaligus atau tentukan rentang tertentu (misal: Episode 1 s/d 12) dengan jeda aman antar episode.
- 📊 **Progress Bar Interaktif**: Indikator unduhan real-time lengkap dengan persentase, kecepatan (MB/s), estimasi waktu selesai (ETA), dan ukuran file.
- ⏯️ **Resume Download Support**: Menggunakan HTTP Range request, sehingga jika koneksi terputus, unduhan dapat dilanjutkan tanpa mengulang dari awal.
- 💻 **Mode Interaktif & Argumen CLI**: Gunakan menu interaktif dengan tampilan terminal yang elegan, atau gunakan perintah baris (command line) untuk integrasi ke script otomatisasi.

---

## 📋 Prasyarat

- **Node.js** versi 20.0.0 atau yang lebih baru.
- Koneksi internet stabil.

---

## 🚀 Instalasi & Persiapan

### 💻 Di Laptop / PC (Windows, macOS, Linux)

1. **Clone repository ini:**
   ```bash
   git clone https://github.com/username-kamu/mynimeku-dl.git
   cd mynimeku-dl
   ```

2. **Pasang dependensi:**
   ```bash
   npm install
   ```

3. *(Opsional)* **Hubungkan sebagai perintah global di terminal:**
   ```bash
   npm link
   ```
   Setelah di-link, kamu bisa langsung mengetik **`animeku`** (atau `nimeku` / `mynimeku-dl`) dari terminal manapun!

---

### 📱 Di Android (Termux)

Aplikasi ini dapat dijalankan sepenuhnya di HP Android menggunakan aplikasi **Termux**:

1. **Buka Termux, lalu update paket & install Node.js + Git:**
   ```bash
   pkg update && pkg upgrade -y
   pkg install nodejs git -y
   ```

2. **Beri izin akses penyimpanan internal:**
   ```bash
   termux-setup-storage
   ```
   *(Pilih **Allow/Izinkan** saat muncul jendela izin penyimpanan di layar HP kamu. Ini agar video yang didownload langsung masuk ke folder `Download` memori internal HP).*

3. **Clone & Jalankan:**
   ```bash
   git clone https://github.com/username-kamu/mynimeku-dl.git
   cd mynimeku-dl
   npm install
   npm start
   ```

---

## 🎮 Cara Penggunaan

### 1. Mode Interaktif (Search-First Terminal CLI)

Jalankan perintah berikut:
```bash
npm start
```
atau (jika sudah di-link):
```bash
nimeku
```

Saat aplikasi dibuka, kamu akan langsung dihadapkan pada **bilah pencarian terminal ala YouTube**:
```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 💡 TIP: Ketik judul anime apa saja, tempelkan link URL, atau
         tekan [Enter] tanpa mengetik untuk melihat anime terbaru di Beranda.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

? 🔍 Cari anime / URL / Beranda: 
```

- **Ketik judul anime** (misal: `kusuriya`, `solo leveling`, `bleach`) ➔ Langsung memunculkan daftar anime, pilih episode, pilih resolusi, dan download dengan progress bar!
- **Tekan [Enter] kosong** ➔ Menampilkan daftar anime yang baru saja rilis hari ini di Beranda (seperti halaman Beranda YouTube).
- **Tempelkan link (URL)** ➔ Otomatis mendeteksi dan mengunduh episode/series tersebut.

---

### 2. Mode Perintah Terminal Cepat (CLI Command Mode)

Kamu juga dapat menjalankan perintah langsung tanpa masuk ke menu interaktif:

#### 🔍 Mencari Anime
```bash
node bin/index.js search "kusuriya"
# atau: nimeku search "solo leveling"
```

#### ⚡ Download Episode Tunggal
```bash
node bin/index.js download "https://www.mynimeku.com/episode/kusuriya-no-hitorigoto-3rd-season-episode-04-subtitle-indonesia/" -r 720P
```
*Opsi:*
- `-r, --res <resolution>` : Pilihan resolusi (`1080P`, `720P`, `480P`, `360P`) *(default: 720P)*.
- `-o, --output <dir>` : Folder tujuan custom *(default: folder Downloads sistem)*.
- `-s, --server <name>` : Pilihan server (`CLOUD`, `PRIVATE`) *(default: CLOUD)*.

#### 📦 Batch Download Satu Serial Anime
```bash
node bin/index.js batch "https://www.mynimeku.com/series/kusuriya-no-hitorigoto-3rd-season/" --from 1 --to 4 -r 720P
```
*Opsi:*
- `--from <num>` : Nomor episode awal *(default: 1)*.
- `--to <num>` : Nomor episode akhir *(default: episode terakhir)*.
- `-r, --res <resolution>` : Resolusi video yang diinginkan.
- `-o, --output <dir>` : Folder tujuan custom.

#### 🌐 Download Video dari Link Langsung
```bash
node bin/index.js direct "https://example.com/sample_video.mp4" -o "video_saya.mp4"
```

---

## 🛠️ Penggunaan Sebagai Library (ES Modules)

Kamu juga dapat mengimpor fungsi-fungsi dari package ini ke dalam kode Node.js buatanmu sendiri:

```javascript
import { searchAnime, getEpisodeDetails, resolveVideoUrl, downloadVideo } from './src/index.js';

async function main() {
  // 1. Cari anime
  const results = await searchAnime('Kusuriya');
  console.log('Hasil pencarian:', results[0].title);

  // 2. Ambil detail episode dan link download
  const epData = await getEpisodeDetails('https://www.mynimeku.com/episode/...');
  const cloud720p = epData.downloads['720P'].find(s => s.server === 'CLOUD');

  // 3. Resolusi ke direct MP4
  const resolved = await resolveVideoUrl(cloud720p.url);
  console.log('Direct MP4 Stream:', resolved.directUrl);

  // 4. Download video (otomatis ke folder Downloads sistem jika outputDir tidak ditentukan)
  await downloadVideo(resolved.directUrl, {
    filename: resolved.filename
  });
}

main();
```

---

## 📁 Struktur Direktori

```text
mynimeku-dl/
├── bin/
│   └── index.js              # Entry-point eksekutabel CLI
├── src/
│   ├── config.js             # Konfigurasi bawaan (URL, User-Agent, deteksi Downloads)
│   ├── core/
│   │   ├── httpClient.js     # HTTP client wrapper dengan timeout & headers
│   │   └── resolver.js       # Resolver direct MP4 link dari gateway
│   ├── scrapers/
│   │   └── mynimeku.js       # Scraper pencarian, serial, dan episode
│   ├── downloader/
│   │   └── videoDownloader.js# Engine unduhan video dengan progress bar & resume
│   ├── cli/
│   │   ├── interactive.js    # Antarmuka CLI interaktif (@inquirer/prompts)
│   │   └── commands.js       # Parser argumen baris perintah (Commander.js)
│   └── index.js              # Ekspor modul library
├── .env.example              # Contoh variabel lingkungan
├── .gitignore                # File filter Git
├── LICENSE                   # Lisensi open-source MIT
├── package.json              # Manifest proyek
└── README.md                 # Dokumentasi proyek
```

---

## 📤 Cara Mengunggah (Push) ke GitHub

Jika kamu ingin mempublikasikan proyek ini ke akun GitHub:

1. Buat repository baru di [GitHub](https://github.com/new) (misal: `mynimeku-dl`).
2. Jalankan perintah berikut di terminal:
   ```bash
   git init
   git add .
   git commit -m "feat: initial release of mynimeku-dl"
   git branch -M main
   git remote add origin https://github.com/USERNAME_KAMU/mynimeku-dl.git
   git push -u origin main
   ```

---

## ⚖️ Disclaimer & Ketentuan Penggunaan

Proyek ini dibuat untuk tujuan **edukasi, riset otomasi, dan penggunaan arsip pribadi**. Seluruh materi video, hak cipta, merek dagang, dan konten multimedia adalah milik dari masing-masing pemegang lisensi, produser, dan pemilik aslinya. Pengembang tidak bertanggung jawab atas penyalahgunaan perkakas ini di luar ketentuan yang berlaku.

---

## 📄 Lisensi

Didistribusikan di bawah lisensi open source **[MIT License](./LICENSE)**. Silakan gunakan, pelajari, dan kembangkan sesuka hati!
