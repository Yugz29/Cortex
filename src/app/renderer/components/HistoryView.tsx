import { useState, useEffect, useRef } from 'react';
import { scoreColor, scoreColorHex } from '../utils';
import { useLocale } from '../hooks/useLocale';

interface HistoryPoint { date: string; score: number; healthPct: number; }

interface Props {
  projectHistory: HistoryPoint[];
  projectPath:    string;
  scans:          { filePath: string; globalScore: number; trend: string }[];
  onSelectScan:   (filePath: string) => void;
}

export default function HistoryView({ projectHistory, projectPath, scans, onSelectScan }: Props) {
  const { t } = useLocale();
  const [tooltip,   setTooltip]   = useState<{ x: number; y: number; score: number; date: string } | null>(null);
  const [granularity, setGranularity] = useState<'scan' | 'day'>('scan');
  const [byDayData, setByDayData] = useState<HistoryPoint[]>([]);
  const graphRef  = useRef<HTMLDivElement>(null);
  const [graphW,   setGraphW]     = useState(560);

  // Charger les données par jour
  useEffect(() => {
    if (window.api.getProjectHistoryByDay) {
      window.api.getProjectHistoryByDay().then(setByDayData);
    }
  }, [projectPath]);

  // Graphe pleine largeur
  useEffect(() => {
    const el = graphRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const e = entries[0];
      if (e) setGraphW(e.contentRect.width - 16); // -16 = padding 8px × 2
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const projName = projectPath.split('/').pop() || '—';
  const data     = granularity === 'scan' ? projectHistory : byDayData;

  if (data.length === 0 && projectHistory.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{t('history.notEnough')}</div>
        <div style={{ fontSize: 9, color: 'var(--text-ghost)' }}>{t('history.recorded')}</div>
      </div>
    );
  }

  // On travaille en score de risque (0 = parfait, 100 = critique)
  // Sur le graphe : Y croissant = risque croissant = mauvais
  // La courbe qui descend = amélioration
  const scores      = data.map(h => h.score);
  const lastScore   = scores[scores.length - 1] ?? 0;
  const firstScore  = scores[0] ?? 0;
  const deltaScore  = lastScore - firstScore; // négatif = risque baisse = bon
  const lineColor   = scoreColorHex(lastScore);
  const avgScore    = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const singlePoint = scores.length <= 1;

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
  };
  const fmtLabel = (iso: string) => {
    const d = new Date(iso);
    if (granularity === 'day') return `${d.getDate()}/${d.getMonth() + 1}`;
    // Pour les scans : afficher l'heure si même jour
    return `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };
  const fmtTooltip = (iso: string) => {
    const d = new Date(iso);
    if (granularity === 'day') return fmt(iso);
    return `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  function renderMainGraph(W: number, H: number) {
    const hasDayMarkers = granularity === 'scan';
    const pad    = { t: 20, r: 16, b: hasDayMarkers ? 28 : 16, l: 40 };
    const innerW = W - pad.l - pad.r;
    const innerH = H - pad.t - pad.b;
    const cx     = pad.l + innerW / 2;
    const cy     = pad.t + innerH / 2;

    if (singlePoint || scores.length === 0) {
      const s = scores[0] ?? lastScore;
      return (
        <svg width={W} height={H} style={{ display: 'block' }}>
          <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke="var(--border)" strokeWidth="1" />
          <circle cx={cx} cy={cy} r={10} fill={lineColor} opacity={0.15} />
          <circle cx={cx} cy={cy} r={5}  fill={lineColor} opacity={0.9} />
          <text x={cx} y={cy - 18} textAnchor="middle" fontSize="10" fill={lineColor} fontFamily="'SF Mono','Menlo',monospace" fontWeight="600">
            {s.toFixed(1)}
          </text>
          {data[0] && (
            <text x={cx} y={H - pad.b + 14} textAnchor="middle" fontSize="8" fill="var(--text-faint)" fontFamily="'SF Mono','Menlo',monospace">
              {fmtLabel(data[0].date)}
            </text>
          )}
        </svg>
      );
    }

    const minS  = Math.min(...scores);
    const maxS  = Math.max(...scores);
    const range = maxS - minS || 1;

    function px(i: number) { return pad.l + (i / (scores.length - 1)) * innerW; }
    // Score élevé = haut de l'écran (Y petit en SVG) = zone danger
    // Score faible = bas de l'écran (Y grand) = zone saine
    function py(s: number) { return pad.t + (1 - (s - minS) / range) * innerH; }

    const pts      = scores.map((s, i) => `${px(i)},${py(s)}`).join(' ');
    const areaPath = [
      `M ${px(0)},${py(scores[0]!)}`,
      ...scores.map((s, i) => `L ${px(i)},${py(s)}`),
      `L ${px(scores.length - 1)},${H - pad.b}`,
      `L ${px(0)},${H - pad.b}`, 'Z',
    ].join(' ');

    // Y labels : maxS en haut (danger), minS en bas (bon)
    const yLabels = [minS, (minS + maxS) / 2, maxS].map(s => ({ val: s, y: py(s) }));

    // Marqueurs de changement de jour (mode scan uniquement)
    const dayOf = (iso: string) => iso.slice(0, 10);
    const fmtDay = (iso: string) => { const d = new Date(iso); return `${d.getDate()}/${d.getMonth() + 1}`; };
    const dayMarkers = hasDayMarkers
      ? data.reduce<{ x: number; label: string }[]>((acc, h, i) => {
          if (i === 0) return acc;
          if (dayOf(h.date) !== dayOf(data[i - 1]!.date)) acc.push({ x: px(i), label: fmtDay(h.date) });
          return acc;
        }, [])
      : [];

    return (
      <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }} onMouseLeave={() => setTooltip(null)}>
        <defs>
          <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={lineColor} stopOpacity="0.22" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {yLabels.map(({ val, y }, i) => (
          <g key={i}>
            <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="var(--border)" strokeWidth="1" />
            <text x={pad.l - 6} y={y + 3} fontSize="8" fill="var(--text-faint)" textAnchor="end" fontFamily="'SF Mono','Menlo',monospace">
              {val.toFixed(0)}
            </text>
          </g>
        ))}

        <path d={areaPath} fill="url(#hg)" />
        <polyline points={pts} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" opacity="0.9" />

        {scores.map((s, i) => (
          <rect key={i}
            x={i === 0 ? pad.l : (px(i - 1) + px(i)) / 2} y={pad.t}
            width={i === 0 ? (px(1) - px(0)) / 2 : i === scores.length - 1 ? (px(i) - px(i - 1)) / 2 : (px(i + 1) - px(i - 1)) / 2}
            height={innerH} fill="transparent" style={{ cursor: 'crosshair' }}
            onMouseEnter={() => setTooltip({ x: px(i), y: py(s), score: s, date: data[i]!.date })}
          />
        ))}

        {tooltip && (
          <>
            <line x1={tooltip.x} y1={pad.t} x2={tooltip.x} y2={H - pad.b} stroke="var(--border-hover)" strokeWidth="1" strokeDasharray="3,3" />
            <circle cx={tooltip.x} cy={tooltip.y} r={4} fill={lineColor} />
            <circle cx={tooltip.x} cy={tooltip.y} r={8} fill={lineColor} opacity={0.12} />
          </>
        )}
        {!tooltip && <circle cx={px(scores.length - 1)} cy={py(lastScore)} r={3} fill={lineColor} opacity={0.95} />}

        <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke="var(--border)" strokeWidth="1" />

        {/* Marqueurs de changement de jour */}
        {dayMarkers.map((m, i) => (
          <g key={i}>
            <line x1={m.x} y1={pad.t} x2={m.x} y2={H - pad.b + 4}
              stroke="var(--border)" strokeWidth="1" strokeDasharray="2,3" />
            <line x1={m.x} y1={H - pad.b + 2} x2={m.x} y2={H - pad.b + 7}
              stroke="var(--border-hover)" strokeWidth="1" />
            <text x={m.x} y={H - 4} textAnchor="middle"
              fontSize="8" fill="var(--text-ghost)" fontFamily="'SF Mono','Menlo',monospace">
              {m.label}
            </text>
          </g>
        ))}
      </svg>
    );
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px 28px', position: 'relative' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: '0.1em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 6 }}>{t('history.title')}</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{projName}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
            {data.length} {t('history.scans')}
            {data.length >= 2 && ` · ${fmt(data[0]!.date)} → ${fmt(data[data.length - 1]!.date)}`}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          {!singlePoint && (
            <div style={{ textAlign: 'right' }}>
              {/* deltaScore négatif = risque baisse = amélioration = vert */}
              <div style={{ fontSize: 24, fontWeight: 200, color: deltaScore < 0 ? '#34c759' : deltaScore > 0 ? '#ff453a' : 'var(--text-secondary)', letterSpacing: '-1px', lineHeight: 1 }}>
                {deltaScore < 0 ? '↓' : deltaScore > 0 ? '↑' : '↔'} {Math.abs(deltaScore).toFixed(1)}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-faint)', marginTop: 2 }}>{t('history.sinceFirst')}</div>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20 }}>
        {[
          { label: t('history.current'), value: lastScore.toFixed(1),           color: scoreColor(lastScore) },
          { label: t('history.average'), value: avgScore.toFixed(1),              color: scoreColor(avgScore)  },
          { label: t('history.best'),    value: Math.min(...scores).toFixed(1),   color: 'var(--green)'        },
          { label: t('history.worst'),   value: Math.max(...scores).toFixed(1),   color: 'var(--red)'          },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 9, color: 'var(--text-faint)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 5 }}>{stat.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <span style={{ fontSize: 24, fontWeight: 200, color: stat.color, lineHeight: 1 }}>{stat.value}</span>
              <span style={{ fontSize: 9, color: 'var(--text-ghost)' }}>/100</span>
            </div>
          </div>
        ))}
      </div>

      {/* Graphe — pleine largeur via ResizeObserver */}
      <div ref={graphRef} style={{ position: 'relative', background: 'var(--bg-hover)', borderRadius: 12, padding: '0', border: '0.5px solid var(--border)', marginBottom: 20, overflow: 'hidden' }}>
        {/* Header de la card graphe avec le toggle intégré */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px 0' }}>
          <span style={{ fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
            {data.length} {granularity === 'scan' ? t('history.points') : t('history.days')}
          </span>
          <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: 6, padding: 2, gap: 1 }}>
            {(['scan', 'day'] as const).map(g => (
              <button key={g} onClick={() => setGranularity(g)} style={{
                fontSize: 9, fontWeight: 500, padding: '2px 8px', borderRadius: 4,
                cursor: 'pointer', border: 'none', fontFamily: 'inherit', transition: 'all 0.12s',
                background: granularity === g ? 'var(--bg-surface)' : 'transparent',
                color:      granularity === g ? 'var(--text-primary)' : 'var(--text-faint)',
                boxShadow:  granularity === g ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
              }}>
                {g === 'scan' ? t('history.byScan') : t('history.byDay')}
              </button>
            ))}
          </div>
        </div>
        <div style={{ padding: '4px 0 8px' }}>
          {renderMainGraph(graphW, 200)}
        </div>
        {tooltip && (
          <div style={{
            position: 'absolute', left: '50%', top: 8, transform: 'translateX(-50%)',
            pointerEvents: 'none', background: 'var(--bg-base)',
            border: '0.5px solid var(--border-hover)', borderRadius: 6, padding: '4px 12px',
            fontFamily: "'SF Mono','Menlo',monospace", fontSize: 10, color: 'var(--text-secondary)', whiteSpace: 'nowrap',
          }}>
            {tooltip.score.toFixed(1)} · {fmtTooltip(tooltip.date)}
          </div>
        )}
      </div>


      {/* Tendances fichiers */}
      {(() => {
        const sorted      = [...scans].sort((a, b) => b.globalScore - a.globalScore);
        const critical    = sorted.filter(s => s.globalScore >= 50);
        const newCritical = critical.filter(s => s.trend === '↑').slice(0, 5);
        const degrading   = sorted.filter(s => s.trend === '↑' && s.globalScore < 50).slice(0, 5);
        const improving   = sorted.filter(s => s.trend === '↓' && s.globalScore > 0).slice(0, 5);
        if (!newCritical.length && !degrading.length && !improving.length) return null;

        const row = (s: typeof scans[0], accentColor: string) => (
          <div key={s.filePath} onClick={() => onSelectScan(s.filePath)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
              background: `${accentColor}08`, border: `0.5px solid ${accentColor}20`,
              borderLeft: `2px solid ${accentColor}`, borderRadius: 7, cursor: 'pointer' }}>
            <span style={{ flex: 1, fontSize: 11, color: 'var(--text-secondary)',
              fontFamily: "'SF Mono','Menlo',monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.filePath.split('/').pop()}
            </span>
            <span style={{ fontSize: 10, color: accentColor, fontFamily: "'SF Mono','Menlo',monospace", flexShrink: 0 }}>
              {s.globalScore.toFixed(1)}
            </span>
            <span style={{ fontSize: 11, color: accentColor, flexShrink: 0 }}>
              {s.trend}
            </span>
          </div>
        );

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 4 }}>
            {newCritical.length > 0 && (
              <div>
                <div style={{ fontSize: 10, letterSpacing: '0.10em', color: '#ff453a', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M5.5 1L10 10H1L5.5 1Z" stroke="#ff453a" strokeWidth="1.2" strokeLinejoin="round"/>
                    <line x1="5.5" y1="4.5" x2="5.5" y2="7" stroke="#ff453a" strokeWidth="1.2" strokeLinecap="round"/>
                    <circle cx="5.5" cy="8.5" r="0.6" fill="#ff453a"/>
                  </svg>
                  {t('history.newCritical')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {newCritical.map(s => row(s, '#ff453a'))}
                </div>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: degrading.length > 0 && improving.length > 0 ? '1fr 1fr' : '1fr', gap: 16 }}>
              {degrading.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, letterSpacing: '0.10em', color: '#ff9f0a', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>{t('history.degrading')}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{degrading.map(s => row(s, '#ff9f0a'))}</div>
                </div>
              )}
              {improving.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, letterSpacing: '0.10em', color: '#34c759', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>{t('history.improving')}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{improving.map(s => row(s, '#34c759'))}</div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
