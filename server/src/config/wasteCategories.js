/**
 * The only waste categories that exist in Wasste (sections 6 and 8).
 * Gemini is never allowed to invent a new one - anything else becomes UNKNOWN.
 */
export const CATEGORIES = ['LANDFILL', 'PAPER', 'RECYCLABLE_CONTAINER', 'ORGANICS'];

export const UNKNOWN = 'UNKNOWN';

export const ALL_CATEGORIES = [...CATEGORIES, UNKNOWN];

export const CATEGORY_LABELS = {
  LANDFILL: 'Landfill',
  PAPER: 'Paper Recycling',
  RECYCLABLE_CONTAINER: 'Recyclable Containers',
  ORGANICS: 'Organics',
  UNKNOWN: 'Unknown',
};

/** Maps a category to its key inside SmartBin.wasteByCategoryKg. */
export const DISTRIBUTION_KEY = {
  LANDFILL: 'landfill',
  PAPER: 'paper',
  RECYCLABLE_CONTAINER: 'recyclableContainers',
  ORGANICS: 'organics',
};

export const DISTRIBUTION_KEYS = Object.values(DISTRIBUTION_KEY);

/** Everything that does not go to landfill counts as diverted (section 18). */
export const DIVERTED_CATEGORIES = ['PAPER', 'RECYCLABLE_CONTAINER', 'ORGANICS'];

/** Below this confidence the UI must tell the user the AI is unsure (section 28). */
export const LOW_CONFIDENCE_THRESHOLD = 0.6;

export const isValidCategory = (value) => CATEGORIES.includes(value);

/** Normalises anything Gemini returns into a category we actually support. */
export function normaliseCategory(value) {
  if (typeof value !== 'string') return UNKNOWN;
  const upper = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (isValidCategory(upper)) return upper;

  // A few forgiving aliases, still collapsing into the four real categories.
  const aliases = {
    RECYCLABLE_CONTAINERS: 'RECYCLABLE_CONTAINER',
    CONTAINER: 'RECYCLABLE_CONTAINER',
    CONTAINERS: 'RECYCLABLE_CONTAINER',
    RECYCLING: 'RECYCLABLE_CONTAINER',
    PLASTIC: 'RECYCLABLE_CONTAINER',
    GLASS: 'RECYCLABLE_CONTAINER',
    METAL: 'RECYCLABLE_CONTAINER',
    PAPER_RECYCLING: 'PAPER',
    CARDBOARD: 'PAPER',
    ORGANIC: 'ORGANICS',
    COMPOST: 'ORGANICS',
    FOOD: 'ORGANICS',
    TRASH: 'LANDFILL',
    GARBAGE: 'LANDFILL',
    WASTE: 'LANDFILL',
    GENERAL_WASTE: 'LANDFILL',
  };

  return aliases[upper] || UNKNOWN;
}
