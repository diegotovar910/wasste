/**
 * The four sub-bins, in the one order the whole app renders them in.
 *
 * The colours here mirror the validated tokens in index.css. Series colour
 * follows the category, never its rank, so a chart must never sort by value.
 */
export const CATEGORY_ORDER = ['LANDFILL', 'PAPER', 'RECYCLABLE_CONTAINER', 'ORGANICS'];

export const CATEGORIES = {
  LANDFILL: {
    key: 'landfill',
    label: 'Landfill',
    shortLabel: 'Landfill',
    color: 'var(--cat-landfill)',
    description: 'Contaminated or mixed materials that cannot reasonably be recycled.',
    examples: 'Coffee cups, wrappers, polystyrene, disposable cutlery',
  },
  PAPER: {
    key: 'paper',
    label: 'Paper Recycling',
    shortLabel: 'Paper',
    color: 'var(--cat-paper)',
    description: 'Clean paper fibre that can go straight back into the paper stream.',
    examples: 'Newspaper, cardboard, paper bags, clean paper packaging',
  },
  RECYCLABLE_CONTAINER: {
    key: 'recyclableContainers',
    label: 'Recyclable Containers',
    shortLabel: 'Containers',
    color: 'var(--cat-containers)',
    description: 'Rigid containers with real resale value at a recovery facility.',
    examples: 'Plastic bottles, cans, glass jars, recyclable plastic packaging',
  },
  ORGANICS: {
    key: 'organics',
    label: 'Organics',
    shortLabel: 'Organics',
    color: 'var(--cat-organics)',
    description: 'Compostable material for composting or anaerobic digestion.',
    examples: 'Food scraps, fruit and vegetables, coffee grounds',
  },
};

export const UNKNOWN_CATEGORY = {
  key: 'unknown',
  label: 'Unknown',
  shortLabel: 'Unknown',
  color: 'var(--text-muted)',
  description: 'The AI could not confidently match this item to a single sub-bin.',
  examples: '',
};

/** Chart-friendly list in fixed order. */
export const CATEGORY_LIST = CATEGORY_ORDER.map((category) => ({
  category,
  ...CATEGORIES[category],
}));

/** Distribution keys in the same fixed order. */
export const DISTRIBUTION_KEYS = CATEGORY_LIST.map((entry) => entry.key);

export const categoryMeta = (category) => CATEGORIES[category] || UNKNOWN_CATEGORY;

export const categoryByKey = (key) =>
  CATEGORY_LIST.find((entry) => entry.key === key) || UNKNOWN_CATEGORY;

/** Bin status presentation. Colour never carries the meaning alone - the label does. */
export const STATUS_META = {
  ACTIVE: { label: 'Active', color: 'var(--status-good)', icon: '●', note: 'Below 70% full' },
  NEEDS_ATTENTION: { label: 'Needs attention', color: 'var(--status-warning)', icon: '▲', note: '70-89% full' },
  FULL: { label: 'Full', color: 'var(--status-critical)', icon: '■', note: '90% full or more' },
  OFFLINE: { label: 'Offline', color: 'var(--status-offline)', icon: '○', note: 'No recent sensor reading' },
};

export const statusMeta = (status) => STATUS_META[status] || STATUS_META.OFFLINE;
