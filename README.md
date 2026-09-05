# 🎥 PhoneCam Studio v2.0

> **Turn your smartphone into a wireless pro HD webcam for PC with ultra-low latency (<30ms), DirectShow Virtual Camera support (Google Meet, Zoom, MS Teams), OLED battery saving, and zero-configuration pairing.**

---

## 🌐 Live Web App & Direct Access

* 📱 **Mobile Broadcaster & PWA Web App:**  
  👉 **[https://cam-backend-4bdx.onrender.com](https://cam-backend-4bdx.onrender.com)**  
  *(Open this link in your phone's browser or tap **"Add to Home Screen"** to install as a native full-screen app!)*

* 📖 **Public User Guide & Setup Manual:**  
  👉 **[https://cam-backend-4bdx.onrender.com/guide.html](https://cam-backend-4bdx.onrender.com/guide.html)**

---

## 📥 Desktop Software Downloads (Windows 10/11)

> 🚀 **Direct Download from GitHub Releases:** [**Download PhoneCam Studio v2.0.1**](https://github.com/web-hasib/phone-cam/releases/tag/v2.0.1)

| Package Type | Direct Download Link | Description |
| :--- | :--- | :--- |
| **🪟 Windows Installer (.exe)** | [**Download Setup (v2.0.1)**](https://github.com/web-hasib/phone-cam/releases/download/v2.0.1/PhoneCam.Studio.Setup.2.0.1.exe) | Standard Windows Setup with Start Menu & Desktop Shortcut |
| **🪟 Windows Portable (.exe)** | [**Download Portable (v2.0.1)**](https://github.com/web-hasib/phone-cam/releases/download/v2.0.1/PhoneCam.Studio.2.0.1.exe) | Zero-install single executable (Run directly anywhere) |

---

## 🌟 Key Features

* **⚡ Ultra-Low Latency Video Pipeline:**
  * **WebRTC P2P:** Direct browser-to-desktop hardware-accelerated video streaming with <30ms latency.
  * **TurboFrame WebSocket Fallback:** Resilient fallback for strict enterprise firewalls and mobile data networks.
* **🎥 Native DirectShow Virtual Camera:**
  * Appears as a real system camera (`PhoneCam Virtual Camera`) in **Google Meet, Zoom, MS Teams, OBS Studio, Discord**, and Windows Camera app.
  * 16:9 Widescreen aspect ratio (Zero stretching / distortion) in **480p (848x480)**, **720p (1280x720)**, and **1080p (1920x1080)**.
* **📱 Web & PWA Broadcaster (Zero App Install):**
  * Runs directly in any mobile browser (Chrome, Safari, Firefox).
  * Supports **PWA (Add to Home Screen)** for a full-screen native app experience.
  * **Integrated QR Code Scanner** for instant 1-second pairing.
  * **🔄 Live 0°/90°/180°/270° Rotation:** Rotate camera feed from phone or PC in real-time.
  * **🌙 OLED Battery Saver (Dimmer Mode):** 100% true pitch black `#000000` screen saver with Screen Wake Lock—keeps camera active continuously with 0mW screen power drain.
* **🎨 Pro Studio Controls:**
  * Live Color Grading (Brightness, Contrast, Saturation, Warmth).
  * Studio presets: Studio Warm, Cool Crisp, Cinema B&W, Vivid Punch, Portrait Glow.
  * Horizontal Mirroring & Vertical Flip.
  * Smart Framing: **Fill (Cover)** vs **Natural (Contain)**.
  * Live Audio VU Meter & Instant HD Snapshots.

---

## 🏗️ Project Architecture

```
PhoneCam Studio/
├── backend/            # NestJS WebRTC Signaling Server + Web PWA Broadcaster
│   ├── public/         # Mobile PWA Broadcaster (QR Scanner, Camera UI, Service Worker)
│   ├── src/
│   │   ├── signaling/  # Low-latency Socket.IO Signaling Gateway
│   │   └── main.ts     # Express + NestJS Server Entry
│   └── package.json
│
├── desktop/            # Electron Desktop Studio Receiver + DirectShow VCam
│   ├── bin/            # softcam.dll (64-bit DirectShow Native Filter)
│   ├── renderer/       # Studio GUI (Dark liquid glass UI, Audio VU, Controls)
│   ├── main.js         # Electron Main Process & IPC Bridge
│   ├── vcam.js         # Koffi FFI Bridge to softcam.dll
│   └── package.json
│
├── softcam/            # C++ Source Code for DirectShow Virtual Camera DLL
│   ├── src/            # Filter & Ring Buffer implementation
│   └── softcam.sln     # Visual Studio C++ Solution
│
├── .env.example        # Master Environment Variables Template
├── .gitignore          # Git exclusion rules
└── README.md           # Documentation
```

---

## 🚀 Quick Start Guide

### 1. Requirements
* **Node.js**: v18.0.0 or higher
* **Windows**: Windows 10 or Windows 11 (64-bit)

---

### 2. Backend & Web Broadcaster Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Start the development server
npm start
```
* The backend server will start on `http://localhost:4000`.
* Open `http://localhost:4000` on your mobile phone browser to open the Broadcaster / QR Scanner.

---

### 3. Desktop Studio Setup & Run

```bash
# Navigate to desktop directory
cd desktop

# Install dependencies
npm install

# Launch Desktop Studio in Development Mode
npm start
```

---

## 📦 Building Windows Executables

```bash
cd desktop

# Build Windows Setup Installer & Portable .exe
npm run build

# Or build unpacked directory:
npm run build:dir
```
Outputs in `desktop/dist/`:
* `PhoneCam Studio Setup 2.0.0.exe` (Windows Installer)
* `PhoneCam Studio 2.0.0.exe` (Portable executable)

---

## ⚙️ Environment Configuration (`.env`)

Create a `.env` file in the root or `desktop/` directory:

```env
# URL of your deployed signaling backend server
BACKEND_URL=https://your-backend-domain.com

# Server Port (default: 4000)
PORT=4000

# Optional Local Wi-Fi IP for direct zero-latency LAN streaming
LOCAL_IP=http://192.168.1.100:4000
```

---

## 📖 How to Use

1. **Launch Desktop App:**
   Open **PhoneCam Studio** on your PC. It will display a QR Code and 4-letter session code (e.g. `CAM1`).
2. **Open Mobile PWA:**
   Open your browser and navigate to your backend URL (or scan the QR code using your phone camera).
3. **Instant Stream:**
   The phone camera will automatically stream HD video to your PC.
4. **Use in Google Meet / Zoom:**
   * Open **Google Meet** or **Zoom** Settings ➔ **Video** ➔ Select **`PhoneCam Virtual Camera`**.
   * Toggle the `VCam` button in PhoneCam Studio.

---

## 🛡️ License

MIT License © 2026 PhoneCam Studio. Built with NestJS, Electron, WebRTC, and DirectShow.
