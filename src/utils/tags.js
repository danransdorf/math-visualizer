const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => (item == null ? "" : String(item).trim()))
      .filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  try {
    return Array.from(value)
      .map((item) => (item == null ? "" : String(item).trim()))
      .filter(Boolean);
  } catch {
    return [];
  }
};

/**
 * Normalize optional taxonomy metadata on a record.
 * Supports either a nested `tags` object or flat fields on the entry itself.
 *
 * Canonical keys:
 *  - subjects: array of strings
 *  - chapter: string
 *  - number: string (for catalogue/label like "3.5.4")
 */
export function normalizeTags(entry = {}) {
  if (!entry || typeof entry !== "object") return {};

  const tagSource = entry.tags && typeof entry.tags === "object" ? entry.tags : {};
  const subjects =
    tagSource.subjects ??
    tagSource.subject ??
    entry.subjects ??
    entry.subject ??
    [];
  const chapter = tagSource.chapter ?? entry.chapter;
  const number =
    tagSource.number ??
    tagSource.numbering ??
    entry.number ??
    entry.numbering ??
    entry.label;

  const normalized = {};
  const subjectList = toArray(subjects);
  if (subjectList.length) {
    normalized.subjects = Array.from(new Set(subjectList));
  }
  if (chapter !== undefined && chapter !== null) {
    const chapterText = String(chapter).trim();
    if (chapterText) normalized.chapter = chapterText;
  }
  if (number !== undefined && number !== null) {
    const numberText = String(number).trim();
    if (numberText) normalized.number = numberText;
  }
  return normalized;
}

/**
 * Return a flat, ordered list of tag items for display.
 * Order: number -> chapter -> subjects.
 */
export function tagList(entry = {}) {
  const tags = normalizeTags(entry);
  const items = [];
  if (tags.number) items.push({ kind: "number", value: tags.number });
  if (tags.chapter) items.push({ kind: "chapter", value: tags.chapter });
  if (Array.isArray(tags.subjects)) {
    tags.subjects.forEach((subject) => {
      items.push({ kind: "subject", value: subject });
    });
  }
  return items;
}
