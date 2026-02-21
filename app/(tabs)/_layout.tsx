import { HapticTab } from "@/components/haptic-tab"
import { IconSymbol } from "@/components/ui/icon-symbol"
import { Colors } from "@/constants/theme"
import { useColorScheme } from "@/hooks/use-color-scheme"
import { useProSubscription } from "@/hooks/use-pro-subscription"
import React, { useCallback, useRef, useState } from "react"
import { StyleSheet, Text, TouchableOpacity, View } from "react-native"
import PagerView from "react-native-pager-view"
import { SafeAreaView } from "react-native-safe-area-context"

import TrendsScreen from "./index"
import NotificationsScreen from "./notifications"

const TABS = [
  { key: "index", title: "Trends", icon: "chart.bar.fill" as const },
  { key: "notifications", title: "Reminders", icon: "bell.fill" as const },
]

export default function TabLayout() {
  const colorScheme = useColorScheme()
  const pagerRef = useRef<PagerView>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [isDevView, setIsDevView] = useState(true)
  const { isPro, togglePro } = useProSubscription()

  const handlePageSelected = useCallback(
    (e: { nativeEvent: { position: number } }) => {
      setCurrentPage(e.nativeEvent.position)
    },
    [],
  )

  const handleTabPress = useCallback((index: number) => {
    pagerRef.current?.setPage(index)
  }, [])

  const tintColor = Colors[colorScheme ?? "light"].tint
  const inactiveColor = colorScheme === "dark" ? "#8E8E93" : "#999"
  const backgroundColor = colorScheme === "dark" ? "#000" : "#fff"
  const tabBarBackground = colorScheme === "dark" ? "#1C1C1E" : "#F2F2F7"

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor }]}
      edges={["top"]}
    >
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={handlePageSelected}
        overdrag={true}
      >
        <View key="0" style={styles.page}>
          <TrendsScreen isDevView={isDevView} />
        </View>
        <View key="1" style={styles.page}>
          <NotificationsScreen isDevView={isDevView} />
        </View>
      </PagerView>

      {/* Dev-only Pro Toggle Button */}
      {__DEV__ && (
        <TouchableOpacity
          style={[styles.devViewToggleButton, styles.devProToggleButton]}
          onPress={async () => {
            await togglePro()
          }}
        >
          <Text style={styles.devViewToggleText}>
            {isPro ? "⭐ Disable Pro" : "⭐ Enable Pro"}
          </Text>
        </TouchableOpacity>
      )}

      {/* Dev/Prod View Toggle Button */}
      {__DEV__ && (
        <TouchableOpacity
          style={[
            styles.devViewToggleButton,
            !isDevView && styles.devViewToggleProd,
          ]}
          onPress={() => setIsDevView((v) => !v)}
        >
          <Text style={styles.devViewToggleText}>
            {isDevView ? "🛠️ DEV" : "📱 PROD"}
          </Text>
        </TouchableOpacity>
      )}

      {/* Custom Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: tabBarBackground }]}>
        {TABS.map((tab, index) => {
          const isActive = currentPage === index
          const color = isActive ? tintColor : inactiveColor

          return (
            <HapticTab
              key={tab.key}
              style={styles.tabButton}
              onPress={() => handleTabPress(index)}
            >
              <IconSymbol size={28} name={tab.icon} color={color} />
              <Text style={[styles.tabLabel, { color }]}>{tab.title}</Text>
            </HapticTab>
          )
        })}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  tabBar: {
    flexDirection: "row",
    paddingBottom: 20,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 4,
    fontWeight: "500",
  },
  devViewToggleButton: {
    position: "absolute",
    bottom: 80,
    left: 20,
    backgroundColor: "#FF9800",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 999,
  },
  devViewToggleProd: {
    backgroundColor: "#4CAF50",
  },
  devProToggleButton: {
    bottom: 120,
    backgroundColor: "#9C27B0",
  },
  devViewToggleText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
})
