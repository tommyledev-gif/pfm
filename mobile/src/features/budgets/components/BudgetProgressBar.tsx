import { StyleSheet, View } from "react-native";

import { colors } from "@/lib/theme";

interface BudgetProgressBarProps {
  // spent / limit. Values above 1 are expected and drawn as a full bar whose
  // tail is hatched — see OVERSPEND below.
  ratio: number;
  // 0..1 share of the month elapsed, drawn as a vertical tick. Omitted on the
  // rows where a pace comparison is meaningless.
  pace?: number;
  color: string;
  height?: number;
}

const STRIPE_COUNT = 14;
// Width of the dark seam drawn wherever two coloured sections of the bar meet
// (spent | remaining, and spent | overspend). Without it the fill bleeds into
// the track as one continuous ramp and the boundary — the only thing this bar
// exists to communicate — has to be inferred from a colour change alone.
const SEAM_WIDTH = 2;

// A budget bar, which the plain ProgressBar can't express: it has to show
// three things at once — how much is spent, where the month's pace marker
// sits (so "80% used" reads differently on the 5th than on the 25th), and how
// far past the limit an overspend went.
//
// OVERSPEND: once ratio > 1 the track can't grow, so the bar is drawn full and
// the *share of it that is overspend* is hatched at the tail. At ratio 1.2
// that's 0.2/1.2 ≈ 17% of the bar, which reads as "a sixth of this was over"
// without needing a second scale. Hatching is a row of skewed slivers behind
// an overflow-hidden clip — react-native has no repeating-pattern fill, and
// pulling in react-native-svg for one texture isn't worth it.
export function BudgetProgressBar({ ratio, pace, color, height = 8 }: BudgetProgressBarProps) {
  const over = ratio > 1;
  const fill = Math.max(0, Math.min(1, ratio));
  const overspendShare = over ? (ratio - 1) / ratio : 0;
  const radius = height / 2;

  return (
    <View style={[styles.track, { height, borderRadius: radius }]}>
      <View style={[styles.fill, { width: `${fill * 100}%`, backgroundColor: color, borderRadius: radius }]} />

      {/* The spent | remaining seam. Only drawn while the bar is partly full —
          at 0% there is nothing to its left and at 100% nothing to its right,
          and in both cases a floating dark tick reads as a defect. */}
      {fill > 0 && fill < 1 ? (
        <View pointerEvents="none" style={[styles.seam, { left: `${fill * 100}%`, marginLeft: -SEAM_WIDTH }]} />
      ) : null}

      {over ? (
        <View style={[styles.overspend, { width: `${overspendShare * 100}%`, borderRadius: radius }]}>
          {Array.from({ length: STRIPE_COUNT }).map((_, i) => (
            <View key={i} style={styles.stripe} />
          ))}
        </View>
      ) : null}

      {/* The spent | overspend seam, on the hatch's leading edge. */}
      {over && overspendShare > 0 && overspendShare < 1 ? (
        <View pointerEvents="none" style={[styles.seam, { right: `${overspendShare * 100}%` }]} />
      ) : null}

      {pace !== undefined ? (
        <View
          pointerEvents="none"
          style={[styles.pace, { left: `${Math.max(0, Math.min(1, pace)) * 100}%`, height: height + 6, top: -3 }]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: "100%", backgroundColor: colors.trackMuted, overflow: "visible", justifyContent: "center" },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0 },
  // Painted in the app background rather than left transparent: the track
  // underneath is a translucent white, so a hole would show the track, not a
  // gap. This has to be an opaque cut.
  seam: { position: "absolute", top: 0, bottom: 0, width: SEAM_WIDTH, backgroundColor: colors.bgApp },
  overspend: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  stripe: {
    width: 2,
    height: "220%",
    backgroundColor: "rgba(255,255,255,0.55)",
    transform: [{ rotate: "30deg" }],
  },
  // Sits proud of the bar on both edges so it stays legible over a filled
  // section as well as over the empty track.
  pace: { position: "absolute", width: 2, backgroundColor: colors.textSecondary, borderRadius: 1 },
});
