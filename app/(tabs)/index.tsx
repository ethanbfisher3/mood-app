import { useFocusEffect } from "expo-router"
import React, { useCallback, useState } from "react"
import {
  Alert,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { ThemedText } from "@/components/themed-text"
import { ThemedView } from "@/components/themed-view"
import { MOOD_OPTIONS, MoodType, getMoodOption } from "@/constants/moods"
import { useMoodStorage } from "@/hooks/use-mood-storage"
import { useThemeColor } from "@/hooks/use-theme-color"

export default function MoodScreen() {
  const { saveMood, getTodaysMood, reload } = useMoodStorage()
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null)
  const [note, setNote] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const backgroundColor = useThemeColor({}, "background")
  const textColor = useThemeColor({}, "text")

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      reload()
    }, [reload]),
  )

  // Check if mood was already logged today
  useFocusEffect(
    useCallback(() => {
      const todaysMood = getTodaysMood()
      if (todaysMood) {
        setSelectedMood(todaysMood.mood)
        setNote(todaysMood.note || "")
      } else {
        setSelectedMood(null)
        setNote("")
      }
    }, [getTodaysMood]),
  )

  const handleSave = async () => {
    if (!selectedMood) {
      Alert.alert("Select a Mood", "Please select how you're feeling today.")
      return
    }

    setIsSaving(true)
    const success = await saveMood(selectedMood, note.trim() || undefined)
    setIsSaving(false)

    if (success) {
      Alert.alert("Saved!", "Your mood has been logged for today. 🎉")
    } else {
      Alert.alert("Error", "Failed to save your mood. Please try again.")
    }
  }

  const todaysMood = getTodaysMood()
  const todayFormatted = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.header}>
          <ThemedText type="title">How are you feeling?</ThemedText>
          <ThemedText style={styles.date}>{todayFormatted}</ThemedText>
        </ThemedView>

        {todaysMood && (
          <ThemedView style={styles.existingMoodBanner}>
            <ThemedText style={styles.bannerText}>
              You logged feeling {getMoodOption(todaysMood.mood).emoji}{" "}
              {getMoodOption(todaysMood.mood).label.toLowerCase()} today
            </ThemedText>
            <ThemedText style={styles.bannerSubtext}>
              Tap a mood below to update it
            </ThemedText>
          </ThemedView>
        )}

        <ThemedView style={styles.moodContainer}>
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
              <ThemedText style={styles.moodLabel}>{mood.label}</ThemedText>
            </TouchableOpacity>
          ))}
        </ThemedView>

        <ThemedView style={styles.noteSection}>
          <ThemedText type="subtitle" style={styles.noteLabel}>
            Add a note (optional)
          </ThemedText>
          <TextInput
            style={[
              styles.noteInput,
              { color: textColor, borderColor: textColor + "30" },
            ]}
            placeholder="What's on your mind today?"
            placeholderTextColor={textColor + "60"}
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </ThemedView>

        <TouchableOpacity
          style={[
            styles.saveButton,
            (!selectedMood || isSaving) && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={!selectedMood || isSaving}
          activeOpacity={0.8}
        >
          <ThemedText style={styles.saveButtonText}>
            {isSaving ? "Saving..." : todaysMood ? "Update Mood" : "Save Mood"}
          </ThemedText>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  date: {
    marginTop: 8,
    opacity: 0.7,
  },
  existingMoodBanner: {
    backgroundColor: "#4CAF5020",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: "center",
  },
  bannerText: {
    fontSize: 16,
    fontWeight: "600",
  },
  bannerSubtext: {
    marginTop: 4,
    opacity: 0.7,
    fontSize: 14,
  },
  moodContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
    marginBottom: 30,
  },
  moodButton: {
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "transparent",
    width: "28%",
    minWidth: 90,
    overflow: "visible",
  },
  moodEmoji: {
    fontSize: 40,
    marginBottom: 8,
    lineHeight: 50,
    textAlign: "center",
  },
  moodLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  noteSection: {
    marginBottom: 30,
  },
  noteLabel: {
    marginBottom: 12,
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    minHeight: 100,
    fontSize: 16,
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
})
