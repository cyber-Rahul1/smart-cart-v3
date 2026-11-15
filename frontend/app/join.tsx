import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/src/api";
import { font, spacing, useTheme } from "@/src/theme";
import { Button, Ionicons, SkeletonBlock, useToast } from "@/src/ui";

export default function JoinDeepLinkScreen() {
  const params = useLocalSearchParams<{ type?: string; code?: string; flat?: string }>();
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const type = params.type || "group";
  const code = (params.code || "").trim().toUpperCase();

  useEffect(() => {
    if (!code) {
      setError("No invite code found in join link");
      setLoading(false);
      return;
    }

    const autoJoin = async () => {
      try {
        if (type === "group") {
          const g = await api<{ id: string }>("/groups/join", {
            method: "POST",
            body: { code },
          });
          qc.invalidateQueries({ queryKey: ["groups"] });
          toast(`Joined group!`, "ok");
          router.replace(`/groups/${g.id}`);
        } else if (type === "community") {
          // If flat param was passed in link, join directly; else navigate to community join with prefilled code
          if (params.flat) {
            const c = await api<{ id: string }>("/communities/join", {
              method: "POST",
              body: { code, flat: params.flat.trim().toUpperCase() },
            });
            qc.invalidateQueries({ queryKey: ["communities"] });
            toast(`Joined community!`, "ok");
            router.replace(`/community/${c.id}`);
          } else {
            // Forward to community tab with prefilled code
            router.replace(`/community?code=${encodeURIComponent(code)}`);
          }
        } else {
          setError(`Unknown join type: ${type}`);
          setLoading(false);
        }
      } catch (err: any) {
        setError(err.message || "Failed to join using link");
        setLoading(false);
      }
    };

    autoJoin();
  }, [type, code]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.xl,
        gap: spacing.lg,
      }}
    >
      {loading ? (
        <>
          <SkeletonBlock width={64} height={64} borderRadius={32} />
          <SkeletonBlock width={180} height={20} borderRadius={10} style={{ marginTop: spacing.sm }} />
          <Text style={{ fontSize: font.sm, color: colors.muted }}>Code: {code}</Text>
        </>
      ) : error ? (
        <>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={{ fontSize: font.lg, fontWeight: "800", color: colors.error, textAlign: "center" }}>
            {error}
          </Text>
          <Button
            title="Go to Home"
            onPress={() => router.replace("/")}
            style={{ width: 200, marginTop: spacing.md }}
          />
        </>
      ) : null}
    </View>
  );
}

