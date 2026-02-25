import { ImageSourcePropType } from "react-native"

export type MoodType =
  | "great"
  | "good"
  | "okay"
  | "bad"
  | "terrible"
  | "annoyed"
  | "anxious"
  | "crying"
  | "disappointed"
  | "embarrassed"
  | "happy_and_sad"
  | "surprised"
  | "tired"
  | "worried"
  | "sick"

export interface MoodEntry {
  id: string
  // Single legacy mood (kept for backward compatibility)
  mood?: MoodType
  // New: allow multiple moods per entry
  moods?: MoodType[]
  date: string // ISO date string
  time?: string // HH:MM format, for multi-mood tracking
  note?: string
}

export interface MoodOption {
  type: MoodType
  label: string
  color: string
  value: number
  image: ImageSourcePropType
}

export const MOOD_OPTIONS: MoodOption[] = [
  {
    type: "great",
    label: "Great",
    color: "#4CAF50",
    value: 5,
    image: require("@/assets/images/emojis/happy.png"),
  },
  {
    type: "good",
    label: "Good",
    color: "#8BC34A",
    value: 4,
    image: require("@/assets/images/emojis/good.png"),
  },
  {
    type: "okay",
    label: "Okay",
    color: "#FFC107",
    value: 3,
    image: require("@/assets/images/emojis/okay.png"),
  },
  {
    type: "bad",
    label: "Bad",
    color: "#FF9800",
    value: 2,
    image: require("@/assets/images/emojis/sad.png"),
  },
  {
    type: "terrible",
    label: "Terrible",
    color: "#F44336",
    value: 1,
    image: require("@/assets/images/emojis/unhappy.png"),
  },
  {
    type: "annoyed",
    label: "Annoyed",
    color: "#9E9E9E",
    value: 2,
    image: require("@/assets/images/emojis/annoyed.png"),
  },
  {
    type: "anxious",
    label: "Anxious",
    color: "#9E9E9E",
    value: 2,
    image: require("@/assets/images/emojis/anxious.png"),
  },
  {
    type: "crying",
    label: "Crying",
    color: "#F44336",
    value: 1,
    image: require("@/assets/images/emojis/crying.png"),
  },
  {
    type: "disappointed",
    label: "Disappointed",
    color: "#FF9800",
    value: 2,
    image: require("@/assets/images/emojis/disappointed.png"),
  },
  {
    type: "embarrassed",
    label: "Embarrassed",
    color: "#9E9E9E",
    value: 2,
    image: require("@/assets/images/emojis/embarrassed.png"),
  },
  {
    type: "happy_and_sad",
    label: "Mixed",
    color: "#FFC107",
    value: 3,
    image: require("@/assets/images/emojis/happy_and_sad.png"),
  },
  {
    type: "surprised",
    label: "Surprised",
    color: "#FFC107",
    value: 3,
    image: require("@/assets/images/emojis/surprised.png"),
  },
  {
    type: "tired",
    label: "Tired",
    color: "#9E9E9E",
    value: 2,
    image: require("@/assets/images/emojis/tired.png"),
  },
  {
    type: "worried",
    label: "Worried",
    color: "#9E9E9E",
    value: 2,
    image: require("@/assets/images/emojis/worried.png"),
  },
  {
    type: "sick",
    label: "Sick",
    color: "#9E9E9E",
    value: 2,
    image: require("@/assets/images/emojis/sick.png"),
  },
]

export const getMoodOption = (type: MoodType): MoodOption => {
  return MOOD_OPTIONS.find((m) => m.type === type) ?? MOOD_OPTIONS[2]
}

export const getMoodByValue = (value: number): MoodOption => {
  return MOOD_OPTIONS.find((m) => m.value === value) ?? MOOD_OPTIONS[2]
}
