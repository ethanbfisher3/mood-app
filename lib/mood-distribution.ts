import { MOOD_OPTIONS, MoodEntry, MoodType } from "@/constants/moods"

export function computeMoodDistribution(entries: MoodEntry[]) {
  const moodCounts: Record<string, number> = {}
  entries.forEach((e) => {
    // support legacy `mood` and new `moods`
    const moods: MoodType[] =
      (e as any).moods ?? ((e as any).mood ? [(e as any).mood] : [])
    moods.forEach((m) => {
      moodCounts[m] = (moodCounts[m] || 0) + 1
    })
  })

  const list = MOOD_OPTIONS.map((m) => ({
    mood: m.type,
    count: moodCounts[m.type] || 0,
    percentage: ((moodCounts[m.type] || 0) / entries.length) * 100,
  })).filter((d) => d.count > 0)
  return list
}
