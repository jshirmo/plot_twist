import test from 'node:test';
import assert from 'node:assert/strict';
import { bookDiscoveryPage } from './mediaCatalog';

test('book discovery starts with user preference and expands across subjects and pages', () => {
  assert.deepEqual(bookDiscoveryPage(1, 'mystery'), { subject: 'mystery', providerPage: 1 });
  const firstRound = Array.from({ length: 25 }, (_, index) => bookDiscoveryPage(index + 2, 'mystery'));
  assert.equal(new Set(firstRound.map((item) => item.subject)).size, 25);
  assert.ok(firstRound.every((item) => item.providerPage === 1));
  assert.deepEqual(bookDiscoveryPage(27, 'mystery'), { subject: firstRound[0].subject, providerPage: 2 });
  assert.ok(bookDiscoveryPage(500, 'mystery').providerPage <= 20);
});
