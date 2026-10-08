import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  AnnotationEvidence,
  annotationPageNumber,
  annotationSnippet,
  annotationWins,
  chooseAnnotationEvidence,
} from '../src/core/keyword-annotations';
import { keywordTerms } from '../src/core/keyword-backfill';

const annotation = (overrides: Partial<AnnotationEvidence> = {}): AnnotationEvidence => ({
  annotationKey: 'ANNOTKEY',
  attachmentKey: 'ATTACHKY',
  comment: '',
  text: '',
  ...overrides,
});

describe('chooseAnnotationEvidence', () => {
  test('keeps, per paper, the annotation that covers the most query terms', () => {
    const terms = keywordTerms('protected variables share');
    const partial = annotation({ annotationKey: 'PARTIAL1', comment: 'protected attributes' });
    const full = annotation({ annotationKey: 'FULLHIT1', comment: 'about 5% share protected variables' });
    const chosen = chooseAnnotationEvidence(
      [{ ownerId: 7, evidence: partial }, { ownerId: 7, evidence: full }],
      terms,
    );
    assert.equal(chosen.get(7)?.evidence.annotationKey, 'FULLHIT1');
    assert.equal(chosen.get(7)?.termHits, 3);
  });

  test('counts the highlighted text as well as the comment', () => {
    // Zotero matches on either field, so a term only in the highlight is real
    // coverage.
    const terms = keywordTerms('expert criteria');
    const chosen = chooseAnnotationEvidence(
      [{ ownerId: 7, evidence: annotation({ comment: 'criteria for this', text: 'the expert panel' }) }],
      terms,
    );
    assert.equal(chosen.get(7)?.termHits, 2);
  });

  test('a tie keeps the first match, which is Zotero order', () => {
    const terms = keywordTerms('delphi');
    const chosen = chooseAnnotationEvidence(
      [
        { ownerId: 7, evidence: annotation({ annotationKey: 'FIRST001', comment: 'delphi rounds' }) },
        { ownerId: 7, evidence: annotation({ annotationKey: 'SECOND01', comment: 'delphi panel' }) },
      ],
      terms,
    );
    assert.equal(chosen.get(7)?.evidence.annotationKey, 'FIRST001');
  });

  test('an annotation that holds none of the terms is not chosen', () => {
    // It can only have matched on its key or on something not counted here,
    // and showing it would explain nothing.
    const chosen = chooseAnnotationEvidence(
      [{ ownerId: 7, evidence: annotation({ comment: 'unrelated' }) }],
      keywordTerms('delphi'),
    );
    assert.equal(chosen.has(7), false);
  });

  test('papers are chosen independently', () => {
    const terms = keywordTerms('delphi');
    const chosen = chooseAnnotationEvidence(
      [
        { ownerId: 7, evidence: annotation({ annotationKey: 'PAPER007', comment: 'delphi' }) },
        { ownerId: 8, evidence: annotation({ annotationKey: 'PAPER008', comment: 'delphi' }) },
      ],
      terms,
    );
    assert.equal(chosen.get(7)?.evidence.annotationKey, 'PAPER007');
    assert.equal(chosen.get(8)?.evidence.annotationKey, 'PAPER008');
  });
});

describe('annotationWins', () => {
  const choice = { evidence: annotation(), termHits: 3 };

  test('wins over a passage that holds fewer terms', () => {
    assert.equal(annotationWins(choice, 0), true);
    assert.equal(annotationWins(choice, 2), true);
  });

  test('wins when the paper has no indexed passage at all', () => {
    assert.equal(annotationWins(choice, undefined), true);
  });

  test('a passage holding as many terms keeps its place', () => {
    // An equally covering passage from the paper is just as true and comes with
    // a page in the document.
    assert.equal(annotationWins(choice, 3), false);
    assert.equal(annotationWins(choice, 4), false);
  });
});

describe('annotationSnippet', () => {
  test('puts the comment first and quotes the passage it comments on', () => {
    assert.equal(
      annotationSnippet(annotation({ comment: ' my thought ', text: ' the passage ' })),
      'my thought\n\n“the passage”',
    );
  });

  test('a comment on its own is shown as is', () => {
    assert.equal(annotationSnippet(annotation({ comment: 'a sticky note' })), 'a sticky note');
  });

  test('a highlight with no comment is shown quoted', () => {
    assert.equal(annotationSnippet(annotation({ text: 'highlighted' })), '“highlighted”');
  });

  test('an empty annotation gives an empty excerpt', () => {
    assert.equal(annotationSnippet(annotation({ comment: '  ', text: '' })), '');
  });
});

describe('annotationPageNumber', () => {
  test('turns a PDF position into a 1-based page', () => {
    assert.equal(annotationPageNumber('{"pageIndex":41,"rects":[[1,2,3,4]]}'), 42);
    assert.equal(annotationPageNumber('{"pageIndex":0,"rects":[]}'), 1);
  });

  test('EPUB and snapshot positions have no page', () => {
    assert.equal(
      annotationPageNumber('{"type":"FragmentSelector","value":"epubcfi(/6/4!/4/2)"}'),
      undefined,
    );
    assert.equal(annotationPageNumber('{"type":"CssSelector","value":"p:nth-child(3)"}'), undefined);
  });

  test('missing or malformed positions have no page', () => {
    assert.equal(annotationPageNumber(undefined), undefined);
    assert.equal(annotationPageNumber(null), undefined);
    assert.equal(annotationPageNumber(''), undefined);
    assert.equal(annotationPageNumber('not json'), undefined);
    assert.equal(annotationPageNumber('{"pageIndex":-1}'), undefined);
    assert.equal(annotationPageNumber('{"pageIndex":"3"}'), undefined);
  });
});
