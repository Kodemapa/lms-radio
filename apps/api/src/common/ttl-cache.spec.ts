import { TtlCache } from './ttl-cache';

describe('TtlCache', () => {
  it('returns a value until it expires', () => {
    let now = 1000;
    const cache = new TtlCache<string>(30_000, 10, () => now);
    cache.set('a', 'x');
    now += 29_999;
    expect(cache.get('a')).toBe('x');
    now += 1;
    expect(cache.get('a')).toBeUndefined();
  });

  it('drops the oldest entry when full', () => {
    const cache = new TtlCache<number>(1000, 2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
  });

  it('loads once and does not cache failures', async () => {
    const cache = new TtlCache<number>(1000);
    const load = jest.fn().mockResolvedValue(7);
    await expect(cache.getOrLoad('k', load)).resolves.toBe(7);
    await expect(cache.getOrLoad('k', load)).resolves.toBe(7);
    expect(load).toHaveBeenCalledTimes(1);

    const failing = jest.fn().mockRejectedValue(new Error('gone'));
    await expect(cache.getOrLoad('bad', failing)).rejects.toThrow('gone');
    await expect(cache.getOrLoad('bad', failing)).rejects.toThrow('gone');
    expect(failing).toHaveBeenCalledTimes(2);
  });
});
