import AsyncStorage from "@react-native-async-storage/async-storage"
import { useCallback, useEffect, useState } from "react"

const PRO_STORAGE_KEY = "@mood_tracker_pro_status"

export interface ProFeature {
  id: string
  emoji: string
  title: string
  description: string
}

export const PRO_FEATURES: ProFeature[] = [
  {
    id: "unlimited-history",
    emoji: "📊",
    title: "Unlimited History",
    description: "Access your complete mood history with full year view",
  },
  {
    id: "view-all-entries",
    emoji: "📖",
    title: "View All Entries",
    description: "Browse and search through all your mood entries in detail",
  },
  {
    id: "advanced-analytics",
    emoji: "🧠",
    title: "Advanced Analytics",
    description: "Discover mood patterns, trends, and emotional correlations",
  },
  {
    id: "custom-reminders",
    emoji: "⏰",
    title: "Multiple Reminders",
    description: "Set multiple reminder times throughout the day",
  },
  {
    id: "mood-insights",
    emoji: "✨",
    title: "AI Mood Insights",
    description:
      "Get personalized insights and recommendations based on your patterns",
  },
  {
    id: "multi-mood",
    emoji: "🎭",
    title: "Multiple Daily Moods",
    description:
      "Log your mood throughout the day to capture how it changes over time",
  },
]

// Module-level shared state so all hook instances stay in sync
let proListeners = new Set<(isPro: boolean) => void>()
let sharedProStatus: boolean | null = null

function notifyProListeners(newStatus: boolean) {
  sharedProStatus = newStatus
  proListeners.forEach((l) => l(newStatus))
}

export function useProSubscription() {
  const [isPro, setIsPro] = useState(sharedProStatus ?? false)
  const [isLoading, setIsLoading] = useState(sharedProStatus === null)

  // Subscribe to shared state changes
  useEffect(() => {
    const listener = (newStatus: boolean) => setIsPro(newStatus)
    proListeners.add(listener)
    // If another instance already loaded, use its value
    if (sharedProStatus !== null && sharedProStatus !== isPro) {
      setIsPro(sharedProStatus)
    }
    return () => {
      proListeners.delete(listener)
    }
  }, [])

  // Load pro status from storage (only once globally)
  useEffect(() => {
    if (sharedProStatus !== null) {
      setIsLoading(false)
      return
    }
    const loadProStatus = async () => {
      try {
        const stored = await AsyncStorage.getItem(PRO_STORAGE_KEY)
        if (stored !== null) {
          notifyProListeners(JSON.parse(stored))
        } else {
          sharedProStatus = false
        }
      } catch (error) {
        console.error("Failed to load pro status:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadProStatus()
  }, [])

  // Toggle pro status (for development purposes)
  const togglePro = useCallback(async () => {
    try {
      const newStatus = !isPro
      await AsyncStorage.setItem(PRO_STORAGE_KEY, JSON.stringify(newStatus))
      notifyProListeners(newStatus)
      return true
    } catch (error) {
      console.error("Failed to toggle pro status:", error)
      return false
    }
  }, [isPro])

  // Set pro status directly
  const setProStatus = useCallback(async (status: boolean) => {
    try {
      await AsyncStorage.setItem(PRO_STORAGE_KEY, JSON.stringify(status))
      notifyProListeners(status)
      return true
    } catch (error) {
      console.error("Failed to set pro status:", error)
      return false
    }
  }, [])

  return {
    isPro,
    isLoading,
    togglePro,
    setProStatus,
    features: PRO_FEATURES,
  }
}
