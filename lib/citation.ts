/**
 * Citation generators.
 *
 * Each Lemma verdict can be referenced from external writing. Three
 * formats are produced from the verdict record: APA-style, BibTeX, and
 * a plain canonical URL. The site origin is read from the environment
 * so that local builds don't bake a production URL into screenshots.
 */

import type { Verdict } from "./abi";
import { formatSequence, formatDate, formatLabel } from "./format";

function siteOrigin(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env && env.startsWith("http")) return env.replace(/\/$/, "");
  return "https://uselemma.xyz";
}

export function canonicalUrl(claimHash: string): string {
  return `${siteOrigin()}/v/${claimHash}`;
}

export function apaCitation(verdict: Verdict, issuedOn: Date = new Date()): string {
  const seq = formatSequence(verdict.sequence);
  const date = formatDate(issuedOn);
  return `Lemma Verdict No. ${seq}. (${date}). Retrieved from ${canonicalUrl(verdict.claim_hash)}`;
}

export function bibtexCitation(verdict: Verdict, issuedOn: Date = new Date()): string {
  const seq = formatSequence(verdict.sequence);
  const year = issuedOn.getFullYear();
  const url = canonicalUrl(verdict.claim_hash);
  return [
    `@misc{lemma_${seq},`,
    `  title  = {Lemma Verdict No. ${seq}},`,
    `  publisher = {Lemma Citation Court},`,
    `  year   = {${year}},`,
    `  url    = {${url}},`,
    `  note   = {Verdict: ${formatLabel(verdict.label)}}`,
    `}`,
  ].join("\n");
}

export function plainLink(verdict: Verdict): string {
  return canonicalUrl(verdict.claim_hash);
}
