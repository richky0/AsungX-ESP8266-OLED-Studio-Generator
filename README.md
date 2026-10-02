# AsungX ESP8266 OLED Studio Generator

Web-based video/GIF converter untuk ESP8266 SSD1306 OLED (128x64) animations.

Output `.bin` format compatible dengan [AsungX Deauther firmware](https://github.com/richky0/AsungX-Deauther-esp8266).

## Fitur

- Upload video (MP4, AVI, MOV, WEBM, MKV) atau GIF
- Konversi video ke frame sequence 1-bit OLED 128x64
- Generator teks bergerak (custom text animation)
- Auto-cut kalau durasi terlalu panjang
- Preview OLED pixel-perfect
- Konfigurasi: FPS, durasi, resolusi, threshold, delta encoding
- Real-time stats (size, durasi, warning limit)
- Download `.bin` siap upload ke ESP8266

## Batasan Hardware

| Resource | Nilai |
|----------|-------|
| OLED | SSD1306 128x64 1-bit |
| SPIFFS free | 49 KB |
| Soft limit | 45 KB |
| Hard limit | 60 KB |
| Durasi max (no delta) | ~3 detik @15 FPS |
| Durasi max (delta) | ~6-10 detik @15 FPS |

## Cara Pakai

### Via Docker (Recommended)

    docker-compose up -d
    # Akses: http://localhost:8088

### Development (tanpa Docker)

    python3 -m http.server 8088
    # atau
    npx serve -p 8088

## Format .bin

    Header (5 bytes):
      [0-1] uint16 LE: frame_count
      [2-3] uint16 LE: frame_size (1024 untuk 128x64)
      [4]   uint8: delta_flag (0=full, 1=delta)

    Data:
      Full frame: [frame_size bytes] x frame_count
      Delta frame 0: full frame (1024 B)
      Delta frame 1..N: [changed_count:u16][indices:u16xN][values:u8xN]

## Cara Pakai Hasil Convert

1. Convert video/GIF di web, download `.bin`
2. Upload `.bin` ke ESP8266 via web:
   - Buka http://192.168.4.1/animation.html
   - Upload file `.bin`
   - Klik Play

## Struktur

    asung-animation-studio/
    - index.html          # UI utama
    - style.css           # Styling
    - app.js              # Logic converter
    - text.js             # Generator teks bergerak
    - Dockerfile          # Docker build
    - docker-compose.yml  # Docker orchestration

## License

MIT - Copyright (c) 2026 AsungX Developer
