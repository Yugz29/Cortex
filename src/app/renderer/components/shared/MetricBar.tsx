interface Props {
  label:     string;
  score:     number;
  desc:      string;
  rawLabel?: string;
  rawValue?: number | string;
  explain?:  string;
}

export default function MetricBar({ label, score, desc, rawLabel, rawValue, explain }: Props) {
  const color   = score >= 60 ? 'var(--red)' : score >= 30 ? 'var(--orange)' : 'var(--green)';
  const isCrit  = score >= 60;
  const s       = Math.min(100, Math.max(0, score));

  return (
    <div style={{ padding: '11px 0', borderBottom: '0.5px solid var(--border)' }}>

      {/* Label + valeur */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{
          fontSize: 10, color: 'var(--text-muted)',
          letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500,
        }}>
          {label}
        </span>
        <span style={{ fontSize: 13, color, fontWeight: 600, fontFamily: "'SF Mono','Menlo',monospace" }}>
          {score.toFixed(1)}
        </span>
      </div>

      {/* Barre de progression */}
      <div style={{ height: 3, background: 'var(--score-bar-bg)', borderRadius: 2, marginBottom: 7, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${s}%`, background: color, borderRadius: 2, transition: 'width 0.4s ease' }} />
      </div>

      {/* Description */}
      <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        {desc}
        {rawValue !== undefined && rawLabel && (
          <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontFamily: "'SF Mono','Menlo',monospace", fontSize: 9 }}>
            — {rawLabel} {rawValue}
          </span>
        )}
      </div>

      {/* Explication contextuelle */}
      {explain && score >= 30 && (
        <div style={{
          marginTop: 6, padding: '6px 9px',
          background: isCrit ? 'var(--explain-red-bg)' : 'var(--explain-org-bg)',
          borderLeft: `2px solid ${isCrit ? 'var(--red)' : 'var(--orange)'}`,
          borderRadius: '0 4px 4px 0',
          fontSize: 10, lineHeight: 1.6,
          color: isCrit ? 'var(--explain-red-text)' : 'var(--explain-org-text)',
        }}>
          {explain}
        </div>
      )}
    </div>
  );
}
