import { MoodEntry, MoodType } from "@/constants/moods"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useCallback, useEffect, useState } from "react"

const MOOD_STORAGE_KEY = "@mood_entries"

export function useMoodStorage() {
  const [entries, setEntries] = useState<MoodEntry[]>([])
  const [loading, setLoading] = useState(true)

  // Load entries from storage
  const loadEntries = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(MOOD_STORAGE_KEY)
      if (stored) {
        setEntries(JSON.parse(stored))
      }
    } catch (error) {
      console.error("Error loading mood entries:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  // Save a new mood entry
  const saveMood = useCallback(
    async (mood: MoodType, note?: string) => {
      const today = new Date().toISOString().split("T")[0]
      const newEntry: MoodEntry = {
        id: `${today}-${Date.now()}`,
        mood,
        date: today,
        note,
      }

      // Remove existing entry for today if exists
      const filteredEntries = entries.filter((e) => e.date !== today)
      const updatedEntries = [...filteredEntries, newEntry]

      try {
        await AsyncStorage.setItem(
          MOOD_STORAGE_KEY,
          JSON.stringify(updatedEntries),
        )
        setEntries(updatedEntries)
        return true
      } catch (error) {
        console.error("Error saving mood:", error)
        return false
      }
    },
    [entries],
  )

  // Save a mood entry for a specific date (for testing)
  const saveMoodForDate = useCallback(
    async (mood: MoodType, date: string, note?: string) => {
      const newEntry: MoodEntry = {
        id: `${date}-${Date.now()}`,
        mood,
        date,
        note,
      }

      // Remove existing entry for that date if exists
      const filteredEntries = entries.filter((e) => e.date !== date)
      const updatedEntries = [...filteredEntries, newEntry]

      try {
        await AsyncStorage.setItem(
          MOOD_STORAGE_KEY,
          JSON.stringify(updatedEntries),
        )
        setEntries(updatedEntries)
        return true
      } catch (error) {
        console.error("Error saving mood:", error)
        return false
      }
    },
    [entries],
  )

  // Get today's mood entry
  const getTodaysMood = useCallback(() => {
    const today = new Date().toISOString().split("T")[0]
    return entries.find((e) => e.date === today)
  }, [entries])

  // Get entries for a date range
  const getEntriesInRange = useCallback(
    (startDate: Date, endDate: Date) => {
      const start = startDate.toISOString().split("T")[0]
      const end = endDate.toISOString().split("T")[0]
      return entries.filter((e) => e.date >= start && e.date <= end)
    },
    [entries],
  )

  // Get entries for the past N days
  const getEntriesForPastDays = useCallback(
    (days: number) => {
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days + 1)
      return getEntriesInRange(startDate, endDate)
    },
    [getEntriesInRange],
  )

  return {
    entries,
    loading,
    saveMood,
    saveMoodForDate,
    getTodaysMood,
    getEntriesInRange,
    getEntriesForPastDays,
    reload: loadEntries,
  }
}
