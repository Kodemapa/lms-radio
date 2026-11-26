import {
  type CanActivate,
  Controller,
  type ExecutionContext,
  Get,
  type INestApplication,
  Post,
  UseGuards,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { type AuthUser } from '../src/auth/auth-user';
import { CurrentUser } from '../src/auth/current-user.decorator';
import { CacheInterceptor } from '../src/cache/cache.interceptor';
import { CACHE_STORE, CacheService } from '../src/cache/cache.service';
import { MemoryCacheStore } from '../src/cache/cache.store';
import { CachedForUser, CachedPublic } from '../src/cache/cached.decorator';

/** Test guard: the caller is whoever the `x-test-user` / `x-test-role` headers say. */
class HeaderGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    req.user = { userId: req.headers['x-test-user'], sessionId: 's', role: req.headers['x-test-role'] ?? 'LEARNER' };
    return true;
  }
}

let handlerCalls = 0;
const profiles = new Map<string, number>();

@Controller()
class ProbeController {
  @Get('me')
  @UseGuards(HeaderGuard)
  @CachedForUser(60)
  me(@CurrentUser() user: AuthUser) {
    handlerCalls++;
    return { userId: user.userId, version: profiles.get(user.userId) ?? 0 };
  }

  @Post('me')
  @UseGuards(HeaderGuard)
  update(@CurrentUser() user: AuthUser) {
    profiles.set(user.userId, (profiles.get(user.userId) ?? 0) + 1);
    return { ok: true };
  }

  @Get('catalogue')
  @CachedPublic(60)
  catalogue() {
    handlerCalls++;
    return { courses: 3 };
  }
}

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';

describe('Response cache (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
      providers: [
        { provide: CACHE_STORE, useValue: new MemoryCacheStore() },
        CacheService,
        { provide: APP_INTERCEPTOR, useClass: CacheInterceptor },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    handlerCalls = 0;
  });

  it('caches per user and never serves one user\'s response to another', async () => {
    const first = await request(app.getHttpServer()).get('/me').set('x-test-user', ALICE).expect(200);
    expect(first.headers['x-cache']).toBe('MISS');
    expect(first.headers['cache-control']).toBe('private, no-store');

    const second = await request(app.getHttpServer()).get('/me').set('x-test-user', ALICE).expect(200);
    expect(second.headers['x-cache']).toBe('HIT');
    expect(second.body.userId).toBe(ALICE);

    const bob = await request(app.getHttpServer()).get('/me').set('x-test-user', BOB).expect(200);
    expect(bob.headers['x-cache']).toBe('MISS');
    expect(bob.body.userId).toBe(BOB);
    expect(handlerCalls).toBe(2);
  });

  it('a user\'s own write is visible on their very next read', async () => {
    await request(app.getHttpServer()).get('/me').set('x-test-user', ALICE);
    await request(app.getHttpServer()).post('/me').set('x-test-user', ALICE).expect(201);
    const after = await request(app.getHttpServer()).get('/me').set('x-test-user', ALICE).expect(200);
    expect(after.headers['x-cache']).toBe('MISS');
    expect(after.body.version).toBe(profiles.get(ALICE));
  });

  it('marks public answers CDN-cacheable and per-user answers never cacheable', async () => {
    const pub = await request(app.getHttpServer()).get('/catalogue').expect(200);
    expect(pub.headers['cache-control']).toBe('public, max-age=60, s-maxage=60, stale-while-revalidate=60');
    const mine = await request(app.getHttpServer()).get('/me').set('x-test-user', ALICE).expect(200);
    expect(mine.headers['cache-control']).toBe('private, no-store');
  });

  it('caches public responses for everyone until a staff write', async () => {
    await request(app.getHttpServer()).get('/catalogue').expect(200);
    const hit = await request(app.getHttpServer()).get('/catalogue').expect(200);
    expect(hit.headers['x-cache']).toBe('HIT');

    // A learner write leaves the public cache alone...
    await request(app.getHttpServer()).post('/me').set('x-test-user', BOB);
    expect((await request(app.getHttpServer()).get('/catalogue')).headers['x-cache']).toBe('HIT');

    // ...an admin write clears it.
    await request(app.getHttpServer()).post('/me').set('x-test-user', ALICE).set('x-test-role', 'ADMIN');
    expect((await request(app.getHttpServer()).get('/catalogue')).headers['x-cache']).toBe('MISS');
  });
});
