import type { VerdictLabel } from "@/lib/abi";
import { formatLabel } from "@/lib/format";

/**
 * VerdictBadge
 *
 * The verdict label as a typographic mark, not a pill. Two scales:
 *
 *   inline  -> .verdict-word + label class (used in feeds, lists,
 *              inline mentions). Size: 1.05rem.
 *   display -> .verdict-display + label class (used on the verdict
 *              page as the headline). Size: 4rem.
 *
 * Both scales share the same colour and weight logic per label, kept
 * in globals.css so the JSX stays a thin shell.
 */
interface VerdictBadgeProps {
  label: VerdictLabel;
  size?: "inline" | "display";
}

export function VerdictBadge({ label, size = "inline" }: VerdictBadgeProps) {
  const base = size === "display" ? "verdict-display" : "verdict-word";
  return (
    <span className={`${base} ${label} lowercase`}>{formatLabel(label)}</span>
  );
}
