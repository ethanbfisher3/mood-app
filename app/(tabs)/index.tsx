import Ionicons from "@expo/vector-icons/Ionicons"
import { useRouter } from "expo-router"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Alert,
  Image,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native"

import { Calendar } from "react-native-calendars"
import { Swipeable } from "react-native-gesture-handler"

import { ThemedText } from "@/components/themed-text"
import { ThemedView } from "@/components/themed-view"
import {
  getMoodOption,
  MOOD_OPTIONS,
  MoodEntry,
  MoodType,
} from "@/constants/moods"
import { useMoodStorage } from "@/hooks/use-mood-storage"
import { PRO_FEATURES, useProSubscription } from "@/hooks/use-pro-subscription"
import { useThemeColor } from "@/hooks/use-theme-color"
import { computeMoodDistribution } from "@/lib/mood-distribution"

type TimeRange = "week" | "month" | "year"

export default function TrendsScreen({ isDevView }: { isDevView?: boolean }) {
  const router = useRouter()
  const {
    entries,
    reload,
    saveMood,
    saveMoodForDate,
    deleteMood,
    updateMood,
    getTodaysMood,
    getTodaysMoods,
  } = useMoodStorage()
  const [timeRange, setTimeRange] = useState<TimeRange>("month")
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedMoods, setSelectedMoods] = useState<MoodType[]>([])
  const [note, setNote] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null)
  const [selectedMoodType, setSelectedMoodType] = useState<MoodType | null>(
    null,
  )
  const [chartOffset, setChartOffset] = useState(0) // 0 = current period, negative = past
  const [devModalVisible, setDevModalVisible] = useState(false)
  const [devSelectedMoods, setDevSelectedMoods] = useState<MoodType[]>([])
  const [devDate, setDevDate] = useState("")
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false)

  const { isPro } = useProSubscription()

  const backgroundColor = useThemeColor({}, "background")
  const textColor = useThemeColor({}, "text")
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  const leftGridScrollRef = useRef<ScrollView | null>(null)
  const rightGridScrollRef = useRef<ScrollView | null>(null)
  const rightHorizontalRef = useRef<ScrollView | null>(null)
  const labelScrollRef = useRef<ScrollView | null>(null)
  const isSyncingScroll = useRef(false)

  const onLeftGridScroll = (e: any) => {
    if (isSyncingScroll.current) {
      isSyncingScroll.current = false
      return
    }
    const y = e.nativeEvent.contentOffset.y
    isSyncingScroll.current = true
    rightGridScrollRef.current?.scrollTo({ y, animated: false })
  }

  const onRightGridScroll = (e: any) => {
    if (isSyncingScroll.current) {
      isSyncingScroll.current = false
      return
    }
    const y = e.nativeEvent.contentOffset.y
    isSyncingScroll.current = true
    leftGridScrollRef.current?.scrollTo({ y, animated: false })
  }

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow"
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide"

    const showSub = Keyboard.addListener(showEvent, (e: any) => {
      setKeyboardHeight(e.endCoordinates?.height || 0)
    })
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0))

    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  // Load today's mood when modal opens
  const openMoodModal = useCallback(() => {
    setEditingEntryId(null)
    if (isPro) {
      // Pro users always start fresh to add another mood
      setSelectedMoods([])
      setNote("")
    } else {
      const todaysMood = getTodaysMood()
      if (todaysMood) {
        setSelectedMoods(todaysMood.moods)
        setNote(todaysMood.note || "")
      } else {
        setSelectedMoods([])
        setNote("")
      }
    }
    setModalVisible(true)
  }, [getTodaysMood, isPro])

  // Open modal to edit a specific entry
  const openEditMoodModal = useCallback((entry: MoodEntry) => {
    setEditingEntryId(entry.id)
    setSelectedMoods(entry.moods)
    setNote(entry.note || "")
    setModalVisible(true)
  }, [])

  const handleSaveMood = async () => {
    if (!selectedMoods || selectedMoods.length === 0) {
      Alert.alert("Select a Mood", "Please select how you're feeling today.")
      return
    }

    setIsSaving(true)
    let success: boolean
    if (editingEntryId) {
      // Update existing entry
      success = await updateMood(
        editingEntryId,
        selectedMoods,
        note.trim() || undefined,
      )
    } else {
      success = await saveMood(selectedMoods, note.trim() || undefined, isPro) // append multiple for Pro users
    }
    setIsSaving(false)

    if (success) {
      setModalVisible(false)
      setEditingEntryId(null)
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
      return { mostCommon: null, streak: 0 }
    }

    // Most common mood
    const moodCounts: Record<string, number> = {}
    filteredEntries.forEach((e: MoodEntry) => {
      e.moods.forEach((m) => {
        moodCounts[m] = (moodCounts[m] || 0) + 1
      })
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

    return { mostCommon, streak }
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

    // Mood distribution (counts across all recorded moods)
    const moodDistribution = computeMoodDistribution(entries)

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
      dayMoods[day].push(...e.moods.map((mood) => getMoodOption(mood).value))
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
      (e) =>
        e.moods
          .map((mood) => getMoodOption(mood).value)
          .reduce((a, b) => a + b, 0) / e.moods.length,
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

    // Best day insight
    if (advancedStats.bestDayOfWeek) {
      result.push({
        emoji: require("@/assets/images/app_emoji/best.png"),
        text: `${advancedStats.bestDayOfWeek}s tend to be your best days. Plan activities you enjoy on your harder days!`,
      })
    }

    // Variability insight
    if (advancedStats.moodVariability > 1.2) {
      result.push({
        emoji: require("@/assets/images/app_emoji/stressed.png"),
        text: `Your moods show significant variation. Journaling notes with your entries may help identify triggers.`,
      })
    } else if (advancedStats.moodVariability < 0.5 && entries.length >= 7) {
      result.push({
        emoji: require("@/assets/images/app_emoji/relieved.png"),
        text: `Your mood has been quite stable. This consistency suggests good emotional balance.`,
      })
    }

    // Note-taking insight
    const entriesWithNotes = entries.filter(
      (e) => e.note && e.note.trim().length > 0,
    )
    if (entriesWithNotes.length === 0 && entries.length >= 5) {
      result.push({
        emoji: require("@/assets/images/app_emoji/notes.png"),
        text: `Try adding notes to your mood entries — it helps you reflect on what influences your feelings.`,
      })
    } else if (entriesWithNotes.length > entries.length * 0.5) {
      result.push({
        emoji: require("@/assets/images/app_emoji/notes.png"),
        text: `Great job adding notes! Your reflections make your mood data much more meaningful.`,
      })
    }

    // Longest streak
    if (advancedStats.longestStreak >= 14) {
      result.push({
        emoji: require("@/assets/images/app_emoji/streak.png"),
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
        const moods =
          (e as any).moods ?? ((e as any).mood ? [(e as any).mood] : [])
        const val =
          Math.round(
            (moods
              .map(
                (m: MoodType) =>
                  MOOD_OPTIONS.find((o) => o.type === m)?.value ?? 3,
              )
              .reduce((a: number, b: number) => a + b, 0) /
              Math.max(1, moods.length)) *
              100,
          ) / 100
        const note = e.note ? `"${e.note.replace(/"/g, '""')}"` : ""
        return `${e.date},${moods.join("|")},${val},${note}`
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
    const data: { date: string; entry?: MoodEntry }[] = []

    if (timeRange === "year") {
      // For year view, always show January through December of the current year (with offset)
      const now = new Date()
      const year = now.getFullYear() + chartOffset

      // Generate 12 months starting from January
      for (let month = 0; month < 12; month++) {
        // Find entries for this month
        const monthEntries = entries.filter((e) => {
          const entryDate = new Date(e.date)
          return (
            entryDate.getMonth() === month && entryDate.getFullYear() === year
          )
        })

        data.push({
          date: `${year}-${String(month + 1).padStart(2, "0")}`,
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
          entry,
        })
      }
    } else {
      // Week view - always start on Monday
      const days = rangeConfig[timeRange].days
      const today = new Date()
      today.setDate(today.getDate() + chartOffset * 7)

      // Find Monday of the current week (0 = Sunday, 1 = Monday)
      const dayOfWeek = today.getDay()
      const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
      const monday = new Date(today.setDate(diff))

      for (let i = 0; i < days; i++) {
        const date = new Date(monday)
        date.setDate(monday.getDate() + i)
        const dateStr = date.toISOString().split("T")[0]
        const entry = filteredEntries.find((e) => e.date === dateStr)

        data.push({
          date: dateStr,
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
      // For year view, check if there are entries from years before the current year
      const currentYear = startDate.split("-")[0]
      hasBefore = entries.some((e) => e.date.split("-")[0] < currentYear)
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
    const chartHeight = 320
    const cellSize = 32
    const cellGap = 8
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
    const dayNamesShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

    let xLabels: string[] = []
    if (timeRange === "week") {
      // Generate labels for each data point based on actual day of week
      xLabels = chartData.map((d) => {
        // Parse date parts directly to avoid timezone issues
        const [year, month, day] = d.date.split("-").map(Number)
        const date = new Date(year, month - 1, day)
        return dayNamesShort[date.getDay()]
      })
    } else if (timeRange === "month") {
      // Generate labels for each data point, showing day number at intervals
      // Show every day number for month view
      xLabels = chartData.map((d) => {
        const dayOfMonth = parseInt(d.date.split("-")[2], 10)
        return dayOfMonth.toString()
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
        {/* Navigation Controls - positioned at bottom of chart */}
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 4,
            marginTop: 4,
            paddingHorizontal: 16,
            backgroundColor:
              backgroundColor === "#151718"
                ? "rgba(29, 29, 29, 0.95)"
                : "rgba(249, 249, 249, 0.95)",
            zIndex: 25,
            borderRadius: "25%",
          }}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            onPress={() => setChartOffset(chartOffset - 1)}
            disabled={!hasEntriesBefore}
            style={{
              padding: 8,
              marginRight: 12,
              opacity: hasEntriesBefore ? 1 : 0.2,
            }}
          >
            <Ionicons name="chevron-back" size={24} color={textColor} />
          </TouchableOpacity>
          <ThemedText
            style={{
              fontSize: 12,
              opacity: 0.7,
              textAlign: "center",
              flex: 1,
              fontWeight: "500",
            }}
            numberOfLines={1}
          >
            {dateRangeText}
          </ThemedText>
          <TouchableOpacity
            onPress={() => setChartOffset(chartOffset + 1)}
            disabled={!hasEntriesAfter}
            style={{
              padding: 8,
              marginLeft: 12,
              opacity: hasEntriesAfter ? 1 : 0.2,
            }}
          >
            <Ionicons name="chevron-forward" size={24} color={textColor} />
          </TouchableOpacity>
        </View>
        <View style={{ height: chartHeight, width: "100%" }}>
          {/* Layout: fixed left emoji column + right area that scrolls horizontally. */}
          <View style={{ flexDirection: "row" }}>
            {/* Left emoji column stays fixed horizontally; it still scrolls vertically. */}
            <ScrollView
              ref={(ref) => {
                leftGridScrollRef.current = ref
              }}
              onScroll={onLeftGridScroll}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
              contentContainerStyle={{ paddingTop: 8, paddingBottom: 80 }}
              style={{ width: cellSize + cellGap }}
            >
              {MOOD_OPTIONS.map((moodRow) => (
                <View
                  key={`label-${moodRow.type}`}
                  style={{
                    height: cellSize,
                    marginBottom: cellGap,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Image
                    source={moodRow.image}
                    style={{ width: cellSize, height: cellSize }}
                  />
                </View>
              ))}
              {/* Ensure bottom-left intersection stays blank by reserving space equal to one cell */}
              <View style={{ height: cellSize + cellGap }} />
            </ScrollView>

            {/* Right area: horizontal scrolling for days; contains a vertical grid and x-axis labels fixed below it. */}
            <ScrollView
              horizontal
              ref={(ref) => {
                rightHorizontalRef.current = ref
              }}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 16 }}
              onScrollBeginDrag={() => {
                setSelectedBarIndex(null)
                setSelectedMoodType(null)
              }}
              onScroll={(e: any) => {
                const x = e.nativeEvent.contentOffset.x
                labelScrollRef.current?.scrollTo({ x, animated: false })
              }}
              scrollEventThrottle={16}
            >
              <View>
                <ScrollView
                  ref={(ref) => {
                    rightGridScrollRef.current = ref
                  }}
                  onScroll={onRightGridScroll}
                  scrollEventThrottle={16}
                  nestedScrollEnabled={true}
                  showsVerticalScrollIndicator={false}
                  style={{ height: chartHeight }}
                  contentContainerStyle={{ paddingVertical: 8 }}
                >
                  {MOOD_OPTIONS.map((moodRow) => (
                    <View
                      key={`row-${moodRow.type}`}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        height: cellSize,
                        marginBottom: cellGap,
                        paddingRight: 4,
                      }}
                    >
                      {chartData.map((point, colIndex) => {
                        const entry = point.entry
                        const hasMood = entry
                          ? entry.moods.includes(moodRow.type)
                          : false
                        const BoxComponent =
                          timeRange === "year" ? TouchableOpacity : View
                        const handleBoxPress = () => {
                          // Toggle: if same box clicked, close popup
                          if (
                            selectedBarIndex === colIndex &&
                            selectedMoodType === moodRow.type
                          ) {
                            setSelectedBarIndex(null)
                            setSelectedMoodType(null)
                          } else {
                            setSelectedBarIndex(colIndex)
                            setSelectedMoodType(moodRow.type)
                          }
                        }
                        return (
                          <BoxComponent
                            key={`${moodRow.type}-${colIndex}`}
                            onPress={
                              timeRange === "year" ? handleBoxPress : undefined
                            }
                            style={{
                              width: cellSize,
                              height: cellSize,
                              marginRight: cellGap,
                              borderRadius: 6,
                              backgroundColor: hasMood
                                ? moodRow.color
                                : "rgba(150,150,150,0.08)",
                            }}
                          />
                        )
                      })}
                    </View>
                  ))}
                </ScrollView>

                {/* X-axis labels aligned with grid columns — placed inside the horizontal ScrollView but outside the vertical ScrollView so they remain visible during vertical scroll. */}
                <View style={{ height: 48, marginTop: 6 }} />
              </View>
            </ScrollView>
            {/* Floating label row positioned above the left emoji column so numbers render on top. */}
            <ScrollView
              horizontal
              ref={(ref) => {
                labelScrollRef.current = ref
              }}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 16 }}
              style={{
                position: "absolute",
                bottom: 30,
                left: cellSize + cellGap,
                right: 16,
                height: 24,
                zIndex: 20,
                backgroundColor: "transparent",
              }}
              pointerEvents="none"
            >
              {xLabels.map((label, idx) => (
                <ThemedText
                  key={`label-top-${idx}`}
                  style={{
                    width: cellSize,
                    textAlign: timeRange === "month" ? "right" : "center",
                    paddingRight: timeRange === "month" ? 16 : 8,
                    marginRight: cellGap,
                    fontSize: timeRange === "month" ? 12 : 10,
                  }}
                  numberOfLines={1}
                >
                  {timeRange === "month" ? label : String(label).slice(0, 3)}
                </ThemedText>
              ))}
            </ScrollView>

            {/* Cover bottom-left so emojis don't sit in the corner */}
            <View
              style={{
                position: "absolute",
                left: 0,
                bottom: 0,
                width: cellSize,
                height: 54,
                backgroundColor:
                  backgroundColor === "#151718"
                    ? "rgb(29, 29, 29)"
                    : "rgb(249, 249, 249)",
                zIndex: 15,
              }}
              pointerEvents="none"
            />
          </View>
        </View>

        {/* Tooltip for selected box - rendered outside ScrollView to appear on top */}
        {timeRange === "year" &&
          selectedBarIndex !== null &&
          selectedMoodType !== null && (
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
                    chartPadding + maxBarHeight - (3.5 / 4) * maxBarHeight - 50,
                },
              ]}
            >
              {(() => {
                const monthKey = chartData[selectedBarIndex].date // "YYYY-MM"
                const monthEntries = entries.filter((e) =>
                  e.date.startsWith(monthKey),
                )
                const moodCounts: Record<string, number> = {}
                monthEntries.forEach((me) => {
                  me.moods.forEach((mt) => {
                    moodCounts[mt] = (moodCounts[mt] || 0) + 1
                  })
                })

                const selectedMood = MOOD_OPTIONS.find(
                  (m) => m.type === selectedMoodType,
                )
                const count = moodCounts[selectedMoodType] || 0

                return (
                  <View
                    style={{
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {selectedMood && (
                      <Image
                        source={selectedMood.image}
                        style={styles.tooltipImage}
                      />
                    )}
                    <ThemedText
                      style={[styles.barTooltipText, { marginLeft: 8 }]}
                    >
                      Found in {count} entr{count !== 1 ? "ies" : "y"}
                    </ThemedText>
                  </View>
                )
              })()}
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
        <ThemedView
          style={[
            styles.modalContent,
            { backgroundColor, marginBottom: Math.max(0, keyboardHeight) },
          ]}
        >
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
            {MOOD_OPTIONS.map((mood) => {
              const selected = selectedMoods.includes(mood.type)
              return (
                <TouchableOpacity
                  key={mood.type}
                  style={[
                    styles.moodButton,
                    selected && {
                      backgroundColor: mood.color + "30",
                      borderColor: mood.color,
                      borderWidth: 3,
                    },
                  ]}
                  onPress={() => {
                    setSelectedMoods((prev) =>
                      prev.includes(mood.type)
                        ? prev.filter((p) => p !== mood.type)
                        : [...prev, mood.type],
                    )
                  }}
                  activeOpacity={0.7}
                >
                  <Image source={mood.image} style={styles.moodImage} />
                </TouchableOpacity>
              )
            })}
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
            maxLength={75}
          />

          <TouchableOpacity
            style={[
              styles.saveButton,
              (selectedMoods.length == 0 || isSaving) &&
                styles.saveButtonDisabled,
            ]}
            onPress={handleSaveMood}
            disabled={selectedMoods.length == 0 || isSaving}
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
          <ThemedText type="default" style={{ marginTop: 4 }}>
            View your moods for this{" "}
            {timeRange === "week"
              ? "week"
              : timeRange === "month"
                ? "month"
                : "year"}
          </ThemedText>
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
                ]}
                onPress={() => {
                  if (isDisabled) {
                    setUpgradeModalVisible(true)
                    return
                  }
                  setTimeRange(range)
                  setSelectedBarIndex(null)
                  setSelectedMoodType(null)
                  setChartOffset(0)
                }}
              >
                <ThemedText style={[styles.rangeButtonText]}>
                  {rangeConfig[range].label}
                </ThemedText>
                {isDisabled ? (
                  <Image
                    source={require("@/assets/images/app_emoji/locked.png")}
                    style={styles.lockedImage}
                  />
                ) : null}
              </TouchableOpacity>
            )
          })}
        </ThemedView>

        {/* Chart */}
        {renderSimpleChart()}

        {/* Today's Mood Button */}
        {isPro && todaysMoods.length > 0 ? (
          <ThemedView style={styles.todayMoodMultiContainer}>
            <View style={styles.todayMoodMultiHeader}>
              <ThemedText style={styles.todayMoodMultiTitle}>
                Today's Moods
              </ThemedText>
              <ThemedText style={styles.todayMoodMultiCount}>
                {todaysMoods.length}{" "}
                {todaysMoods.length === 1 ? "entry" : "entries"}
              </ThemedText>
            </View>
            {todaysMoods.map((entry) => {
              const mood = getMoodOption(entry.moods[0] ?? MOOD_OPTIONS[2].type)
              const renderRightActions = () => (
                <TouchableOpacity
                  style={styles.deleteSwipeAction}
                  onPress={() => {
                    Alert.alert(
                      "Delete Mood",
                      "Are you sure you want to delete this mood entry?",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Delete",
                          style: "destructive",
                          onPress: () => deleteMood(entry.id),
                        },
                      ],
                    )
                  }}
                >
                  <Ionicons name="trash-outline" size={24} color="white" />
                </TouchableOpacity>
              )
              return (
                <Swipeable
                  key={entry.id}
                  renderRightActions={renderRightActions}
                  overshootRight={false}
                >
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => openEditMoodModal(entry)}
                    style={[
                      styles.todayMoodMultiEntry,
                      { borderLeftColor: mood.color },
                    ]}
                  >
                    {entry.moods
                      ? entry.moods.map((mood: MoodType) => {
                          const moodOption = getMoodOption(mood)
                          return (
                            <Image
                              key={moodOption.type}
                              source={moodOption.image}
                              style={styles.todayMoodMultiImage}
                            />
                          )
                        })
                      : entry.moods && (
                          <Image
                            key={getMoodOption(entry.moods[0]).type}
                            source={getMoodOption(entry.moods[0]).image}
                            style={styles.todayMoodMultiImage}
                          />
                        )}

                    <View style={styles.todayMoodMultiInfo}>
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
                  </TouchableOpacity>
                </Swipeable>
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
              todaysMood &&
                (() => {
                  const m = todaysMood.moods[0] ?? MOOD_OPTIONS[2].type
                  return {
                    borderColor: getMoodOption(m).color,
                    backgroundColor: getMoodOption(m).color + "15",
                  }
                })(),
            ]}
            onPress={openMoodModal}
            activeOpacity={0.7}
          >
            {todaysMood ? (
              <View style={styles.todayMoodContent}>
                {(() => {
                  const m = todaysMood.moods[0] ?? MOOD_OPTIONS[2].type
                  return (
                    <Image
                      source={getMoodOption(m).image}
                      style={styles.todayMoodEmojiImage}
                    />
                  )
                })()}
                <View style={styles.todayMoodTextContainer}>
                  <ThemedText style={styles.todayMoodLabel}>
                    Today's Mood
                  </ThemedText>
                  <ThemedText style={styles.todayMoodValue}>
                    {(() =>
                      getMoodOption(todaysMood.moods[0] ?? MOOD_OPTIONS[2].type)
                        .label)()}
                  </ThemedText>
                </View>
                <ThemedText style={styles.todayMoodEdit}>Edit</ThemedText>
              </View>
            ) : (
              <View style={styles.todayMoodContent}>
                <ThemedText style={styles.todayMoodEmoji}>+</ThemedText>
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
            <View style={styles.statsGrid}>
              {/* Average Mood card removed per request; grid will show remaining 3 stats */}

              <ThemedView style={styles.statCard}>
                {stats.mostCommon ? (
                  <Image
                    source={getMoodOption(stats.mostCommon as any).image}
                    style={{
                      ...styles.statImage,
                      marginBottom: 0,
                      paddingTop: 4,
                    }}
                  />
                ) : (
                  <ThemedText style={styles.statEmoji}>—</ThemedText>
                )}
                <ThemedText style={styles.statLabel}>
                  Most Common Mood
                </ThemedText>
              </ThemedView>

              <ThemedView style={styles.statCard}>
                <Image
                  source={require("@/assets/images/app_emoji/streak.png")}
                  style={styles.analyticsCardEmoji}
                />
                <ThemedText style={styles.statLabel}>Current Streak</ThemedText>
                <ThemedText style={styles.statValue}>
                  {stats.streak} {stats.streak === 1 ? "day" : "days"}
                </ThemedText>
              </ThemedView>
            </View>

            {/* Mood Distribution */}
            {advancedStats.moodDistribution.length > 0 && (
              <View style={styles.analyticsSection}>
                <View style={styles.analyticsSectionTitleContainer}>
                  <ThemedText style={styles.analyticsSectionTitle}>
                    Mood Distribution
                  </ThemedText>

                  {advancedStats.moodDistribution.length > 5 && (
                    <TouchableOpacity
                      onPress={() => router.push({ pathname: "/distribution" })}
                    >
                      <ThemedText style={styles.showAllText}>
                        Show all
                      </ThemedText>
                    </TouchableOpacity>
                  )}
                </View>
                {advancedStats.moodDistribution.slice(0, 5).map((item) => {
                  const mood = getMoodOption(item.mood)
                  return (
                    <View key={item.mood} style={styles.distributionRow}>
                      <Image
                        source={mood.image}
                        style={styles.distributionImage}
                      />
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
              <ThemedText
                style={{ ...styles.analyticsSectionTitle, marginBottom: 8 }}
              >
                Deep Insights
              </ThemedText>
              <View style={styles.analyticsGrid}>
                {advancedStats.bestDayOfWeek && (
                  <ThemedView style={styles.analyticsCard}>
                    <Image
                      source={require("@/assets/images/app_emoji/best.png")}
                      style={styles.analyticsCardEmoji}
                    />
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
                    <Image
                      source={require("@/assets/images/app_emoji/stressed.png")}
                      style={styles.analyticsCardEmoji}
                    />
                    <ThemedText style={styles.analyticsCardLabel}>
                      Hardest Day
                    </ThemedText>
                    <ThemedText style={styles.analyticsCardValue}>
                      {advancedStats.worstDayOfWeek}
                    </ThemedText>
                  </ThemedView>
                )}
                <ThemedView style={styles.analyticsCard}>
                  <Image
                    source={require("@/assets/images/app_emoji/streak.png")}
                    style={styles.analyticsCardEmoji}
                  />
                  <ThemedText style={styles.analyticsCardLabel}>
                    Best Streak
                  </ThemedText>
                  <ThemedText style={styles.analyticsCardValue}>
                    {advancedStats.longestStreak}{" "}
                    {advancedStats.longestStreak === 1 ? "day" : "days"}
                  </ThemedText>
                </ThemedView>
                <ThemedView style={styles.analyticsCard}>
                  <Image
                    source={require("@/assets/images/app_emoji/numbers.png")}
                    style={styles.analyticsCardEmoji}
                  />
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
                <ThemedText
                  style={{ ...styles.analyticsSectionTitle, marginBottom: 8 }}
                >
                  Mood Insights
                </ThemedText>
                {insights.map((insight, index) => (
                  <View key={index} style={styles.insightCard}>
                    {typeof insight.emoji === "string" ? (
                      <ThemedText style={styles.insightEmoji}>
                        {insight.emoji}
                      </ThemedText>
                    ) : (
                      <Image
                        source={insight.emoji}
                        style={styles.insightEmojiImage}
                      />
                    )}
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
            <Image
              source={require("@/assets/images/app_emoji/locked.png")}
              style={styles.statsUpgradeEmoji}
            />
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
        {entries.length > 0 && (
          <ThemedView style={styles.recentContainer}>
            <View style={styles.recentHeader}>
              <ThemedText type="subtitle" style={styles.recentTitle}>
                Recent Entries
              </ThemedText>
              <ThemedText style={styles.recentCount}>
                Total Entries: {entries.length}
              </ThemedText>
              {isPro && entries.length > 3 && (
                <TouchableOpacity
                  onPress={() => router.push({ pathname: "/entries" })}
                >
                  <ThemedText style={styles.showAllText}>Show all</ThemedText>
                </TouchableOpacity>
              )}
            </View>
            {[...entries]
              .sort(
                (a, b) =>
                  new Date(b.date).getTime() - new Date(a.date).getTime(),
              )
              .slice(0, 3)
              .map((entry) => {
                const cardContent = (
                  <View>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        width: "100%",
                      }}
                    >
                      {entry.moods && entry.moods.length > 1 ? (
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          nestedScrollEnabled={true}
                          directionalLockEnabled={true}
                          style={styles.moodScrollView}
                        >
                          <View style={styles.moodScrollContent}>
                            {entry.moods.map((mood: MoodType) => {
                              const moodOption = getMoodOption(mood)
                              return (
                                <Image
                                  key={moodOption.type}
                                  source={moodOption.image}
                                  style={styles.entryImage}
                                />
                              )
                            })}
                          </View>
                        </ScrollView>
                      ) : (
                        entry.moods &&
                        entry.moods.length > 0 && (
                          <Image
                            key={getMoodOption(entry.moods[0]).type}
                            source={getMoodOption(entry.moods[0]).image}
                            style={styles.entryImage}
                          />
                        )
                      )}
                      <ThemedText style={styles.entryDate}>
                        {new Date(entry.date).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </ThemedText>
                    </View>
                    {entry.note && (
                      <ThemedText style={styles.entryNote} numberOfLines={2}>
                        {entry.note}
                      </ThemedText>
                    )}
                  </View>
                )
                const renderDeleteAction = () => (
                  <TouchableOpacity
                    style={styles.deleteSwipeAction}
                    onPress={() => {
                      Alert.alert(
                        "Delete Entry",
                        "Are you sure you want to delete this mood entry?",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: () => deleteMood(entry.id),
                          },
                        ],
                      )
                    }}
                  >
                    <Ionicons name="trash-outline" size={24} color="white" />
                  </TouchableOpacity>
                )
                return isDevView ? (
                  <Swipeable
                    key={entry.id}
                    renderRightActions={renderDeleteAction}
                    overshootRight={false}
                  >
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => openEditMoodModal(entry)}
                    >
                      <ThemedView style={styles.entryCard}>
                        {cardContent}
                      </ThemedView>
                    </TouchableOpacity>
                  </Swipeable>
                ) : (
                  <ThemedView key={entry.id} style={styles.entryCard}>
                    {cardContent}
                  </ThemedView>
                )
              })}
          </ThemedView>
        )}

        {entries.length === 0 && (
          <ThemedView style={styles.emptyState}>
            <ThemedText style={styles.emptyText}>
              No mood entries yet for this period.
            </ThemedText>
            <ThemedText style={styles.emptySubtext}>
              Start tracking your mood to see trends!
            </ThemedText>
          </ThemedView>
        )}

        {/* Upgrade to Pro Button - only show if not pro */}
        {!isPro ? (
          <TouchableOpacity
            style={styles.upgradeButton}
            onPress={() => setUpgradeModalVisible(true)}
            activeOpacity={0.8}
          >
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
        ) : (
          <View style={styles.proBadge}>
            <ThemedText style={styles.proBadgeText}>
              You are a Pro Member
            </ThemedText>
          </View>
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
      {__DEV__ && isDevView && (
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
                {MOOD_OPTIONS.map((mood) => {
                  const selected = devSelectedMoods.includes(mood.type)
                  return (
                    <TouchableOpacity
                      key={mood.type}
                      style={[
                        styles.moodButton,
                        selected && {
                          backgroundColor: mood.color + "30",
                          borderColor: mood.color,
                          borderWidth: 3,
                        },
                      ]}
                      onPress={() =>
                        setDevSelectedMoods((prev) =>
                          prev.includes(mood.type)
                            ? prev.filter((p) => p !== mood.type)
                            : [...prev, mood.type],
                        )
                      }
                      activeOpacity={0.7}
                    >
                      <Image source={mood.image} style={styles.moodImage} />
                    </TouchableOpacity>
                  )
                })}
              </View>

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (devSelectedMoods.length === 0 || !devDate) &&
                    styles.saveButtonDisabled,
                ]}
                onPress={async () => {
                  if (devSelectedMoods.length > 0 && devDate) {
                    const success = await saveMoodForDate(
                      devSelectedMoods,
                      devDate,
                    )
                    if (success) {
                      setDevModalVisible(false)
                      setDevSelectedMoods([])
                      setDevDate("")
                      Alert.alert("Saved!", `Test entry added for ${devDate}`)
                    }
                  }
                }}
                disabled={devSelectedMoods.length === 0 || !devDate}
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
  analyticsSectionTitleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
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
    display: "flex",
    flexDirection: "row",
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
  lockedImage: {
    width: 24,
    height: 24,
    marginLeft: 4,
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
  deleteSwipeAction: {
    backgroundColor: "#F44336",
    justifyContent: "center",
    alignItems: "center",
    width: 60,
    borderRadius: 10,
    marginBottom: 8,
    marginLeft: 8,
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
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  moodButton: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    borderRadius: 12,
    borderWidth: 3,
    maxHeight: 60,
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
    lineHeight: 42,
    textAlign: "center",
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
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
    width: 24,
    height: 24,
    marginRight: 12,
    paddingTop: 4,
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
  yAxisImage: {
    width: 20,
    height: 20,
    marginVertical: 4,
  },
  moodImage: {
    width: 48,
    height: 48,
    marginBottom: 4,
    resizeMode: "contain",
    alignSelf: "center",
  },
  todayMoodMultiImage: {
    width: 24,
    height: 24,
    marginRight: 10,
  },
  todayMoodEmojiImage: {
    width: 36,
    height: 36,
    marginRight: 16,
  },
  statImage: {
    width: 48,
    height: 48,
    marginBottom: 8,
    resizeMode: "contain",
  },
  distributionImage: {
    width: 32,
    height: 32,
    marginRight: 8,
    resizeMode: "contain",
  },
  entryImage: {
    width: 32,
    height: 32,
    marginRight: 8,
    resizeMode: "contain",
  },
  // Show up to 3 emojis width for mood thumbnails
  moodScrollView: {
    width: 144,
    marginRight: 12,
  },
  moodScrollContent: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 0,
  },
  tooltipImage: {
    width: 32,
    height: 32,
    resizeMode: "contain",
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
    width: 30,
    height: 30,
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
  insightEmojiImage: {
    width: 24,
    height: 24,
    marginRight: 10,
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
  recentCount: {
    fontSize: 13,
    opacity: 0.6,
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
  entryCardHorizontal: {
    width: 220,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(150, 150, 150, 0.05)",
    marginRight: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  recentHorizontalScroll: {
    paddingVertical: 8,
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
    backgroundColor: "#0e5168",
    borderWidth: 2,
    borderColor: "#125c75",
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
    maxHeight: 275,
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
