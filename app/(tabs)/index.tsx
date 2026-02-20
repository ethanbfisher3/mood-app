import { useRouter } from "expo-router"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Alert,
  AppState,
  AppStateStatus,
  Dimensions,
  Modal,
  ScrollView,
  Share,
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
import { PRO_FEATURES, useProSubscription } from "@/hooks/use-pro-subscription"
import { useThemeColor } from "@/hooks/use-theme-color"

type TimeRange = "week" | "month" | "year"

const SCREEN_WIDTH = Dimensions.get("window").width
const CHART_PADDING = 40
const CHART_WIDTH = SCREEN_WIDTH - CHART_PADDING * 2

export default function TrendsScreen({ isDevView }: { isDevView?: boolean }) {
  const router = useRouter()
  const {
    entries,
    getEntriesForPastDays,
    reload,
    saveMood,
    saveMoodForDate,
    getTodaysMood,
    getTodaysMoods,
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
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false)
  const baseZoom = useSharedValue(1)
  const pinchScale = useSharedValue(1)

  const { isPro, togglePro } = useProSubscription()

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
    if (isPro) {
      // Pro users always start fresh to add another mood
      setSelectedMood(null)
      setNote("")
    } else {
      const todaysMood = getTodaysMood()
      if (todaysMood) {
        setSelectedMood(todaysMood.mood)
        setNote(todaysMood.note || "")
      } else {
        setSelectedMood(null)
        setNote("")
      }
    }
    setModalVisible(true)
  }, [getTodaysMood, isPro])

  const handleSaveMood = async () => {
    if (!selectedMood) {
      Alert.alert("Select a Mood", "Please select how you're feeling today.")
      return
    }

    setIsSaving(true)
    const success = await saveMood(
      selectedMood,
      note.trim() || undefined,
      isPro, // append multiple for Pro users
    )
    setIsSaving(false)

    if (success) {
      setModalVisible(false)
      Alert.alert("Saved!", "Your mood has been logged. 🎉")
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

  // Advanced analytics (Pro feature)
  const advancedStats = useMemo(() => {
    if (entries.length === 0) {
      return {
        moodDistribution: [] as {
          mood: MoodType
          count: number
          percentage: number
        }[],
        bestDayOfWeek: null as string | null,
        worstDayOfWeek: null as string | null,
        moodVariability: 0,
        longestStreak: 0,
        totalEntries: 0,
      }
    }

    // Mood distribution
    const moodCounts: Record<string, number> = {}
    entries.forEach((e) => {
      moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1
    })
    const moodDistribution = MOOD_OPTIONS.map((m) => ({
      mood: m.type,
      count: moodCounts[m.type] || 0,
      percentage: ((moodCounts[m.type] || 0) / entries.length) * 100,
    })).filter((d) => d.count > 0)

    // Best/worst day of week
    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ]
    const dayMoods: Record<number, number[]> = {}
    entries.forEach((e) => {
      const [y, m, d] = e.date.split("-").map(Number)
      const day = new Date(y, m - 1, d).getDay()
      if (!dayMoods[day]) dayMoods[day] = []
      const val = MOOD_OPTIONS.find((mo) => mo.type === e.mood)?.value ?? 3
      dayMoods[day].push(val)
    })
    let bestDay: string | null = null
    let worstDay: string | null = null
    let bestAvg = -1
    let worstAvg = 6
    Object.entries(dayMoods).forEach(([day, values]) => {
      if (values.length < 2) return
      const avg = values.reduce((a, b) => a + b, 0) / values.length
      if (avg > bestAvg) {
        bestAvg = avg
        bestDay = dayNames[parseInt(day)]
      }
      if (avg < worstAvg) {
        worstAvg = avg
        worstDay = dayNames[parseInt(day)]
      }
    })

    // Mood variability (standard deviation)
    const allValues = entries.map(
      (e) => MOOD_OPTIONS.find((m) => m.type === e.mood)?.value ?? 3,
    )
    const mean = allValues.reduce((a, b) => a + b, 0) / allValues.length
    const variance =
      allValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) /
      allValues.length
    const moodVariability = Math.sqrt(variance)

    // Longest streak
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
    let longestStreak = 0
    let currentStreak = 1
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].date)
      const curr = new Date(sorted[i].date)
      const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
      if (diffDays === 1) {
        currentStreak++
      } else if (diffDays > 1) {
        currentStreak = 1
      }
      longestStreak = Math.max(longestStreak, currentStreak)
    }
    if (sorted.length === 1) longestStreak = 1

    return {
      moodDistribution,
      bestDayOfWeek: bestDay,
      worstDayOfWeek: worstDay,
      moodVariability,
      longestStreak,
      totalEntries: entries.length,
    }
  }, [entries])

  // AI Mood Insights (Pro feature)
  const insights = useMemo(() => {
    const result: { emoji: string; text: string }[] = []
    if (entries.length < 3) return result

    // Streak insight
    if (stats.streak >= 7) {
      result.push({
        emoji: "🔥",
        text: `Amazing! You're on a ${stats.streak}-day streak. Consistency is key to understanding your emotions.`,
      })
    } else if (stats.streak >= 3) {
      result.push({
        emoji: "👏",
        text: `Nice ${stats.streak}-day streak! Keep logging daily to build a clear picture of your mood patterns.`,
      })
    }

    // Trend insight - compare recent week to overall
    const recentEntries = entries.filter((e) => {
      const d = new Date(e.date)
      const now = new Date()
      return (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24) <= 7
    })
    if (recentEntries.length >= 3 && entries.length >= 10) {
      const recentAvg =
        recentEntries
          .map((e) => MOOD_OPTIONS.find((m) => m.type === e.mood)?.value ?? 3)
          .reduce((a, b) => a + b, 0) / recentEntries.length
      const overallAvg = stats.avgMood
      const diff = recentAvg - overallAvg
      if (diff > 0.5) {
        result.push({
          emoji: "📈",
          text: `Your mood this week is trending higher than your average. Whatever you're doing, keep it up!`,
        })
      } else if (diff < -0.5) {
        result.push({
          emoji: "💙",
          text: `Your mood has been a bit lower this week compared to your average. Consider activities that usually lift your spirits.`,
        })
      }
    }

    // Best day insight
    if (advancedStats.bestDayOfWeek) {
      result.push({
        emoji: "☀️",
        text: `${advancedStats.bestDayOfWeek}s tend to be your best days. Plan activities you enjoy on your harder days!`,
      })
    }

    // Variability insight
    if (advancedStats.moodVariability > 1.2) {
      result.push({
        emoji: "🎢",
        text: `Your moods show significant variation. Journaling notes with your entries may help identify triggers.`,
      })
    } else if (advancedStats.moodVariability < 0.5 && entries.length >= 7) {
      result.push({
        emoji: "⚖️",
        text: `Your mood has been quite stable. This consistency suggests good emotional balance.`,
      })
    }

    // Note-taking insight
    const entriesWithNotes = entries.filter(
      (e) => e.note && e.note.trim().length > 0,
    )
    if (entriesWithNotes.length === 0 && entries.length >= 5) {
      result.push({
        emoji: "📝",
        text: `Try adding notes to your mood entries — it helps you reflect on what influences your feelings.`,
      })
    } else if (entriesWithNotes.length > entries.length * 0.5) {
      result.push({
        emoji: "✍️",
        text: `Great job adding notes! Your reflections make your mood data much more meaningful.`,
      })
    }

    // Longest streak
    if (advancedStats.longestStreak >= 14) {
      result.push({
        emoji: "🏆",
        text: `Your all-time longest streak is ${advancedStats.longestStreak} days. Incredible dedication!`,
      })
    }

    return result.slice(0, 4) // Max 4 insights
  }, [entries, stats, advancedStats])

  // Export mood data as CSV
  const handleExportCSV = useCallback(async () => {
    if (entries.length === 0) {
      Alert.alert("No Data", "There are no mood entries to export.")
      return
    }
    const header = "Date,Mood,Value,Note"
    const rows = [...entries]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => {
        const val = MOOD_OPTIONS.find((m) => m.type === e.mood)?.value ?? 3
        const note = e.note ? `"${e.note.replace(/"/g, '""')}"` : ""
        return `${e.date},${e.mood},${val},${note}`
      })
    const csv = [header, ...rows].join("\n")
    try {
      await Share.share({
        message: csv,
        title: "Mood Tracker Data Export",
      })
    } catch (error) {
      Alert.alert("Export Failed", "Unable to share mood data.")
    }
  }, [entries])

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
  const todaysMoods = getTodaysMoods()
  const now = new Date()
  const todayFormatted = `${now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  })}, ${now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`

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
                : isPro
                  ? "Add Mood"
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
          {(["week", "month", "year"] as TimeRange[]).map((range) => {
            const isDisabled = range === "year" && !isPro
            return (
              <TouchableOpacity
                key={range}
                style={[
                  styles.rangeButton,
                  timeRange === range && styles.rangeButtonActive,
                  isDisabled && styles.rangeButtonDisabled,
                ]}
                onPress={() => {
                  if (isDisabled) {
                    setUpgradeModalVisible(true)
                    return
                  }
                  setTimeRange(range)
                  setSelectedBarIndex(null)
                  setChartOffset(0)
                }}
              >
                <ThemedText
                  style={[
                    styles.rangeButtonText,
                    timeRange === range && styles.rangeButtonTextActive,
                    isDisabled && styles.rangeButtonTextDisabled,
                  ]}
                >
                  {rangeConfig[range].label}
                  {isDisabled ? " 🔒" : ""}
                </ThemedText>
              </TouchableOpacity>
            )
          })}
        </ThemedView>

        {/* Chart */}
        {renderSimpleChart()}

        {/* Upgrade to Pro Button - only show if not pro */}
        {!isPro && (
          <TouchableOpacity
            style={styles.upgradeButton}
            onPress={() => setUpgradeModalVisible(true)}
            activeOpacity={0.8}
          >
            <ThemedText style={styles.upgradeButtonEmoji}>⭐</ThemedText>
            <View style={styles.upgradeButtonTextContainer}>
              <ThemedText style={styles.upgradeButtonTitle}>
                Upgrade to Pro
              </ThemedText>
              <ThemedText style={styles.upgradeButtonSubtitle}>
                Unlock Year view, Show all entries & more
              </ThemedText>
            </View>
            <ThemedText style={styles.upgradeButtonArrow}>→</ThemedText>
          </TouchableOpacity>
        )}

        {/* Pro Badge - show if pro */}
        {isPro && (
          <View style={styles.proBadge}>
            <ThemedText style={styles.proBadgeEmoji}>⭐</ThemedText>
            <ThemedText style={styles.proBadgeText}>Pro Member</ThemedText>
          </View>
        )}

        {/* Today's Mood Button */}
        {isPro && todaysMoods.length > 0 ? (
          <ThemedView style={styles.todayMoodMultiContainer}>
            <View style={styles.todayMoodMultiHeader}>
              <ThemedText style={styles.todayMoodMultiTitle}>
                🎭 Today's Moods
              </ThemedText>
              <ThemedText style={styles.todayMoodMultiCount}>
                {todaysMoods.length}{" "}
                {todaysMoods.length === 1 ? "entry" : "entries"}
              </ThemedText>
            </View>
            {todaysMoods.map((entry) => {
              const mood = getMoodOption(entry.mood)
              return (
                <View
                  key={entry.id}
                  style={[
                    styles.todayMoodMultiEntry,
                    { borderLeftColor: mood.color },
                  ]}
                >
                  <ThemedText style={styles.todayMoodMultiEmoji}>
                    {mood.emoji}
                  </ThemedText>
                  <View style={styles.todayMoodMultiInfo}>
                    <ThemedText style={styles.todayMoodMultiMood}>
                      {mood.label}
                    </ThemedText>
                    {entry.note && (
                      <ThemedText
                        style={styles.todayMoodMultiNote}
                        numberOfLines={1}
                      >
                        {entry.note}
                      </ThemedText>
                    )}
                  </View>
                  <ThemedText style={styles.todayMoodMultiTime}>
                    {entry.time || ""}
                  </ThemedText>
                </View>
              )
            })}
            <TouchableOpacity
              style={styles.addAnotherMoodButton}
              onPress={openMoodModal}
              activeOpacity={0.7}
            >
              <ThemedText style={styles.addAnotherMoodText}>
                + Log Another Mood
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>
        ) : (
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
        )}

        {/* Stats - Pro feature */}
        {isPro ? (
          <ThemedView style={styles.statsContainer}>
            <ThemedText type="subtitle" style={styles.statsTitle}>
              📊 Advanced Statistics
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

            {/* Mood Distribution */}
            {advancedStats.moodDistribution.length > 0 && (
              <View style={styles.analyticsSection}>
                <ThemedText style={styles.analyticsSectionTitle}>
                  Mood Distribution
                </ThemedText>
                {advancedStats.moodDistribution.map((item) => {
                  const mood = getMoodOption(item.mood)
                  return (
                    <View key={item.mood} style={styles.distributionRow}>
                      <ThemedText style={styles.distributionEmoji}>
                        {mood.emoji}
                      </ThemedText>
                      <ThemedText style={styles.distributionLabel}>
                        {mood.label}
                      </ThemedText>
                      <View style={styles.distributionBarContainer}>
                        <View
                          style={[
                            styles.distributionBar,
                            {
                              width: `${Math.max(item.percentage, 2)}%`,
                              backgroundColor: mood.color,
                            },
                          ]}
                        />
                      </View>
                      <ThemedText style={styles.distributionPercent}>
                        {Math.round(item.percentage)}%
                      </ThemedText>
                    </View>
                  )
                })}
              </View>
            )}

            {/* Additional Analytics */}
            <View style={styles.analyticsSection}>
              <ThemedText style={styles.analyticsSectionTitle}>
                Deep Insights
              </ThemedText>
              <View style={styles.analyticsGrid}>
                {advancedStats.bestDayOfWeek && (
                  <ThemedView style={styles.analyticsCard}>
                    <ThemedText style={styles.analyticsCardEmoji}>
                      ☀️
                    </ThemedText>
                    <ThemedText style={styles.analyticsCardLabel}>
                      Best Day
                    </ThemedText>
                    <ThemedText style={styles.analyticsCardValue}>
                      {advancedStats.bestDayOfWeek}
                    </ThemedText>
                  </ThemedView>
                )}
                {advancedStats.worstDayOfWeek && (
                  <ThemedView style={styles.analyticsCard}>
                    <ThemedText style={styles.analyticsCardEmoji}>
                      🌧️
                    </ThemedText>
                    <ThemedText style={styles.analyticsCardLabel}>
                      Hardest Day
                    </ThemedText>
                    <ThemedText style={styles.analyticsCardValue}>
                      {advancedStats.worstDayOfWeek}
                    </ThemedText>
                  </ThemedView>
                )}
                <ThemedView style={styles.analyticsCard}>
                  <ThemedText style={styles.analyticsCardEmoji}>🏆</ThemedText>
                  <ThemedText style={styles.analyticsCardLabel}>
                    Best Streak
                  </ThemedText>
                  <ThemedText style={styles.analyticsCardValue}>
                    {advancedStats.longestStreak}{" "}
                    {advancedStats.longestStreak === 1 ? "day" : "days"}
                  </ThemedText>
                </ThemedView>
                <ThemedView style={styles.analyticsCard}>
                  <ThemedText style={styles.analyticsCardEmoji}>📈</ThemedText>
                  <ThemedText style={styles.analyticsCardLabel}>
                    Total Entries
                  </ThemedText>
                  <ThemedText style={styles.analyticsCardValue}>
                    {advancedStats.totalEntries}
                  </ThemedText>
                </ThemedView>
              </View>
            </View>

            {/* AI Mood Insights */}
            {insights.length > 0 && (
              <View style={styles.analyticsSection}>
                <ThemedText style={styles.analyticsSectionTitle}>
                  ✨ Mood Insights
                </ThemedText>
                {insights.map((insight, index) => (
                  <View key={index} style={styles.insightCard}>
                    <ThemedText style={styles.insightEmoji}>
                      {insight.emoji}
                    </ThemedText>
                    <ThemedText style={styles.insightText}>
                      {insight.text}
                    </ThemedText>
                  </View>
                ))}
              </View>
            )}
          </ThemedView>
        ) : (
          <TouchableOpacity
            style={styles.statsUpgradeContainer}
            onPress={() => setUpgradeModalVisible(true)}
          >
            <ThemedText style={styles.statsUpgradeEmoji}>🔒</ThemedText>
            <View style={styles.statsUpgradeContent}>
              <ThemedText style={styles.statsUpgradeTitle}>
                Advanced Statistics
              </ThemedText>
              <ThemedText style={styles.statsUpgradeSubtitle}>
                Unlock detailed analytics with Pro
              </ThemedText>
            </View>
            <ThemedText style={styles.statsUpgradeArrow}>→</ThemedText>
          </TouchableOpacity>
        )}

        {/* Recent Entries */}
        {filteredEntries.length > 0 && (
          <ThemedView style={styles.recentContainer}>
            <View style={styles.recentHeader}>
              <ThemedText type="subtitle" style={styles.recentTitle}>
                Recent Entries
              </ThemedText>
              {isPro && filteredEntries.length > 3 && (
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

      {/* Upgrade to Pro Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={upgradeModalVisible}
        onRequestClose={() => setUpgradeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView
            style={[
              styles.modalContent,
              styles.upgradeModalContent,
              { backgroundColor },
            ]}
          >
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle">Upgrade to Pro</ThemedText>
              <TouchableOpacity
                onPress={() => setUpgradeModalVisible(false)}
                style={styles.closeButton}
              >
                <ThemedText style={styles.closeButtonText}>✕</ThemedText>
              </TouchableOpacity>
            </View>

            <View style={styles.proHeaderSection}>
              <ThemedText style={styles.proHeaderEmoji}>⭐</ThemedText>
              <ThemedText style={styles.proHeaderTitle}>
                Mood Tracker Pro
              </ThemedText>
              <ThemedText style={styles.proHeaderSubtitle}>
                Take your mood tracking to the next level
              </ThemedText>
            </View>

            <ScrollView
              style={styles.featuresScrollView}
              showsVerticalScrollIndicator={false}
            >
              {PRO_FEATURES.map((feature) => (
                <View key={feature.id} style={styles.featureItem}>
                  <ThemedText style={styles.featureEmoji}>
                    {feature.emoji}
                  </ThemedText>
                  <View style={styles.featureTextContainer}>
                    <ThemedText style={styles.featureTitle}>
                      {feature.title}
                    </ThemedText>
                    <ThemedText style={styles.featureDescription}>
                      {feature.description}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.pricingSection}>
              <ThemedText style={styles.pricingText}>
                $0.99 one-time purchase
              </ThemedText>
              <ThemedText style={styles.pricingSavings}>
                Unlock all features forever!
              </ThemedText>
            </View>

            <TouchableOpacity
              style={styles.subscribeButton}
              onPress={() => {
                // In a real app, this would trigger the in-app purchase flow
                setUpgradeModalVisible(false)
                Alert.alert(
                  "Coming Soon",
                  "In-app purchases will be available in a future update!",
                )
              }}
              activeOpacity={0.8}
            >
              <ThemedText style={styles.subscribeButtonText}>
                Upgrade Now
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.restoreButton}
              onPress={() => {
                Alert.alert("Restore", "Checking for previous purchases...")
              }}
            >
              <ThemedText style={styles.restoreButtonText}>
                Restore Purchase
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </View>
      </Modal>

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
      {__DEV__ && isDevView && (
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
  rangeButtonDisabled: {
    opacity: 0.5,
  },
  rangeButtonTextDisabled: {
    opacity: 0.7,
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
  // Multi-mood (Pro)
  todayMoodMultiContainer: {
    marginBottom: 24,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(139, 92, 246, 0.3)",
    backgroundColor: "rgba(139, 92, 246, 0.05)",
    padding: 16,
    overflow: "visible",
  },
  todayMoodMultiHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  todayMoodMultiTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  todayMoodMultiCount: {
    fontSize: 13,
    opacity: 0.6,
  },
  todayMoodMultiEntry: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "rgba(150, 150, 150, 0.05)",
    marginBottom: 8,
    borderLeftWidth: 4,
    overflow: "visible",
  },
  todayMoodMultiEmoji: {
    fontSize: 24,
    lineHeight: 32,
    marginRight: 10,
  },
  todayMoodMultiInfo: {
    flex: 1,
  },
  todayMoodMultiMood: {
    fontSize: 15,
    fontWeight: "600",
  },
  todayMoodMultiNote: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  todayMoodMultiTime: {
    fontSize: 12,
    opacity: 0.5,
    fontWeight: "500",
  },
  addAnotherMoodButton: {
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#8B5CF6",
    borderStyle: "dashed",
    marginTop: 4,
  },
  addAnotherMoodText: {
    color: "#8B5CF6",
    fontWeight: "600",
    fontSize: 14,
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
  statsUpgradeContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    backgroundColor: "rgba(150, 150, 150, 0.05)",
    borderWidth: 2,
    borderColor: "rgba(150, 150, 150, 0.2)",
    marginBottom: 24,
  },
  statsUpgradeEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  statsUpgradeContent: {
    flex: 1,
  },
  statsUpgradeTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  statsUpgradeSubtitle: {
    fontSize: 13,
    opacity: 0.6,
  },
  statsUpgradeArrow: {
    fontSize: 18,
    opacity: 0.6,
  },
  exportButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 12,
  },
  exportButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
  analyticsSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(150, 150, 150, 0.15)",
  },
  analyticsSectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 12,
  },
  distributionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  distributionEmoji: {
    fontSize: 18,
    width: 28,
  },
  distributionLabel: {
    fontSize: 13,
    width: 64,
    fontWeight: "500",
  },
  distributionBarContainer: {
    flex: 1,
    height: 12,
    backgroundColor: "rgba(150, 150, 150, 0.1)",
    borderRadius: 6,
    marginHorizontal: 8,
    overflow: "hidden",
  },
  distributionBar: {
    height: "100%",
    borderRadius: 6,
  },
  distributionPercent: {
    fontSize: 12,
    fontWeight: "600",
    width: 36,
    textAlign: "right",
  },
  analyticsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  analyticsCard: {
    flex: 1,
    minWidth: "45%",
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(150, 150, 150, 0.05)",
    alignItems: "center",
    overflow: "visible",
  },
  analyticsCardEmoji: {
    fontSize: 22,
    lineHeight: 30,
    marginBottom: 4,
  },
  analyticsCardLabel: {
    fontSize: 11,
    opacity: 0.6,
    marginBottom: 2,
  },
  analyticsCardValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  insightCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(139, 92, 246, 0.08)",
    marginBottom: 8,
  },
  insightEmoji: {
    fontSize: 20,
    marginRight: 10,
    lineHeight: 28,
  },
  insightText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.85,
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

  // Upgrade to Pro Button
  upgradeButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#8B5CF6",
    borderWidth: 2,
    borderColor: "#7C3AED",
  },
  upgradeButtonEmoji: {
    fontSize: 28,
    lineHeight: 36,
    marginRight: 12,
  },
  upgradeButtonTextContainer: {
    flex: 1,
  },
  upgradeButtonTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  upgradeButtonSubtitle: {
    fontSize: 13,
    color: "#f0f0f0",
    marginTop: 2,
  },
  upgradeButtonArrow: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  // Pro Badge
  proBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(156, 39, 176, 0.15)",
    borderWidth: 1,
    borderColor: "#9C27B0",
  },
  proBadgeEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  proBadgeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9C27B0",
  },
  // Upgrade Modal
  upgradeModalContent: {
    maxHeight: "85%",
  },
  proHeaderSection: {
    alignItems: "center",
    marginBottom: 20,
    paddingTop: 8,
  },
  proHeaderEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  proHeaderTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
  },
  proHeaderSubtitle: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: "center",
  },
  featuresScrollView: {
    maxHeight: 240,
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(150, 150, 150, 0.15)",
  },
  featureEmoji: {
    fontSize: 24,
    marginRight: 12,
    width: 32,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 13,
    opacity: 0.7,
    lineHeight: 18,
  },
  pricingSection: {
    alignItems: "center",
    marginBottom: 16,
  },
  pricingText: {
    fontSize: 16,
    fontWeight: "600",
  },
  pricingSavings: {
    fontSize: 13,
    color: "#4CAF50",
    fontWeight: "600",
    marginTop: 4,
  },
  subscribeButton: {
    backgroundColor: "#9C27B0",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  subscribeButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
  },
  restoreButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  restoreButtonText: {
    fontSize: 14,
    opacity: 0.7,
  },
})
