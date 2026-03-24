import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Scan, Edge } from '../types';
import { scoreColor, scoreColorHex, classifyLayer, LAYER_LABELS, LAYER_COLORS, LAYER_ORDER } from '../utils';
import { useLocale } from '../hooks/useLocale';
import { buildLayerLayout, buildEdgePairs, canonKey, type NodeLayout } from '../graphLayout';

interface Props {
  scans:        Scan[];
  edges:        Edge[];
  onSelect:     (s: Scan | null) => void;
  selectedPath: string | null;
}

export default function GraphView({ scans, edges, onSelect, selectedPath }: Props) {
  const containerRef                  = useRef<HTMLDivElement>(null);
  const [size, setSize]               = useState({ w: 0, h: 0 });
  const [transform, setTransform]     = useState({ x: 0, y: 0, k: 1 });
  const [animating, setAnimating]     = useState(false);
  const animTimerRef                  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPanning                     = useRef(false);
  const lastMouse                     = useRef({ x: 0, y: 0 });
  const [tooltip, setTooltip]         = useState<{ x: number; y: number; scan: Scan } | null>(null);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const { t } = useLocale();

  const layout = useMemo(
    () => scans.length > 0 ? buildLayerLayout(scans) : new Map<string, NodeLayout>(),
    [scans],
  );
  const sizeRef = useRef(size);
  useEffect(() => { sizeRef.current = size; }, [size]);

  // ── ResizeObserver ──────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const e = entries[0];
      if (e) setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Animation helper ────────────────────────────────────────────────────────
  const startAnim = useCallback(() => {
    setAnimating(true);
    if (animTimerRef.current) clearTimeout(animTimerRef.current);
    animTimerRef.current = setTimeout(() => setAnimating(false), 450);
  }, []);

  // ── Fit all nodes in view ───────────────────────────────────────────────────
  const fitAll = useCallback((animated: boolean) => {
    const { w, h } = size;
    if (!w || !h || layout.size === 0) return;
    const ns   = [...layout.values()];
    const minX = Math.min(...ns.map(n => n.x - n.r));
    const maxX = Math.max(...ns.map(n => n.x + n.r));
    const minY = Math.min(...ns.map(n => n.y - n.r));
    const maxY = Math.max(...ns.map(n => n.y + n.r));
    const pad  = 32;
    const k    = Math.min(2.5, Math.max(0.05, Math.min((w - pad * 2) / (maxX - minX || 1), (h - pad * 2) / (maxY - minY || 1))));
    if (animated) startAnim();
    setTransform({ x: w / 2 - k * (minX + maxX) / 2, y: h / 2 - k * (minY + maxY) / 2, k });
  }, [layout, size, startAnim]);

  // fitAll après que layout ET size soient tous les deux non-nuls
  const didFitRef = useRef(false);
  useEffect(() => {
    if (!size.w || !size.h || layout.size === 0) return;
    fitAll(false);
    didFitRef.current = true;
  }, [layout, size.w, size.h]);

  // ── Zoom sur le nœud sélectionné + ses voisins ─────────────────────────────
  const layoutRef = useRef(layout);
  useEffect(() => { layoutRef.current = layout; }, [layout]);
  const edgesRef  = useRef(edges);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  useEffect(() => {
    if (!selectedPath || !size.w || !size.h) return;
    const { w, h }      = size;
    const currentLayout = layoutRef.current;
    if (currentLayout.size === 0) return;
    const node = currentLayout.get(selectedPath);
    if (!node) return;

    const group: NodeLayout[] = [node];
    for (const e of edgesRef.current) {
      if (e.from === selectedPath) { const nb = currentLayout.get(e.to);   if (nb) group.push(nb); }
      if (e.to   === selectedPath) { const nb = currentLayout.get(e.from); if (nb) group.push(nb); }
    }

    const pad  = 70;
    const minX = Math.min(...group.map(n => n.x - n.r)) - pad;
    const maxX = Math.max(...group.map(n => n.x + n.r)) + pad;
    const minY = Math.min(...group.map(n => n.y - n.r)) - pad;
    const maxY = Math.max(...group.map(n => n.y + n.r)) + pad;
    const k    = Math.min(1.8, Math.max(0.4, Math.min(w / (maxX - minX || 1), h / (maxY - minY || 1))));

    startAnim();
    setTransform({ x: w / 2 - k * (minX + maxX) / 2, y: h / 2 - k * (minY + maxY) / 2, k });
  }, [selectedPath, size.w, size.h]);

  // ── Zoom molette ────────────────────────────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta  = e.ctrlKey ? e.deltaY * 0.01 : Math.sign(e.deltaY) * 0.09;
    const factor = 1 - delta;
    const rect   = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setAnimating(false);
    setTransform(t => {
      const newK  = Math.min(5, Math.max(0.1, t.k * factor));
      const ratio = newK / t.k;
      return { x: mx - ratio * (mx - t.x), y: my - ratio * (my - t.y), k: newK };
    });
  }, []);

  // ── Pan ─────────────────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as Element).closest('[data-node]')) return;
    setAnimating(false);
    isPanning.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }));
  }, []);
  const handleMouseUp = useCallback(() => { isPanning.current = false; }, []);

  // ── Focus edges/nodes ───────────────────────────────────────────────────────
  const scanMap   = new Map(scans.map(s => [s.filePath, s]));
  const focusPath = hoveredPath ?? selectedPath;
  const hasFocus  = focusPath !== null;

  const focusEdgeIdxs = new Set<number>();
  const focusNodeIds  = new Set<string>();
  if (hasFocus) {
    focusNodeIds.add(focusPath!);
    edges.forEach((e, i) => {
      if (e.from === focusPath || e.to === focusPath) {
        focusEdgeIdxs.add(i);
        focusNodeIds.add(e.from);
        focusNodeIds.add(e.to);
      }
    });
  }
  const selNodeIds = new Set<string>();
  if (selectedPath) {
    selNodeIds.add(selectedPath);
    edges.forEach(e => {
      if (e.from === selectedPath || e.to === selectedPath) {
        selNodeIds.add(e.from); selNodeIds.add(e.to);
      }
    });
  }

  // ── Pré-calcul paires bidi ──────────────────────────────────────────────────
  const edgePairs = useMemo(() => buildEdgePairs(edges), [edges]);
  const nodes     = [...layout.values()];

  // ── Rendu ───────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      style={{ flex: 1, overflow: 'hidden', position: 'relative', background: 'transparent', cursor: isPanning.current ? 'grabbing' : 'grab' }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <svg width="100%" height="100%" style={{ display: 'block' }}>
        <g style={{
          transform:       `translate(${transform.x}px,${transform.y}px) scale(${transform.k})`,
          transformOrigin: '0 0',
          transition:      animating ? 'transform 0.44s cubic-bezier(0.25,0.46,0.45,0.94)' : 'none',
        }}>

          {/* ── Zones de layer ── */}
          {LAYER_ORDER.map(l => {
            const layerNodes = [...layout.values()].filter(n => classifyLayer(n.id) === l);
            if (!layerNodes.length) return null;
            const col  = LAYER_COLORS[l];
            const PAD  = 48;
            const xs   = layerNodes.map(n => n.x);
            const ys   = layerNodes.map(n => n.y);
            const minX = Math.min(...xs) - PAD;
            const maxX = Math.max(...xs) + PAD;
            const minY = Math.min(...ys) - PAD;
            const maxY = Math.max(...ys) + PAD;
            const cx   = (minX + maxX) / 2;
            const cy   = (minY + maxY) / 2;
            return (
              <g key={l}>
                <ellipse cx={cx} cy={cy} rx={(maxX - minX) / 2} ry={(maxY - minY) / 2}
                  fill={col} fillOpacity={0.06}
                  stroke={col} strokeWidth={1} strokeOpacity={0.25}
                  strokeDasharray="6,4"
                />
                <text x={cx} y={minY - 8} textAnchor="middle"
                  fontSize={10} fill={col} fillOpacity={0.8}
                  fontWeight="700" letterSpacing="0.12em"
                  style={{ fontFamily: "'SF Mono','Menlo',monospace" }}>
                  {LAYER_LABELS[l]}
                </text>
              </g>
            );
          })}

          {/* ── Edges ── */}
          {edges.map((e, i) => {
            const from = layout.get(e.from);
            const to   = layout.get(e.to);
            if (!from || !to) return null;

            const isFocused    = focusEdgeIdxs.has(i);
            const isCrossLayer = classifyLayer(e.from) !== classifyLayer(e.to);
            if (hasFocus && !isFocused) return null;
            if (!hasFocus && !isCrossLayer) return null;

            const isOut  = e.from === focusPath;
            const colHex = isFocused
              ? scoreColorHex(scanMap.get(e.from)?.globalScore ?? 0)
              : (LAYER_COLORS[classifyLayer(e.from)] ?? 'rgba(255,255,255,0.25)');

            const dx  = to.x - from.x;
            const dy  = to.y - from.y;

            // Courbe bidi : sens opposés via normale canonique
            const key    = canonKey(e.from, e.to);
            const isBidi = (edgePairs.get(key) ?? []).length > 1;
            const CURVE  = 30;

            let mx: number, my: number;
            if (isBidi) {
              const [posA, posB] = e.from < e.to ? [from, to] : [to, from];
              const cdx  = posB.x - posA.x;
              const cdy  = posB.y - posA.y;
              const clen = Math.sqrt(cdx * cdx + cdy * cdy) || 1;
              const side = e.from < e.to ? +CURVE : -CURVE;
              mx = (from.x + to.x) / 2 + (-cdy / clen) * side;
              my = (from.y + to.y) / 2 + ( cdx / clen) * side;
            } else {
              mx = (from.x + to.x) / 2;
              my = (from.y + to.y) / 2;
            }

            // Point d'arrivée sur le bord du nœud cible
            const tdx  = to.x - mx;
            const tdy  = to.y - my;
            const tlen = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
            const ax   = to.x - (tdx / tlen) * (to.r + 2);
            const ay   = to.y - (tdy / tlen) * (to.r + 2);

            const pathD      = isBidi ? `M ${from.x} ${from.y} Q ${mx} ${my} ${ax} ${ay}` : `M ${from.x} ${from.y} L ${ax} ${ay}`;
            const arrowAngle = isBidi ? Math.atan2(ay - my, ax - mx) * 180 / Math.PI : Math.atan2(dy, dx) * 180 / Math.PI;

            return (
              <g key={i}>
                <path
                  d={pathD} fill="none"
                  stroke={colHex}
                  strokeWidth={(isFocused ? 1.5 : 0.8) / transform.k}
                  opacity={isFocused ? 0.9 : isCrossLayer ? 0.2 : 0.3}
                  strokeDasharray={!isOut && isFocused ? `${4 / transform.k},${3 / transform.k}` : undefined}
                />
                {isFocused && (
                  <polygon
                    points={`0,0 ${-5 / transform.k},${-2.5 / transform.k} ${-5 / transform.k},${2.5 / transform.k}`}
                    fill={colHex} opacity={0.8}
                    transform={`translate(${ax},${ay}) rotate(${arrowAngle})`}
                  />
                )}
              </g>
            );
          })}

          {/* ── Nodes ── */}
          {nodes.map(n => {
            const scan        = scanMap.get(n.id);
            if (!scan) return null;
            const fillHex     = scoreColorHex(n.score);
            const isSelected  = selectedPath === n.id;
            const isHovered   = hoveredPath  === n.id;
            const isConnected = selectedPath !== null && selNodeIds.has(n.id) && !isSelected;
            const dimmed      = selectedPath !== null && !selNodeIds.has(n.id);
            const fileName    = n.id.split('/').pop() ?? '';
            const showLabel   = isSelected || isHovered || isConnected || n.r >= 12;

            return (
              <g
                key={n.id}
                data-node="1"
                style={{ cursor: 'pointer', opacity: dimmed ? 0.1 : 1, transition: 'opacity 0.15s' }}
                onClick={() => onSelect(isSelected ? null : scan)}
                onMouseEnter={ev => {
                  setHoveredPath(n.id);
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (rect) setTooltip({ x: ev.clientX - rect.left, y: ev.clientY - rect.top, scan });
                }}
                onMouseLeave={() => { setHoveredPath(null); setTooltip(null); }}
              >
                {isSelected  && <circle cx={n.x} cy={n.y} r={n.r + 8} fill={fillHex} opacity={0.15} />}
                {isHovered && !isSelected && <circle cx={n.x} cy={n.y} r={n.r + 6} fill={fillHex} opacity={0.10} />}
                <circle
                  cx={n.x} cy={n.y}
                  r={isSelected ? n.r + 2 : n.r}
                  fill={fillHex}
                  opacity={isSelected ? 1 : isHovered ? 0.90 : 0.65}
                  stroke={isSelected ? 'var(--node-text-selected)' : fillHex}
                  strokeWidth={(isSelected ? 2 : 0.5) / transform.k}
                  strokeOpacity={isSelected ? 0.9 : 0.4}
                />
                {showLabel && (
                  <text
                    x={n.x} y={n.y - n.r - 5}
                    textAnchor="middle"
                    fontSize={Math.max(8, 10 / transform.k)}
                    style={{
                      fill: isSelected ? 'var(--node-text-selected)' : isHovered ? 'var(--node-text)' : isConnected ? 'var(--text-secondary)' : 'var(--text-faint)',
                      pointerEvents: 'none', userSelect: 'none',
                      fontFamily: "'SF Mono','Menlo',monospace",
                      fontWeight: isSelected ? 600 : isConnected ? 500 : 400,
                    }}
                  >
                    {fileName.length > 20 ? fileName.slice(0, 18) + '…' : fileName}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip && !selectedPath && (
        <div style={{
          position: 'absolute', left: tooltip.x + 14, top: tooltip.y - 14,
          background: 'var(--bg-surface)', border: '0.5px solid var(--border-hover)',
          borderRadius: 8, padding: '8px 12px', pointerEvents: 'none', zIndex: 50,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
            {tooltip.scan.filePath.split('/').pop()}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: scoreColor(tooltip.scan.globalScore) }}>
            {tooltip.scan.globalScore.toFixed(1)}
            <span style={{ fontSize: 9, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>tension</span>
          </div>
        </div>
      )}

      {/* Légende */}
      <div style={{
        position: 'absolute', bottom: 14, left: 20,
        display: 'flex', gap: 14, fontSize: 10,
        color: 'var(--text-faint)', fontFamily: "'SF Mono','Menlo',monospace",
        alignItems: 'center', flexWrap: 'wrap', maxWidth: '60%',
      }}>
        {LAYER_ORDER.filter(l => [...layout.keys()].some(id => classifyLayer(id) === l)).map(l => (
          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: LAYER_COLORS[l], display: 'inline-block' }} />
            {LAYER_LABELS[l]}
          </span>
        ))}
        <span style={{ color: 'var(--border-hover)' }}>·</span>
        <span>couleur = risque</span>
        <span style={{ color: 'var(--border-hover)' }}>·</span>
        <span>{t('graph.hint')}</span>
      </div>

      {/* FIT */}
      <div style={{ position: 'absolute', bottom: 14, right: 20, display: 'flex', gap: 6, alignItems: 'center' }}>
        <button
          onClick={() => fitAll(true)}
          style={{
            background: 'var(--bg-card)', border: '0.5px solid var(--border)',
            color: 'var(--text-muted)', fontSize: 10, padding: '4px 10px',
            borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          {t('graph.fit')}
        </button>
      </div>
    </div>
  );
}
