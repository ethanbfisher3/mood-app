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
import { useProSubscription } from "@/hooks/use-pro-subscription"
import { useThemeColor } from "@/hooks/use-theme-color"
import {
  createMoodReminderContent,
  setupNotificationCategories,
} from "@/services/notification-service"

export default function NotificationsScreen({
  isDevView,
}: {
  isDevView?: boolean
}) {
  const {
    settings,
    extraReminders: reminders,
    loading,
    hasPermission,
    toggleNotifications,
    updateTime,
    requestPermissions,
    addExtraReminder,
    removeExtraReminder,
    toggleExtraReminder,
    updateExtraReminderTime,
    reload,
  } = useNotificationSettings()

  const { isPro } = useProSubscription()

  const [editingReminderId, setEditingReminderId] = useState<string | null>(
    null,
  )
  const [pendingNewTime, setPendingNewTime] = useState<Date>(new Date())
  const [pendingEditTime, setPendingEditTime] = useState<Date>(new Date())
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
    if (selectedDate) {
      setPendingEditTime(selectedDate)
    }
    if (Platform.OS !== "ios" && event.type === "dismissed") {
      setEditingReminderId(null)
    }
  }

  const handleConfirmMainTime = async () => {
    setIsSaving(true)
    await updateTime(pendingEditTime.getHours(), pendingEditTime.getMinutes())
    setIsSaving(false)
    setEditingReminderId(null)
  }

  const handleExtraTimeChange = async (event: any, selectedDate?: Date) => {
    if (selectedDate) {
      setPendingNewTime(selectedDate)
    }
    if (Platform.OS !== "ios" && event.type === "dismissed") {
      setEditingReminderId(null)
    }
  }

  const handleConfirmNewReminder = async () => {
    setIsSaving(true)
    await addExtraReminder(
      pendingNewTime.getHours(),
      pendingNewTime.getMinutes(),
    )
    setIsSaving(false)
    setEditingReminderId(null)
    setPendingNewTime(new Date())
  }

  const handleCancelNewReminder = () => {
    setEditingReminderId(null)
    setPendingNewTime(new Date())
  }

  const handleUpdateExtraTime = async (
    id: string,
    event: any,
    selectedDate?: Date,
  ) => {
    if (selectedDate) {
      setPendingEditTime(selectedDate)
    }
    if (Platform.OS !== "ios" && event.type === "dismissed") {
      setEditingReminderId(null)
    }
  }

  const handleConfirmExtraTime = async (id: string) => {
    setIsSaving(true)
    await updateExtraReminderTime(
      id,
      pendingEditTime.getHours(),
      pendingEditTime.getMinutes(),
    )
    setIsSaving(false)
    setEditingReminderId(null)
  }

  const handleCancelEdit = () => {
    setEditingReminderId(null)
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

        {/* Reminder Times - unified section */}
        <ThemedView
          style={[
            styles.settingCard,
            !settings.enabled && styles.settingCardDisabled,
          ]}
        >
          {/* Section Title */}
          <ThemedText
            style={[
              styles.reminderLabel,
              !settings.enabled && styles.textDisabled,
              { marginBottom: 8 },
            ]}
          >
            Reminder Time(s)
          </ThemedText>

          {/* Main Reminder Time - in list style */}
          <View>
            {editingReminderId === "main" && (
              <View>
                <DateTimePicker
                  value={pendingEditTime}
                  mode="time"
                  is24Hour={false}
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={handleTimeChange}
                />
                <View style={styles.confirmCancelRow}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={handleCancelEdit}
                  >
                    <ThemedText style={styles.cancelButtonText}>
                      Cancel
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={handleConfirmMainTime}
                    disabled={isSaving}
                  >
                    <ThemedText style={styles.confirmButtonText}>
                      Confirm
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Extra Reminders */}
          {(isPro || reminders.length <= 1) &&
            settings.enabled &&
            reminders.map((reminder) => (
              <View key={reminder.id}>
                <View style={styles.reminderRow}>
                  <View style={styles.reminderRowLeft}>
                    <Switch
                      value={reminder.enabled}
                      onValueChange={() => {
                        toggleExtraReminder(reminder.id)
                      }}
                      trackColor={{ false: "#767577", true: "#4CAF50" }}
                      thumbColor="#fff"
                    />
                    <TouchableOpacity
                      onPress={() => {
                        if (editingReminderId === reminder.id) {
                          setEditingReminderId(null)
                        } else {
                          const d = new Date()
                          d.setHours(reminder.hour, reminder.minute, 0, 0)
                          setPendingEditTime(d)
                          setEditingReminderId(reminder.id)
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <ThemedText
                        style={[
                          styles.timeDisplay,
                          { marginLeft: 12 },
                          !reminder.enabled && styles.textDisabled,
                        ]}
                      >
                        {formatTime(reminder.hour, reminder.minute)}
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    onPress={() => removeExtraReminder(reminder.id)}
                    style={styles.removeReminderButton}
                  >
                    <ThemedText style={styles.removeReminderText}>✕</ThemedText>
                  </TouchableOpacity>
                </View>

                {editingReminderId === reminder.id && (
                  <View>
                    <DateTimePicker
                      value={pendingEditTime}
                      mode="time"
                      is24Hour={false}
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      onChange={(event, date) =>
                        handleUpdateExtraTime(reminder.id, event, date)
                      }
                    />
                    <View style={styles.confirmCancelRow}>
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={handleCancelEdit}
                      >
                        <ThemedText style={styles.cancelButtonText}>
                          Cancel
                        </ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.confirmButton}
                        onPress={() => handleConfirmExtraTime(reminder.id)}
                        disabled={isSaving}
                      >
                        <ThemedText style={styles.confirmButtonText}>
                          Confirm
                        </ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            ))}

          {/* Add Reminder Button */}
          {(isPro || reminders.length == 0) &&
            settings.enabled &&
            reminders.length < 3 &&
            editingReminderId !== "new" && (
              <TouchableOpacity
                style={styles.addReminderButton}
                onPress={() =>
                  setEditingReminderId((prev) =>
                    prev === "new" ? null : "new",
                  )
                }
                disabled={isSaving}
              >
                <ThemedText style={styles.addReminderText}>
                  + Add Reminder
                </ThemedText>
              </TouchableOpacity>
            )}

          {editingReminderId === "new" && (
            <View>
              <DateTimePicker
                value={pendingNewTime}
                mode="time"
                is24Hour={false}
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={handleExtraTimeChange}
              />
              <View style={styles.confirmCancelRow}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancelNewReminder}
                >
                  <ThemedText style={styles.cancelButtonText}>
                    Cancel
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={handleConfirmNewReminder}
                  disabled={isSaving}
                >
                  <ThemedText style={styles.confirmButtonText}>
                    Confirm
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ThemedView>

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

          {__DEV__ && isDevView && (
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
          )}
        </ThemedView>

        {/* Tips */}
        <ThemedView style={styles.tipsSection}>
          <ThemedText type="subtitle" style={styles.tipsTitle}>
            💡 Tips
          </ThemedText>
          <ThemedText style={styles.tipText}>
            • Choose a time when you're usually winding down, like nighttime
          </ThemedText>
          <ThemedText style={styles.tipText}>
            • Swipe down to expand the notification and see mood options
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
  reminderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(150, 150, 150, 0.1)",
  },
  reminderRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  reminderLabel: {
    fontSize: 16,
    fontWeight: "600",
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
  removeReminderButton: {
    padding: 8,
  },
  removeReminderText: {
    fontSize: 16,
    opacity: 0.5,
  },
  addReminderButton: {
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4CAF50",
    borderStyle: "dashed",
  },
  addReminderText: {
    color: "#4CAF50",
    fontWeight: "600",
    fontSize: 14,
  },
  confirmCancelRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  confirmButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  confirmButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
  cancelButton: {
    backgroundColor: "rgba(150, 150, 150, 0.15)",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  cancelButtonText: {
    fontWeight: "600",
    fontSize: 14,
    opacity: 0.7,
  },
})
