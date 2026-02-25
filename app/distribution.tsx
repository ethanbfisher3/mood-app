import { Stack } from "expo-router"
import React, { useEffect, useMemo } from "react"
import { Image, ScrollView, StyleSheet, View } from "react-native"

import { ThemedText } from "@/components/themed-text"
import { ThemedView } from "@/components/themed-view"
import { getMoodOption } from "@/constants/moods"
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
    return computeMoodDistribution(entries).sort((a, b) => b.count - a.count)
  }, [entries])

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Stack.Screen
        options={{ title: "Mood Distribution", headerBackTitle: "Back" }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.title}>
            Mood Distribution
          </ThemedText>

          {moodDistribution.length === 0 ? (
            <ThemedText style={styles.emptyText}>No entries yet.</ThemedText>
          ) : (
            moodDistribution.map((item) => {
              const mood = getMoodOption(item.mood)
              return (
                <View key={item.mood} style={styles.distributionRow}>
                  <Image source={mood.image} style={styles.distributionImage} />
                  <View style={styles.distributionBarContainer}>
                    <View
                      style={[
                        styles.distributionBar,
                        {
                          width: `${Math.max(item.percentage, 2)}%`,
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
            })
          )}
        </ThemedView>
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
  emptyText: { opacity: 0.7 },
})
