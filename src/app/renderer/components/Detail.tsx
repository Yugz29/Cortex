import { useState, useEffect } from 'react';
import type { Scan, Edge, FunctionDetail } from '../types';
import { scoreColor, classifyLayer, LAYER_LABELS, LAYER_COLORS } from '../utils';
import { useLocale } from '../hooks/useLocale';
import ScoreGraph from './shared/ScoreGraph';
import MetricBar from './shared/MetricBar';
import SectionLabel from './shared/SectionLabel';

interface Props {
  scan:            Scan;
  onClose:         () => void;
  edges:           Edge[];
  onFocusFunction: (fn: FunctionDetail, filePath: string) => void;
}

export default function Detail({ scan, onClose, edges, onFocusFunction }: Props) {
  const { t } = useLocale();
  const [functions,   setFunctions]   = useState<FunctionDetail[]>([]);
  const [history,     setHistory]     = useState<{ score: number; scanned_at: string }[]>([]);
  const [activeTab,   setActiveTab]   = useState<'metrics' | 'functions'>('metrics');
  const [selectedFn,  setSelectedFn]  = useState<FunctionDetail | null>(null);

  useEffect(() => {
    setActiveTab('metrics');
    setSelectedFn(null);
    window.api.getFunctions(scan.filePath).then(setFunctions);
  }, [scan.filePath]);

  // Recharger l'historique à chaque nouveau scan du fichier (score peut changer sans changer de fichier)
  useEffect(() => {
    window.api.getScoreHistory(scan.filePath).then(setHistory);
  }, [scan.filePath, scan.globalScore]);

  const color = scoreColor(scan.globalScore);
  const l     = classifyLayer(scan.filePath);
  const lc    = LAYER_COLORS[l];

  const tabStyle = (tab: 'metrics' | 'functions'): React.CSSProperties => ({
    flex: 1, padding: '9px 0', fontSize: 11, letterSpacing: '0.06em', fontWeight: 500,
    cursor: 'pointer', border: 'none',
    borderBottom: activeTab === tab ? '1.5px solid var(--blue)' : '1.5px solid transparent',
    background: 'transparent',
    color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
    transition: 'color 0.15s', fontFamily: 'inherit',
  });

  const namedFunctions = functions.filter(fn => fn.name !== 'anonymous');

  // Helpers explain traduits
  const explainCx  = (s: number, n: number) =>
    s >= 60 ? t('metric.expl.cyclomatic.critical', { n }) : s >= 30 ? t('metric.expl.cyclomatic.warn', { n }) : undefined;
  const explainCog = (s: number, n: number) =>
    s >= 60 ? t('metric.expl.cognitive.critical', { n }) : s >= 30 ? t('metric.expl.cognitive.warn', { n }) : undefined;
  const explainSz  = (s: number, n: number) =>
    s >= 60 ? t('metric.expl.funcSize.critical', { n }) : s >= 30 ? t('metric.expl.funcSize.warn', { n }) : undefined;
  const explainCh  = (s: number, n: number) =>
    s >= 60 ? t('metric.expl.churn.critical', { n }) : s >= 30 ? t('metric.expl.churn.warn', { n }) : undefined;
  const explainDp  = (s: number, n: number) =>
    s >= 60 ? t('metric.expl.depth.critical', { n }) : s >= 30 ? t('metric.expl.depth.warn', { n }) : undefined;
  const explainPr  = (s: number, n: number) =>
    s >= 60 ? t('metric.expl.params.critical', { n }) : s >= 30 ? t('metric.expl.params.warn', { n }) : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ padding: '18px 16px 0', flexShrink: 0, borderBottom: '0.5px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
            <div style={{
              fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
              marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {scan.filePath.split('/').pop()}
            </div>
            <div style={{
              fontSize: 10, color: 'var(--text-muted)', wordBreak: 'break-all',
              lineHeight: 1.55, fontFamily: "'SF Mono','Menlo',monospace",
            }}>
              {scan.filePath}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: 20, padding: '0 2px',
              lineHeight: 1, flexShrink: 0, transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >×</button>
        </div>

        {/* Layer tag */}
        <div style={{ marginBottom: 12 }}>
          <span style={{
            fontSize: 10, fontWeight: 500, letterSpacing: '0.08em',
            padding: '2px 8px', borderRadius: 4, display: 'inline-block',
            color: lc, background: `${lc}18`, border: `0.5px solid ${lc}38`,
          }}>
            {LAYER_LABELS[l]}
          </span>
        </div>

        {/* Score principal */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingBottom: 14 }}>
          <span style={{ fontSize: 44, fontWeight: 200, color, letterSpacing: '-2px', lineHeight: 1 }}>
            {scan.globalScore.toFixed(1)}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('detail.tension')}</span>
          <span style={{
            marginLeft: 'auto', fontSize: 22, lineHeight: 1,
            color: scan.trend === '↑' ? 'var(--red)' : scan.trend === '↓' ? 'var(--green)' : 'var(--border-strong)',
          }}>
            {scan.trend}
          </span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex' }}>
          <button style={tabStyle('metrics')} onClick={() => setActiveTab('metrics')}>
            {t('detail.tabs.metrics')}
          </button>
          {namedFunctions.length > 0 && (
            <button style={tabStyle('functions')} onClick={() => setActiveTab('functions')}>
              {t('detail.tabs.functions')} · {namedFunctions.length}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px' }}>

        {activeTab === 'metrics' && (
          <>
            {/* History */}
            {history.length >= 1 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <SectionLabel>{t('detail.history')}</SectionLabel>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'SF Mono','Menlo',monospace" }}>
                    {history.length} point{history.length > 1 ? 's' : ''}
                  </span>
                </div>
                <ScoreGraph history={history} width={265} height={80} showDates={true} />
              </div>
            )}

            <div style={{ marginBottom: 6 }}><SectionLabel>{t('detail.breakdown')}</SectionLabel></div>

            <MetricBar
              label={t('metric.label.cyclomatic')}
              score={scan.complexityScore} rawLabel="max" rawValue={scan.rawComplexity}
              desc={t('metric.desc.cyclomatic')}
              explain={explainCx(scan.complexityScore, scan.rawComplexity)} />
            <MetricBar
              label={t('metric.label.cognitive')}
              score={scan.cognitiveComplexityScore ?? 0} rawLabel="max" rawValue={scan.rawCognitiveComplexity ?? 0}
              desc={t('metric.desc.cognitive')}
              explain={explainCog(scan.cognitiveComplexityScore ?? 0, scan.rawCognitiveComplexity ?? 0)} />
            <MetricBar
              label={t('metric.label.funcSize')}
              score={scan.functionSizeScore} rawLabel="max" rawValue={`${scan.rawFunctionSize}L`}
              desc={t('metric.desc.funcSize')}
              explain={explainSz(scan.functionSizeScore, scan.rawFunctionSize)} />
            <MetricBar
              label={t('metric.label.churn')}
              score={scan.churnScore} rawLabel="commits" rawValue={scan.rawChurn}
              desc={t('metric.desc.churn')}
              explain={explainCh(scan.churnScore, scan.rawChurn)} />
            <MetricBar
              label={t('metric.label.depth')}
              score={scan.depthScore} rawLabel="max" rawValue={scan.rawDepth}
              desc={t('metric.desc.depth')}
              explain={explainDp(scan.depthScore, scan.rawDepth)} />
            <MetricBar
              label={t('metric.label.params')}
              score={scan.paramScore} rawLabel="max" rawValue={scan.rawParams}
              desc={t('metric.desc.params')}
              explain={explainPr(scan.paramScore, scan.rawParams)} />

            {/* Coupling */}
            {(() => {
              const usedBy = scan.fanIn;
              const uses   = scan.fanOut;
              const ucol   = usedBy > 10 ? 'var(--red)' : usedBy > 5 ? 'var(--orange)' : 'var(--text-secondary)';
              const ocol   = uses   > 10 ? 'var(--red)' : uses   > 5 ? 'var(--orange)' : 'var(--text-secondary)';

              const usedBySub = usedBy === 0
                ? t('detail.notImported')
                : t('detail.dependOn', { n: usedBy, s: usedBy > 1 ? 's' : '', ent: usedBy > 1 ? 'ent' : '' });
              const usesSub = uses === 0
                ? t('detail.noDeps')
                : t('detail.dependency', { n: uses, s: uses > 1 ? 's' : '', y: uses > 1 ? 'ies' : 'y' });

              return (
                <div style={{ marginTop: 20 }}>
                  <div style={{ marginBottom: 10 }}><SectionLabel>{t('detail.coupling')}</SectionLabel></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    {[
                      { lbl: t('detail.usedBy'), val: usedBy, col: ucol, sub: usedBySub },
                      { lbl: t('detail.uses'),   val: uses,   col: ocol, sub: usesSub   },
                    ].map(item => (
                      <div key={item.lbl} style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 8, padding: '12px 12px' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5, fontWeight: 500 }}>{item.lbl}</div>
                        <div style={{ fontSize: 28, fontWeight: 200, color: item.col, lineHeight: 1, marginBottom: 4 }}>{item.val}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.sub}</div>
                      </div>
                    ))}
                  </div>
                  {usedBy > 5 && (
                    <div style={{
                      fontSize: 10, lineHeight: 1.55, padding: '6px 10px',
                      background: usedBy > 10 ? 'var(--explain-red-bg)' : 'var(--explain-org-bg)',
                      borderLeft: `2px solid ${usedBy > 10 ? 'var(--red)' : 'var(--orange)'}`,
                      borderRadius: '0 4px 4px 0', marginBottom: 5,
                      color: usedBy > 10 ? 'var(--explain-red-text)' : 'var(--explain-org-text)',
                    }}>
                      {t('detail.widelyImported', { n: usedBy })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Hotspot */}
            {scan.hotspotScore > 0 && (
              <div style={{ marginTop: 18, padding: '12px 0', borderTop: '0.5px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <span style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 500 }}>
                    {t('detail.hotspot')}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: scan.hotspotScore >= 60 ? 'var(--red)' : 'var(--orange)' }}>
                    {scan.hotspotScore.toFixed(1)}
                  </span>
                </div>
                <div style={{ height: 3, background: 'var(--score-bar-bg)', borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ height: '100%', width: `${Math.min(100, (scan.hotspotScore / 150) * 100)}%`, background: scan.hotspotScore >= 60 ? 'var(--red)' : 'var(--orange)', borderRadius: 2, transition: 'width 0.4s ease' }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {t('detail.hotspotDesc')}
                </div>
              </div>
            )}

            {/* Language */}
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 500 }}>
                {t('detail.language')}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: "'SF Mono','Menlo',monospace" }}>
                {scan.language}
              </span>
            </div>
          </>
        )}

        {activeTab === 'functions' && (
          selectedFn
            ? <FunctionDetailPanel fn={selectedFn} onBack={() => setSelectedFn(null)} onViewInCenter={() => onFocusFunction(selectedFn, scan.filePath)} />
            : <FunctionList fns={namedFunctions} onSelect={setSelectedFn} t={t} />
        )}
      </div>
    </div>
  );
}

// ── FunctionList ──────────────────────────────────────────────────────────────

function FunctionList({
  fns, onSelect, t,
}: {
  fns: FunctionDetail[];
  onSelect: (fn: FunctionDetail) => void;
  t: (key: string, p?: any) => string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  if (fns.length === 0) {
    return (
      <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '12px 0' }}>
        {t('detail.noFunctions')}
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: 10 }}><SectionLabel>{t('detail.tabs.functions')}</SectionLabel></div>
      {fns.map(fn => {
        const key     = fn.name + fn.start_line;
        const isHov   = hovered === key;
        const cxCol   = fn.cyclomatic_complexity > 10 ? 'var(--red)' : fn.cyclomatic_complexity > 5 ? 'var(--orange)' : 'var(--text-secondary)';
        const cogCol  = (fn.cognitive_complexity ?? 0) > 20 ? 'var(--red)' : (fn.cognitive_complexity ?? 0) > 10 ? 'var(--orange)' : 'var(--text-secondary)';
        const pCol    = fn.parameter_count > 5 ? 'var(--red)' : 'var(--text-secondary)';
        const dCol    = fn.max_depth > 4 ? 'var(--red)' : fn.max_depth > 2 ? 'var(--orange)' : 'var(--text-secondary)';

        return (
          <div
            key={key}
            onClick={() => onSelect(fn)}
            onMouseEnter={() => setHovered(key)}
            onMouseLeave={() => setHovered(null)}
            style={{
              padding: '10px 8px',
              borderBottom: '0.5px solid var(--border)',
              cursor: 'pointer',
              borderRadius: 4,
              background: isHov ? 'var(--bg-card)' : 'transparent',
              transition: 'background 0.12s',
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <span style={{
                fontSize: 12, color: 'var(--text-primary)',
                fontFamily: "'SF Mono','Menlo',monospace", fontWeight: 500,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
              }}>
                {fn.name}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>›</span>
            </div>
            <div style={{ display: 'flex', gap: 10, fontSize: 10, flexWrap: 'wrap' }}>
              {[
                { v: `l.${fn.start_line}`,                col: 'var(--text-muted)' },
                { v: `${fn.line_count}L`,                  col: 'var(--text-muted)' },
                { v: `cx:${fn.cyclomatic_complexity}`,     col: cxCol  },
                { v: `cog:${fn.cognitive_complexity ?? 0}`, col: cogCol },
                { v: `p:${fn.parameter_count}`,            col: pCol   },
                { v: `d:${fn.max_depth}`,                  col: dCol   },
              ].map(item => (
                <span key={item.v} style={{ color: item.col, fontFamily: "'SF Mono','Menlo',monospace" }}>{item.v}</span>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

// ── FunctionDetailPanel ───────────────────────────────────────────────────────

function clamp(value: number, safe: number, danger: number): number {
  if (value <= safe)   return 0;
  if (value >= danger) return 100;
  return ((value - safe) / (danger - safe)) * 100;
}

function FnMetricBar({
  label, value, score, desc,
}: {
  label: string;
  value: string | number;
  score: number;
  desc?: string;
}) {
  const col = score >= 60 ? 'var(--red)' : score >= 30 ? 'var(--orange)' : 'var(--green)';
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>{label}</span>
        <span style={{ fontSize: 11, fontFamily: "'SF Mono','Menlo',monospace", color: col, fontWeight: 600 }}>{value}</span>
      </div>
      <div style={{ height: 3, background: 'var(--score-bar-bg)', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
        <div style={{ height: '100%', width: `${score}%`, background: col, borderRadius: 2, transition: 'width 0.35s ease' }} />
      </div>
      {desc && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>{desc}</div>
      )}
    </div>
  );
}

function FunctionDetailPanel({
  fn, onBack, onViewInCenter,
}: {
  fn: FunctionDetail;
  onBack: () => void;
  onViewInCenter: () => void;
}) {
  const { t } = useLocale();

  // Seuils alignés sur ABS_SAFE / ABS_DANGER de riskScore.ts
  const cxScore  = clamp(fn.cyclomatic_complexity, 3, 15);
  const cogScore = clamp(fn.cognitive_complexity ?? 0, 8, 60);
  const pScore   = clamp(fn.parameter_count, 3, 8);
  const dScore   = clamp(fn.max_depth, 2, 6);
  const szScore  = clamp(fn.line_count, 20, 80);

  const cxDesc  = t(cxScore  >= 60 ? 'fn.cx.critical'     : cxScore  >= 30 ? 'fn.cx.warn'     : 'fn.cx.ok');
  const cogDesc = t(cogScore >= 60 ? 'fn.cog.critical'    : cogScore >= 30 ? 'fn.cog.warn'    : 'fn.cog.ok');
  const szDesc  = t(szScore  >= 60 ? 'fn.size.critical'   : szScore  >= 30 ? 'fn.size.warn'   : 'fn.size.ok');
  const pDesc   = t(pScore   >= 60 ? 'fn.params.critical' : pScore   >= 30 ? 'fn.params.warn' : 'fn.params.ok');
  const dDesc   = t(dScore   >= 60 ? 'fn.depth.critical'  : dScore   >= 30 ? 'fn.depth.warn'  : 'fn.depth.ok');

  const worstScore = Math.max(cxScore, cogScore, pScore, dScore, szScore);
  const worstCol   = worstScore >= 60 ? 'var(--red)' : worstScore >= 30 ? 'var(--orange)' : 'var(--green)';

  return (
    <div>
      {/* Back */}
      <button
        onClick={onBack}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: 11,
          padding: '0 0 14px', fontFamily: 'inherit',
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
      >
        {t('fn.back')}
      </button>

      {/* Header fonction */}
      <div style={{
        padding: '14px 12px', borderRadius: 6,
        background: 'var(--bg-card)', border: '0.5px solid var(--border)',
        marginBottom: 20,
      }}>
        <div style={{
          fontSize: 13, fontFamily: "'SF Mono','Menlo',monospace", fontWeight: 600,
          color: 'var(--text-primary)', marginBottom: 8,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {fn.name}
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 10, color: 'var(--text-muted)', fontFamily: "'SF Mono','Menlo',monospace" }}>
          <span>{t('fn.line')} {fn.start_line}</span>
          <span>{fn.line_count} {t('fn.lines')}</span>
        </div>
        {/* Pire métrique */}
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 28, fontWeight: 200, color: worstCol, letterSpacing: '-1px', lineHeight: 1 }}>
            {worstScore.toFixed(0)}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('fn.topSignal')}</span>
        </div>
      </div>

      {/* Bouton voir dans le code */}
      <button
        onClick={onViewInCenter}
        style={{
          width: '100%', padding: '9px 0', marginBottom: 20,
          background: 'var(--bg-card)', border: '0.5px solid var(--border)',
          borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 11, color: 'var(--blue)', letterSpacing: '0.04em',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          transition: 'background 0.15s, border-color 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--blue) 8%, var(--bg-card))'; e.currentTarget.style.borderColor = 'var(--blue)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
      >
        <span style={{ fontSize: 13 }}>⌥</span> {t('fn.seeInCode')}
      </button>

      {/* Métriques */}
      <div style={{ marginBottom: 8 }}><SectionLabel>{t('fn.detail')}</SectionLabel></div>
      <FnMetricBar label={t('fn.label.cyclomatic')} value={fn.cyclomatic_complexity}     score={cxScore}  desc={cxDesc}  />
      <FnMetricBar label={t('fn.label.cognitive')}  value={fn.cognitive_complexity ?? 0} score={cogScore} desc={cogDesc} />
      <FnMetricBar label={t('fn.label.size')}        value={`${fn.line_count}L`}          score={szScore}  desc={szDesc}  />
      <FnMetricBar label={t('fn.label.params')}      value={fn.parameter_count}           score={pScore}   desc={pDesc}   />
      <FnMetricBar label={t('fn.label.depth')}       value={fn.max_depth}                 score={dScore}   desc={dDesc}   />
    </div>
  );
}
