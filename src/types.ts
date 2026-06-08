/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type LayoutType = 'single' | 'dual' | 'dual-v' | 'quad';

export interface FixedTextItem {
  id: string;
  title: string;
  text: string;
}

export interface SnippetItem {
  title: string;
  text: string;
}

export interface PaneData {
  content: string;
}

export interface HistoryState {
  stack: string[];
  cursor: number;
}
