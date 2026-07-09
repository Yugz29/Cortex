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

function pathSegments(filePath: string): string[] {
    return filePath.split('/').filter(Boolean);
}

function hasSegment(segments: string[], names: string[]): boolean {
    return segments.some(segment => names.includes(segment));
}

function hasSegmentContaining(segments: string[], terms: string[]): boolean {
    return segments.some(segment => terms.some(term => segment.includes(term)));
}

function hasNameToken(name: string, terms: string[]): boolean {
    return terms.some(term => name.includes(term));
}

function isRootLikeEntrypoint(segments: string[], name: string): boolean {
    if (!/^(?:index|main|app)\.(?:ts|tsx|js|jsx|mjs|cjs|py)$/.test(name)) return false;
    const parent = segments.at(-2) ?? '';
    return segments.length <= 2 || ['src', 'app', 'main', 'server', 'backend', 'frontend', 'renderer', 'preload', 'electron'].includes(parent);
}

export function inferFileProfile(filePath: string): FileProfileInfo {
    const normalized = normalizePath(filePath);
    const lower = normalized.toLowerCase();
    const name = lower.split('/').pop() ?? lower;
    const segments = pathSegments(lower);

    if (name === 'readme.md' || name.endsWith('.md') || hasSegment(segments, ['docs', 'documentation'])) return byProfile('documentation');
    if (/\.(css|scss|sass|less)$/.test(name)) return byProfile('style');
    if (
        /(?:^|[._-])(?:fixture|fixtures|mock|mocks|sample|samples|stub|stubs)(?:[._-]|$)/.test(name) ||
        hasSegment(segments, ['fixtures', '__fixtures__', 'mocks', '__mocks__', 'samples', 'stubs'])
    ) return byProfile('fixture_mock');
    if (/(\.|_)(?:test|spec)\.(?:ts|tsx|js|jsx|py)$/.test(name) || /^test_.*\.py$/.test(name) || /_test\.py$/.test(name) || hasSegment(segments, ['tests', '__tests__'])) return byProfile('test');

    if (
        name.includes('dependencyaudit') ||
        name.includes('npmaudit') ||
        name.includes('packageaudit') ||
        (name.includes('audit') && hasNameToken(lower, ['dependency', 'dependencies', 'package', 'packages', 'advisory', 'advisories']))
    ) return byProfile('dependency_audit');

    if (
        /(?:^|\/)(?:components|pages|views|screens)\//.test(lower) && /\.(?:tsx|jsx|js|ts)$/.test(name) ||
        /view\.(?:tsx|jsx|ts|js|swift)$/.test(name) ||
        /viewcontroller\.swift$/.test(name) ||
        name === 'contentview.swift'
    ) return byProfile('renderer_component');

    if (hasNameToken(lower, ['security', 'vulnerability', 'secret']) || (name.includes('audit') && !name.includes('dependencyaudit'))) return byProfile('security_scanner');

    if (name === 'urls.py' || /^(?:routes|router)\.(?:ts|tsx|js|jsx|py)$/.test(name) || hasSegment(segments, ['routes', 'routers'])) return byProfile('routing');

    if (
        name.includes('config') ||
        name.includes('settings') ||
        hasSegment(segments, ['config', 'configs', 'settings']) ||
        /\.(?:config)\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(name) ||
        /^(?:vite|vitest|eslint|prettier|tailwind)\.config\.(?:ts|js|mjs|cjs)$/.test(name) ||
        ['pyproject.toml', 'package.json'].includes(name)
    ) return byProfile('configuration');

    if (hasSegment(segments, ['scripts', 'script', 'bin', 'tools']) || name.endsWith('.sh') || name.endsWith('.command')) return byProfile('script');

    if (hasSegment(segments, ['controllers']) || name.includes('controller') || name === 'views.py') return byProfile('controller');

    if (
        name.includes('validator') ||
        name.includes('validation') ||
        name.includes('contract') ||
        name.includes('schema') ||
        hasSegment(segments, ['validators', 'validation', 'contracts', 'contract'])
    ) return byProfile('validation_contract');

    if (
        name === 'models.py' ||
        name === 'serializers.py' ||
        name.includes('model') ||
        name.includes('serializer') ||
        hasSegment(segments, ['models', 'entities'])
    ) return byProfile('data_model');

    if (
        name === 'db.ts' ||
        name === 'db.js' ||
        name === 'database.ts' ||
        name === 'database.js' ||
        name === 'storage.py' ||
        name.includes('repository') ||
        name.includes('dao') ||
        name.includes('prisma') ||
        name.includes('sqlite') ||
        name.includes('sql') ||
        name.includes('storage') ||
        hasSegmentContaining(segments, ['migration', 'repository', 'repositories', 'prisma'])
    ) return byProfile('data_access');

    if (name === 'pulseapp.swift' || name === 'app.swift' || name === 'main.swift' || name === 'manage.py' || name === 'wsgi.py' || name === 'asgi.py' || isRootLikeEntrypoint(segments, name)) return byProfile('entrypoint');

    if (hasNameToken(name, ['parser', 'parse', 'lexer', 'ast'])) return byProfile('parser');

    if (hasNameToken(name, ['diagnosis', 'classifier', 'rules', 'policy', 'fsm', 'state_machine', 'statemachine'])) return byProfile('decision_table');

    if (hasSegment(segments, ['services']) || name.includes('service')) return byProfile('service');

    if (hasNameToken(name, ['report', 'export', 'markdown'])) return byProfile('report_builder');

    if (hasNameToken(lower, ['churn', 'commit', 'diff']) || name.includes('git') || (name.includes('history') && !/view\.(?:tsx|jsx|ts|js|swift)$/.test(name))) return byProfile('change_analysis');

    if (hasNameToken(name, ['summary', 'overview', 'digest', 'recap'])) return byProfile('summary');

    if (hasNameToken(name, ['graph', 'layout', 'dependency', 'relation', 'coupling'])) return byProfile('graph_layout');

    if (
        hasNameToken(name, ['formatter', 'format', 'display', 'label', 'message', 'text', 'copy']) ||
        hasSegment(segments, ['formatters', 'messages', 'locales', 'translations'])
    ) return byProfile('formatter');

    if (
        /^(?:store|reducer|state|state_manager|statemanager)\.(?:ts|tsx|js|jsx|py|swift)$/.test(name) ||
        hasNameToken(name, ['store', 'reducer', 'statemanager', 'state_manager']) ||
        hasSegment(segments, ['stores', 'reducers'])
    ) return byProfile('state_management');

    if (hasNameToken(name, ['scanner', 'event_bus', 'eventbus', 'coordinator', 'orchestrator'])) return byProfile('orchestration');

    if (hasSegment(segments, ['utils', 'util', 'helpers', 'helper', 'hooks', 'lib']) || hasNameToken(name, ['normalize', 'constants', 'utils', 'helper'])) return byProfile('utility');

    return byProfile('unknown');
}
