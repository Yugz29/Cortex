# Pulse – Technical Report

---

## 1️⃣ Project Summary

**Concept:**
Pulse is an intelligent desktop-resident agent that observes, analyzes, and learns from a developer's environment in real time. Starting as a code quality monitor, Pulse is designed to progressively evolve into a fully adaptive personal system agent — one that understands how you work, anticipates problems, and acts on your behalf when you ask it to.

The core philosophy: **local-first, privacy-absolute, and built to fit one developer rather than everyone.**

**Objectives:**
- Monitor code quality and surface risks before they become bugs.
- Learn from developer behavior to provide increasingly relevant feedback.
- Evolve from passive observer to active, controllable agent over time.
- Stay 100% local — no cloud, no telemetry, no data leaving the machine.

**Target Users:**
- Individual developers who want an always-on, intelligent assistant.
- Multi-language projects: TypeScript, JavaScript, Python.
- Developers who care about performance, privacy, and owning their tools.

---

## 2️⃣ Core Features

| Feature | Status | Description |
|---------|--------|-------------|
| **File Watcher** | ✅ Done | Monitors project files in real time via chokidar. Exclusions driven by `pulse.config.json`. Debounced 1500ms. Filters on supported extensions (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.py`). |
| **Analyzer / Parser** | ✅ Done | TS/JS via ts-morph (AST). Python via regex fallback. Measures cyclomatic complexity, cognitive complexity, function size, nesting depth, and parameter count per function. JSX-aware: nesting counts conditional expressions, destructured props counted individually. Anonymous functions excluded from metrics (double-counting). |
| **Churn Metric** | ✅ Done | Single Git call per scan — builds a cache of commit counts per file (last 30 days). 1 call for all files instead of 1 per file. |
| **Coupling (Fan-in / Fan-out)** | ✅ Done | Static import graph built after each scan. Fan-in = number of files that import this file. Fan-out = number of files this file imports. Displayed in sidebar, not included in RiskScore. |
| **RiskScore Calculator** | ✅ Done | Weighted score per file (0–100) across 6 metrics: complexity (blended max+mean) 30%, cognitive complexity 20%, function size 15%, depth 15%, churn 12%, parameters 8%. Adaptive scoring: thresholds computed from project percentiles (p25/p90) anchored to static reference baselines per file type (entrypoint, component, service, parser, utility, config). |
| **Database / Persistence** | ✅ Done | SQLite via better-sqlite3. Stores scan history, function-level metrics, feedbacks, Intel conversation. Scoped per project via `project_path`. Auto-cleans deleted files at startup. |
| **Score Trends** | ✅ Done | Daily baseline: compares current score against the first scan of the day. Arrow holds all day, resets each morning. |
| **Score History Graph** | ✅ Done | SVG inline chart showing score evolution over time (up to 30 points) per file. Displayed in sidebar. |
| **Feedback Loop V1** | ✅ Done | Stores `apply / ignore / explore` actions per file in SQLite. Feedback history passed to LLM context. |
| **LLM Module (V1.5)** | ✅ Done | Local AI analysis via Ollama. Triggered by `explore`. Enriched context: source code, metrics, functions, import graph, score history, feedback history. Streamed markdown response. Report persisted in DB — survives sidebar close. |
| **Intel View** | ✅ Done | Persistent project-level conversation with the LLM. Multi-turn, context-aware. Conversation stored in SQLite — survives view changes and app restarts. |
| **Config File** | ✅ Done | `pulse.config.json` centralizes project path, alert thresholds, and ignore list. Sensible defaults if fields are missing. |
| **Electron UI** | ✅ Done | Desktop app with List / Graph / Flow / Intel views. Resizable sidebars. Multi-model settings panel. Real-time `[Pulse]` daemon logs visible in ACTIVITY panel. |
| **Multi-Project Support** | ✅ Done | Each scan scoped by `project_path`. Multiple projects coexist in the same DB without mixing. |
| **Function-Level Detail** | ✅ Done | Per-function metrics stored in DB and displayed in sidebar: name, start line, line count, cyclomatic complexity, parameter count, nesting depth. |
| **Auto-cleanup** | ✅ Done | At startup, Pulse removes from DB any file that no longer exists on disk. |
| **Shell Integration** | ✅ Done | Passive observation of existing terminals (VSCode, iTerm2, Terminal.app). zsh/bash/fish hook sends failed commands to Pulse via HTTP — direct notification, no clipboard required. `TRAPINT` captures Ctrl+C on running commands. `command_not_found_handler` captures unknown commands with proper stderr. Clipboard watcher (600ms) detects any terminal content copied by the developer. In-app banner (errors) or discrete hint chip (anything else) with LLM analysis. Error history + recurrence detection in SQLite. |
| **Renderer Decoupling** | ✅ Done | Frontend split into `types.ts`, `utils.ts`, and isolated components (`Detail`, `IntelView`, `GraphView`, `FlowView`, `SettingsPanel`, `shared/`). App.tsx reduced to state + layout only. |
| **Git Sandbox** | 📋 V2.5 | Creates an isolated branch to apply and test modifications before final validation. |
| **Project Hotspots** | 📋 V2.0 | Identifies the most dangerous zones of the project by combining RiskScore × churn. Surfaces files where bugs are most likely to appear. 1 SQL query, dedicated view. |
| **Feedback Loop V2** | 📋 V2.0 | Dynamic adjustment of RiskScore weights based on accumulated feedback patterns. |
| **DeveloperProfile** | 📋 V2.0 | Persistent profile tracking developer habits, recurring patterns, and response tendencies. Enables personalized RiskScore weights — what YOU consider problematic, not generic rules. |

---

## 3️⃣ Secondary / Nice-to-Have Features

| Feature | Description |
|---------|-------------|
| **System Notifications** | Proactive desktop alerts when a file crosses a risk threshold. |
| **Export / Import Configuration** | Rules and profiles in JSON/YAML for sharing or backup. |
| **Controlled Autonomy** | Semi-automatic proposals executable after developer validation. |
| **System Agent (V3+)** | Process monitoring, network awareness, and system-level observations. Pulse as a personal environment guardian. |

---

## 4️⃣ Technical Architecture

### Frontend (Desktop UI)
- **Electron + React** — cross-platform desktop ✅
- **`types.ts`** — all shared interfaces (Scan, Edge, FunctionDetail, IntelMessage, etc.) ✅
- **`utils.ts`** — shared helpers, constants, layer classification, LLM styles ✅
- **`App.tsx`** — global state + layout + IPC listeners only (~220 lines) ✅
- **`components/`** — isolated views: `Detail`, `IntelView`, `GraphView`, `FlowView`, `SettingsPanel`, `TerminalErrorBanner` ✅
- **`components/shared/`** — pure presentational components: `ScoreGraph`, `ProjectTrendGraph`, `MetricBar`, `ResizeHandle`, `SectionLabel` ✅

### Backend / Core
- Node.js + TypeScript daemon
- Modules: File Watcher ✅, Analyzer ✅, Churn ✅, Coupling ✅, RiskScore ✅, Feedback Loop V1 ✅, LLM ✅, Config ✅, Auto-cleanup ✅, Shell Integration ✅
- Git Sandbox — 📋 V2.5

### Database
- **SQLite / better-sqlite3** ✅
- Tables: `scans` ✅, `feedbacks` ✅, `functions` ✅, `terminal_errors` ✅, `intel_messages` ✅
- `scans` includes `llm_report` column — persists LLM file analysis across sessions ✅
- Per-project scoping via `project_path` ✅
- Auto-migration on startup ✅

### Shell Integration
- **HTTP socket server** (built-in Node.js `http`) on port 7891 (configurable) ✅
- **Direct notification** — socket fires renderer immediately on command error, no clipboard needed ✅
- **Clipboard watcher** — `electron.clipboard` polled at 600ms, detects any terminal content ✅
- Two notification modes: `error` (red banner, auto) — `hint` (blue chip, on copy) ✅
- **zsh hook** — `add-zsh-hook preexec/precmd` + `TRAPINT` (Ctrl+C) + `command_not_found_handler` ✅
- **bash hook** — `trap DEBUG` + `PROMPT_COMMAND` ✅
- **fish hook** — `fish_preexec` / `fish_postexec` events ✅
- stderr captured via tmp file (`/tmp/pulse_stderr_$`) and sent with payload ✅
- Error deduplication via hash (`command:exit_code` prefix) ✅
- Dynamic snippet generated per detected shell, displayed in Settings ✅

### LLM / AI
- **Ollama local** — model configurable per role (analyzer, coder, brainstorm, fast) ✅
- Streamed via `/api/chat` (multi-turn format)
- Enriched prompt: source code + metrics + top functions + import graph + score history + feedback history
- File analysis report persisted to DB on completion
- Intel conversation persisted to DB message by message

---

## 5️⃣ Tech Stack

| Component | Tech | Status |
|-----------|------|--------|
| Runtime | Node.js + TypeScript | ✅ |
| Desktop UI | Electron + React | ✅ |
| File Watching | chokidar | ✅ |
| TS/JS Analysis | ts-morph (AST) | ✅ |
| Python Analysis | Regex | ✅ |
| Churn / Git | simple-git | ✅ |
| Database | better-sqlite3 | ✅ |
| Config | pulse.config.json | ✅ |
| Markdown rendering | marked | ✅ |
| LLM | Ollama (local, multi-model) | ✅ |
| Visualization | Chart.js | 📋 V2.5 |

---

## 6️⃣ Data Model

### Tables (SQLite)

**scans**
- id, file_path, global_score, complexity_score, function_size_score, churn_score, depth_score, param_score, fan_in, fan_out, language, project_path, scanned_at, **llm_report**

**feedbacks**
- id, file_path, action (`apply` / `ignore` / `explore`), risk_score_at_time, created_at

**functions**
- id, file_path, name, start_line, line_count, cyclomatic_complexity, parameter_count, max_depth, project_path, scanned_at

**terminal_errors**
- id, command, exit_code, error_hash, error_text, cwd, project_path, llm_response, resolved (`0`=unknown / `1`=resolved / `-1`=ignored), created_at

**intel_messages**
- id, project_path, role (`user` / `assistant`), content, created_at

### Planned Tables (V2+)
**developer_profile** — id, project_path, metric_key, weight_adjustment, updated_at
**alerts** — id, file_path, type, score, status, created_at
**proposals** — id, alert_id, diff_content, score_before, score_after, status, created_at

---

## 7️⃣ pulse.config.json

```json
{
    "projectPath": "/path/to/your/project",
    "socketPort": 7891,
    "thresholds": {
        "alert": 50,
        "warning": 20
    },
    "ignore": [
        "node_modules", ".git", "dist", "build", ".vite",
        "vendor", "__pycache__", "venv", ".venv", "coverage"
    ]
}
```

All fields have sensible defaults if omitted. `socketPort` defaults to `7891` with automatic fallback to `7892–7894` if occupied.

---

## 8️⃣ Main User Flows

### Flow 1: Startup Scan ✅
1. Pulse loads `pulse.config.json`
2. Database initialized — migrations applied automatically, deleted files cleaned
3. Scanner recursively reads all supported files (respecting ignore list)
4. Each file parsed → metrics computed (complexity, size, depth, params, churn)
5. Import graph built → fan-in / fan-out injected into results
6. All results saved to DB
7. UI displays ranked report with risk levels, trends, and last feedback

### Flow 2: Live Watching ✅
1. File modified → chokidar detects change (debounced 1500ms)
2. Analyzer computes AST metrics + churn
3. RiskScore calculated
4. UI updated in real time

### Flow 3: Feedback Loop V1 ✅
1. Developer selects action (`apply / ignore / explore`) from sidebar
2. Action stored in SQLite with score at time of feedback
3. UI report shows last feedback per file

### Flow 4: LLM File Analysis ✅
1. Developer clicks **explore** in sidebar
2. Pulse reads the source file + collects enriched context
3. Prompt sent to local Ollama instance (streaming)
4. Response streamed to **Analysis** tab, rendered as markdown
5. Completed report saved to DB — persists across sessions

### Flow 5: Intel Conversation ✅
1. Developer opens **Intel** view and asks a question
2. Pulse builds project context (top files, degrading files, distribution, trend)
3. LLM responds with project-aware analysis (streaming)
4. Each message (user + assistant) saved to DB immediately
5. Conversation fully restored on next app launch or view change

### Flow 6: Terminal Error Detection ✅
1. A command fails in any terminal (VSCode, iTerm2, Terminal.app…)
2. Shell hook fires asynchronously → `POST localhost:{port}/command-error` (non-blocking)
3. Socket server notifies renderer **directly** — red banner appears immediately
4. **Analyze** → LLM streams a Cause / Solution / Prevention diagnosis
5. **Resolved** or **Dismiss** → banner dismissed, status stored in DB

### Flow 6b: Clipboard Explain ✅
1. Developer sees any output in the terminal they don’t understand
2. They select and copy it (Cmd+C)
3. Clipboard watcher detects terminal-origin content (600ms polling)
4. Discrete blue chip appears bottom-right: **▶ EXPLAIN**
5. Developer clicks → LLM explains what the output means, no error framing
6. Chip auto-dismisses after 30s if ignored

### Flow 7: Feedback Loop V2 📋 (V2.0)
1. Pulse analyzes accumulated feedback patterns per metric
2. Weights adjusted dynamically in DeveloperProfile
3. RiskScore recalculated with personalized weights
4. Profile visible and editable in Settings

### Flow 8: Git Sandbox 📋 (V2.5)
1. Proposal applied in isolated Git branch
2. Human validation or automatic rollback

---

## 9️⃣ RiskScore Weights

| Metric | Weight | Safe threshold | Danger threshold |
|--------|--------|----------------|-----------------|
| Cyclomatic complexity | 35% | ≤ 3 | ≥ 10 |
| Nesting depth | 20% | ≤ 2 | ≥ 5 |
| Function size (lines) | 20% | ≤ 20 | ≥ 60 |
| Churn (commits/30d) | 15% | ≤ 5 | ≥ 20 |
| Parameter count | 10% | ≤ 3 | ≥ 7 |

Score ranges: 🟢 < 20 · 🟡 20–49 · 🔴 ≥ 50

**Notes:**
- Anonymous functions are excluded from all metric calculations (already counted within their parent function).
- Fan-in / fan-out are informational only — not included in the RiskScore.
- From V2.0, weights will be dynamically adjusted per project based on DeveloperProfile.

---

## 🔟 Technical Constraints & Security

- **100% local execution** — no data leaves the machine
- LLM strictly local via Ollama — no cloud API calls
- Filesystem exclusions driven by config
- Limited permissions: no root access
- Scan history preserved across sessions — no data loss on restart
- Deleted files automatically removed from DB at startup

---

## 11️⃣ Development Phases

| Phase | Status | Features |
|-------|--------|----------|
| **V1** | ✅ Done | Electron UI, file scanning, RiskScore (5 metrics), SQLite persistence, function-level metrics, coupling graph, live watcher, debouncing, feedback loop V1, score trends, score history graph, config file, multi-project support, auto-cleanup |
| **V1.5** | ✅ Done | LLM module (Ollama local), enriched context, streamed markdown response, resizable sidebars, tabbed sidebar, multi-model settings (per role) |
| **V1.6** | ✅ Done | Shell Integration — passive terminal observation (zsh/bash/fish hook + clipboard watcher), direct socket notification, `TRAPINT` for Ctrl+C, `command_not_found_handler`, two-mode UX (error banner / clipboard hint chip), terminal LLM analysis, error history + recurrence detection |
| **V1.7** | ✅ Done | Renderer decoupling (types.ts / utils.ts / components/), Intel conversation persistence (SQLite), LLM report persistence per file, daily baseline for score trends, cognitive complexity metric, JSX-aware parser (nesting + destructured props), adaptive scoring with reference baselines per file type, daemon logs in ACTIVITY panel |
| **V2.0** | 📋 Next | **Project Hotspots** — RiskScore × churn, surfaces the real danger zones. **Feedback Loop V2** — dynamic RiskScore weights from feedback patterns. **DeveloperProfile** — persistent per-project developer model, personalized weights. **Enriched metrics** — beyond the current 5 (e.g. duplication density, call graph depth) |
| **V2.5** | 📋 Planned | System notifications, Git Sandbox, Chart.js advanced dashboard |
| **V3** | 📋 Vision | System-level agent — process monitoring, network awareness, environment health. Controlled autonomy: Pulse proposes actions, developer validates. |

---

## 12️⃣ Complexity Estimate per Module

| Module | Complexity | Status |
|--------|-----------|--------|
| File Watcher | Low | ✅ Done |
| Analyzer / Parser (TS/JS) | Medium | ✅ Done |
| Analyzer / Parser (Python) | Low | ✅ Done |
| Churn Metric | Low | ✅ Done |
| Coupling (Fan-in / Fan-out) | Low | ✅ Done |
| RiskScore Calculator | Low | ✅ Done |
| Database / Persistence | Low | ✅ Done |
| Auto-cleanup | Low | ✅ Done |
| Score Trends (daily baseline) | Low | ✅ Done |
| Score History Graph (SVG) | Low | ✅ Done |
| Electron UI | Medium | ✅ Done |
| Renderer Decoupling | Medium | ✅ Done |
| Intel Conversation (persistent) | Low | ✅ Done |
| LLM Report Persistence | Low | ✅ Done |
| Multi-Project Support | Low | ✅ Done |
| Feedback Loop V1 | Low | ✅ Done |
| LLM Module (Ollama, multi-model) | Medium | ✅ Done |
| Shell Integration (socket + direct notify) | Medium | ✅ Done |
| Shell Hook (zsh/bash/fish + TRAPINT + cnf) | Medium | ✅ Done |
| Clipboard Hint (two-mode UX) | Low | ✅ Done |
| Terminal Error History (SQLite) | Low | ✅ Done |
| Daemon Logs in UI (ACTIVITY panel) | Low | ✅ Done |
| Cognitive Complexity Metric | Low | ✅ Done |
| JSX-aware Parser (nesting + props) | Low | ✅ Done |
| Adaptive Scoring + Reference Baselines | Medium | ✅ Done |
| Project Hotspots (RiskScore × churn) | Low | 📋 V2.0 |
| Feedback Loop V2 (dynamic weights) | Medium | 📋 V2.0 |
| DeveloperProfile | Medium | 📋 V2.0 |
| Enriched Metrics | Medium | 📋 V2.0 |
| Git Sandbox | High | 📋 V2.5 |
| System Agent (process / network) | High | 📋 V3 |
