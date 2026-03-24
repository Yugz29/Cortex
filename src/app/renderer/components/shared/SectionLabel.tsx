export default function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{
      fontSize: 10, letterSpacing: '0.10em', fontWeight: 600,
      color: 'var(--text-muted)', textTransform: 'uppercase',
    }}>
      {children}
    </div>
  );
}
