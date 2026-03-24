import type { Scan } from '../../types';
import { scoreColor } from '../../utils';
import { useLocale } from '../../hooks/useLocale';

interface Props {
  visible:       Scan[];
  selected:      Scan | null;
  nameCounts:    Map<string, number>;
  search:        string;
  onSelect:      (s: Scan | null) => void;
  onIgnore:      (filePath: string) => void;
}

export default function FileList({ visible, selected, nameCounts, search, onSelect, onIgnore }: Props) {
  const { t } = useLocale();

  if (visible.length === 0) {
    return (
      <div style={{ padding: '20px 14px', fontSize: 11, color: 'var(--text-muted)' }}>
        {search ? t('sidebar.noMatch') : t('sidebar.awaiting')}
      </div>
    );
  }

  return (
    <>
      {visible.map(s => {
        const c          = scoreColor(s.globalScore);
        const isSelected = selected?.filePath === s.filePath;
        const name       = s.filePath.split('/').pop() ?? s.filePath;
        const isDup      = (nameCounts.get(name) ?? 0) > 1;
        const parts      = s.filePath.split('/');
        const parent     = parts.length >= 2 ? parts[parts.length - 2] : '';

        return (
          <div key={s.filePath}
            onClick={() => onSelect(isSelected ? null : s)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
              borderBottom: '0.5px solid var(--border)',
              cursor: 'pointer', transition: 'background 0.1s',
              background: isSelected ? 'var(--bg-active)' : 'transparent',
              position: 'relative',
            }}
            onMouseEnter={e => {
              if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover)';
              const btn = e.currentTarget.querySelector('.ignore-btn') as HTMLElement | null;
              if (btn) btn.style.opacity = '1';
            }}
            onMouseLeave={e => {
              if (!isSelected) e.currentTarget.style.background = 'transparent';
              const btn = e.currentTarget.querySelector('.ignore-btn') as HTMLElement | null;
              if (btn) btn.style.opacity = '0';
            }}
          >
            {/* Barre de couleur risque */}
            <div style={{ width: 2, height: 14, background: c, borderRadius: 1, flexShrink: 0, opacity: s.globalScore === 0 ? 0.15 : 0.85 }} />

            {/* Nom + dossier parent si doublon */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontFamily: "'SF Mono','Menlo',monospace",
                color: s.globalScore === 0 ? 'var(--text-faint)' : isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}>
                {name}
              </div>
              {isDup && (
                <div style={{ fontSize: 9, color: 'var(--text-faint)', fontFamily: "'SF Mono','Menlo',monospace", marginTop: 1 }}>
                  {parent}/
                </div>
              )}
            </div>

            {/* Score */}
            {s.globalScore > 0 && (
              <span style={{
                fontFamily: "'SF Mono','Menlo',monospace", fontSize: 11, flexShrink: 0,
                color: isSelected ? c : 'var(--text-secondary)', fontWeight: isSelected ? 600 : 400,
              }}>
                {s.globalScore.toFixed(1)}
              </span>
            )}

            {/* Trend */}
            {s.globalScore > 0 && (
              <span style={{
                fontFamily: "'SF Mono','Menlo',monospace", fontSize: 10, flexShrink: 0, width: 12, textAlign: 'center',
                color: s.trend === '↑' ? '#ff453a' : s.trend === '↓' ? '#34c759' : 'var(--text-ghost)',
              }}>
                {s.trend}
              </span>
            )}

            {/* Ignorer (hover) */}
            <button
              className="ignore-btn"
              onClick={e => { e.stopPropagation(); onIgnore(s.filePath); }}
              title="Ignorer ce fichier"
              style={{
                opacity: 0, transition: 'opacity 0.15s',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: 14, lineHeight: 1,
                padding: '0 2px', flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ff453a'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              Ø
            </button>
          </div>
        );
      })}
    </>
  );
}
