import colors from "@/constants/colors";
import { useTheme } from "../src/context/ThemeContext";

/**
 * Returns the design tokens for the currently active palette.
 *
 * The active palette is driven by the user's preference stored in
 * settings (`dark`, `light`, or `system`). When the preference is
 * `system`, the device color scheme is followed.
 *
 * Falls back to the dark palette when no theme provider is mounted yet
 * (e.g. during the very first render before context initialization).
 */
export function useColors() {
  const { scheme } = useTheme();
  const palette = scheme === "light" ? colors.light : colors.dark;
  return { ...palette, radius: colors.radius };
}
