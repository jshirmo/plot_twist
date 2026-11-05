import test from 'node:test';
import assert from 'node:assert/strict';
import { getFirestoreDatabaseId } from './authProfileService';

test('server targets the configured named Firestore database', () => {
  assert.equal(
    getFirestoreDatabaseId(),
    'ai-studio-remixplottwistka-b830bfd3-0004-4286-8cdb-57cacdde0168'
  );
});
