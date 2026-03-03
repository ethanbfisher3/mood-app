import { useMoodStorage } from "@/hooks/use-mood-storage"
import { useThemeColor } from "@/hooks/use-theme-color"
import { Stack } from "expo-router"
import { useEffect } from "react"
import { ScrollView, StyleSheet, View } from "react-native"

import { EntryCard } from "@/components/entry-card"
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
            {sortedEntries.map((entry) => (
              <EntryCard key={entry.id} entry={entry} showMoodLabel={true} />
            ))}
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
  emptyState: {
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
})
