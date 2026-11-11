import React, { createContext, useContext, ReactNode, useState } from "react";
import { SharedValue, useSharedValue } from "react-native-reanimated";

interface TabBarVisibilityContextType {
  tabBarTranslateY: SharedValue<number>;
  activeTabIndex: number;
  setActiveTabIndex: (idx: number | ((prev: number) => number)) => void;
  scrollPageTo: (idx: number) => void;
  setScrollPageToHandler: (fn: (idx: number) => void) => void;
  isPagerScrollEnabled: boolean;
  setPagerScrollEnabled: (enabled: boolean) => void;
  enablePagerScroll: () => void;
  disablePagerScroll: () => void;
  isBottomNavHidden: boolean;
  setIsBottomNavHidden: (hidden: boolean) => void;
}

const TabBarVisibilityContext = createContext<TabBarVisibilityContextType | null>(null);

export function TabBarVisibilityProvider({ children }: { children: ReactNode }) {
  const tabBarTranslateY = useSharedValue(0);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [isPagerScrollEnabled, setPagerScrollEnabledState] = useState(true);
  const [isBottomNavHidden, setIsBottomNavHidden] = useState(false);
  const [scrollPageToFn, setScrollPageToFn] = useState<((idx: number) => void) | null>(null);

  const setPagerScrollEnabled = React.useCallback((enabled: boolean) => {
    setPagerScrollEnabledState(enabled);
  }, []);

  const disablePagerScroll = React.useCallback(() => {
    setPagerScrollEnabledState(false);
  }, []);

  const enablePagerScroll = React.useCallback(() => {
    setPagerScrollEnabledState(true);
  }, []);

  const scrollPageTo = (idx: number) => {
    if (scrollPageToFn) {
      scrollPageToFn(idx);
    }
  };

  const setScrollPageToHandler = (fn: (idx: number) => void) => {
    setScrollPageToFn(() => fn);
  };

  return (
    <TabBarVisibilityContext.Provider
      value={{
        tabBarTranslateY,
        activeTabIndex,
        setActiveTabIndex,
        scrollPageTo,
        setScrollPageToHandler,
        isPagerScrollEnabled,
        setPagerScrollEnabled,
        enablePagerScroll,
        disablePagerScroll,
        isBottomNavHidden,
        setIsBottomNavHidden,
      }}
    >
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

