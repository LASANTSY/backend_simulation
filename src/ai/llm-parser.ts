// Utilities to robustly extract JSON from LLM text that may include
// surrounding prose or markdown code fences.

export function extractJSON(text: string): string | null {
  if (!text || typeof text !== 'string') return null;
  // 1) Try triple-backtick code block with optional language (```json ... ```)
  const fencedRe = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const fenced = text.match(fencedRe);
  if (fenced && fenced[1]) {
    const candidate = fenced[1].trim();
    // if candidate contains braces, return the braces slice
    const idxA = candidate.indexOf('{');
    const idxB = candidate.lastIndexOf('}');
    if (idxA >= 0 && idxB > idxA) return candidate.substring(idxA, idxB + 1);
    return candidate;
  }

  // 2) Remove single-line markdown code fences (``` ... ``` already handled), also remove surrounding single backticks
  // Remove any surrounding single line triple-backticks without language
  const plainFenced = text.replace(/```[\s\S]*?```/g, '').trim();
  // 3) Find first '{' and last '}' in the remaining text
  const first = plainFenced.indexOf('{');
  const last = plainFenced.lastIndexOf('}');
  if (first >= 0 && last > first) {
    return plainFenced.substring(first, last + 1);
  }

  // 4) As a last resort, try to find any { ... } in the original text using a loose scan
  const open = text.indexOf('{');
  const close = text.lastIndexOf('}');
  if (open >= 0 && close > open) return text.substring(open, close + 1);

  // nothing found
  return null;
}

export default extractJSON;
