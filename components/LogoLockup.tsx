import { LemmaSeal } from "./LemmaSeal";

/**
 * LogoLockup
 *
 * The seal-and-wordmark composition. Two sizes:
 *
 *   sm: 28px seal + 1.25rem wordmark - used in the topbar.
 *   lg: 96px seal + clamp(3.5rem, 11vw, 6.5rem) wordmark - used in the
 *       landing masthead title row.
 *
 * The seal is rust-deep; the wordmark is ink. The parent span sets the
 * seal's colour via `color`; the wordmark explicitly overrides.
 */
interface LogoLockupProps {
  size?: "sm" | "lg";
}

export function LogoLockup({ size = "sm" }: LogoLockupProps) {
  const big = size === "lg";

  return (
    <span
      className="inline-flex items-center"
      style={{
        gap: big ? "1rem" : "0.55rem",
        color: "var(--lemma-rust-deep)",
      }}
    >
      <LemmaSeal size={big ? 96 : 28} />
      <span
        className="font-serif"
        style={{
          fontWeight: 500,
          fontSize: big ? "clamp(3.5rem, 11vw, 6.5rem)" : "1.25rem",
          letterSpacing: big ? "0.02em" : "0.06em",
          lineHeight: 1,
          color: "var(--lemma-ink)",
        }}
      >
        Lemma
      </span>
    </span>
  );
}
