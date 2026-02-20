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

  // Save a new mood entry (replaces existing for free, appends for Pro)
  const saveMood = useCallback(
    async (mood: MoodType, note?: string, appendMultiple?: boolean) => {
      const today = new Date().toISOString().split("T")[0]
      const now = new Date()
      const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
      const newEntry: MoodEntry = {
        id: `${today}-${Date.now()}`,
        mood,
        date: today,
        time,
        note,
      }

      let updatedEntries: MoodEntry[]
      if (appendMultiple) {
        // Pro: append new entry, keep existing ones for today
        updatedEntries = [...entries, newEntry]
      } else {
        // Free: replace existing entry for today
        const filteredEntries = entries.filter((e) => e.date !== today)
        updatedEntries = [...filteredEntries, newEntry]
      }

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

  // Get today's mood entry (latest one)
  const getTodaysMood = useCallback(() => {
    const today = new Date().toISOString().split("T")[0]
    const todaysEntries = entries.filter((e) => e.date === today)
    if (todaysEntries.length === 0) return undefined
    // Return the latest entry for today
    return todaysEntries[todaysEntries.length - 1]
  }, [entries])

  // Get all of today's mood entries (for Pro multi-mood)
  const getTodaysMoods = useCallback(() => {
    const today = new Date().toISOString().split("T")[0]
    return entries
      .filter((e) => e.date === today)
      .sort((a, b) => {
        if (a.time && b.time) return a.time.localeCompare(b.time)
        return 0
      })
  }, [entries])

  // Delete a mood entry by ID
  const deleteMood = useCallback(
    async (id: string) => {
      const updatedEntries = entries.filter((e) => e.id !== id)
      try {
        await AsyncStorage.setItem(
          MOOD_STORAGE_KEY,
          JSON.stringify(updatedEntries),
        )
        setEntries(updatedEntries)
        return true
      } catch (error) {
        console.error("Error deleting mood:", error)
        return false
      }
    },
    [entries],
  )

  // Update an existing mood entry by ID
  const updateMood = useCallback(
    async (id: string, mood: MoodType, note?: string) => {
      const updatedEntries = entries.map((e) =>
        e.id === id ? { ...e, mood, note } : e,
      )
      try {
        await AsyncStorage.setItem(
          MOOD_STORAGE_KEY,
          JSON.stringify(updatedEntries),
        )
        setEntries(updatedEntries)
        return true
      } catch (error) {
        console.error("Error updating mood:", error)
        return false
      }
    },
    [entries],
  )

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
    deleteMood,
    updateMood,
    getTodaysMood,
    getTodaysMoods,
    getEntriesInRange,
    getEntriesForPastDays,
    reload: loadEntries,
  }
}
