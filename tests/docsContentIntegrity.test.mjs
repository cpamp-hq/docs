import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsRoot = repoRoot;
const configPath = path.join(docsRoot, '.vitepress/config.ts');

const contentRoots = [
  'guide',
  'gateway',
  'manual',
  'deployment',
  'operations',
  'migration',
  'troubleshooting',
  'reference',
];

const markdownFiles = (root) => {
  const result = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory() && !['node_modules', '.git', '.vitepress', 'tests'].includes(entry.name)) visit(absolutePath);
      else if (entry.isFile() && entry.name.endsWith('.md')) result.push(absolutePath);
    }
  };
  visit(root);
  return result;
};

const relativeMarkdownPaths = (root) =>
  markdownFiles(root).map((filePath) => path.relative(root, filePath).replaceAll(path.sep, '/'));

const routeToMarkdownPath = (route) => {
  if (route === '/') return path.join(docsRoot, 'index.md');
  if (route === '/en/' || route === '/en') return path.join(docsRoot, 'en/index.md');
  return path.join(docsRoot, `${route.replace(/^\//, '')}.md`);
};

describe('documentation content integrity', () => {
  it('keeps Chinese and English documentation page sets aligned', () => {
    const chinese = contentRoots.flatMap((root) =>
      relativeMarkdownPaths(path.join(docsRoot, root)).map(
        (relativePath) => `${root}/${relativePath}`
      )
    );
    const english = contentRoots.flatMap((root) =>
      relativeMarkdownPaths(path.join(docsRoot, 'en', root)).map(
        (relativePath) => `${root}/${relativePath}`
      )
    );

    assert.deepEqual(new Set(chinese), new Set(english));
  });

  it('keeps local VitePress navigation and sidebar links resolvable', () => {
    const config = readFileSync(configPath, 'utf8');
    const routes = [...config.matchAll(/link:\s*'([^']+)'/g)]
      .map((match) => match[1])
      .filter((route) => route.startsWith('/'));
    const missing = [...new Set(routes)].filter((route) => !existsSync(routeToMarkdownPath(route)));

    assert.deepEqual(missing, []);
  });

  it('requires title and description frontmatter on discovery-critical pages', () => {
    const criticalPages = [
      'index.md',
      'en/index.md',
      'guide/choosing-a-panel.md',
      'en/guide/choosing-a-panel.md',
      'deployment/cpa-panel.md',
      'en/deployment/cpa-panel.md',
      'reference/capability-matrix.md',
      'en/reference/capability-matrix.md',
      'manual/ai-providers.md',
      'en/manual/ai-providers.md',
      'manual/codex-inspection.md',
      'en/manual/codex-inspection.md',
      'manual/monitoring.md',
      'en/manual/monitoring.md',
      'manual/usage-analytics.md',
      'en/manual/usage-analytics.md',
    ];

    for (const relativePath of criticalPages) {
      const content = readFileSync(path.join(docsRoot, relativePath), 'utf8');
      assert.match(content, /^---[\s\S]*?\ntitle:\s*.+/, `${relativePath} title`);
      assert.match(content, /^---[\s\S]*?\ndescription:\s*.+/, `${relativePath} description`);
    }
  });

  it('keeps lightweight-panel and Manager Server boundaries accurate', () => {
    const docsContent = markdownFiles(docsRoot)
      .map((filePath) => readFileSync(filePath, 'utf8'))
      .join('\n');

    assert(!docsContent.includes('After connecting Manager Server'));
    assert(!docsContent.includes('连接 Manager Server 后'));
    assert(!docsContent.includes('full usage features still need Manager Server'));
    assert(!docsContent.includes('完整用量能力仍需 Manager Server'));
    assert(!docsContent.includes('remote-management.panel-repo'));
    assert(docsContent.includes('panel-github-repository'));
  });

  it('separates runnable product modes from the demo preview', () => {
    const docsIndex = readFileSync(path.join(docsRoot, 'index.md'), 'utf8');
    const docsIndexEn = readFileSync(path.join(docsRoot, 'en/index.md'), 'utf8');
    const choosingPanel = readFileSync(path.join(docsRoot, 'guide/choosing-a-panel.md'), 'utf8');
    const choosingPanelEn = readFileSync(
      path.join(docsRoot, 'en/guide/choosing-a-panel.md'),
      'utf8'
    );
    const capabilityMatrix = readFileSync(
      path.join(docsRoot, 'reference/capability-matrix.md'),
      'utf8'
    );
    const capabilityMatrixEn = readFileSync(
      path.join(docsRoot, 'en/reference/capability-matrix.md'),
      'utf8'
    );

    assert(!docsIndex.split('## 先体验界面')[0].includes('<h3>在线演示</h3>'));
    assert(docsIndex.includes('不是部署或运行模式'));
    assert(!docsIndexEn.split('## Preview the interface')[0].includes('<h3>Live Demo</h3>'));
    assert(docsIndexEn.includes('not a deployment or runtime mode'));
    assert(!choosingPanel.includes('| 在线演示'));
    assert(choosingPanel.includes('演示站不是面板、部署方式或运行模式'));
    assert(!choosingPanelEn.includes('| Live Demo'));
    assert(choosingPanelEn.includes('It is not a panel, deployment option, or runtime mode'));
    assert(capabilityMatrix.includes('CPAMP 轻量面板'));
    assert(capabilityMatrix.includes('CPAMP 完整模式'));
    assert(!capabilityMatrix.includes('| 在线演示'));
    assert(capabilityMatrix.includes('在线演示不是运行模式'));
    assert(!capabilityMatrix.includes('| Full Docker'));
    assert(!capabilityMatrix.includes('| 原生 Manager Server'));
    assert(capabilityMatrixEn.includes('CPAMP Lightweight Panel'));
    assert(capabilityMatrixEn.includes('CPAMP Full Mode'));
    assert(!capabilityMatrixEn.includes('| Live Demo'));
    assert(capabilityMatrixEn.includes('The Live Demo is not a runtime mode'));
    assert(!capabilityMatrixEn.includes('| Native Manager Server'));
  });

  it('keeps primary documentation user-focused and progressive', () => {
    const gettingStarted = readFileSync(path.join(docsRoot, 'guide/getting-started.md'), 'utf8');
    const gettingStartedEn = readFileSync(
      path.join(docsRoot, 'en/guide/getting-started.md'),
      'utf8'
    );
    const dashboard = readFileSync(path.join(docsRoot, 'manual/dashboard.md'), 'utf8');
    const dashboardEn = readFileSync(path.join(docsRoot, 'en/manual/dashboard.md'), 'utf8');
    const troubleshooting = readFileSync(
      path.join(docsRoot, 'troubleshooting/request-monitoring.md'),
      'utf8'
    );
    const troubleshootingEn = readFileSync(
      path.join(docsRoot, 'en/troubleshooting/request-monitoring.md'),
      'utf8'
    );
    const releases = readFileSync(path.join(docsRoot, 'reference/releases.md'), 'utf8');
    const releasesEn = readFileSync(path.join(docsRoot, 'en/reference/releases.md'), 'utf8');

    assert(gettingStarted.includes('路线一：安装轻量面板'));
    assert(gettingStarted.includes('路线二：安装完整模式'));
    assert.doesNotMatch(gettingStarted, /^services:/m);
    assert(gettingStartedEn.includes('Path 1: Install Lightweight Panel'));
    assert(gettingStartedEn.includes('Path 2: Install Full Mode'));
    assert.doesNotMatch(gettingStartedEn, /^services:/m);

    assert(!dashboard.includes('checkpoint'));
    assert(!dashboardEn.includes('hourly rollup'));
    assert(troubleshooting.indexOf('## 按顺序检查') >= 0 && troubleshooting.indexOf('## 按顺序检查') < troubleshooting.indexOf('高级诊断'));
    assert(troubleshootingEn.indexOf('## Check In This Order') >= 0 && troubleshootingEn.indexOf('## Check In This Order') < troubleshootingEn.indexOf('Advanced diagnostics'));

    assert(!releases.includes('docs/release-notes'));
    assert(!releases.includes('Tag push'));
    assert(!releasesEn.includes('docs/release-notes'));
    assert(!releasesEn.includes('GitHub Actions'));
  });
});
