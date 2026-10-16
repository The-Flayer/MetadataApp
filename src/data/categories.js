// The 21 official Adobe Stock category IDs, preserved from v4.0.
export const CATEGORIES = [
  { id: 1, name: 'Animals' },
  { id: 2, name: 'Buildings and Architecture' },
  { id: 3, name: 'Business' },
  { id: 4, name: 'Drinks' },
  { id: 5, name: 'The Environment' },
  { id: 6, name: 'States of Mind' },
  { id: 7, name: 'Food' },
  { id: 8, name: 'Graphic Resources' },
  { id: 9, name: 'Hobbies and Leisure' },
  { id: 10, name: 'Industry' },
  { id: 11, name: 'Landscapes' },
  { id: 12, name: 'Lifestyle' },
  { id: 13, name: 'People' },
  { id: 14, name: 'Plants and Flowers' },
  { id: 15, name: 'Culture and Religion' },
  { id: 16, name: 'Science' },
  { id: 17, name: 'Social Issues' },
  { id: 18, name: 'Sports' },
  { id: 19, name: 'Technology' },
  { id: 20, name: 'Transport' },
  { id: 21, name: 'Travel' },
];

// Adobe Stock CSV spec: the Category column must contain the category NUMBER,
// not the name. Writing the name makes Adobe silently ignore the column and fall
// back to Sensei auto-categorization.
// https://helpx.adobe.com/stock/contributor/manage-your-portfolio/csv-requirements-content.html
//   "Category | Not applicable | Enter the NUMBER of the category that best
//    describes the content."
export const CATEGORY_BY_NAME = Object.freeze(
  Object.fromEntries(CATEGORIES.map((c) => [c.name.toLowerCase(), c.id])),
);

// Name (case-insensitive) or already-numeric id -> canonical numeric id.
// Returns '' when unknown, so the CSV cell stays empty rather than emitting a
// bogus number that Adobe would reject.
export function categoryNumber(category) {
  const n = Number(category);
  if (Number.isInteger(n) && CATEGORIES.some((c) => c.id === n)) return n;
  return CATEGORY_BY_NAME[String(category ?? '').trim().toLowerCase()] ?? '';
}
