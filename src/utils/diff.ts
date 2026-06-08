/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DiffSegment {
  type: 'eq' | 'add' | 'del';
  a?: string;
  b?: string;
}

export interface DiffLine {
  type: 'eq' | 'add' | 'del' | 'modify';
  leftLineNum?: number;
  rightLineNum?: number;
  leftContent: string;
  rightContent: string;
  leftHtml?: string;
  rightHtml?: string;
}

// Myers Diff Algorithm - more efficient and accurate than basic LCS
function myersDiff<T>(a: T[], b: T[]): DiffSegment[] {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  
  const v: { [key: number]: number } = { 1: 0 };
  const trace: { [key: number]: number }[] = [];

  for (let d = 0; d <= max; d++) {
    trace.push({ ...v });
    
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      
      if (k === -d || (k !== d && v[k - 1] < v[k + 1])) {
        x = v[k + 1];
      } else {
        x = v[k - 1] + 1;
      }
      
      let y = x - k;
      
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      
      v[k] = x;
      
      if (x >= n && y >= m) {
        return backtrack(a, b, trace, d);
      }
    }
  }
  
  return backtrack(a, b, trace, max);
}

function backtrack<T>(a: T[], b: T[], trace: { [key: number]: number }[], d: number): DiffSegment[] {
  const result: DiffSegment[] = [];
  let x = a.length;
  let y = b.length;
  
  for (let depth = d; depth >= 0; depth--) {
    const v = trace[depth];
    const k = x - y;
    
    let prevK: number;
    if (k === -depth || (k !== depth && v[k - 1] < v[k + 1])) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }
    
    const prevX = v[prevK];
    const prevY = prevX - prevK;
    
    while (x > prevX && y > prevY) {
      result.unshift({ type: 'eq', a: a[x - 1] as unknown as string, b: b[y - 1] as unknown as string });
      x--;
      y--;
    }
    
    if (depth > 0) {
      if (x === prevX) {
        result.unshift({ type: 'add', b: b[y - 1] as unknown as string });
        y--;
      } else {
        result.unshift({ type: 'del', a: a[x - 1] as unknown as string });
        x--;
      }
    }
  }
  
  return result;
}

// LCS Difference Algorithm - fallback for compatibility
export function lcsDiff<T>(a: T[], b: T[]): DiffSegment[] {
  return myersDiff(a, b);
}

// Word-level diff for better inline highlighting
function wordDiff(lineA: string, lineB: string): DiffSegment[] {
  // Split by word boundaries, keeping punctuation
  const splitWords = (text: string): string[] => {
    const matches = text.match(/[\u4e00-\u9fa5]+|[a-zA-Z]+|\d+|[^\u4e00-\u9fa5a-zA-Z\d\s]+|\s+/g);
    return matches || [];
  };
  
  const wordsA = splitWords(lineA);
  const wordsB = splitWords(lineB);
  
  return myersDiff(wordsA, wordsB);
}

// Enhanced inline diff with word-level granularity
export function inlineDiff(lineA: string, lineB: string): { htmlA: string; htmlB: string } {
  const esc = (s: string) => {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  // Use word-level diff for better readability
  const diff = wordDiff(lineA, lineB);

  let htmlA = '';
  let htmlB = '';

  diff.forEach(d => {
    if (d.type === 'eq') {
      const content = esc(d.a || '');
      htmlA += content;
      htmlB += content;
    } else if (d.type === 'del') {
      htmlA += `<mark class="diff-char-del">${esc(d.a || '')}</mark>`;
    } else if (d.type === 'add') {
      htmlB += `<mark class="diff-char-add">${esc(d.b || '')}</mark>`;
    }
  });

  return { htmlA, htmlB };
}

// Compute unified diff lines with line numbers and modification detection
export function computeDiffLines(textA: string, textB: string): DiffLine[] {
  const linesA = textA.split('\n');
  const linesB = textB.split('\n');
  const lineDiff = myersDiff(linesA, linesB);

  const result: DiffLine[] = [];
  let leftLineNum = 1;
  let rightLineNum = 1;

  let i = 0;
  while (i < lineDiff.length) {
    const cur = lineDiff[i];

    if (cur.type === 'eq') {
      // Equal lines - show both with line numbers
      const content = cur.a || '';
      result.push({
        type: 'eq',
        leftLineNum: leftLineNum++,
        rightLineNum: rightLineNum++,
        leftContent: content,
        rightContent: content
      });
      i++;
    } else if (cur.type === 'del' || cur.type === 'add') {
      // Collect consecutive deletes and adds
      const deletes: string[] = [];
      const adds: string[] = [];
      
      while (i < lineDiff.length && (lineDiff[i].type === 'del' || lineDiff[i].type === 'add')) {
        if (lineDiff[i].type === 'del') {
          deletes.push(lineDiff[i].a || '');
        } else {
          adds.push(lineDiff[i].b || '');
        }
        i++;
      }
      
      // Pair up deletes and adds as modifications when counts match or are close
      const maxLen = Math.max(deletes.length, adds.length);
      
      for (let j = 0; j < maxLen; j++) {
        const hasLeft = j < deletes.length;
        const hasRight = j < adds.length;
        
        if (hasLeft && hasRight) {
          // Both exist - this is a modification
          const { htmlA, htmlB } = inlineDiff(deletes[j], adds[j]);
          result.push({
            type: 'modify',
            leftLineNum: leftLineNum++,
            rightLineNum: rightLineNum++,
            leftContent: deletes[j],
            rightContent: adds[j],
            leftHtml: htmlA,
            rightHtml: htmlB
          });
        } else if (hasLeft) {
          // Only delete
          result.push({
            type: 'del',
            leftLineNum: leftLineNum++,
            leftContent: deletes[j],
            rightContent: ''
          });
        } else {
          // Only add
          result.push({
            type: 'add',
            rightLineNum: rightLineNum++,
            leftContent: '',
            rightContent: adds[j]
          });
        }
      }
    } else {
      i++;
    }
  }

  return result;
}
