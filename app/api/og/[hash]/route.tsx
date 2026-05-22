/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "@vercel/og";
import { fetchVerdict, isContractConfigured } from "@/lib/genlayer";
import { formatSequence, formatLabel, compactUrl } from "@/lib/format";

export const runtime = "edge";

interface RouteContext {
  params: { hash: string };
}

/**
 * Per-verdict Open Graph image.
 *
 * The image is the single most-visible representation of Lemma in
 * shares on Twitter, Discord, and Mastodon. It must follow the Dry Ink
 * design rules: cream background, ink and rust typography, no
 * graphics, no badges, no rounded corners.
 *
 * The fonts available in the edge runtime are limited; @vercel/og can
 * load Google Fonts by URL at runtime but adds latency, so we keep the
 * design to a single serif fallback chain (Georgia → Times) and one
 * monospace fallback (Menlo → Courier). The system fonts on Vercel's
 * edge boxes render this exactly as a print page would.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  const cream = "#F5F0E6";
  const ink = "#1A1A1A";
  const inkSoft = "#4A4540";
  const inkMuted = "#8B8479";
  const rustDeep = "#8B4513";
  const divider = "#C7BFAE";

  // ---------- Fallback rendering when the contract is unconfigured ----------
  if (!isContractConfigured()) {
    return new ImageResponse(
      (
        <div style={baseFrame(cream, ink)}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 72, lineHeight: 1.1 }}>
            Lemma
          </div>
          <div
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 32,
              fontStyle: "italic",
              color: inkSoft,
              marginTop: 24,
            }}
          >
            An on-chain citation court.
          </div>
        </div>
      ),
      { width: 1200, height: 630 },
    );
  }

  const verdict = await fetchVerdict(params.hash);
  if (!verdict) {
    return new ImageResponse(
      (
        <div style={baseFrame(cream, ink)}>
          <div
            style={{
              fontFamily: "Menlo, monospace",
              fontSize: 18,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: inkMuted,
            }}
          >
            Lemma · No record
          </div>
          <div
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 64,
              lineHeight: 1.15,
              marginTop: 32,
            }}
          >
            The court has no record of this hash.
          </div>
        </div>
      ),
      { width: 1200, height: 630 },
    );
  }

  const seq = formatSequence(verdict.sequence);
  const labelDisplay = formatLabel(verdict.label);
  const labelColor =
    verdict.label === "misrepresented"
      ? rustDeep
      : verdict.label === "unverifiable"
      ? inkMuted
      : verdict.label === "unsupported"
      ? inkSoft
      : ink;
  const claimExcerpt =
    verdict.claim_text.length > 200
      ? `${verdict.claim_text.slice(0, 199).trimEnd()}…`
      : verdict.claim_text;

  return new ImageResponse(
    (
      <div style={baseFrame(cream, ink)}>
        {/* top masthead line */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            fontFamily: "Menlo, monospace",
            fontSize: 18,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: inkMuted,
          }}
        >
          <span>Lemma · No. {seq}</span>
          <span>Vol. I · Issue 1</span>
        </div>

        <div style={{ borderTop: `1px solid ${divider}`, marginTop: 24 }} />

        {/* verdict wordmark */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 48,
          }}
        >
          <div
            style={{
              fontFamily: "Menlo, monospace",
              fontSize: 16,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: inkSoft,
            }}
          >
            Verdict
          </div>
          <div
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 112,
              lineHeight: 1,
              marginTop: 16,
              color: labelColor,
              fontStyle: verdict.label === "unsupported" ? "italic" : "normal",
              fontWeight: verdict.label === "misrepresented" ? 500 : 400,
            }}
          >
            {labelDisplay}
          </div>
        </div>

        {/* claim excerpt */}
        <div
          style={{
            fontFamily: "Georgia, serif",
            fontSize: 28,
            lineHeight: 1.45,
            marginTop: 48,
            color: ink,
          }}
        >
          &ldquo;{claimExcerpt}&rdquo;
        </div>

        {/* source line */}
        <div style={{ marginTop: "auto" }}>
          <div style={{ borderTop: `1px solid ${divider}`, marginBottom: 20 }} />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              fontFamily: "Menlo, monospace",
              fontSize: 18,
              color: inkSoft,
            }}
          >
            <span>cited from {compactUrl(verdict.source_url, 60)}</span>
            <span style={{ color: inkMuted }}>uselemma.xyz</span>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

function baseFrame(cream: string, ink: string) {
  return {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column" as const,
    backgroundColor: cream,
    color: ink,
    padding: "64px 80px",
  };
}
