import { useFocusEffect } from "expo-router"
import React, { useCallback, useMemo, useState } from "react"
import {
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { useSharedValue } from "react-native-reanimated"
import { SafeAreaView } from "react-native-safe-area-context"

import { ThemedText } from "@/components/themed-text"
import { ThemedView } from "@/components/themed-view"
import {
  getMoodByValue,
  getMoodOption,
  MOOD_OPTIONS,
  MoodEntry,
  MoodType,
} from "@/constants/moods"
import { useMoodStorage } from "@/hooks/use-mood-storage"
import { useThemeColor } from "@/hooks/use-theme-color"

type TimeRange = "week" | "month" | "year"

const SCREEN_WIDTH = Dimensions.get("window").width
const CHART_PADDING = 40
const CHART_WIDTH = SCREEN_WIDTH - CHART_PADDING * 2

export default function TrendsScreen() {
  const { entries, getEntriesForPastDays, reload, saveMood, getTodaysMood } =
    useMoodStorage()
  const [timeRange, setTimeRange] = useState<TimeRange>("week")
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null)
  const [note, setNote] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1)
  const baseZoom = useSharedValue(1)
  const pinchScale = useSharedValue(1)

  const backgroundColor = useThemeColor({}, "background")
  const textColor = useThemeColor({}, "text")

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      reload()
    }, [reload]),
  )

  // Load today's mood when modal opens
  const openMoodModal = useCallback(() => {
    const todaysMood = getTodaysMood()
    if (todaysMood) {
      setSelectedMood(todaysMood.mood)
      setNote(todaysMood.note || "")
    } else {
      setSelectedMood(null)
      setNote("")
    }
    setModalVisible(true)
  }, [getTodaysMood])

  const handleSaveMood = async () => {
    if (!selectedMood) {
      Alert.alert("Select a Mood", "Please select how you're feeling today.")
      return
    }

    setIsSaving(true)
    const success = await saveMood(selectedMood, note.trim() || undefined)
    setIsSaving(false)

    if (success) {
      setModalVisible(false)
      Alert.alert("Saved!", "Your mood has been logged for today. 🎉")
    } else {
      Alert.alert("Error", "Failed to save your mood. Please try again.")
    }
  }

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

  const todaysMood = getTodaysMood()
  const todayFormatted = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  })

  const renderSimpleChart = () => {
    const maxBarHeight = 150
    const baseBarWidth =
      timeRange === "week" ? 35 : timeRange === "month" ? 8 : 3
    const baseGap = timeRange === "week" ? 8 : timeRange === "month" ? 3 : 1
    // Only apply zoom for year view
    const effectiveZoom = timeRange === "year" ? zoomLevel : 1
    const barWidth = baseBarWidth * effectiveZoom
    const gap = baseGap * effectiveZoom

    let xLabels: string[] = []
    if (timeRange === "week") {
      xLabels = ["S", "M", "T", "W", "T", "F", "S"]
    } else if (timeRange === "month") {
      // Show label every 5th day (1, 6, 11, 16, 21, 26)
      const thisMonth = new Date().getMonth()
      if ([1, 3, 5, 7, 8, 10, 12].includes(thisMonth)) {
        xLabels = ["1", "7", "13", "19", "25", "31"]
      } else if ([4, 6, 9, 11].includes(thisMonth)) {
        xLabels = ["1", "7", "13", "19", "25", "30"]
      } else {
        xLabels = ["1", "6", "12", "17", "23", "28"]
      }
    } else if (timeRange === "year") {
      xLabels = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"]
    }

    return (
      <ThemedView style={styles.chartContainer}>
        <View style={styles.chartGestureArea}>
          <View style={{ ...styles.chartRow, width: "100%" }}>
            {/* Y-axis labels - fixed position */}
            <View style={styles.yAxis}>
              {MOOD_OPTIONS.map((mood) => (
                <ThemedText key={mood.type} style={styles.yAxisLabel}>
                  {mood.emoji}
                </ThemedText>
              ))}
            </View>

            {/* Scrollable bars */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={true}
              contentContainerStyle={styles.chartScrollContent}
              style={styles.scrollViewStyle}
            >
              {/* Parent View */}
              <View style={styles.scrollViewStyle}>
                {/* Top Bar */}
                <View style={{ ...styles.barsContainer, width: "100%" }}>
                  {chartData.map((point, index) => (
                    <ThemedText key={index}>{point.value}</ThemedText>
                  ))}
                </View>

                {/* Bottom Bar */}
                <View
                  style={{ ...styles.barsContainer, width: "100%" }}
                  id="hi"
                >
                  {xLabels.map((label, index) => (
                    <ThemedText key={index} style={styles.xAxisLabel}>
                      {label}
                    </ThemedText>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </ThemedView>
    )
  }

  const renderMoodModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={modalVisible}
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <ThemedView style={[styles.modalContent, { backgroundColor }]}>
          <View style={styles.modalHeader}>
            <ThemedText type="subtitle">How are you feeling?</ThemedText>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.closeButton}
            >
              <ThemedText style={styles.closeButtonText}>✕</ThemedText>
            </TouchableOpacity>
          </View>

          <ThemedText style={styles.modalDate}>{todayFormatted}</ThemedText>

          <View style={styles.moodContainer}>
            {MOOD_OPTIONS.map((mood) => (
              <TouchableOpacity
                key={mood.type}
                style={[
                  styles.moodButton,
                  selectedMood === mood.type && {
                    backgroundColor: mood.color + "30",
                    borderColor: mood.color,
                    borderWidth: 3,
                  },
                ]}
                onPress={() => setSelectedMood(mood.type)}
                activeOpacity={0.7}
              >
                <ThemedText style={styles.moodEmoji}>{mood.emoji}</ThemedText>
                <ThemedText style={styles.moodLabel}>{mood.label}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          <ThemedText style={styles.noteLabel}>Note (optional)</ThemedText>
          <TextInput
            style={[
              styles.noteInput,
              { color: textColor, borderColor: textColor + "30" },
            ]}
            placeholder="What's on your mind?"
            placeholderTextColor={textColor + "60"}
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[
              styles.saveButton,
              (!selectedMood || isSaving) && styles.saveButtonDisabled,
            ]}
            onPress={handleSaveMood}
            disabled={!selectedMood || isSaving}
            activeOpacity={0.8}
          >
            <ThemedText style={styles.saveButtonText}>
              {isSaving
                ? "Saving..."
                : todaysMood
                  ? "Update Mood"
                  : "Save Mood"}
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </View>
    </Modal>
  )

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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

          {/* Today's Mood Button */}
          <TouchableOpacity
            style={[
              styles.todayMoodButton,
              todaysMood && {
                borderColor: getMoodOption(todaysMood.mood).color,
                backgroundColor: getMoodOption(todaysMood.mood).color + "15",
              },
            ]}
            onPress={openMoodModal}
            activeOpacity={0.7}
          >
            {todaysMood ? (
              <View style={styles.todayMoodContent}>
                <ThemedText style={styles.todayMoodEmoji}>
                  {getMoodOption(todaysMood.mood).emoji}
                </ThemedText>
                <View style={styles.todayMoodTextContainer}>
                  <ThemedText style={styles.todayMoodLabel}>
                    Today's Mood
                  </ThemedText>
                  <ThemedText style={styles.todayMoodValue}>
                    {getMoodOption(todaysMood.mood).label}
                  </ThemedText>
                </View>
                <ThemedText style={styles.todayMoodEdit}>Edit</ThemedText>
              </View>
            ) : (
              <View style={styles.todayMoodContent}>
                <ThemedText style={styles.todayMoodEmoji}>➕</ThemedText>
                <View style={styles.todayMoodTextContainer}>
                  <ThemedText style={styles.todayMoodLabel}>
                    Log Today's Mood
                  </ThemedText>
                  <ThemedText style={styles.todayMoodSubtext}>
                    Tap to record how you're feeling
                  </ThemedText>
                </View>
              </View>
            )}
          </TouchableOpacity>

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
                          <ThemedText
                            style={styles.entryNote}
                            numberOfLines={2}
                          >
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

        {renderMoodModal()}
      </SafeAreaView>
    </GestureHandlerRootView>
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
  pinchHint: {
    fontSize: 11,
    opacity: 0.5,
    textAlign: "center",
    marginBottom: 8,
  },
  scrollViewStyle: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  chartGestureArea: {
    flex: 1,
  },
  chartRow: {
    flexDirection: "row",
  },
  chartScrollContent: {
    paddingRight: 16,
    alignItems: "flex-end",
    flexGrow: 1,
  },
  yAxis: {
    marginRight: 8,
    justifyContent: "space-between",
    height: 150,
    marginBottom: 20,
  },
  yAxisLabel: {
    fontSize: 16,
  },
  barsContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 150,
    display: "flex",
    justifyContent: "space-between",
    width: "100%",
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
    flexShrink: 0,
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  xAxisLabelYear: {
    fontSize: 8,
    fontWeight: "600",
    flexShrink: 0,
  },
  xAxisLabelPlaceholder: {
    marginTop: 4,
    height: 16,
  },
  // Today's Mood Button
  todayMoodButton: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(150, 150, 150, 0.2)",
    backgroundColor: "rgba(150, 150, 150, 0.05)",
  },
  todayMoodContent: {
    flexDirection: "row",
    alignItems: "center",
    overflow: "visible",
  },
  todayMoodEmoji: {
    fontSize: 36,
    lineHeight: 46,
    marginRight: 16,
    textAlign: "center",
  },
  todayMoodTextContainer: {
    flex: 1,
  },
  todayMoodLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  todayMoodValue: {
    fontSize: 14,
    opacity: 0.8,
    marginTop: 2,
  },
  todayMoodSubtext: {
    fontSize: 14,
    opacity: 0.6,
    marginTop: 2,
  },
  todayMoodEdit: {
    fontSize: 14,
    color: "#4CAF50",
    fontWeight: "600",
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 20,
    opacity: 0.6,
  },
  modalDate: {
    opacity: 0.6,
    marginBottom: 20,
  },
  moodContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginBottom: 20,
  },
  moodButton: {
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
    width: "18%",
    minWidth: 60,
    overflow: "visible",
  },
  moodEmoji: {
    fontSize: 28,
    lineHeight: 38,
    marginBottom: 4,
    textAlign: "center",
  },
  moodLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  noteLabel: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "600",
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    fontSize: 16,
    marginBottom: 16,
  },
  saveButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  saveButtonDisabled: {
    backgroundColor: "#4CAF5060",
  },
  saveButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
  },
  // Stats
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
