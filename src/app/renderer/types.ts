// ── CORTEX TYPES ─────────────────────────────────────────────────────────────

export interface Scan {
  filePath:                string;
  globalScore:             number;
  hotspotScore:            number;
  complexityScore:         number;
  cognitiveComplexityScore: number;
  functionSizeScore:       number;
  churnScore:              number;
  depthScore:              number;
  paramScore:              number;
  fanIn:                   number;
  fanOut:                  number;
  language:                string;
  trend:                   '↑' | '↓' | '↔';
  scannedAt:               string;
  rawComplexity:           number;
  rawCognitiveComplexity:  number;
  rawFunctionSize:         number;
  rawDepth:                number;
  rawParams:               number;
  rawChurn:                number;
}

export interface Edge {
  from: string;
  to:   string;
}

export interface FunctionDetail {
  name:                  string;
  start_line:            number;
  line_count:            number;
  cyclomatic_complexity: number;
  cognitive_complexity:  number;
  parameter_count:       number;
  max_depth:             number;
}

export type AppSettings = {
  projectPath?: string;
  [key: string]: any;
};

// ── WINDOW API CONTRACT ───────────────────────────────────────────────────────

declare global {
  interface Window {
    api: {
      getScans:               () => Promise<Scan[]>;
      getEdges:               () => Promise<Edge[]>;
      getFunctions:           (filePath: string) => Promise<FunctionDetail[]>;
      getScoreHistory:        (filePath: string) => Promise<{ score: number; scanned_at: string }[]>;
      getProjectPath:         () => Promise<string>;
      pickProject:            () => Promise<string | null>;
      getProjectScoreHistory: () => Promise<{ date: string; score: number }[]>;
      getProjectHistory:       () => Promise<{ date: string; score: number; healthPct: number }[]>;
      getProjectHistoryByDay:   () => Promise<{ date: string; score: number; healthPct: number }[]>;
      onScanComplete:         (cb: () => void) => void;
      onEvent:                (cb: (e: any) => void) => void;
      onFocusFile:            (cb: (filePath: string) => void) => (() => void);
      onFullscreenChange:     (cb: (isFullscreen: boolean) => void) => (() => void);
      getSettings:    () => Promise<AppSettings>;
      saveSettings:   (s: AppSettings) => Promise<void>;
      getProjects:    () => Promise<{ path: string; name: string; addedAt: string }[]>;
      addProject:     () => Promise<{ path: string; name: string; addedAt: string }[] | null>;
      removeProject:  (projectPath: string) => Promise<{ path: string; name: string; addedAt: string }[]>;
      switchProject:        (projectPath: string) => Promise<string>;
      getProjectsHealth:     () => Promise<{ path: string; avgScore: number | null }[]>;
      exportReport:         () => Promise<{ ok: boolean; path?: string }>;
      ignoreFile:           (filePath: string) => Promise<string[]>;
      unignoreFile:         (filePath: string) => Promise<string[]>;
      getIgnoredFiles:      () => Promise<string[]>;
      readFile:             (filePath: string) => Promise<{ ok: boolean; content: string }>;
      runSecurityScan:         (projectPath: string) => Promise<SecurityScanResult>;
      openExternal:             (url: string) => Promise<void>;
      getLastSecurityResult:    (projectPath: string) => Promise<SecurityScanResult | null>;
    };
  }
}

// ── SECURITY TYPES ────────────────────────────────────────────────────────────

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type Category = 'secret' | 'injection' | 'crypto' | 'xss' | 'misc';

export interface SecurityFinding {
  filePath: string;
  line:     number;
  rule:     string;
  severity: Severity;
  category: Category;
  message:  string;
  snippet:  string;
}

export interface AuditVuln {
  name:         string;
  severity:     Severity;
  via:          string[];
  range:        string;
  fixAvailable: boolean;
  cves:         string[];
  subdir?:      string;  // sous-dossier relatif si monorepo
}

export interface SecurityScanResult {
  findings:  SecurityFinding[];
  audit: {
    status:  'ok' | 'error' | 'not_run';
    vulns:   AuditVuln[];
    counts:  { critical: number; high: number; moderate: number; low: number; info: number; total: number };
    error?:  string;
    reason?: string;  // explication si not_run
  };
  scannedAt: string;
}
