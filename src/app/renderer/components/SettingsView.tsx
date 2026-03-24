import { useState, useEffect } from 'react';
import { useLocale } from '../hooks/useLocale';

interface Props {
  onClose: () => void;
}

const DEFAULT_DIRS = [
  'node_modules', '.git', 'dist', 'build', 'out', '.vite',
  'vendor', '__pycache__', 'assets', 'venv', '.venv', 'env',
  'site-packages', 'migrations',
];

export default function SettingsView({ onClose }: Props) {
  const { locale, toggle: toggleLocale, t } = useLocale();

  const [ignoreDirs,       setIgnoreDirs]       = useState<string[]>([]);
  const [ignoredFiles,     setIgnoredFiles]     = useState<string[]>([]);
  const [newDir,           setNewDir]           = useState('');
  const [saved,            setSaved]            = useState(false);
  const [autoSecurityScan, setAutoSecurityScan] = useState(true);

  useEffect(() => {
    Promise.all([window.api.getSettings(), window.api.getIgnoredFiles()])
      .then(([settings, files]) => {
        setIgnoreDirs(settings.ignore ?? DEFAULT_DIRS);
        setIgnoredFiles(files);
        setAutoSecurityScan(settings.autoSecurityScan !== false);
      });
  }, []);

  async function toggleAutoSecurity(val: boolean) {
    setAutoSecurityScan(val);
    const settings = await window.api.getSettings();
    await window.api.saveSettings({ ...settings, autoSecurityScan: val });
  }

  async function saveDirs(dirs: string[]) {
    setIgnoreDirs(dirs);
    const settings = await window.api.getSettings();
    await window.api.saveSettings({ ...settings, ignore: dirs });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  function addDir() {
    const v = newDir.trim().replace(/[/\\]/g, '');
    if (!v || ignoreDirs.includes(v)) return;
    saveDirs([...ignoreDirs, v]);
    setNewDir('');
  }

  async function unignoreFile(fp: string) {
    const list = await window.api.unignoreFile(fp);
    setIgnoredFiles(list);
  }

  const customDirs = ignoreDirs.filter(d => !DEFAULT_DIRS.includes(d));
  const mono: React.CSSProperties = { fontFamily: "'SF Mono','Menlo',monospace" };
  const count = ignoredFiles.length;

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Langue ── */}
      <section style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>
          {t('settings.language')}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {([{ code: 'fr' as const, label: 'Français', flag: 'FR' }, { code: 'en' as const, label: 'English', flag: 'EN' }]).map(lang => {
            const active = locale === lang.code;
            return (
              <button key={lang.code} onClick={() => { if (!active) toggleLocale(); }} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 14px', borderRadius: 7, cursor: active ? 'default' : 'pointer',
                fontSize: 11, fontWeight: active ? 600 : 400,
                border: `0.5px solid ${active ? 'var(--blue)' : 'var(--border)'}`,
                background: active ? 'rgba(10,132,255,0.12)' : 'var(--bg-hover)',
                color: active ? 'var(--blue)' : 'var(--text-muted)',
                transition: 'all 0.12s', fontFamily: 'inherit',
              }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em' }}>{lang.flag}</span>
                <span>{lang.label}</span>
                {active && <svg width="6" height="6" viewBox="0 0 6 6"><circle cx="3" cy="3" r="2.5" fill="var(--blue)"/></svg>}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Security ── */}
      <section style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>
          Security
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Automatic scan on first visit</div>
            <div style={{ fontSize: 10, color: 'var(--text-faint)', lineHeight: 1.6 }}>
              Runs pattern analysis + dependency audit when opening the Security tab.{' '}
              <span style={{ color: 'var(--orange)' }}>Dependency audit requires a network connection.</span>
            </div>
          </div>
          <button
            onClick={() => toggleAutoSecurity(!autoSecurityScan)}
            style={{
              flexShrink: 0, marginTop: 2, width: 36, height: 20, borderRadius: 10, border: 'none',
              cursor: 'pointer', transition: 'background 0.2s', position: 'relative',
              background: autoSecurityScan ? 'var(--blue)' : 'rgba(255,255,255,0.15)',
            }}
          >
            <span style={{
              position: 'absolute', top: 2, borderRadius: '50%', width: 16, height: 16,
              background: '#fff', transition: 'left 0.2s',
              left: autoSecurityScan ? 18 : 2,
            }} />
          </button>
        </div>
      </section>

      {/* ── Exclusions ── */}
      <section style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>
          {t('settings.exclusions')}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10 }}>
            {t('settings.dirsDesc')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
            {DEFAULT_DIRS.map(d => (
              <span key={d} style={{
                ...mono, display: 'inline-flex', alignItems: 'center',
                padding: '2px 8px', borderRadius: 5,
                background: 'var(--bg-hover)', border: '0.5px solid var(--border)',
                fontSize: 10, color: 'var(--text-faint)',
              }}>{d}</span>
            ))}
            {customDirs.map(d => (
              <span key={d} style={{
                ...mono, display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', borderRadius: 5,
                background: 'rgba(10,132,255,0.08)', border: '0.5px solid rgba(10,132,255,0.25)',
                fontSize: 10, color: 'var(--blue)',
              }}>
                {d}
                <button
                  onClick={() => saveDirs(ignoreDirs.filter(x => x !== d))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 13, lineHeight: 1, padding: 0, opacity: 0.6 }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                >×</button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={newDir}
              onChange={e => setNewDir(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addDir()}
              placeholder={t('settings.addDir')}
              style={{
                flex: 1, padding: '6px 10px', borderRadius: 7,
                background: 'var(--bg-input)', border: '0.5px solid var(--border-input)',
                color: 'var(--text-secondary)', fontSize: 11, outline: 'none', ...mono,
              }}
            />
            <button onClick={addDir} style={{
              padding: '6px 14px', borderRadius: 7, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', border: '0.5px solid var(--blue)',
              background: 'rgba(10,132,255,0.1)', color: 'var(--blue)',
              fontFamily: 'inherit', transition: 'all 0.12s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--blue)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(10,132,255,0.1)'; e.currentTarget.style.color = 'var(--blue)'; }}
            >+</button>
          </div>
          {saved && <div style={{ fontSize: 10, color: '#34c759', marginTop: 6 }}>{t('settings.saved')}</div>}
        </div>

        <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {t('settings.ignoredFiles')}
              <span style={{ fontSize: 10, color: 'var(--text-ghost)', marginLeft: 6 }}>
                ({t('settings.ignoredFilesHint')})
              </span>
            </div>
            {count > 0 && (
              <span style={{ fontSize: 10, color: 'var(--text-faint)', flexShrink: 0 }}>
                {t('settings.files', { n: count, s: count > 1 ? 's' : '' })}
              </span>
            )}
          </div>
          {count === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text-ghost)', fontStyle: 'italic' }}>
              {t('settings.noIgnoredFiles')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {ignoredFiles.map(fp => {
                const name   = fp.split('/').pop() ?? fp;
                const parent = fp.split('/').slice(-3, -1).join('/');
                return (
                  <div key={fp} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 10px', borderRadius: 7,
                    background: 'var(--bg-surface)', border: '0.5px solid var(--border)',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...mono, fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                      <div style={{ ...mono, fontSize: 9, color: 'var(--text-faint)', marginTop: 1 }}>…/{parent}/</div>
                    </div>
                    <button onClick={() => unignoreFile(fp)} style={{
                      padding: '3px 10px', borderRadius: 5, fontSize: 10,
                      cursor: 'pointer', border: '0.5px solid rgba(52,199,89,0.3)',
                      background: 'rgba(52,199,89,0.08)', color: '#34c759',
                      fontFamily: 'inherit', transition: 'all 0.12s', flexShrink: 0,
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#34c759'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(52,199,89,0.08)'; e.currentTarget.style.color = '#34c759'; }}
                    >{t('settings.restore')}</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

    </div>
  );
}
