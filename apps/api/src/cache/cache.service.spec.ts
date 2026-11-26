import { CacheService } from './cache.service';
import { MemoryCacheStore } from './cache.store';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';

describe('CacheService', () => {
  let cache: CacheService;

  beforeEach(() => {
    cache = new CacheService(new MemoryCacheStore());
  });

  it('keys user-scope entries by user ID, so one user never reads another user\'s entry', async () => {
    const aliceKey = (await cache.keyFor('user', '/users/me', ALICE))!;
    const bobKey = (await cache.keyFor('user', '/users/me', BOB))!;
    expect(aliceKey).toContain(ALICE);
    expect(bobKey).toContain(BOB);
    expect(aliceKey).not.toEqual(bobKey);

    await cache.set(aliceKey, { name: 'Alice' }, 60);
    expect(await cache.get(aliceKey)).toEqual({ name: 'Alice' });
    expect(await cache.get(bobKey)).toBeUndefined();
  });

  it('keys user-scope entries by role too, so nothing cached under an old role is served', async () => {
    const asLearner = (await cache.keyFor('user', '/users/me', ALICE, 'LEARNER'))!;
    const asFaculty = (await cache.keyFor('user', '/users/me', ALICE, 'FACULTY'))!;
    expect(asLearner).not.toEqual(asFaculty);
    await cache.set(asLearner, { role: 'LEARNER' }, 60);
    expect(await cache.get(asFaculty)).toBeUndefined();
  });

  it('refuses a user-scope key without a user', async () => {
    expect(await cache.keyFor('user', '/users/me')).toBeNull();
  });

  it('a learner write invalidates only that learner', async () => {
    const aliceKey = (await cache.keyFor('user', '/users/me/learning', ALICE))!;
    const bobKey = (await cache.keyFor('user', '/users/me/learning', BOB))!;
    const publicKey = (await cache.keyFor('public', '/courses'))!;

    await cache.afterWrite({ userId: ALICE, role: 'LEARNER' });

    expect(await cache.keyFor('user', '/users/me/learning', ALICE)).not.toEqual(aliceKey);
    expect(await cache.keyFor('user', '/users/me/learning', BOB)).toEqual(bobKey);
    expect(await cache.keyFor('public', '/courses')).toEqual(publicKey);
  });

  it('a staff write invalidates everyone, public entries included', async () => {
    const bobKey = (await cache.keyFor('user', '/users/me/learning', BOB))!;
    const publicKey = (await cache.keyFor('public', '/courses'))!;

    await cache.afterWrite({ userId: ALICE, role: 'FACULTY' });

    expect(await cache.keyFor('user', '/users/me/learning', BOB)).not.toEqual(bobKey);
    expect(await cache.keyFor('public', '/courses')).not.toEqual(publicKey);
  });

  it('invalidateUsers targets only the named users', async () => {
    const aliceKey = (await cache.keyFor('user', '/notifications', ALICE))!;
    const bobKey = (await cache.keyFor('user', '/notifications', BOB))!;
    await cache.invalidateUsers([BOB, BOB]);
    expect(await cache.keyFor('user', '/notifications', ALICE)).toEqual(aliceKey);
    expect(await cache.keyFor('user', '/notifications', BOB)).not.toEqual(bobKey);
  });

  it('distinguishes query strings', async () => {
    expect(await cache.keyFor('public', '/courses?page=1')).not.toEqual(await cache.keyFor('public', '/courses?page=2'));
  });

  it('is a no-op when disabled', async () => {
    const off = new CacheService(null);
    expect(off.enabled).toBe(false);
    expect(await off.keyFor('public', '/courses')).toBeNull();
    await expect(off.afterWrite({ userId: ALICE, role: 'ADMIN' })).resolves.toBeUndefined();
  });
});

describe('MemoryCacheStore', () => {
  it('expires entries after their TTL', async () => {
    let now = 0;
    const store = new MemoryCacheStore(10, () => now);
    await store.set('k', '"v"', 30);
    now = 29_999;
    expect(await store.get('k')).toBe('"v"');
    now = 30_000;
    expect(await store.get('k')).toBeUndefined();
  });

  it('evicts the oldest entries past its size limit', async () => {
    const store = new MemoryCacheStore(2);
    await store.set('a', '1', 60);
    await store.set('b', '2', 60);
    await store.set('c', '3', 60);
    expect(store.size).toBe(2);
    expect(await store.get('a')).toBeUndefined();
    expect(await store.get('c')).toBe('3');
  });
});
