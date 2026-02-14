# 🫧 Bubble Arena: Next-Gen Gesture Control Game

![React](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite)
![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?style=for-the-badge&logo=tailwindcss)
![MediaPipe](https://img.shields.io/badge/MediaPipe-Vision-007f7f?style=for-the-badge&logo=google)
![PeerJS](https://img.shields.io/badge/PeerJS-P2P-red?style=for-the-badge&logo=webrtc)

**Bubble Arena** adalah platform game eksperimental yang menggabungkan *Computer Vision* dan *Real-time Networking*. Pemain mengontrol permainan sepenuhnya menggunakan gestur tangan di depan kamera, tanpa menyentuh mouse atau keyboard.

## 🚀 Fitur Utama

- **🎮 Gesture-Based Gameplay**: Menggunakan MediaPipe Hand Landmarker untuk mendeteksi ujung jari telunjuk sebagai kursor interaksi.
- **👤 Face-Sync Lobby**: Sistem "Ready" yang unik menggunakan Face Detection. Pemain harus memposisikan wajah di area deteksi selama beberapa detik untuk memulai.
- **🌐 Real-time Online Multiplayer**: Didukung oleh PeerJS (WebRTC) untuk sinkronisasi state game dan video call antar pemain secara *peer-to-peer*.
- **⚡ Cyberpunk Aesthetic**: Antarmuka futuristik dengan animasi halus dari Framer Motion, efek partikel, dan desain ala HUD militer.
- **🔊 Immersive Audio**: Background music dinamis dan sound effects yang tersinkronisasi dengan aksi dalam game.

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite.
- **Styling**: Tailwind CSS v4 (PostCSS).
- **Animations**: Framer Motion.
- **AI/ML**: Google MediaPipe (Hand Landmarker & Face Detector).
- **Networking**: PeerJS (WebRTC) untuk P2P Data & Media Stream.
- **Icons**: Lucide React.
- **Audio**: Use-sound hooks.

## 📦 Struktur Proyek

```text
src/
├── game/
│   ├── Engine.ts        # Logika inti (Bubble, Particles, Physics)
│   └── GameManager.tsx  # Orkestrasi AI Tracking, Rendering, & Syncing
├── hooks/
│   └── useOnlinePeer.ts # Abstraksi koneksi P2P (PeerJS)
├── assets/              # Static assets & SVG
├── App.tsx              # UI Utama, Lobby, & Management State
└── main.tsx             # Entry point
```

## 🛠️ Cara Instalasi

1. **Clone Repository**
   ```bash
   git clone <repository-url>
   cd bubble-pop-web-new
   ```

2. **Install Dependensi**
   ```bash
   npm install
   ```

3. **Jalankan Development Server**
   ```bash
   npm run dev
   ```

4. **Build untuk Produksi**
   ```bash
   npm run build
   ```

## 🎮 Cara Bermain

1. **Izin Kamera**: Pastikan Anda memberikan izin akses kamera saat diminta.
2. **Lobby (Syncing)**:
   - Pilih mode **Solo** atau **Multiplayer**.
   - Di Lobby, posisikan wajah Anda di depan kamera hingga bar progres "SYNC_COMPLETE" penuh.
3. **Gameplay**:
   - Gunakan **ujung jari telunjuk** Anda untuk memecahkan gelembung yang muncul dari bawah.
   - Di mode online, Anda akan melihat kursor (tangan) dan video stream lawan secara real-time.
4. **Scoring**: Pecahkan gelembung sebanyak mungkin dalam waktu 60 detik!

## 🌐 Mekanisme Multiplayer (Online)

Game ini menggunakan arsitektur **Host-Client**:
- **Host**: Bertanggung jawab menghasilkan gelembung dan mengelola state global (timer, score).
- **Client**: Mengirim data posisi tangan dan event "pop" ke Host.
- **Sync**: Host melakukan broadcast state gelembung secara berkala ke Client untuk memastikan visual tetap sinkron.

---
Built with 💙 by Gemini CLI Agent.
