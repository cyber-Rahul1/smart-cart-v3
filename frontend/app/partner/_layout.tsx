import { Redirect, Stack } from "expo-router";

import { useAuth } from "@/src/auth";
import { colors } from "@/src/theme";
import { Loader } from "@/src/ui";

export default function PartnerLayout() {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user) return <Redirect href="/login?partner=1" />;
  if (user.role !== "seller") return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }} />;
}
