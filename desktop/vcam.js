/**
 * PhoneCam Virtual Camera Module
 * 
 * Uses koffi (FFI) to interface with softcam.dll — a DirectShow
 * virtual camera filter that registers as a system camera device.
 * 
 * Softcam C API:
 *   scCamera scCreateCamera(int width, int height, float framerate)
 *   void     scSendFrame(scCamera camera, const void* data)
 *   bool     scWaitForConnection(scCamera camera, float timeout)
 *   void     scDeleteCamera(scCamera camera)
 * 
 * Softcam Image Format:
 *   24-bit BGR (3 bytes per pixel: B, G, R), top-down.
 */

const path = require("path");
const fs = require("fs");

// Resolution presets (width and height MUST be multiples of 4 and 16:9 widescreen format)
const RESOLUTIONS = {
  "480p": { width: 848, height: 480 },
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
};

const DLL_NAME = "softcam.dll";

function resolveDllPath() {
  const candidatePaths = [
    // 1. Unpacked ASAR path (production packaged app)
    path.join(__dirname.replace("app.asar", "app.asar.unpacked"), "bin", DLL_NAME),
    // 2. Extra resources directory (resources/bin)
    process.resourcesPath ? path.join(process.resourcesPath, "bin", DLL_NAME) : "",
    process.resourcesPath ? path.join(process.resourcesPath, "app.asar.unpacked", "bin", DLL_NAME) : "",
    // 3. Current Working Directory (development or standalone)
    path.join(process.cwd(), "bin", DLL_NAME),
    path.join(process.cwd(), "desktop", "bin", DLL_NAME),
    // 4. Default __dirname (only valid when NOT inside app.asar)
    path.join(__dirname, "bin", DLL_NAME),
  ].filter(Boolean);

  for (const p of candidatePaths) {
    // Windows OS native LoadLibrary CANNOT load DLLs from inside an asar archive!
    if (p.includes("app.asar") && !p.includes("app.asar.unpacked")) {
      continue;
    }
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return path.join(__dirname.replace("app.asar", "app.asar.unpacked"), "bin", DLL_NAME);
}

class VirtualCamera {
  constructor() {
    this.camera = null;
    this.lib = null;
    this.currentResolution = "480p";
    this.isActive = false;
    this.fps = 0; // 0 = real-time variable rate without artificial sleep
    this._api = null;
    this._dllPath = resolveDllPath();
    this._lastError = null;
  }

  isDllPresent() {
    this._dllPath = resolveDllPath();
    return fs.existsSync(this._dllPath);
  }

  isDriverRegistered() {
    if (process.platform !== "win32") {
      try {
        return fs.existsSync("/dev/video0") || fs.existsSync("/dev/video1") || fs.existsSync("/dev/video2");
      } catch {
        return false;
      }
    }
    try {
      const { execSync } = require("child_process");
      const result = execSync(
        'reg query "HKLM\\SOFTWARE\\Classes\\CLSID\\{860BB310-5D01-11d0-BD3B-00A0C911CE86}\\Instance" /s /f "Softcam" 2>nul',
        { encoding: "utf8", timeout: 5000 }
      );
      return result.toLowerCase().includes("softcam");
    } catch {
      return false;
    }
  }

  _loadLibrary() {
    if (process.platform !== "win32") {
      // Linux uses v4l2 / WebRTC rendering
      return true;
    }
    if (this._api) return true;

    this._dllPath = resolveDllPath();
    if (!this.isDllPresent()) {
      this._lastError = `DLL not found at: ${this._dllPath}`;
      console.error(`[VCam] ${this._lastError}`);
      return false;
    }

    try {
      const koffi = require("koffi");
      this.lib = koffi.load(this._dllPath);

      this._api = {
        scCreateCamera: this.lib.func(
          "void* __cdecl scCreateCamera(int width, int height, float framerate)"
        ),
        scSendFrame: this.lib.func(
          "void __cdecl scSendFrame(void* camera, const void* data)"
        ),
        scWaitForConnection: this.lib.func(
          "bool __cdecl scWaitForConnection(void* camera, float timeout)"
        ),
        scDeleteCamera: this.lib.func(
          "void __cdecl scDeleteCamera(void* camera)"
        ),
      };

      console.log(`[VCam] softcam.dll loaded successfully via koffi from: ${this._dllPath}`);
      return true;
    } catch (err) {
      this._lastError = err.message || "Failed to load softcam.dll";
      console.error("[VCam] Failed to load softcam.dll:", err);
      this._api = null;
      return false;
    }
  }

  start(resolution = "480p") {
    const res = RESOLUTIONS[resolution] || RESOLUTIONS["480p"];

    if (this.isActive && this.camera) {
      if (this.currentResolution === resolution) {
        return { success: true, alreadyRunning: true };
      }
      this.stop();
    }

    if (process.platform !== "win32") {
      this.currentResolution = resolution;
      this.isActive = true;
      this.camera = "linux-vcam-active";
      console.log(`[VCam] Linux virtual camera ready: ${res.width}x${res.height}`);
      return {
        success: true,
        width: res.width,
        height: res.height,
        fps: 30,
        resolution,
      };
    }

    if (!this._loadLibrary()) {
      return {
        success: false,
        error: this._lastError || "Failed to load softcam.dll. Make sure it exists in desktop/bin/",
      };
    }

    try {
      // 0.0f framerate = immediate delivery for real-time webcam streams
      this.camera = this._api.scCreateCamera(res.width, res.height, 0.0);

      if (!this.camera) {
        return {
          success: false,
          error: "scCreateCamera returned null. An existing virtual camera instance may be open.",
        };
      }

      this.currentResolution = resolution;
      this.isActive = true;

      // Push initial black BGR standby frame (width * height * 3 bytes)
      const standbyBuffer = Buffer.alloc(res.width * res.height * 3, 10);
      this.sendFrame(standbyBuffer);

      console.log(`[VCam] Virtual camera initialized: ${res.width}x${res.height} (24-bit BGR)`);

      return {
        success: true,
        width: res.width,
        height: res.height,
        fps: 30,
        resolution,
      };
    } catch (err) {
      console.error("[VCam] Failed to create camera:", err.message);
      this.camera = null;
      this.isActive = false;
      return { success: false, error: err.message };
    }
  }

  /**
   * Send 24-bit BGR frame data (3 bytes per pixel) to the virtual camera
   * @param {Buffer} bgrBuffer 
   */
  sendFrame(bgrBuffer) {
    if (!this.isActive) return false;
    if (process.platform !== "win32") {
      return true;
    }
    if (!this.camera || !this._api) return false;

    try {
      this._api.scSendFrame(this.camera, bgrBuffer);
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Fast conversion from 32-bit RGBA (Canvas ImageData) to 24-bit BGR (Softcam DirectShow)
   * @param {Buffer|Uint8Array} rgbaBuffer 
   * @param {number} width 
   * @param {number} height 
   * @returns {Buffer} 24-bit BGR Buffer (width * height * 3 bytes)
   */
  static rgbaToBgr(rgbaBuffer, width, height) {
    const totalPixels = width * height;
    const out = Buffer.allocUnsafe(totalPixels * 3);

    let srcIdx = 0;
    let dstIdx = 0;

    for (let i = 0; i < totalPixels; i++) {
      out[dstIdx] = rgbaBuffer[srcIdx + 2];     // B
      out[dstIdx + 1] = rgbaBuffer[srcIdx + 1]; // G
      out[dstIdx + 2] = rgbaBuffer[srcIdx];     // R
      srcIdx += 4;
      dstIdx += 3;
    }

    return out;
  }

  changeResolution(newResolution) {
    if (!RESOLUTIONS[newResolution]) {
      return { success: false, error: `Unknown resolution: ${newResolution}` };
    }

    if (this.isActive) {
      this.stop();
      return this.start(newResolution);
    }

    this.currentResolution = newResolution;
    return { success: true, resolution: newResolution };
  }

  stop() {
    if (this.camera && this._api) {
      try {
        this._api.scDeleteCamera(this.camera);
        console.log("[VCam] Virtual camera released");
      } catch (err) {
        console.error("[VCam] Error releasing camera:", err.message);
      }
    }

    this.camera = null;
    this.isActive = false;
  }

  getStatus() {
    return {
      isActive: this.isActive,
      currentResolution: this.currentResolution,
      isDllPresent: this.isDllPresent(),
      isDriverRegistered: this.isDriverRegistered(),
      fps: 30,
      resolution: RESOLUTIONS[this.currentResolution],
    };
  }

  async installDriver() {
    if (!this.isDllPresent()) {
      return { success: false, error: "softcam.dll not found in desktop/bin/" };
    }

    return new Promise((resolve) => {
      const sudo = require("sudo-prompt");
      const options = { name: "PhoneCam Virtual Camera" };
      const cmd = `regsvr32 /s "${this._dllPath}"`;

      sudo.exec(cmd, options, (error) => {
        if (error) {
          resolve({ success: false, error: error.message });
        } else {
          resolve({ success: true });
        }
      });
    });
  }

  async uninstallDriver() {
    return new Promise((resolve) => {
      const sudo = require("sudo-prompt");
      const options = { name: "PhoneCam Virtual Camera" };
      const cmd = `regsvr32 /u /s "${this._dllPath}"`;

      sudo.exec(cmd, options, (error) => {
        if (error) {
          resolve({ success: false, error: error.message });
        } else {
          resolve({ success: true });
        }
      });
    });
  }
}

module.exports = { VirtualCamera, RESOLUTIONS };
