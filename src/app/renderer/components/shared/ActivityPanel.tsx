import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocale } from '../../hooks/useLocale';
import type { Scan } from '../../types';

interface Event { message: string; level: string; type: string; ts: number; filePath?: string | null; }

interface Props {
  events:       Event[];
  scans:        Scan[];
  onSelectScan: (scan: Scan | null) => void;
}

// ── Couleurs par niveau ───────────────────────────────────────────────────────
const levelColor = (lvl: string) =>
  lvl === 'critical' ? '#ff453a'
  : lvl === 'warn'   ? '#ff9f0a'
  : lvl === 'ok'     ? '#34c759'
  : 'var(--text-ghost)';

// ── Icône par type d'event ────────────────────────────────────────────────────
function EventIcon({ type, level }: { type: string; level: string }) {
  const col = levelColor(level);
  if (type === 'scan-done' || type === 'scan-start') {
    return (
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ flexShrink: 0, marginTop: 3 }}>
        <circle cx="4" cy="4" r="3" stroke={col} strokeWidth="1.2" />
        <circle cx="4" cy="4" r="1.2" fill={col} />
      </svg>
    );
  }
  if (type === 'threshold' || type === 'degraded') {
    return (
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ flexShrink: 0, marginTop: 3 }}>
        <path d="M4 1L7.5 7H0.5L4 1Z" stroke={col} strokeWidth="1" strokeLinejoin="round" />
        <line x1="4" y1="3.5" x2="4" y2="5.2" stroke={col} strokeWidth="1" strokeLinecap="round" />
        <circle cx="4" cy="6.3" r="0.4" fill={col} />
      </svg>
    );
  }
  if (type === 'improved') {
    return (
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ flexShrink: 0, marginTop: 3 }}>
        <path d="M4 7L0.5 1H7.5L4 7Z" stroke={col} strokeWidth="1" strokeLinejoin="round" />
      </svg>
    );
  }
  // file events + default
  return (
    <div style={{
      width: 5, height: 5, borderRadius: '50%',
      background: col, flexShrink: 0, marginTop: 4,
    }} />
  );
}

// ── Timestamp relatif ─────────────────────────────────────────────────────────
function relTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5)   return 'now';
  if (s < 60)  return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

// ── Groupement des file events par fichier ───────────────────────────────────
const FILE_TYPES = new Set(['changed', 'added', 'deleted']);

interface GroupedEvent {
  type:      string;
  level:     string;
  message:   string;
  ts:        number;
  count:     number;
  id:        number;
  filePath:  string | null; // path complet pour le click
  fileName:  string | null; // nom court pour l'affichage
}

let _uid = 0;
const eventIds = new WeakMap<Event, number>();
function uid(ev: Event): number {
  if (!eventIds.has(ev)) eventIds.set(ev, ++_uid);
  return eventIds.get(ev)!;
}

function groupEvents(events: Event[]): GroupedEvent[] {
  const result: GroupedEvent[] = [];

  for (const ev of events) {
    if (FILE_TYPES.has(ev.type) && ev.filePath) {
      // Cherche un event existant pour ce même fichier (dans les 30 dernières secondes)
      const existing = result.findIndex(
        g => g.filePath === ev.filePath && FILE_TYPES.has(g.type) && ev.ts - g.ts < 30_000
      );
      if (existing !== -1) {
        const g = result[existing]!;
        g.count++;
        g.ts = ev.ts;
        // Déplacer en fin de liste pour que le plus récent soit en bas
        result.splice(existing, 1);
        result.push(g);
        continue;
      }
      const fileName = ev.filePath.split('/').pop() ?? ev.filePath;
      result.push({ ...ev, count: 1, id: uid(ev), filePath: ev.filePath, fileName });
    } else {
      result.push({ ...ev, count: 1, id: uid(ev), filePath: null, fileName: null });
    }
  }
  return result;
}

// ── Dédupliquer watcher-restarted / project-switch ────────────────────────────
const NOISY = new Set(['watcher-restarted', 'project-switch']);

function dedup(events: Event[]): Event[] {
  const seen = new Set<string>();
  return [...events].reverse().filter(ev => {
    if (!NOISY.has(ev.type)) return true;
    if (seen.has(ev.type)) return false;
    seen.add(ev.type); return true;
  }).reverse();
}

// ── Composant ─────────────────────────────────────────────────────────────────
export default function ActivityPanel({ events, scans, onSelectScan }: Props) {
  const { t }               = useLocale();
  const [open,   setOpen]   = useState(true);
  const [height, setHeight] = useState(160);
  const heightRef           = useRef(160);
  const listRef             = useRef<HTMLDivElement>(null);
  const prevCountRef        = useRef(0);
  const [tick, setTick]     = useState(0); // pour rafraîchir les timestamps

  useEffect(() => { heightRef.current = height; }, [height]);

  // Rafraîchir les timestamps toutes les 30s
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const processed = groupEvents(dedup(events));

  // Auto-scroll vers le bas quand de nouveaux events arrivent
  useEffect(() => {
    if (!open) return;
    if (processed.length > prevCountRef.current) {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }
    prevCountRef.current = processed.length;
  }, [processed.length, open]);

  // Clear
  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // On vide via le parent — mais events est read-only ici.
    // On utilise un état local pour masquer les events actuels.
    setHiddenBefore(Date.now());
  }, []);
  const [hiddenBefore, setHiddenBefore] = useState(0);
  const visible = processed.filter(ev => ev.ts > hiddenBefore);

  return (
    <div style={{ flexShrink: 0, borderTop: '0.5px solid var(--border)' }}>

      {/* Drag handle */}
      {open && (
        <div
          style={{ height: 4, cursor: 'ns-resize', background: 'transparent', transition: 'background 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-active)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          onMouseDown={e => {
            e.preventDefault();
            const startY = e.clientY;
            const startH = heightRef.current;
            const onMove = (ev: MouseEvent) => setHeight(Math.max(60, Math.min(400, startH - (ev.clientY - startY))));
            const onUp   = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
          }}
        />
      )}

      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'background 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <span style={{ fontSize: 9, letterSpacing: '0.09em', color: 'var(--text-faint)', textTransform: 'uppercase', flex: 1, textAlign: 'left' }}>
          {t('sidebar.activity')}
        </span>

        {/* Badge count quand fermé */}
        {visible.length > 0 && !open && (
          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 10, background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
            {Math.min(visible.length, 99)}
          </span>
        )}

        {/* Bouton clear */}
        {open && visible.length > 0 && (
          <span
            role="button"
            onClick={handleClear}
            title="Clear"
            style={{
              fontSize: 9, color: 'var(--text-faint)', padding: '1px 5px',
              borderRadius: 4, cursor: 'pointer', letterSpacing: '0.05em',
              WebkitAppRegion: 'no-drag' as any,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)'}
          >
            {t('sidebar.clear')}
          </span>
        )}

        <span style={{ fontSize: 10, color: 'var(--text-faint)', transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'none', display: 'inline-block' }}>›</span>
      </button>

      {/* Liste */}
      {open && (
        <>
          <style>{`
            @keyframes cx-ev-in {
              from { opacity: 0; transform: translateY(4px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          <div
            ref={listRef}
            style={{ overflowY: 'auto', height, padding: '4px 12px 10px' }}
          >
            {visible.length === 0 ? (
              <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '4px 0' }}>
                {t('sidebar.noEvents')}
              </div>
            ) : visible.map((ev, i) => {
              const action = ev.type === 'changed' ? 'modified'
                           : ev.type === 'added'   ? 'added'
                           : ev.type === 'deleted' ? 'deleted'
                           : null;
              const scan = ev.filePath ? scans.find(s => s.filePath === ev.filePath) ?? null : null;
              const isClickable = !!scan;

              return (
                <div
                  key={ev.id}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 7, padding: '3px 0',
                    animation: i >= visible.length - 3 ? 'cx-ev-in 0.2s ease' : 'none',
                  }}
                >
                  <EventIcon type={ev.type} level={ev.level} />

                  {/* Message : nom de fichier cliquable + action + compteur */}
                  <span style={{ flex: 1, fontFamily: "'SF Mono','Menlo',monospace", fontSize: 10, lineHeight: 1.55, minWidth: 0 }}>
                    {ev.fileName && action ? (
                      <>
                        <span
                          onClick={() => scan && onSelectScan(scan)}
                          title={ev.filePath ?? ''}
                          style={{
                            color: isClickable ? 'var(--blue)' : 'var(--text-secondary)',
                            cursor: isClickable ? 'pointer' : 'default',
                            textDecoration: isClickable ? 'underline' : 'none',
                            textUnderlineOffset: 2,
                            textDecorationColor: 'rgba(10,132,255,0.4)',
                            transition: 'opacity 0.12s',
                          }}
                          onMouseEnter={e => { if (isClickable) (e.currentTarget as HTMLElement).style.opacity = '0.7'; }}
                          onMouseLeave={e => { if (isClickable) (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                        >
                          {ev.fileName}
                        </span>
                        <span style={{ color: 'var(--text-ghost)' }}> · {action}</span>
                        {ev.count > 1 && (
                          <span style={{
                            marginLeft: 5, fontSize: 9,
                            color: 'var(--text-ghost)',
                            background: 'var(--bg-active)',
                            border: '0.5px solid var(--border)',
                            borderRadius: 4, padding: '0px 4px',
                          }}>
                            ×{ev.count}
                          </span>
                        )}
                      </>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>{ev.message}</span>
                    )}
                  </span>

                  <span style={{
                    fontSize: 9, color: 'var(--text-ghost)',
                    fontFamily: "'SF Mono','Menlo',monospace",
                    flexShrink: 0, marginTop: 2,
                    opacity: tick >= 0 ? 1 : 0,
                  }}>
                    {relTime(ev.ts)}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
