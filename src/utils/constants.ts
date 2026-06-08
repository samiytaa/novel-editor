/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FixedTextItem } from '../types';

export const FONT_FAMILIES = [
  { label: '宋体', value: '"SimSun", serif' },
  { label: '黑体', value: '"SimHei", sans-serif' },
  { label: '楷体', value: '"KaiTi", cursive' },
  { label: '仿宋', value: '"FangSong", serif' },
  { label: '微软雅黑', value: '"Microsoft YaHei", sans-serif' },
  { label: 'Georgia', value: '"Georgia", serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: '等线', value: '"DengXian", sans-serif' },
  { label: '华文楷体', value: '"STKaiti", cursive' },
  { label: '华文宋体', value: '"STSong", serif' },
  { label: '华文仿宋', value: '"STFangsong", serif' },
];

export const INITIAL_FIXED_TEXTS: FixedTextItem[] = [
  { id: 'fixed-default', title: '默认', text: '（固定文字）' }
];

export const FONT_MIN = 12;
export const FONT_MAX = 32;
export const FONT_STEP = 2;

export const STORAGE_KEY = 'novel-editor-data';
export const SNIPPET_KEY = 'novel-editor-snippets';
