import { Animated, StyleSheet, View } from "react-native";

import { withAlpha } from "@/lib/color";
import { colors, createStyles } from "@/lib/theme";
import { useEntryAnimation } from "@/lib/use-entry-animation";

interface BudgetProgressBarProps {
  // spent / limit. Values above 1 are expected — see OVER BUDGET below.
  ratio: number;
  // 0..1 share of the period elapsed, drawn as a vertical tick. Omitted on the
  // rows where a pace comparison is meaningless.
  pace?: number;
  color: string;
  height?: number;
}

// Width of the dark seam drawn where two coloured sections of the bar meet.
// Without it the two sections bleed into one ramp and the boundary — the one
// thing this bar exists to show — has to be inferred from a colour change.
const SEAM_WIDTH = 2;

// A budget bar, which the plain ProgressBar can't express: it shows how much
// is spent, where the period's pace marker sits (so "80% used" reads
// differently on the 5th than on the 25th), and how far past the limit an
// overspend went.
//
// OVER BUDGET: ⚠️ the bar is always FULL once spent passes the limit. It used
// to draw the in-budget part as a normal fill and only hatch the overspend
// tail, so at 385% three-quarters of the bar was a pale diagonal pattern and
// the solid part looked like "a quarter used" — the eye read the opposite of
// the number printed under it. Now the track is entirely filled: the first
// 1/ratio of it is the limit itself (soft coral), everything after the seam
// is the overspend (solid red). Scale is relative to what was spent, so the
// red share IS the overspent share. No pattern — solid colour carries it.
export function BudgetProgressBar({ ratio, pace, color, height = 8 }: BudgetProgressBarProps) {
  const styles = useStyles();
  const over = ratio > 1;
  const fill = Math.max(0, Math.min(1, ratio));
  // Where the limit falls along a full, overspent bar.
  const limitMark = over ? 1 / ratio : 1;
  const radius = height / 2;
  // First render: everything that represents spend grows in from the left
  // edge together; the pace tick is a fact about the calendar and stays put.
  const grow = useEntryAnimation();

  // Pace is a share of the BUDGET, so once the bar's scale becomes "total
  // spent" the tick has to shrink into the budget's own section with it.
  const paceMark = pace === undefined ? undefined : Math.max(0, Math.min(1, pace)) * limitMark;

  return (
    <View style={[styles.track, { height, borderRadius: radius }]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.spend, { borderRadius: radius, transform: [{ scaleX: grow }] }]}
      >
        {over ? (
          // The budget's own share drawn soft, the overspend after it solid —
          // so the loud part is the part that's wrong.
          <>
            <View
              style={[styles.segment, { left: 0, width: `${limitMark * 100}%`, backgroundColor: withAlpha(colors.peach, 0.45) }]}
            />
            <View
              style={[styles.segment, { left: `${limitMark * 100}%`, right: 0, backgroundColor: colors.danger }]}
            />
            <View
              pointerEvents="none"
              style={[styles.seam, { left: `${limitMark * 100}%`, marginLeft: -SEAM_WIDTH / 2 }]}
            />
          </>
        ) : (
          <>
            <View
              style={[
                styles.segment,
                { left: 0, width: `${fill * 100}%`, backgroundColor: color, borderRadius: radius },
              ]}
            />
            {/* The spent | remaining seam. Only while the bar is partly full —
                at 0% or 100% a floating dark tick reads as a defect. */}
            {fill > 0 && fill < 1 ? (
              <View pointerEvents="none" style={[styles.seam, { left: `${fill * 100}%`, marginLeft: -SEAM_WIDTH }]} />
            ) : null}
          </>
        )}
      </Animated.View>

      {paceMark !== undefined ? (
        <View pointerEvents="none" style={[styles.pace, { left: `${paceMark * 100}%`, height: height + 6, top: -3 }]} />
      ) : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  track: { width: "100%", backgroundColor: colors.trackMuted, overflow: "visible", justifyContent: "center" },
  // Clips the square segment ends to the bar's rounded shape.
  spend: { ...StyleSheet.absoluteFillObject, overflow: "hidden", transformOrigin: "left" },
  segment: { position: "absolute", top: 0, bottom: 0 },
  // Painted in the app background rather than left transparent: the track
  // underneath is a translucent white, so a hole would show the track, not a
  // gap. This has to be an opaque cut.
  seam: { position: "absolute", top: 0, bottom: 0, width: SEAM_WIDTH, backgroundColor: colors.bgApp },
  // Sits proud of the bar on both edges so it stays legible over a filled
  // section as well as over the empty track.
  pace: { position: "absolute", width: 2, backgroundColor: colors.textSecondary, borderRadius: 1 },
}));
