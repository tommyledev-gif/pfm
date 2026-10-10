// BottomNav's tab glyphs, named by the tab's role rather than by the picture,
// so swapping a glyph is a one-line change here.
//
// Deep imports, one file per icon: Metro does not tree-shake, so the package
// root would pull every Phosphor icon (all six weights) into the bundle.
//
// The assistant tab is a magic wand, not a chat bubble (reads as messaging a
// person), a sparkle (reads as Gemini) or a robot: "the app does it for you",
// which matches AI proposing and the User confirming. The tab's label says
// "Trợ lý" for screen readers.
export { HouseIcon as HomeTabIcon } from "phosphor-react-native/src/icons/House";
export { ListBulletsIcon as TransactionsTabIcon } from "phosphor-react-native/src/icons/ListBullets";
export { MagicWandIcon as AssistantIcon } from "phosphor-react-native/src/icons/MagicWand";
export { ChartBarIcon as InsightsTabIcon } from "phosphor-react-native/src/icons/ChartBar";
export { UserIcon as SettingsTabIcon } from "phosphor-react-native/src/icons/User";
