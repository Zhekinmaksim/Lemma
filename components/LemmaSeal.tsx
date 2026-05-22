/**
 * LemmaSeal
 *
 * The brand mark. A circular court seal: two concentric hairline rings,
 * eight notarial dots distributed around the inner ring, and a centred
 * turnstile glyph (⊢ "it is proven that…"). Drawn in `currentColor` so
 * the parent can colour the whole mark by setting `color`.
 *
 * Scales linearly with the 40-unit viewBox; do not bake a fixed pixel
 * size into the SVG itself.
 */
interface LemmaSealProps {
  size?: number;
  className?: string;
}

const NOTARY_DOTS = Array.from({ length: 8 }, (_, i) => {
  // Start at 12 o'clock and walk clockwise.
  const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
  return {
    cx: 20 + Math.cos(angle) * 17,
    cy: 20 + Math.sin(angle) * 17,
  };
});

export function LemmaSeal({ size = 28, className }: LemmaSealProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      className={className}
      style={{ display: "block" }}
    >
      <circle
        cx="20"
        cy="20"
        r="18.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <circle
        cx="20"
        cy="20"
        r="15.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
      />
      {NOTARY_DOTS.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r="0.55" fill="currentColor" />
      ))}
      <g transform="translate(20 20)">
        <line
          x1="-5"
          y1="-5.5"
          x2="-5"
          y2="5.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="butt"
        />
        <line
          x1="-5"
          y1="0"
          x2="5.5"
          y2="0"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinecap="butt"
        />
      </g>
    </svg>
  );
}
