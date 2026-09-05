// PhoneCam Desktop Studio - Receiver, Studio Tuning & Virtual Camera Client

const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelay",
      credential: "openrelay",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelay",
      credential: "openrelay",
    },
  ],
  iceCandidatePoolSize: 10,
};

function generateSessionId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let part1 = "";
  let part2 = "";
  for (let i = 0; i < 4; i++) {
    part1 += chars.charAt(Math.floor(Math.random() * chars.length));
    part2 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${part1}-${part2}`;
}

// ─── Application State ─────────────────────────────────────────────
let socket = null;
let peerConnection = null;
let sessionId = generateSessionId();
let serverUrl = "https://cam-backend-4bdx.onrender.com";
let isPinned = false;
let isAudioMuted = false;
let audioVolume = 1.0;
let iceCandidateQueue = [];
let isPhoneConnected = false;
let connectedDevices = [];
let activeMobileSocketId = null;
let lastFrameTime = 0;
let frameCount = 0;

// Audio Visualizer State
let audioCtx = null;
let analyserNode = null;
let audioSourceNode = null;
let audioAnimId = null;

// Virtual Camera State
let vcamActive = false;
let vcamResolution = "480p";
let vcamFitMode = "contain"; // "contain" | "cover"
let vcamFrameInterval = null;
const vcamCanvas = document.createElement("canvas");
const vcamCtx = vcamCanvas.getContext("2d", { willReadFrequently: true });

const VCAM_RESOLUTIONS = {
  "480p": { width: 848, height: 480 },
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
};

// ─── Studio Tuning State ───────────────────────────────────────────
let studioSettings = {
  mirrorH: false,
  flipV: false,
  rotation: 0, // 0, 90, 180, 270
  zoom: 1.0,   // 1.0 - 3.0
  brightness: 100,
  contrast: 100,
  saturation: 100,
  warmth: 0,
};

const PRESETS = {
  normal: { brightness: 100, contrast: 100, saturation: 100, warmth: 0 },
  studio: { brightness: 106, contrast: 116, saturation: 124, warmth: 4 },
  beauty: { brightness: 112, contrast: 98, saturation: 108, warmth: 12 },
  cinematic: { brightness: 94, contrast: 124, saturation: 112, warmth: 22 },
  bw: { brightness: 106, contrast: 126, saturation: 0, warmth: 0 },
  cool: { brightness: 102, contrast: 108, saturation: 92, warmth: -15 },
};

// ─── DOM Elements ──────────────────────────────────────────────────
const statusBadge = document.getElementById("statusBadge");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const remoteVideo = document.getElementById("remoteVideo");
const framePreview = document.getElementById("framePreview");
const viewportOverlay = document.getElementById("viewportOverlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayDesc = document.getElementById("overlayDesc");
const liveHud = document.getElementById("liveHud");
const hudActiveDevice = document.getElementById("hudActiveDevice");
const hudResolution = document.getElementById("hudResolution");
const hudFps = document.getElementById("hudFps");
const hudFpsBadge = document.getElementById("hudFpsBadge");
const vuBar = document.getElementById("vuBar");
const shutterFlash = document.getElementById("shutterFlash");
const toastBanner = document.getElementById("toastBanner");
const qrImg = document.getElementById("qrImg");
const sessionCode = document.getElementById("sessionCode");
const serverIpEl = document.getElementById("serverIp");
const cameraSwitcherPill = document.getElementById("cameraSwitcherPill");
const cameraSelect = document.getElementById("cameraSelect");
const deviceCountEl = document.getElementById("deviceCount");
const deviceListContainer = document.getElementById("deviceListContainer");
const diagActiveCamera = document.getElementById("diagActiveCamera");

// Controls
const btnPin = document.getElementById("btnPin");
const btnMute = document.getElementById("btnMute");
const audioLabel = document.getElementById("audioLabel");
const iconUnmuted = document.getElementById("iconUnmuted");
const iconMuted = document.getElementById("iconMuted");
const volumeSlider = document.getElementById("volumeSlider");
const btnSnapshot = document.getElementById("btnSnapshot");
const btnPip = document.getElementById("btnPip");
const btnFullscreen = document.getElementById("btnFullscreen");
const btnReconnect = document.getElementById("btnReconnect");

// Virtual Camera Controls
const btnVcamBottom = document.getElementById("btnVcamBottom");
const vcamBottomLabel = document.getElementById("vcamBottomLabel");
const vcamBottomDot = document.getElementById("vcamBottomDot");
const vcamIconOn = document.getElementById("vcamIconOn");
const vcamIconOff = document.getElementById("vcamIconOff");
const btnVcamToggle = document.getElementById("btnVcamToggle");
const vcamStatusDot = document.getElementById("vcamStatusDot");
const vcamStatusText = document.getElementById("vcamStatusText");
const vcamResSelect = document.getElementById("vcamResSelect");
const vcamFitSelect = document.getElementById("vcamFitSelect");
const vcamDriverStatus = document.getElementById("vcamDriverStatus");
const btnVcamInstallDriver = document.getElementById("btnVcamInstallDriver");

// Studio Tuning Controls
const btnMirrorH = document.getElementById("btnMirrorH");
const btnFlipV = document.getElementById("btnFlipV");
const rotateButtons = document.querySelectorAll(".btn-rotate");
const sliderZoom = document.getElementById("sliderZoom");
const zoomVal = document.getElementById("zoomVal");
const sliderBrightness = document.getElementById("sliderBrightness");
const sliderContrast = document.getElementById("sliderContrast");
const sliderSaturation = document.getElementById("sliderSaturation");
const sliderWarmth = document.getElementById("sliderWarmth");
const valBrightness = document.getElementById("valBrightness");
const valContrast = document.getElementById("valContrast");
const valSaturation = document.getElementById("valSaturation");
const valWarmth = document.getElementById("valWarmth");
const btnResetFilters = document.getElementById("btnResetFilters");
const chipButtons = document.querySelectorAll(".chip-btn");

// ─── Notification Toast ────────────────────────────────────────────
function showToast(message, duration = 2400) {
  if (!toastBanner) return;
  toastBanner.textContent = message;
  toastBanner.classList.add("show");
  setTimeout(() => {
    toastBanner.classList.remove("show");
  }, duration);
}

// ─── Connection Mode & UI Status ───────────────────────────────────
let currentConnectionMode = "waiting";

function updateConnectionMode(mode, customText = "") {
  currentConnectionMode = mode;
  if (!statusBadge || !statusText || !statusDot) return;

  statusBadge.className = "status-badge";
  statusDot.className = "status-dot";

  if (mode === "usb") {
    statusBadge.classList.add("mode-usb");
    statusDot.classList.add("connected", "pulse-cyan");
    statusText.innerHTML = `<strong>⚡ USB Mode</strong> (0ms Zero-Lag)`;
    if (hudActiveDevice) hudActiveDevice.textContent = `⚡ USB • Phone Camera`;
  } else if (mode === "webrtc") {
    statusBadge.classList.add("mode-webrtc");
    statusDot.classList.add("connected");
    statusText.innerHTML = `<strong>📶 Wi-Fi Mode</strong> (Direct P2P HD)`;
    if (hudActiveDevice) hudActiveDevice.textContent = `📶 Wi-Fi • Phone Camera`;
  } else if (mode === "turboframe") {
    statusBadge.classList.add("mode-turbo");
    statusDot.classList.add("connected");
    statusText.innerHTML = `<strong>⚡ Wi-Fi Mode</strong> (TurboFrame Realtime)`;
    if (hudActiveDevice) hudActiveDevice.textContent = `📶 Wi-Fi • Phone Camera`;
  } else if (mode === "error") {
    statusDot.classList.add("error");
    statusText.textContent = customText || "Disconnected";
  } else {
    statusText.textContent = customText || "Waiting for phone connection...";
  }
}

function setStatus(text, type = "normal") {
  if (type === "connected") {
    updateConnectionMode("webrtc");
  } else if (type === "error") {
    updateConnectionMode("error", text);
  } else {
    updateConnectionMode("waiting", text);
  }
}

// ─── Generate QR Code ──────────────────────────────────────────────
async function updateQrCode() {
  if (sessionCode) sessionCode.textContent = sessionId;

  const mobileEndpoint = serverUrl;
  if (serverIpEl) serverIpEl.textContent = mobileEndpoint;

  const directLink = `${mobileEndpoint}/?room=${sessionId}`;

  if (window.electronAPI && window.electronAPI.generateQrDataUrl) {
    try {
      const dataUrl = await window.electronAPI.generateQrDataUrl(directLink);
      if (dataUrl && qrImg) {
        qrImg.src = dataUrl;
        return;
      }
    } catch (err) {
      console.warn("Local QR generation failed, falling back:", err);
    }
  }

  if (qrImg) {
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(directLink)}`;
  }
}

// ─── Multi-Device List Renderer ────────────────────────────────────
function renderDeviceList(devices, activeSocketId) {
  connectedDevices = devices || [];
  activeMobileSocketId = activeSocketId;

  if (deviceCountEl) deviceCountEl.textContent = connectedDevices.length.toString();

  if (cameraSelect && cameraSwitcherPill) {
    cameraSelect.innerHTML = "";
    if (connectedDevices.length > 1) {
      cameraSwitcherPill.style.display = "flex";
      connectedDevices.forEach((dev) => {
        const opt = document.createElement("option");
        opt.value = dev.socketId;
        opt.textContent = dev.deviceName;
        if (dev.socketId === activeSocketId) opt.selected = true;
        cameraSelect.appendChild(opt);
      });
    } else {
      cameraSwitcherPill.style.display = "none";
    }
  }

  if (deviceListContainer) {
    deviceListContainer.innerHTML = "";
    if (connectedDevices.length === 0) {
      deviceListContainer.innerHTML = '<div class="no-devices-msg">No phones connected yet</div>';
      if (diagActiveCamera) diagActiveCamera.textContent = "None";
      return;
    }

    connectedDevices.forEach((dev) => {
      const isActive = dev.socketId === activeSocketId;
      const item = document.createElement("div");
      item.className = `device-item ${isActive ? "active" : ""}`;
      item.innerHTML = `
        <span class="device-name">${dev.deviceName}</span>
        <span class="device-badge ${isActive ? "active" : ""}">${isActive ? "LIVE" : "STANDBY"}</span>
      `;
      item.addEventListener("click", () => {
        if (!isActive && socket && socket.connected) {
          socket.emit("switch-active-camera", {
            roomId: sessionId,
            targetSocketId: dev.socketId,
          });
        }
      });
      deviceListContainer.appendChild(item);
    });

    const activeDev = connectedDevices.find((d) => d.socketId === activeSocketId);
    if (activeDev) {
      if (diagActiveCamera) diagActiveCamera.textContent = activeDev.deviceName;
      if (hudActiveDevice) hudActiveDevice.textContent = activeDev.deviceName;
    }
  }
}

// ─── Audio Engine & Live VU Meter ──────────────────────────────────
function setupAudioVisualizer(stream) {
  if (!stream || stream.getAudioTracks().length === 0) return;

  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    if (audioSourceNode) {
      try { audioSourceNode.disconnect(); } catch (e) {}
      audioSourceNode = null;
    }

    audioSourceNode = audioCtx.createMediaStreamSource(stream);
    if (!analyserNode) {
      analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 64;
    }
    audioSourceNode.connect(analyserNode);

    const dataArray = new Uint8Array(analyserNode.frequencyBinCount);

    if (audioAnimId) cancelAnimationFrame(audioAnimId);

    const updateVu = () => {
      if (analyserNode && !isAudioMuted && vuBar) {
        analyserNode.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const pct = Math.min(100, Math.round((avg / 128) * 100));
        vuBar.style.width = `${pct}%`;
      } else if (vuBar) {
        vuBar.style.width = "0%";
      }
      audioAnimId = requestAnimationFrame(updateVu);
    };

    updateVu();
  } catch (err) {
    console.warn("Audio visualizer setup skipped:", err);
  }
}

// ─── WebRTC Engine ─────────────────────────────────────────────────
function initWebRTC(targetSocketId = null) {
  if (targetSocketId) {
    activeMobileSocketId = targetSocketId;
  }

  iceCandidateQueue = [];

  if (peerConnection && peerConnection.signalingState !== "closed") {
    try { peerConnection.close(); } catch (e) {}
  }

  peerConnection = new RTCPeerConnection(RTC_CONFIG);

  // Incoming video and audio tracks
  peerConnection.ontrack = (event) => {
    console.log("Remote track received:", event.track.kind);

    let stream = event.streams && event.streams[0];
    if (!stream) {
      if (!remoteVideo.srcObject) {
        remoteVideo.srcObject = new MediaStream();
      }
      remoteVideo.srcObject.addTrack(event.track);
      stream = remoteVideo.srcObject;
    } else if (remoteVideo.srcObject !== stream) {
      // Guard against resetting video pipeline on subsequent tracks (e.g. audio track arriving after video)
      remoteVideo.srcObject = stream;
    }

    remoteVideo.muted = isAudioMuted;
    remoteVideo.volume = audioVolume;
    remoteVideo.style.display = "block";
    if (framePreview) framePreview.style.display = "none";

    const playPromise = remoteVideo.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          if (remoteVideo.videoWidth) {
            hudResolution.textContent = `${remoteVideo.videoWidth} x ${remoteVideo.videoHeight}`;
          }
          setupAudioVisualizer(stream);
        })
        .catch((err) => {
          console.warn("Autoplay notice, retrying with muted:", err);
          // If browser Autoplay policy blocks unmuted video, mute & resume immediately
          remoteVideo.muted = true;
          remoteVideo.play().then(() => {
            if (remoteVideo.videoWidth) {
              hudResolution.textContent = `${remoteVideo.videoWidth} x ${remoteVideo.videoHeight}`;
            }
            setupAudioVisualizer(stream);
          }).catch((err2) => console.warn("Muted autoplay also failed:", err2));
        });
    }

    viewportOverlay.style.display = "none";
    liveHud.style.display = "flex";
    setStatus("Live Streaming (WebRTC P2P)", "connected");

    if (!vcamActive) {
      startVcam();
    }
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate && socket && socket.connected) {
      const destId = targetSocketId || activeMobileSocketId;
      socket.emit("ice-candidate", {
        roomId: sessionId,
        candidate: event.candidate,
        from: "desktop",
        targetSocketId: destId,
      });
    }
  };

  peerConnection.onconnectionstatechange = () => {
    const state = peerConnection.connectionState;
    if (state === "connected") {
      setStatus("Live Streaming (WebRTC P2P)", "connected");
      viewportOverlay.style.display = "none";
      liveHud.style.display = "flex";
    } else if (state === "disconnected" || state === "failed") {
      console.warn("WebRTC connection state:", state);
      // If WebRTC drops, reveal TurboFrame if it is transmitting
      if (framePreview && framePreview.naturalWidth > 0) {
        framePreview.style.display = "block";
        remoteVideo.style.display = "none";
      }
    }
  };
}

// ─── Socket.IO Signaling ───────────────────────────────────────────
function connectSocket() {
  setStatus("Connecting to server...");

  if (socket) {
    socket.disconnect();
  }

  socket = io(serverUrl, {
    transports: ["websocket", "polling"],
  });

  socket.on("connect", () => {
    setStatus("Server connected. Waiting for phone...");
    socket.emit("join-room", {
      roomId: sessionId,
      clientType: "desktop",
    });
  });

  socket.on("peer-joined", (data) => {
    if (data.clientType === "mobile") {
      isPhoneConnected = true;
      setStatus(`Phone connected (${data.deviceName || "Camera"})...`, "connected");
      viewportOverlay.style.display = "none";
      liveHud.style.display = "flex";

      if (data.devices) {
        renderDeviceList(data.devices, data.activeSocketId);
      }

      if (!vcamActive) {
        startVcam();
      }
    }
  });

  socket.on("device-list-updated", (data) => {
    if (data && data.devices) {
      renderDeviceList(data.devices, data.activeSocketId);
      if (data.devices.length > 0) {
        isPhoneConnected = true;
        viewportOverlay.style.display = "none";
        liveHud.style.display = "flex";
      }
    }
  });

  socket.on("active-camera-changed", (data) => {
    if (data) {
      activeMobileSocketId = data.activeSocketId;
      renderDeviceList(connectedDevices, data.activeSocketId);
      setStatus(`Live: ${data.deviceName || "Phone Camera"}`, "connected");
    }
  });

  socket.on("phone-rotation", (data) => {
    if (data && typeof data.rotation === "number") {
      studioSettings.rotation = data.rotation;
      rotateButtons.forEach((b) => b.classList.toggle("active", b.dataset.rot === String(data.rotation)));
      updateViewportPreviewStyle();
      showToast(`Phone orientation: ${data.rotation}°`);
    }
  });

  socket.on("webrtc-offer", async (data) => {
    if (data.from !== "mobile") return;
    const fromSocketId = data.fromSocketId;
    activeMobileSocketId = fromSocketId;

    try {
      // Always initialize a fresh peer connection for incoming offer from mobile
      initWebRTC(fromSocketId);

      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));

      while (iceCandidateQueue.length > 0) {
        const candidate = iceCandidateQueue.shift();
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {}
      }

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      socket.emit("webrtc-answer", {
        roomId: sessionId,
        sdp: answer,
        from: "desktop",
        targetSocketId: fromSocketId,
      });
    } catch (err) {
      console.error("WebRTC Offer error:", err);
    }
  });

  socket.on("ice-candidate", async (data) => {
    if (data.from !== "mobile") return;
    try {
      if (peerConnection && peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      } else {
        iceCandidateQueue.push(data.candidate);
      }
    } catch (err) {}
  });

  socket.on("video-frame", (data) => {
    if (!data || !data.image) return;

    if (activeMobileSocketId && data.fromSocketId && data.fromSocketId !== activeMobileSocketId) {
      return;
    }

    isPhoneConnected = true;

    if (framePreview) {
      framePreview.style.display = "block";
      framePreview.src = data.image;
    }
    if (remoteVideo.style.display !== "none" && (!remoteVideo.videoWidth || remoteVideo.paused)) {
      remoteVideo.style.display = "none";
    }

    viewportOverlay.style.display = "none";
    liveHud.style.display = "flex";
    setStatus("Live Streaming (TurboFrame)", "connected");

    frameCount++;
    const now = performance.now();
    if (now - lastFrameTime >= 1000) {
      const fpsText = `${frameCount} fps`;
      if (hudFps) hudFps.textContent = fpsText;
      if (hudFpsBadge) hudFpsBadge.textContent = fpsText;
      frameCount = 0;
      lastFrameTime = now;
    }

    if (!vcamActive) {
      startVcam();
    }
  });

  socket.on("peer-disconnected", (data) => {
    if (data && data.allDisconnected) {
      isPhoneConnected = false;
      renderDeviceList([], null);
      setStatus("Phone disconnected", "error");
      viewportOverlay.style.display = "flex";
      liveHud.style.display = "none";
      if (framePreview) framePreview.style.display = "none";
      remoteVideo.style.display = "block";
      overlayTitle.textContent = "Phone Disconnected";
      overlayDesc.textContent = "Scan the QR code to reconnect.";
    }
  });

  socket.on("connect_error", () => {
    setStatus("Connecting to server...", "error");
  });
}

// ─── Studio Video Transforms & Color Filter Engine ───────────────────
function buildCssFilterString() {
  const b = studioSettings.brightness;
  const c = studioSettings.contrast;
  const s = studioSettings.saturation;
  const w = studioSettings.warmth;

  let filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
  if (w > 0) {
    filter += ` sepia(${w * 0.4}%) hue-rotate(-${w * 0.3}deg)`;
  } else if (w < 0) {
    filter += ` hue-rotate(${Math.abs(w) * 0.5}deg)`;
  }
  return filter;
}

function updateViewportPreviewStyle() {
  const filter = buildCssFilterString();
  const mirrorX = studioSettings.mirrorH ? -1 : 1;
  const flipY = studioSettings.flipV ? -1 : 1;
  const rot = studioSettings.rotation;
  const zoom = studioSettings.zoom;

  const transform = `scale(${mirrorX * zoom}, ${flipY * zoom}) rotate(${rot}deg)`;

  if (remoteVideo) {
    remoteVideo.style.filter = filter;
    remoteVideo.style.transform = transform;
  }
  if (framePreview) {
    framePreview.style.filter = filter;
    framePreview.style.transform = transform;
  }
}

// ─── Virtual Camera Pipeline (Real-Time 30-33 FPS BGR Streaming) ────
function updateVcamUI(active, statusMsg) {
  vcamActive = active;
  const label = active ? "Stop" : "Start";

  if (btnVcamToggle) {
    btnVcamToggle.textContent = label;
    btnVcamToggle.classList.toggle("active", active);
  }
  if (btnVcamBottom) {
    btnVcamBottom.classList.toggle("active", active);
  }
  if (vcamBottomDot) {
    vcamBottomDot.className = `vcam-dot ${active ? "on" : ""}`;
  }
  if (vcamStatusDot) {
    vcamStatusDot.className = `vcam-dot ${active ? "on" : ""}`;
  }
  if (vcamIconOn && vcamIconOff) {
    vcamIconOn.style.display = active ? "block" : "none";
    vcamIconOff.style.display = active ? "none" : "block";
  }

  const text = statusMsg || (active ? `VCam: ${vcamResolution}` : "VCam: Off");
  if (vcamBottomLabel) vcamBottomLabel.textContent = text;
  if (vcamStatusText) vcamStatusText.textContent = text;
}

let isVcamStarting = false;

async function startVcam() {
  if (vcamActive || isVcamStarting) return;
  if (!window.electronAPI || !window.electronAPI.vcamStart) return;

  isVcamStarting = true;
  try {
    const res = await window.electronAPI.vcamStart(vcamResolution);
    if (res && res.success) {
      updateVcamUI(true, `Live ${vcamResolution}`);
      startVcamFramePipeline();
    } else {
      updateVcamUI(false, res?.error || "Failed to start");
    }
  } catch (err) {
    updateVcamUI(false, err.message);
  } finally {
    isVcamStarting = false;
  }
}

async function stopVcam() {
  if (vcamFrameInterval) {
    clearInterval(vcamFrameInterval);
    vcamFrameInterval = null;
  }
  if (window.electronAPI && window.electronAPI.vcamStop) {
    await window.electronAPI.vcamStop();
  }
  updateVcamUI(false, "Inactive");
}

function startVcamFramePipeline() {
  if (vcamFrameInterval) clearInterval(vcamFrameInterval);

  const targetRes = VCAM_RESOLUTIONS[vcamResolution] || VCAM_RESOLUTIONS["480p"];
  vcamCanvas.width = targetRes.width;
  vcamCanvas.height = targetRes.height;

  const totalPixels = targetRes.width * targetRes.height;
  const bgrOutput = new Uint8Array(totalPixels * 3);
  let isSending = false;

  vcamFrameInterval = setInterval(() => {
    if (!vcamActive) return;

    let source = null;
    let srcW = 0;
    let srcH = 0;

    if (remoteVideo && remoteVideo.videoWidth > 0 && remoteVideo.style.display !== "none" && !remoteVideo.paused) {
      source = remoteVideo;
      srcW = remoteVideo.videoWidth;
      srcH = remoteVideo.videoHeight;
    } else if (framePreview && framePreview.naturalWidth > 0 && framePreview.style.display !== "none") {
      source = framePreview;
      srcW = framePreview.naturalWidth;
      srcH = framePreview.naturalHeight;
    }

    if (!source || srcW === 0) {
      // Push standby frame so Google Meet / Zoom NEVER shows "Camera Unavailable"
      vcamCtx.fillStyle = "#070a13";
      vcamCtx.fillRect(0, 0, targetRes.width, targetRes.height);
      vcamCtx.fillStyle = "#38bdf8";
      vcamCtx.font = "bold 28px sans-serif";
      vcamCtx.textAlign = "center";
      vcamCtx.fillText("PhoneCam Desktop Studio", targetRes.width / 2, targetRes.height / 2 - 10);
      vcamCtx.font = "16px sans-serif";
      vcamCtx.fillStyle = "#64748b";
      vcamCtx.fillText("Connect phone to start live video", targetRes.width / 2, targetRes.height / 2 + 25);
    } else {
      try {
        vcamCtx.save();

        // Clear background to black
        vcamCtx.fillStyle = "#000000";
        vcamCtx.fillRect(0, 0, targetRes.width, targetRes.height);

        // Apply live Studio Color Filter
        vcamCtx.filter = buildCssFilterString();

        // Move to center of canvas for rotation & transforms
        const cx = targetRes.width / 2;
        const cy = targetRes.height / 2;
        vcamCtx.translate(cx, cy);

        // Rotation & Flip
        vcamCtx.rotate((studioSettings.rotation * Math.PI) / 180);
        const scaleX = (studioSettings.mirrorH ? -1 : 1) * studioSettings.zoom;
        const scaleY = (studioSettings.flipV ? -1 : 1) * studioSettings.zoom;
        vcamCtx.scale(scaleX, scaleY);

        // Handle aspect-ratio fitting with 100% true pixel ratio (Zero stretching / distortion)
        const isRotated90 = studioSettings.rotation === 90 || studioSettings.rotation === 270;
        const effectiveSrcW = isRotated90 ? srcH : srcW;
        const effectiveSrcH = isRotated90 ? srcW : srcH;

        let scaleFactor;
        if (vcamFitMode === "contain") {
          scaleFactor = Math.min(targetRes.width / effectiveSrcW, targetRes.height / effectiveSrcH);
        } else {
          // Cover (default): Fill canvas without black bars while maintaining natural aspect ratio
          scaleFactor = Math.max(targetRes.width / effectiveSrcW, targetRes.height / effectiveSrcH);
        }

        const drawW = srcW * scaleFactor;
        const drawH = srcH * scaleFactor;

        // Draw centered image (perfect 1:1 pixel aspect ratio)
        vcamCtx.drawImage(
          source,
          -Math.round(drawW / 2),
          -Math.round(drawH / 2),
          Math.round(drawW),
          Math.round(drawH)
        );

        vcamCtx.restore();
      } catch (e) {}
    }

    try {
      const rgba = vcamCtx.getImageData(0, 0, targetRes.width, targetRes.height).data;

      // Direct Top-Down 24-bit BGR (Right-side up for Google Meet & Zoom)
      let sIdx = 0;
      let dIdx = 0;
      for (let i = 0; i < totalPixels; i++) {
        bgrOutput[dIdx]     = rgba[sIdx + 2]; // B
        bgrOutput[dIdx + 1] = rgba[sIdx + 1]; // G
        bgrOutput[dIdx + 2] = rgba[sIdx];     // R
        sIdx += 4;
        dIdx += 3;
      }

      if (!isSending) {
        isSending = true;
        window.electronAPI.vcamSendFrame(bgrOutput)
          .finally(() => { isSending = false; });
      }
    } catch (e) {
      // Frame skip
    }
  }, 30); // ~33fps
}

// ─── Event Listeners: Studio Tuning Controls ───────────────────────
// Mirror Horizontal Toggle
if (btnMirrorH) {
  btnMirrorH.addEventListener("click", () => {
    studioSettings.mirrorH = !studioSettings.mirrorH;
    btnMirrorH.classList.toggle("active", studioSettings.mirrorH);
    updateViewportPreviewStyle();
    showToast(studioSettings.mirrorH ? "Mirror View: ON" : "Mirror View: OFF");
  });
}

// Flip Vertical Toggle
if (btnFlipV) {
  btnFlipV.addEventListener("click", () => {
    studioSettings.flipV = !studioSettings.flipV;
    btnFlipV.classList.toggle("active", studioSettings.flipV);
    updateViewportPreviewStyle();
  });
}

// Rotation Buttons (0°, 90°, 180°, 270°)
rotateButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    rotateButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    studioSettings.rotation = parseInt(btn.dataset.rot, 10) || 0;
    updateViewportPreviewStyle();
    showToast(`Rotation: ${studioSettings.rotation}°`);
  });
});

// Zoom / Crop Slider
if (sliderZoom) {
  sliderZoom.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value) || 1.0;
    studioSettings.zoom = val;
    if (zoomVal) zoomVal.textContent = `${val.toFixed(1)}x`;
    updateViewportPreviewStyle();
  });
}

// Framing Mode Selector (Fit vs Fill)
if (vcamFitSelect) {
  vcamFitSelect.addEventListener("change", (e) => {
    vcamFitMode = e.target.value;
    showToast(`Framing: ${vcamFitMode === "cover" ? "Fill (Zoom 16:9)" : "Fit (Natural)"}`);
  });
}

// Color Adjustments
function bindSlider(slider, labelEl, key, suffix = "%") {
  if (!slider) return;
  slider.addEventListener("input", (e) => {
    const val = parseInt(e.target.value, 10);
    studioSettings[key] = val;
    if (labelEl) labelEl.textContent = `${val}${suffix}`;
    updateViewportPreviewStyle();
  });
}

bindSlider(sliderBrightness, valBrightness, "brightness");
bindSlider(sliderContrast, valContrast, "contrast");
bindSlider(sliderSaturation, valSaturation, "saturation");
bindSlider(sliderWarmth, valWarmth, "warmth");

// One-Click Preset Chips
chipButtons.forEach((chip) => {
  chip.addEventListener("click", () => {
    chipButtons.forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    const pName = chip.dataset.preset;
    const preset = PRESETS[pName] || PRESETS.normal;

    studioSettings.brightness = preset.brightness;
    studioSettings.contrast = preset.contrast;
    studioSettings.saturation = preset.saturation;
    studioSettings.warmth = preset.warmth;

    if (sliderBrightness) sliderBrightness.value = preset.brightness;
    if (sliderContrast) sliderContrast.value = preset.contrast;
    if (sliderSaturation) sliderSaturation.value = preset.saturation;
    if (sliderWarmth) sliderWarmth.value = preset.warmth;

    if (valBrightness) valBrightness.textContent = `${preset.brightness}%`;
    if (valContrast) valContrast.textContent = `${preset.contrast}%`;
    if (valSaturation) valSaturation.textContent = `${preset.saturation}%`;
    if (valWarmth) valWarmth.textContent = `${preset.warmth}%`;

    updateViewportPreviewStyle();
    showToast(`Preset: ${chip.textContent}`);
  });
});

// Reset Filters Button
if (btnResetFilters) {
  btnResetFilters.addEventListener("click", () => {
    chipButtons.forEach((c) => c.classList.remove("active"));
    const normalChip = document.querySelector('.chip-btn[data-preset="normal"]');
    if (normalChip) normalChip.classList.add("active");

    studioSettings.brightness = 100;
    studioSettings.contrast = 100;
    studioSettings.saturation = 100;
    studioSettings.warmth = 0;
    studioSettings.zoom = 1.0;
    studioSettings.mirrorH = false;
    studioSettings.flipV = false;
    studioSettings.rotation = 0;

    if (btnMirrorH) btnMirrorH.classList.remove("active");
    if (btnFlipV) btnFlipV.classList.remove("active");
    rotateButtons.forEach((b) => b.classList.toggle("active", b.dataset.rot === "0"));

    if (sliderZoom) sliderZoom.value = 1.0;
    if (zoomVal) zoomVal.textContent = "1.0x";

    if (sliderBrightness) sliderBrightness.value = 100;
    if (sliderContrast) sliderContrast.value = 100;
    if (sliderSaturation) sliderSaturation.value = 100;
    if (sliderWarmth) sliderWarmth.value = 0;

    if (valBrightness) valBrightness.textContent = "100%";
    if (valContrast) valContrast.textContent = "100%";
    if (valSaturation) valSaturation.textContent = "100%";
    if (valWarmth) valWarmth.textContent = "0%";

    updateViewportPreviewStyle();
    showToast("Filters & framing reset to default");
  });
}

// ─── Sidebar Navigation Tabs ───────────────────────────────────────
const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("active"));
    tabContents.forEach((c) => c.classList.remove("active"));

    btn.classList.add("active");
    const targetId = btn.dataset.tab;
    const targetContent = document.getElementById(targetId);
    if (targetContent) targetContent.classList.add("active");
  });
});

// ─── Bottom Bar Controls ───────────────────────────────────────────
// Audio Mute / Unmute
if (btnMute) {
  btnMute.addEventListener("click", () => {
    isAudioMuted = !isAudioMuted;
    remoteVideo.muted = isAudioMuted;
    btnMute.classList.toggle("active", !isAudioMuted);

    if (iconUnmuted) iconUnmuted.style.display = isAudioMuted ? "none" : "block";
    if (iconMuted) iconMuted.style.display = isAudioMuted ? "block" : "none";
    if (audioLabel) audioLabel.textContent = isAudioMuted ? "Muted" : "Audio";

    showToast(isAudioMuted ? "Audio Muted" : `Audio Unmuted (${Math.round(audioVolume * 100)}%)`);
  });
}

// Volume Slider
if (volumeSlider) {
  volumeSlider.addEventListener("input", (e) => {
    audioVolume = parseFloat(e.target.value);
    remoteVideo.volume = audioVolume;
    if (isAudioMuted && audioVolume > 0) {
      isAudioMuted = false;
      remoteVideo.muted = false;
      if (iconUnmuted) iconUnmuted.style.display = "block";
      if (iconMuted) iconMuted.style.display = "none";
    }
  });
}

// Snapshot Capture (with Visual Flash Effect)
if (btnSnapshot) {
  btnSnapshot.addEventListener("click", async () => {
    let source = null;
    let w = 1280;
    let h = 720;

    if (remoteVideo && remoteVideo.videoWidth > 0 && remoteVideo.style.display !== "none") {
      source = remoteVideo;
      w = remoteVideo.videoWidth;
      h = remoteVideo.videoHeight;
    } else if (framePreview && framePreview.naturalWidth > 0 && framePreview.style.display !== "none") {
      source = framePreview;
      w = framePreview.naturalWidth;
      h = framePreview.naturalHeight;
    } else {
      showToast("No active camera stream to capture!");
      return;
    }

    // Trigger Camera Shutter Flash
    if (shutterFlash) {
      shutterFlash.classList.add("flash");
      setTimeout(() => shutterFlash.classList.remove("flash"), 200);
    }

    const snapCanvas = document.createElement("canvas");
    snapCanvas.width = w;
    snapCanvas.height = h;
    const snapCtx = snapCanvas.getContext("2d");

    // Apply exact current filters & transforms to snapshot
    snapCtx.filter = buildCssFilterString();
    snapCtx.translate(w / 2, h / 2);
    snapCtx.rotate((studioSettings.rotation * Math.PI) / 180);
    snapCtx.scale(
      (studioSettings.mirrorH ? -1 : 1) * studioSettings.zoom,
      (studioSettings.flipV ? -1 : 1) * studioSettings.zoom
    );
    snapCtx.drawImage(source, -w / 2, -h / 2, w, h);

    const dataUrl = snapCanvas.toDataURL("image/png");

    if (window.electronAPI && window.electronAPI.saveSnapshot) {
      const res = await window.electronAPI.saveSnapshot(dataUrl);
      if (res && res.success) {
        showToast("Snapshot saved to Pictures folder!");
      }
    } else {
      const a = document.createElement("a");
      a.download = `phonecam-${Date.now()}.png`;
      a.href = dataUrl;
      a.click();
      showToast("Snapshot downloaded!");
    }
  });
}

// PiP
if (btnPip) {
  btnPip.addEventListener("click", async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await remoteVideo.requestPictureInPicture();
      }
    } catch (e) {
      showToast("PiP mode is not available in current window.");
    }
  });
}

// Fullscreen
if (btnFullscreen) {
  btnFullscreen.addEventListener("click", () => {
    const container = document.getElementById("videoContainer");
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });
}

// Pin Window
if (btnPin) {
  btnPin.addEventListener("click", async () => {
    isPinned = !isPinned;
    if (window.electronAPI && window.electronAPI.setAlwaysOnTop) {
      const state = await window.electronAPI.setAlwaysOnTop(isPinned);
      btnPin.classList.toggle("active", state);
      showToast(state ? "Window pinned Always-on-Top" : "Window unpinned");
    }
  });
}

// Reconnect / New Session Code
if (btnReconnect) {
  btnReconnect.addEventListener("click", () => {
    sessionId = generateSessionId();
    iceCandidateQueue = [];
    connectedDevices = [];
    activeMobileSocketId = null;
    renderDeviceList([], null);
    initWebRTC();
    updateQrCode();
    connectSocket();
    showToast(`New Session Code: ${sessionId}`);
  });
}

// VCam Toggle Buttons (Navbar & Sidebar)
const toggleVcamHandler = async () => {
  if (vcamActive) {
    await stopVcam();
    showToast("Virtual Camera Stopped");
  } else {
    await startVcam();
    showToast(`Virtual Camera Started (${vcamResolution})`);
  }
};

if (btnVcamToggle) btnVcamToggle.addEventListener("click", toggleVcamHandler);
if (btnVcamBottom) btnVcamBottom.addEventListener("click", toggleVcamHandler);

// VCam Resolution Selector
if (vcamResSelect) {
  vcamResSelect.addEventListener("change", async (e) => {
    vcamResolution = e.target.value;
    if (vcamActive) {
      await stopVcam();
      await startVcam();
    }
    showToast(`Resolution switched to ${vcamResolution}`);
  });
}

// VCam Driver Install
if (btnVcamInstallDriver) {
  btnVcamInstallDriver.addEventListener("click", async () => {
    if (!window.electronAPI || !window.electronAPI.vcamInstallDriver) return;
    btnVcamInstallDriver.textContent = "Installing...";
    btnVcamInstallDriver.disabled = true;
    const res = await window.electronAPI.vcamInstallDriver();
    if (res && res.success) {
      btnVcamInstallDriver.textContent = "Installed";
      if (vcamDriverStatus) vcamDriverStatus.textContent = "Driver: Installed";
      showToast("Driver installed successfully!");
    } else {
      btnVcamInstallDriver.textContent = "Retry Install";
      btnVcamInstallDriver.disabled = false;
      showToast("Driver install failed. Please run as admin.");
    }
  });
}

// Check VCam Status
async function checkVcamStatus() {
  if (!window.electronAPI || !window.electronAPI.vcamStatus) return;
  const status = await window.electronAPI.vcamStatus();
  if (status) {
    if (vcamDriverStatus) {
      vcamDriverStatus.textContent = status.isDriverRegistered
        ? "Driver: Installed"
        : "Driver: Not Installed";
      if (btnVcamInstallDriver) {
        btnVcamInstallDriver.style.display = status.isDriverRegistered ? "none" : "inline-flex";
      }
    }
  }
}

// ─── USB Mode ──────────────────────────────────────────────────────
const btnStartUsbTunnel = document.getElementById("btnStartUsbTunnel");
const usbStatusBadge = document.getElementById("usbStatusBadge");

if (btnStartUsbTunnel) {
  btnStartUsbTunnel.addEventListener("click", async () => {
    if (!window.electronAPI || !window.electronAPI.startUsbTunnel) return;
    btnStartUsbTunnel.textContent = "Connecting USB...";
    const res = await window.electronAPI.startUsbTunnel();
    if (res && res.success) {
      if (usbStatusBadge) {
        usbStatusBadge.textContent = "Active (0ms)";
        usbStatusBadge.style.color = "#38bdf8";
      }
      btnStartUsbTunnel.textContent = "USB Tunnel Active";
      updateConnectionMode("usb");
      showToast("⚡ USB High-Speed Tunnel Active (0ms Latency)!");
    } else {
      if (usbStatusBadge) {
        usbStatusBadge.textContent = "USB Tether Ready";
      }
      btnStartUsbTunnel.textContent = "Retry USB Tunnel";
      showToast("Connect USB & turn on USB Debugging or Tethering");
    }
  });
}

// ─── Draggable & Collapsible Sidebar Engine ────────────────────────
const sidebarSection = document.getElementById("sidebarSection");
const sidebarResizer = document.getElementById("sidebarResizer");
const btnToggleSidebar = document.getElementById("btnToggleSidebar");
let isSidebarCollapsed = false;

// Load saved sidebar width
try {
  const savedWidth = localStorage.getItem("phonecam_sidebar_w");
  if (savedWidth && sidebarSection) {
    sidebarSection.style.width = `${Math.min(550, Math.max(240, parseInt(savedWidth, 10)))}px`;
  }
} catch (e) {}

// Draggable Resizing
if (sidebarResizer && sidebarSection) {
  let isDragging = false;
  let startX = 0;
  let startW = 340;

  sidebarResizer.addEventListener("mousedown", (e) => {
    isDragging = true;
    startX = e.clientX;
    startW = sidebarSection.getBoundingClientRect().width;
    sidebarResizer.classList.add("dragging");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const delta = startX - e.clientX; // Drag left = expand, drag right = shrink
    const newWidth = Math.min(550, Math.max(240, startW + delta));
    sidebarSection.style.width = `${newWidth}px`;
    if (isSidebarCollapsed) {
      isSidebarCollapsed = false;
      sidebarSection.classList.remove("collapsed");
      if (btnToggleSidebar) btnToggleSidebar.classList.remove("active");
    }
  });

  window.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      sidebarResizer.classList.remove("dragging");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try {
        localStorage.setItem("phonecam_sidebar_w", parseInt(sidebarSection.style.width, 10));
      } catch (e) {}
    }
  });

  // Double click resizer to toggle collapse
  sidebarResizer.addEventListener("dblclick", () => {
    toggleSidebarCollapse();
  });
}

function toggleSidebarCollapse() {
  if (!sidebarSection) return;
  isSidebarCollapsed = !isSidebarCollapsed;
  sidebarSection.classList.toggle("collapsed", isSidebarCollapsed);
  if (btnToggleSidebar) btnToggleSidebar.classList.toggle("active", isSidebarCollapsed);
  showToast(isSidebarCollapsed ? "Sidebar Collapsed" : "Sidebar Expanded");
}

if (btnToggleSidebar) {
  btnToggleSidebar.addEventListener("click", toggleSidebarCollapse);
}

// ─── App Initialization ────────────────────────────────────────────
(async function init() {
  if (window.electronAPI && window.electronAPI.getServerConfig) {
    try {
      const config = await window.electronAPI.getServerConfig();
      if (config && config.serverUrl) {
        serverUrl = config.serverUrl;
      }
    } catch (e) {
      console.warn("Failed to get server config:", e);
    }
  }
  initWebRTC();
  await updateQrCode();
  connectSocket();
  await checkVcamStatus();
  await startVcam();
  updateViewportPreviewStyle();
})();
