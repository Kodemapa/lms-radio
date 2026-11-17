import { type CanActivate, type ExecutionContext, type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { RolesGuard } from '../src/auth/roles.guard';
import { AdminUsersController } from '../src/admin/users/admin-users.controller';
import { AdminUsersService } from '../src/admin/users/admin-users.service';

const admin = {
  userId: '6f1c2a3b-0000-4000-8000-000000000001',
  sessionId: '6f1c2a3b-0000-4000-8000-000000000002',
  role: 'ADMIN',
};

describe('Admin users API (e2e)', () => {
  let app: INestApplication;
  const users = {
    list: jest.fn().mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0, totalPages: 0 }),
    detail: jest.fn(),
    block: jest.fn().mockResolvedValue(undefined),
    unblock: jest.fn().mockResolvedValue(undefined),
    changeRole: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const adminGuard: CanActivate = {
    canActivate(context: ExecutionContext) {
      context.switchToHttp().getRequest().user = admin;
      return true;
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [
        { provide: AdminUsersService, useValue: users },
        RolesGuard,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(adminGuard)
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(() => app?.close());

  it('validates user filters before calling the service', async () => {
    await request(app.getHttpServer()).get('/admin/users?status=UNKNOWN').expect(400);
    expect(users.list).not.toHaveBeenCalled();
  });

  it('requires a reason and forwards valid block requests', async () => {
    await request(app.getHttpServer()).post('/admin/users/6f1c2a3b-0000-4000-8000-000000000003/block').send({}).expect(400);
    await request(app.getHttpServer())
      .post('/admin/users/6f1c2a3b-0000-4000-8000-000000000003/block')
      .send({ reason: 'Policy violation' })
      .expect(204);
    expect(users.block).toHaveBeenCalledWith(admin, '6f1c2a3b-0000-4000-8000-000000000003', 'Policy violation');
  });
});
