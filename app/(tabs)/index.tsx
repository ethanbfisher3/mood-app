import { useRouter } from "expo-router"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Alert,
  AppState,
  AppStateStatus,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native"
import { Calendar } from "react-native-calendars"
import { useSharedValue } from "react-native-reanimated"
import Svg, { Circle, Line, Rect } from "react-native-svg"

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
  const router = useRouter()
  const {
    entries,
    getEntriesForPastDays,
    reload,
    saveMood,
    saveMoodForDate,
    getTodaysMood,
  } = useMoodStorage()
  const [timeRange, setTimeRange] = useState<TimeRange>("week")
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null)
  const [note, setNote] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null)
  const [chartOffset, setChartOffset] = useState(0) // 0 = current period, negative = past
  const [devModalVisible, setDevModalVisible] = useState(false)
  const [devSelectedMood, setDevSelectedMood] = useState<MoodType | null>(null)
  const [devDate, setDevDate] = useState("")
  const baseZoom = useSharedValue(1)
  const pinchScale = useSharedValue(1)

  const backgroundColor = useThemeColor({}, "background")
  const textColor = useThemeColor({}, "text")

  const appState = useRef(AppState.currentState)

  // Reload data when app comes to foreground (e.g., after notification action)
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        if (
          appState.current.match(/inactive|background/) &&
          nextAppState === "active"
        ) {
          reload()
        }
        appState.current = nextAppState
      },
    )

    return () => {
      subscription.remove()
    }
  }, [reload])

  // Load data on mount
  useEffect(() => {
    reload()
  }, [reload])

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
    if (timeRange === "month") {
      // Filter entries for the target month (with offset)
      const now = new Date()
      const targetDate = new Date(
        now.getFullYear(),
        now.getMonth() + chartOffset,
        1,
      )
      const year = targetDate.getFullYear()
      const month = targetDate.getMonth()
      return entries.filter((e) => {
        const entryDate = new Date(e.date)
        return (
          entryDate.getFullYear() === year && entryDate.getMonth() === month
        )
      })
    } else if (timeRange === "week") {
      // Filter entries for the target week (with offset)
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + chartOffset * 7)
      const startDate = new Date(endDate)
      startDate.setDate(startDate.getDate() - 6)
      const start = startDate.toISOString().split("T")[0]
      const end = endDate.toISOString().split("T")[0]
      return entries.filter((e) => e.date >= start && e.date <= end)
    } else if (timeRange === "year") {
      // Filter entries for the target 12-month period (with offset)
      const now = new Date()
      const endDate = new Date(
        now.getFullYear() + chartOffset,
        now.getMonth(),
        1,
      )
      const startDate = new Date(
        endDate.getFullYear(),
        endDate.getMonth() - 11,
        1,
      )
      const start = startDate.toISOString().split("T")[0]
      const end = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0)
        .toISOString()
        .split("T")[0]
      return entries.filter((e) => e.date >= start && e.date <= end)
    }
    // Fallback (should not reach here)
    return []
  }, [timeRange, entries, chartOffset])

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
    const data: { date: string; value: number | null; entry?: MoodEntry }[] = []

    if (timeRange === "year") {
      // For year view, show 12 months ending at the current month (with offset)
      const now = new Date()
      // Calculate the end month based on offset (each offset step = 12 months)
      const endDate = new Date(
        now.getFullYear() + chartOffset,
        now.getMonth(),
        1,
      )
      const endMonth = endDate.getMonth()
      const endYear = endDate.getFullYear()

      // Start 11 months before the end month
      const startDate = new Date(endYear, endMonth - 11, 1)
      const startMonth = startDate.getMonth()
      const startYear = startDate.getFullYear()

      // Generate 12 months of data
      for (let i = 0; i < 12; i++) {
        const monthIndex = (startMonth + i) % 12
        const year = startYear + Math.floor((startMonth + i) / 12)

        // Find entries for this month
        const monthEntries = entries.filter((e) => {
          const entryDate = new Date(e.date)
          return (
            entryDate.getMonth() === monthIndex &&
            entryDate.getFullYear() === year
          )
        })

        // Calculate average mood for the month
        let avgValue: number | null = null
        if (monthEntries.length > 0) {
          const values = monthEntries.map(
            (e) => MOOD_OPTIONS.find((m) => m.type === e.mood)?.value ?? 3,
          )
          avgValue = values.reduce((a, b) => a + b, 0) / values.length
        }

        data.push({
          date: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
          value: avgValue,
          entry: monthEntries[0], // Just for reference
        })
      }
    } else if (timeRange === "month") {
      // Month view - show target month from 1st to last day (with offset)
      const now = new Date()
      const targetDate = new Date(
        now.getFullYear(),
        now.getMonth() + chartOffset,
        1,
      )
      const year = targetDate.getFullYear()
      const month = targetDate.getMonth()
      const daysInMonth = new Date(year, month + 1, 0).getDate()

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day)
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
    } else {
      // Week view - daily data for target week (with offset)
      const days = rangeConfig[timeRange].days
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + chartOffset * 7)

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(endDate)
        date.setDate(endDate.getDate() - i)
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
    }

    return data
  }, [timeRange, filteredEntries, entries, chartOffset])

  // Calculate date range for display and navigation
  const { dateRangeText, hasEntriesBefore, hasEntriesAfter } = useMemo(() => {
    if (chartData.length === 0) {
      return {
        dateRangeText: "",
        hasEntriesBefore: false,
        hasEntriesAfter: false,
      }
    }

    const startDate = chartData[0].date
    const endDate = chartData[chartData.length - 1].date

    let rangeText = ""
    if (timeRange === "week") {
      const start = new Date(startDate + "T00:00:00")
      const end = new Date(endDate + "T00:00:00")
      rangeText = `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
    } else if (timeRange === "month") {
      const date = new Date(startDate + "T00:00:00")
      rangeText = date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    } else {
      const start = new Date(startDate + "-01T00:00:00")
      const end = new Date(endDate + "-01T00:00:00")
      rangeText = `${start.toLocaleDateString("en-US", { month: "short", year: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
    }

    // Check for entries before/after current view
    let hasBefore = false
    if (timeRange === "year") {
      // For year view, startDate is "YYYY-MM", so compare with first day of that month
      hasBefore = entries.some((e) => e.date < startDate + "-01")
    } else {
      hasBefore = entries.some((e) => e.date < startDate)
    }
    // Don't allow navigating forward past current period
    const hasAfter = chartOffset < 0

    return {
      dateRangeText: rangeText,
      hasEntriesBefore: hasBefore,
      hasEntriesAfter: hasAfter,
    }
  }, [chartData, entries, timeRange, chartOffset])

  const todaysMood = getTodaysMood()
  const todayFormatted = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  })

  const renderSimpleChart = () => {
    const chartPadding = 6 // Padding to prevent point cutoff
    const chartHeight = 150
    const maxBarHeight = chartHeight - chartPadding * 2
    const baseBarWidth =
      timeRange === "week" ? 35 : timeRange === "month" ? 10 : 30
    const baseGap = timeRange === "week" ? 8 : timeRange === "month" ? 3 : 10
    // Only apply zoom for year view
    const effectiveZoom = timeRange === "year" ? zoomLevel : 1
    const barWidth = baseBarWidth * effectiveZoom
    const gap = baseGap * effectiveZoom

    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ]

    const dayLabels = ["S", "M", "T", "W", "T", "F", "S"]

    let xLabels: string[] = []
    if (timeRange === "week") {
      // Generate labels for each data point based on actual day of week
      xLabels = chartData.map((d) => {
        // Parse date parts directly to avoid timezone issues
        const [year, month, day] = d.date.split("-").map(Number)
        const date = new Date(year, month - 1, day)
        return dayLabels[date.getDay()]
      })
    } else if (timeRange === "month") {
      // Generate labels for each data point, showing day number at intervals
      xLabels = chartData.map((d, index) => {
        // Parse day directly from YYYY-MM-DD string to avoid timezone issues
        const dayOfMonth = parseInt(d.date.split("-")[2], 10)
        // Show label every 5 days
        if (index % 5 === 0) {
          return dayOfMonth.toString()
        }
        return ""
      })
    } else if (timeRange === "year") {
      // Generate labels based on the chartData month order
      xLabels = chartData.map((d) => {
        const monthIndex = parseInt(d.date.split("-")[1]) - 1
        return monthNames[monthIndex]
      })
    }

    return (
      <ThemedView style={styles.chartContainer}>
        {/* Date range header with navigation */}
        <View style={styles.chartHeader}>
          <ThemedText style={styles.dateRangeText}>{dateRangeText}</ThemedText>
          <View style={styles.chartNavigation}>
            <TouchableOpacity
              onPress={() => setChartOffset(chartOffset - 1)}
              disabled={!hasEntriesBefore}
              style={[
                styles.navArrow,
                !hasEntriesBefore && styles.navArrowDisabled,
              ]}
            >
              <ThemedText
                style={[
                  styles.navArrowText,
                  !hasEntriesBefore && styles.navArrowTextDisabled,
                ]}
              >
                ←
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setChartOffset(chartOffset + 1)}
              disabled={!hasEntriesAfter}
              style={[
                styles.navArrow,
                !hasEntriesAfter && styles.navArrowDisabled,
              ]}
            >
              <ThemedText
                style={[
                  styles.navArrowText,
                  !hasEntriesAfter && styles.navArrowTextDisabled,
                ]}
              >
                →
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>

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

            {/* Scrollable chart */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chartScrollContent}
              style={{ flex: 1 }}
              onScrollBeginDrag={() => setSelectedBarIndex(null)}
            >
              <View>
                {/* Chart */}
                <View
                  style={{
                    height: chartHeight,
                    width: chartData.length * (barWidth + gap),
                    position: "relative",
                  }}
                >
                  <Svg
                    width={chartData.length * (barWidth + gap)}
                    height={chartHeight}
                  >
                    {timeRange === "year" ? (
                      /* Bar chart for year view */
                      chartData.map((point, index) => {
                        if (point.value === null) return null
                        const barHeight = ((point.value - 1) / 4) * maxBarHeight
                        const x = index * (barWidth + gap)
                        const y = chartPadding + maxBarHeight - barHeight
                        return (
                          <Rect
                            key={`bar-${index}`}
                            x={x}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            fill={
                              selectedBarIndex === index ? "#388E3C" : "#4CAF50"
                            }
                            rx={4}
                            ry={4}
                          />
                        )
                      })
                    ) : (
                      <>
                        {/* Draw lines connecting points */}
                        {chartData.map((point, index) => {
                          if (point.value === null) return null
                          // Find previous non-null point
                          let prevIndex = -1
                          for (let i = index - 1; i >= 0; i--) {
                            if (chartData[i].value !== null) {
                              prevIndex = i
                              break
                            }
                          }
                          if (prevIndex === -1) return null

                          const prevPoint = chartData[prevIndex]
                          const x1 = prevIndex * (barWidth + gap) + barWidth / 2
                          const y1 =
                            chartPadding +
                            maxBarHeight -
                            ((prevPoint.value! - 1) / 4) * maxBarHeight
                          const x2 = index * (barWidth + gap) + barWidth / 2
                          const y2 =
                            chartPadding +
                            maxBarHeight -
                            ((point.value - 1) / 4) * maxBarHeight

                          return (
                            <Line
                              key={`line-${index}`}
                              x1={x1}
                              y1={y1}
                              x2={x2}
                              y2={y2}
                              stroke="#4CAF50"
                              strokeWidth={2}
                            />
                          )
                        })}
                        {/* Draw points */}
                        {chartData.map((point, index) => {
                          if (point.value === null) return null
                          const x = index * (barWidth + gap) + barWidth / 2
                          const y =
                            chartPadding +
                            maxBarHeight -
                            ((point.value - 1) / 4) * maxBarHeight
                          return (
                            <Circle
                              key={`point-${index}`}
                              cx={x}
                              cy={y}
                              r={4}
                              fill="#4CAF50"
                            />
                          )
                        })}
                      </>
                    )}
                  </Svg>

                  {/* Touchable overlays for bar chart */}
                  {timeRange === "year" &&
                    chartData.map((point, index) => {
                      if (point.value === null) return null
                      const x = index * (barWidth + gap)
                      return (
                        <TouchableOpacity
                          key={`touch-${index}`}
                          style={{
                            position: "absolute",
                            left: x,
                            top: 0,
                            width: barWidth,
                            height: chartHeight,
                          }}
                          onPress={() =>
                            setSelectedBarIndex(
                              selectedBarIndex === index ? null : index,
                            )
                          }
                          activeOpacity={0.7}
                        />
                      )
                    })}
                </View>

                {/* X-axis labels */}
                <View
                  style={{
                    ...styles.xAxisContainer,
                    width: chartData.length * (barWidth + gap),
                  }}
                >
                  {xLabels.map((label, index) => (
                    <ThemedText
                      key={index}
                      style={[
                        styles.xAxisLabel,
                        { width: barWidth + gap, textAlign: "center" },
                        timeRange === "month" && { fontSize: 10 },
                      ]}
                      numberOfLines={1}
                    >
                      {label}
                    </ThemedText>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
        </View>

        {/* Tooltip for selected bar - rendered outside ScrollView to appear on top */}
        {timeRange === "year" &&
          selectedBarIndex !== null &&
          chartData[selectedBarIndex]?.value !== null && (
            <View
              style={[
                styles.barTooltip,
                {
                  left:
                    40 + // yAxis width + margin
                    selectedBarIndex * (barWidth + gap) +
                    barWidth / 2 -
                    40,
                  top:
                    chartPadding +
                    maxBarHeight -
                    ((chartData[selectedBarIndex].value! - 1) / 4) *
                      maxBarHeight -
                    50,
                },
              ]}
            >
              <ThemedText style={styles.barTooltipEmoji}>
                {getMoodByValue(Math.round(chartData[selectedBarIndex].value!))
                  ?.emoji ?? "😐"}
              </ThemedText>
              <ThemedText style={styles.barTooltipText}>
                Avg Mood: {chartData[selectedBarIndex].value!.toFixed(1)} (
                {getMoodByValue(Math.round(chartData[selectedBarIndex].value!))
                  ?.label ?? "Neutral"}
                )
              </ThemedText>
            </View>
          )}
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
                <ThemedText style={styles.moodLabel} numberOfLines={1}>
                  {mood.label}
                </ThemedText>
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
            blurOnSubmit={true}
            returnKeyType="done"
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
    <View style={[styles.container, { backgroundColor }]}>
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
              onPress={() => {
                setTimeRange(range)
                setSelectedBarIndex(null)
                setChartOffset(0)
              }}
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
                {filteredEntries.length} /{" "}
                {timeRange === "month"
                  ? new Date(
                      new Date().getFullYear(),
                      new Date().getMonth() + chartOffset + 1,
                      0,
                    ).getDate()
                  : rangeConfig[timeRange].days}
              </ThemedText>
            </ThemedView>
          </View>
        </ThemedView>

        {/* Recent Entries */}
        {filteredEntries.length > 0 && (
          <ThemedView style={styles.recentContainer}>
            <View style={styles.recentHeader}>
              <ThemedText type="subtitle" style={styles.recentTitle}>
                Recent Entries
              </ThemedText>
              {filteredEntries.length > 3 && (
                <TouchableOpacity onPress={() => router.push("/entries")}>
                  <ThemedText style={styles.showAllText}>Show all</ThemedText>
                </TouchableOpacity>
              )}
            </View>
            {[...filteredEntries]
              .sort(
                (a, b) =>
                  new Date(b.date).getTime() - new Date(a.date).getTime(),
              )
              .slice(0, 3)
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

      {renderMoodModal()}

      {/* Dev-only Add Entry Modal */}
      {__DEV__ && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={devModalVisible}
          onRequestClose={() => setDevModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <ThemedView style={[styles.modalContent, { backgroundColor }]}>
              <View style={styles.modalHeader}>
                <ThemedText type="subtitle">Add Test Entry</ThemedText>
                <TouchableOpacity
                  onPress={() => setDevModalVisible(false)}
                  style={styles.closeButton}
                >
                  <ThemedText style={styles.closeButtonText}>✕</ThemedText>
                </TouchableOpacity>
              </View>

              <ThemedText style={styles.noteLabel}>Select Date</ThemedText>
              <Calendar
                onDayPress={(day: { dateString: string }) => {
                  if (!entries.find((e) => e.date === day.dateString)) {
                    setDevDate(day.dateString)
                  }
                }}
                markedDates={{
                  ...entries.reduce(
                    (acc, entry) => {
                      acc[entry.date] = {
                        disabled: true,
                        disabledColor: textColor + "30",
                        disabledTextColor: textColor + "60",
                      }
                      return acc
                    },
                    {} as Record<string, any>,
                  ),
                  [devDate]: {
                    selected: true,
                    selectedColor: "#4CAF50",
                    selectedTextColor: "#fff",
                  },
                }}
                maxDate={new Date().toISOString().split("T")[0]}
                theme={{
                  backgroundColor: backgroundColor,
                  calendarBackground: backgroundColor,
                  textSectionTitleColor: textColor,
                  selectedDayBackgroundColor: "#4CAF50",
                  selectedDayTextColor: "#fff",
                  todayTextColor: "#4CAF50",
                  dayTextColor: textColor,
                  textDisabledColor: textColor + "40",
                  dotColor: "#4CAF50",
                  selectedDotColor: "#fff",
                  monthTextColor: textColor,
                  indicatorColor: "#4CAF50",
                  arrowColor: "#4CAF50",
                  disabledArrowColor: textColor + "40",
                }}
              />

              <ThemedText style={[styles.noteLabel, { marginTop: 16 }]}>
                Selected: {devDate || "None"}
              </ThemedText>

              <View style={styles.moodContainer}>
                {MOOD_OPTIONS.map((mood) => (
                  <TouchableOpacity
                    key={mood.type}
                    style={[
                      styles.moodButton,
                      devSelectedMood === mood.type && {
                        backgroundColor: mood.color + "30",
                        borderColor: mood.color,
                        borderWidth: 3,
                      },
                    ]}
                    onPress={() => setDevSelectedMood(mood.type)}
                    activeOpacity={0.7}
                  >
                    <ThemedText style={styles.moodEmoji}>
                      {mood.emoji}
                    </ThemedText>
                    <ThemedText style={styles.moodLabel} numberOfLines={1}>
                      {mood.label}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (!devSelectedMood || !devDate) && styles.saveButtonDisabled,
                ]}
                onPress={async () => {
                  if (devSelectedMood && devDate) {
                    const success = await saveMoodForDate(
                      devSelectedMood,
                      devDate,
                    )
                    if (success) {
                      setDevModalVisible(false)
                      setDevSelectedMood(null)
                      setDevDate("")
                      Alert.alert("Saved!", `Test entry added for ${devDate}`)
                    }
                  }
                }}
                disabled={!devSelectedMood || !devDate}
                activeOpacity={0.8}
              >
                <ThemedText style={styles.saveButtonText}>Add Entry</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </View>
        </Modal>
      )}

      {/* Dev-only Add Entry Button */}
      {__DEV__ && (
        <TouchableOpacity
          style={styles.devButton}
          onPress={() => setDevModalVisible(true)}
        >
          <ThemedText style={styles.devButtonText}>+ Add Test Entry</ThemedText>
        </TouchableOpacity>
      )}
    </View>
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
    position: "relative",
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  dateRangeText: {
    fontSize: 14,
    fontWeight: "600",
  },
  chartNavigation: {
    flexDirection: "row",
    gap: 8,
  },
  navArrow: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(150, 150, 150, 0.15)",
  },
  navArrowDisabled: {
    opacity: 0.3,
  },
  navArrowText: {
    fontSize: 16,
    fontWeight: "600",
  },
  navArrowTextDisabled: {
    opacity: 0.5,
  },
  pinchHint: {
    fontSize: 11,
    opacity: 0.5,
    textAlign: "center",
    marginBottom: 8,
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
  barTooltip: {
    position: "absolute",
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    borderRadius: 8,
    paddingTop: 16,
    paddingHorizontal: 8,
    paddingBottom: 8,
    alignItems: "center",
    minWidth: 80,
    zIndex: 9999,
    elevation: 10,
  },
  barTooltipEmoji: {
    fontSize: 24,
    marginBottom: 2,
  },
  barTooltipText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  xAxisContainer: {
    flexDirection: "row",
  },
  xAxisLabel: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.7,
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
    justifyContent: "center",
    gap: 8,
    marginBottom: 20,
  },
  moodButton: {
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
    flex: 1,
    overflow: "visible",
  },
  moodEmoji: {
    fontSize: 28,
    lineHeight: 38,
    marginBottom: 4,
    textAlign: "center",
  },
  moodLabel: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
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
  recentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  recentTitle: {
    marginBottom: 0,
  },
  showAllText: {
    color: "#4CAF50",
    fontWeight: "600",
    fontSize: 14,
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
  devButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: "#FF9800",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  devButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
})
