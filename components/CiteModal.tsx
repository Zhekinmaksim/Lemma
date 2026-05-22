"use client";

import { useState } from "react";
import type { Verdict } from "@/lib/abi";
import { apaCitation, bibtexCitation, plainLink } from "@/lib/citation";

/**
 * Citation export.
 *
 * Opens as a fully-page overlay (not a centred dialog with shadow).
 * Three formats: APA, BibTeX, plain link. Each in its own monospace
 * block with a quiet "copy" link below. No icons, no toast - the link
 * text changes briefly to "copied" instead.
 */
interface CiteModalProps {
  verdict: Verdict;
}

export function CiteModal({ verdict }: CiteModalProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        Cite this →
      </button>
      {open && <CiteOverlay verdict={verdict} onClose={() => setOpen(false)} />}
    </>
  );
}

function CiteOverlay({ verdict, onClose }: { verdict: Verdict; onClose: () => void }) {
  const apa = apaCitation(verdict);
  const bib = bibtexCitation(verdict);
  const link = plainLink(verdict);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-cream/95 px-6 py-10 fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Citation formats"
    >
      <div className="mx-auto w-full max-w-prose">
        <header className="flex items-baseline justify-between">
          <h2 className="font-serif text-h2 text-ink">Cite this verdict</h2>
          <button type="button" className="btn" onClick={onClose}>
            Close ×
          </button>
        </header>
        <hr className="hairline mt-4" />

        <CitationBlock label="APA" text={apa} />
        <CitationBlock label="BibTeX" text={bib} multiline />
        <CitationBlock label="Plain link" text={link} mono />
      </div>
    </div>
  );
}

function CitationBlock({
  label,
  text,
  mono,
  multiline,
}: {
  label: string;
  text: string;
  mono?: boolean;
  multiline?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* silent failure: user can select manually */
    }
  }

  return (
    <section className="mt-8">
      <p className="editorial-label mb-2">{label}</p>
      {multiline ? (
        <pre
          className={`whitespace-pre-wrap bg-paper p-4 text-small leading-relaxed ${
            mono ? "" : "font-mono"
          }`}
        >
          {text}
        </pre>
      ) : (
        <p
          className={`bg-paper p-4 text-small leading-relaxed ${
            mono ? "font-mono" : "font-serif"
          } break-all`}
        >
          {text}
        </p>
      )}
      <button type="button" className="btn mt-2" onClick={copy}>
        {copied ? "Copied" : "Copy →"}
      </button>
    </section>
  );
}
