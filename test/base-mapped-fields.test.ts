/**
 * Item types whose title and date live under a type-specific field.
 *
 * Issue #64: a library of legal cases showed every case as "Untitled". Zotero
 * maps some type-specific fields onto its generic ones: a case keeps its name
 * in `caseName` and its date in `dateDecided`, a statute in `nameOfAct` and
 * `dateEnacted`, an email its subject in `subject`, a patent its date in
 * `issueDate`. `getField('title')` reads only the literal field, and the base
 * mapping is applied only when the third argument asks for it
 * (Zotero.Item.prototype.getField in Zotero's item.js). So for those types the
 * read came back empty, and it was not only a label: the chunker prefixes the
 * title to every chunk, so each case was embedded under the word "Untitled",
 * and auto-index refused cases outright for having no title.
 *
 * The stub item below implements that one rule of Zotero's, literal unless
 * base-mapped, and getDisplayTitle() returns what the items list shows: for a
 * common-law case Zotero appends the reporter to the case name.
 */

import './helpers/zotero-stub';
import { installZoteroStub, ZoteroStub } from './helpers/zotero-stub';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { TextExtractor, describeItem, ExtractionProgress } from '../src/core/text-extractor';
import { HybridSearchEngine, HybridSearchResult } from '../src/core/hybrid-search';
import { autoIndexManager } from '../src/core/auto-index-manager';
import { itemDate } from '../src/utils/item-metadata';

/** The base-field mappings at issue, from Zotero's schema. */
const BASE_FIELDS: Record<string, Record<string, string>> = {
  case: { title: 'caseName', date: 'dateDecided' },
  statute: { title: 'nameOfAct', date: 'dateEnacted' },
  email: { title: 'subject' },
  patent: { date: 'issueDate' },
};

/** Long enough to survive the chunker's short-text filters. */
const ABSTRACT = 'The manufacturer of a product owes a duty of care to its consumer. '.repeat(6);

const DONOGHUE = 'Donoghue v Stevenson';
const DONOGHUE_DISPLAY = 'Donoghue v Stevenson (AC)';

function zoteroItem(
  id: number,
  itemType: string,
  fields: Record<string, string>,
  displayTitle?: string,
): any {
  return {
    id,
    key: `KEY${id}`,
    libraryID: 1,
    itemType,
    parentID: false,
    getField(field: string, _unformatted?: boolean, includeBaseMapped?: boolean) {
      const mapped = includeBaseMapped ? BASE_FIELDS[itemType]?.[field] : undefined;
      return fields[mapped ?? field] ?? '';
    },
    getDisplayTitle() {
      return displayTitle ?? this.getField('title', false, true);
    },
    getCreators: () => [{ lastName: 'Atkin', creatorType: 'author' }],
    getNotes: () => [],
    getTags: () => [],
    isNote: () => false,
    isAttachment: () => false,
  };
}

function donoghue(id = 1): any {
  return zoteroItem(
    id,
    'case',
    { caseName: DONOGHUE, reporter: 'AC', dateDecided: '26 May 1932', abstractNote: ABSTRACT },
    DONOGHUE_DISPLAY,
  );
}

let stub: ZoteroStub;

beforeEach(() => {
  stub = installZoteroStub({ 'zotseek.indexNotes': false });
  stub.Libraries = {
    userLibraryID: 1,
    get: (id: number) => (id === 1 ? { libraryType: 'user' } : null),
  };
});

test('a case is indexed under its name, which prefixes every chunk', async () => {
  const extracted = await new TextExtractor().extractChunksFromItem(donoghue(), 'abstract');

  assert.ok(extracted, 'the case should produce chunks');
  assert.equal(extracted.title, DONOGHUE_DISPLAY);
  assert.ok(extracted.chunks.length > 0);
  for (const chunk of extracted.chunks) {
    assert.ok(
      chunk.text.startsWith(DONOGHUE_DISPLAY),
      `chunk should start with the case name, got: ${chunk.text.slice(0, 40)}`,
    );
  }
});

test('statutes and emails keep their names as well', async () => {
  const extractor = new TextExtractor();
  const statute = zoteroItem(2, 'statute', { nameOfAct: 'Sale of Goods Act 1979', abstractNote: ABSTRACT });
  const email = zoteroItem(3, 'email', { subject: 'Re: settlement terms', abstractNote: ABSTRACT });

  assert.equal((await extractor.extractChunksFromItem(statute, 'abstract'))?.title, 'Sale of Goods Act 1979');
  assert.equal((await extractor.extractChunksFromItem(email, 'abstract'))?.title, 'Re: settlement terms');
});

test('the batch run reports a case by its name', async () => {
  const titles: string[] = [];
  await new TextExtractor().extractChunksFromItems(
    [donoghue()],
    'abstract',
    undefined,
    (p: ExtractionProgress) => { if (p.currentTitle) titles.push(p.currentTitle); },
  );

  assert.ok(titles.includes(DONOGHUE_DISPLAY), `progress titles: ${JSON.stringify(titles)}`);
});

test('a failure report names a case by its name', () => {
  assert.match(describeItem(donoghue(260)), /Donoghue v Stevenson/);
});

test('search results show a case with its name and the year it was decided', async () => {
  stub.Items = { getAsync: async (id: number) => (id === 1 ? donoghue() : null) };
  const engine = new HybridSearchEngine({} as any);
  const result = { itemId: 1 } as HybridSearchResult;

  await (engine as any).populateItemMetadata([result]);

  assert.equal(result.title, DONOGHUE_DISPLAY);
  assert.equal(result.year, 1932);
});

test('auto-index accepts a case, and still refuses an item with no title at all', () => {
  const shouldProcess = (item: any) => (autoIndexManager as any).shouldProcess(item);

  assert.equal(shouldProcess(donoghue()), true);
  assert.equal(shouldProcess(zoteroItem(4, 'journalArticle', {})), false);
});

test('itemDate follows the mapping for every type that has one', () => {
  assert.equal(itemDate(donoghue()), '26 May 1932');
  assert.equal(itemDate(zoteroItem(5, 'statute', { dateEnacted: '1979' })), '1979');
  assert.equal(itemDate(zoteroItem(6, 'patent', { issueDate: '2001-04-03' })), '2001-04-03');
  assert.equal(itemDate(zoteroItem(7, 'journalArticle', { date: '2017' })), '2017');
});
