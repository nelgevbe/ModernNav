import { getInitials } from "./pinyinInitials";

function subsequenceScore(query: string, text: string): number {
  if (query.length === 0) return 1;
  if (text.length === 0 || query.length > text.length) return 0;

  const q = query.toLowerCase();
  const t = text.toLowerCase();

  let qi = 0;
  let ti = 0;
  let firstMatchIndex = -1;
  let contiguous = 0;
  let maxContiguous = 0;

  while (qi < q.length && ti < t.length) {
    if (q[qi] === t[ti]) {
      if (firstMatchIndex === -1) firstMatchIndex = ti;
      contiguous++;
      maxContiguous = Math.max(maxContiguous, contiguous);
      qi++;
    } else {
      contiguous = 0;
    }
    ti++;
  }

  if (qi < q.length) return 0;

  const isPrefix = firstMatchIndex === 0;
  const allContiguous = maxContiguous === q.length;

  if (isPrefix && allContiguous) return 1.0;
  if (allContiguous) return 0.7;
  if (isPrefix) return 0.6;
  return 0.4;
}

export function fuzzyMatch(query: string, text: string): { match: boolean; score: number } {
  if (query.length === 0) return { match: true, score: 1 };
  if (text.length === 0) return { match: false, score: 0 };

  const originalScore = subsequenceScore(query, text);
  const initialsScore = subsequenceScore(query, getInitials(text));

  const score = Math.max(originalScore, initialsScore);
  return { match: score > 0, score };
}
