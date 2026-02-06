import AsyncStorage from "@react-native-async-storage/async-storage"
import * as Notifications from "expo-notifications"
import { useCallback, useEffect, useState } from "react"

const NOTIFICATION_SETTINGS_KEY = "@notification_settings"

export interface NotificationSettings {
  enabled: boolean
  hour: number
  minute: number
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: false,
  hour: 20, // 8 PM
  minute: 0,
}

export function useNotificationSettings() {
  const [settings, setSettings] =
    useState<NotificationSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [hasPermission, setHasPermission] = useState(false)

  // Load settings from storage
  const loadSettings = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY)
      if (stored) {
        setSettings(JSON.parse(stored))
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
  }, [loadSettings, checkPermissions])

  // Schedule daily notification
  const scheduleNotification = useCallback(
    async (hour: number, minute: number) => {
      // Cancel existing notifications first
      await Notifications.cancelAllScheduledNotificationsAsync()

      // Schedule new notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "How are you feeling today? 🌟",
          body: "Take a moment to log your mood and track your emotional well-being.",
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        },
      })
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

  return {
    settings,
    loading,
    hasPermission,
    saveSettings,
    toggleNotifications,
    updateTime,
    requestPermissions,
    reload: loadSettings,
  }
}
