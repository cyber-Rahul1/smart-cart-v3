import React, { createContext, useContext, ReactNode, useState } from "react";
import { SharedValue, useSharedValue } from "react-native-reanimated";

// Global tab navigation bridge across nested stack screens and components
let globalScrollPageTo: ((idx: number) => void) | null = null;

export function navigateToTab(idx: number) {
  if (globalScrollPageTo) {
    globalScrollPageTo(idx);
  }
}

interface TabBarVisibilityContextType {
  tabBarTranslateY: SharedValue<number>;
  activeTabIndex: number;
  setActiveTabIndex: (idx: number | ((prev: number) => number)) => void;
  previousTabIndex: number;
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
  const [activeTabIndex, setActiveTabIndexState] = useState(0);
  const [previousTabIndex, setPreviousTabIndex] = useState(0);
  const [isPagerScrollEnabled, setPagerScrollEnabledState] = useState(true);
  const [isBottomNavHidden, setIsBottomNavHidden] = useState(false);
  const [scrollPageToFn, setScrollPageToFn] = useState<((idx: number) => void) | null>(null);

  const setActiveTabIndex = React.useCallback((val: number | ((prev: number) => number)) => {
    setActiveTabIndexState((prev) => {
      const next = typeof val === "function" ? val(prev) : val;
      if (prev !== next) {
        setPreviousTabIndex(prev);
      }
      return next;
    });
  }, []);

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
    } else if (globalScrollPageTo) {
      globalScrollPageTo(idx);
    }
  };

  const setScrollPageToHandler = (fn: (idx: number) => void) => {
    globalScrollPageTo = fn;
    setScrollPageToFn(() => fn);
  };

  return (
    <TabBarVisibilityContext.Provider
      value={{
        tabBarTranslateY,
        activeTabIndex,
        setActiveTabIndex,
        previousTabIndex,
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

