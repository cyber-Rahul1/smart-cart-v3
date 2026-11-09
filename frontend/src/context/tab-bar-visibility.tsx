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
}

const TabBarVisibilityContext = createContext<TabBarVisibilityContextType | null>(null);

export function TabBarVisibilityProvider({ children }: { children: ReactNode }) {
  const tabBarTranslateY = useSharedValue(0);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [isPagerScrollEnabled, setPagerScrollEnabledState] = useState(true);
  const lockCountRef = React.useRef(0);
  const [scrollPageToFn, setScrollPageToFn] = useState<((idx: number) => void) | null>(null);

  const disablePagerScroll = React.useCallback(() => {
    lockCountRef.current += 1;
    setPagerScrollEnabledState(false);
  }, []);

  const enablePagerScroll = React.useCallback(() => {
    lockCountRef.current = Math.max(0, lockCountRef.current - 1);
    if (lockCountRef.current === 0) {
      setPagerScrollEnabledState(true);
    }
  }, []);

  const setPagerScrollEnabled = React.useCallback((enabled: boolean) => {
    if (enabled) {
      enablePagerScroll();
    } else {
      disablePagerScroll();
    }
  }, [enablePagerScroll, disablePagerScroll]);

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

