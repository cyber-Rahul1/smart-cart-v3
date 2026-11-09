import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { font, radius, spacing, useTheme } from "@/src/theme";
import { Ionicons } from "@/src/ui";

interface VoiceSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onTranscript: (text: string) => void;
}

const SAMPLE_COMMANDS = [
  "Chicken Dum Biryani",
  "Fresh Cow Milk 1L",
  "Crispy Masala Dosa",
  "Margherita Pizza",
  "Farm Fresh Eggs",
  "Paneer Butter Masala",
  "Organic Tomatoes",
];

export function VoiceSearchModal({
  visible,
  onClose,
  onTranscript,
}: VoiceSearchModalProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [manualText, setManualText] = useState("");

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim1 = useRef(new Animated.Value(1)).current;
  const waveAnim2 = useRef(new Animated.Value(1)).current;
  const simTimeoutRef = useRef<any>(null);

  useEffect(() => {
    if (!visible) {
      if (simTimeoutRef.current) clearTimeout(simTimeoutRef.current);
      setIsListening(false);
      setLiveTranscript("");
      setManualText("");
      return;
    }

    // Auto-start listening animation on open
    setIsListening(true);
    setLiveTranscript("");

    // Pulse animation loop
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.25,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    // Secondary ripple
    const waveLoop1 = Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim1, {
          toValue: 1.5,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(waveAnim1, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    waveLoop1.start();

    // Live speech stream simulation fallback for development/emulator
    const randomSample =
      SAMPLE_COMMANDS[Math.floor(Math.random() * SAMPLE_COMMANDS.length)];
    const words = randomSample.split(" ");
    let step = 0;

    const streamWords = () => {
      if (step < words.length) {
        step++;
        const partial = words.slice(0, step).join(" ");
        setLiveTranscript(partial);
        simTimeoutRef.current = setTimeout(streamWords, 550);
      } else {
        simTimeoutRef.current = setTimeout(() => {
          setIsListening(false);
        }, 800);
      }
    };

    simTimeoutRef.current = setTimeout(streamWords, 800);

    return () => {
      pulseLoop.stop();
      waveLoop1.stop();
      if (simTimeoutRef.current) clearTimeout(simTimeoutRef.current);
    };
  }, [visible]);

  const handleApply = (finalText: string) => {
    const textToUse = finalText.trim() || liveTranscript.trim() || manualText.trim();
    if (textToUse) {
      onTranscript(textToUse);
    }
    onClose();
  };

  const handleMicTap = () => {
    if (isListening) {
      setIsListening(false);
      if (simTimeoutRef.current) clearTimeout(simTimeoutRef.current);
    } else {
      setIsListening(true);
      setLiveTranscript("");
      const randomSample =
        SAMPLE_COMMANDS[Math.floor(Math.random() * SAMPLE_COMMANDS.length)];
      const words = randomSample.split(" ");
      let step = 0;
      const streamWords = () => {
        if (step < words.length) {
          step++;
          setLiveTranscript(words.slice(0, step).join(" "));
          simTimeoutRef.current = setTimeout(streamWords, 550);
        } else {
          simTimeoutRef.current = setTimeout(() => {
            setIsListening(false);
          }, 800);
        }
      };
      simTimeoutRef.current = setTimeout(streamWords, 600);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              paddingBottom: insets.bottom + spacing.lg,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.onSurface }]}>
              {isListening ? "Listening…" : "Voice Search"}
            </Text>
            <Pressable
              onPress={onClose}
              testID="voice-search-close"
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={24} color={colors.muted} />
            </Pressable>
          </View>

          {/* Transcript / Subtitle preview */}
          <View
            style={[
              styles.transcriptBox,
              { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
            ]}
          >
            {liveTranscript ? (
              <Text
                style={[styles.liveTranscript, { color: colors.onSurface }]}
                testID="voice-transcript-text"
              >
                "{liveTranscript}"
              </Text>
            ) : isListening ? (
              <Text style={[styles.prompt, { color: colors.muted }]}>
                Say a dish or shop name (e.g. "Biryani", "Milk")…
              </Text>
            ) : (
              <Text style={[styles.prompt, { color: colors.muted }]}>
                Tap mic to try speaking again or use your speech
              </Text>
            )}
          </View>

          {/* Interactive Mic Visualization */}
          <View style={styles.micContainer}>
            {isListening && (
              <>
                <Animated.View
                  style={[
                    styles.ripple,
                    {
                      borderColor: colors.brandPrimary,
                      opacity: 0.35,
                      transform: [{ scale: waveAnim1 }],
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.ripple,
                    {
                      borderColor: colors.brandSecondary,
                      opacity: 0.2,
                      transform: [{ scale: pulseAnim }],
                    },
                  ]}
                />
              </>
            )}

            <Pressable
              testID="voice-mic-trigger"
              onPress={handleMicTap}
              style={({ pressed }) => [
                styles.micBtn,
                {
                  backgroundColor: isListening
                    ? colors.brandPrimary
                    : colors.surfaceSecondary,
                  borderColor: colors.brandPrimary,
                },
                pressed && { transform: [{ scale: 0.95 }] },
              ]}
            >
              <Ionicons
                name={isListening ? "mic" : "mic-outline"}
                size={38}
                color={isListening ? colors.onBrandPrimary : colors.brandPrimary}
              />
            </Pressable>
          </View>

          {/* Quick sample chips */}
          <View style={styles.quickSection}>
            <Text style={[styles.quickLabel, { color: colors.muted }]}>
              Or speak one of these:
            </Text>
            <View style={styles.chipRow}>
              {SAMPLE_COMMANDS.slice(0, 4).map((cmd) => (
                <Pressable
                  key={cmd}
                  testID={`voice-sample-${cmd}`}
                  onPress={() => handleApply(cmd)}
                  style={[
                    styles.sampleChip,
                    {
                      backgroundColor: colors.surfaceSecondary,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Ionicons name="mic-outline" size={14} color={colors.brandPrimary} />
                  <Text style={[styles.sampleChipText, { color: colors.onSurface }]}>
                    {cmd}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Apply button if transcript available */}
          {liveTranscript ? (
            <Pressable
              testID="voice-search-apply"
              onPress={() => handleApply(liveTranscript)}
              style={[styles.applyBtn, { backgroundColor: colors.brandPrimary }]}
            >
              <Text style={styles.applyBtnText}>
                Search for "{liveTranscript}"
              </Text>
              <Ionicons
                name="arrow-forward"
                size={18}
                color={colors.onBrandPrimary}
              />
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
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
  transcriptBox: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    minHeight: 70,
    justifyContent: "center",
    alignItems: "center",
  },
  liveTranscript: {
    fontSize: font.lg,
    fontWeight: "800",
    textAlign: "center",
  },
  prompt: {
    fontSize: font.base,
    textAlign: "center",
  },
  micContainer: {
    height: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  ripple: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
  },
  micBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  quickSection: {
    gap: spacing.sm,
  },
  quickLabel: {
    fontSize: font.sm,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  sampleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  sampleChipText: {
    fontSize: font.sm,
    fontWeight: "600",
  },
  applyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: radius.md,
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  applyBtnText: {
    color: "#fff",
    fontSize: font.base,
    fontWeight: "700",
  },
});
