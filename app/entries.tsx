import { getMoodOption } from "@/constants/moods"
import { useMoodStorage } from "@/hooks/use-mood-storage"
import { useThemeColor } from "@/hooks/use-theme-color"
import { Stack } from "expo-router"
import React, { useEffect } from "react"
import { Image, ScrollView, StyleSheet, View } from "react-native"

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
            {sortedEntries.length > 1 ? (
              <ScrollView
                nestedScrollEnabled={true}
                directionalLockEnabled={true}
                contentContainerStyle={styles.recentHorizontalScroll}
              >
                {sortedEntries.map((entry) => {
                  const moods =
                    (entry as any).moods ??
                    ((entry as any).mood ? [(entry as any).mood] : [])
                  return (
                    <ThemedView
                      key={entry.id}
                      style={styles.entryCardHorizontal}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          width: "100%",
                        }}
                      >
                        {moods.length > 1 ? (
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            nestedScrollEnabled={true}
                            directionalLockEnabled={true}
                            style={styles.moodScrollView}
                          >
                            {moods.map((m: any) => (
                              <Image
                                key={m}
                                source={getMoodOption(m).image}
                                style={styles.entryEmoji}
                                resizeMode="contain"
                              />
                            ))}
                          </ScrollView>
                        ) : (
                          <Image
                            source={
                              getMoodOption(moods[0] ?? ("okay" as any)).image
                            }
                            style={styles.entryEmoji}
                            resizeMode="contain"
                          />
                        )}

                        <View style={styles.entryInfo}>
                          <ThemedText
                            style={styles.entryDate}
                            numberOfLines={1}
                          >
                            {new Date(entry.date).toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                          </ThemedText>
                        </View>
                      </View>

                      {entry.note && (
                        <ThemedText style={styles.entryNote} numberOfLines={2}>
                          {entry.note}
                        </ThemedText>
                      )}
                    </ThemedView>
                  )
                })}
              </ScrollView>
            ) : (
              <ThemedView style={styles.recentContainer}>
                {sortedEntries.map((entry) => {
                  const moods =
                    (entry as any).moods ??
                    ((entry as any).mood ? [(entry as any).mood] : [])
                  const mood = getMoodOption(moods[0] ?? ("okay" as any))
                  return (
                    <ThemedView key={entry.id} style={styles.entryCard}>
                      <View
                        style={{ flexDirection: "row", alignItems: "center" }}
                      >
                        <Image
                          source={mood.image}
                          style={styles.entryEmoji}
                          resizeMode="contain"
                        />
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
                        </View>
                      </View>
                      {entry.note && (
                        <ThemedText style={styles.entryNote}>
                          {entry.note}
                        </ThemedText>
                      )}
                    </ThemedView>
                  )
                })}
              </ThemedView>
            )}
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
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "rgba(150, 150, 150, 0.05)",
    marginBottom: 12,
  },
  entryCardHorizontal: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(150, 150, 150, 0.05)",
    marginRight: 12,
    flexDirection: "column",
    alignItems: "flex-start",
  },
  recentHorizontalScroll: {
    paddingVertical: 8,
    display: "flex",
    gap: 12,
  },
  entryEmoji: {
    width: 36,
    height: 36,
    marginRight: 8,
    lineHeight: 42,
    textAlign: "center",
  },
  // Show up to 3 emojis width for mood thumbnails in All Entries
  moodScrollView: {
    width: 128,
    marginRight: 12,
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
