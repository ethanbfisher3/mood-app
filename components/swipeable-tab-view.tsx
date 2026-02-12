import { useSegments } from "expo-router"
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react"
import { StyleSheet, View } from "react-native"
import PagerView from "react-native-pager-view"

interface PagerContextType {
  currentPage: number
  setPage: (page: number) => void
  pagerRef: React.RefObject<PagerView | null>
}

const PagerContext = createContext<PagerContextType | null>(null)

interface SwipeableTabContainerProps {
  children: ReactNode[]
  initialPage?: number
  onPageChange?: (page: number) => void
}

/**
 * Container that wraps tab screens in a swipeable pager
 */
export function SwipeableTabContainer({
  children,
  initialPage = 0,
  onPageChange,
}: SwipeableTabContainerProps) {
  const pagerRef = useRef<PagerView>(null)
  const [currentPage, setCurrentPage] = useState(initialPage)

  const setPage = useCallback(
    (page: number) => {
      pagerRef.current?.setPage(page)
    },
    [pagerRef],
  )

  const handlePageSelected = useCallback(
    (e: { nativeEvent: { position: number } }) => {
      const page = e.nativeEvent.position
      setCurrentPage(page)
      onPageChange?.(page)
    },
    [onPageChange],
  )

  return (
    <PagerContext.Provider value={{ currentPage, setPage, pagerRef }}>
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={initialPage}
        onPageSelected={handlePageSelected}
        overdrag={true}
      >
        {React.Children.map(children, (child, index) => (
          <View key={index} style={styles.page}>
            {child}
          </View>
        ))}
      </PagerView>
    </PagerContext.Provider>
  )
}

/**
 * Hook to access pager controls
 */
export function usePager() {
  const context = useContext(PagerContext)
  if (!context) {
    throw new Error("usePager must be used within SwipeableTabContainer")
  }
  return context
}

/**
 * Hook to get swipeable tab configuration (legacy, for compatibility)
 */
export function useSwipeableTabs() {
  const segments = useSegments()

  // Define the order of tabs (left to right)
  const tabOrder = ["index", "notifications"]

  // Get current tab from segments
  const currentTab = segments[1] || "index"

  return { tabOrder, currentTab }
}

const styles = StyleSheet.create({
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
})
