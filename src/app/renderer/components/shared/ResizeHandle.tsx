import { useState } from 'react';

interface Props {
  onMouseDown:    (e: React.MouseEvent) => void;
  onToggle:       () => void;
  collapsed:      boolean;
  collapseToward: 'left' | 'right';
}

export default function ResizeHandle({ onMouseDown, onToggle, collapsed, collapseToward }: Props) {
  const [hovered, setHovered] = useState(false);
  const arrow = collapseToward === 'left'
    ? (collapsed ? '›' : '‹')
    : (collapsed ? '‹' : '›');

  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 1, flexShrink: 0,
        background: hovered ? 'var(--border-hover)' : 'var(--border)',
        cursor: 'col-resize', position: 'relative',
        transition: 'background 0.15s', zIndex: 10,
      }}
    >
      <div
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 14, height: 28, borderRadius: 3,
          border: '1px solid var(--border-hover)',
          background: 'var(--bg-base)',
          color: 'var(--text-muted)', cursor: 'pointer',
          display: hovered ? 'flex' : 'none',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 9, userSelect: 'none', zIndex: 20,
        }}
      >
        {arrow}
      </div>
    </div>
  );
}
