/**
 * Title and date of an item, read the way Zotero itself reads them.
 *
 * Zotero maps some type-specific fields onto its generic ones: a case keeps its
 * name in `caseName` and its date in `dateDecided`, a statute in `nameOfAct` and
 * `dateEnacted`, an email its subject in `subject`, a patent its date in
 * `issueDate`. `getField('title')` and `getField('date')` read only the literal
 * field and return '' for those types; the mapping applies only when the third
 * argument asks for it. Issue #64: every case in a legal library showed as
 * "Untitled", was embedded under that word, and was refused by auto-index.
 *
 * Module-level functions, not methods: SpiderMonkey does not reliably register
 * every class method compiled into this project's esbuild IIFE bundle.
 */

/**
 * The title the Zotero items list shows. Same as the base-mapped title field,
 * except that a case gains its reporter or court ("Donoghue v Stevenson (AC)"),
 * a civil-law case without a name is described by court, date and author, and
 * an untitled letter or interview gets a placeholder such as "[Letter to X]".
 * Returns '' when the item has no title of any kind.
 */
export function itemTitle(item: any): string {
  return item.getDisplayTitle() || '';
}

/**
 * The item's date as entered, following the base mapping. Returns '' when the
 * item has no date.
 */
export function itemDate(item: any): string {
  return item.getField('date', false, true) || '';
}
