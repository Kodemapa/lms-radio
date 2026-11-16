import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import path from 'node:path';
import request from 'supertest';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { HealthController } from '../src/health/health.controller';
import { MediaController } from '../src/media/media.controller';
import { MediaService } from '../src/media/media.service';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * HTTP-level tests that need no database: Prisma and the media service are
 * stubbed. Full DB-backed e2e tests run against the docker-compose Postgres.
 */
describe('API (e2e)', () => {
  let app: INestApplication;
  const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]), session: { findUnique: jest.fn() } };
  const media = { issueUrl: jest.fn(), resolveStream: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController, MediaController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: MediaService, useValue: media },
        { provide: JwtService, useValue: new JwtService({ secret: 'x'.repeat(32) }) },
        JwtAuthGuard,
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(() => app.close());

  it('GET /health is live', () =>
    request(app.getHttpServer()).get('/health').expect(200, { status: 'ok' }));

  it('GET /health/ready reports DB failure as 503', async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error('down'));
    await request(app.getHttpServer()).get('/health/ready').expect(503);
  });

  it('GET /media/:id/url requires a bearer token', () =>
    request(app.getHttpServer())
      .get('/media/6f1c2a3b-0000-4000-8000-000000000001/url')
      .expect(401));

  it('GET /media/stream rejects malformed grants before touching storage', async () => {
    await request(app.getHttpServer()).get('/media/stream?a=nope&s=nope&e=x&sig=').expect(400);
    expect(media.resolveStream).not.toHaveBeenCalled();
  });

  it('GET /media/stream redirects valid grants without caching', async () => {
    media.resolveStream.mockResolvedValueOnce({
      type: 'redirect',
      url: 'https://storage.example/obj?sig=1',
      mimeType: 'video/mp4',
    });
    const res = await request(app.getHttpServer())
      .get('/media/stream')
      .query({
        a: '6f1c2a3b-0000-4000-8000-000000000001',
        s: '6f1c2a3b-0000-4000-8000-000000000002',
        e: 1,
        sig: 'abc',
      })
      .expect(302);
    expect(res.headers.location).toBe('https://storage.example/obj?sig=1');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('GET /media/stream serves local files with Range support (dev storage)', async () => {
    media.resolveStream.mockResolvedValueOnce({
      type: 'file',
      // Inside a dot-folder, like dev uploads in .storage/.
      path: path.join(__dirname, '.fixtures', 'clip.mp4'),
      mimeType: 'video/mp4',
    });
    const res = await request(app.getHttpServer())
      .get('/media/stream')
      .query({
        a: '6f1c2a3b-0000-4000-8000-000000000001',
        s: '6f1c2a3b-0000-4000-8000-000000000002',
        e: 1,
        sig: 'abc',
      })
      .set('Range', 'bytes=0-9')
      .expect(206);
    expect(res.headers['content-range']).toMatch(/^bytes 0-9\//);
    expect(res.headers['cache-control']).toBe('no-store');
  });
});
