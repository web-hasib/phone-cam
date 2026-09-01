import React, { useState, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  StatusBar,
  Platform,
  ActivityIndicator,
} from "react-native";
import { WebView } from "react-native-webview";
import { CameraView, useCameraPermissions } from "expo-camera";
import Svg, { Path, Rect, Circle, Line } from "react-native-svg";
import { getBroadcasterHtml } from "./src/broadcasterHtml";

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();

  // Connection State
  const [serverUrl, setServerUrl] = useState("https://cam-backend-4bdx.onrender.com");
  const [roomId, setRoomId] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showScanner, setShowScanner] = useState(true);

  const isScanningRef = useRef(false);

  // Start Streaming
  const startStream = (targetServer: string, targetRoom: string) => {
    if (!targetServer || !targetRoom) return;

    const cleanServer = targetServer.trim().replace(/\/$/, "");
    const cleanRoom = targetRoom.trim().toUpperCase();

    setServerUrl(cleanServer);
    setRoomId(cleanRoom);
    setShowScanner(false);
    setIsStreaming(true);
  };

  const stopStream = () => {
    setIsStreaming(false);
    setShowScanner(true);
  };

  // Handle QR Barcode Scanning
  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (isScanningRef.current) return;
    isScanningRef.current = true;

    try {
      if (data.includes("room=")) {
        const url = new URL(data);
        const r = url.searchParams.get("room") || "";
        const s = url.origin;
        if (r) setRoomId(r);
        if (s) setServerUrl(s);
        startStream(s, r);
      } else {
        const parsed = JSON.parse(data);
        if (parsed.serverUrl && parsed.roomId) {
          startStream(parsed.serverUrl, parsed.roomId);
        } else {
          setRoomId(data);
          startStream(serverUrl, data);
        }
      }
    } catch {
      setRoomId(data);
      startStream(serverUrl, data);
    }

    setTimeout(() => {
      isScanningRef.current = false;
    }, 2000);
  };

  if (!permission) {
    return (
      <View style={styles.darkContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#070a13" />
        <ActivityIndicator size="large" color="#0284c7" />
        <Text style={styles.loadingText}>Initializing PhoneCam...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.darkContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#070a13" />
        <View style={styles.card}>
          <View style={styles.cardIconBox}>
            <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth={2}>
              <Path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
              <Circle cx="12" cy="13" r="3" />
            </Svg>
          </View>
          <Text style={styles.cardTitle}>Camera Permission Required</Text>
          <Text style={styles.cardDesc}>
            PhoneCam needs access to your camera to stream high-definition live video to your desktop.
          </Text>
          <TouchableOpacity style={styles.btnPrimary} onPress={requestPermission} activeOpacity={0.8}>
            <Text style={styles.btnPrimaryText}>Grant Camera Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Active Stream Screen (Guaranteed latest SVG vector UI embedded directly)
  if (isStreaming) {
    return (
      <View style={styles.fullContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" translucent={true} />

        <WebView
          source={{
            html: getBroadcasterHtml(serverUrl, roomId),
            baseUrl: serverUrl,
          }}
          style={StyleSheet.absoluteFillObject}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          mediaCapturePermissionGrantType="grant"
          onPermissionRequest={(event: any) => {
            if (event?.nativeEvent?.grant) {
              event.nativeEvent.grant(event.nativeEvent.resources);
            }
          }}
          onMessage={(event) => {
            if (event.nativeEvent?.data === "disconnect") {
              stopStream();
            }
          }}
          originWhitelist={["*"]}
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#070a13" />

      {/* QR Code Scanner Mode */}
      {showScanner ? (
        <View style={styles.fullContainer}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
            onBarcodeScanned={handleBarcodeScanned}
          />

          <SafeAreaView style={styles.scannerOverlay}>
            <View style={styles.scannerHeader}>
              <Text style={styles.scannerTitle}>Scan Desktop QR Code</Text>
              <Text style={styles.scannerDesc}>
                Point your camera at the QR code on your computer screen.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.btnCancelScan}
              onPress={() => setShowScanner(false)}
              activeOpacity={0.8}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.5}>
                <Line x1="18" y1="6" x2="6" y2="18" />
                <Line x1="6" y1="6" x2="18" y2="18" />
              </Svg>
              <Text style={styles.btnCancelText}>Cancel & Go Back</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      ) : (
        /* Main Pairing Screen */
        <View style={styles.mainLayout}>
          <View style={styles.headerBox}>
            <View style={styles.appIconBox}>
              <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2}>
                <Path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                <Circle cx="12" cy="13" r="3" />
              </Svg>
            </View>
            <Text style={styles.appTitle}>PhoneCam</Text>
            <Text style={styles.appSubtitle}>Wireless Studio Webcam</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pair with Desktop</Text>
            <Text style={styles.cardDesc}>
              Scan the QR code on your desktop screen or enter the Session ID.
            </Text>

            {/* SCAN QR CODE BUTTON (Main Action) */}
            <TouchableOpacity
              style={styles.btnScanQr}
              onPress={() => setShowScanner(true)}
              activeOpacity={0.8}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2}>
                <Rect x="3" y="3" width="7" height="7" rx="1" />
                <Rect x="14" y="3" width="7" height="7" rx="1" />
                <Rect x="14" y="14" width="7" height="7" rx="1" />
                <Rect x="3" y="14" width="7" height="7" rx="1" />
              </Svg>
              <Text style={styles.btnScanQrText}>Scan Desktop QR Code</Text>
            </TouchableOpacity>

            <View style={styles.dividerBox}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR ENTER MANUALLY</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>SERVER ENDPOINT</Text>
              <TextInput
                style={styles.input}
                value={serverUrl}
                onChangeText={setServerUrl}
                placeholder="https://cam-backend-4bdx.onrender.com"
                placeholderTextColor="#475569"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>SESSION / ROOM ID</Text>
              <TextInput
                style={styles.input}
                value={roomId}
                onChangeText={(val) => setRoomId(val.toUpperCase())}
                placeholder="WGXW-BLJ3"
                placeholderTextColor="#475569"
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => startStream(serverUrl, roomId)}
              activeOpacity={0.8}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.5}>
                <Path d="M5 3l14 9-14 9V3z" />
              </Svg>
              <Text style={styles.btnPrimaryText}>Start Live Stream</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#070a13",
  },
  fullContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  darkContainer: {
    flex: 1,
    backgroundColor: "#070a13",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    color: "#94a3b8",
    fontSize: 13,
    marginTop: 14,
    fontWeight: "500",
  },
  mainLayout: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerBox: {
    alignItems: "center",
    marginBottom: 20,
  },
  appIconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#0284c7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    shadowColor: "#0284c7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: -0.3,
  },
  appSubtitle: {
    fontSize: 12,
    color: "#38bdf8",
    fontWeight: "600",
    marginTop: 2,
    letterSpacing: 0.2,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#0b1120",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 22,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 10,
  },
  cardIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
    alignSelf: "center",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f8fafc",
    marginBottom: 4,
    textAlign: "center",
  },
  cardDesc: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 18,
    marginBottom: 18,
    textAlign: "center",
  },
  btnScanQr: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#0284c7",
    borderWidth: 1,
    borderColor: "#38bdf8",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#0284c7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  btnScanQrText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  dividerBox: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#1e293b",
  },
  dividerText: {
    fontSize: 10,
    color: "#475569",
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94a3b8",
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: "#030712",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#f8fafc",
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  btnPrimary: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  btnPrimaryText: {
    color: "#e2e8f0",
    fontWeight: "700",
    fontSize: 13,
  },
  // QR Scanner Overlay
  scannerOverlay: {
    flex: 1,
    justifyContent: "space-between",
    padding: 24,
  },
  scannerHeader: {
    backgroundColor: "rgba(11, 17, 32, 0.92)",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1e293b",
    alignItems: "center",
  },
  scannerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 4,
  },
  scannerDesc: {
    fontSize: 11,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 16,
  },
  btnCancelScan: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "rgba(225, 29, 72, 0.92)",
    borderWidth: 1,
    borderColor: "#f43f5e",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  btnCancelText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
});
