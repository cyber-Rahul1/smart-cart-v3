import { Redirect } from "expo-router";

import { useAuth } from "@/src/auth";
import { ROLE_HOME } from "@/src/navigation";
import { Loader } from "@/src/ui";

export default function Index() {
  const { user, loading } = useAuth();
  if (loading) return <Loader testID="app-boot-loader" />;
  if (!user) return <Redirect href="/login" />;
  if (ROLE_HOME[user.role]) return <Redirect href={ROLE_HOME[user.role] as any} />;
  if (!user.name) return <Redirect href="/login?step=profile" />;
  return <Redirect href="/(tabs)" />;
}
