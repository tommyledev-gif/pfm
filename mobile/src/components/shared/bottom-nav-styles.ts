

import { createStyles } from "@/lib/theme";

// Geometry and styles for BottomNav.tsx, split out to keep that file under
// the 300-line limit. The ball / aura / hairline numbers are interdependent —
// change them together.
export const PILL_HEIGHT = 64;
export const BALL_SIZE = 48;
export const AURA_OUTER = 78;
export const AURA_MID = 60;
export const AURA_CORE = 44;
// How far the ball's center sits BELOW the bar's top edge. Zero centred the
// ball exactly on the edge, which read as floating too high above the bar;
// sinking it a little seats it in its socket.
export const BALL_SINK = 8;
export const BALL_TOP = -(BALL_SIZE / 2) + BALL_SINK;
// Aura's vertical center must land on the same y as the ball's center — not
// the bar's own vertical middle. The bar's `overflow: hidden` then clips away
// everything above its top edge for free, leaving a socket that's flat across
// the top and rounded only on the bottom, instead of a full stray circle.
export const AURA_TOP = BALL_SINK - AURA_OUTER / 2;
export const AURA_LEFT_OFFSET = (BALL_SIZE - AURA_OUTER) / 2;
// The bar's top hairline has to leave the flat where the socket meets it, or
// a line runs straight across the "hole" and the ball reads as sitting on a
// flat surface instead of in a hollow. The straight halves stop at the
// socket's chord — measured along the hairline's own centre line, so the rim
// arc below starts exactly where they end — and the rim carries the line
// down around the socket and back up.
export const HAIRLINE = 1;
const SOCKET_RADIUS = AURA_OUTER / 2;
export const SOCKET_HALF_CHORD = Math.sqrt(SOCKET_RADIUS ** 2 - (BALL_SINK - HAIRLINE / 2) ** 2);
export const LINE_LENGTH = 2000; // longer than any screen; the overflow runs off-edge
export const LINE_LEFT_END = BALL_SIZE / 2 - SOCKET_HALF_CHORD - LINE_LENGTH;
export const LINE_RIGHT_START = BALL_SIZE / 2 + SOCKET_HALF_CHORD;
// The rim: the socket circle's arc below the bar's top edge, drawn in an SVG
// box sitting exactly over the aura (plus room for the stroke's outer half).
// Large-arc + counter-clockwise sweep is the part that dips below the chord,
// since the socket's centre sits BALL_SINK below the edge.
const RIM_PAD = HAIRLINE;
export const RIM_LEFT_OFFSET = AURA_LEFT_OFFSET - RIM_PAD;
export const RIM_WIDTH = AURA_OUTER + RIM_PAD * 2;
export const RIM_HEIGHT = BALL_SINK + SOCKET_RADIUS + RIM_PAD;
const RIM_CX = SOCKET_RADIUS + RIM_PAD;
export const RIM_PATH =
  `M ${RIM_CX - SOCKET_HALF_CHORD} ${HAIRLINE / 2} ` +
  `A ${SOCKET_RADIUS} ${SOCKET_RADIUS} 0 1 0 ${RIM_CX + SOCKET_HALF_CHORD} ${HAIRLINE / 2}`;
// Tab-switch "bounce" on the ball's icon: up to this scale, then back to 1.
export const ICON_BOUNCE_SCALE = 1.15;
// Idle float: the ball drifts this many px above its resting spot and back,
// forever. Kept tiny (and slow) so it reads as "alive", not as motion.
export const BOB_DISTANCE = 4;
export const BOB_DURATION = 1600;

export const useStyles = createStyles((colors) => ({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  // Flush against the screen's bottom/left/right edges now, not a floating
  // margined pill — only the top corners stay rounded. paddingBottom (set
  // inline to insets.bottom) extends the bar's own background into the
  // safe-area strip below the tabs instead of leaving it transparent.
  pill: {
    width: "100%",
    // borderTopLeftRadius: radii.hero,
    // borderTopRightRadius: radii.hero,
    // No border of its own: the top hairline is drawn separately (topLine)
    // so it can break around the ball's socket.
    overflow: "hidden",
    backgroundColor: colors.navBg,
  },
  topLine: {
    position: "absolute",
    top: 0,
    width: LINE_LENGTH,
    height: HAIRLINE,
    backgroundColor: colors.navBorder,
  },
  rim: { position: "absolute", top: 0, left: RIM_LEFT_OFFSET, width: RIM_WIDTH, height: RIM_HEIGHT },
  tabRow: { flexDirection: "row", width: "100%", height: PILL_HEIGHT },
  tab: { flex: 1, alignItems: "center", justifyContent: "center" },
  // Three concentric circles fake a radial-gradient "hollow socket" behind
  // the ball (no gradient dependency in this project) — each ring darker
  // and smaller than the last, centered via plain flex nesting.
  auraOuter: {
    position: "absolute",
    width: AURA_OUTER,
    height: AURA_OUTER,
    borderRadius: AURA_OUTER / 2,
    backgroundColor: colors.navSocketOuter,
    alignItems: "center",
    justifyContent: "center",
  },
  auraMid: {
    width: AURA_MID,
    height: AURA_MID,
    borderRadius: AURA_MID / 2,
    backgroundColor: colors.navSocketMid,
    alignItems: "center",
    justifyContent: "center",
  },
  auraCore: {
    width: AURA_CORE,
    height: AURA_CORE,
    borderRadius: AURA_CORE / 2,
    backgroundColor: colors.navSocketCore,
  },
  ball: {
    position: "absolute",
    left: 0,
    top: BALL_TOP,
    width: BALL_SIZE,
    height: BALL_SIZE,
    borderRadius: BALL_SIZE / 2,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.green,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
}));
