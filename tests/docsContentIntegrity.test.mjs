import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createMarkdownRenderer } from 'vitepress';

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
      else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md') result.push(absolutePath);
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

const CHANGED_BILINGUAL_PAIRS = [
  'deployment/cpa-panel.md',
  'deployment/docker.md',
  'deployment/installer.md',
  'deployment/native.md',
  'deployment/reverse-proxy.md',
  'gateway/clients.md',
  'guide/choosing-a-panel.md',
  'guide/getting-started.md',
  'guide/runtime-model.md',
  'manual/configuration.md',
  'manual/monitoring.md',
  'manual/plugins.md',
  'migration/from-cpa-manager.md',
  'operations/backup.md',
  'operations/manager-server.md',
  'operations/reset-admin-key.md',
  'operations/update.md',
  'reference/capability-matrix.md',
  'reference/faq.md',
  'troubleshooting/request-monitoring.md',
];

const COMMENT_LANGS = new Set(['', 'bash', 'sh', 'yaml', 'yml', 'nginx', 'ini', 'toml', 'env']);
const DIRECTIVE_LANGS = new Set(['bash', 'sh', 'yaml', 'yml', 'nginx']);

let cachedRenderer;
const getMarkdownRenderer = async () => {
  if (!cachedRenderer) {
    cachedRenderer = await createMarkdownRenderer(docsRoot, {
      highlight: () => '',
      headers: { level: [1, 2, 3, 4, 5, 6] },
    });
  }
  return cachedRenderer;
};

const extractHtmlLinks = (htmlText) => {
  const hrefs = [];
  for (const match of htmlText.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)) {
    hrefs.push(match[1]);
  }
  return hrefs;
};

const normalizeCodeLang = (info) =>
  (info || '')
    .trim()
    .split(/\s+/)[0]
    .replace(/[:{=].*$/, '')
    .toLowerCase();

const extractCodeSignals = (lang, content) => {
  const lines = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const stripped = COMMENT_LANGS.has(lang) ? rawLine.replace(/(^|\s)#.*$/, '') : rawLine;
    const normalized = stripped.replace(/<[^>]+>/g, '<_>').trim();
    if (normalized) lines.push(normalized);
  }
  const joined = lines.join('\n');
  const uniqueMatches = (regex) => [...new Set(joined.match(regex) ?? [])].sort();
  const leadingDirectives = [];
  if (DIRECTIVE_LANGS.has(lang)) {
    for (const line of lines) {
      const match = line.match(/^([A-Za-z0-9_.-]+:?)/);
      if (match) leadingDirectives.push(match[1]);
    }
  }
  return {
    lang,
    envVars: uniqueMatches(/\b(?:CPAMP|VITE)_[A-Z0-9_]+\b/g),
    urls: uniqueMatches(/https?:\/\/[A-Za-z0-9._:<>{}/-]+/g),
    routes: uniqueMatches(
      /(?:\/\.well-known\/cpamp-bootstrap(?:\/ui)?|\/v[018]\/[A-Za-z0-9._/*-]+|\/v1beta\/[A-Za-z0-9._/*-]+|\/management\.html|\/healthz?|\/usage-service\/[A-Za-z0-9._-]+|\/api\/v2[A-Za-z0-9._/*-]*)/g
    ),
    ports: uniqueMatches(/:(?:18317|18318|8317|6379|6060|80|443)\b/g),
    leadingDirectives,
  };
};

const normalizeLinkForParity = (href) => {
  if (href.startsWith('#')) return '#ANCHOR';
  if (!/^(?:https?:|mailto:|tel:|javascript:)/i.test(href)) {
    const hashIdx = href.indexOf('#');
    return hashIdx === -1 ? href : `${href.slice(0, hashIdx)}#ANCHOR`;
  }
  if (href.startsWith('https://cpamp-docs.seakee.dev/')) {
    return href.replace('https://cpamp-docs.seakee.dev/en/', 'https://cpamp-docs.seakee.dev/');
  }
  return href;
};

const parseMarkdownDoc = (md, relativePath) => {
  const absPath = path.join(docsRoot, relativePath);
  const raw = readFileSync(absPath, 'utf8');
  const env = { path: absPath, realPath: absPath, cleanUrls: false };
  md.render(raw, env);
  const tokens = md.parse(env.content, { path: absPath, realPath: absPath, cleanUrls: false });

  const headingIds = new Set();
  const preamble = {
    level: 0,
    id: null,
    containers: [],
    fences: [],
    tables: [],
    links: [],
    htmlBlocks: [],
  };
  const sections = [];
  let currentSection = preamble;
  const allFences = [];
  const allTables = [];
  const allLinks = [];
  const tableLinks = [];
  const inlineCodeValues = [];
  let activeTable = null;

  const pushLink = (href, source) => {
    const linkObj = { href, source };
    currentSection.links.push(linkObj);
    allLinks.push(linkObj);
    if (activeTable) tableLinks.push(linkObj);
  };

  for (const token of tokens) {
    if (token.type === 'heading_open') {
      if (
        currentSection === preamble &&
        (preamble.containers.length ||
          preamble.fences.length ||
          preamble.tables.length ||
          preamble.links.length)
      ) {
        sections.push(preamble);
      }
      const id = token.attrGet('id');
      if (id) headingIds.add(id);
      currentSection = {
        level: Number(token.tag.slice(1)),
        id,
        containers: [],
        fences: [],
        tables: [],
        links: [],
        htmlBlocks: [],
      };
      sections.push(currentSection);
    } else if (
      token.type.startsWith('container_') &&
      (token.type.endsWith('_open') || token.type.endsWith('_close'))
    ) {
      currentSection.containers.push(token.type);
    } else if (token.type === 'github_alert_open') {
      currentSection.containers.push(`github_alert_${token.meta?.type || 'unknown'}_open`);
    } else if (token.type === 'github_alert_close') {
      currentSection.containers.push('github_alert_close');
    } else if (token.type === 'fence') {
      const fence = {
        lang: normalizeCodeLang(token.info),
        content: token.content,
      };
      currentSection.fences.push(fence);
      allFences.push(fence);
    } else if (token.type === 'table_open') {
      activeTable = { inThead: false, inTbody: false, headerCols: 0, bodyRows: 0 };
    } else if (token.type === 'thead_open' && activeTable) {
      activeTable.inThead = true;
    } else if (token.type === 'thead_close' && activeTable) {
      activeTable.inThead = false;
    } else if (token.type === 'tbody_open' && activeTable) {
      activeTable.inTbody = true;
    } else if (token.type === 'tbody_close' && activeTable) {
      activeTable.inTbody = false;
    } else if (token.type === 'tr_open' && activeTable) {
      if (activeTable.inTbody) activeTable.bodyRows += 1;
    } else if (token.type === 'th_open' && activeTable) {
      if (activeTable.inThead) activeTable.headerCols += 1;
    } else if (token.type === 'table_close' && activeTable) {
      const tableSummary = {
        headerCols: activeTable.headerCols,
        bodyRows: activeTable.bodyRows,
      };
      currentSection.tables.push(tableSummary);
      allTables.push(tableSummary);
      activeTable = null;
    } else if (token.type === 'html_block') {
      currentSection.htmlBlocks.push(token.content);
      for (const href of extractHtmlLinks(token.content)) {
        pushLink(href, 'html');
      }
    }

    if (token.type === 'inline' && Array.isArray(token.children)) {
      for (const child of token.children) {
        if (child.type === 'code_inline') {
          inlineCodeValues.push(child.content);
        } else if (child.type === 'link_open') {
          const cls = child.attrGet('class') || '';
          if (cls.split(/\s+/).includes('header-anchor')) continue;
          const href = child.attrGet('href');
          if (href) pushLink(href, 'markdown');
        } else if (child.type === 'html_inline') {
          for (const href of extractHtmlLinks(child.content)) {
            pushLink(href, 'html');
          }
        }
      }
    }
  }

  if (sections.length === 0) sections.push(preamble);
  return {
    relativePath,
    frontmatter: env.frontmatter ?? {},
    headingIds,
    sections,
    allFences,
    allTables,
    allLinks,
    tableLinks,
    inlineCodeValues,
  };
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

  it('requires title and description frontmatter on discovery-critical pages', async () => {
    const md = await getMarkdownRenderer();
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
      const doc = parseMarkdownDoc(md, relativePath);
      assert.equal(typeof doc.frontmatter.title, 'string', `${relativePath} title`);
      assert(doc.frontmatter.title.trim().length > 0, `${relativePath} non-empty title`);
      assert.equal(typeof doc.frontmatter.description, 'string', `${relativePath} description`);
      assert(doc.frontmatter.description.trim().length > 0, `${relativePath} non-empty description`);
    }
  });

  it('keeps Markdown structure, code examples, and links aligned across all 20 changed bilingual pairs', async () => {
    const md = await getMarkdownRenderer();

    for (const zhPath of CHANGED_BILINGUAL_PAIRS) {
      const enPath = `en/${zhPath}`;
      assert(existsSync(path.join(docsRoot, zhPath)), `missing zh doc: ${zhPath}`);
      assert(existsSync(path.join(docsRoot, enPath)), `missing en doc: ${enPath}`);

      const zhDoc = parseMarkdownDoc(md, zhPath);
      const enDoc = parseMarkdownDoc(md, enPath);

      assert.deepEqual(
        Object.keys(zhDoc.frontmatter).sort(),
        Object.keys(enDoc.frontmatter).sort(),
        `${zhPath}: frontmatter keys mismatch`
      );

      assert.deepEqual(
        zhDoc.sections.map((section) => section.level),
        enDoc.sections.map((section) => section.level),
        `${zhPath}: heading level sequence mismatch`
      );

      for (let i = 0; i < zhDoc.sections.length; i += 1) {
        const zhSec = zhDoc.sections[i];
        const enSec = enDoc.sections[i];
        assert.deepEqual(
          zhSec.containers,
          enSec.containers,
          `${zhPath} section #${i} (${zhSec.id ?? 'preamble'}): container parity mismatch`
        );
        assert.deepEqual(
          zhSec.tables,
          enSec.tables,
          `${zhPath} section #${i} (${zhSec.id ?? 'preamble'}): table shape mismatch`
        );
        assert.deepEqual(
          zhSec.fences.map((fence) => fence.lang),
          enSec.fences.map((fence) => fence.lang),
          `${zhPath} section #${i} (${zhSec.id ?? 'preamble'}): fenced code block languages mismatch`
        );
        assert.deepEqual(
          zhSec.links.map((link) => normalizeLinkForParity(link.href)),
          enSec.links.map((link) => normalizeLinkForParity(link.href)),
          `${zhPath} section #${i} (${zhSec.id ?? 'preamble'}): link parity mismatch`
        );
      }

      assert.equal(
        zhDoc.allFences.length,
        enDoc.allFences.length,
        `${zhPath}: fenced code block count mismatch`
      );
      for (let i = 0; i < zhDoc.allFences.length; i += 1) {
        const zhSignals = extractCodeSignals(zhDoc.allFences[i].lang, zhDoc.allFences[i].content);
        const enSignals = extractCodeSignals(enDoc.allFences[i].lang, enDoc.allFences[i].content);
        assert.deepEqual(
          zhSignals,
          enSignals,
          `${zhPath} code block #${i} (${zhSignals.lang || 'plain'}): code-example parity mismatch`
        );
      }
    }
  });

  it('resolves all local file links and heading anchors across documentation pages', async () => {
    const md = await getMarkdownRenderer();
    const allPages = relativeMarkdownPaths(docsRoot);
    const parsedPages = new Map();

    for (const relPath of allPages) {
      parsedPages.set(relPath, parseMarkdownDoc(md, relPath));
    }

    for (const [sourceRel, doc] of parsedPages.entries()) {
      const sourceIsEn = sourceRel.startsWith('en/');
      for (const { href } of doc.allLinks) {
        if (/^(?:https?:|mailto:|tel:|javascript:)/i.test(href)) continue;

        const hashIdx = href.indexOf('#');
        const filePartRaw = hashIdx === -1 ? href : href.slice(0, hashIdx);
        const fragmentRaw = hashIdx === -1 ? '' : href.slice(hashIdx + 1);
        const fragment = fragmentRaw ? decodeURIComponent(fragmentRaw) : '';
        const queryIdx = filePartRaw.indexOf('?');
        const filePart = decodeURIComponent(
          queryIdx === -1 ? filePartRaw : filePartRaw.slice(0, queryIdx)
        );

        let targetAbs;
        if (!filePart) {
          targetAbs = path.join(docsRoot, sourceRel);
        } else if (/\.(?:png|jpe?g|gif|webp|svg|ico)$/i.test(filePart)) {
          targetAbs = filePart.startsWith('/')
            ? path.resolve(docsRoot, filePart.slice(1))
            : path.resolve(path.dirname(path.join(docsRoot, sourceRel)), filePart);
          const relAsset = path.relative(docsRoot, targetAbs).replaceAll(path.sep, '/');
          assert(!relAsset.startsWith('..'), `${sourceRel}: asset escapes docs root: ${href}`);
          assert(existsSync(targetAbs), `${sourceRel}: missing asset target ${href}`);
          continue;
        } else {
          let cleanFile = filePart;
          if (cleanFile.endsWith('/')) cleanFile += 'index.md';
          else if (cleanFile.endsWith('.html')) cleanFile = `${cleanFile.slice(0, -5)}.md`;
          else if (!cleanFile.endsWith('.md')) cleanFile += '.md';
          targetAbs = cleanFile.startsWith('/')
            ? path.resolve(docsRoot, cleanFile.slice(1))
            : path.resolve(path.dirname(path.join(docsRoot, sourceRel)), cleanFile);
        }

        const targetRel = path.relative(docsRoot, targetAbs).replaceAll(path.sep, '/');
        assert(!targetRel.startsWith('..'), `${sourceRel}: link escapes docs root: ${href}`);
        assert(existsSync(targetAbs), `${sourceRel}: broken local link ${href} (resolved ${targetRel})`);
        assert.equal(
          targetRel.startsWith('en/'),
          sourceIsEn,
          `${sourceRel}: cross-locale relative link ${href} -> ${targetRel}`
        );

        if (fragment) {
          const targetDoc = parsedPages.get(targetRel);
          assert(targetDoc, `${sourceRel}: target page not parsed for anchor ${href}`);
          assert(
            targetDoc.headingIds.has(fragment),
            `${sourceRel}: broken anchor ${href} (missing #${fragment} in ${targetRel}; available: ${[
              ...targetDoc.headingIds,
            ].join(', ')})`
          );
        }
      }
    }
  });


});
