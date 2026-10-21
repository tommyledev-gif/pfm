import { useEffect, useMemo } from "react";
import { StyleProp, StyleSheet, Text, TextStyle, View } from "react-native";
import Animated, {
  Easing,
  SharedValue,
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useReduceMotion } from "@/lib/use-reduce-motion";

// One letter's rise and fall.
const LETTER_MS = 700;
// Between neighbouring letters. Long text gets a shorter step, so one pass of
// the wave never takes longer than MAX_SWEEP_MS to cross it.
const STAGGER_MS = 50;
const MAX_SWEEP_MS = 1000;
// A quiet beat after the crest leaves the last letter, before the next pass.
const REST_MS = 450;
// At the crest: how far a letter lifts and how much it grows.
const LIFT = 2.5;
const CREST_GROWTH = 0.08;
// Reduce motion: no wave, the line breathes instead.
const BREATHE_MS = 900;
const BREATHE_LOW = 0.5;

// Text can arrive decomposed (a base letter plus combining marks, which is how
// some keyboards type Vietnamese). A mark split from its letter would wave on
// its own, so marks stay with the letter before them.
const COMBINING_MARK = /[̀-ͯ]/;

function splitLetters(text: string): string[] {
  const letters: string[] = [];
  for (const char of Array.from(text)) {
    if (COMBINING_MARK.test(char) && letters.length > 0) letters[letters.length - 1] += char;
    else letters.push(char);
  }
  return letters;
}

interface Letter {
  char: string;
  /** Position in the whole line, spaces included: the wave's timing. */
  index: number;
}

// Words, so the line can wrap between them and never inside one.
function splitWords(text: string): Letter[][] {
  const words: Letter[][] = [[]];
  splitLetters(text).forEach((char, index) => {
    if (char === " ") words.push([]);
    else words[words.length - 1].push({ char, index });
  });
  return words.filter((word) => word.length > 0);
}

interface TextShimmerWaveProps {
  text: string;
  /** Letter typography (size, weight, line height). Colour comes from the two below. */
  style?: StyleProp<TextStyle>;
  /** Resting letter colour. */
  baseColor: string;
  /** Colour at the crest of the wave. */
  highlightColor: string;
  /** Read instead of the text (letters are never read one by one). */
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * A line of text with a wave running through it, left to right and looping:
 * each letter in turn lifts a little, grows a little and brightens from
 * `baseColor` to `highlightColor`. One shared clock on the UI thread drives
 * every letter, each reading it at its own phase, so a running wave costs no
 * React renders. Reduce motion: the line stays still and fades gently in and
 * out instead.
 */
export function TextShimmerWave({ text, style, baseColor, highlightColor, accessibilityLabel, testID }: TextShimmerWaveProps) {
  const reduceMotion = useReduceMotion();
  const words = useMemo(() => splitWords(text), [text]);
  const letterCount = useMemo(() => splitLetters(text).length, [text]);
  const stagger = letterCount > 1 ? Math.min(STAGGER_MS, MAX_SWEEP_MS / (letterCount - 1)) : 0;
  const cycleMs = Math.max(letterCount - 1, 0) * stagger + LETTER_MS + REST_MS;

  // Milliseconds into the current pass; a pass ends with every letter at rest,
  // so starting the next one from 0 shows no jump.
  const clock = useSharedValue(0);
  const breath = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(clock);
      breath.value = withRepeat(
        withTiming(BREATHE_LOW, { duration: BREATHE_MS, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(breath);
      breath.value = 1;
      clock.value = 0;
      clock.value = withRepeat(withTiming(cycleMs, { duration: cycleMs, easing: Easing.linear }), -1, false);
    }
    return () => {
      cancelAnimation(clock);
      cancelAnimation(breath);
    };
  }, [reduceMotion, cycleMs, clock, breath]);

  const breathStyle = useAnimatedStyle(() => ({ opacity: breath.value }));

  return (
    <Animated.View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? text}
      style={[styles.line, breathStyle]}
    >
      {reduceMotion ? (
        <Text style={[style, { color: highlightColor }]}>{text}</Text>
      ) : (
        words.map((word, w) => (
          <View key={w} style={styles.word}>
            {word.map((letter) => (
              <WaveLetter
                key={letter.index}
                char={letter.char}
                index={letter.index}
                stagger={stagger}
                clock={clock}
                style={style}
                baseColor={baseColor}
                highlightColor={highlightColor}
              />
            ))}
            {/* Trailing, so a wrapped line never starts with a space. */}
            {w < words.length - 1 ? <Text style={style}> </Text> : null}
          </View>
        ))
      )}
    </Animated.View>
  );
}

interface WaveLetterProps {
  char: string;
  index: number;
  stagger: number;
  clock: SharedValue<number>;
  style?: StyleProp<TextStyle>;
  baseColor: string;
  highlightColor: string;
}

function WaveLetter({ char, index, stagger, clock, style, baseColor, highlightColor }: WaveLetterProps) {
  const wave = useAnimatedStyle(() => {
    const local = (clock.value - index * stagger) / LETTER_MS;
    // A raised cosine: eases out of rest and back into it, peaking halfway.
    const crest = local <= 0 || local >= 1 ? 0 : 0.5 - 0.5 * Math.cos(2 * Math.PI * local);
    return {
      color: interpolateColor(crest, [0, 1], [baseColor, highlightColor]),
      transform: [{ translateY: -LIFT * crest }, { scale: 1 + CREST_GROWTH * crest }],
    };
  });
  return <Animated.Text style={[style, wave]}>{char}</Animated.Text>;
}

const styles = StyleSheet.create({
  line: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end" },
  word: { flexDirection: "row", alignItems: "flex-end" },
});
