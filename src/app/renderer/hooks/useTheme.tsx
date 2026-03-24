import type { ReactNode } from 'react';

// Thème fixé à dark — le toggle light a été retiré.
// ThemeProvider conservé pour main.tsx mais ne fait rien de particulier.
export function ThemeProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
