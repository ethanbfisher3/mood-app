import { getMoodOption } from "@/constants/moods"
import { useMoodStorage } from "@/hooks/use-mood-storage"
import { useThemeColor } from "@/hooks/use-theme-color"
import { Stack } from "expo-router"
import React, { useEffect } from "react"
import { ScrollView, StyleSheet, View } from "react-native"

import { ThemedText } from "@/components/themed-text"
import { ThemedView } from "@/components/themed-view"

export default function EntriesScreen() {
  const { entries, reload } = useMoodStorage()
  const backgroundColor = useThemeColor({}, "background")

  // Load data on mount
  useEffect(() => {
    reload()
  }, [reload])

  const sortedEntries = [...entries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Stack.Screen
        options={{
          title: "All Entries",
          headerShown: true,
          headerBackTitle: "Back",
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {sortedEntries.length > 0 ? (
          <ThemedView style={styles.recentContainer}>
            {sortedEntries.map((entry) => {
              const mood = getMoodOption(entry.mood)
              return (
                <ThemedView key={entry.id} style={styles.entryCard}>
                  <ThemedText style={styles.entryEmoji}>
                    {mood.emoji}
                  </ThemedText>
                  <View style={styles.entryInfo}>
                    <ThemedText style={styles.entryMood}>
                      {mood.label}
                    </ThemedText>
                    <ThemedText style={styles.entryDate}>
                      {new Date(entry.date).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </ThemedText>
                    {entry.note && (
                      <ThemedText style={styles.entryNote} numberOfLines={0}>
                        {entry.note}
                      </ThemedText>
                    )}
                  </View>
                </ThemedView>
              )
            })}
          </ThemedView>
        ) : (
          <ThemedView style={styles.emptyState}>
            <ThemedText style={styles.emptyText}>
              No mood entries yet.
            </ThemedText>
          </ThemedView>
        )}
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
  recentContainer: {
    marginBottom: 24,
  },
  entryCard: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "rgba(150, 150, 150, 0.05)",
    marginBottom: 12,
    overflow: "visible",
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
})
