import { Platform } from "react-native";

export const usesNativeTabs = Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;

export const ROLE_HOME: Record<string, string> = { seller: "/partner", rider: "/rider", admin: "/admin" };
export const ROLE_PREFIX = ["partner", "rider", "admin"];
