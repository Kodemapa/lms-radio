/**
 * PC-PNDT Act compliance helpers (CLAUDE.md rule 1).
 *
 * The platform must never store, display or teach fetal sex determination.
 * Any imported case (JSON metadata, annotation export, dataset manifest) is
 * passed through `stripFetalSexFields` before it is persisted.
 */

const FETAL_SEX_KEY =
  /(fetal|foetal|fetus|foetus|baby|unborn|neonat\w*|infant)[\s_.-]*(sex|gender)|(sex|gender)[\s_.-]*of[\s_.-]*(the[\s_.-]*)?(fetus|foetus|baby)/i;

/** Bare `sex` / `gender` keys. In an obstetric case record these describe the fetus. */
const GENERIC_SEX_KEY = /^(sex|gender)$/i;

export interface StripOptions {
  /** Also remove bare `sex` / `gender` keys. Defaults to true for imported cases. */
  stripGenericSexKeys?: boolean;
}

export function isFetalSexKey(key: string, options: StripOptions = {}): boolean {
  const { stripGenericSexKeys = true } = options;
  const normalised = key.replace(/([a-z])([A-Z])/g, '$1_$2');
  return FETAL_SEX_KEY.test(normalised) || (stripGenericSexKeys && GENERIC_SEX_KEY.test(key));
}

export interface StripResult<T> {
  value: T;
  /** Dotted paths of every field that was removed, for the audit log. */
  removedPaths: string[];
}

/** Returns a deep copy of `input` with all fetal-sex fields removed. */
export function stripFetalSexFields<T>(input: T, options: StripOptions = {}): StripResult<T> {
  const removedPaths: string[] = [];

  const walk = (value: unknown, path: string): unknown => {
    if (Array.isArray(value)) {
      return value.map((item, index) => walk(item, `${path}[${index}]`));
    }
    if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(value)) {
        const childPath = path ? `${path}.${key}` : key;
        if (isFetalSexKey(key, options)) {
          removedPaths.push(childPath);
          continue;
        }
        out[key] = walk(child, childPath);
      }
      return out;
    }
    return value;
  };

  return { value: walk(input, '') as T, removedPaths };
}

/**
 * Phrases that indicate content about determining or disclosing fetal sex.
 * Course text matching any of these cannot be submitted for review.
 * English and Hindi; extend as regional languages are added.
 */
const FETAL_SEX_DETERMINATION_TEXT = [
  /\b(fetal|foetal|fetus|foetus|baby|unborn)['’]?s?\s+(sex|gender)\b/i,
  /\b(sex|gender)\s+(determination|identification|prediction|selection|reveal)\b/i,
  /\b(determin\w*|identif\w*|predict\w*|reveal\w*|detect\w*)\s+(the\s+)?(sex|gender)\s+of\s+(the\s+)?(fetus|foetus|baby)\b/i,
  /\b(boy|girl)\s+or\s+(boy|girl)\b/i,
  /\bgender\s+reveal\b/i,
  /लिंग\s*(जाँच|जांच|परीक्षण|निर्धारण|पता)/,
  /भ्रूण\s*(का|के)?\s*लिंग/,
];

/** Returns the phrases in `text` that breach PC-PNDT, or an empty array. */
export function findFetalSexDeterminationText(text: string): string[] {
  const hits = new Set<string>();
  for (const pattern of FETAL_SEX_DETERMINATION_TEXT) {
    const match = text.match(pattern);
    if (match) hits.add(match[0]);
  }
  return [...hits];
}
