import { useState, useEffect, useRef } from 'react';
import { scoreColor, scoreColorHex } from '../utils';
import { useLocale } from '../hooks/useLocale';
import { useLocalPref } from '../hooks/useLocalPref';

interface HistoryPoint { date: string; score: number; healthPct: number; }

interface Props {
  projectHistory: HistoryPoint[];
  projectPath:    string;
  scans:          { filePath: string; globalScore: number; trend: string }[];
  onSelectScan:   (filePath: string) => void;
}

const WINDOW_PRESETS = [30, 90] as const;

export default function HistoryView({ projectHistory, projectPath, scans, onSelectScan }: Props) {
  const { t } = useLocale();
  const [tooltip,     setTooltip]     = useState<{ x: number; y: number; score: number; date: string } | null>(null);
  const [granularity, setGranularity] = useLocalPref<'scan' | 'day'>('pref.activityGranularity', 'scan');
  const [byDayData,   setByDayData]   = useState<HistoryPoint[]>([]);
  const [windowSize,  setWindowSize]  = useState<number | 'all'>(50);
  const [panOffset,   setPanOffset]   = useState(0);
  const graphRef  = useRef<HTMLDivElement>(null);
  const [graphW,  setGraphW]  = useState(560);
  const [selectedDate,   setSelectedDate]   = useState<string | null>(null);

  type SnapshotDetail = {
    date: string; prevDate: string | null;
    degraded: { filePath: string; prev: number; curr: number; delta: number }[];
    improved: { filePath: string; prev: number; curr: number; delta: number }[];
    newFiles: { filePath: string; score: number }[];
  };
  const [snapshotDetail, setSnapshotDetail] = useState<SnapshotDetail | null>(null);
  const [latestDetail,   setLatestDetail]   = useState<SnapshotDetail | null>(null);

  useEffect(() => {
    if (window.api.getProjectHistoryByDay) {
      window.api.getProjectHistoryByDay().then(setByDayData);
    }
  }, [projectPath, projectHistory.length]);

  useEffect(() => {
    const el = graphRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const e = entries[0];
      if (e) setGraphW(e.contentRect.width - 16);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { setPanOffset(0); }, [granularity, windowSize, projectPath]);

  // Auto-load latest scan delta
  useEffect(() => {
    const src = granularity === 'scan' ? projectHistory : byDayData;
    if (src.length === 0) return;
    const last = src[src.length - 1]!;
    setLatestDetail(null);
    if (granularity === 'day') {
      window.api.getSnapshotDetailForDay(last.date.slice(0, 10)).then(setLatestDetail);
    } else {
      window.api.getSnapshotDetail(last.date).then(setLatestDetail);
    }
  }, [projectPath, granularity, projectHistory.length, byDayData.length]);

  // ESC → reset point sélectionné
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && selectedDate) {
        setSelectedDate(null);
        setSnapshotDetail(null);
        setPanOffset(0);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedDate]);

  const projName  = projectPath.split('/').pop() || '—';
  const fullData  = granularity === 'scan' ? projectHistory : byDayData;
  const totalPts  = fullData.length;

  const effectiveWindow = windowSize === 'all' ? totalPts : Math.min(windowSize as number, totalPts);
  const maxOffset       = Math.max(0, totalPts - effectiveWindow);
  const clampedOffset   = Math.max(0, Math.min(panOffset, maxOffset));
  const startIdx        = totalPts - effectiveWindow - clampedOffset;
  const data            = fullData.slice(startIdx, startIdx + effectiveWindow);
  const canPan          = effectiveWindow < totalPts;

  if (fullData.length === 0 && projectHistory.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{t('history.notEnough')}</div>
        <div style={{ fontSize: 9, color: 'var(--text-ghost)' }}>{t('history.recorded')}</div>
      </div>
    );
  }

  const scores     = data.map(h => h.score);
  const lastScore  = scores[scores.length - 1] ?? 0;
  const firstScore = scores[0] ?? 0;
  const deltaScore = lastScore - firstScore;
  const lineColor  = scoreColorHex(lastScore);
  const avgScore   = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const singlePoint = scores.length <= 1;

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
  };
  const fmtLabel = (iso: string) => {
    const d = new Date(iso);
    if (granularity === 'day') return `${d.getDate()}/${d.getMonth() + 1}`;
    return `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };
  const fmtTooltip = (iso: string) => {
    const d = new Date(iso);
    if (granularity === 'day') return fmt(iso);
    return `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  // ── Main graph ─────────────────────────────────────────────────────────────
  function renderMainGraph(W: number, H: number) {
    const pad    = { t: 20, r: 16, b: 28, l: 40 };
    const innerW = W - pad.l - pad.r;
    const innerH = H - pad.t - pad.b;

    if (singlePoint || scores.length === 0) {
      const s  = scores[0] ?? lastScore;
      const cx = pad.l + innerW / 2;
      const cy = pad.t + innerH / 2;
      return (
        <svg width={W} height={H} style={{ display: 'block' }}>
          <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke="var(--border)" strokeWidth="1" />
          <circle cx={cx} cy={cy} r={10} fill={lineColor} opacity={0.15} />
          <circle cx={cx} cy={cy} r={5}  fill={lineColor} opacity={0.9} />
          <text x={cx} y={cy - 18} textAnchor="middle" fontSize="10" fill={lineColor}
            fontFamily="'SF Mono','Menlo',monospace" fontWeight="600">{s.toFixed(1)}</text>
        </svg>
      );
    }

    const minS  = Math.min(...scores);
    const maxS  = Math.max(...scores);
    const range = maxS - minS || 1;

    function px(i: number) { return pad.l + (i / (scores.length - 1)) * innerW; }
    function py(s: number) { return pad.t + (1 - (s - minS) / range) * innerH; }

    const pts      = scores.map((s, i) => `${px(i)},${py(s)}`).join(' ');
    const areaPath = [
      `M ${px(0)},${py(scores[0]!)}`,
      ...scores.map((s, i) => `L ${px(i)},${py(s)}`),
      `L ${px(scores.length - 1)},${H - pad.b}`,
      `L ${px(0)},${H - pad.b}`, 'Z',
    ].join(' ');

    const yLabels = [minS, (minS + maxS) / 2, maxS].map(s => ({ val: s, y: py(s) }));

    const MAX_X_LABELS = 7;
    const step = Math.max(1, Math.ceil((scores.length - 1) / (MAX_X_LABELS - 1)));
    const xLabels = data
      .map((h, i) => ({ i, label: fmtLabel(h.date) }))
      .filter(({ i }) => i % step === 0 || i === data.length - 1);

    return (
      <svg width={W} height={H} style={{ display: 'block', overflow: 'visible', cursor: 'crosshair' }}
        onMouseLeave={() => setTooltip(null)}>
        <defs>
          <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={lineColor} stopOpacity="0.22" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
          </linearGradient>
          <clipPath id="graph-clip">
            <rect x={pad.l} y={pad.t} width={innerW} height={innerH + 1} />
          </clipPath>
        </defs>

        {yLabels.map(({ val, y }, i) => (
          <g key={i}>
            <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="var(--border)" strokeWidth="1" />
            <text x={pad.l - 6} y={y + 3} fontSize="8" fill="var(--text-faint)" textAnchor="end"
              fontFamily="'SF Mono','Menlo',monospace">{val.toFixed(0)}</text>
          </g>
        ))}

        <g clipPath="url(#graph-clip)">
          <path d={areaPath} fill="url(#hg)" />
          <polyline points={pts} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" opacity="0.9" />
        </g>

        {scores.map((s, i) => (
          <rect key={i}
            x={i === 0 ? pad.l : (px(i - 1) + px(i)) / 2} y={pad.t}
            width={i === 0 ? (px(1) - px(0)) / 2 : i === scores.length - 1 ? (px(i) - px(i - 1)) / 2 : (px(i + 1) - px(i - 1)) / 2}
            height={innerH} fill="transparent" style={{ cursor: 'pointer' }}
            onMouseEnter={() => setTooltip({ x: px(i), y: py(s), score: s, date: data[i]!.date })}
            onClick={() => {
              const d = data[i]!.date;
              if (selectedDate === d) { setSelectedDate(null); setSnapshotDetail(null); return; }
              setSelectedDate(d);
              setSnapshotDetail(null);
              if (granularity === 'day') {
                window.api.getSnapshotDetailForDay(d.slice(0, 10)).then(setSnapshotDetail);
              } else {
                window.api.getSnapshotDetail(d).then(setSnapshotDetail);
              }
            }}
          />
        ))}

        {tooltip && (
          <g pointerEvents="none">
            <line x1={tooltip.x} y1={pad.t} x2={tooltip.x} y2={H - pad.b}
              stroke="var(--border-hover)" strokeWidth="1" strokeDasharray="3,3" />
            <circle cx={tooltip.x} cy={tooltip.y} r={4} fill={lineColor} />
            <circle cx={tooltip.x} cy={tooltip.y} r={8} fill={lineColor} opacity={0.12} />
          </g>
        )}
        {!tooltip && <circle cx={px(scores.length - 1)} cy={py(lastScore)} r={3} fill={lineColor} opacity={0.95} pointerEvents="none" />}

        {/* Marqueur de point sélectionné */}
        {selectedDate && (() => {
          const si = data.findIndex(d => d.date === selectedDate);
          if (si === -1) return null;
          const sx = px(si), sy = py(scores[si]!);
          return (
            <g pointerEvents="none">
              <line x1={sx} y1={pad.t} x2={sx} y2={H - pad.b} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
              <circle cx={sx} cy={sy} r={5} fill={lineColor} opacity={0.9} />
              <circle cx={sx} cy={sy} r={9} fill={lineColor} opacity={0.15} />
            </g>
          );
        })()}

        <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke="var(--border)" strokeWidth="1" />

        {xLabels.map(({ i, label }) => (
          <text key={i} x={px(i)} y={H - 6} textAnchor="middle" fontSize="8"
            fill="var(--text-ghost)" fontFamily="'SF Mono','Menlo',monospace">{label}</text>
        ))}
      </svg>
    );
  }

  // ── Scrollbar simple ──────────────────────────────────────────────────────
  const scrollbarRef = useRef<SVGSVGElement>(null);

  function renderScrollbar() {
    const padL = 40, padR = 16;
    const trackW = graphW - padL - padR;
    const thumbW = Math.max(24, (effectiveWindow / totalPts) * trackW);
    const thumbX = padL + ((maxOffset - clampedOffset) / Math.max(1, maxOffset)) * (trackW - thumbW);

    function offsetFromClientX(clientX: number) {
      const rect = scrollbarRef.current?.getBoundingClientRect();
      if (!rect) return clampedOffset;
      const x = clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, (x - padL - thumbW / 2) / (trackW - thumbW)));
      return Math.round((1 - ratio) * maxOffset);
    }

    function onMouseDown(e: React.MouseEvent) {
      setPanOffset(offsetFromClientX(e.clientX));

      function onMove(ev: MouseEvent) {
        setPanOffset(offsetFromClientX(ev.clientX));
      }
      function onUp() {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      }
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }

    return (
      <div style={{ padding: '6px 8px 8px' }}>
        <svg ref={scrollbarRef} width={graphW} height={12}
          style={{ display: 'block', cursor: 'pointer', userSelect: 'none' }}
          onMouseDown={onMouseDown}
        >
          <rect x={padL} y={4} width={trackW} height={4} rx={2} fill="var(--bg-card)" />
          <rect x={thumbX} y={2} width={thumbW} height={8} rx={4} fill={lineColor} opacity={0.5} />
        </svg>
      </div>
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
            {canPan && <span style={{ color: 'var(--text-ghost)', marginLeft: 6 }}>/ {totalPts} {t('history.points')}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          {!singlePoint && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 24, fontWeight: 200, letterSpacing: '-1px', lineHeight: 1,
                color: deltaScore < 0 ? '#34c759' : deltaScore > 0 ? '#ff453a' : 'var(--text-secondary)' }}>
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
          { label: t('history.average'), value: avgScore.toFixed(1),            color: scoreColor(avgScore)  },
          { label: t('history.best'),    value: Math.min(...scores).toFixed(1), color: 'var(--green)'        },
          { label: t('history.worst'),   value: Math.max(...scores).toFixed(1), color: 'var(--red)'          },
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

      {/* Graphe */}
      <div ref={graphRef} style={{ position: 'relative', background: 'var(--bg-hover)', borderRadius: 12, border: '0.5px solid var(--border)', marginBottom: 20, overflow: 'hidden' }}>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
              {canPan
                ? `${data.length} / ${totalPts} ${granularity === 'scan' ? t('history.points') : t('history.days')}`
                : `${data.length} ${granularity === 'scan' ? t('history.points') : t('history.days')}`}
            </span>
            {totalPts > 30 && (
              <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: 5, padding: 1, gap: 1 }}>
                {([...WINDOW_PRESETS, 'all'] as const).map(p => {
                  const active  = windowSize === p;
                  const label   = p === 'all' ? t('history.all') : String(p);
                  const hidden  = p !== 'all' && (p as number) >= totalPts;
                  if (hidden) return null;
                  return (
                    <button key={String(p)} onClick={() => setWindowSize(p)} style={{
                      fontSize: 9, fontWeight: 500, padding: '2px 7px', borderRadius: 4,
                      cursor: active ? 'default' : 'pointer', border: 'none', fontFamily: 'inherit', transition: 'all 0.12s',
                      background: active ? 'var(--bg-surface)' : 'transparent',
                      color:      active ? 'var(--text-primary)' : 'var(--text-faint)',
                      boxShadow:  active ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
                    }}>{label}</button>
                  );
                })}
              </div>
            )}
          </div>
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

        {/* Main graph */}
        <div style={{ padding: '4px 0 0' }}>
          {renderMainGraph(graphW, 180)}
        </div>

        {/* Navigator */}
        {canPan && (
          <div style={{ borderTop: '0.5px solid var(--border)' }}>
            {renderScrollbar()}
          </div>
        )}

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

      {/* Delta panel — always visible, shows latest by default or selected point */}
      {(() => {
        const detail   = selectedDate ? snapshotDetail : latestDetail;
        const isLatest = !selectedDate;

        const headerLabel = isLatest
          ? t('history.latestChanges')
          : (() => { const d = new Date(selectedDate!); return `${d.getDate()}/${d.getMonth()+1}/${String(d.getFullYear()).slice(2)} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; })();

        return (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 9, letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)' }}>
                {headerLabel}
              </div>
              {!isLatest && (
                <button onClick={() => { setSelectedDate(null); setSnapshotDetail(null); setPanOffset(0); }} style={{
                  background: 'var(--bg-hover)', border: '0.5px solid var(--border)', borderRadius: 5,
                  cursor: 'pointer', color: 'var(--text-muted)', fontSize: 9, padding: '2px 8px',
                  fontFamily: 'inherit', transition: 'all 0.12s',
                }}>{t('history.backToToday')}</button>
              )}
            </div>

            {!detail && (
              <div style={{ fontSize: 10, color: 'var(--text-faint)', fontStyle: 'italic' }}>{t('history.loading')}</div>
            )}

            {detail && !detail.prevDate && (
              <div style={{ fontSize: 10, color: 'var(--text-faint)', fontStyle: 'italic' }}>{t('history.firstScan')}</div>
            )}

            {detail?.prevDate && detail.degraded.length === 0 && detail.improved.length === 0 && detail.newFiles.length === 0 && (
              <div style={{ fontSize: 10, color: 'var(--green)', fontStyle: 'italic' }}>{t('history.noChange')}</div>
            )}

            {detail?.prevDate && (
              <div style={{ display: 'grid', gridTemplateColumns: detail.degraded.length > 0 && detail.improved.length > 0 ? '1fr 1fr' : '1fr', gap: 12 }}>
                {detail.degraded.length > 0 && (
                  <div>
                    <div style={{ fontSize: 9, letterSpacing: '0.10em', color: '#ff453a', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>{t('history.degradedAt')}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {detail.degraded.map(f => (
                        <div key={f.filePath} onClick={() => onSelectScan(f.filePath)}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                            background: 'rgba(255,69,58,0.06)', border: '0.5px solid rgba(255,69,58,0.2)',
                            borderLeft: '2px solid #ff453a', borderRadius: 7, cursor: 'pointer' }}>
                          <span style={{ flex: 1, fontSize: 11, color: 'var(--text-secondary)', fontFamily: "'SF Mono','Menlo',monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {f.filePath.split('/').pop()}
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: "'SF Mono','Menlo',monospace", flexShrink: 0 }}>
                            {f.prev.toFixed(1)} → {f.curr.toFixed(1)}
                          </span>
                          <span style={{ fontSize: 10, color: '#ff453a', fontFamily: "'SF Mono','Menlo',monospace", flexShrink: 0 }}>
                            +{f.delta.toFixed(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {detail.improved.length > 0 && (
                  <div>
                    <div style={{ fontSize: 9, letterSpacing: '0.10em', color: '#34c759', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>{t('history.improvedAt')}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {detail.improved.map(f => (
                        <div key={f.filePath} onClick={() => onSelectScan(f.filePath)}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                            background: 'rgba(52,199,89,0.06)', border: '0.5px solid rgba(52,199,89,0.2)',
                            borderLeft: '2px solid #34c759', borderRadius: 7, cursor: 'pointer' }}>
                          <span style={{ flex: 1, fontSize: 11, color: 'var(--text-secondary)', fontFamily: "'SF Mono','Menlo',monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {f.filePath.split('/').pop()}
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: "'SF Mono','Menlo',monospace", flexShrink: 0 }}>
                            {f.prev.toFixed(1)} → {f.curr.toFixed(1)}
                          </span>
                          <span style={{ fontSize: 10, color: '#34c759', fontFamily: "'SF Mono','Menlo',monospace", flexShrink: 0 }}>
                            {f.delta.toFixed(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
