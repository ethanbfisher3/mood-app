import DateTimePicker from "@react-native-community/datetimepicker"
import * as Notifications from "expo-notifications"
import React, { useEffect, useState } from "react"
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from "react-native"

import { ThemedText } from "@/components/themed-text"
import { ThemedView } from "@/components/themed-view"
import { useNotificationSettings } from "@/hooks/use-notification-settings"
import { useThemeColor } from "@/hooks/use-theme-color"
import {
  createMoodReminderContent,
  setupNotificationCategories,
} from "@/services/notification-service"

export default function NotificationsScreen() {
  const {
    settings,
    loading,
    hasPermission,
    toggleNotifications,
    updateTime,
    requestPermissions,
    reload,
  } = useNotificationSettings()

  const [showTimePicker, setShowTimePicker] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const backgroundColor = useThemeColor({}, "background")
  const textColor = useThemeColor({}, "text")

  // Reload settings when component mounts
  useEffect(() => {
    reload()
  }, [reload])

  const handleToggle = async (value: boolean) => {
    if (value && !hasPermission) {
      const granted = await requestPermissions()
      if (!granted) {
        Alert.alert(
          "Permission Required",
          "Please enable notifications in your device settings to receive mood reminders.",
          [{ text: "OK" }],
        )
        return
      }
    }

    setIsSaving(true)
    await toggleNotifications(value)
    setIsSaving(false)
  }

  const handleTimeChange = async (event: any, selectedDate?: Date) => {
    setShowTimePicker(Platform.OS === "ios")

    if (selectedDate) {
      setIsSaving(true)
      await updateTime(selectedDate.getHours(), selectedDate.getMinutes())
      setIsSaving(false)
    }
  }

  const formatTime = (hour: number, minute: number) => {
    const period = hour >= 12 ? "PM" : "AM"
    const displayHour = hour % 12 || 12
    const displayMinute = minute.toString().padStart(2, "0")
    return `${displayHour}:${displayMinute} ${period}`
  }

  const selectedTime = new Date()
  selectedTime.setHours(settings.hour, settings.minute, 0, 0)

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <ThemedView style={styles.loadingContainer}>
          <ThemedText>Loading...</ThemedText>
        </ThemedView>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.header}>
          <ThemedText type="title">Notifications</ThemedText>
          <ThemedText style={styles.subtitle}>
            Set up daily reminders to track your mood
          </ThemedText>
        </ThemedView>

        {/* Main Toggle */}
        <ThemedView style={styles.settingCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <ThemedText style={styles.settingTitle}>
                Daily Reminder
              </ThemedText>
              <ThemedText style={styles.settingDescription}>
                Get notified to log your mood every day
              </ThemedText>
            </View>
            <Switch
              value={settings.enabled}
              onValueChange={handleToggle}
              disabled={isSaving}
              trackColor={{ false: "#767577", true: "#4CAF50" }}
              thumbColor="#fff"
            />
          </View>
        </ThemedView>

        {/* Time Picker */}
        <ThemedView
          style={[
            styles.settingCard,
            !settings.enabled && styles.settingCardDisabled,
          ]}
        >
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() =>
              settings.enabled && setShowTimePicker(!showTimePicker)
            }
            disabled={!settings.enabled || isSaving}
            activeOpacity={0.7}
          >
            <View style={styles.settingInfo}>
              <ThemedText
                style={[
                  styles.settingTitle,
                  !settings.enabled && styles.textDisabled,
                ]}
              >
                Reminder Time
              </ThemedText>
              <ThemedText
                style={[
                  styles.settingDescription,
                  !settings.enabled && styles.textDisabled,
                ]}
              >
                Choose when you want to be reminded
              </ThemedText>
            </View>
            <ThemedText
              style={[
                styles.timeDisplay,
                !settings.enabled && styles.textDisabled,
              ]}
            >
              {formatTime(settings.hour, settings.minute)}
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>

        {showTimePicker && (
          <DateTimePicker
            value={selectedTime}
            mode="time"
            is24Hour={false}
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleTimeChange}
          />
        )}

        {/* Info Section */}
        <ThemedView style={styles.infoSection}>
          <ThemedText type="subtitle" style={styles.infoTitle}>
            How it works
          </ThemedText>

          <View style={styles.infoItem}>
            <ThemedText style={styles.infoEmoji}>🔔</ThemedText>
            <ThemedText style={styles.infoText}>
              You'll receive a notification at your chosen time each day
            </ThemedText>
          </View>

          <View style={styles.infoItem}>
            <ThemedText style={styles.infoEmoji}>⬇️</ThemedText>
            <ThemedText style={styles.infoText}>
              Expand the notification to quickly log your mood without opening
              the app
            </ThemedText>
          </View>

          <View style={styles.infoItem}>
            <ThemedText style={styles.infoEmoji}>📝</ThemedText>
            <ThemedText style={styles.infoText}>
              Or tap the notification to open the app and add notes
            </ThemedText>
          </View>

          <View style={styles.infoItem}>
            <ThemedText style={styles.infoEmoji}>📊</ThemedText>
            <ThemedText style={styles.infoText}>
              Consistent tracking helps you understand your emotional patterns
            </ThemedText>
          </View>
        </ThemedView>

        {/* Permission Status */}
        <ThemedView style={styles.statusSection}>
          <ThemedText type="subtitle" style={styles.statusTitle}>
            Status
          </ThemedText>

          <View style={styles.statusRow}>
            <ThemedText style={styles.statusLabel}>
              Notifications Permission
            </ThemedText>
            <ThemedText
              style={[
                styles.statusValue,
                { color: hasPermission ? "#4CAF50" : "#FF9800" },
              ]}
            >
              {hasPermission ? "✓ Granted" : "⚠ Not Granted"}
            </ThemedText>
          </View>

          <View style={styles.statusRow}>
            <ThemedText style={styles.statusLabel}>Daily Reminder</ThemedText>
            <ThemedText
              style={[
                styles.statusValue,
                { color: settings.enabled ? "#4CAF50" : "#687076" },
              ]}
            >
              {settings.enabled ? "✓ Active" : "○ Inactive"}
            </ThemedText>
          </View>

          {!hasPermission && (
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={requestPermissions}
            >
              <ThemedText style={styles.permissionButtonText}>
                Grant Permission
              </ThemedText>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.permissionButton, styles.testButton]}
            onPress={async () => {
              if (!hasPermission) {
                const granted = await requestPermissions()
                if (!granted) {
                  Alert.alert(
                    "Permission Required",
                    "Please grant notification permissions to test.",
                  )
                  return
                }
              }
              await setupNotificationCategories()
              await Notifications.scheduleNotificationAsync({
                content: createMoodReminderContent(),
                trigger: null, // Send immediately
              })
            }}
          >
            <ThemedText style={styles.permissionButtonText}>
              🧪 Test Expandable Notification
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>

        {/* Tips */}
        <ThemedView style={styles.tipsSection}>
          <ThemedText type="subtitle" style={styles.tipsTitle}>
            💡 Tips
          </ThemedText>
          <ThemedText style={styles.tipText}>
            • Choose a time when you're usually winding down, like evening
          </ThemedText>
          <ThemedText style={styles.tipText}>
            • Swipe down on iOS or pull down on Android to expand the
            notification and see mood options
          </ThemedText>
          <ThemedText style={styles.tipText}>
            • Reflecting on your day helps with emotional awareness
          </ThemedText>
          <ThemedText style={styles.tipText}>
            • Even a quick mood check without notes is valuable
          </ThemedText>
        </ThemedView>
      </ScrollView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  subtitle: {
    marginTop: 8,
    opacity: 0.7,
    textAlign: "center",
  },
  settingCard: {
    backgroundColor: "rgba(150, 150, 150, 0.05)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  settingCardDisabled: {
    opacity: 0.5,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    opacity: 0.7,
  },
  textDisabled: {
    opacity: 0.5,
  },
  timeDisplay: {
    fontSize: 18,
    fontWeight: "600",
    color: "#4CAF50",
  },
  infoSection: {
    marginTop: 24,
    marginBottom: 24,
  },
  infoTitle: {
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  infoEmoji: {
    fontSize: 24,
    marginRight: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    opacity: 0.8,
  },
  statusSection: {
    backgroundColor: "rgba(150, 150, 150, 0.05)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  statusTitle: {
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  statusLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  permissionButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 12,
  },
  testButton: {
    backgroundColor: "#2196F3",
  },
  permissionButtonText: {
    color: "white",
    fontWeight: "600",
  },
  tipsSection: {
    marginBottom: 24,
  },
  tipsTitle: {
    marginBottom: 12,
  },
  tipText: {
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 8,
    lineHeight: 20,
  },
})
