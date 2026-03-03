import { getMoodOption, MoodEntry, MoodType } from "@/constants/moods"
import { Image, ScrollView, StyleSheet, View, ViewStyle } from "react-native"
import { ThemedText } from "./themed-text"
import { ThemedView } from "./themed-view"

interface EntryCardProps {
  entry: MoodEntry
  style?: ViewStyle
  showMoodLabel?: boolean
  isHorizontal?: boolean
}

export function EntryCard({
  entry,
  style,
  showMoodLabel = false,
  isHorizontal = false,
}: EntryCardProps) {
  const moods = entry.moods ?? []

  return (
    <ThemedView
      style={[
        styles.entryCard,
        isHorizontal ? styles.horizontalLayout : null,
        style,
      ]}
    >
      <View style={styles.entryRow}>
        {moods.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled={true}
            directionalLockEnabled={true}
            style={styles.moodScrollView}
          >
            <View style={styles.moodScrollContent}>
              {moods.map((mood: MoodType) => {
                const moodOption = getMoodOption(mood)
                return (
                  <Image
                    key={moodOption.type}
                    source={moodOption.image}
                    style={styles.entryImage}
                  />
                )
              })}
            </View>
          </ScrollView>
        ) : moods.length > 0 ? (
          <Image
            source={getMoodOption(moods[0]).image}
            style={styles.entryImage}
          />
        ) : null}

        <View style={styles.entryInfo}>
          <ThemedText
            style={[styles.entryDate, styles.entryDateSingleMood]}
            // numberOfLines={1}
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
}

const styles = StyleSheet.create({
  entryCard: {
    flexDirection: "column",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "rgba(150, 150, 150, 0.05)",
    marginBottom: 8,
  },
  horizontalLayout: {
    width: 220,
    padding: 12,
    marginBottom: 0,
    marginRight: 12,
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  entryImage: {
    width: 32,
    height: 32,
    marginRight: 8,
    resizeMode: "contain",
  },
  moodScrollView: {
    width: 144,
    marginRight: 12,
  },
  moodScrollContent: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 0,
  },
  entryInfo: {},
  entryMood: {
    fontWeight: "600",
    fontSize: 16,
  },
  entryDate: {
    opacity: 0.7,
    fontSize: 14,
  },
  entryDateSingleMood: {
    marginLeft: "auto",
    textAlign: "right",
  },
  entryNote: {
    marginTop: 4,
    opacity: 0.8,
    fontSize: 14,
  },
})
