import type { Scan } from '../../types';
import { scoreColor } from '../../utils';
import { useLocale } from '../../hooks/useLocale';

interface Props {
  visible:       Scan[];
  selected:      Scan | null;
  nameCounts:    Map<string, number>;
  search:        string;
  ignoredSet:    Set<string>;
  onSelect:      (s: Scan | null) => void;
  onIgnore:      (filePath: string) => void;
  onUnignore:    (filePath: string) => void;
}

export default function FileList({ visible, selected, nameCounts, search, ignoredSet, onSelect, onIgnore, onUnignore }: Props) {
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
        const isIgnored  = ignoredSet.has(s.filePath);
        const c          = isIgnored ? 'var(--text-ghost)' : scoreColor(s.globalScore);
        const isSelected = selected?.filePath === s.filePath;
        const name       = s.filePath.split('/').pop() ?? s.filePath;
        const isDup      = (nameCounts.get(name) ?? 0) > 1;
        const parts      = s.filePath.split('/');
        const parent     = parts.length >= 2 ? parts[parts.length - 2] : '';

        return (
          <div key={s.filePath}
            onClick={() => !isIgnored && onSelect(isSelected ? null : s)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
              borderBottom: '0.5px solid var(--border)',
              cursor: isIgnored ? 'default' : 'pointer', transition: 'background 0.1s',
              background: isSelected ? 'var(--bg-active)' : 'transparent',
              opacity: isIgnored ? 0.4 : 1,
              position: 'relative',
            }}
            onMouseEnter={e => { if (!isSelected && !isIgnored) e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
          >
            {/* Point de couleur risque */}
            <div style={{ width: 6, height: 6, background: c, borderRadius: '50%', flexShrink: 0, opacity: s.globalScore === 0 ? 0.15 : 0.85 }} />

            {/* Nom + dossier parent si doublon */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontFamily: "'SF Mono','Menlo',monospace",
                color: isIgnored ? 'var(--text-ghost)' : s.globalScore === 0 ? 'var(--text-faint)' : isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
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
            {s.globalScore > 0 && !isIgnored && (
              <span style={{
                fontFamily: "'SF Mono','Menlo',monospace", fontSize: 11, flexShrink: 0,
                color: isSelected ? c : 'var(--text-secondary)', fontWeight: isSelected ? 600 : 400,
              }}>
                {s.globalScore.toFixed(1)}
              </span>
            )}

            {/* Trend */}
            {s.globalScore > 0 && !isIgnored && (
              <span style={{
                fontFamily: "'SF Mono','Menlo',monospace", fontSize: 10, flexShrink: 0, width: 12, textAlign: 'center',
                color: s.trend === '↑' ? '#ff453a' : s.trend === '↓' ? '#34c759' : 'var(--text-ghost)',
              }}>
                {s.trend}
              </span>
            )}

            {/* Bouton ignore / unignore — toujours visible */}
            <button
              onClick={e => { e.stopPropagation(); isIgnored ? onUnignore(s.filePath) : onIgnore(s.filePath); }}
              title={isIgnored ? 'Réactiver ce fichier' : 'Ignorer ce fichier'}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
                color: isIgnored ? 'var(--text-muted)' : 'var(--text-ghost)',
                fontSize: 13, lineHeight: 1, padding: '0 2px',
                opacity: isIgnored ? 1 : 0.45,
                transition: 'color 0.15s, opacity 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.color = isIgnored ? '#34c759' : '#ff453a';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.opacity = isIgnored ? '1' : '0.45';
                e.currentTarget.style.color = isIgnored ? 'var(--text-muted)' : 'var(--text-ghost)';
              }}
            >
              {isIgnored ? '↺' : 'Ø'}
            </button>
          </div>
        );
      })}
    </>
  );
}
