import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('Correct1horse');
    expect(hash.startsWith('scrypt$16384$8$1$')).toBe(true);
    await expect(verifyPassword('Correct1horse', hash)).resolves.toBe(true);
    await expect(verifyPassword('correct1horse', hash)).resolves.toBe(false);
  });

  it('salts every hash', async () => {
    expect(await hashPassword('Same1pass')).not.toBe(await hashPassword('Same1pass'));
  });

  it('rejects malformed stored values', async () => {
    await expect(verifyPassword('x', 'not-a-hash')).resolves.toBe(false);
  });
});
