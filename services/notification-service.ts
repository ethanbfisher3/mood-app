import { MOOD_OPTIONS, MoodType } from "@/constants/moods"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as Notifications from "expo-notifications"

const MOOD_STORAGE_KEY = "@mood_entries"
const MOOD_CATEGORY_ID = "mood_reminder"

/**
 * Set up notification categories with mood action buttons.
 * This enables expandable notifications where users can set their mood directly.
 */
export async function setupNotificationCategories(): Promise<void> {
  // Create action buttons for each mood option
  const moodActions: Notifications.NotificationAction[] = MOOD_OPTIONS.map(
    (mood) => ({
      identifier: `mood_${mood.type}`,
      buttonTitle: `${mood.emoji} ${mood.label}`,
      options: {
        opensAppToForeground: false, // Keep app in background after selection
      },
    }),
  )

  // Set up the notification category with all mood actions
  await Notifications.setNotificationCategoryAsync(
    MOOD_CATEGORY_ID,
    moodActions,
    {
      customDismissAction: false,
      allowInCarPlay: false,
      showTitle: true,
      showSubtitle: true,
      allowAnnouncement: false,
    },
  )
}

/**
 * Get the category ID for mood reminder notifications
 */
export function getMoodCategoryId(): string {
  return MOOD_CATEGORY_ID
}

/**
 * Save mood entry directly (used when responding to notifications in background)
 */
export async function saveMoodFromNotification(
  moodType: MoodType,
): Promise<boolean> {
  try {
    const today = new Date().toISOString().split("T")[0]
    const newEntry = {
      id: `${today}-${Date.now()}`,
      mood: moodType,
      date: today,
    }

    // Load existing entries
    const stored = await AsyncStorage.getItem(MOOD_STORAGE_KEY)
    const entries = stored ? JSON.parse(stored) : []

    // Remove existing entry for today if exists
    const filteredEntries = entries.filter(
      (e: { date: string }) => e.date !== today,
    )
    const updatedEntries = [...filteredEntries, newEntry]

    // Save updated entries
    await AsyncStorage.setItem(MOOD_STORAGE_KEY, JSON.stringify(updatedEntries))
    return true
  } catch (error) {
    console.error("Error saving mood from notification:", error)
    return false
  }
}

/**
 * Handle notification response (when user interacts with notification actions)
 */
export function handleNotificationResponse(
  response: Notifications.NotificationResponse,
): { handled: boolean; moodType?: MoodType } {
  const actionIdentifier = response.actionIdentifier

  // Check if this is a mood action
  if (actionIdentifier.startsWith("mood_")) {
    const moodType = actionIdentifier.replace("mood_", "") as MoodType

    // Validate it's a valid mood type
    const validMood = MOOD_OPTIONS.find((m) => m.type === moodType)
    if (validMood) {
      // Save the mood asynchronously
      saveMoodFromNotification(moodType).then((success) => {
        if (success) {
          // Schedule a confirmation notification
          Notifications.scheduleNotificationAsync({
            content: {
              title: `${validMood.emoji} Mood logged!`,
              body: `You're feeling ${validMood.label.toLowerCase()} today. Keep tracking!`,
              sound: false,
            },
            trigger: null, // Immediate notification
          })
        }
      })

      return { handled: true, moodType }
    }
  }

  return { handled: false }
}

/**
 * Create notification content for mood reminder with category
 */
export function createMoodReminderContent(): Notifications.NotificationContentInput {
  return {
    title: "How are you feeling today? 🌟",
    body: "Tap to open the app, or expand to quickly log your mood.",
    sound: true,
    categoryIdentifier: MOOD_CATEGORY_ID,
  }
}
