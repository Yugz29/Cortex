import { useState, useMemo, useEffect, useRef } from 'react';
import type { Scan } from '../../types';
import { scoreColor, scoreColorHex } from '../../utils';

interface Props {
  scans:        Scan[];
  projectPath:  string;
  selected:     Scan | null;
  ignoredSet:   Set<string>;
  onSelect:     (scan: Scan | null) => void;
  onIgnore:     (filePath: string) => void;
  showZero:     boolean;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface FileNode { kind: 'file'; name: string; scan: Scan; }
interface DirNode  { kind: 'dir';  name: string; children: TreeNode[]; maxScore: number; fileCount: number; }
type TreeNode = FileNode | DirNode;

// ── Construction de l'arbre ──────────────────────────────────────────────────

function buildTree(scans: Scan[], projectPath: string, ignoredSet: Set<string>, showZero: boolean): DirNode {
  const root: DirNode = { kind: 'dir', name: '', children: [], maxScore: 0, fileCount: 0 };

  const visible = scans.filter(s => {
    if (ignoredSet.has(s.filePath)) return false;
    if (!showZero && s.globalScore === 0) return false;
    return true;
  });

  for (const scan of visible) {
    let rel = scan.filePath;
    if (rel.startsWith(projectPath + '/')) rel = rel.slice(projectPath.length + 1);
    else if (rel.startsWith(projectPath))  rel = rel.slice(projectPath.length);
    const parts = rel.split('/').filter(Boolean);
    if (parts.length === 0) continue;
    let cur = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i]!;
      let child = cur.children.find(c => c.kind === 'dir' && c.name === seg) as DirNode | undefined;
      if (!child) {
        child = { kind: 'dir', name: seg, children: [], maxScore: 0, fileCount: 0 };
        cur.children.push(child);
      }
      cur = child;
    }
    cur.children.push({ kind: 'file', name: parts[parts.length - 1]!, scan });
  }

  function aggregate(node: DirNode): void {
    for (const child of node.children) {
      if (child.kind === 'dir') {
        aggregate(child);
        node.maxScore  = Math.max(node.maxScore, child.maxScore);
        node.fileCount += child.fileCount;
      } else {
        node.maxScore  = Math.max(node.maxScore, child.scan.globalScore);
        node.fileCount += 1;
      }
    }
    node.children.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
      const sa = a.kind === 'dir' ? a.maxScore : a.scan.globalScore;
      const sb = b.kind === 'dir' ? b.maxScore : b.scan.globalScore;
      return sb - sa;
    });
  }
  aggregate(root);
  return root;
}

// ── Calcul des ancêtres du fichier sélectionné ───────────────────────────────
// Retourne un Set des chemins de dossiers à forcer ouverts (ex: "src", "src/app")

function getAncestorPaths(filePath: string, projectPath: string): Set<string> {
  let rel = filePath;
  if (rel.startsWith(projectPath + '/')) rel = rel.slice(projectPath.length + 1);
  else if (rel.startsWith(projectPath))  rel = rel.slice(projectPath.length);
  const parts  = rel.split('/').filter(Boolean);
  const result = new Set<string>();
  for (let i = 0; i < parts.length - 1; i++) {
    result.add(parts.slice(0, i + 1).join('/'));
  }
  return result;
}

// ── Rendu récursif ────────────────────────────────────────────────────────────

function DirRow({ node, depth, dirPath, selected, ancestorPaths, onSelect, onIgnore }: {
  node:          DirNode;
  depth:         number;
  dirPath:       string;       // chemin relatif de ce dossier
  selected:      Scan | null;
  ancestorPaths: Set<string>;  // dossiers à forcer ouverts
  onSelect:      (s: Scan | null) => void;
  onIgnore:      (fp: string) => void;
}) {
  const forceOpen = ancestorPaths.has(dirPath);
  const [open, setOpen] = useState(depth === 0 ? true : depth <= 1 || forceOpen);

  // S'ouvrir automatiquement si un ancêtre du fichier sélectionné
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  const col = node.maxScore >= 50 ? '#ff453a' : node.maxScore >= 20 ? '#ff9f0a' : '#34c759';
  if (node.children.length === 0) return null;

  return (
    <>
      {depth > 0 && (
        <div
          onClick={() => setOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: `4px 12px 4px ${12 + depth * 12}px`,
            cursor: 'pointer', userSelect: 'none',
            borderBottom: '0.5px solid var(--border)',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{
            fontSize: 9, color: 'var(--text-faint)',
            transform: open ? 'rotate(90deg)' : 'none',
            display: 'inline-block', transition: 'transform 0.15s', flexShrink: 0,
          }}>›</span>

          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
            <path d="M1 3.5C1 2.67 1.67 2 2.5 2H4.79l.5.89.71 1.11H10.5c.83 0 1.5.67 1.5 1.5V9.5c0 .83-.67 1.5-1.5 1.5h-8C1.67 11 1 10.33 1 9.5V3.5Z"
              fill={`${col}30`} stroke={col} strokeWidth="0.8"/>
          </svg>

          <span style={{
            flex: 1, fontSize: 11, color: 'var(--text-secondary)',
            fontFamily: "'SF Mono','Menlo',monospace",
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {node.name}
          </span>

          {node.maxScore > 0 && (
            <span style={{ fontSize: 9, color: col, fontFamily: "'SF Mono','Menlo',monospace", flexShrink: 0, opacity: 0.7 }}>
              {node.maxScore.toFixed(0)}
            </span>
          )}
          <span style={{ fontSize: 9, color: 'var(--text-ghost)', flexShrink: 0, marginLeft: 2 }}>
            {node.fileCount}
          </span>
        </div>
      )}

      {(open || depth === 0) && node.children.map((child, i) => {
        if (child.kind === 'dir') {
          const childPath = dirPath ? `${dirPath}/${child.name}` : child.name;
          return (
            <DirRow
              key={child.name + i}
              node={child}
              depth={depth + 1}
              dirPath={childPath}
              selected={selected}
              ancestorPaths={ancestorPaths}
              onSelect={onSelect}
              onIgnore={onIgnore}
            />
          );
        }
        return (
          <FileRow
            key={child.scan.filePath}
            node={child}
            depth={depth + 1}
            selected={selected}
            onSelect={onSelect}
            onIgnore={onIgnore}
          />
        );
      })}
    </>
  );
}

function FileRow({ node, depth, selected, onSelect, onIgnore }: {
  node:     FileNode;
  depth:    number;
  selected: Scan | null;
  onSelect: (s: Scan | null) => void;
  onIgnore: (fp: string) => void;
}) {
  const s          = node.scan;
  const isSelected = selected?.filePath === s.filePath;
  const c          = scoreColor(s.globalScore);
  const hex        = scoreColorHex(s.globalScore);
  const rowRef     = useRef<HTMLDivElement>(null);

  // Scroll into view quand ce fichier devient sélectionné
  useEffect(() => {
    if (isSelected && rowRef.current) {
      rowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isSelected]);

  return (
    <div
      ref={rowRef}
      onClick={() => onSelect(isSelected ? null : s)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: `4px 12px 4px ${12 + depth * 12}px`,
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
      <div style={{
        width: 2, height: 12, borderRadius: 1, flexShrink: 0,
        background: s.globalScore === 0 ? 'var(--border)' : hex,
        opacity: s.globalScore === 0 ? 0.3 : 0.85,
      }} />

      <svg width="10" height="12" viewBox="0 0 10 12" fill="none" style={{ flexShrink: 0, opacity: 0.4 }}>
        <path d="M1 1.5C1 1.22 1.22 1 1.5 1H6l3 3v6.5c0 .28-.22.5-.5.5h-7c-.28 0-.5-.22-.5-.5V1.5Z"
          stroke="currentColor" strokeWidth="0.8"/>
        <path d="M6 1v3h3" stroke="currentColor" strokeWidth="0.8"/>
      </svg>

      <span style={{
        flex: 1, fontSize: 11,
        color: isSelected ? 'var(--text-primary)' : s.globalScore === 0 ? 'var(--text-faint)' : 'var(--text-secondary)',
        fontFamily: "'SF Mono','Menlo',monospace",
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {node.name}
      </span>

      {s.globalScore > 0 && (
        <span style={{
          fontSize: 10, color: isSelected ? c : 'var(--text-secondary)',
          fontFamily: "'SF Mono','Menlo',monospace", flexShrink: 0,
          fontWeight: isSelected ? 600 : 400,
        }}>
          {s.globalScore.toFixed(1)}
        </span>
      )}

      {s.globalScore > 0 && (
        <span style={{
          fontSize: 10, flexShrink: 0, width: 10, textAlign: 'center',
          color: s.trend === '↑' ? '#ff453a' : s.trend === '↓' ? '#34c759' : 'var(--text-ghost)',
          fontFamily: "'SF Mono','Menlo',monospace",
        }}>
          {s.trend}
        </span>
      )}

      <button
        className="ignore-btn"
        onClick={e => { e.stopPropagation(); onIgnore(s.filePath); }}
        title="Ignorer ce fichier"
        style={{
          opacity: 0, transition: 'opacity 0.15s',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: 13, lineHeight: 1,
          padding: '0 2px', flexShrink: 0,
        }}
        onMouseEnter={e => e.currentTarget.style.color = '#ff453a'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
      >
        Ø
      </button>
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export default function FileTree({ scans, projectPath, selected, ignoredSet, onSelect, onIgnore, showZero }: Props) {
  const root = useMemo(
    () => buildTree(scans, projectPath, ignoredSet, showZero),
    [scans, projectPath, ignoredSet, showZero]
  );

  // Chemins des dossiers ancêtres du fichier sélectionné
  const ancestorPaths = useMemo(
    () => selected ? getAncestorPaths(selected.filePath, projectPath) : new Set<string>(),
    [selected?.filePath, projectPath]
  );

  if (root.fileCount === 0) {
    return (
      <div style={{ padding: '20px 14px', fontSize: 11, color: 'var(--text-muted)' }}>
        Aucun fichier à afficher.
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      <DirRow
        node={root}
        depth={0}
        dirPath=""
        selected={selected}
        ancestorPaths={ancestorPaths}
        onSelect={onSelect}
        onIgnore={onIgnore}
      />
    </div>
  );
}
