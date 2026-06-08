/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AlignLeft,
  Check,
  ArrowDown,
  ArrowUp,
  Book,
  Columns,
  Copy,
  Eraser,
  FileText,
  FolderPlus,
  Highlighter,
  Minus,
  Pencil,
  Pin,
  Plus,
  Replace,
  Scissors,
  Save,
  Redo2,
  Scale,
  Search,
  Settings,
  Star,
  Trash2,
  Undo2,
  X
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import {
  FixedTextItem,
  HistoryState,
  LayoutType,
  PaneData,
  SnippetItem
} from './types';

import { FONT_FAMILIES, FONT_MAX, FONT_MIN, FONT_STEP, INITIAL_FIXED_TEXTS, SNIPPET_KEY, STORAGE_KEY } from './utils/constants';
import { inlineDiff, lcsDiff } from './utils/diff';

export default function App() {
  // --- Persistent States ---
  const [layout, setLayout] = useState<LayoutType>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.layout) return data.layout;
      }
    } catch (e) { }
    return 'single';
  });

  const [fontSize, setFontSize] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.fontSize) return Number(data.fontSize);
      }
    } catch (e) { }
    return 16;
  });

  const [currentFont, setCurrentFont] = useState<string>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.fontFamily) return data.fontFamily;
      }
    } catch (e) { }
    return FONT_FAMILIES[0].value;
  });

  const [fixedTextItems, setFixedTextItems] = useState<FixedTextItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.fixedTextItems) && data.fixedTextItems.length > 0) {
          return data.fixedTextItems;
        }
      }
    } catch (e) { }
    return INITIAL_FIXED_TEXTS;
  });

  const [selectedFixedTextId, setSelectedFixedTextId] = useState<string>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.selectedFixedTextId) return data.selectedFixedTextId;
      }
    } catch (e) { }
    return 'fixed-default';
  });

  const [panes, setPanes] = useState<PaneData[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.panes) && data.panes.length > 0) {
          const arr = [...data.panes];
          while (arr.length < 4) arr.push({ content: '' });
          return arr.slice(0, 4);
        }
      }
    } catch (e) { }
    return [
      { content: '' },
      { content: '' },
      { content: '' },
      { content: '' }
    ];
  });

  const [paneTitles, setPaneTitles] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.paneTitles)) return data.paneTitles;
      }
    } catch (e) { }
    return ['正文分卷 一', '参考资料 二', '备用大纲 三', '灵感随笔 四'];
  });

  const [snippets, setSnippets] = useState<SnippetItem[]>(() => {
    try {
      const raw = localStorage.getItem(SNIPPET_KEY);
      if (raw) return JSON.parse(raw) || [];
    } catch (e) { }
    return [];
  });

  // --- UI Modals & Overlays ---
  const [searchOpen, setSearchOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fixedOpen, setFixedOpen] = useState(false);
  const [fixedEditorOpen, setFixedEditorOpen] = useState(false);
  const [snippetsOpen, setSnippetsOpen] = useState(false);

  // --- Sub-States for Modals ---
  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [searchCase, setSearchCase] = useState(false);
  const [activeMatchIdx, setActiveMatchIdx] = useState(-1);

  // Fixed text manager fields
  const [fixedTitleInput, setFixedTitleInput] = useState('');
  const [fixedContentInput, setFixedContentInput] = useState('');
  const [fixedSearchQuery, setFixedSearchQuery] = useState('');

  // --- Toast ---
  const [toastText, setToastText] = useState('');
  const [toastShow, setToastShow] = useState(false);
  const toastTimerRef = useRef<any>(null);

  const showToast = (text: string) => {
    setToastText(text);
    setToastShow(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastShow(false);
    }, 2000);
  };

  // --- Editor State & Multi-pane undo histories ---
  const [lastActivePaneIdx, setLastActivePaneIdx] = useState(0);
  const [histories, setHistories] = useState<HistoryState[]>(() => [
    { stack: [''], cursor: 0 },
    { stack: [''], cursor: 0 },
    { stack: [''], cursor: 0 },
    { stack: [''], cursor: 0 }
  ]);

  const editorRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const historyTimers = useRef<{ [key: number]: any }>({});

  // --- Scroll alignment references for Diff ---
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const isScrollingLeft = useRef(false);
  const isScrollingRight = useRef(false);

  // --- Context Menu State ---
  const [ctxMenu, setCtxMenu] = useState<{ open: boolean; x: number; y: number } | null>(null);
  const [ctxSelection, setCtxSelection] = useState('');
  const [ctxPaneIdx, setCtxPaneIdx] = useState(0);

  // --- Side Effects for Synced States ---
  useEffect(() => {
    document.documentElement.style.setProperty('--editor-font-family', currentFont);
  }, [currentFont]);

  useEffect(() => {
    document.documentElement.style.setProperty('--editor-font-size', `${fontSize}px`);
  }, [fontSize]);

  // Persist to local storage
  useEffect(() => {
    const data = {
      layout,
      dark: false, // Night mode is removed per targets
      fontSize,
      fontFamily: currentFont,
      fixedTextItems,
      selectedFixedTextId,
      panes: panes.map(p => ({ content: p.content })),
      paneTitles
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [layout, fontSize, currentFont, fixedTextItems, selectedFixedTextId, panes, paneTitles]);

  useEffect(() => {
    localStorage.setItem(SNIPPET_KEY, JSON.stringify(snippets));
  }, [snippets]);

  // Setup initial histories if non-empty on load
  useEffect(() => {
    setHistories(prev => prev.map((h, i) => ({
      stack: [panes[i].content],
      cursor: 0
    })));
  }, []);

  // Keyboard shortcut listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        showToast('存储已更新');
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        handleOpenSearch();
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setDiffOpen(false);
        setSettingsOpen(false);
        setFixedOpen(false);
        setFixedEditorOpen(false);
        setSnippetsOpen(false);
        setCtxMenu(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lastActivePaneIdx, panes, searchQuery]);

  // --- Helper to commit state manually (e.g. for format, undo, diff edits) ---
  const commitPaneValue = (paneIdx: number, val: string, updateCursor: boolean = true) => {
    setPanes(prev => {
      const next = [...prev];
      next[paneIdx] = { content: val };
      return next;
    });

    setHistories(prev => {
      const next = [...prev];
      const h = { ...next[paneIdx] };
      const newStack = h.stack.slice(0, h.cursor + 1);
      if (newStack[h.cursor] !== val) {
        newStack.push(val);
        h.stack = newStack;
        h.cursor = newStack.length - 1;
      }
      next[paneIdx] = h;
      return next;
    });
  };

  // --- Input Change with Debounced History Records ---
  const handleEditorChange = (paneIdx: number, value: string) => {
    setPanes(prev => {
      const next = [...prev];
      next[paneIdx] = { content: value };
      return next;
    });

    if (historyTimers.current[paneIdx]) {
      clearTimeout(historyTimers.current[paneIdx]);
    }

    historyTimers.current[paneIdx] = setTimeout(() => {
      setHistories(prev => {
        const next = [...prev];
        const h = { ...next[paneIdx] };
        const newStack = h.stack.slice(0, h.cursor + 1);
        if (newStack[h.cursor] !== value) {
          newStack.push(value);
          h.stack = newStack;
          h.cursor = newStack.length - 1;
        }
        next[paneIdx] = h;
        return next;
      });
    }, 400);
  };

  // Undo
  const handleUndo = (idx: number) => {
    const h = histories[idx];
    if (h.cursor <= 0) return;
    const nextCursor = h.cursor - 1;
    const val = h.stack[nextCursor];

    setPanes(prev => {
      const next = [...prev];
      next[idx] = { content: val };
      return next;
    });

    setHistories(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], cursor: nextCursor };
      return next;
    });

    setTimeout(() => {
      const el = editorRefs.current[idx];
      if (el) el.focus();
    }, 10);
  };

  // Redo
  const handleRedo = (idx: number) => {
    const h = histories[idx];
    if (h.cursor >= h.stack.length - 1) return;
    const nextCursor = h.cursor + 1;
    const val = h.stack[nextCursor];

    setPanes(prev => {
      const next = [...prev];
      next[idx] = { content: val };
      return next;
    });

    setHistories(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], cursor: nextCursor };
      return next;
    });

    setTimeout(() => {
      const el = editorRefs.current[idx];
      if (el) el.focus();
    }, 10);
  };

  // Clear Pane
  const handleClearPane = (idx: number) => {
    commitPaneValue(idx, '');
    showToast('已清空已写内容');
  };

  // Jump scroll
  const jumpToTop = (idx: number) => {
    const el = editorRefs.current[idx];
    if (el) {
      el.focus();
      el.selectionStart = el.selectionEnd = 0;
      el.scrollTop = 0;
      showToast('已跳转到顶部');
    }
  };

  const jumpToBottom = (idx: number) => {
    const el = editorRefs.current[idx];
    if (el) {
      el.focus();
      const len = el.value.length;
      el.selectionStart = el.selectionEnd = len;
      el.scrollTop = el.scrollHeight;
      showToast('已跳转到底部');
    }
  };

  // Delete around cursor
  const deleteAroundCursor = (idx: number, direction: 'before' | 'after') => {
    const el = editorRefs.current[idx];
    if (!el) {
      showToast('请先选择编辑框');
      return;
    }
    const cursor = el.selectionStart;
    const originalVal = el.value;

    if (direction === 'before') {
      if (cursor === 0) {
        showToast('光标前无文字可删除');
        return;
      }
      const newVal = originalVal.slice(cursor);
      commitPaneValue(idx, newVal);
      setTimeout(() => {
        el.selectionStart = el.selectionEnd = 0;
        el.focus();
      }, 10);
      showToast('已删除光标前所有文本');
    } else {
      if (cursor === originalVal.length) {
        showToast('光标后无文字可删除');
        return;
      }
      const newVal = originalVal.slice(0, cursor);
      commitPaneValue(idx, newVal);
      setTimeout(() => {
        el.selectionStart = el.selectionEnd = cursor;
        el.focus();
      }, 10);
      showToast('已删除光标后所有文本');
    }
  };

  // Format Paragraphs
  const handleFormatParagraphs = () => {
    let visibleIndices: number[] = [0];
    if (layout === 'dual' || layout === 'dual-v') visibleIndices = [0, 1];
    else if (layout === 'quad') visibleIndices = [0, 1, 2, 3];

    let checkChanged = false;
    setPanes(prev => {
      const next = [...prev];
      visibleIndices.forEach(idx => {
        const text = next[idx].content;
        if (!text.trim()) return;
        const formatted = text
          .split(/\n+/)
          .map(p => p.trim())
          .filter(p => p.length > 0)
          .join('\n\n');

        if (formatted !== text) {
          next[idx] = { content: formatted };
          checkChanged = true;

          // Record history stack
          setHistories(hPrev => {
            const hNext = [...hPrev];
            const h = { ...hNext[idx] };
            const newStack = h.stack.slice(0, h.cursor + 1);
            newStack.push(formatted);
            h.stack = newStack;
            h.cursor = newStack.length - 1;
            hNext[idx] = h;
            return hNext;
          });
        }
      });
      return next;
    });

    showToast('段落重新整理完成');
  };

  // --- Right Click Context Management ---
  const handleContextMenu = (e: React.MouseEvent<HTMLTextAreaElement>, paneIdx: number) => {
    e.preventDefault();
    const el = e.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selText = el.value.slice(start, end).trim();

    setCtxSelection(selText);
    setCtxPaneIdx(paneIdx);
    setLastActivePaneIdx(paneIdx);
    setCtxMenu({ open: true, x: e.clientX, y: e.clientY });
  };

  const handleSaveCtxSnippet = () => {
    if (!ctxSelection) return;
    const titleText = ctxSelection.slice(0, 12) + (ctxSelection.length > 12 ? '…' : '');
    const newItem: SnippetItem = { title: titleText, text: ctxSelection };
    setSnippets(prev => [newItem, ...prev]);
    setCtxMenu(null);
    showToast('已收藏到我的片段');
  };

  useEffect(() => {
    const handleOutsideClick = () => {
      if (ctxMenu?.open) setCtxMenu(null);
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [ctxMenu]);

  // --- Search & Replace Actions ---
  const handleOpenSearch = () => {
    const el = editorRefs.current[lastActivePaneIdx];
    if (el) {
      const selText = el.value.slice(el.selectionStart, el.selectionEnd);
      if (selText) setSearchQuery(selText);
    }
    setActiveMatchIdx(-1);
    setSearchOpen(true);
  };

  const getSearchMatches = () => {
    const text = panes[lastActivePaneIdx].content;
    if (!text || !searchQuery) return [];
    const source = searchCase ? text : text.toLowerCase();
    const needle = searchCase ? searchQuery : searchQuery.toLowerCase();

    const matches: number[] = [];
    let idx = source.indexOf(needle);
    while (idx !== -1) {
      matches.push(idx);
      idx = source.indexOf(needle, idx + needle.length);
    }
    return matches;
  };

  const findSearchMatch = (direction: 1 | -1) => {
    const el = editorRefs.current[lastActivePaneIdx];
    if (!el) {
      showToast('请先选择编辑框');
      return;
    }
    if (!searchQuery) {
      el.focus();
      return;
    }

    const matches = getSearchMatches();
    if (matches.length === 0) {
      setActiveMatchIdx(-1);
      showToast('未找到匹配词');
      return;
    }

    const cursor = direction > 0 ? el.selectionEnd : el.selectionStart;

    let nextMatchIdx = -1;
    if (direction > 0) {
      nextMatchIdx = matches.findIndex(pos => pos >= cursor);
      if (nextMatchIdx === -1) nextMatchIdx = 0;
    } else {
      const reversed = [...matches].reverse();
      const revIdx = reversed.findIndex(pos => pos < cursor);
      nextMatchIdx = revIdx === -1 ? matches.length - 1 : (matches.length - 1 - revIdx);
    }

    setActiveMatchIdx(nextMatchIdx);
    const start = matches[nextMatchIdx];
    const end = start + searchQuery.length;

    el.focus();
    el.setSelectionRange(start, end);

    // Scroll roughly to offset
    const lineIndex = el.value.slice(0, start).split('\n').length;
    el.scrollTop = Math.max(0, (lineIndex - 4) * 28);
  };

  const handleReplaceCurrent = () => {
    const el = editorRefs.current[lastActivePaneIdx];
    if (!el) {
      showToast('请选择对应编辑框');
      return;
    }
    if (!searchQuery) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = el.value.slice(start, end);

    const normSelected = searchCase ? selected : selected.toLowerCase();
    const normSearch = searchCase ? searchQuery : searchQuery.toLowerCase();

    if (normSelected !== normSearch) {
      findSearchMatch(1);
      return;
    }

    const newVal = el.value.slice(0, start) + replaceQuery + el.value.slice(end);
    commitPaneValue(lastActivePaneIdx, newVal);

    setTimeout(() => {
      el.selectionStart = el.selectionEnd = start + replaceQuery.length;
      el.focus();
      findSearchMatch(1);
    }, 10);
    showToast('替换成功');
  };

  const handleReplaceAll = () => {
    const el = editorRefs.current[lastActivePaneIdx];
    if (!el) {
      showToast('请选择编辑框');
      return;
    }
    if (!searchQuery) return;

    const flags = searchCase ? 'g' : 'gi';
    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regexp = new RegExp(escaped, flags);

    const text = el.value;
    const matchCount = (text.match(regexp) || []).length;
    if (matchCount === 0) {
      showToast('未找到匹配词');
      return;
    }

    const newVal = text.replace(regexp, replaceQuery);
    commitPaneValue(lastActivePaneIdx, newVal);
    setActiveMatchIdx(-1);
    showToast(`成功替换了 ${matchCount} 处匹配`);
  };

  // --- Fixed Text Drawer Functions ---
  const handleOpenFixedModal = () => {
    setFixedOpen(true);
  };

  const handleSelectFixedItem = (id: string) => {
    setSelectedFixedTextId(id);
  };

  const openFixedEditor = (id?: string) => {
    if (!id) {
      setSelectedFixedTextId('');
      setFixedTitleInput('');
      setFixedContentInput('');
      setFixedEditorOpen(true);
      return;
    }

    const item = fixedTextItems.find(x => x.id === id);
    if (!item) return;

    setSelectedFixedTextId(id);
    setFixedTitleInput(item.title);
    setFixedContentInput(item.text);
    setFixedEditorOpen(true);
  };

  const closeFixedEditor = () => {
    setFixedEditorOpen(false);
    setFixedTitleInput('');
    setFixedContentInput('');
  };

  const filteredFixedItems = fixedTextItems.filter(item => {
    if (!fixedSearchQuery.trim()) return true;
    return item.title.toLowerCase().includes(fixedSearchQuery.toLowerCase()) ||
      item.text.toLowerCase().includes(fixedSearchQuery.toLowerCase());
  });

  const isEditingFixedItem = !!selectedFixedTextId;
  const fixedTitleValue = fixedTitleInput.trim();
  const fixedContentValue = fixedContentInput.trim();
  const canSubmitFixedItem = !!(fixedTitleValue || fixedContentValue);

  const handleDeleteFixedItemWithId = (id: string) => {
    if (fixedTextItems.length <= 1) {
      showToast('至少保留一个固定词');
      return;
    }
    if (window.confirm(`确定要移除该固定词条吗？`)) {
      const copy = fixedTextItems.filter(x => x.id !== id);
      setFixedTextItems(copy);
      if (selectedFixedTextId === id) {
        const nextSelected = copy[0] || copy[copy.length - 1];
        setSelectedFixedTextId(nextSelected.id);
        if (fixedEditorOpen) {
          setFixedTitleInput(nextSelected.title);
          setFixedContentInput(nextSelected.text);
        }
      }
      showToast('已删除固定模板');
    }
  };

  const handleQuickInsertFixedItem = (text: string) => {
    const el = editorRefs.current[lastActivePaneIdx];
    if (!el) {
      showToast('请先选择编辑框');
      return;
    }
    if (!text) {
      showToast('模板内容为空');
      return;
    }

    const currentVal = el.value;
    const separator = currentVal && !currentVal.endsWith('\n') ? '\n' : '';
    const nextVal = currentVal + separator + text;

    commitPaneValue(lastActivePaneIdx, nextVal);

    setTimeout(() => {
      el.selectionStart = el.selectionEnd = nextVal.length;
      el.scrollTop = el.scrollHeight;
      el.focus();
    }, 10);
    showToast('已成功插入');
  };

  const handleCreateFixedItem = () => {
    if (!canSubmitFixedItem) {
      showToast('先写点标题或内容吧');
      return;
    }
    const titleText = fixedTitleInput.trim() || '新固定词';
    const contentText = fixedContentInput;
    const newItem: FixedTextItem = {
      id: `fixed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: titleText,
      text: contentText
    };

    setFixedTextItems(prev => [...prev, newItem]);
    setSelectedFixedTextId(newItem.id);
    setFixedEditorOpen(false);
    showToast('已新增固定模板');
  };

  const handleSaveFixedChanges = () => {
    if (!selectedFixedTextId) {
      handleCreateFixedItem();
      return;
    }
    if (!canSubmitFixedItem) {
      showToast('内容不能为空');
      return;
    }
    setFixedTextItems(prev => prev.map(item => {
      if (item.id === selectedFixedTextId) {
        return {
          ...item,
          title: fixedTitleInput.trim() || '未命名',
          text: fixedContentInput
        };
      }
      return item;
    }));
    setFixedEditorOpen(false);
    showToast('已保存修改');
  };

  const handleDeleteFixedItem = () => {
    if (fixedTextItems.length <= 1) {
      showToast('至少保留一个固定词');
      return;
    }
    const idx = fixedTextItems.findIndex(x => x.id === selectedFixedTextId);
    if (idx === -1) return;

    if (window.confirm(`确定要移除固定词「${fixedTextItems[idx].title}」吗？`)) {
      const itemsCopy = [...fixedTextItems];
      itemsCopy.splice(idx, 1);
      setFixedTextItems(itemsCopy);
      const nextSelected = itemsCopy[idx] || itemsCopy[idx - 1] || itemsCopy[0];
      setSelectedFixedTextId(nextSelected.id);
      setFixedTitleInput(nextSelected.title);
      setFixedContentInput(nextSelected.text);
      showToast('已删除固定模板');
    }
  };

  const handleInsertFixedText = () => {
    const el = editorRefs.current[lastActivePaneIdx];
    if (!el) {
      showToast('请先选择编辑框');
      return;
    }
    const item = fixedTextItems.find(x => x.id === selectedFixedTextId) || fixedTextItems[0];
    const textToInsert = item?.text ?? '';
    if (!textToInsert) {
      showToast('模板内容为空');
      return;
    }

    const currentVal = el.value;
    const separator = currentVal && !currentVal.endsWith('\n') ? '\n' : '';
    const nextVal = currentVal + separator + textToInsert;

    commitPaneValue(lastActivePaneIdx, nextVal);
    setFixedOpen(false);

    setTimeout(() => {
      el.selectionStart = el.selectionEnd = nextVal.length;
      el.scrollTop = el.scrollHeight;
      el.focus();
    }, 10);
    showToast('已成功插入');
  };

  // Shortcuts insert to bottom (Header button click)
  const handleQuickInsertFixed = () => {
    const el = editorRefs.current[lastActivePaneIdx];
    if (!el) {
      showToast('请先选择编辑框');
      return;
    }
    const item = fixedTextItems.find(x => x.id === selectedFixedTextId) || fixedTextItems[0];
    const textToInsert = item?.text ?? '';
    if (!textToInsert) {
      handleOpenFixedModal();
      showToast('请先配置固定内容');
      return;
    }

    const currentVal = el.value;
    const separator = currentVal && !currentVal.endsWith('\n') ? '\n' : '';
    const nextVal = currentVal + separator + textToInsert;

    commitPaneValue(lastActivePaneIdx, nextVal);

    setTimeout(() => {
      el.selectionStart = el.selectionEnd = nextVal.length;
      el.scrollTop = el.scrollHeight;
      el.focus();
    }, 10);
    showToast('已插入到编辑器末尾');
  };

  // --- Snippet panel items ---
  const handleInsertSnippet = (text: string) => {
    const el = editorRefs.current[lastActivePaneIdx];
    if (!el) {
      showToast('请先选择编辑框');
      return;
    }
    const currentVal = el.value;
    const start = el.selectionStart;
    const end = el.selectionEnd;

    const newVal = currentVal.slice(0, start) + text + currentVal.slice(end);
    commitPaneValue(lastActivePaneIdx, newVal);

    setTimeout(() => {
      el.selectionStart = el.selectionEnd = start + text.length;
      el.focus();
    }, 10);
    showToast('片断已插入');
  };

  const handleCopySnippet = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast('片断成功复制');
    });
  };

  const handleDeleteSnippet = (idx: number) => {
    setSnippets(prev => {
      const copy = [...prev];
      copy.splice(idx, 1);
      return copy;
    });
    showToast('模块片段已删除');
  };

  // --- Sync scroll diff ---
  const handleLeftScroll = () => {
    if (isScrollingRight.current) return;
    isScrollingLeft.current = true;
    const src = leftScrollRef.current;
    const dst = rightScrollRef.current;
    if (src && dst) {
      const ratio = src.scrollTop / (src.scrollHeight - src.clientHeight || 1);
      dst.scrollTop = ratio * (dst.scrollHeight - dst.clientHeight);
    }
    setTimeout(() => { isScrollingLeft.current = false; }, 50);
  };

  const handleRightScroll = () => {
    if (isScrollingLeft.current) return;
    isScrollingRight.current = true;
    const src = rightScrollRef.current;
    const dst = leftScrollRef.current;
    if (src && dst) {
      const ratio = src.scrollTop / (src.scrollHeight - src.clientHeight || 1);
      dst.scrollTop = ratio * (dst.scrollHeight - dst.clientHeight);
    }
    setTimeout(() => { isScrollingRight.current = false; }, 50);
  };

  // Build reactive list of diff elements
  const { left: diffLeftLines, right: diffRightLines } = getDiffLines();

  function getDiffLines() {
    const textA = panes[0].content;
    const textB = panes[1].content;
    const linesA = textA.split('\n');
    const linesB = textB.split('\n');
    const lineDiffResult = lcsDiff(linesA, linesB);

    const fLeft: { html: string; cls: string }[] = [];
    const fRight: { html: string; cls: string }[] = [];

    let k = 0;
    while (k < lineDiffResult.length) {
      const cur = lineDiffResult[k];
      const next = lineDiffResult[k + 1];

      if (cur.type === 'del' && next && next.type === 'add') {
        const rawA = cur.a || '';
        const rawB = next.b || '';
        const { htmlA, htmlB } = inlineDiff(rawA, rawB);
        fLeft.push({ html: htmlA || '&nbsp;', cls: 'diff-del' });
        fRight.push({ html: htmlB || '&nbsp;', cls: 'diff-add' });
        k += 2;
      } else if (cur.type === 'eq') {
        const escVal = (cur.a || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        fLeft.push({ html: escVal || '&nbsp;', cls: 'diff-eq' });
        fRight.push({ html: escVal || '&nbsp;', cls: 'diff-eq' });
        k++;
      } else if (cur.type === 'del') {
        const escVal = (cur.a || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        fLeft.push({ html: escVal || '&nbsp;', cls: 'diff-del' });
        fRight.push({ html: '&nbsp;', cls: 'diff-placeholder' });
        k++;
      } else {
        const escVal = (cur.b || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        fLeft.push({ html: '&nbsp;', cls: 'diff-placeholder' });
        fRight.push({ html: escVal || '&nbsp;', cls: 'diff-add' });
        k++;
      }
    }
    return { left: fLeft, right: fRight };
  }

  // --- Layout configurations ---
  const isPaneVisible = (idx: number) => {
    if (layout === 'single') return idx === 0;
    if (layout === 'dual' || layout === 'dual-v') return idx === 0 || idx === 1;
    return true;
  };

  const getContainerClass = () => {
    switch (layout) {
      case 'single':
        return 'grid grid-cols-1 grid-rows-1 h-[calc(100vh-var(--toolbar-h))] p-0 gap-2';
      case 'dual':
        return 'grid grid-cols-2 grid-rows-1 h-[calc(100vh-var(--toolbar-h))] p-0 gap-2';
      case 'dual-v':
        return 'grid grid-cols-1 grid-rows-2 h-[calc(100vh-var(--toolbar-h))] p-0 gap-2';
      case 'quad':
        return 'grid grid-cols-2 grid-rows-2 h-[calc(100vh-var(--toolbar-h))] p-0 gap-2';
    }
  };

  const getWordCount = (text: string) => {
    if (!text) return 0;
    // accurate chinese standard word character counting
    return text.replace(/\s+/g, '').length;
  };

  return (
    <div id="app" className="flex flex-col h-screen overflow-hidden bg-[var(--bg)]">
      {/* --- Toolbar / Header --- */}
      <header className="flex items-center justify-between px-6 h-[var(--toolbar-h)] bg-[var(--toolbar-bg)] border-b border-[var(--toolbar-bg-strong)] text-[var(--toolbar-text)] shadow-sm z-40 select-none">
        <div className="flex items-center gap-3">
          <Book className="w-5 h-5 text-[var(--text-muted)]" />
          <span className="font-serif font-black text-lg tracking-widest text-[var(--toolbar-text)]">小说编辑器</span>
        </div>

        {/* Layout select handles */}
        <div className="flex items-center gap-1 bg-[var(--toolbar-bg-strong)] p-1 rounded-lg border border-white/10">
          <button
            onClick={() => setLayout('single')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-serif font-bold rounded-md transition-all cursor-pointer ${layout === 'single' ? 'bg-[var(--accent)] text-white shadow-inner scale-102 font-bold' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
          >
            <Columns className="w-3.5 h-3.5 rotate-90" />
            <span>单栏</span>
          </button>
          <button
            onClick={() => setLayout('dual')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-serif font-bold rounded-md transition-all cursor-pointer ${layout === 'dual' ? 'bg-[var(--accent)] text-white shadow-inner scale-102 font-bold' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>左右</span>
          </button>
          <button
            onClick={() => setLayout('dual-v')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-serif font-bold rounded-md transition-all cursor-pointer ${layout === 'dual-v' ? 'bg-[var(--accent)] text-white shadow-inner scale-102 font-bold' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
          >
            <Columns className="w-3.5 h-3.5 rotate-180" />
            <span>上下</span>
          </button>
          <button
            onClick={() => setLayout('quad')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-serif font-bold rounded-md transition-all cursor-pointer ${layout === 'quad' ? 'bg-[var(--accent)] text-white shadow-inner scale-102 font-bold' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
          >
            <Columns className="w-3.5 h-3.5 max-w-none grid grid-cols-2" />
            <span>四栏</span>
          </button>
        </div>

        {/* Global Toolbar buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenSearch}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs text-[var(--text)] bg-[var(--surface-soft)] hover:bg-[var(--surface-strong)] border border-[var(--border)] hover:border-[var(--border-strong)] rounded-lg transition-all cursor-pointer font-serif font-medium"
            title="搜索替换 (Ctrl+F)"
          >
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span>搜索</span>
          </button>
          <button
            onClick={() => {
              if (fixedOpen) {
                setFixedOpen(false);
              } else {
                handleOpenFixedModal();
              }
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs border rounded-lg transition-all cursor-pointer font-serif font-medium ${fixedOpen
                ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-inner font-bold'
                : 'text-[var(--text)] bg-[var(--surface-soft)] hover:bg-[var(--surface-strong)] border border-[var(--border)] hover:border-[var(--border-strong)]'
              }`}
            title="常用固定段落与词条管理"
          >
            <FileText className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span>词条</span>
          </button>
          <button
            onClick={() => setSnippetsOpen(prev => !prev)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs border rounded-lg transition-all cursor-pointer font-serif font-medium ${snippetsOpen
                ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-inner font-bold'
                : 'text-[var(--text)] bg-[var(--surface-soft)] hover:bg-[var(--surface-strong)] border border-[var(--border)] hover:border-[var(--border-strong)]'
              }`}
          >
            <Star className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span>摘录</span>
          </button>
          <button
            onClick={handleFormatParagraphs}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs text-[var(--text)] bg-[var(--surface-soft)] hover:bg-[var(--surface-strong)] border border-[var(--border)] hover:border-[var(--border-strong)] rounded-lg transition-all cursor-pointer font-serif font-medium"
          >
            <AlignLeft className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span>整理</span>
          </button>
          <button
            onClick={() => setDiffOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs text-[var(--text)] bg-[var(--surface-soft)] hover:bg-[var(--surface-strong)] border border-[var(--border)] hover:border-[var(--border-strong)] rounded-lg transition-all cursor-pointer font-serif font-medium"
          >
            <Scale className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span>对比</span>
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-soft)] rounded-lg transition-all cursor-pointer ml-1 border border-transparent hover:border-[var(--border)]"
            title="排版与设定"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* --- Main Stages / Editors Layout --- */}
      <main className={getContainerClass()}>
        {panes.map((pane, i) => (
          <div
            key={i}
            id={`pane-${i + 1}`}
            onClick={() => setLastActivePaneIdx(i)}
            className={`pane ${isPaneVisible(i) ? 'flex' : 'hidden'
              } flex-col relative bg-[var(--surface)] border border-[var(--border)] overflow-hidden shadow-sm transition-all duration-300 focus-within:border-[var(--border-strong)] focus-within:shadow-[0_16px_40px_rgba(34,36,40,0.08)]`}
          >
            {/* Editable Field with custom padding to avoid overlapping the bottom pills */}
            <textarea
              ref={el => { editorRefs.current[i] = el; }}
              className="editor flex-1 min-h-0 border-none outline-none resize-none px-6 pt-6 pb-20 font-serif leading-loose outline-0 shadow-inner bg-transparent text-[var(--text)] placeholder:text-violet-300"
              placeholder="落笔流云，妙笔生花..."
              value={pane.content}
              onChange={e => handleEditorChange(i, e.target.value)}
              onContextMenu={e => handleContextMenu(e, i)}
              style={{
                fontFamily: currentFont,
                fontSize: `${fontSize}px`
              }}
            />

            {/* Subtle word count (absolute bottom left) */}
            <div className="absolute bottom-5 left-6 select-none text-[11px] font-medium text-[var(--text-muted)]/80">
              <span className="font-mono tracking-[0.08em]">{getWordCount(pane.content)} 字</span>
            </div>

            {/* Individual actions (absolute bottom right) */}
            <div className="pane-actions absolute bottom-4 right-4 flex items-center gap-1 px-1.5 py-1 bg-[var(--surface)]/92 backdrop-blur-md border border-[var(--border)] rounded-full shadow-sm select-none opacity-45 hover:opacity-100 transition-opacity duration-200 text-[var(--text-muted)]">
              <button
                onClick={() => handleUndo(i)}
                disabled={histories[i]?.cursor <= 0}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--accent)] disabled:opacity-25 transition-colors rounded-full cursor-pointer"
                title="上一步 (Undo)"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleRedo(i)}
                disabled={histories[i]?.cursor >= histories[i]?.stack.length - 1}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--accent)] disabled:opacity-25 transition-colors rounded-full cursor-pointer"
                title="下一步 (Redo)"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
              <div className="w-px h-3 bg-[var(--border)] mx-0.5" />
              <button
                onClick={() => jumpToTop(i)}
                className="p-1 hover:text-[var(--accent)] transition-all rounded-full cursor-pointer"
                title="回到顶端"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => jumpToBottom(i)}
                className="p-1 hover:text-[var(--accent)] transition-all rounded-full cursor-pointer"
                title="跳转至尾部"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <div className="w-px h-3 bg-[var(--border)] mx-0.5" />
              <button
                onClick={() => {
                  setLastActivePaneIdx(i);
                  setFixedOpen(true);
                }}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors rounded-full font-bold cursor-pointer"
                title="打开固定词词条面板"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleClearPane(i)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-red-50 transition-all rounded-full cursor-pointer"
                title="清空当前写作"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </main>

      {/* --- Overlay Modules --- */}

      {/* TOAST PANEL */}
      <div
        id="toast"
        className={`toast fixed bottom-6 left-1/2 -translate-x-1/2 text-sm bg-[var(--toolbar-bg)] text-[var(--toolbar-text)] px-5 py-2.5 rounded-full shadow-lg border border-white/10 tracking-wider z-50 pointer-events-none transition-all duration-300 ${toastShow ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
      >
        {toastText}
      </div>

      {/* SEARCH AND REPLACE OVERLAY */}
      {searchOpen && (
        <>
          <div
            className="fixed inset-0 bg-[rgba(244,244,241,0.82)] backdrop-blur-[2px] z-40"
            onClick={() => setSearchOpen(false)}
          />
          <div className="modal search-modal fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] bg-[var(--surface)] border border-[var(--border)] shadow-xl rounded-xl z-50 overflow-hidden flex flex-col">
            <div className="modal-header flex items-center justify-between px-5 h-12 bg-[var(--surface-soft)] border-b border-[var(--border)]">
              <span className="flex items-center gap-2 font-serif font-bold text-xs tracking-widest text-[var(--text)]">
                <Search className="w-3.5 h-3.5 text-[var(--accent)]" />
                搜索替换工具
              </span>
              <button onClick={() => setSearchOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="search-body p-5 flex flex-col gap-4">
              <div className="search-row grid grid-cols-[54px_1fr] items-center gap-3">
                <label className="text-xs font-serif text-[var(--text-muted)] font-medium">查 找</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setActiveMatchIdx(-1);
                  }}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-white text-[var(--text)] text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/25"
                  placeholder="要检索的词..."
                  autoFocus
                />
              </div>
              <div className="search-row grid grid-cols-[54px_1fr] items-center gap-3">
                <label className="text-xs font-serif text-[var(--text-muted)] font-medium">替 换</label>
                <input
                  type="text"
                  value={replaceQuery}
                  onChange={e => setReplaceQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-white text-[var(--text)] text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/25"
                  placeholder="替换后的内容..."
                />
              </div>

              <div className="search-options flex items-center justify-between pl-[66px] text-xs">
                <label className="check-row flex items-center gap-2 text-[var(--text-muted)] select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={searchCase}
                    onChange={e => {
                      setSearchCase(e.target.checked);
                      setActiveMatchIdx(-1);
                    }}
                    className="accent-[var(--accent)] rounded border-[var(--border)]"
                  />
                  <span>区分大小写</span>
                </label>
                <span className="search-count font-mono text-[var(--text-muted)]/80">
                  {searchQuery ? `${activeMatchIdx >= 0 ? activeMatchIdx + 1 : 0}/${getSearchMatches().length}` : '0/0'}
                </span>
              </div>

              <div className="search-actions grid grid-cols-4 gap-2 pl-[66px] mt-2">
                <button
                  onClick={() => findSearchMatch(-1)}
                  className="px-2 py-2 text-xs font-serif font-medium bg-[var(--surface-soft)] hover:bg-[var(--surface-strong)] text-[var(--text)] border border-[var(--border)] rounded-lg transition-all"
                >
                  上一个
                </button>
                <button
                  onClick={() => findSearchMatch(1)}
                  className="px-2 py-2 text-xs font-serif font-medium bg-[var(--surface-soft)] hover:bg-[var(--surface-strong)] text-[var(--text)] border border-[var(--border)] rounded-lg transition-all"
                >
                  下一个
                </button>
                <button
                  onClick={handleReplaceCurrent}
                  className="px-2 py-2 text-xs font-serif font-medium bg-[var(--surface-soft)] hover:bg-[var(--surface-strong)] text-[var(--text)] border border-[var(--border)] rounded-lg transition-all"
                >
                  替 换
                </button>
                <button
                  onClick={handleReplaceAll}
                  className="px-2 py-2 text-xs font-serif font-medium bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white rounded-lg shadow-sm hover:shadow transition-all"
                >
                  全部替换
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* TEXT COMPARE DIFF OVERLAY */}
      {diffOpen && (
        <>
          <div
            className="fixed inset-0 bg-[rgba(244,244,241,0.82)] backdrop-blur-[2px] z-45"
            onClick={() => setDiffOpen(false)}
          />
          <div className="modal diff-modal fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-[1080px] h-[80vh] bg-[var(--surface)] border border-[var(--border)] shadow-2xl rounded-xl z-50 overflow-hidden flex flex-col">
            <div className="modal-header flex items-center justify-between px-6 h-12 bg-[var(--surface-soft)] border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-[var(--accent)]" />
                <span className="font-serif font-bold text-xs tracking-widest text-[var(--text)]">
                  栏一与栏二排版文本对照比对
                </span>
              </div>
              <button onClick={() => setDiffOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="diff-body flex flex-1 overflow-hidden">
              <div className="diff-col flex-1 flex flex-col overflow-hidden">
                <div className="diff-col-title px-5 py-2 text-xs font-serif text-[var(--text-muted)] font-bold bg-[var(--surface-soft)] border-b border-[var(--border)]">
                  栏一内容
                </div>
                <div
                  ref={leftScrollRef}
                  onScroll={handleLeftScroll}
                  className="diff-content flex-1 overflow-y-auto px-6 py-5 font-serif text-sm leading-relaxed whitespace-pre-wrap select-text selection:bg-[var(--accent-soft)]"
                >
                  {diffLeftLines.map((line, idx) => (
                    <span
                      key={idx}
                      className={`diff-line block px-1.5 py-0.5 rounded ${line.cls}`}
                      dangerouslySetInnerHTML={{ __html: line.html }}
                    />
                  ))}
                </div>
              </div>

              <div className="diff-divider w-px bg-[var(--border)] self-stretch" />

              <div className="diff-col flex-1 flex flex-col overflow-hidden">
                <div className="diff-col-title px-5 py-2 text-xs font-serif text-[var(--text-muted)] font-bold bg-[var(--surface-soft)] border-b border-[var(--border)]">
                  栏二内容
                </div>
                <div
                  ref={rightScrollRef}
                  onScroll={handleRightScroll}
                  className="diff-content flex-1 overflow-y-auto px-6 py-5 font-serif text-sm leading-relaxed whitespace-pre-wrap select-text selection:bg-[var(--accent-soft)]"
                >
                  {diffRightLines.map((line, idx) => (
                    <span
                      key={idx}
                      className={`diff-line block px-1.5 py-0.5 rounded ${line.cls}`}
                      dangerouslySetInnerHTML={{ __html: line.html }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* SETTINGS OVERLAY */}
      {settingsOpen && (
        <>
          <div
            className="fixed inset-0 bg-[rgba(244,244,241,0.82)] backdrop-blur-[2px] z-40"
            onClick={() => setSettingsOpen(false)}
          />
          <div className="modal fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] bg-[var(--surface)] border border-[var(--border)] shadow-xl rounded-xl z-50 overflow-hidden flex flex-col">
            <div className="modal-header flex items-center justify-between px-5 h-12 bg-[var(--surface-soft)] border-b border-[var(--border)]">
              <span className="flex items-center gap-2 font-serif font-bold text-xs tracking-widest text-[var(--text)]">
                <Settings className="w-3.5 h-3.5 text-[var(--accent)]" />
                排版设定
              </span>
              <button onClick={() => setSettingsOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="modal-body p-6 flex flex-col gap-6 bg-[var(--surface)]">
              {/* Font Family selection */}
              <div className="setting-row flex items-center gap-4">
                <label className="text-xs font-serif text-[var(--text-muted)] font-bold w-12 flex-shrink-0">字 体</label>
                <select
                  value={currentFont}
                  onChange={e => setCurrentFont(e.target.value)}
                  className="flex-1 px-3 py-2 border border-[var(--border)] rounded-lg bg-white text-[var(--text)] text-sm focus:outline-none focus:border-[var(--accent)] cursor-pointer"
                >
                  {FONT_FAMILIES.map(font => (
                    <option key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Font size selectors */}
              <div className="setting-row flex items-center gap-4">
                <label className="text-xs font-serif text-[var(--text-muted)] font-bold w-12 flex-shrink-0">字 号</label>
                <div className="font-size-ctrl flex items-center gap-4 px-3 py-1 bg-white border border-[var(--border)] rounded-lg">
                  <button
                    onClick={() => setFontSize(size => Math.max(FONT_MIN, size - FONT_STEP))}
                    disabled={fontSize <= FONT_MIN}
                    className="font-bold text-[var(--text-muted)] hover:text-[var(--accent)] disabled:opacity-30 p-1 cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span id="font-size-label" className="text-sm font-serif font-bold w-12 text-center text-[var(--text)]">
                    {fontSize}px
                  </span>
                  <button
                    onClick={() => setFontSize(size => Math.min(FONT_MAX, size + FONT_STEP))}
                    disabled={fontSize >= FONT_MAX}
                    className="font-bold text-[var(--text-muted)] hover:text-[var(--accent)] disabled:opacity-30 p-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Fixed template selector and manager trigger */}
              <div className="setting-row flex items-center gap-4">
                <label className="text-xs font-serif text-[var(--text-muted)] font-bold w-12 flex-shrink-0">固 定</label>
                <div className="fixed-setting flex flex-1 gap-2">
                  <select
                    value={selectedFixedTextId}
                    onChange={e => setSelectedFixedTextId(e.target.value)}
                    className="flex-1 px-3 py-2 border border-[var(--border)] rounded-lg bg-white text-[var(--text)] text-sm focus:outline-none focus:border-[var(--accent)] cursor-pointer"
                  >
                    {fixedTextItems.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      setSettingsOpen(false);
                      handleOpenFixedModal();
                    }}
                    className="px-4 py-1 text-xs font-serif font-medium bg-[var(--surface-soft)] hover:bg-[var(--surface-strong)] text-[var(--text)] border border-[var(--border)] rounded-lg transition-all cursor-pointer"
                  >
                    管理
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* FIXED TEXT LIST MANAGEMENT MODAL (POP-UP) */}
      {fixedOpen && (
        <>
          <div
            className="fixed inset-0 bg-[rgba(244,244,241,0.88)] backdrop-blur-[3px] z-[100] transition-opacity"
            onClick={() => setFixedOpen(false)}
          />
            <div className="fixed-modal fixed top-1/2 left-1/2 w-[90vw] max-w-2xl h-[560px] max-h-[82vh] bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col z-[101] overflow-hidden animate-modal-zoom-in">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 h-[var(--toolbar-h)] bg-[var(--surface-soft)] border-b border-separate border-[var(--border)] select-none">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-5 h-5 text-[var(--accent)]" />
                  <Pin className="w-4 h-4 text-[var(--accent)]" />
                  <span className="font-serif font-black text-base tracking-wider text-[var(--text)]">常用词条</span>
                </div>
              <button
                onClick={() => setFixedOpen(false)}
                className="p-1 px-3.5 rounded-lg hover:bg-[var(--surface-strong)] text-[var(--text-muted)] hover:text-[var(--text)] transition-all text-xs font-serif cursor-pointer flex items-center gap-1.5"
                title="关闭词条窗口"
              >
                <span>收起</span>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden bg-[var(--surface-soft)]/50">
                {/* Quick Search */}
                <div className="p-3 bg-[var(--surface)] border-b border-[var(--border)] flex gap-2">
                  <input
                    type="text"
                    value={fixedSearchQuery}
                    onChange={e => setFixedSearchQuery(e.target.value)}
                    placeholder="搜索保存的词条或模板..."
                    className="w-full px-3 py-1.5 text-xs border border-[var(--border)] bg-white text-[var(--text)] focus:outline-none focus:border-[var(--accent)] rounded-lg shadow-xs font-serif"
                  />
                  <button
                    onClick={() => openFixedEditor()}
                    className="shrink-0 px-3 py-1.5 text-xs font-serif font-medium bg-[var(--surface-soft)] hover:bg-[var(--surface-strong)] text-[var(--text)] border border-[var(--border)] rounded-lg transition-all cursor-pointer flex items-center gap-1"
                    title="打开新建词条弹窗"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>新建</span>
                  </button>
                </div>

                {/* List Container */}
                <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                  {filteredFixedItems.length === 0 ? (
                    <div className="text-center font-serif text-xs leading-loose text-[var(--text-muted)] py-16 border border-dashed border-[var(--border)] bg-white rounded-xl">
                      没有匹配词条<br />
                      <span className="text-[10px] text-[var(--text-muted)]/75">试试换个关键词，或直接新建一条。</span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {filteredFixedItems.map(item => (
                        <div
                          key={item.id}
                          onClick={() => handleSelectFixedItem(item.id)}
                          className={`group p-3 border rounded-lg text-left transition-all cursor-pointer relative ${item.id === selectedFixedTextId
                              ? 'bg-[var(--accent-soft)] border-[var(--border-strong)] text-[var(--text)] shadow-sm ring-1 ring-[var(--border-strong)]/35'
                              : 'bg-white/80 border-[var(--border)] text-[var(--text)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]'
                            }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <span className="text-xs font-serif font-black truncate max-w-[140px] block" title={item.title}>
                              {item.title}
                            </span>
                            <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => openFixedEditor(item.id)}
                                className="px-2 py-0.5 text-[10px] font-serif bg-[var(--surface-soft)] hover:bg-[var(--surface-strong)] text-[var(--text)] font-medium rounded border border-[var(--border)] transition-colors cursor-pointer"
                                title="编辑词条"
                              >
                                编辑
                              </button>
                              <button
                                onClick={() => handleQuickInsertFixedItem(item.text)}
                                className="px-2 py-0.5 text-[10px] font-serif bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white font-medium rounded transition-colors cursor-pointer"
                                title="一键插入此词条"
                              >
                                插入
                              </button>
                              <button
                                onClick={() => handleDeleteFixedItemWithId(item.id)}
                                className="p-1 text-[var(--text-muted)] hover:text-[var(--danger)] rounded transition-colors cursor-pointer"
                                title="删除词条"
                              >
                                <Trash2 className="w-3.5 h-3.5 animate-none shrink-0" />
                              </button>
                            </div>
                          </div>
                          <p className="text-[11px] text-[var(--text-muted)] line-clamp-2 leading-relaxed whitespace-pre-wrap font-serif">
                            {item.text || '暂无内容'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
            </div>
          </div>
        </>
      )}

      {fixedEditorOpen && (
        <>
          <div
            className="fixed inset-0 bg-[rgba(244,244,241,0.88)] backdrop-blur-[3px] z-[110] transition-opacity"
            onClick={closeFixedEditor}
          />
          <div className="fixed top-1/2 left-1/2 w-[88vw] max-w-xl max-h-[78vh] bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col z-[111] overflow-hidden animate-modal-zoom-in">
            <div className="flex items-center justify-between px-5 h-14 bg-[var(--surface-soft)] border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-[var(--accent)]" />
                <span className="text-sm font-serif font-black text-[var(--text)]">
                  {isEditingFixedItem ? '编辑词条' : '新建词条'}
                </span>
              </div>
              <button
                onClick={closeFixedEditor}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
                title="关闭编辑弹窗"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 overflow-y-auto">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                <span className="text-[10px] font-serif text-[var(--text-muted)]">
                  {isEditingFixedItem ? '保存后会覆盖当前词条。' : '创建后会自动选中这张词条。'}
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-[var(--text-muted)] font-bold font-serif">标题</label>
                <input
                  type="text"
                  value={fixedTitleInput}
                  onChange={e => setFixedTitleInput(e.target.value)}
                  placeholder="例如：角色设定、招式、地点"
                  className="w-full px-3 py-2 text-sm border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text)] rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20 font-serif"
                />
              </div>

              <div className="flex flex-col gap-1.5 min-h-[260px]">
                <label className="text-[11px] text-[var(--text-muted)] font-bold font-serif">内容</label>
                <textarea
                  value={fixedContentInput}
                  onChange={e => setFixedContentInput(e.target.value)}
                  placeholder="输入要反复调用的设定、描写或预设文本"
                  className="w-full min-h-[260px] px-3 py-2.5 text-sm border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text)] rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20 font-serif leading-relaxed resize-y"
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-[var(--border)] bg-[var(--surface)] flex items-center justify-end gap-3 flex-wrap">
              {isEditingFixedItem && (
                <button
                  onClick={handleCreateFixedItem}
                  disabled={!canSubmitFixedItem}
                  className="py-2 px-4 transition-all duration-150 text-xs font-serif font-black bg-[var(--surface-soft)] hover:bg-[var(--surface-strong)] text-[var(--text)] rounded-lg border border-[var(--border)] cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="按当前输入另存为新词条"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>另存为新词条</span>
                </button>
              )}
              <button
                onClick={handleSaveFixedChanges}
                className="min-w-[160px] py-2 px-4 transition-all duration-150 text-xs font-serif font-black bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white rounded-lg shadow-xs cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!canSubmitFixedItem}
                title={isEditingFixedItem ? '保存修改' : '创建新词条'}
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isEditingFixedItem ? '保存修改' : '创建词条'}</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* SNIPPETS RIGHT HAND SLIDE DRAWER */}
      {snippetsOpen && (
        <>
          <div
            className="fixed inset-0 bg-[rgba(244,244,241,0.82)] backdrop-blur-[2px] z-40"
            onClick={() => setSnippetsOpen(false)}
          />
          <div className="snippet-panel fixed top-0 right-0 w-[320px] h-full bg-[var(--surface)] border-l border-[var(--border)] shadow-2xl flex flex-col z-50 transform translate-x-0 transition-transform duration-300">
            <div className="snippet-panel-header flex items-center justify-between px-5 h-[var(--toolbar-h)] bg-[var(--surface-soft)] border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-[var(--accent)] fill-[var(--accent)]" />
                <span className="font-serif font-bold text-xs tracking-widest text-[var(--text)]">摘录</span>
              </div>
              <button onClick={() => setSnippetsOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="snippet-list flex-1 overflow-y-auto p-4 flex flex-col gap-3.5 bg-[var(--surface)]">
              {snippets.length === 0 ? (
                <div className="snippet-empty text-center font-serif text-xs leading-loose text-[var(--text-muted)] py-16">
                  明珠未拾，瑶草初生<br />
                  <span className="text-[10px] text-[var(--text-muted)]/75">（目前没有已收藏的佳句）</span>
                </div>
              ) : (
                snippets.map((item, idx) => (
                  <div
                    key={idx}
                    className="snippet-item border border-[var(--border)] rounded-xl bg-[var(--surface)] overflow-hidden shadow-xs hover:shadow-sm"
                  >
                    <div className="snippet-item-header flex items-center justify-between px-3 py-2 bg-[var(--surface-soft)] border-b border-[var(--border)]">
                      <input
                        type="text"
                        value={item.title}
                        onChange={e => {
                          const val = e.target.value;
                          setSnippets(prev => {
                            const copy = [...prev];
                            copy[idx] = { ...copy[idx], title: val };
                            return copy;
                          });
                        }}
                        className="snippet-item-title text-xs font-serif font-bold text-[var(--text)] border-b border-transparent hover:border-[var(--border-strong)] focus:border-[var(--accent)] focus:outline-none transition-all py-0.5 bg-transparent min-w-0"
                      />
                      <div className="snippet-item-actions flex items-center gap-0.5">
                        <button
                          onClick={() => handleInsertSnippet(item.text)}
                          className="px-1.5 py-0.5 text-[10px] font-serif text-[var(--accent)] hover:bg-[var(--accent-soft)] rounded cursor-pointer"
                          title="在光标处插入"
                        >
                          插入
                        </button>
                        <button
                          onClick={() => handleCopySnippet(item.text)}
                          className="px-1.5 py-0.5 text-[10px] font-serif text-[var(--text-muted)] hover:bg-[var(--surface-soft)] rounded cursor-pointer flex items-center gap-1"
                          title="复制到剪切板"
                        >
                          <Copy className="w-3 h-3" />
                          复制
                        </button>
                        <button
                          onClick={() => handleDeleteSnippet(idx)}
                          className="px-1.5 py-0.5 text-[10px] text-[var(--danger)] hover:bg-red-50 rounded cursor-pointer"
                          title="删除"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="snippet-item-body max-h-[140px] overflow-y-auto p-3 text-xs font-serif leading-relaxed text-[var(--text)] whitespace-pre-wrap select-text">
                      {item.text}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* CUSTOM CONTEXT RIGHT CLICK MENU */}
      {ctxMenu?.open && (
        <ul
          id="ctx-menu"
          className="ctx-menu fixed z-50 bg-[var(--surface)] border border-[var(--border)] shadow-lg rounded-[calc(var(--radius)-2px)] py-1.5 min-width-[180px]"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          <li
            id="ctx-delete-before"
            onClick={() => {
              deleteAroundCursor(ctxPaneIdx, 'before');
              setCtxMenu(null);
            }}
            className={`ctx-menu-item flex items-center justify-between px-4 py-2 text-xs font-serif ${editorRefs.current[ctxPaneIdx]?.selectionStart === 0
                ? 'opacity-30 pointer-events-none'
                : 'hover:bg-[var(--surface-soft)] text-[var(--text)] hover:text-[var(--accent)]'
              } cursor-pointer`}
          >
            <span className="flex items-center gap-2"><Scissors className="w-3.5 h-3.5" />删除光标前文本</span>
          </li>
          <li
            id="ctx-delete-after"
            onClick={() => {
              deleteAroundCursor(ctxPaneIdx, 'after');
              setCtxMenu(null);
            }}
            className={`ctx-menu-item flex items-center justify-between px-4 py-2 text-xs font-serif ${editorRefs.current[ctxPaneIdx]?.selectionStart === editorRefs.current[ctxPaneIdx]?.value.length
                ? 'opacity-30 pointer-events-none'
                : 'hover:bg-[var(--surface-soft)] text-[var(--text)] hover:text-[var(--accent)]'
              } cursor-pointer`}
          >
            <span className="flex items-center gap-2"><Eraser className="w-3.5 h-3.5" />删除光标后文本</span>
          </li>
          <li className="ctx-divider h-px bg-[var(--border)] my-1 mx-2" />
          <li
            id="ctx-save-snippet"
            onClick={handleSaveCtxSnippet}
            className={`ctx-menu-item flex items-center justify-between px-4 py-2 text-xs font-serif ${!ctxSelection
                ? 'opacity-30 pointer-events-none'
                : 'hover:bg-[var(--surface-soft)] text-[var(--text)] hover:text-[var(--accent)]'
              } cursor-pointer`}
          >
            <span className="flex items-center gap-2"><Highlighter className="w-3.5 h-3.5" />将选中文字存为片段</span>
          </li>
        </ul>
      )}
    </div>
  );
}
