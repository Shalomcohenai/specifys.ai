/**
 * Local Firestore rules checks for contactSubmissions.
 * Runs against the emulator only. Does not deploy rules.
 *
 * From backend/: npm run test:rules
 */
import { readFileSync } from 'node:fs';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const ADMIN_EMAIL = 'specifysai@gmail.com';
const PROJECT_ID = 'demo-specify-rules';

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });

  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'contactSubmissions/msg1'), {
      email: 'person@example.com',
      message: 'hello',
      status: 'new',
    });
  });
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

describe('contactSubmissions', () => {
  it('denies anonymous reads and writes', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'contactSubmissions/msg1')));
    await assertFails(setDoc(doc(db, 'contactSubmissions/new'), {
      email: 'a@b.com',
      message: 'spam',
    }));
  });

  it('denies a signed-in non-admin', async () => {
    const db = testEnv.authenticatedContext('user-1', { email: 'person@example.com' }).firestore();
    await assertFails(getDoc(doc(db, 'contactSubmissions/msg1')));
    await assertFails(updateDoc(doc(db, 'contactSubmissions/msg1'), { status: 'read' }));
  });

  it('lets an admin read and still blocks client writes', async () => {
    const db = testEnv.authenticatedContext('admin-1', { email: ADMIN_EMAIL }).firestore();
    const snap = await assertSucceeds(getDoc(doc(db, 'contactSubmissions/msg1')));
    assert.equal(snap.exists(), true);
    assert.equal(snap.data().email, 'person@example.com');
    await assertFails(setDoc(doc(db, 'contactSubmissions/from-admin'), {
      email: 'a@b.com',
      message: 'no',
    }));
    await assertFails(updateDoc(doc(db, 'contactSubmissions/msg1'), { status: 'read' }));
    await assertFails(deleteDoc(doc(db, 'contactSubmissions/msg1')));
  });
});
