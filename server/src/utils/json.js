/**
 * Gemini usually returns clean JSON, but never assume it (section 7).
 * This pulls the first JSON object out of a response and parses it, tolerating
 * markdown fences and stray prose around the payload.
 */
export function extractJson(text) {
  if (typeof text !== 'string' || !text.trim()) return null;

  const withoutFences = text.replace(/```(?:json)?/gi, '').trim();

  const direct = tryParse(withoutFences);
  if (direct) return direct;

  const start = withoutFences.indexOf('{');
  if (start === -1) return null;

  // Walk forward tracking brace depth so nested objects survive.
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < withoutFences.length; i += 1) {
    const char = withoutFences[i];

    if (escaped) {
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if (char === '"') {
      inString = !inString;
    } else if (!inString && char === '{') {
      depth += 1;
    } else if (!inString && char === '}') {
      depth -= 1;
      if (depth === 0) {
        return tryParse(withoutFences.slice(start, i + 1));
      }
    }
  }

  return null;
}

function tryParse(candidate) {
  try {
    const parsed = JSON.parse(candidate);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}
