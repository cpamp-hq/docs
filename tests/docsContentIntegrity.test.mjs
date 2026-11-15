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

});
