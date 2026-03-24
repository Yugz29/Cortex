import { useState } from 'react';
import { scoreColor, scoreColorHex } from '../../utils';

interface Props {
  history:    { score: number; scanned_at: string }[];
  width?:     number;
  height?:    number;
  showDates?: boolean;
}

export default function ScoreGraph({ history, width = 260, height = 80, showDates = false }: Props) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; score: number; date: string } | null>(null);

  if (history.length === 0) return null;

  // 1 seul point — dot + message
  if (history.length === 1) {
    const s    = history[0]!.score;
    const col  = scoreColor(s);     // var(--red/orange/green) — inline style OK
    const colH = scoreColorHex(s);  // hex pour box-shadow
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, height, paddingLeft: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: col, boxShadow: `0 0 6px ${colH}88` }} />
        <span style={{ fontFamily: "'SF Mono','Menlo',monospace", fontSize: 11, color: col, fontWeight: 500 }}>{s.toFixed(1)}</span>
        <span style={{ fontSize: 9, color: 'var(--text-faint)' }}>today only — history builds over time</span>
      </div>
    );
  }

  const pad    = { t: 8, r: 6, b: 22, l: 6 };
  const W      = width;
  const H      = height;
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;

  const scores    = history.map(h => h.score);
  const minS      = Math.min(...scores);
  const maxS      = Math.max(...scores);
  const range     = maxS - minS || 1;
  const lastScore = scores[scores.length - 1] ?? 0;

  // hex pour SVG attributes, var() pour inline styles
  const lineHex = scoreColorHex(lastScore);
  const lineVar = scoreColor(lastScore);

  function px(i: number) { return pad.l + (i / (scores.length - 1)) * innerW; }
  function py(s: number) { return pad.t + (1 - (s - minS) / range) * innerH; }

  const pts = scores.map((s, i) => `${px(i)},${py(s)}`).join(' ');
  const areaPath = [
    `M ${px(0)},${py(scores[0]!)}`,
    ...scores.map((s, i) => `L ${px(i)},${py(s)}`),
    `L ${px(scores.length - 1)},${H - pad.b}`,
    `L ${px(0)},${H - pad.b}`, 'Z',
  ].join(' ');

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return `${fmtDate(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  const dayOf = (iso: string) => iso.slice(0, 10);

  // Points où le jour change par rapport au point précédent
  const dayMarkers = history.reduce<{ x: number; label: string }[]>((acc, h, i) => {
    if (i === 0) return acc;
    if (dayOf(h.scanned_at) !== dayOf(history[i - 1]!.scanned_at)) {
      acc.push({ x: px(i), label: fmtDate(h.scanned_at) });
    }
    return acc;
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }} onMouseLeave={() => setTooltip(null)}>
        <defs>
          <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={lineHex} stopOpacity="0.18" />
            <stop offset="100%" stopColor={lineHex} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        <path d={areaPath} fill="url(#area-grad)" />
        <polyline points={pts} fill="none" stroke={lineHex} strokeWidth="1.5" strokeLinejoin="round" opacity="0.9" />

        {scores.map((s, i) => (
          <rect key={i}
            x={i === 0 ? 0 : (px(i - 1) + px(i)) / 2} y={0}
            width={i === 0 ? (px(0) + px(1)) / 2 : i === scores.length - 1 ? W - (px(i - 1) + px(i)) / 2 : (px(i + 1) - px(i - 1)) / 2}
            height={H} fill="transparent" style={{ cursor: 'crosshair' }}
            onMouseEnter={() => setTooltip({ x: px(i), y: py(s), score: s, date: history[i]!.scanned_at })}
          />
        ))}

        {tooltip && (
          <>
            <line x1={tooltip.x} y1={pad.t} x2={tooltip.x} y2={H - pad.b} stroke="var(--border-hover)" strokeWidth="1" strokeDasharray="2,2" />
            <circle cx={tooltip.x} cy={tooltip.y} r={3.5} fill={lineHex} />
            <circle cx={tooltip.x} cy={tooltip.y} r={6}   fill={lineHex} opacity={0.15} />
          </>
        )}

        {!tooltip && (
          <circle cx={px(scores.length - 1)} cy={py(lastScore)} r={2.5} fill={lineHex} opacity={0.9} />
        )}

        {/* Marqueurs de changement de jour */}
        {dayMarkers.map((m, i) => (
          <g key={i}>
            {/* Ligne verticale pointillée */}
            <line
              x1={m.x} y1={pad.t}
              x2={m.x} y2={H - pad.b + 4}
              stroke="var(--border)"
              strokeWidth="1"
              strokeDasharray="2,2"
            />
            {/* Petit tick en bas */}
            <line
              x1={m.x} y1={H - pad.b + 2}
              x2={m.x} y2={H - pad.b + 6}
              stroke="var(--border-hover)"
              strokeWidth="1"
            />
            {/* Label date */}
            <text
              x={m.x} y={H - 2}
              textAnchor="middle"
              fontSize="7.5"
              fill="var(--text-ghost)"
              fontFamily="'SF Mono','Menlo',monospace"
            >
              {m.label}
            </text>
          </g>
        ))}
      </svg>

      {tooltip && (
        <div style={{
          position: 'absolute',
          left: Math.min(tooltip.x + 8, W - 90),
          top: Math.max(tooltip.y - 30, 0),
          pointerEvents: 'none',
          background: 'var(--bg-base)',
          border: '0.5px solid var(--border-hover)',
          borderRadius: 5, padding: '3px 8px',
          fontFamily: "'SF Mono','Menlo',monospace",
          fontSize: 10, color: 'var(--text-secondary)',
          whiteSpace: 'nowrap', zIndex: 10,
        }}>
          <span style={{ color: lineVar, fontWeight: 600 }}>{tooltip.score.toFixed(1)}</span>
          {' · '}{fmt(tooltip.date)}
        </div>
      )}
    </div>
  );
}
