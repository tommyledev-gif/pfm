import { useEffect, useRef } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  FadeIn,
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
// One small overshoot (~5%), then still: the segments trade width, and a
// longer wobble made the row breathe. ⚠️ The mass is not optional: on
// Reanimated 4's default (4) this rang for seconds (see motion-tokens' SPRING
// note).
const RESIZE = LinearTransition.springify().damping(22).stiffness(260).mass(1);
// The label fades in once its segment is nearly open, never while the
// opening edge is still crossing it.
const LABEL_IN = { delay: 160, duration: 160 };
// ⚠️ The name is one unbreakable run with a no-break space of slack at its
// end, drawn with clip rather than "…". Some Android fonts draw bold text a
// few px wider than it measured, and the name ended in "…" at rest
// ("Giao d…") however wide the bar was; the slack is what gets cut instead.
const NBSP = " ";
const unbreakable = (label: string) => `${label.replace(/ /g, NBSP)}${NBSP}`;
// The bar has room for the longest short name up to this text size; past it
// the label would push the search and menu buttons off the bar.
const LABEL_MAX_FONT_SCALE = 1.3;

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

  // ⚠️ Worked out here, on the JS thread: withAlpha is not a worklet, and
  // calling it inside useAnimatedStyle (the UI thread) killed the app as soon
  // as the preloaded Trợ lý tab mounted. The worklet only reads the strings.
  const tint = meta.tint;
  const washOff = withAlpha(tint, 0);
  const washOn = withAlpha(tint, TINT_ALPHA);
  const wash = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(lit.value, [0, 1], [washOff, washOn]),
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
        {/* Gone at once when the mode changes: the segment no longer clips,
            so a fading name would spill over the next icon as it closed. */}
        {active ? (
          <Animated.Text
            entering={animate ? FadeIn.duration(LABEL_IN.duration).delay(LABEL_IN.delay) : undefined}
            style={styles.label}
            numberOfLines={1}
            ellipsizeMode="clip"
            textBreakStrategy="simple"
            maxFontSizeMultiplier={LABEL_MAX_FONT_SCALE}
          >
            {unbreakable(meta.shortLabel)}
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
    // The mode in use always shows its whole name: the bar's buttons are
    // fixed-size, so the switch never has to give way to them.
    flexShrink: 0,
    padding: 3,
    gap: 2,
    borderRadius: radii.pill,
    backgroundColor: withAlpha(colors.overlayBase, 0.06),
  },
  // ⚠️ No overflow: hidden. The wash is rounded by borderRadius alone, and a
  // segment springing open or shut must never cut its own name off.
  segment: { height: SEGMENT_HEIGHT, borderRadius: SEGMENT_HEIGHT / 2 },
  press: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: SEGMENT_HEIGHT,
    minWidth: SEGMENT_HEIGHT,
    paddingHorizontal: (SEGMENT_HEIGHT - ICON_SIZE) / 2,
  },
  // The trailing no-break space stands in for most of the right padding.
  label: { ...typography.label, fontWeight: "700", color: colors.textPrimary, paddingRight: 1, flexShrink: 0 },
}));
