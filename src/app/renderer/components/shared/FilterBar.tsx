import type { Scan } from '../../types';
import { scoreColor } from '../../utils';
import { useLocale } from '../../hooks/useLocale';
import type { FilterKey } from '../../hooks/useFileFilters';

interface Props {
  scans:          Scan[];
  search:         string;
  activeFilter:   FilterKey;
  showZeroScore:  boolean;
  viewMode:       'list' | 'tree';
  ignoredFiles:   string[];
  visible:        Scan[];
  zeroCount:      number;
  setSearch:      (v: string) => void;
  setActiveFilter:(v: FilterKey) => void;
  setShowZeroScore:(v: boolean | ((p: boolean) => boolean)) => void;
  setViewMode:    (v: 'list' | 'tree') => void;
  clearFilters:   () => void;
}

export default function FilterBar({
  scans, search, activeFilter, showZeroScore, viewMode, ignoredFiles, visible, zeroCount,
  setSearch, setActiveFilter, setShowZeroScore, setViewMode, clearFilters,
}: Props) {
  const { t } = useLocale();
  const stable   = scans.filter(s => s.globalScore < 20).length;
  const stressed = scans.filter(s => s.globalScore >= 20 && s.globalScore < 50).length;
  const critical = scans.filter(s => s.globalScore >= 50).length;

  return (
    <>
      {/* Recherche */}
      <div style={{ padding: '12px 10px 8px', flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: 'var(--bg-input)', border: '0.5px solid var(--border-input)',
          borderRadius: 7, padding: '5px 10px',
        }}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ flexShrink: 0, opacity: 0.35 }}>
            <circle cx="4.5" cy="4.5" r="3.5" stroke="currentColor" strokeWidth="1.2"/>
            <line x1="7.5" y1="7.5" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search modules…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: 11, color: 'var(--text-secondary)',
              fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: 0, lineHeight: 1 }}>×</button>
          )}
        </div>
      </div>

      {/* Filtres */}
      <div style={{ padding: '0 10px 8px', flexShrink: 0, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {([
          { key: null,       label: t('filter.all'),      color: 'var(--text-secondary)', bg: 'var(--bg-hover)',          border: 'var(--border-hover)', count: scans.length },
          { key: 'critical', label: t('filter.critical'),  color: '#ff453a', bg: 'rgba(255,69,58,0.08)',  border: 'rgba(255,69,58,0.2)',  count: critical },
          { key: 'stressed', label: t('filter.stressed'),  color: '#ff9f0a', bg: 'rgba(255,159,10,0.08)', border: 'rgba(255,159,10,0.2)', count: stressed },
          { key: 'healthy',  label: t('filter.healthy'),   color: '#34c759', bg: 'rgba(52,199,89,0.08)',  border: 'rgba(52,199,89,0.2)',  count: stable },
        ] as { key: FilterKey; label: string; color: string; bg: string; border: string; count: number }[]).map(f => {
          const isActive = activeFilter === f.key;
          return (
            <button key={f.label}
              onClick={() => setActiveFilter(isActive ? null : f.key)}
              style={{
                fontSize: 9, fontWeight: 500, padding: '2px 7px', borderRadius: 5,
                cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'inherit', letterSpacing: '0.05em',
                color:      isActive ? f.color : 'var(--text-muted)',
                background: isActive ? f.bg    : 'transparent',
                border:     `0.5px solid ${isActive ? f.border : 'var(--border)'}`,
              }}
            >
              {f.label} <span style={{ opacity: 0.6 }}>{f.count}</span>
            </button>
          );
        })}
        {scans.some(s => s.hotspotScore > 0) && (
          <button
            onClick={() => setActiveFilter(activeFilter === 'hotspot' ? null : 'hotspot')}
            style={{
              fontSize: 9, fontWeight: 500, padding: '2px 7px', borderRadius: 5,
              cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'inherit', letterSpacing: '0.05em',
              color:      activeFilter === 'hotspot' ? '#ff9f0a' : 'var(--text-muted)',
              background: activeFilter === 'hotspot' ? 'rgba(255,159,10,0.08)' : 'transparent',
              border:     `0.5px solid ${activeFilter === 'hotspot' ? 'rgba(255,159,10,0.2)' : 'var(--border)'}`,
            }}
          >{t('filter.hotspots')}</button>
        )}
      </div>

      {/* Barre résultats + toggle vue */}
      <div style={{ padding: '0 12px 6px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 9, color: 'var(--text-faint)', fontFamily: "'SF Mono','Menlo',monospace" }}>
          {visible.length}{search || activeFilter ? `/${scans.length - ignoredFiles.length}` : ''} {t('sidebar.modules')}
        </span>
        {ignoredFiles.length > 0 && (
          <span style={{ fontSize: 9, color: 'var(--text-faint)', fontFamily: "'SF Mono','Menlo',monospace", opacity: 0.6 }}>
            · {ignoredFiles.length} ignoré{ignoredFiles.length > 1 ? 's' : ''}
          </span>
        )}
        {zeroCount > 0 && !search && (
          <button onClick={() => setShowZeroScore(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 9, fontFamily: 'inherit', padding: 0, color: showZeroScore ? 'var(--blue)' : 'var(--text-faint)' }}>
            {showZeroScore ? `▼ ${t('sidebar.hideEmpty')}` : `▶ ${t('sidebar.showEmpty', { n: zeroCount })}`}
          </button>
        )}
        {(search || activeFilter) && (
          <button onClick={clearFilters}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 9, color: 'var(--text-muted)', fontFamily: 'inherit', padding: 0 }}>
            {t('sidebar.clear')}
          </button>
        )}
        {/* Toggle liste / arbre */}
        <div style={{ marginLeft: 'auto', display: 'flex', background: 'var(--bg-card)', borderRadius: 5, padding: 2, gap: 1 }}>
          {(['list', 'tree'] as const).map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)} style={{
              width: 22, height: 18, borderRadius: 3, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: viewMode === mode ? 'var(--bg-surface)' : 'transparent',
              color: viewMode === mode ? 'var(--text-primary)' : 'var(--text-ghost)',
              transition: 'all 0.12s',
            }}>
              {mode === 'list'
                ? <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <line x1="3" y1="2" x2="10" y2="2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    <line x1="3" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    <line x1="3" y1="8" x2="10" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    <circle cx="1.5" cy="2" r="0.8" fill="currentColor"/>
                    <circle cx="1.5" cy="5" r="0.8" fill="currentColor"/>
                    <circle cx="1.5" cy="8" r="0.8" fill="currentColor"/>
                  </svg>
                : <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <line x1="1" y1="2" x2="9" y2="2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    <line x1="3" y1="5" x2="9" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    <line x1="5" y1="8" x2="9" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
              }
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
