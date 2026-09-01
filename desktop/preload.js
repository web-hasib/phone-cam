const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Existing APIs
  getLocalIp: () => ipcRenderer.invoke("get-local-ip"),
  getServerConfig: () => ipcRenderer.invoke("get-server-config"),
  setAlwaysOnTop: (flag) => ipcRenderer.invoke("set-always-on-top", flag),
  saveSnapshot: (dataUrl) => ipcRenderer.invoke("save-snapshot", dataUrl),
  generateQrDataUrl: (text) => ipcRenderer.invoke("generate-qr", text),

  // Virtual Camera APIs
  vcamStart: (resolution) => ipcRenderer.invoke("vcam-start", resolution),
  vcamStop: () => ipcRenderer.invoke("vcam-stop"),
  vcamSendFrame: (buffer) => ipcRenderer.invoke("vcam-send-frame", buffer),
  vcamChangeResolution: (resolution) =>
    ipcRenderer.invoke("vcam-change-resolution", resolution),
  vcamStatus: () => ipcRenderer.invoke("vcam-status"),
  vcamInstallDriver: () => ipcRenderer.invoke("vcam-install-driver"),
  vcamUninstallDriver: () => ipcRenderer.invoke("vcam-uninstall-driver"),

  // USB High-Speed Mode APIs
  startUsbTunnel: () => ipcRenderer.invoke("start-usb-tunnel"),
  checkAdbDevices: () => ipcRenderer.invoke("check-adb-devices"),
});
