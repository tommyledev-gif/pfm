import { Fragment, memo } from "react";
import { Text } from "react-native";

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
 * The typed amount as one tappable span per character, with a caret between
 * them. Rendered INSIDE the amount's own Text, so the run still shrinks to fit
 * as a whole. Tapping a digit puts the caret right after it: ⌫ then removes
 * that digit, and a key types after it.
 *
 * ⚠️ The caret is steady, not blinking (2026-10-14). A blink re-rendered this
 * Text every half second, and a shrink-to-fit Text re-measures on each render:
 * the whole sheet re-laid out twice a second, keys lagged and the pickers
 * above could not be scrolled.
 */
export const AmountCaretText = memo(function AmountCaretText({ text, caret, caretColor, onPressChar }: AmountCaretTextProps) {
  const mark = <Text style={{ backgroundColor: caretColor }}>{CARET_GLYPH}</Text>;
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
});
