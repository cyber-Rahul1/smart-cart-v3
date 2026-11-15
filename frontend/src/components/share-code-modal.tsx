import React, { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { font, radius, spacing, useTheme } from "@/src/theme";
import { Button, Ionicons, useToast } from "@/src/ui";

interface ShareCodeModalProps {
  visible: boolean;
  onClose: () => void;
  type: "group" | "community";
  title: string;
  code: string;
}

export function ShareCodeModal({
  visible,
  onClose,
  type,
  title,
  code,
}: ShareCodeModalProps) {
  const { colors } = useTheme();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  if (!visible) return null;

  // Deep link format:
  // Custom scheme: gathrcart://join?type=group&code=ABCD12
  // Or universal web link format
  const joinUrl = `https://gathrcart.app/join?type=${type}&code=${encodeURIComponent(code)}`;

  const handleShare = async () => {
    try {
      const label = type === "community" ? "Apartment Community" : "Roommate Group";
      await Share.share({
        title: `Join ${title} on GathrCart`,
        message: `Join our ${label} "${title}" on GathrCart! Use code: ${code}\nOr tap to join directly: ${joinUrl}`,
        url: joinUrl,
      });
    } catch (e: any) {
      toast(e.message, "err");
    }
  };

  const handleCopy = () => {
    setCopied(true);
    toast(`Copied code ${code}!`, "ok");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.onSurface }]} numberOfLines={1}>
                {title}
              </Text>
              <Text style={{ fontSize: font.sm, color: colors.muted }}>
                {type === "community" ? "Scan to join apartment community" : "Scan to join roommate group"}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.muted} />
            </Pressable>
          </View>

          {/* QR Code Container */}
          <View style={styles.qrWrapper}>
            <View style={[styles.qrBox, { backgroundColor: "#FFFFFF", borderColor: colors.border }]}>
              <QRCode
                value={joinUrl}
                size={180}
                color="#111827"
                backgroundColor="#FFFFFF"
              />
            </View>
          </View>

          {/* Invite Code Pill */}
          <View style={styles.codeContainer}>
            <Text style={{ fontSize: font.sm - 1, color: colors.muted, fontWeight: "600", textTransform: "uppercase" }}>
              Invite Code
            </Text>
            <View style={[styles.codeBadge, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <Text style={[styles.codeText, { color: colors.brandPrimary }]}>{code}</Text>
              <Pressable
                onPress={handleCopy}
                style={({ pressed }) => [
                  styles.copyBtn,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons
                  name={copied ? "checkmark-circle" : "copy-outline"}
                  size={18}
                  color={copied ? colors.success : colors.brandPrimary}
                />
                <Text style={{ fontSize: font.sm, fontWeight: "700", color: copied ? colors.success : colors.brandPrimary }}>
                  {copied ? "Copied" : "Copy"}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <Button
              icon="share-social-outline"
              title="Share invite link"
              onPress={handleShare}
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
    maxWidth: 380,
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
  qrWrapper: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xs,
  },
  qrBox: {
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  codeContainer: {
    alignItems: "center",
    gap: 6,
  },
  codeBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    width: "100%",
  },
  codeText: {
    fontSize: font.xl + 2,
    fontWeight: "900",
    letterSpacing: 3,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  actions: {
    gap: spacing.sm,
  },
});
