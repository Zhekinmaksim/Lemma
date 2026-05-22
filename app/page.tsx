import { LandingMasthead } from "@/components/LandingMasthead";
import { Epigraph } from "@/components/Epigraph";
import { Intro } from "@/components/Intro";
import { HowItWorks } from "@/components/HowItWorks";
import { VerdictFeed } from "@/components/VerdictFeed";

/**
 * The landing page.
 *
 * Composition follows the design handoff exactly:
 *   1. LandingMasthead (journal masthead, split layout)
 *   2. Epigraph (pulled-quote, rust left rule)
 *   3. Intro (drop-cap lede + closing CTA row)
 *   4. HowItWorks (three numbered editorial columns)
 *   5. Ornament rule (§ § §)
 *   6. VerdictFeed (live recent verdicts)
 *
 * The site-wide Topbar and Footer are rendered by `app/layout.tsx`,
 * so the page itself begins with the masthead block.
 */

// Re-fetch recent verdicts every 30s. Keeps the landing fast while
// still surfacing new claims as they're filed.
export const revalidate = 30;

export default function HomePage() {
  return (
    <>
      <LandingMasthead />
      <Epigraph />
      <Intro />
      <HowItWorks />
      <div className="ornament" aria-hidden="true">
        § § §
      </div>
      <VerdictFeed limit={8} />
    </>
  );
}
