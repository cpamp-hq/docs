import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { channel } from '../.vitepress/channel.ts';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');


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
