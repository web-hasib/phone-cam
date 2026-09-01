# PhoneCam: Wireless Phone-to-PC Webcam Studio

A 3-tier wireless webcam system connecting a mobile camera directly to an Electron desktop software using a dedicated NestJS WebSocket signaling server.

---

## 🏗️ Architecture

- **`backend/`**: NestJS + Socket.IO WebRTC Signaling Gateway (Self-hosted on Port 4000).
- **`desktop/`**: Electron Desktop Software (Native WebRTC Receiver, QR Code Generator, Always-on-top, Snapshot Export, PiP).
- **`mobile/`**: React Native (Expo) Mobile App (Live Camera View, Back/Front Flip, Torch, OLED Battery Saver, QR Scanner).

---

## 🚀 How to Run

### 1. Start the NestJS Backend Server
```bash
cd backend
npm start
```
> The server will start on `http://localhost:4000` with WebSocket signaling enabled.

---

### 2. Launch the Electron Desktop App
```bash
cd desktop
npm start
```
> The desktop software will open with a live QR Code and Session ID.

---

### 3. Run the React Native Mobile App
```bash
cd mobile
npm start
```
> Open Expo Go on your Android/iOS phone, scan the QR code displayed in the desktop app, and enjoy high-speed live camera streaming!
