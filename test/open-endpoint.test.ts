import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildZoteroUri, parseOpenParams } from '../src/server/open-endpoint';

const parse = (query: string) => parseOpenParams(new URLSearchParams(query));

describe('parseOpenParams: annotation', () => {
  test('accepts an annotation key on a pdf target, normalised to upper case', () => {
    assert.deepEqual(parse('target=pdf&key=ATTACHKY&annotation=annotkey'), {
      target: 'pdf',
      key: 'ATTACHKY',
      library: 'user',
      page: undefined,
      annotation: 'ANNOTKEY',
    });
  });

  test('carries the page alongside the annotation', () => {
    assert.equal(parse('target=pdf&key=ATTACHKY&page=42&annotation=ANNOTKEY')?.page, 42);
  });

  test('rejects an annotation on a select target', () => {
    // Selecting an item has no reader location to apply it to.
    assert.equal(parse('target=select&key=ATTACHKY&annotation=ANNOTKEY'), null);
  });

  test('rejects anything that is not an 8-character key', () => {
    // The value is embedded in the fallback link on the result page.
    for (const bad of ['SHORT', 'TOOLONGKEY', 'ANNOT<b>', 'ANNOT%20Y']) {
      assert.equal(parse(`target=pdf&key=ATTACHKY&annotation=${bad}`), null, bad);
    }
  });

  test('an absent or empty annotation leaves the request as it was', () => {
    assert.equal(parse('target=pdf&key=ATTACHKY')?.annotation, undefined);
    assert.equal(parse('target=pdf&key=ATTACHKY&annotation=')?.annotation, undefined);
  });
});

describe('buildZoteroUri: annotation', () => {
  test('adds the annotation to the open-pdf link, after the page', () => {
    assert.equal(
      buildZoteroUri({ target: 'pdf', key: 'ATTACHKY', library: 'user', page: 42, annotation: 'ANNOTKEY' }),
      'zotero://open-pdf/library/items/ATTACHKY?page=42&annotation=ANNOTKEY',
    );
  });

  test('works without a page, as for EPUB and snapshot annotations', () => {
    assert.equal(
      buildZoteroUri({ target: 'pdf', key: 'ATTACHKY', library: 'group:12', annotation: 'ANNOTKEY' }),
      'zotero://open-pdf/groups/12/items/ATTACHKY?annotation=ANNOTKEY',
    );
  });

  test('links without an annotation are unchanged', () => {
    assert.equal(
      buildZoteroUri({ target: 'pdf', key: 'ATTACHKY', library: 'user', page: 3 }),
      'zotero://open-pdf/library/items/ATTACHKY?page=3',
    );
    assert.equal(
      buildZoteroUri({ target: 'pdf', key: 'ATTACHKY', library: 'user' }),
      'zotero://open-pdf/library/items/ATTACHKY',
    );
  });
});
