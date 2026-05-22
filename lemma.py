# { "Seq": [{ "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }] }

# Lemma - on-chain citation court.
# Researchers, agents, and editors submit a claim plus a cited source URL.
# A jury of GenLayer validators independently fetches the source, reads it,
# and reaches consensus on whether the claim is faithfully supported.
# The verdict is published on-chain with a permanent reference.
#
# Repository: https://github.com/Zhekinmaksim/lemma
# Site:       https://uselemma.xyz

import hashlib
from dataclasses import dataclass

from genlayer import *


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Minimum stake required to submit a claim. 0.001 GEN on testnet.
MIN_STAKE: u256 = u256(1_000_000_000_000_000)

# Multiplier applied to the original stake when filing an appeal.
APPEAL_MULTIPLIER: u256 = u256(5)

# Soft rate limit: maximum lifetime claims a single submitter can register.
# Cheap protection against spam without hard-banning addresses.
SUBMITTER_CAP: u256 = u256(10_000)

# Maximum characters of source text to feed into the LLM prompt.
SOURCE_EXCERPT_MAX = 12_000

# Minimum source body length below which the source is considered
# unfetchable / unreadable.
SOURCE_MIN_LENGTH = 200

# Verdict labels. Kept as a tuple of plain strings so they can be
# referenced from both deterministic and non-deterministic code paths
# without any storage indirection.
LABEL_VERIFIED = "verified"
LABEL_PARTIAL = "partially_verified"
LABEL_MISREPRESENTED = "misrepresented"
LABEL_UNSUPPORTED = "unsupported"
LABEL_UNVERIFIABLE = "unverifiable"

VALID_LABELS = (
    LABEL_VERIFIED,
    LABEL_PARTIAL,
    LABEL_MISREPRESENTED,
    LABEL_UNSUPPORTED,
    LABEL_UNVERIFIABLE,
)


# ---------------------------------------------------------------------------
# Stored verdict record
# ---------------------------------------------------------------------------

@allow_storage
@dataclass
class Verdict:
    claim_text: str
    source_url: str
    source_context: str
    submitter: Address
    label: str
    justification: str
    sequence: u256
    appeal_count: u256
    stake_consumed: u256


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _compute_claim_hash(claim_text: str, source_url: str, submitter: Address) -> str:
    """
    Deterministic content address for a (claim, source, submitter) triple.

    Plain hashlib.sha256 is deterministic by construction (no entropy, no
    wall clock), so every validator computes the same hash from the same
    inputs. The result is returned as a 0x-prefixed lowercase hex string
    suitable for use as a TreeMap key and for URL routing on the frontend.
    """
    h = hashlib.sha256()
    h.update(claim_text.encode("utf-8"))
    h.update(b"\x00")  # separator so "ab|cd" cannot collide with "a|bcd"
    h.update(source_url.encode("utf-8"))
    h.update(b"\x00")
    h.update(submitter.as_bytes)
    return "0x" + h.hexdigest()


def _parse_jury_output(raw: str) -> tuple[str, str]:
    """
    Parse the "<label> | <justification>" string returned by the jury.

    Defensive against minor LLM formatting drift:
    - leading/trailing whitespace
    - the model wrapping the response in code fences
    - missing separator (we fall back to "unverifiable")
    """
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").strip()
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()

    if "|" not in cleaned:
        return (
            LABEL_UNVERIFIABLE,
            "Jury output missing label separator: " + cleaned[:160],
        )

    label_part, _, justification_part = cleaned.partition("|")
    label = label_part.strip().lower()
    justification = justification_part.strip()

    if label not in VALID_LABELS:
        return (
            LABEL_UNVERIFIABLE,
            "Jury returned unknown label '" + label + "': " + justification[:160],
        )

    if not justification:
        justification = "(no justification provided)"

    return label, justification


def _build_jury_prompt(
    claim_text: str,
    source_url: str,
    source_context: str,
    source_excerpt: str,
    stricter: bool,
) -> str:
    """
    Build the prompt fed to each validator. Kept as a free function so it
    can be unit-tested in Studio without instantiating the contract.

    The label-first format is the contract between the jury and the
    equivalence comparator: the comparator only needs to verify that the
    first token before "|" agrees across validators.
    """
    context_block = ""
    if source_context:
        context_block = (
            "\n\nSUBMITTER CONTEXT (treat as advisory, not as evidence):\n"
            + source_context[:1000]
        )

    strict_clause = ""
    if stricter:
        strict_clause = (
            "\n\nThis is an APPEAL. Apply higher scrutiny: a verdict of "
            "'verified' or 'misrepresented' requires that your justification "
            "quote or paraphrase a specific sentence or section of the source."
        )

    return (
        "You are a citation auditor. Determine whether the CLAIM below is "
        "faithfully supported by the cited SOURCE.\n\n"
        "CLAIM:\n" + claim_text + "\n\n"
        "SOURCE URL: " + source_url + "\n"
        "SOURCE EXCERPT (truncated to the first portion of the page):\n"
        "---\n" + source_excerpt + "\n---"
        + context_block
        + strict_clause
        + "\n\nReturn exactly one of these labels as the first token, "
        "followed by ' | ' and a single-sentence justification:\n"
        "- verified: the source clearly supports the claim as stated\n"
        "- partially_verified: the source supports parts of the claim "
        "but with significant caveats the claim omits\n"
        "- misrepresented: the source contradicts the claim or distorts "
        "what the source actually said\n"
        "- unsupported: the source does not address the claim at all\n"
        "- unverifiable: the source is inaccessible, paywalled, empty, "
        "or too short to judge\n\n"
        "Format strictly: <label> | <one-sentence justification>\n"
        "Do not output anything else, no preamble, no code fences."
    )


# ---------------------------------------------------------------------------
# Contract
# ---------------------------------------------------------------------------

class Lemma(gl.Contract):
    # Verdicts keyed by claim_hash (hex string).
    verdicts: TreeMap[str, Verdict]

    # Ordered list of claim_hash strings, oldest first. Used to power
    # the dashboard's "recent claims" feed without an off-chain indexer.
    recent_hashes: DynArray[str]

    # Submitter -> lifetime claim count, used for the soft cap.
    submitter_counts: TreeMap[Address, u256]

    # Aggregate counters for the dashboard.
    total_claims: u256
    total_verified: u256
    total_partial: u256
    total_misrepresented: u256
    total_unsupported: u256
    total_unverifiable: u256

    def __init__(self) -> None:
        self.total_claims = u256(0)
        self.total_verified = u256(0)
        self.total_partial = u256(0)
        self.total_misrepresented = u256(0)
        self.total_unsupported = u256(0)
        self.total_unverifiable = u256(0)

    # -----------------------------------------------------------------------
    # Public: submit_claim
    # -----------------------------------------------------------------------

    @gl.public.write.payable
    def submit_claim(
        self,
        claim_text: str,
        source_url: str,
        source_context: str = "",
    ) -> str:
        """
        Submit a (claim, source) pair for jury verification.

        Returns the claim_hash that can be used to fetch the verdict later.
        Reverts if validation fails or the same triple has already been
        submitted by the same address.
        """
        # ---- Deterministic input validation ----
        if len(claim_text) < 10 or len(claim_text) > 2000:
            raise gl.vm.UserError(
                "claim_text length must be between 10 and 2000 characters"
            )
        if not source_url.startswith("https://"):
            raise gl.vm.UserError("source_url must start with https://")
        if len(source_url) > 500:
            raise gl.vm.UserError("source_url too long (max 500 chars)")
        if len(source_context) > 1000:
            raise gl.vm.UserError("source_context too long (max 1000 chars)")
        if gl.message.value < MIN_STAKE:
            raise gl.vm.UserError(
                "insufficient stake: at least 0.001 GEN required"
            )

        submitter = gl.message.sender_address
        prior_count = self.submitter_counts.get(submitter, u256(0))
        if prior_count >= SUBMITTER_CAP:
            raise gl.vm.UserError("submitter cap reached")

        claim_hash = _compute_claim_hash(claim_text, source_url, submitter)

        if claim_hash in self.verdicts:
            raise gl.vm.UserError("claim already submitted by this address")

        # ---- Non-deterministic block: web fetch + jury deliberation ----
        # Closure-only locals; no self access, no storage access.
        local_claim = claim_text
        local_url = source_url
        local_context = source_context

        def jury_evaluate() -> str:
            source_text = gl.nondet.web.render(local_url, mode="text")
            if source_text is None or len(source_text) < SOURCE_MIN_LENGTH:
                return (
                    LABEL_UNVERIFIABLE
                    + " | Source could not be fetched or returned fewer than "
                    + str(SOURCE_MIN_LENGTH)
                    + " characters of text."
                )

            excerpt = source_text[:SOURCE_EXCERPT_MAX]
            prompt = _build_jury_prompt(
                local_claim, local_url, local_context, excerpt, stricter=False
            )
            raw = gl.nondet.exec_prompt(prompt)
            return raw.strip()

        principle = (
            "Both responses must agree on the LABEL, which is the token "
            "before the first '|' character. Valid labels are: verified, "
            "partially_verified, misrepresented, unsupported, unverifiable. "
            "Justifications may differ in wording but must convey the same "
            "underlying judgment about the relationship between claim and "
            "source. Return EQUAL if labels match exactly and the "
            "justifications do not contradict each other. Return DIFFERENT "
            "if the labels differ or the justifications contradict."
        )

        consensus = gl.eq_principle.prompt_comparative(jury_evaluate, principle)
        label, justification = _parse_jury_output(consensus)

        # ---- Persist verdict ----
        stake = u256(gl.message.value)
        sequence = u256(int(self.total_claims) + 1)

        verdict = Verdict(
            claim_text=claim_text,
            source_url=source_url,
            source_context=source_context,
            submitter=submitter,
            label=label,
            justification=justification,
            sequence=sequence,
            appeal_count=u256(0),
            stake_consumed=stake,
        )
        self.verdicts[claim_hash] = verdict
        self.recent_hashes.append(claim_hash)
        self.submitter_counts[submitter] = u256(int(prior_count) + 1)
        self._bump_counters(label, +1)
        self.total_claims = sequence

        return claim_hash

    # -----------------------------------------------------------------------
    # Public: appeal
    # -----------------------------------------------------------------------

    @gl.public.write.payable
    def appeal(self, claim_hash: str) -> None:
        """
        Trigger a single appeal on an existing verdict. The jury re-runs
        with a stricter prompt and may overturn the previous label.
        """
        if claim_hash not in self.verdicts:
            raise gl.vm.UserError("no verdict for that claim_hash")

        existing = self.verdicts[claim_hash]
        if int(existing.appeal_count) >= 1:
            raise gl.vm.UserError("claim has already been appealed once")

        required = u256(int(existing.stake_consumed) * int(APPEAL_MULTIPLIER))
        if gl.message.value < required:
            raise gl.vm.UserError(
                "appeal stake must be at least 5x the original stake"
            )

        # Snapshot fields locally before entering the non-det block.
        local_claim = str(existing.claim_text)
        local_url = str(existing.source_url)
        local_context = str(existing.source_context)
        previous_label = str(existing.label)

        def jury_reevaluate() -> str:
            source_text = gl.nondet.web.render(local_url, mode="text")
            if source_text is None or len(source_text) < SOURCE_MIN_LENGTH:
                return (
                    LABEL_UNVERIFIABLE
                    + " | Source could not be fetched on re-evaluation."
                )
            excerpt = source_text[:SOURCE_EXCERPT_MAX]
            prompt = _build_jury_prompt(
                local_claim, local_url, local_context, excerpt, stricter=True
            )
            raw = gl.nondet.exec_prompt(prompt)
            return raw.strip()

        appeal_principle = (
            "Both responses must agree on the LABEL (the token before the "
            "first '|'). This is an appeal proceeding, so apply stricter "
            "scrutiny: a justification supporting 'verified' or "
            "'misrepresented' should reference specific elements of the "
            "source. Return EQUAL only if labels match and justifications "
            "agree in substance. Return DIFFERENT otherwise."
        )

        consensus = gl.eq_principle.prompt_comparative(
            jury_reevaluate, appeal_principle
        )
        new_label, new_justification = _parse_jury_output(consensus)

        # ---- Update counters and overwrite verdict ----
        if new_label != previous_label:
            self._bump_counters(previous_label, -1)
            self._bump_counters(new_label, +1)

        appeal_stake = u256(int(existing.stake_consumed) + int(gl.message.value))

        self.verdicts[claim_hash] = Verdict(
            claim_text=local_claim,
            source_url=local_url,
            source_context=local_context,
            submitter=existing.submitter,
            label=new_label,
            justification=new_justification,
            sequence=existing.sequence,
            appeal_count=u256(1),
            stake_consumed=appeal_stake,
        )

    # -----------------------------------------------------------------------
    # Read-only views
    # -----------------------------------------------------------------------

    @gl.public.view
    def get_verdict(self, claim_hash: str) -> dict:
        """
        Return the verdict for a claim_hash as a plain dict so the frontend
        can decode it without needing a TypeScript class for the struct.
        Reverts if the claim is unknown.
        """
        if claim_hash not in self.verdicts:
            raise gl.vm.UserError("no verdict for that claim_hash")
        v = self.verdicts[claim_hash]
        return {
            "claim_hash": claim_hash,
            "claim_text": str(v.claim_text),
            "source_url": str(v.source_url),
            "source_context": str(v.source_context),
            "submitter": v.submitter.as_hex,
            "label": str(v.label),
            "justification": str(v.justification),
            "sequence": int(v.sequence),
            "appeal_count": int(v.appeal_count),
            "stake_consumed": int(v.stake_consumed),
        }

    @gl.public.view
    def has_verdict(self, claim_hash: str) -> bool:
        return claim_hash in self.verdicts

    @gl.public.view
    def get_stats(self) -> dict:
        """
        Aggregate counters for the public dashboard.
        """
        return {
            "total_claims": int(self.total_claims),
            "verified": int(self.total_verified),
            "partially_verified": int(self.total_partial),
            "misrepresented": int(self.total_misrepresented),
            "unsupported": int(self.total_unsupported),
            "unverifiable": int(self.total_unverifiable),
            "min_stake": int(MIN_STAKE),
            "appeal_multiplier": int(APPEAL_MULTIPLIER),
        }

    @gl.public.view
    def get_recent_claims(self, limit: int) -> list[str]:
        """
        Return up to `limit` most recent claim_hash strings, newest first.
        """
        if limit <= 0:
            return []
        if limit > 100:
            limit = 100

        total = len(self.recent_hashes)
        result: list[str] = []
        i = total - 1
        while i >= 0 and len(result) < limit:
            result.append(str(self.recent_hashes[i]))
            i -= 1
        return result

    @gl.public.view
    def get_submitter_count(self, address: str) -> int:
        addr = Address(address)
        return int(self.submitter_counts.get(addr, u256(0)))

    # -----------------------------------------------------------------------
    # Internal: bump verdict counters
    # -----------------------------------------------------------------------

    def _bump_counters(self, label: str, delta: int) -> None:
        """
        Increment or decrement the aggregate counter that matches the label.
        Used both when a verdict is first recorded and when an appeal flips
        the label. `delta` is +1 or -1.
        """
        if label == LABEL_VERIFIED:
            self.total_verified = u256(int(self.total_verified) + delta)
        elif label == LABEL_PARTIAL:
            self.total_partial = u256(int(self.total_partial) + delta)
        elif label == LABEL_MISREPRESENTED:
            self.total_misrepresented = u256(int(self.total_misrepresented) + delta)
        elif label == LABEL_UNSUPPORTED:
            self.total_unsupported = u256(int(self.total_unsupported) + delta)
        else:
            self.total_unverifiable = u256(int(self.total_unverifiable) + delta)
