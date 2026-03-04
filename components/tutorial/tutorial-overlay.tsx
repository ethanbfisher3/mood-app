import { ThemedText } from "@/components/themed-text"
import { ThemedView } from "@/components/themed-view"
import { useOnboardingTutorial } from "@/hooks/use-onboarding-tutorial"
import { useProSubscription } from "@/hooks/use-pro-subscription"
import { useThemeColor } from "@/hooks/use-theme-color"
import { useEffect, useRef, useState } from "react"
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native"

const SPOTLIGHT_PADDING_X = 10
const SPOTLIGHT_PADDING_Y = 6

export function TutorialOverlay() {
  const {
    isActive,
    currentStep,
    currentStepIndex,
    steps,
    measureTarget,
    skipTutorial,
    nextStep,
    onUpgradePress,
  } = useOnboardingTutorial()

  const { isPro } = useProSubscription()

  const [targetRect, setTargetRect] = useState<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)

  const overlayColor = useThemeColor({}, "text") + "99"
  const cardBackground = useThemeColor({}, "background")
  const textColor = useThemeColor({}, "text")

  const fadeAnim = useRef(new Animated.Value(0)).current
  const riseAnim = useRef(new Animated.Value(14)).current
  const pulseAnim = useRef(new Animated.Value(0)).current

  const isModalStep = currentStep?.kind === "modal"
  const isLastStep = currentStepIndex === steps.length - 1

  useEffect(() => {
    if (!isActive || !currentStep) {
      return
    }

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(riseAnim, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start()

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 650,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 650,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ]),
    )
    pulse.start()

    return () => {
      pulse.stop()
      fadeAnim.setValue(0)
      riseAnim.setValue(14)
      pulseAnim.setValue(0)
    }
  }, [currentStep, isActive, fadeAnim, riseAnim, pulseAnim])

  useEffect(() => {
    if (
      !isActive ||
      !currentStep?.targetId ||
      currentStep.kind !== "spotlight"
    ) {
      setTargetRect(null)
      return
    }

    let isMounted = true

    const refreshTarget = async () => {
      const rect = await measureTarget(currentStep.targetId!)
      if (!isMounted) return
      setTargetRect(rect)
    }

    refreshTarget()
    const delayedRefresh = setTimeout(refreshTarget, 280)
    const interval = setInterval(refreshTarget, 700)

    return () => {
      isMounted = false
      clearTimeout(delayedRefresh)
      clearInterval(interval)
    }
  }, [isActive, currentStep, measureTarget])

  if (!isActive || !currentStep) {
    return null
  }

  const cardPlacement =
    currentStep.cardPlacement ?? (isModalStep ? "center" : "bottom")

  const { width, height } = Dimensions.get("window")
  const statusBarHeight = StatusBar.currentHeight || 0

  const baseOffset =
    Platform.OS === "android" && currentStep?.androidYOffset !== undefined
      ? currentStep.androidYOffset
      : (currentStep?.iosYOffset ?? 0)

  const stepYOffset = baseOffset + statusBarHeight

  const spotlight =
    currentStep.kind === "spotlight" && targetRect
      ? {
          x: Math.max(0, targetRect.x - SPOTLIGHT_PADDING_X),
          y: Math.max(0, targetRect.y + stepYOffset - SPOTLIGHT_PADDING_Y),
          width: Math.min(width, targetRect.width + SPOTLIGHT_PADDING_X * 2),
          height: Math.min(height, targetRect.height + SPOTLIGHT_PADDING_Y * 2),
        }
      : null

  const ringOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 0.95],
  })

  // Calculate effective step count: if user is pro in onboarding, skip the pro-modal step
  const isOnboardingFlow = currentStep?.id?.startsWith("step-") ?? false
  const effectiveStepsCount =
    isPro && isOnboardingFlow ? steps.length - 1 : steps.length
  const progressLabel = `${currentStepIndex + 1} / ${effectiveStepsCount}`
  const isProAndAddNotification =
    isPro && currentStep?.id === "step-add-notification"
  const primaryButtonLabel = isProAndAddNotification
    ? "Finish"
    : (currentStep.primaryLabel ?? (isLastStep ? "Finish" : "Next"))
  const hasDescription = currentStep.description.trim().length > 0

  const handlePrimaryPress = async () => {
    if (currentStep.id === "step-pro-modal") {
      onUpgradePress()
    }
    await nextStep()
  }

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.container, { opacity: fadeAnim }]}
      accessible
      accessibilityViewIsModal
      accessibilityLabel="Onboarding tutorial"
    >
      {!isModalStep && (
        <Pressable
          onPress={() => {}}
          style={StyleSheet.absoluteFill}
          accessibilityRole="none"
        >
          {spotlight ? (
            <>
              <View
                style={[
                  styles.mask,
                  {
                    top: 0,
                    left: 0,
                    right: 0,
                    height: spotlight.y,
                    backgroundColor: overlayColor,
                  },
                ]}
              />
              <View
                style={[
                  styles.mask,
                  {
                    top: spotlight.y,
                    left: 0,
                    width: spotlight.x,
                    height: spotlight.height,
                    backgroundColor: overlayColor,
                  },
                ]}
              />
              <View
                style={[
                  styles.mask,
                  {
                    top: spotlight.y,
                    left: spotlight.x + spotlight.width,
                    right: 0,
                    height: spotlight.height,
                    backgroundColor: overlayColor,
                  },
                ]}
              />
              <View
                style={[
                  styles.mask,
                  {
                    top: spotlight.y + spotlight.height,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: overlayColor,
                  },
                ]}
              />

              <Animated.View
                pointerEvents="none"
                style={[
                  styles.spotlightRing,
                  {
                    left: spotlight.x,
                    top: spotlight.y,
                    width: spotlight.width,
                    height: spotlight.height,
                    opacity: ringOpacity,
                    borderColor: textColor,
                  },
                ]}
              />
            </>
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: overlayColor },
              ]}
            />
          )}
        </Pressable>
      )}

      {isModalStep && (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor }]}
        />
      )}

      <Animated.View
        style={[
          cardPlacement === "top"
            ? styles.topCardContainer
            : cardPlacement === "center"
              ? styles.centerCardContainer
              : styles.cardContainer,
          { transform: [{ translateY: riseAnim }] },
        ]}
      >
        <ThemedView style={[styles.card, { backgroundColor: cardBackground }]}>
          <View style={styles.progressRow}>
            <ThemedText style={styles.progressText}>{progressLabel}</ThemedText>
            <TouchableOpacity
              onPress={skipTutorial}
              accessibilityRole="button"
              accessibilityLabel="Skip tutorial"
            >
              <ThemedText style={styles.skipText}>Skip</ThemedText>
            </TouchableOpacity>
          </View>

          <ThemedText type="subtitle" style={styles.titleText}>
            {currentStep.title}
          </ThemedText>
          {hasDescription && (
            <ThemedText style={styles.descriptionText}>
              {currentStep.description}
            </ThemedText>
          )}

          <TouchableOpacity
            onPress={handlePrimaryPress}
            style={styles.primaryButton}
            accessibilityRole="button"
            accessibilityLabel={primaryButtonLabel}
          >
            <ThemedText style={styles.primaryButtonText}>
              {primaryButtonLabel}
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1200,
  },
  mask: {
    position: "absolute",
  },
  spotlightRing: {
    position: "absolute",
    borderWidth: 2,
    borderRadius: 14,
  },
  cardContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 28,
  },
  topCardContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 28,
  },
  centerCardContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(128,128,128,0.4)",
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressText: {
    fontSize: 12,
    opacity: 0.7,
    fontWeight: "600",
  },
  skipText: {
    fontSize: 14,
    fontWeight: "600",
    opacity: 0.8,
  },
  titleText: {
    marginTop: 10,
    marginBottom: 6,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.9,
  },
  primaryButton: {
    marginTop: 14,
    backgroundColor: "#4CAF50",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 14,
  },
})
