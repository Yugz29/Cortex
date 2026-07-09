export type FileProfile =
    | 'orchestration'
    | 'entrypoint'
    | 'parser'
    | 'decision_table'
    | 'renderer_component'
    | 'report_builder'
    | 'security_scanner'
    | 'dependency_audit'
    | 'change_analysis'
    | 'summary'
    | 'graph_layout'
    | 'formatter'
    | 'validation_contract'
    | 'state_management'
    | 'fixture_mock'
    | 'adapter_bridge'
    | 'scoring_engine'
    | 'event_processing'
    | 'data_access'
    | 'utility'
    | 'routing'
    | 'controller'
    | 'service'
    | 'data_model'
    | 'configuration'
    | 'test'
    | 'script'
    | 'style'
    | 'documentation'
    | 'unknown';

export interface FileProfileInfo {
    profile:     FileProfile;
    label:       string;
    description: string;
}

const PROFILE_INFO: Record<FileProfile, FileProfileInfo> = {
    orchestration: {
        profile:     'orchestration',
        label:       'Orchestration',
        description: 'Coordination files often connect several flows and may be dense even when intentional.',
    },
    entrypoint: {
        profile:     'entrypoint',
        label:       'Entrypoint',
        description: 'Entrypoints wire application startup and platform integration, so centrality can be expected.',
    },
    parser: {
        profile:     'parser',
        label:       'Parser',
        description: 'Parsing logic can be naturally branch-heavy because it handles syntax and edge cases.',
    },
    decision_table: {
        profile:     'decision_table',
        label:       'Decision table',
        description: 'Classification logic can contain many explicit branches by design.',
    },
    renderer_component: {
        profile:     'renderer_component',
        label:       'Renderer component',
        description: 'UI components may accumulate state, rendering branches and event handlers.',
    },
    report_builder: {
        profile:     'report_builder',
        label:       'Report builder',
        description: 'Report generation often mixes formatting, grouping and narrative text.',
    },
    security_scanner: {
        profile:     'security_scanner',
        label:       'Security scanner',
        description: 'Security scanners often contain pattern rules and conservative matching logic.',
    },
    dependency_audit: {
        profile:     'dependency_audit',
        label:       'Dependency audit',
        description: 'Dependency audit code coordinates package discovery, external tool output and advisory data.',
    },
    change_analysis: {
        profile:     'change_analysis',
        label:       'Change analysis',
        description: 'Git/churn analysis often groups log parsing, commit grouping and change metrics.',
    },
    summary: {
        profile:     'summary',
        label:       'Summary',
        description: 'Summary files condense state, metrics or events into concise views for readers.',
    },
    graph_layout: {
        profile:     'graph_layout',
        label:       'Graph/layout',
        description: 'Graph and layout files often model relationships, positions or dependency structure.',
    },
    formatter: {
        profile:     'formatter',
        label:       'Formatter',
        description: 'Formatting and text-display files shape labels, messages or values for presentation.',
    },
    validation_contract: {
        profile:     'validation_contract',
        label:       'Validation/contract',
        description: 'Validation and contract files define accepted shapes, constraints or API expectations.',
    },
    state_management: {
        profile:     'state_management',
        label:       'State management',
        description: 'State management files coordinate stores, reducers or transitions over application state.',
    },
    fixture_mock: {
        profile:     'fixture_mock',
        label:       'Fixture/mock',
        description: 'Fixture and mock files provide sample data or substitutes for tests and local workflows.',
    },
    adapter_bridge: {
        profile:     'adapter_bridge',
        label:       'Adapter/bridge',
        description: 'Adapter and bridge files connect the project to an API, protocol or provider.',
    },
    scoring_engine: {
        profile:     'scoring_engine',
        label:       'Scoring engine',
        description: 'Scoring engine files calculate scores, weights, rankings or baselines.',
    },
    event_processing: {
        profile:     'event_processing',
        label:       'Event processing',
        description: 'Event processing files normalize, interpret or distribute events.',
    },
    data_access: {
        profile:     'data_access',
        label:       'Data access',
        description: 'Persistence modules often group schema, queries and migration-oriented logic.',
    },
    utility: {
        profile:     'utility',
        label:       'Utility',
        description: 'Utility modules are usually shared support code; centrality alone is not a diagnosis.',
    },
    routing: {
        profile:     'routing',
        label:       'Routing',
        description: 'Routing files map URLs, screens or messages to handlers and can be central by design.',
    },
    controller: {
        profile:     'controller',
        label:       'Controller',
        description: 'Controller files often translate external requests into application actions.',
    },
    service: {
        profile:     'service',
        label:       'Service',
        description: 'Service files usually group business workflows and coordination around a domain concern.',
    },
    data_model: {
        profile:     'data_model',
        label:       'Data model',
        description: 'Model and schema files define data shapes and validation rules used across the project.',
    },
    configuration: {
        profile:     'configuration',
        label:       'Configuration',
        description: 'Configuration files wire tools, environments and project-level behavior.',
    },
    test: {
        profile:     'test',
        label:       'Test',
        description: 'Test files encode expected behavior and may contain setup, fixtures and assertions.',
    },
    script: {
        profile:     'script',
        label:       'Script',
        description: 'Scripts often automate local workflows and can mix orchestration with one-off tasks.',
    },
    style: {
        profile:     'style',
        label:       'Style',
        description: 'Style files define presentation rules rather than application control flow.',
    },
    documentation: {
        profile:     'documentation',
        label:       'Documentation',
        description: 'Documentation files explain project behavior, usage or decisions for human readers.',
    },
    unknown: {
        profile:     'unknown',
        label:       'Unknown',
        description: 'No specific file role was inferred from the current heuristics.',
    },
};

function normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/');
}

function byProfile(profile: FileProfile): FileProfileInfo {
    return PROFILE_INFO[profile];
}

interface FileProfileContext {
    normalized:           string;
    lower:                string;
    name:                 string;
    extension:            string;
    nameWithoutExtension: string;
    segments:             string[];
}

type FileProfileRule = {
    profile: FileProfile;
    matches: (ctx: FileProfileContext) => boolean;
};

function createFileProfileContext(filePath: string): FileProfileContext {
    const normalized = normalizePath(filePath);
    const lower = normalized.toLowerCase();
    const name = lower.split('/').pop() ?? lower;
    const extensionMatch = name.match(/\.([^.]+)$/);
    const extension = extensionMatch?.[1] ?? '';
    const nameWithoutExtension = extension ? name.slice(0, -(extension.length + 1)) : name;

    return {
        normalized,
        lower,
        name,
        extension,
        nameWithoutExtension,
        segments: lower.split('/').filter(Boolean),
    };
}

function hasSegment(ctx: FileProfileContext, names: string[]): boolean {
    return ctx.segments.some(segment => names.includes(segment));
}

function hasSegmentContaining(ctx: FileProfileContext, terms: string[]): boolean {
    return ctx.segments.some(segment => terms.some(term => segment.includes(term)));
}

function hasToken(value: string, terms: string[]): boolean {
    return terms.some(term => value.includes(term));
}

function matchesAny(value: string, patterns: RegExp[]): boolean {
    return patterns.some(pattern => pattern.test(value));
}

function isRootLikeEntrypoint(ctx: FileProfileContext): boolean {
    if (!/^(?:index|main|app)\.(?:ts|tsx|js|jsx|mjs|cjs|py)$/.test(ctx.name)) return false;
    const parent = ctx.segments.at(-2) ?? '';
    return ctx.segments.length <= 2 || ['src', 'app', 'main', 'server', 'backend', 'frontend', 'renderer', 'preload', 'electron'].includes(parent);
}

function fileProfileRule(profile: FileProfile, matches: FileProfileRule['matches']): FileProfileRule {
    return { profile, matches };
}

const PROFILE_RULES: FileProfileRule[] = [
    fileProfileRule('documentation', ctx => ctx.name === 'readme.md' || ctx.name.endsWith('.md') || hasSegment(ctx, ['docs', 'documentation'])),
    fileProfileRule('style', ctx => ['css', 'scss', 'sass', 'less'].includes(ctx.extension)),
    fileProfileRule('test', ctx =>
        matchesAny(ctx.name, [/(\.|_)(?:test|spec)\.(?:ts|tsx|js|jsx|py)$/, /^test_.*\.py$/, /_test\.py$/, /tests?\.swift$/]) ||
        hasSegmentContaining(ctx, ['tests', '__tests__'])),
    fileProfileRule('fixture_mock', ctx =>
        /(?:^|[._-])(?:fixture|fixtures|mock|mocks|sample|samples|stub|stubs)(?:[._-]|$)/.test(ctx.name) ||
        hasSegment(ctx, ['fixtures', '__fixtures__', 'mocks', '__mocks__', 'samples', 'stubs'])),
    fileProfileRule('dependency_audit', ctx =>
        ctx.name.includes('dependencyaudit') ||
        ctx.name.includes('npmaudit') ||
        ctx.name.includes('packageaudit') ||
        (ctx.name.includes('audit') && hasToken(ctx.lower, ['dependency', 'dependencies', 'package', 'packages', 'advisory', 'advisories']))),
    fileProfileRule('renderer_component', ctx =>
        (/(?:^|\/)(?:components|pages|views|screens)\//.test(ctx.lower) && /\.(?:tsx|jsx|js|ts)$/.test(ctx.name)) ||
        matchesAny(ctx.name, [/view\.(?:tsx|jsx|ts|js|swift)$/, /viewcontroller\.swift$/]) ||
        ctx.name === 'contentview.swift'),
    fileProfileRule('security_scanner', ctx => hasToken(ctx.lower, ['security', 'vulnerability', 'secret']) || (ctx.name.includes('audit') && !ctx.name.includes('dependencyaudit'))),
    fileProfileRule('routing', ctx => ctx.name === 'urls.py' || /^(?:routes|router)\.(?:ts|tsx|js|jsx|py)$/.test(ctx.name) || hasSegment(ctx, ['routes', 'routers'])),
    fileProfileRule('configuration', ctx =>
        ctx.name.includes('config') ||
        ctx.name.includes('settings') ||
        hasSegment(ctx, ['config', 'configs', 'settings']) ||
        /\.(?:config)\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(ctx.name) ||
        /^(?:vite|vitest|eslint|prettier|tailwind)\.config\.(?:ts|js|mjs|cjs)$/.test(ctx.name) ||
        ['pyproject.toml', 'package.json'].includes(ctx.name)),
    fileProfileRule('script', ctx => hasSegment(ctx, ['scripts', 'script', 'bin', 'tools']) || ctx.name.endsWith('.sh') || ctx.name.endsWith('.command')),
    fileProfileRule('controller', ctx => hasSegment(ctx, ['controllers']) || ctx.name.includes('controller') || ctx.name === 'views.py'),
    fileProfileRule('validation_contract', ctx =>
        hasToken(ctx.name, ['validator', 'validation', 'contract', 'schema']) ||
        hasSegment(ctx, ['validators', 'validation', 'contracts', 'contract'])),
    fileProfileRule('data_model', ctx =>
        ctx.name === 'models.py' ||
        ctx.name === 'serializers.py' ||
        hasToken(ctx.name, ['model', 'serializer']) ||
        hasSegment(ctx, ['models', 'entities'])),
    fileProfileRule('data_access', ctx =>
        ['db.ts', 'db.js', 'database.ts', 'database.js', 'storage.py'].includes(ctx.name) ||
        hasToken(ctx.name, ['repository', 'dao', 'prisma', 'sqlite', 'sql', 'storage']) ||
        hasSegmentContaining(ctx, ['migration', 'repository', 'repositories', 'prisma'])),
    fileProfileRule('entrypoint', ctx => ['pulseapp.swift', 'app.swift', 'main.swift', 'manage.py', 'wsgi.py', 'asgi.py'].includes(ctx.name) || isRootLikeEntrypoint(ctx)),
    fileProfileRule('parser', ctx => hasToken(ctx.name, ['parser', 'parse', 'lexer', 'ast'])),
    fileProfileRule('decision_table', ctx => hasToken(ctx.name, ['diagnosis', 'classifier', 'rules', 'policy', 'fsm', 'state_machine', 'statemachine'])),
    fileProfileRule('service', ctx => hasSegment(ctx, ['services']) || ctx.name.includes('service')),
    fileProfileRule('report_builder', ctx => hasToken(ctx.name, ['report', 'export', 'markdown'])),
    fileProfileRule('change_analysis', ctx => hasToken(ctx.lower, ['churn', 'commit', 'diff']) || ctx.name.includes('git') || (ctx.name.includes('history') && !/view\.(?:tsx|jsx|ts|js|swift)$/.test(ctx.name))),
    fileProfileRule('summary', ctx => hasToken(ctx.name, ['summary', 'overview', 'digest', 'recap'])),
    fileProfileRule('graph_layout', ctx => hasToken(ctx.name, ['graph', 'layout', 'dependency', 'relation', 'coupling'])),
    fileProfileRule('formatter', ctx =>
        hasToken(ctx.name, ['formatter', 'format', 'display', 'label', 'message', 'text', 'copy']) ||
        hasSegment(ctx, ['formatters', 'messages', 'locales', 'translations'])),
    fileProfileRule('state_management', ctx =>
        /^(?:store|reducer|state|state_manager|statemanager)\.(?:ts|tsx|js|jsx|py|swift)$/.test(ctx.name) ||
        hasToken(ctx.name, ['store', 'reducer', 'statemanager', 'state_manager']) ||
        hasSegment(ctx, ['stores', 'reducers'])),
    fileProfileRule('orchestration', ctx => hasToken(ctx.name, ['scanner', 'event_bus', 'eventbus', 'coordinator', 'orchestrator'])),
    fileProfileRule('adapter_bridge', ctx =>
        hasToken(ctx.name, ['adapter', 'bridge', 'provider', 'client', 'gateway', 'connector', 'integration', 'apiclient', 'stdio', 'protocol']) ||
        hasSegment(ctx, ['adapters', 'bridges', 'providers', 'clients', 'gateways', 'connectors', 'integrations', 'protocols'])),
    fileProfileRule('scoring_engine', ctx =>
        hasToken(ctx.name, ['score', 'scorer', 'scoring', 'rank', 'ranking', 'ranker', 'weight', 'weighting', 'baseline', 'risk', 'signal']) ||
        hasSegment(ctx, ['scoring', 'ranking', 'risk-score', 'risk_score', 'signals', 'baselines'])),
    fileProfileRule('event_processing', ctx =>
        hasToken(ctx.name, ['event', 'events', 'envelope', 'dispatcher', 'dispatch', 'activity', 'lifecycle', 'meaning', 'ingestion']) ||
        hasSegment(ctx, ['events', 'eventing', 'dispatchers', 'ingestion', 'activities'])),
    fileProfileRule('utility', ctx => hasSegment(ctx, ['utils', 'util', 'helpers', 'helper', 'hooks', 'lib']) || hasToken(ctx.name, ['normalize', 'constants', 'utils', 'helper'])),
];

export function inferFileProfile(filePath: string): FileProfileInfo {
    const ctx = createFileProfileContext(filePath);
    const matched = PROFILE_RULES.find(rule => rule.matches(ctx));
    return byProfile(matched?.profile ?? 'unknown');
}
