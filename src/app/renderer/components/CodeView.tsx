import { useEffect, useRef, useState } from 'react';
import { EditorView, keymap, gutter, GutterMarker, Decoration } from '@codemirror/view';
import type { DecorationSet } from '@codemirror/view';
import { EditorState, StateField, RangeSetBuilder } from '@codemirror/state';
import { defaultKeymap, historyKeymap, history, indentWithTab } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import type { FunctionDetail } from '../types';
import { useLocale } from '../hooks/useLocale';

interface Props {
  filePath: string;
  fn:       FunctionDetail;
  onClose:  () => void;
}

// ── Tokenizer minimal TS/JS/Python ────────────────────────────────────────────

const TS_KEYWORDS = new Set([
  'import','export','from','default','as','type','interface','class','extends',
  'implements','new','return','const','let','var','function','async','await',
  'if','else','for','while','do','switch','case','break','continue','throw',
  'try','catch','finally','typeof','instanceof','in','of','void','null','undefined',
  'true','false','this','super','static','readonly','public','private','protected',
  'abstract','enum','namespace','declare','module','keyof','infer','never','any',
  'unknown','string','number','boolean','object','symbol','bigint',
]);

const PY_KEYWORDS = new Set([
  'def','class','import','from','as','return','if','elif','else','for','while',
  'try','except','finally','with','pass','break','continue','raise','lambda',
  'and','or','not','in','is','None','True','False','self','cls','async','await',
  'yield','del','global','nonlocal','assert',
]);

type Token = { text: string; type: 'keyword' | 'string' | 'comment' | 'number' | 'plain' };

function tokenize(line: string, lang: 'py' | 'js'): Token[] {
  const tokens: Token[] = [];
  const keywords = lang === 'py' ? PY_KEYWORDS : TS_KEYWORDS;
  let i = 0;

  while (i < line.length) {
    // Comment
    if (lang === 'js' && line[i] === '/' && line[i + 1] === '/') {
      tokens.push({ text: line.slice(i), type: 'comment' });
      break;
    }
    if (lang === 'py' && line[i] === '#') {
      tokens.push({ text: line.slice(i), type: 'comment' });
      break;
    }

    // String (simple: detect opening quote, find closing)
    if (line[i] === '"' || line[i] === "'" || line[i] === '`') {
      const q = line[i]!;
      let j = i + 1;
      while (j < line.length) {
        if (line[j] === '\\') { j += 2; continue; }
        if (line[j] === q) { j++; break; }
        j++;
      }
      tokens.push({ text: line.slice(i, j), type: 'string' });
      i = j;
      continue;
    }

    // Number
    if (/[0-9]/.test(line[i]!)) {
      let j = i;
      while (j < line.length && /[0-9._xXa-fA-FbBoO]/.test(line[j]!)) j++;
      tokens.push({ text: line.slice(i, j), type: 'number' });
      i = j;
      continue;
    }

    // Word (keyword or plain)
    if (/[a-zA-Z_$]/.test(line[i]!)) {
      let j = i;
      while (j < line.length && /[\w$]/.test(line[j]!)) j++;
      const word = line.slice(i, j);
      tokens.push({ text: word, type: keywords.has(word) ? 'keyword' : 'plain' });
      i = j;
      continue;
    }

    // Plain char
    tokens.push({ text: line[i]!, type: 'plain' });
    i++;
  }

  return tokens;
}

const COLOR: Record<Token['type'], string> = {
  keyword: 'var(--blue)',
  string:  '#a8ff78',
  comment: '#555e6e',
  number:  '#f5a623',
  plain:   'var(--text-secondary)',
};

function TokenSpan({ token }: { token: Token }) {
  return <span style={{ color: COLOR[token.type] }}>{token.text}</span>;
}

// ── CodeMirror helpers ────────────────────────────────────────────────────────

const appHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword,                          color: 'var(--blue)' },
  { tag: tags.string,                           color: '#a8ff78' },
  { tag: tags.comment,                          color: '#555e6e' },
  { tag: tags.number,                           color: '#f5a623' },
  { tag: [tags.typeName, tags.className],       color: 'var(--text-primary)' },
  { tag: tags.operator,                         color: 'var(--text-secondary)' },
  { tag: tags.variableName,                     color: 'var(--text-secondary)' },
  { tag: tags.propertyName,                     color: 'var(--text-secondary)' },
  { tag: tags.function(tags.variableName),      color: 'var(--text-primary)' },
  { tag: tags.definition(tags.variableName),    color: 'var(--text-primary)' },
]);

class FnLineMarker extends GutterMarker {
  constructor(
    private readonly num: number,
    private readonly isFirst: boolean,
    private readonly inFn: boolean,
  ) { super(); }

  toDOM(): Node {
    const el = document.createElement('div');
    el.textContent = String(this.num);
    el.style.paddingRight = '12px';
    el.style.textAlign = 'right';
    el.style.color = this.isFirst
      ? 'var(--blue)'
      : this.inFn
        ? 'color-mix(in srgb, var(--blue) 60%, var(--text-muted))'
        : 'var(--text-faint)';
    return el;
  }

  eq(other: GutterMarker): boolean {
    if (!(other instanceof FnLineMarker)) return false;
    return this.num === other.num && this.isFirst === other.isFirst && this.inFn === other.inFn;
  }
}

function buildCMExtensions(
  lang: 'py' | 'js',
  fnStart: number,
  fnEnd: number,
  gutterWidth: number,
  onSave: () => void,
) {
  const fnLineDeco      = Decoration.line({ class: 'cm-fn-line' });
  const fnLineFirstDeco = Decoration.line({ class: 'cm-fn-line-first' });

  const fnHighlight = StateField.define<DecorationSet>({
    create(state) {
      const b = new RangeSetBuilder<Decoration>();
      for (let ln = fnStart; ln <= fnEnd && ln <= state.doc.lines; ln++) {
        const line = state.doc.line(ln);
        b.add(line.from, line.from, ln === fnStart ? fnLineFirstDeco : fnLineDeco);
      }
      return b.finish();
    },
    update(deco, tr) { return deco.map(tr.changes); },
    provide: f => EditorView.decorations.from(f),
  });

  const fnGutter = gutter({
    lineMarker(view, line) {
      const ln   = view.state.doc.lineAt(line.from).number;
      const inFn = ln >= fnStart && ln <= fnEnd;
      return new FnLineMarker(ln, ln === fnStart, inFn);
    },
    lineMarkerChange: update => update.docChanged,
    initialSpacer:    view  => new FnLineMarker(view.state.doc.lines, false, false),
  });

  return [
    lang === 'py' ? python() : javascript({ typescript: true, jsx: true }),
    syntaxHighlighting(appHighlightStyle),
    fnHighlight,
    fnGutter,
    history(),
    keymap.of([
      { key: 'Mod-s', run: () => { onSave(); return true; } },
      indentWithTab,
      ...defaultKeymap,
      ...historyKeymap,
    ]),
    EditorView.theme({
      '&': {
        height: '100%',
        background: 'transparent',
        fontSize: '12px',
        fontFamily: "'SF Mono','Menlo',monospace",
      },
      '.cm-scroller': {
        fontFamily: 'inherit',
        lineHeight: '20px',
        overflow: 'auto',
      },
      '.cm-content': {
        padding: '16px 0',
        caretColor: 'var(--text-primary)',
        color: 'var(--text-secondary)',
      },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--text-primary)' },
      '.cm-fn-line': {
        background: 'color-mix(in srgb, var(--blue) 6%, transparent) !important',
      },
      '.cm-fn-line-first': {
        borderLeft: '2px solid var(--blue) !important',
      },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
        background: 'color-mix(in srgb, var(--blue) 20%, transparent) !important',
      },
      '.cm-gutters': {
        background: 'transparent',
        border: 'none',
        borderRight: '0.5px solid var(--border)',
        minWidth: `${gutterWidth}px`,
      },
      '.cm-gutter': { minWidth: `${gutterWidth}px` },
      '.cm-gutterElement': {
        fontSize: '11px',
        minWidth: `${gutterWidth}px`,
      },
      '.cm-activeLine':       { background: 'transparent' },
      '.cm-activeLineGutter': { background: 'transparent' },
      '&.cm-focused':         { outline: 'none' },
    }, { dark: true }),
    EditorView.lineWrapping,
  ];
}

// ── CodeView ──────────────────────────────────────────────────────────────────

export default function CodeView({ filePath, fn, onClose }: Props) {
  const { t } = useLocale();
  const [lines,    setLines]    = useState<string[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [draft,    setDraft]    = useState('');
  const [saving,   setSaving]   = useState(false);
  const [saveErr,  setSaveErr]  = useState(false);

  const lineRef        = useRef<HTMLDivElement | null>(null);
  const cmContainerRef = useRef<HTMLDivElement | null>(null);
  const cmViewRef      = useRef<EditorView | null>(null);

  const fnStart = fn.start_line;
  const fnEnd   = fn.start_line + fn.line_count - 1;
  const ext     = filePath.split('.').pop()?.toLowerCase() ?? '';
  const lang    = ext === 'py' ? 'py' : 'js';
  const fname   = filePath.split('/').pop() ?? filePath;

  const lineNumWidth = String(lines.length).length * 8 + 20;

  useEffect(() => {
    setLoading(true);
    setError(false);
    setEditMode(false);
    window.api.readFile(filePath).then(res => {
      if (!res.ok) { setError(true); setLoading(false); return; }
      setLines(res.content.split('\n'));
      setDraft(res.content);
      setLoading(false);
    });
  }, [filePath]);

  // Escape : annule l'édition ou ferme le code view
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (editMode) handleCancelEdit();
      else onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode]);

  // Scroll vers la fonction en mode lecture
  useEffect(() => {
    if (!loading && !editMode && lineRef.current) {
      lineRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [loading, editMode, fn.start_line]);

  // Cycle de vie CodeMirror en mode édition
  useEffect(() => {
    if (!editMode || !cmContainerRef.current) return;

    const view = new EditorView({
      state: EditorState.create({
        doc: draft,
        extensions: buildCMExtensions(lang, fnStart, fnEnd, lineNumWidth, handleSave),
      }),
      parent: cmContainerRef.current,
    });

    cmViewRef.current = view;

    // Scroll vers la fonction
    const targetLine = Math.min(fnStart, view.state.doc.lines);
    const pos = view.state.doc.line(targetLine).from;
    view.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
    view.focus();

    return () => {
      view.destroy();
      cmViewRef.current = null;
    };
    // draft intentionnellement exclu : on ne recrée pas l'éditeur si draft change hors edit mode
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode]);

  async function handleSave() {
    const content = cmViewRef.current?.state.doc.toString() ?? lines.join('\n');
    setSaving(true);
    setSaveErr(false);
    const res = await window.api.writeFile(filePath, content);
    if (!res.ok) {
      setSaving(false);
      setSaveErr(true);
      return;
    }
    setLines(content.split('\n'));
    setDraft(content);
    setEditMode(false);
    setSaving(false);
    window.api.runScan();
  }

  function handleCancelEdit() {
    setSaveErr(false);
    setEditMode(false);
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'transparent', overflow: 'hidden',
    }}>

      {/* Header — breadcrumb compact */}
      <div style={{
        flexShrink: 0,
        padding: '8px 20px',
        borderBottom: '0.5px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 6,
        fontFamily: "'SF Mono','Menlo',monospace",
        fontSize: 11,
      }}>
        <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fname}
        </span>
        <span style={{ color: 'var(--border-strong)', fontSize: 10 }}>/</span>
        <span style={{ color: 'var(--blue)' }}>{fn.name}</span>
        <span style={{ color: 'var(--text-faint)', marginLeft: 2 }}>
          {t('code.line')}.{fnStart}–{fnEnd}
        </span>

        <div style={{ flex: 1 }} />

        {/* Boutons mode édition */}
        {editMode ? (
          <>
            {saveErr && (
              <span style={{ fontSize: 10, color: 'var(--red)', marginRight: 4 }}>{t('code.writeFailed')}</span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                background: 'color-mix(in srgb, var(--blue) 15%, transparent)',
                border: '0.5px solid color-mix(in srgb, var(--blue) 40%, transparent)',
                borderRadius: 4, cursor: saving ? 'default' : 'pointer',
                color: saving ? 'var(--text-muted)' : 'var(--blue)',
                fontSize: 10, fontFamily: 'inherit', padding: '2px 8px',
                transition: 'opacity 0.15s', flexShrink: 0,
              }}
            >
              {saving ? t('code.saving') : t('code.save')}
            </button>
            <button
              onClick={handleCancelEdit}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: 10, fontFamily: 'inherit',
                padding: '2px 6px', transition: 'color 0.15s', flexShrink: 0,
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              {t('code.cancel')}
            </button>
          </>
        ) : (
          !loading && !error && (
            <button
              onClick={() => setEditMode(true)}
              style={{
                background: 'none',
                border: '0.5px solid var(--border)',
                borderRadius: 4, cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: 10, fontFamily: 'inherit',
                padding: '2px 8px', transition: 'color 0.15s, border-color 0.15s', flexShrink: 0,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.borderColor = 'var(--border-hover)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              {t('code.edit')}
            </button>
          )
        )}

        <button
          onClick={editMode ? handleCancelEdit : onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 16, fontFamily: 'inherit',
            padding: '0 2px', lineHeight: 1, transition: 'color 0.15s', flexShrink: 0,
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          ×
        </button>
      </div>

      {/* Code — mode lecture */}
      {!editMode && (
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 0' }}>
          {loading && (
            <div style={{ padding: '32px 24px', fontSize: 11, color: 'var(--text-muted)' }}>
              {t('code.loading')}
            </div>
          )}
          {error && (
            <div style={{ padding: '32px 24px', fontSize: 11, color: 'var(--red)' }}>
              {t('code.error')}
            </div>
          )}
          {!loading && !error && (
            <div style={{ fontFamily: "'SF Mono','Menlo',monospace", fontSize: 12, lineHeight: '22px' }}>
              {lines.map((rawLine, idx) => {
                const lineNum   = idx + 1;
                const isFnStart = lineNum === fnStart;
                const isInFn    = lineNum >= fnStart && lineNum <= fnEnd;
                const tokens    = tokenize(rawLine, lang);

                return (
                  <div
                    key={lineNum}
                    ref={isFnStart ? lineRef : null}
                    style={{
                      display: 'flex',
                      background: isInFn
                        ? 'color-mix(in srgb, var(--blue) 6%, transparent)'
                        : 'transparent',
                      borderLeft: isFnStart
                        ? '2px solid var(--blue)'
                        : isInFn
                          ? '2px solid color-mix(in srgb, var(--blue) 30%, transparent)'
                          : '2px solid transparent',
                    }}
                  >
                    <div style={{
                      width: lineNumWidth, flexShrink: 0, textAlign: 'right',
                      paddingRight: 16, userSelect: 'none',
                      color: isInFn ? 'color-mix(in srgb, var(--blue) 60%, var(--text-muted))' : 'var(--text-faint)',
                      fontSize: 11,
                    }}>
                      {lineNum}
                    </div>
                    <div style={{ flex: 1, paddingRight: 24, whiteSpace: 'pre' }}>
                      {tokens.map((tok, ti) => <TokenSpan key={ti} token={tok} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Code — mode édition (CodeMirror 6) */}
      {editMode && (
        <div ref={cmContainerRef} style={{ flex: 1, overflow: 'hidden' }} />
      )}
    </div>
  );
}
