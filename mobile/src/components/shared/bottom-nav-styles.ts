

import { createStyles } from "@/lib/theme";

// Geometry and styles for BottomNav.tsx, split out to keep that file under
// the 300-line limit. The ball / aura / hairline numbers are interdependent —
// change them together.
export const PILL_HEIGHT = 64;
export const BALL_SIZE = 48;
// Even gap between the ball and the socket's edge. Larger than the ball's
// idle float (BOB_DISTANCE) and than half its tab-switch squash, so the ball
// never touches the edge.
const SOCKET_GAP = 8;
// The socket ("hollow") is the only thing drawn around the ball — no rings
// or halo between them (specs/mobile-ux-batch-2026-10 US-02).
const SOCKET_DIAMETER = BALL_SIZE + SOCKET_GAP * 2;
// How far the ball's center sits BELOW the bar's top edge. Zero centred the
// ball exactly on the edge, which read as floating too high above the bar;
// sinking it a little seats it in its socket.
export const BALL_SINK = 8;
export const BALL_TOP = -(BALL_SIZE / 2) + BALL_SINK;
// The hollow and its rim are one SVG shape: the socket circle (centred
// BALL_SINK below the bar's top edge), joined to the top edge by two small
// fillet arcs instead of meeting it at a sharp corner. All y values are along
// the hairline's own centre line, so the straight halves and the curve meet
// without a step.
export const HAIRLINE = 1;
const SOCKET_RADIUS = SOCKET_DIAMETER / 2;
// How round the corners where the hollow meets the bar's edge are.
const SOCKET_FILLET_RADIUS = 10;
const EDGE_Y = HAIRLINE / 2;
// Each fillet circle sits on the edge line and touches the socket circle from
// outside; its centre's horizontal offset from the socket centre is also where
// the straight hairline stops.
const FILLET_CENTER_DY = EDGE_Y + SOCKET_FILLET_RADIUS - BALL_SINK;
const FILLET_DX = Math.sqrt((SOCKET_RADIUS + SOCKET_FILLET_RADIUS) ** 2 - FILLET_CENTER_DY ** 2);
// Where each fillet hands over to the socket circle.
const TANGENT_RATIO = SOCKET_RADIUS / (SOCKET_RADIUS + SOCKET_FILLET_RADIUS);
const TANGENT_DX = FILLET_DX * TANGENT_RATIO;
const TANGENT_Y = BALL_SINK + FILLET_CENTER_DY * TANGENT_RATIO;
// Past half a circle only if the hand-over points sit above the socket centre.
const SOCKET_LARGE_ARC = TANGENT_Y > BALL_SINK ? 0 : 1;

export const LINE_LENGTH = 2000; // longer than any screen; the overflow runs off-edge
export const LINE_LEFT_END = BALL_SIZE / 2 - FILLET_DX - LINE_LENGTH;
export const LINE_RIGHT_START = BALL_SIZE / 2 + FILLET_DX;

// SVG box over the hollow, with room for the stroke's outer half.
const RIM_PAD = HAIRLINE;
const RIM_CX = FILLET_DX + RIM_PAD;
export const RIM_WIDTH = RIM_CX * 2;
export const RIM_HEIGHT = BALL_SINK + SOCKET_RADIUS + RIM_PAD;
export const RIM_LEFT_OFFSET = BALL_SIZE / 2 - RIM_CX;
// Left fillet (clockwise), socket arc under the ball (counter-clockwise),
// right fillet (clockwise).
export const RIM_PATH =
  `M ${RIM_CX - FILLET_DX} ${EDGE_Y} ` +
  `A ${SOCKET_FILLET_RADIUS} ${SOCKET_FILLET_RADIUS} 0 0 1 ${RIM_CX - TANGENT_DX} ${TANGENT_Y} ` +
  `A ${SOCKET_RADIUS} ${SOCKET_RADIUS} 0 ${SOCKET_LARGE_ARC} 0 ${RIM_CX + TANGENT_DX} ${TANGENT_Y} ` +
  `A ${SOCKET_FILLET_RADIUS} ${SOCKET_FILLET_RADIUS} 0 0 1 ${RIM_CX + FILLET_DX} ${EDGE_Y}`;
// The same outline closed along the edge: the hollow's tinted fill.
export const SOCKET_FILL_PATH = `${RIM_PATH} Z`;
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
    // No drop shadow: Android draws elevation as a grey halo around the ball,
    // which read as one more layer between the ball and its hollow.
  },
}));
