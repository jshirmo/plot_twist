// Run through the Firebase Firestore emulator, never against production.
// npx firebase emulators:exec --only firestore --project plot-twist-rules-test "node --test tests/firestore.rules.test.mjs"
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'plot-twist-rules-test',
  firestore: {
    host: '127.0.0.1',
    port: 8080,
    rules: readFileSync('firestore.rules', 'utf8'),
  },
});
test.after(async () => { await env.cleanup(); });
test.beforeEach(async () => { await env.clearFirestore(); });

const ref = (user, id = 'grp_ABC123') => doc(env.authenticatedContext(user).firestore(), 'groups', id);
async function seed(memberIds = ['alice'], id = 'grp_ABC123') {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'groups', id), {
      id, name: 'Book club', ownerId: 'alice', inviteCode: 'ABC123',
      memberIds, createdAt: '2026-11-10T12:00:00Z',
      updatedAt: '2026-11-10T12:00:00Z',
    });
  });
}

test('outsider cannot read before joining, but may add only their own UID via invite code', async () => {
  await seed();
  await assertFails(getDoc(ref('bob')));
  await assertSucceeds(updateDoc(ref('bob'), {
    memberIds: arrayUnion('bob'), updatedAt: '2026-11-10T12:01:00Z',
  }));
  const snap = await assertSucceeds(getDoc(ref('bob')));
  assert.deepEqual(snap.data().memberIds, ['alice', 'bob']);
});

test('outsider cannot join and rewrite group metadata simultaneously', async () => {
  await seed();
  await assertFails(updateDoc(ref('bob'), {
    memberIds: arrayUnion('bob'), name: 'Hijacked', updatedAt: '2026-11-10T12:01:00Z',
  }));
  await assertFails(updateDoc(ref('bob'), {
    memberIds: arrayUnion('bob'), inviteCode: 'INVALID', updatedAt: '2026-11-10T12:01:00Z',
  }));
  await assertFails(updateDoc(ref('bob'), {
    memberIds: arrayUnion('bob'), ownerId: 'bob', updatedAt: '2026-11-10T12:01:00Z',
  }));
});

test('outsider cannot add themselves plus any other person', async () => {
  await seed();
  await assertFails(updateDoc(ref('bob'), {
    memberIds: arrayUnion('bob', 'charlie'), updatedAt: '2026-11-10T12:01:00Z',
  }));
});

test('knowing arbitrary document ID is insufficient if ID is not derived from invite code', async () => {
  await seed(['alice'], 'legacy_group');
  await assertFails(updateDoc(ref('bob', 'legacy_group'), {
    memberIds: arrayUnion('bob'), updatedAt: '2026-11-10T12:01:00Z',
  }));
});

test('existing member may remove only themselves and cannot change group metadata', async () => {
  await seed(['alice', 'bob', 'charlie']);
  await assertFails(updateDoc(ref('bob'), {
    memberIds: arrayRemove('charlie'), updatedAt: '2026-11-10T12:01:00Z',
  }));
  await assertFails(updateDoc(ref('bob'), {
    name: 'Changed by member', updatedAt: '2026-11-10T12:01:00Z',
  }));
  await assertFails(deleteDoc(ref('bob')));
  await assertSucceeds(updateDoc(ref('bob'), {
    memberIds: arrayRemove('bob'), updatedAt: '2026-11-10T12:01:00Z',
  }));
  await assertFails(getDoc(ref('bob')));
});

test('owner may edit the group and delete it, but cannot transfer ownership', async () => {
  await seed();
  await assertSucceeds(updateDoc(ref('alice'), {
    name: 'Renamed club', updatedAt: '2026-11-10T12:01:00Z',
  }));
  await assertFails(updateDoc(ref('alice'), { ownerId: 'bob' }));
  await assertSucceeds(deleteDoc(ref('alice')));
});
