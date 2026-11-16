import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('global CSS is non-blocking and unused scripts stay off pages that do not need them', async () => {
  const head = await readFile(new URL('../../../_includes/head.html', import.meta.url), 'utf8');
  const critical = await readFile(new URL('../../../_includes/critical-shell.html', import.meta.url), 'utf8');
  const vercel = await readFile(new URL('../../../vercel.json', import.meta.url), 'utf8');
  const home = await readFile(new URL('../../../index.html', import.meta.url), 'utf8');
  const spec = await readFile(new URL('../../../pages/spec-viewer.html', import.meta.url), 'utf8');

  assert.match(head, /critical-shell\.html/);
  assert.match(critical, /\.thematic-header\{[^}]*position:fixed/);
  assert.match(critical, /\.hidden\{display:none\}/);
  assert.match(head, /main-compiled\.css[^>]*media="print"\s+onload="this\.media='all'"/);
  assert.doesNotMatch(head, /components\/buttons\.css/);
  assert.doesNotMatch(head, /utilities\/display\.css/);
  assert.doesNotMatch(head, /css-monitor\.js/);
  assert.doesNotMatch(head, /security-utils\.js/);
  assert.match(head, /needs_ui_components/);
  assert.match(head, /needs_mermaid/);
  assert.match(head, /needs_geo/);
  assert.match(home, /needs_ui_components:\s*true/);
  assert.match(spec, /needs_mermaid:\s*true/);
  assert.match(spec, /needs_geo:\s*true/);
  assert.match(vercel, /max-age=31536000, immutable/);
  assert.match(vercel, /max-age=0, must-revalidate/);
  assert.match(vercel, /X-Content-Type-Options/);
  assert.doesNotMatch(critical, /!important/);
});
