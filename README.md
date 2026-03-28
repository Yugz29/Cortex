# Cortex

> A local-first code quality monitor that runs quietly in the background and tells you what's actually wrong — before it becomes a problem.

![Electron](https://img.shields.io/badge/Electron-40-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/license-Apache--2.0-blue)

---

## What it is

Cortex is a desktop application that monitors your codebase in real time. It watches your files, analyzes code complexity and git activity, and surfaces risk scores per file — live, as you work.

No cloud. No subscription. No AI model required. Everything runs locally on your machine.

---

## What it does

**Watches your project continuously**
Cortex runs in the background and detects file changes as they happen. Every save triggers a fresh analysis — complexity, function size, nesting depth, churn rate, coupling.

**Scores every file 0–100**
Each file gets a risk score based on 7 weighted metrics. Files are ranked and color-coded: 🟢 healthy · 🟡 stressed · 🔴 critical.

**Adapts to your codebase**
Thresholds are calibrated per file type — a React component is not scored like a parser, and a configuration file is not scored like a service. Baselines are also computed from your project's own distribution, so the tool adjusts to what's normal for your specific codebase.

**Tracks how scores evolve**
Every scan is stored. You can see whether a file is getting better or worse over time, and follow the global health trend of your project across days and sessions.

**Generates AI-ready context**
After each scan, Cortex writes a structured JSON snapshot of your project — scores, history, couplings, trends. Paste it into any AI assistant and it instantly understands the state of your codebase without needing to read a single file.

---

## Features

| Feature | Description |
|---------|-------------|
| **Real-time watcher** | Monitors `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.py` — debounced, exclusion-aware |
| **Manual scan** | Trigger a full rescan on demand from the topbar |
| **AST analysis** | TS/JS via ts-morph — cyclomatic complexity, cognitive complexity, function size, nesting depth, parameter count |
| **Git churn** | Commit frequency per file over the last 30 days |
| **Import graph** | Fan-in (who depends on this file) and fan-out (what this file depends on) |
| **Adaptive scoring** | Per-file-type thresholds + project-wide percentile baselines |
| **Language multipliers** | TSX/JSX scoring accounts for style ternaries that inflate complexity metrics |
| **Score history** | Per-file trend graphs and project health curve — by scan or by day |
| **Hotspot detection** | Files that are both complex and frequently modified |
| **Multi-project** | Switch between projects without restarting |
| **Graph view** | Force-directed dependency graph — Layers (architectural clusters) or All Links |
| **Security scan** | Pattern-based secret/injection detection + `npm audit` dependency vulnerability check |
| **File ignore** | Exclude files from scoring via sidebar (greyed) or from scanning entirely via Settings |
| **UI preferences** | Sidebar width, activity panel height, graph mode and granularity persist across sessions |
| **AI snapshot** | `cortex-snapshot.json` written after every scan — structured context for any LLM |
| **Export** | JSON report available from the Overview tab |

---

## Risk score

The global score for a file is a weighted sum of 7 normalized metrics (0–100 each):

| Metric | Weight | What it captures |
|--------|--------|-----------------|
| Cyclomatic complexity (max + mean blend) | 28% | Number of independent execution paths |
| Cognitive complexity | 19% | How hard the code is to read and follow |
| Function size (max + mean blend) | 14% | Size of the largest and average functions |
| Nesting depth | 14% | Maximum depth of nested blocks |
| Churn (commits / 30 days) | 12% | How often this file changes |
| Parameter count | 8% | Maximum parameters on any function |
| Fan-in | 5% | How many files import this one |

Score ranges: **< 20** healthy · **20–49** stressed · **≥ 50** critical

---

## AI context

After every scan, Cortex writes `cortex-snapshot.json` in the project root. This file contains:

- Summary (total files, critical / stressed / healthy counts, average score)
- Per-file scores with raw metrics, language, and last scan timestamp
- Project health history (score evolution over time)
- Coupling map (files that change together most often)
- Current feedback loop weights

This makes Cortex useful as a **context generator for AI assistants**. You work in Cortex, then drop the snapshot into any conversation — the AI immediately knows the state of your project, what's risky, what's trending up, and where the real problems are.

---

## Stack

| Component | Technology |
|-----------|-----------|
| Desktop shell | Electron 40 + electron-vite |
| UI | React 19 + TypeScript |
| TS/JS analysis | ts-morph (AST) |
| Python analysis | Regex-based |
| Git / churn | simple-git |
| Database | better-sqlite3 (SQLite — local, on disk) |
| File watching | chokidar |
| Dependency graph | d3-force |

---

## Getting started

```bash
# Clone
git clone https://github.com/yugz29/cortex.git
cd cortex

# Install dependencies
npm install

# Start in development mode
npm run dev

# Build for production
npm run build && npm start
```

On first launch, click **Add project** and select a folder. Cortex will start watching and scoring immediately.

### Linux — system dependencies

Electron requires several system libraries that may not be installed by default. If the app fails to launch, install them first:

```bash
sudo apt-get update && sudo apt-get install -y \
  libnspr4 libnss3 \
  libatk1.0-0 libatk-bridge2.0-0 \
  libcups2 libdrm2 libgbm1 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
  libasound2t64
```

> On older Ubuntu/Debian versions, replace `libasound2t64` with `libasound2`.

---

## Project structure

```
src/
├── app/
│   ├── main/          # Electron main process — IPC, scan orchestration, report generation
│   ├── preload/       # Context bridge
│   └── renderer/      # React UI — views, components, hooks
│       ├── components/
│       │   ├── shared/        # Sidebar, FilterBar, FileList, ActivityPanel, GraphView...
│       │   ├── CortexView     # Main layout — sidebar + center + detail panel
│       │   ├── OverviewView   # Project dashboard
│       │   ├── GraphView      # Dependency graph (FREE / LAYERS)
│       │   ├── HistoryView    # Score trends over time
│       │   └── Detail         # Per-file breakdown — metrics, functions, history
│       ├── hooks/             # useFileFilters, useLocale, useLocalPref
│       ├── graphLayout.ts     # Force layout algorithms (pure, testable)
│       └── utils.ts           # Scoring colors, layer classification, health status
├── cortex/
│   ├── analyzer/      # parser.ts (AST), churn.ts (git)
│   ├── risk-score/    # riskScore.ts, referenceBaselines.ts, trend.ts
│   └── watcher/       # chokidar watcher with debouncing
└── database/
    ├── db.ts          # All SQLite queries
    └── migrations.ts  # Versioned schema migrations
```

---

## Privacy

- **100% local** — no data leaves your machine
- **No account** — no login, no telemetry, no analytics
- **Your data** — stored in SQLite on your disk, deletable at any time
- **No AI inside** — Cortex does not call any language model

---

## License

Apache-2.0
