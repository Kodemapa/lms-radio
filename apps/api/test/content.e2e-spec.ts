import { type CanActivate, type ExecutionContext, type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { RolesGuard } from '../src/auth/roles.guard';
import { ContactService } from '../src/content/contact.service';
import { AdminContentController, ContentController } from '../src/content/content.controller';
import { ContentService } from '../src/content/content.service';
import { MessageOverridesService } from '../src/content/message-overrides.service';

const MESSAGE_ID = '6f1c2a3b-0000-4000-8000-000000000003';

describe('Content API (e2e)', () => {
  let app: INestApplication;
  let role = 'ADMIN';
  const content = { publicPageRefs: jest.fn().mockResolvedValue([]), publicPage: jest.fn().mockResolvedValue({}) };
  const contact = {
    submit: jest.fn().mockResolvedValue(undefined),
    list: jest.fn().mockResolvedValue({ items: [], newCount: 0 }),
    setStatus: jest.fn().mockResolvedValue({}),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const messages = { publicMap: jest.fn().mockResolvedValue({}), list: jest.fn().mockResolvedValue([]), save: jest.fn() };
  const fakeAuth: CanActivate = {
    canActivate(context: ExecutionContext) {
      context.switchToHttp().getRequest().user = { userId: '6f1c2a3b-0000-4000-8000-000000000001', sessionId: 's', role };
      return true;
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ContentController, AdminContentController],
      providers: [
        { provide: ContentService, useValue: content },
        { provide: ContactService, useValue: contact },
        { provide: MessageOverridesService, useValue: messages },
        RolesGuard,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(fakeAuth)
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(() => app?.close());
  beforeEach(() => {
    role = 'ADMIN';
    jest.clearAllMocks();
  });

  it('serves the sitemap page list separately from a single page', async () => {
    await request(app.getHttpServer()).get('/content/pages').expect(200);
    expect(content.publicPageRefs).toHaveBeenCalled();
    await request(app.getHttpServer()).get('/content/pages/privacy?locale=hi').expect(200);
    expect(content.publicPage).toHaveBeenCalledWith('privacy', 'hi');
  });

  it('accepts a public contact message without signing in', async () => {
    await request(app.getHttpServer()).post('/content/contact?locale=hi').send({ name: 'Asha' }).expect(204);
    expect(contact.submit).toHaveBeenCalledWith({ name: 'Asha' }, 'hi');
  });

  it('keeps the inbox and language editor admin-only', async () => {
    role = 'LEARNER';
    await request(app.getHttpServer()).get('/admin/content/contact').expect(403);
    await request(app.getHttpServer()).put('/admin/content/messages').send({}).expect(403);
    expect(contact.list).not.toHaveBeenCalled();
    expect(messages.save).not.toHaveBeenCalled();
  });

  it('validates the message id before changing its status', async () => {
    await request(app.getHttpServer()).patch('/admin/content/contact/not-a-uuid').send({ status: 'HANDLED' }).expect(400);
    await request(app.getHttpServer()).patch(`/admin/content/contact/${MESSAGE_ID}`).send({ status: 'HANDLED' }).expect(200);
    expect(contact.setStatus).toHaveBeenCalledTimes(1);
  });
});
