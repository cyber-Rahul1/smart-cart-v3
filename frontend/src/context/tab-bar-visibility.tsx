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

const defaultSharedValue = { value: 0 } as SharedValue<number>;

const defaultContextValue: TabBarVisibilityContextType = {
  tabBarTranslateY: defaultSharedValue,
  activeTabIndex: 0,
  setActiveTabIndex: () => {},
  previousTabIndex: 0,
  scrollPageTo: () => {},
  setScrollPageToHandler: () => {},
  isPagerScrollEnabled: true,
  setPagerScrollEnabled: () => {},
  enablePagerScroll: () => {},
  disablePagerScroll: () => {},
  isBottomNavHidden: false,
  setIsBottomNavHidden: () => {},
};

const TabBarVisibilityContext = createContext<TabBarVisibilityContextType>(defaultContextValue);

export function TabBarVisibilityProvider({ children }: { children: ReactNode }) {
  const tabBarTranslateY = useSharedValue(0);
  const [activeTabIndex, setActiveTabIndexState] = useState(0);
  const [previousTabIndex, setPreviousTabIndex] = useState(0);
  const [isPagerScrollEnabled, setPagerScrollEnabledState] = useState(true);
  const [isBottomNavHidden, setIsBottomNavHidden] = useState(false);

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

  const scrollPageTo = React.useCallback((idx: number) => {
    if (globalScrollPageTo) {
      globalScrollPageTo(idx);
    }
  }, []);

  const setScrollPageToHandler = React.useCallback((fn: (idx: number) => void) => {
    globalScrollPageTo = fn;
  }, []);

  const contextValue = React.useMemo(
    () => ({
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
    }),
    [
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
    ]
  );

  return (
    <TabBarVisibilityContext.Provider value={contextValue}>
      {children}
    </TabBarVisibilityContext.Provider>
  );
}

export function useTabBarVisibility() {
  const ctx = useContext(TabBarVisibilityContext);
  return ctx;
}

