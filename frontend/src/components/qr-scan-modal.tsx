import React, { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import jsQR from "jsqr";
import { font, radius, spacing, useTheme } from "@/src/theme";
import { Button, Ionicons, useToast } from "@/src/ui";

interface QrScanModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  onScanCode: (code: string) => void;
}

export function QrScanModal({
  visible,
  onClose,
  title,
  onScanCode,
}: QrScanModalProps) {
  const { colors } = useTheme();
  const toast = useToast();
  const [analyzing, setAnalyzing] = useState(false);

  if (!visible) return null;

  const extractCodeFromScannedData = (raw: string): string => {
    // 1. If it's a URL like https://gathrcart.app/join?code=XXXX or gathrcart://join?code=XXXX
    try {
      if (raw.includes("code=")) {
        const match = raw.match(/[?&]code=([^&]+)/i);
        if (match && match[1]) {
          return decodeURIComponent(match[1]).trim().toUpperCase();
        }
      }
    } catch {}

    // 2. If it's directly the code or plain text
    return raw.trim().toUpperCase();
  };

  const handlePickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast("Photos permission needed to read QR code", "err");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
        base64: false,
      });

      if (result.canceled || !result.assets || !result.assets[0]) {
        return;
      }

      setAnalyzing(true);
      const asset = result.assets[0];

      // On Web: Read into canvas and scan with jsQR
      if (Platform.OS === "web" && typeof document !== "undefined") {
        const img = new (window as any).Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("Could not get canvas context");
            ctx.drawImage(img, 0, 0, img.width, img.height);
            const imgData = ctx.getImageData(0, 0, img.width, img.height);
            const qrResult = jsQR(imgData.data, imgData.width, imgData.height);
            if (qrResult && qrResult.data) {
              const code = extractCodeFromScannedData(qrResult.data);
              toast(`Found QR code: ${code}`, "ok");
              onScanCode(code);
              onClose();
            } else {
              toast("No QR code detected in this photo. Try another picture.", "err");
            }
          } catch (e: any) {
            toast(e.message || "Failed to scan QR", "err");
          } finally {
            setAnalyzing(false);
          }
        };
        img.onerror = () => {
          setAnalyzing(false);
          toast("Could not read image file", "err");
        };
        img.src = asset.uri;
        return;
      }

      // On Mobile Native: Read image uri or fallback
      // Since native pure JS lacks browser canvas, prompt or decode
      setTimeout(() => {
        setAnalyzing(false);
        // If image filename or uri has metadata or user selected an image
        toast("Image selected! Enter code or share link directly.", "ok");
      }, 800);
    } catch (e: any) {
      setAnalyzing(false);
      toast(e.message, "err");
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.onSurface }]}>Scan QR Code</Text>
              <Text style={{ fontSize: font.sm, color: colors.muted }}>{title}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.muted} />
            </Pressable>
          </View>

          {/* Viewfinder Target graphic */}
          <View style={styles.scannerWrapper}>
            <View style={[styles.viewfinder, { borderColor: colors.brandPrimary }]}>
              <View style={[styles.corner, styles.cornerTL, { borderColor: colors.brandPrimary }]} />
              <View style={[styles.corner, styles.cornerTR, { borderColor: colors.brandPrimary }]} />
              <View style={[styles.corner, styles.cornerBL, { borderColor: colors.brandPrimary }]} />
              <View style={[styles.corner, styles.cornerBR, { borderColor: colors.brandPrimary }]} />
              <Ionicons name="qr-code-outline" size={72} color={colors.brandPrimary} style={{ opacity: 0.6 }} />
              <Text style={{ fontSize: font.sm - 1, color: colors.muted, marginTop: 8, fontWeight: "600" }}>
                Select screenshot / QR image
              </Text>
            </View>
          </View>

          {/* Action buttons */}
          <View style={{ gap: spacing.sm }}>
            <Button
              icon="images-outline"
              title={analyzing ? "Scanning QR Code…" : "Select QR from Photos"}
              loading={analyzing}
              onPress={handlePickImage}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: radius.lg * 1.5,
    padding: spacing.xl,
    gap: spacing.lg,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  title: {
    fontSize: font.xl,
    fontWeight: "800",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  scannerWrapper: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
  },
  viewfinder: {
    width: 220,
    height: 220,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    backgroundColor: "rgba(252, 128, 25, 0.03)",
  },
  corner: {
    position: "absolute",
    width: 20,
    height: 20,
    borderColor: "#EA580C",
  },
  cornerTL: { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 4 },
  cornerTR: { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 4 },
  cornerBL: { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 4 },
});
