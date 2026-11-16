import { Redirect } from "expo-router";

import { useAuth } from "@/src/auth";
import { ROLE_HOME } from "@/src/navigation";

export default function Index() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Redirect href="/login" />;
  if (ROLE_HOME[user.role]) return <Redirect href={ROLE_HOME[user.role] as any} />;
  if (!user.name) return <Redirect href="/login?step=profile" />;
  return <Redirect href="/(tabs)" />;
}
