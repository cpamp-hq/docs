import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createMarkdownRenderer } from 'vitepress';
import { channel } from '../.vitepress/channel.ts';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let cachedRenderer;
const getMarkdownRenderer = async () => {
  if (!cachedRenderer) {
    cachedRenderer = await createMarkdownRenderer(ROOT, {
      highlight: () => '',
      headers: { level: [1, 2, 3, 4, 5, 6] },
    });
  }
  return cachedRenderer;
};

const collectMarkdownFiles = (rootDir) => {
  const files = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory() && !['node_modules', '.git', '.vitepress', 'tests'].includes(entry.name)) {
        visit(abs);
      } else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md') {
        files.push(abs);
      }
    }
  };
  visit(rootDir);
  return files.sort();
};

const parseDocTokens = (md, relPath) => {
  const absPath = path.join(ROOT, relPath);
  const raw = fs.readFileSync(absPath, 'utf8');
  const env = { path: absPath, realPath: absPath, cleanUrls: false };
  md.render(raw, env);
  const tokens = md.parse(env.content, { path: absPath, realPath: absPath, cleanUrls: false });
  const fences = [];
  const codeInline = [];
  for (const token of tokens) {
    if (token.type === 'fence') {
      const lang = (token.info || '')
        .trim()
        .split(/\s+/)[0]
        .replace(/[:{=].*$/, '')
        .toLowerCase();
      fences.push({ lang, content: token.content });
    }
    if (token.type === 'inline' && Array.isArray(token.children)) {
      for (const child of token.children) {
        if (child.type === 'code_inline') codeInline.push(child.content);
      }
    }
  }
  return { raw, content: env.content, tokens, fences, codeInline };
};

const extractBracedBlock = (source, headerPattern) => {
  const match = source.match(headerPattern);
  if (!match || match.index === undefined) return null;
  const openBrace = source.indexOf('{', match.index);
  if (openBrace === -1) return null;
  let depth = 0;
  for (let i = openBrace; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(openBrace + 1, i);
    }
  }
  return null;
};


test('the reverse-proxy guard rejects duplicate slashes without rejecting canonical routes', { skip: !channel.beta }, () => {
  for (const file of ['deployment/reverse-proxy.md', 'en/deployment/reverse-proxy.md']) {
    const doc = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const match = doc.match(/if \(\$request_uri ~\* "([^"]+)"\) \{\s*return 404;\s*\}/);
    assert(match, `${file} leading-slash $request_uri guard`);
    const guard = new RegExp(match[1], 'i');
    for (const route of ['//v8/management/config/api-keys', '///v8/management/config/api-keys/claude', 'http://example.test//v8/management/config/api-keys']) {
      assert(guard.test(route), `${file}: refuse ${route}`);
    }
    for (const route of ['/v8/management/config/api-keys', '/v1/models']) {
      assert(!guard.test(route), `${file}: accept canonical ${route}`);
    }
  }
});

test(
  'the v2 nginx example defines its upgrade map and forwards the full request without path rewriting',
  { skip: !channel.beta },
  async () => {
    const md = await getMarkdownRenderer();

    for (const file of ['deployment/reverse-proxy.md', 'en/deployment/reverse-proxy.md']) {
      const parsed = parseDocTokens(md, file);
      const nginxFences = parsed.fences.filter((fence) => fence.lang === 'nginx');

      const v2BlockRaw = nginxFences[0].content;
      const directives = v2BlockRaw.replace(/(^|\s)#.*$/gm, '');

      const openBraces = (directives.match(/\{/g) ?? []).length;
      const closeBraces = (directives.match(/\}/g) ?? []).length;
      assert(openBraces > 0 && openBraces === closeBraces, `${file}: unbalanced braces in v2 nginx.conf`);

      const eventsBody = extractBracedBlock(directives, /\bevents\s*\{/);
      assert(eventsBody !== null, `${file}: v2 nginx.conf must include events {}`);

      const httpBody = extractBracedBlock(directives, /\bhttp\s*\{/);
      assert(httpBody !== null, `${file}: v2 nginx.conf must include http {}`);

      const mapIdx = httpBody.search(/\bmap\s+\$http_upgrade\s+\$connection_upgrade\s*\{/);
      const serverIdx = httpBody.search(/\bserver\s*\{/);
      assert(mapIdx !== -1 && serverIdx !== -1 && mapIdx < serverIdx, `${file}: map $http_upgrade $connection_upgrade must precede server {} inside http {}`);

      const mapBody = extractBracedBlock(httpBody, /\bmap\s+\$http_upgrade\s+\$connection_upgrade\s*\{/);
      assert(mapBody !== null, `${file}: map block inside http {}`);
      assert.match(mapBody, /\bdefault\s+upgrade\s*;/, `${file}: map default upgrade`);
      assert.match(mapBody, /''\s+(?:close|'')\s*;/, `${file}: map empty upgrade fallback`);

      const upstreamBody = extractBracedBlock(httpBody, /\bupstream\s+cpamp\s*\{/);
      assert(upstreamBody !== null, `${file}: upstream cpamp inside http {}`);
      assert.match(upstreamBody, /\bserver\s+[^\s;]+:18317\s*;/, `${file}: upstream cpamp server :18317`);

      const serverBody = extractBracedBlock(httpBody, /\bserver\s*\{/);
      assert(serverBody !== null, `${file}: server {} inside http {}`);
      assert.match(serverBody, /\bmerge_slashes\s+off\s*;/, `${file}: preserve duplicate slashes / raw URI`);

      const locationBody = extractBracedBlock(serverBody, /\blocation\s+\/\s*\{/);
      assert(locationBody !== null, `${file}: location / inside server {}`);
      for (const requiredDirective of [
        /\bproxy_http_version\s+1\.1\s*;/,
        /\bproxy_buffering\s+off\s*;/,
        /\bproxy_request_buffering\s+off\s*;/,
        /\bproxy_cache\s+off\s*;/,
        /\bproxy_read_timeout\s+\d+[smh]?\s*;/,
        /\bproxy_send_timeout\s+\d+[smh]?\s*;/,
        /\bproxy_set_header\s+Upgrade\s+\$http_upgrade\s*;/,
        /\bproxy_set_header\s+Connection\s+\$connection_upgrade\s*;/,
        /\bproxy_pass\s+http:\/\/cpamp\s*;/,
      ]) {
        assert.match(locationBody, requiredDirective, `${file}: missing ${requiredDirective}`);
      }

      assert.doesNotMatch(directives, /\bproxy_pass\s+http:\/\/cpamp\//, `${file}: proxy_pass must not carry a URI`);
      assert.doesNotMatch(directives, /\brewrite\b/, `${file}: v2 nginx.conf must not rewrite paths`);

    }
  }
);

test(
  'mode-specific URL examples and prefix contracts remain consistent across Local/Fresh/Copy-in, External, and Lite docs',
  { skip: !channel.beta },
  async () => {
    const md = await getMarkdownRenderer();
    const allFiles = collectMarkdownFiles(ROOT);

    for (const absPath of allFiles) {
      const relPath = path.relative(ROOT, absPath).replaceAll(path.sep, '/');
      const parsed = parseDocTokens(md, relPath);

      for (const candidate of [
        ...parsed.fences.map((fence) => fence.content),
        ...parsed.codeInline,
      ]) {
        assert.doesNotMatch(
          candidate,
          /https?:\/\/[^\s/`'"]+:1831[78]\/(?:v1(?:beta)?|openai\/v1|backend-api\/codex|v8\/management)\b/,
          `${relPath}: unprefixed v2 :18317/:18318 endpoint example in code (${candidate})`
        );
      }
    }

    for (const file of ['gateway/clients.md', 'en/gateway/clients.md']) {
      const parsed = parseDocTokens(md, file);
      const examples = [...parsed.codeInline, ...parsed.fences.map((fence) => fence.content)].join('\n');
      const origins = new Set([...examples.matchAll(/https?:\/\/([^\s/`"'=]+)(\/[^\s`"']*)?/g)]
        .map((match) => `${match[1]}${match[2] || ''}`));
      assert(origins.has('<cpamp-host><inference-prefix>/v1'), `${file}: missing Managed inference URL example`);
      assert(origins.has('<cpa-host>/v1'), `${file}: missing direct External inference URL example`);
    }

  }
);
