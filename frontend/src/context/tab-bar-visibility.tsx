import React, { createContext, useContext, ReactNode } from "react";
import { SharedValue, useSharedValue } from "react-native-reanimated";

interface TabBarVisibilityContextType {
  tabBarTranslateY: SharedValue<number>;
}

const TabBarVisibilityContext = createContext<TabBarVisibilityContextType | null>(null);

export function TabBarVisibilityProvider({ children }: { children: ReactNode }) {
  const tabBarTranslateY = useSharedValue(0);

  return (
    <TabBarVisibilityContext.Provider value={{ tabBarTranslateY }}>
      {children}
    </TabBarVisibilityContext.Provider>
  );
}

export function useTabBarVisibility() {
  const ctx = useContext(TabBarVisibilityContext);
  if (!ctx) {
    throw new Error("useTabBarVisibility must be used within a TabBarVisibilityProvider");
  }
  return ctx;
}
