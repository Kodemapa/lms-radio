import { BadgeCheck, ChartNoAxesColumnIncreasing, type LucideIcon, MonitorPlay, Ruler } from 'lucide-react';

/**
 * The icon on each "How you'll learn" step badge, by step key.
 */
export const JOURNEY_ICONS: Record<string, LucideIcon> = {
  watch: MonitorPlay,
  measure: Ruler,
  graded: BadgeCheck,
  report: ChartNoAxesColumnIncreasing,
};
