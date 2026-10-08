/**
 * Annotations as keyword evidence.
 *
 * Zotero's quick search matches the text and the comment of an annotation, and
 * the keyword leg credits such a match to the paper at the top of the chain
 * (see keyword-parents.ts). What it used to lose on the way is the annotation
 * itself: the paper arrived with no excerpt, and the back-fill then picked the
 * indexed passage closest in meaning to the query. Annotation comments are not
 * in the index, so for a phrase that exists only in a comment no passage holds
 * it, and the result showed text unrelated to why it matched (issue #65).
 *
 * This module keeps the matching annotation and decides when it, rather than an
 * indexed passage, is the excerpt worth showing. Pure so it can be tested
 * outside Zotero; the Zotero reads that feed it live in hybrid-search.ts.
 */

import { countMatchingTerms } from './keyword-backfill';

/** One annotation the keyword search matched, with what is needed to show and open it. */
export interface AnnotationEvidence {
  /** The annotation's own item key. */
  annotationKey: string;
  /** Key of the attachment the annotation belongs to, which the reader opens. */
  attachmentKey: string;
  /** What the reader wrote. */
  comment: string;
  /** The highlighted or underlined passage, empty for notes and images. */
  text: string;
  /** 1-based page, known only for PDF annotations. */
  pageNumber?: number;
}

/** An annotation match, already resolved to the item that will represent it. */
export interface AnnotationCandidate {
  ownerId: number;
  evidence: AnnotationEvidence;
}

export interface AnnotationChoice {
  evidence: AnnotationEvidence;
  /** Distinct query terms in the comment and the highlighted text together. */
  termHits: number;
}

/**
 * The best-covering annotation for each item.
 *
 * Coverage is counted over the comment and the highlighted text together,
 * because Zotero matched on either. An annotation that holds no query term is
 * skipped: it can reach this point only through a key match or a term this
 * module does not count, and it would explain nothing. Ties keep the first
 * candidate, which preserves Zotero's own result order.
 */
export function chooseAnnotationEvidence(
  candidates: AnnotationCandidate[],
  terms: string[],
): Map<number, AnnotationChoice> {
  const chosen = new Map<number, AnnotationChoice>();
  for (const { ownerId, evidence } of candidates) {
    const termHits = countMatchingTerms(`${evidence.comment}\n${evidence.text}`, terms);
    if (termHits === 0) continue;
    const current = chosen.get(ownerId);
    if (current && current.termHits >= termHits) continue;
    chosen.set(ownerId, { evidence, termHits });
  }
  return chosen;
}

/**
 * Whether the annotation, not the indexed passage, should represent the hit.
 *
 * Only when it holds more of the query than the passage does. A passage from
 * the paper that contains the words is an equally true excerpt and comes with
 * a page the user can open, so a tie keeps it. `passageTermHits` is undefined
 * when the item has no indexed passage at all, which counts as none.
 */
export function annotationWins(choice: AnnotationChoice, passageTermHits: number | undefined): boolean {
  return choice.termHits > (passageTermHits ?? 0);
}

/**
 * The excerpt shown for an annotation: the comment first, since it is the
 * reader's own words and usually what was searched for, then the passage it
 * comments on, in quotes. No labels, so the excerpt reads the same in every
 * interface language.
 */
export function annotationSnippet(evidence: AnnotationEvidence): string {
  const comment = evidence.comment.trim();
  const text = evidence.text.trim();
  if (comment && text) return `${comment}\n\n“${text}”`;
  return comment || (text ? `“${text}”` : '');
}

/**
 * The 1-based page of a PDF annotation, read from Zotero's stored position.
 *
 * PDF positions carry a 0-based `pageIndex`. EPUB and snapshot annotations
 * locate themselves by CFI or CSS selector and have no page, so they return
 * undefined, as does anything unparseable.
 */
export function annotationPageNumber(position: string | null | undefined): number | undefined {
  if (!position) return undefined;
  try {
    const pageIndex = JSON.parse(position)?.pageIndex;
    return Number.isInteger(pageIndex) && pageIndex >= 0 ? pageIndex + 1 : undefined;
  } catch {
    return undefined;
  }
}
