export type MoodType = "great" | "good" | "okay" | "bad" | "terrible"

export interface MoodEntry {
  id: string
  mood: MoodType
  date: string // ISO date string
  time?: string // HH:MM format, for multi-mood tracking
  note?: string
}

export interface MoodOption {
  type: MoodType
  emoji: string
  label: string
  color: string
  value: number // for charting (1-5)
}

export const MOOD_OPTIONS: MoodOption[] = [
  { type: "great", emoji: "😄", label: "Great", color: "#4CAF50", value: 5 },
  { type: "good", emoji: "🙂", label: "Good", color: "#8BC34A", value: 4 },
  { type: "okay", emoji: "😐", label: "Okay", color: "#FFC107", value: 3 },
  { type: "bad", emoji: "😔", label: "Bad", color: "#FF9800", value: 2 },
  {
    type: "terrible",
    emoji: "😢",
    label: "Terrible",
    color: "#F44336",
    value: 1,
  },
]

export const getMoodOption = (type: MoodType): MoodOption => {
  return MOOD_OPTIONS.find((m) => m.type === type) ?? MOOD_OPTIONS[2]
}

export const getMoodByValue = (value: number): MoodOption => {
  return MOOD_OPTIONS.find((m) => m.value === value) ?? MOOD_OPTIONS[2]
}
