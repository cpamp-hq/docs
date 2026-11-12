import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { channel } from '../.vitepress/channel.ts';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('the user documentation states the v2 Beta Lite contract in both languages', { skip: !channel.beta }, () => {
  const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
  for (const [file, prerelease] of [
    ['deployment/cpa-panel.md', '预发布'],
    ['en/deployment/cpa-panel.md', 'prerelease'],
  ]) {
    const doc = read(file);
    for (const needle of [
      prerelease,
      'releases/latest',
      '`management.html`',
      '/v0/management',
      '/v8/management',
      'disable-auto-update-panel: true',
      'static/management.html',
      'panel-github-repository',
      'CPA v8',
    ]) {
      assert(doc.includes(needle), `${file} must mention ${needle}`);
    }
    assert(!doc.includes('remote-management.panel-repo'), file);
  }
  // the cache lives next to config.yaml, and only the api.github.com
  // URL form gets the /releases/latest suffix; the browser form stays 1.x.
  for (const [file, needles] of [
    ['deployment/cpa-panel.md', ['`config.yaml` 同级的 `static/`', 'cpamc.router-for.me', '`api.github.com` 形式', 'github.com/<owner>/<repo>/releases/tag/<tag>']],
    ['en/deployment/cpa-panel.md', ["next to CPA's `config.yaml`", 'cpamc.router-for.me', '`api.github.com` URL', 'github.com/<owner>/<repo>/releases/tag/<tag>']],
  ]) {
    const doc = read(file);
    for (const needle of needles) assert(doc.includes(needle), `${file} must mention ${needle}`);
    assert(!doc.includes('working directory') && !doc.includes('工作目录'), `${file} must not say working directory`);
  }
});

test('the reverse-proxy example refuses non-canonical and unlisted v8 management paths', { skip: !channel.beta }, () => {
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
    for (const line of [
      'location = /v8/management/config/api-keys   { proxy_pass http://cpamp; }',
      'location ^~ /v8/management/config/api-keys/ { proxy_pass http://cpamp; }',
      'location = /v8/management  { return 404; }',
      'location ^~ /v8/management/ { return 404; }',
    ]) assert(doc.includes(line), `${file}: ${line}`);
  }
});
