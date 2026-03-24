import { useEffect, useRef, useState } from 'react';
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

// ── CodeView ──────────────────────────────────────────────────────────────────

export default function CodeView({ filePath, fn, onClose }: Props) {
  const { t } = useLocale();
  const [lines,   setLines]   = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);
  const lineRef = useRef<HTMLDivElement | null>(null);

  const fnStart = fn.start_line;
  const fnEnd   = fn.start_line + fn.line_count - 1;
  const ext     = filePath.split('.').pop()?.toLowerCase() ?? '';
  const lang    = ext === 'py' ? 'py' : 'js';
  const fname   = filePath.split('/').pop() ?? filePath;

  useEffect(() => {
    setLoading(true);
    setError(false);
    window.api.readFile(filePath).then(res => {
      if (!res.ok) { setError(true); setLoading(false); return; }
      setLines(res.content.split('\n'));
      setLoading(false);
    });
  }, [filePath]);

  // Scroll vers la fonction après rendu
  useEffect(() => {
    if (!loading && lineRef.current) {
      lineRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [loading, fn.start_line]);

  const lineNumWidth = String(lines.length).length * 8 + 20;

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

        <button
          onClick={onClose}
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

      {/* Code */}
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
                  {/* Numéro de ligne */}
                  <div style={{
                    width: lineNumWidth, flexShrink: 0, textAlign: 'right',
                    paddingRight: 16, userSelect: 'none',
                    color: isInFn ? 'color-mix(in srgb, var(--blue) 60%, var(--text-muted))' : 'var(--text-faint)',
                    fontSize: 11,
                  }}>
                    {lineNum}
                  </div>

                  {/* Code */}
                  <div style={{ flex: 1, paddingRight: 24, whiteSpace: 'pre' }}>
                    {tokens.map((tok, ti) => <TokenSpan key={ti} token={tok} />)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
