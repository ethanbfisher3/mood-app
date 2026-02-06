import { useFocusEffect } from "expo-router"
import React, { useCallback, useMemo, useState } from "react"
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { ThemedText } from "@/components/themed-text"
import { ThemedView } from "@/components/themed-view"
import {
  getMoodByValue,
  getMoodOption,
  MOOD_OPTIONS,
  MoodEntry,
} from "@/constants/moods"
import { useMoodStorage } from "@/hooks/use-mood-storage"
import { useThemeColor } from "@/hooks/use-theme-color"

type TimeRange = "week" | "month" | "year"

const SCREEN_WIDTH = Dimensions.get("window").width
const CHART_PADDING = 40
const CHART_WIDTH = SCREEN_WIDTH - CHART_PADDING * 2

export default function ChartScreen() {
  const { entries, getEntriesForPastDays, reload } = useMoodStorage()
  const [timeRange, setTimeRange] = useState<TimeRange>("week")

  const backgroundColor = useThemeColor({}, "background")
  const textColor = useThemeColor({}, "text")

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      reload()
    }, [reload]),
  )

  const rangeConfig = {
    week: { days: 7, label: "Week" },
    month: { days: 30, label: "Month" },
    year: { days: 365, label: "Year" },
  }

  const filteredEntries = useMemo(() => {
    return getEntriesForPastDays(rangeConfig[timeRange].days)
  }, [timeRange, getEntriesForPastDays, entries])

  // Calculate stats
  const stats = useMemo(() => {
    if (filteredEntries.length === 0) {
      return { avgMood: 0, mostCommon: null, streak: 0 }
    }

    const moodValues = filteredEntries.map(
      (e) => MOOD_OPTIONS.find((m) => m.type === e.mood)?.value ?? 3,
    )
    const avgMood = moodValues.reduce((a, b) => a + b, 0) / moodValues.length

    // Most common mood
    const moodCounts: Record<string, number> = {}
    filteredEntries.forEach((e) => {
      moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1
    })
    const mostCommon = Object.entries(moodCounts).sort(
      (a, b) => b[1] - a[1],
    )[0]?.[0]

    // Calculate current streak
    let streak = 0
    const sortedEntries = [...entries].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    )
    const today = new Date().toISOString().split("T")[0]
    let currentDate = new Date(today)

    for (const entry of sortedEntries) {
      const entryDate = entry.date
      const expectedDate = currentDate.toISOString().split("T")[0]

      if (entryDate === expectedDate) {
        streak++
        currentDate.setDate(currentDate.getDate() - 1)
      } else if (entryDate < expectedDate) {
        break
      }
    }

    return { avgMood, mostCommon, streak }
  }, [filteredEntries, entries])

  // Generate chart data points
  const chartData = useMemo(() => {
    const days = rangeConfig[timeRange].days
    const data: { date: string; value: number | null; entry?: MoodEntry }[] = []

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split("T")[0]
      const entry = filteredEntries.find((e) => e.date === dateStr)

      data.push({
        date: dateStr,
        value: entry
          ? (MOOD_OPTIONS.find((m) => m.type === entry.mood)?.value ?? null)
          : null,
        entry,
      })
    }

    return data
  }, [timeRange, filteredEntries])

  const renderSimpleChart = () => {
    const maxBarHeight = 150
    const barWidth = timeRange === "week" ? 35 : timeRange === "month" ? 8 : 2
    const gap = timeRange === "week" ? 8 : timeRange === "month" ? 3 : 1

    return (
      <ThemedView style={styles.chartContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chartInner}>
            {/* Y-axis labels */}
            <View style={styles.yAxis}>
              {MOOD_OPTIONS.slice()
                .reverse()
                .map((mood) => (
                  <ThemedText key={mood.type} style={styles.yAxisLabel}>
                    {mood.emoji}
                  </ThemedText>
                ))}
            </View>

            {/* Bars */}
            <View style={styles.barsContainer}>
              {chartData.map((point, index) => {
                const barHeight = point.value
                  ? (point.value / 5) * maxBarHeight
                  : 0
                const color = point.value
                  ? getMoodByValue(point.value).color
                  : textColor + "20"

                return (
                  <View
                    key={point.date}
                    style={[
                      styles.barWrapper,
                      { width: barWidth, marginHorizontal: gap / 2 },
                    ]}
                  >
                    <View
                      style={[styles.barBackground, { height: maxBarHeight }]}
                    >
                      <View
                        style={[
                          styles.bar,
                          {
                            height: barHeight || 4,
                            backgroundColor: point.value
                              ? color
                              : textColor + "20",
                          },
                        ]}
                      />
                    </View>
                    {timeRange === "week" && (
                      <ThemedText style={styles.xAxisLabel}>
                        {new Date(point.date)
                          .toLocaleDateString("en-US", { weekday: "short" })
                          .charAt(0)}
                      </ThemedText>
                    )}
                  </View>
                )
              })}
            </View>
          </View>
        </ScrollView>
      </ThemedView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.header}>
          <ThemedText type="title">Mood Trends</ThemedText>
        </ThemedView>

        {/* Time Range Buttons */}
        <ThemedView style={styles.rangeButtonsContainer}>
          {(["week", "month", "year"] as TimeRange[]).map((range) => (
            <TouchableOpacity
              key={range}
              style={[
                styles.rangeButton,
                timeRange === range && styles.rangeButtonActive,
              ]}
              onPress={() => setTimeRange(range)}
            >
              <ThemedText
                style={[
                  styles.rangeButtonText,
                  timeRange === range && styles.rangeButtonTextActive,
                ]}
              >
                {rangeConfig[range].label}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ThemedView>

        {/* Chart */}
        {renderSimpleChart()}

        {/* Stats */}
        <ThemedView style={styles.statsContainer}>
          <ThemedText type="subtitle" style={styles.statsTitle}>
            Statistics
          </ThemedText>

          <View style={styles.statsGrid}>
            <ThemedView style={styles.statCard}>
              <ThemedText style={styles.statEmoji}>
                {stats.avgMood > 0
                  ? getMoodByValue(Math.round(stats.avgMood)).emoji
                  : "—"}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Average Mood</ThemedText>
              <ThemedText style={styles.statValue}>
                {stats.avgMood > 0
                  ? stats.avgMood.toFixed(1) + "/5"
                  : "No data"}
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.statCard}>
              <ThemedText style={styles.statEmoji}>
                {stats.mostCommon
                  ? getMoodOption(stats.mostCommon as any).emoji
                  : "—"}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Most Common</ThemedText>
              <ThemedText style={styles.statValue}>
                {stats.mostCommon
                  ? getMoodOption(stats.mostCommon as any).label
                  : "No data"}
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.statCard}>
              <ThemedText style={styles.statEmoji}>🔥</ThemedText>
              <ThemedText style={styles.statLabel}>Current Streak</ThemedText>
              <ThemedText style={styles.statValue}>
                {stats.streak} {stats.streak === 1 ? "day" : "days"}
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.statCard}>
              <ThemedText style={styles.statEmoji}>📊</ThemedText>
              <ThemedText style={styles.statLabel}>Entries</ThemedText>
              <ThemedText style={styles.statValue}>
                {filteredEntries.length} / {rangeConfig[timeRange].days}
              </ThemedText>
            </ThemedView>
          </View>
        </ThemedView>

        {/* Recent Entries */}
        {filteredEntries.length > 0 && (
          <ThemedView style={styles.recentContainer}>
            <ThemedText type="subtitle" style={styles.recentTitle}>
              Recent Entries
            </ThemedText>
            {[...filteredEntries]
              .sort(
                (a, b) =>
                  new Date(b.date).getTime() - new Date(a.date).getTime(),
              )
              .slice(0, 5)
              .map((entry) => {
                const mood = getMoodOption(entry.mood)
                return (
                  <ThemedView key={entry.id} style={styles.entryCard}>
                    <ThemedText style={styles.entryEmoji}>
                      {mood.emoji}
                    </ThemedText>
                    <View style={styles.entryInfo}>
                      <ThemedText style={styles.entryMood}>
                        {mood.label}
                      </ThemedText>
                      <ThemedText style={styles.entryDate}>
                        {new Date(entry.date).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </ThemedText>
                      {entry.note && (
                        <ThemedText style={styles.entryNote} numberOfLines={2}>
                          {entry.note}
                        </ThemedText>
                      )}
                    </View>
                  </ThemedView>
                )
              })}
          </ThemedView>
        )}

        {filteredEntries.length === 0 && (
          <ThemedView style={styles.emptyState}>
            <ThemedText style={styles.emptyEmoji}>📝</ThemedText>
            <ThemedText style={styles.emptyText}>
              No mood entries yet for this period.
            </ThemedText>
            <ThemedText style={styles.emptySubtext}>
              Start tracking your mood to see trends!
            </ThemedText>
          </ThemedView>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  rangeButtonsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 24,
  },
  rangeButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: "rgba(150, 150, 150, 0.1)",
  },
  rangeButtonActive: {
    backgroundColor: "#4CAF50",
  },
  rangeButtonText: {
    fontWeight: "600",
  },
  rangeButtonTextActive: {
    color: "white",
  },
  chartContainer: {
    marginBottom: 24,
    borderRadius: 16,
    padding: 16,
    backgroundColor: "rgba(150, 150, 150, 0.05)",
  },
  chartInner: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  yAxis: {
    marginRight: 8,
    justifyContent: "space-between",
    height: 150,
  },
  yAxisLabel: {
    fontSize: 16,
  },
  barsContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  barWrapper: {
    alignItems: "center",
  },
  barBackground: {
    justifyContent: "flex-end",
    backgroundColor: "rgba(150, 150, 150, 0.1)",
    borderRadius: 4,
  },
  bar: {
    width: "100%",
    borderRadius: 4,
  },
  xAxisLabel: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.7,
  },
  statsContainer: {
    marginBottom: 24,
  },
  statsTitle: {
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    padding: 16,
    borderRadius: 16,
    backgroundColor: "rgba(150, 150, 150, 0.05)",
    alignItems: "center",
    overflow: "visible",
  },
  statEmoji: {
    fontSize: 32,
    marginBottom: 8,
    lineHeight: 42,
    textAlign: "center",
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "600",
  },
  recentContainer: {
    marginBottom: 24,
  },
  recentTitle: {
    marginBottom: 16,
  },
  entryCard: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "rgba(150, 150, 150, 0.05)",
    marginBottom: 8,
    overflow: "visible",
  },
  entryEmoji: {
    fontSize: 32,
    marginRight: 16,
    lineHeight: 42,
    textAlign: "center",
  },
  entryInfo: {
    flex: 1,
  },
  entryMood: {
    fontWeight: "600",
    fontSize: 16,
  },
  entryDate: {
    opacity: 0.7,
    fontSize: 14,
  },
  entryNote: {
    marginTop: 4,
    opacity: 0.8,
    fontSize: 14,
  },
  emptyState: {
    alignItems: "center",
    padding: 40,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtext: {
    opacity: 0.7,
    textAlign: "center",
  },
})
