/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DiffSegment {
  type: 'eq' | 'add' | 'del';
  a?: string;
  b?: string;
}

// LCS Difference Algorithm for Arrays/Strings
export function lcsDiff<T>(a: T[], b: T[]): DiffSegment[] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result: DiffSegment[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      result.unshift({ type: 'eq', a: a[i - 1] as unknown as string, b: b[j - 1] as unknown as string });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'add', b: b[j - 1] as unknown as string });
      j--;
    } else {
      result.unshift({ type: 'del', a: a[i - 1] as unknown as string });
      i--;
    }
  }

  return result;
}

// Word-level/character-level diff for inline difference highlighting
export function inlineDiff(lineA: string, lineB: string): { htmlA: string; htmlB: string } {
  const charsA = [...lineA];
  const charsB = [...lineB];
  const diff = lcsDiff(charsA, charsB);

  let htmlA = '';
  let htmlB = '';

  const esc = (s: string) => {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  diff.forEach(d => {
    if (d.type === 'eq') {
      htmlA += esc(d.a || '');
      htmlB += esc(d.b || '');
    } else if (d.type === 'del') {
      htmlA += `<mark class="diff-char-del">${esc(d.a || '')}</mark>`;
    } else {
      htmlB += `<mark class="diff-char-add">${esc(d.b || '')}</mark>`;
    }
  });

  return { htmlA, htmlB };
}
