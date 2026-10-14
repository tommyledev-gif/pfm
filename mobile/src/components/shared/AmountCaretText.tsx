import { Fragment, useEffect, useState } from "react";
import { Text } from "react-native";

import { useReduceMotion } from "@/lib/use-reduce-motion";

const BLINK_MS = 530;
// A hair space (U+200A) painted with a background: a caret one or two pixels
// wide that sits in the text run itself, so it takes the amount's own font
// size, baseline and shrink-to-fit with it.
const CARET_GLYPH = "\u200A";

interface AmountCaretTextProps {
  text: string;
  /** Text index the caret is drawn before (text.length = at the end). */
  caret: number;
  caretColor: string;
  /** A tap on the character at this index; the caller puts the caret after it. */
  onPressChar: (index: number) => void;
}

/**
 * The typed amount as one tappable span per character, with a blinking caret
 * between them. Rendered INSIDE the amount's own Text, so the run still
 * shrinks to fit as a whole. Tapping a digit puts the caret right after it:
 * ⌫ then removes that digit, and a key types after it.
 */
export function AmountCaretText({ text, caret, caretColor, onPressChar }: AmountCaretTextProps) {
  const reduceMotion = useReduceMotion();
  const [lit, setLit] = useState(true);

  // Solid again after every edit or move, then blinking; steady with reduce motion.
  useEffect(() => {
    setLit(true);
    if (reduceMotion) return;
    const id = setInterval(() => setLit((on) => !on), BLINK_MS);
    return () => clearInterval(id);
  }, [text, caret, reduceMotion]);

  const mark = <Text style={{ backgroundColor: lit ? caretColor : "transparent" }}>{CARET_GLYPH}</Text>;
  const chars = Array.from(text);

  return (
    <>
      {chars.map((char, index) => (
        <Fragment key={index}>
          {index === caret ? mark : null}
          <Text onPress={() => onPressChar(index)} suppressHighlighting>
            {char}
          </Text>
        </Fragment>
      ))}
      {caret >= chars.length ? mark : null}
    </>
  );
}
