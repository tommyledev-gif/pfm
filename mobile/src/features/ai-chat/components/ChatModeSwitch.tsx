import { useEffect, useRef } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { useHintTooltip } from "@/components/shared/use-hint-tooltip";
import { CHAT_MODE_META, CHAT_MODE_ORDER, ChatMode } from "@/features/ai-chat/chat-mode";
import { withAlpha } from "@/lib/color";
import { radii, typography, createStyles, useColors } from "@/lib/theme";
import { useReduceMotion } from "@/lib/use-reduce-motion";

const SEGMENT_HEIGHT = 36;
const ICON_SIZE = 18;
const TINT_ALPHA = 0.24;
const COLOUR_MS = 220;
// Critically damped enough not to wobble: the segments trade width, and an
// overshoot would make the row breathe.
const RESIZE = LinearTransition.springify().damping(22).stiffness(260);

interface ChatModeSwitchProps {
  mode: ChatMode;
  onSelect: (mode: ChatMode) => void;
}

/**
 * The chat's modes as one segmented capsule in the app bar, each mode its own
 * icon: the one in use opens out to its short name on a wash of its colour,
 * the others stay icons, and the switch slides from one to the next. Every
 * mode is one tap away and in view, where the title-with-a-chevron it
 * replaces hid them behind a sheet of labels and descriptions to read. A
 * hold on an icon names its mode (TooltipHost).
 */
export function ChatModeSwitch({ mode, onSelect }: ChatModeSwitchProps) {
  const styles = useStyles();
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {CHAT_MODE_ORDER.map((option) => (
        <ModeSegment key={option} mode={option} active={option === mode} onPress={() => onSelect(option)} />
      ))}
    </View>
  );
}

function ModeSegment({ mode, active, onPress }: { mode: ChatMode; active: boolean; onPress: () => void }) {
  useTranslation(); // the labels are getters on CHAT_MODE_META: re-render on a language switch
  const styles = useStyles();
  const colors = useColors();
  const reduceMotion = useReduceMotion();
  const meta = CHAT_MODE_META[mode];
  const hint = useHintTooltip(meta.label);
  const lit = useSharedValue(active ? 1 : 0);
  // The label only fades on a switch, never on the screen's first frame.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);

  useEffect(() => {
    lit.value = reduceMotion ? (active ? 1 : 0) : withTiming(active ? 1 : 0, { duration: COLOUR_MS });
  }, [active, reduceMotion, lit]);

  const tint = meta.tint;
  const wash = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(lit.value, [0, 1], [withAlpha(tint, 0), withAlpha(tint, TINT_ALPHA)]),
  }));
  const Icon = meta.icon;
  const animate = mounted.current && !reduceMotion;

  return (
    <Animated.View layout={animate ? RESIZE : undefined} style={[styles.segment, wash]}>
      <Pressable
        onPress={onPress}
        {...(active ? null : hint)}
        hitSlop={4}
        style={styles.press}
        accessibilityRole="tab"
        accessibilityLabel={meta.label}
        accessibilityState={{ selected: active }}
        testID={`btn-chat-mode-${mode}`}
      >
        <Icon
          size={ICON_SIZE}
          color={active ? tint : colors.textSecondary}
          toColor={active ? meta.iconToColor : undefined}
        />
        {active ? (
          <Animated.Text
            entering={animate ? FadeIn.duration(180).delay(80) : undefined}
            exiting={FadeOut.duration(90)}
            style={styles.label}
            numberOfLines={1}
          >
            {meta.shortLabel}
          </Animated.Text>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const useStyles = createStyles((colors) => ({
  // A soft fill, no outline: a control, not another card.
  track: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    padding: 3,
    gap: 2,
    borderRadius: radii.pill,
    backgroundColor: withAlpha(colors.overlayBase, 0.06),
  },
  segment: { height: SEGMENT_HEIGHT, borderRadius: SEGMENT_HEIGHT / 2, overflow: "hidden" },
  press: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: SEGMENT_HEIGHT,
    minWidth: SEGMENT_HEIGHT,
    paddingHorizontal: (SEGMENT_HEIGHT - ICON_SIZE) / 2,
  },
  label: { ...typography.label, fontWeight: "700", color: colors.textPrimary, paddingRight: 4 },
}));
