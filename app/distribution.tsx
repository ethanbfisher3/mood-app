import { Stack } from "expo-router"
import { useEffect, useMemo } from "react"
import { Image, ScrollView, StyleSheet, View } from "react-native"

import { ThemedText } from "@/components/themed-text"
import { ThemedView } from "@/components/themed-view"
import { TutorialTarget } from "@/components/tutorial/tutorial-target"
import { getMoodOption, MOOD_OPTIONS } from "@/constants/moods"
import { useMoodStorage } from "@/hooks/use-mood-storage"
import { useThemeColor } from "@/hooks/use-theme-color"
import { computeMoodDistribution } from "@/lib/mood-distribution"

export default function DistributionScreen() {
  const { entries, reload } = useMoodStorage()
  const backgroundColor = useThemeColor({}, "background")
  const textColor = useThemeColor({}, "text")

  useEffect(() => {
    reload()
  }, [reload])

  const moodDistribution = useMemo(() => {
    const computed = computeMoodDistribution(entries)
    const byMood = new Map(computed.map((item) => [item.mood, item]))

    return MOOD_OPTIONS.map((mood) => {
      const existing = byMood.get(mood.type)
      return {
        mood: mood.type,
        count: existing?.count ?? 0,
        percentage: existing?.percentage ?? 0,
      }
    }).sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count
      }
      return MOOD_OPTIONS.findIndex((m) => m.type === a.mood) - MOOD_OPTIONS.findIndex((m) => m.type === b.mood)
    })
  }, [entries])

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Stack.Screen
        options={{ title: "Mood Distribution", headerBackTitle: "Back" }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TutorialTarget id="mood-distribution">
          <ThemedView style={styles.section}>
            <ThemedText type="subtitle" style={styles.title}>
              Mood Distribution
            </ThemedText>

              {moodDistribution.map((item) => {
                const mood = getMoodOption(item.mood)
                return (
                  <View key={item.mood} style={styles.distributionRow}>
                    <Image source={mood.image} style={styles.distributionImage} />
                    <View style={styles.distributionBarContainer}>
                      <View
                        style={[
                          styles.distributionBar,
                          {
                            width: `${item.percentage}%`,
                            backgroundColor: mood.color,
                          },
                        ]}
                      />
                    </View>
                    <ThemedText style={styles.distributionPercent}>
                      {Math.round(item.percentage)}%
                    </ThemedText>
                  </View>
                )
              })}
          </ThemedView>
        </TutorialTarget>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20 },
  section: { marginBottom: 24 },
  title: { marginBottom: 12 },
  distributionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  distributionImage: {
    width: 32,
    height: 32,
    marginRight: 8,
    resizeMode: "contain",
  },
  distributionBarContainer: {
    flex: 1,
    height: 12,
    backgroundColor: "rgba(150, 150, 150, 0.1)",
    borderRadius: 6,
    overflow: "hidden",
    marginLeft: 8,
  },
  distributionBar: { height: "100%", borderRadius: 6 },
  distributionPercent: {
    fontSize: 13,
    fontWeight: "600",
    width: 56,
    textAlign: "right",
  },
})
