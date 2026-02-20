import {
  createMoodReminderContent,
  setupNotificationCategories,
} from "@/services/notification-service"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as Notifications from "expo-notifications"
import { useCallback, useEffect, useState } from "react"

const NOTIFICATION_SETTINGS_KEY = "@notification_settings"
const EXTRA_REMINDERS_KEY = "@extra_reminder_settings"

export interface NotificationSettings {
  enabled: boolean
  hour: number
  minute: number
}

export interface ExtraReminder {
  id: string
  hour: number
  minute: number
  enabled: boolean
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: false,
  hour: 20, // 8 PM
  minute: 0,
}

export function useNotificationSettings() {
  const [settings, setSettings] =
    useState<NotificationSettings>(DEFAULT_SETTINGS)
  const [extraReminders, setExtraReminders] = useState<ExtraReminder[]>([])
  const [loading, setLoading] = useState(true)
  const [hasPermission, setHasPermission] = useState(false)

  // Load settings from storage
  const loadSettings = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY)
      if (stored) {
        setSettings(JSON.parse(stored))
      }
      const extraStored = await AsyncStorage.getItem(EXTRA_REMINDERS_KEY)
      if (extraStored) {
        setExtraReminders(JSON.parse(extraStored))
      }
    } catch (error) {
      console.error("Error loading notification settings:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Check notification permissions
  const checkPermissions = useCallback(async () => {
    const { status } = await Notifications.getPermissionsAsync()
    setHasPermission(status === "granted")
    return status === "granted"
  }, [])

  // Request notification permissions
  const requestPermissions = useCallback(async () => {
    const { status } = await Notifications.requestPermissionsAsync()
    setHasPermission(status === "granted")
    return status === "granted"
  }, [])

  useEffect(() => {
    loadSettings()
    checkPermissions()
    // Set up notification categories for expandable mood actions
    setupNotificationCategories()
  }, [loadSettings, checkPermissions])

  // Schedule daily notification with mood action buttons
  const scheduleNotification = useCallback(
    async (hour: number, minute: number) => {
      // Cancel existing notifications first
      await Notifications.cancelAllScheduledNotificationsAsync()

      // Ensure categories are set up
      await setupNotificationCategories()

      // Schedule main notification
      await Notifications.scheduleNotificationAsync({
        content: createMoodReminderContent(),
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        },
      })

      // Schedule extra reminders
      const storedExtras = await AsyncStorage.getItem(EXTRA_REMINDERS_KEY)
      if (storedExtras) {
        const extras: ExtraReminder[] = JSON.parse(storedExtras)
        for (const extra of extras) {
          if (extra.enabled) {
            await Notifications.scheduleNotificationAsync({
              content: createMoodReminderContent(),
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DAILY,
                hour: extra.hour,
                minute: extra.minute,
              },
            })
          }
        }
      }
    },
    [],
  )

  // Save settings and update notification schedule
  const saveSettings = useCallback(
    async (newSettings: NotificationSettings) => {
      try {
        await AsyncStorage.setItem(
          NOTIFICATION_SETTINGS_KEY,
          JSON.stringify(newSettings),
        )
        setSettings(newSettings)

        if (newSettings.enabled) {
          const permitted = await requestPermissions()
          if (permitted) {
            await scheduleNotification(newSettings.hour, newSettings.minute)
          }
        } else {
          await Notifications.cancelAllScheduledNotificationsAsync()
        }

        return true
      } catch (error) {
        console.error("Error saving notification settings:", error)
        return false
      }
    },
    [requestPermissions, scheduleNotification],
  )

  // Toggle notifications on/off
  const toggleNotifications = useCallback(
    async (enabled: boolean) => {
      return saveSettings({ ...settings, enabled })
    },
    [settings, saveSettings],
  )

  // Update notification time
  const updateTime = useCallback(
    async (hour: number, minute: number) => {
      return saveSettings({ ...settings, hour, minute })
    },
    [settings, saveSettings],
  )

  // Add an extra reminder (Pro feature)
  const addExtraReminder = useCallback(
    async (hour: number, minute: number) => {
      const newReminder: ExtraReminder = {
        id: `extra-${Date.now()}`,
        hour,
        minute,
        enabled: true,
      }
      const updated = [...extraReminders, newReminder]
      try {
        await AsyncStorage.setItem(EXTRA_REMINDERS_KEY, JSON.stringify(updated))
        setExtraReminders(updated)
        if (settings.enabled) {
          await scheduleNotification(settings.hour, settings.minute)
        }
        return true
      } catch (error) {
        console.error("Error adding extra reminder:", error)
        return false
      }
    },
    [extraReminders, settings, scheduleNotification],
  )

  // Remove an extra reminder
  const removeExtraReminder = useCallback(
    async (id: string) => {
      const updated = extraReminders.filter((r) => r.id !== id)
      try {
        await AsyncStorage.setItem(EXTRA_REMINDERS_KEY, JSON.stringify(updated))
        setExtraReminders(updated)
        if (settings.enabled) {
          await scheduleNotification(settings.hour, settings.minute)
        }
        return true
      } catch (error) {
        console.error("Error removing extra reminder:", error)
        return false
      }
    },
    [extraReminders, settings, scheduleNotification],
  )

  // Toggle an extra reminder
  const toggleExtraReminder = useCallback(
    async (id: string) => {
      const updated = extraReminders.map((r) =>
        r.id === id ? { ...r, enabled: !r.enabled } : r,
      )
      try {
        await AsyncStorage.setItem(EXTRA_REMINDERS_KEY, JSON.stringify(updated))
        setExtraReminders(updated)
        if (settings.enabled) {
          await scheduleNotification(settings.hour, settings.minute)
        }
        return true
      } catch (error) {
        console.error("Error toggling extra reminder:", error)
        return false
      }
    },
    [extraReminders, settings, scheduleNotification],
  )

  // Update an extra reminder's time
  const updateExtraReminderTime = useCallback(
    async (id: string, hour: number, minute: number) => {
      const updated = extraReminders.map((r) =>
        r.id === id ? { ...r, hour, minute } : r,
      )
      try {
        await AsyncStorage.setItem(EXTRA_REMINDERS_KEY, JSON.stringify(updated))
        setExtraReminders(updated)
        if (settings.enabled) {
          await scheduleNotification(settings.hour, settings.minute)
        }
        return true
      } catch (error) {
        console.error("Error updating extra reminder time:", error)
        return false
      }
    },
    [extraReminders, settings, scheduleNotification],
  )

  return {
    settings,
    extraReminders,
    loading,
    hasPermission,
    saveSettings,
    toggleNotifications,
    updateTime,
    requestPermissions,
    addExtraReminder,
    removeExtraReminder,
    toggleExtraReminder,
    updateExtraReminderTime,
    reload: loadSettings,
  }
}
