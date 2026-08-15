import { round } from './impact.js';

/**
 * A Wasste bin has a load cell, but this prototype has no hardware, so weight
 * is estimated from the recognised object (section 11). Keeping the lookup in
 * the backend means the number is deterministic and reproducible rather than
 * something the model invents.
 */
const ITEM_WEIGHTS_KG = [
  // Landfill. Public bins receive plenty of heavy bagged and food-soaked
  // waste alongside the light packaging, which is why this stream is not the
  // featherweight one it first looks like.
  [/pet waste|dog waste/, 0.15],
  [/mixed waste bag|garbage bag|trash bag|waste bag/, 0.35],
  [/diaper/, 0.25],
  [/contaminated (takeout|food) container|greasy|food-soaked/, 0.18],
  [/styrofoam|polystyrene/, 0.04],
  [/coffee cup|paper cup|disposable cup/, 0.05],
  [/chip bag|crisp packet/, 0.01],
  [/cutlery|fork|spoon|knife/, 0.008],
  [/napkin|tissue|paper towel/, 0.005],
  [/face mask|glove/, 0.005],
  [/wrapper|plastic film|plastic bag/, 0.005],
  [/straw/, 0.002],

  // Paper
  [/pizza box/, 0.3],
  [/cardboard|corrugated|carton/, 0.15],
  [/newspaper/, 0.2],
  [/magazine|catalogue|catalog/, 0.15],
  [/paper bag/, 0.03],
  [/paper sleeve|receipt|envelope|flyer|leaflet/, 0.008],
  [/\bpaper\b/, 0.02],

  // Recyclable containers. Glass dominates this stream by weight.
  [/glass bottle|glass jar|\bglass\b/, 0.3],
  [/plastic bottle|water bottle|pet bottle|soda bottle|\bbottle\b/, 0.025],
  [/aluminium can|aluminum can|soda can|tin can|juice can|\bcan\b/, 0.015],
  [/plastic container|takeout|clamshell|tub|tray/, 0.03],

  // Organics
  [/food scraps|leftovers|food waste/, 0.15],
  [/banana peel/, 0.12],
  [/coffee grounds/, 0.06],
  [/orange peel|\bpeel\b|\brind\b/, 0.06],
  [/apple core|\bcore\b/, 0.03],
  [/fruit|vegetable|salad/, 0.08],
  [/tea bag|eggshell/, 0.005],

  [/battery|electronics|cable/, 0.05],
];

/** Fallback per category when the specific item is not in the table. */
const CATEGORY_WEIGHTS_KG = {
  LANDFILL: 0.06,
  PAPER: 0.05,
  RECYCLABLE_CONTAINER: 0.04,
  ORGANICS: 0.07,
  UNKNOWN: 0,
};

export function estimateWeightKg(item, category) {
  const name = typeof item === 'string' ? item.toLowerCase() : '';

  for (const [pattern, weight] of ITEM_WEIGHTS_KG) {
    if (pattern.test(name)) return weight;
  }

  return round(CATEGORY_WEIGHTS_KG[category] ?? 0.03, 3);
}
