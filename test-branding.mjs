import test from 'node:test';
import assert from 'node:assert/strict';
import { patchProviderIcon } from './scripts/t3-branding.mjs';

test('branding guards the known shared component and leaves other providers on the original branch', () => {
  const source = 'f=o?(0,Z.jsx)(Zz,{icon:p}):r?native:fallback;';
  const patched = patchProviderIcon(source, {'Step Code':'data:image/jpeg;base64,YQ=='});
  assert.ok(patched.includes('o&&Object.hasOwn('));
  assert.ok(patched.includes('data-local-acp-icon'));
  assert.ok(patched.endsWith(':o?(0,Z.jsx)(Zz,{icon:p}):r?native:fallback;'));
  assert.throws(() => patchProviderIcon('new upstream', {}));
  assert.throws(() => patchProviderIcon(source + source, {}));
  assert.throws(() => patchProviderIcon(source, {untrusted:'https://example.com/icon.svg'}));
});
