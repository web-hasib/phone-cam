const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");

const QRCode = require("qrcode");
const { VirtualCamera } = require("./vcam");

// Load .env if present
function loadEnv() {
  const envPaths = [
    path.join(__dirname, ".env"),
    path.join(process.cwd(), ".env"),
    path.join(__dirname, "..", ".env"),
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, "utf8");
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
            const [k, ...v] = trimmed.split("=");
            const key = k.trim();
            const val = v.join("=").trim().replace(/^["']|["']$/g, "");
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      } catch (e) {}
    }
  }
}
loadEnv();

let mainWindow = null;
const vcam = new VirtualCamera();

function getPrimaryLocalIp() {
  const customIp = process.env.LOCAL_IP || process.env.HOST_IP || process.env.SERVER_IP;
  if (customIp) return customIp;

  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return process.env.DEFAULT_IP || "127.0.0.1";
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 880,
    minHeight: 600,
    backgroundColor: "#070a13",
    title: "PhoneCam Studio Receiver",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  mainWindow.on("closed", () => {
    // Stop virtual camera on window close
    vcam.stop();
    mainWindow = null;
  });
}

// ─── QR Code & IP ────────────────────────────────────────────────
ipcMain.handle("generate-qr", async (event, text) => {
  try {
    return await QRCode.toDataURL(text, {
      width: 160,
      margin: 1,
      color: {
        dark: "#0b1120",
        light: "#ffffff",
      },
    });
  } catch (err) {
    console.error("QR Generation error in main:", err);
    return null;
  }
});

ipcMain.handle("get-local-ip", () => {
  return getPrimaryLocalIp();
});

// ─── Window Controls ─────────────────────────────────────────────
ipcMain.handle("set-always-on-top", (event, flag) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(Boolean(flag));
    return mainWindow.isAlwaysOnTop();
  }
  return false;
});

ipcMain.handle("save-snapshot", async (event, dataUrl) => {
  if (!dataUrl) return { success: false, error: "No image data" };

  try {
    const defaultPath = path.join(
      app.getPath("pictures"),
      `phonecam-snapshot-${Date.now()}.png`
    );

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: "Save Camera Snapshot",
      defaultPath,
      filters: [{ name: "PNG Images", extensions: ["png"] }],
    });

    if (canceled || !filePath) return { success: false, canceled: true };

    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
    await fs.promises.writeFile(filePath, base64Data, "base64");

    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ─── Virtual Camera IPC Handlers ─────────────────────────────────
ipcMain.handle("vcam-start", (event, resolution) => {
  return vcam.start(resolution || "480p");
});

ipcMain.handle("vcam-stop", () => {
  vcam.stop();
  return { success: true };
});

ipcMain.handle("vcam-send-frame", (event, buffer) => {
  if (!vcam.isActive) return false;

  try {
    const bgrBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    return vcam.sendFrame(bgrBuffer);
  } catch (err) {
    return false;
  }
});

ipcMain.handle("vcam-change-resolution", (event, resolution) => {
  return vcam.changeResolution(resolution);
});

ipcMain.handle("vcam-status", () => {
  return vcam.getStatus();
});

ipcMain.handle("vcam-install-driver", async () => {
  return await vcam.installDriver();
});

ipcMain.handle("vcam-uninstall-driver", async () => {
  return await vcam.uninstallDriver();
});

// ─── Server Configuration & Environment ─────────────────────────
ipcMain.handle("get-server-config", () => {
  const port = process.env.PORT || process.env.BACKEND_PORT || 4000;
  const localIp = getPrimaryLocalIp();
  const defaultUrl = process.env.BACKEND_URL || process.env.SERVER_URL || process.env.SIGNALING_SERVER || `https://cam-backend-4bdx.onrender.com`;
  const usbHost = process.env.USB_HOST || process.env.LOCAL_IP || "127.0.0.1";

  return {
    serverUrl: defaultUrl,
    port: parseInt(port, 10),
    localIp: localIp,
    usbHost: usbHost,
  };
});

// ─── USB Mode & ADB Tunneling ───────────────────────────────────
ipcMain.handle("start-usb-tunnel", async () => {
  const { exec } = require("child_process");
  const tunnelPort = process.env.PORT || process.env.TUNNEL_PORT || 4000;
  const usbHost = process.env.USB_HOST || "127.0.0.1";

  return new Promise((resolve) => {
    exec(`adb reverse tcp:${tunnelPort} tcp:${tunnelPort}`, (error, stdout, stderr) => {
      if (error) {
        // Fallback: check if USB tethering network interface is available
        resolve({
          success: false,
          error: "ADB reverse failed. Please make sure USB Debugging is ON or use USB Tethering.",
          details: stderr || error.message,
        });
      } else {
        resolve({
          success: true,
          message: `USB High-Speed Tunnel Active (${usbHost}:${tunnelPort})`,
          endpoint: `http://${usbHost}:${tunnelPort}`,
        });
      }
    });
  });
});

ipcMain.handle("check-adb-devices", async () => {
  const { exec } = require("child_process");
  return new Promise((resolve) => {
    exec("adb devices", (error, stdout) => {
      if (error) {
        resolve({ success: false, devices: [] });
      } else {
        const lines = stdout.split("\n").filter((l) => l.includes("\tdevice"));
        const devices = lines.map((l) => l.split("\t")[0].trim());
        resolve({ success: true, devices });
      }
    });
  });
});

// ─── App Lifecycle ───────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  vcam.stop();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  vcam.stop();
});
