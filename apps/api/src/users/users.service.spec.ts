import { BadRequestException } from '@nestjs/common';
import { type AuditService } from '../audit/audit.service';
import { type PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

const userId = '6f1c2a3b-0000-4000-8000-0000000000aa';
const assetId = '6f1c2a3b-0000-4000-8000-0000000000bb';

function setup(asset: object | null) {
  const prisma = {
    mediaAsset: { findUnique: jest.fn().mockResolvedValue(asset) },
    user: { update: jest.fn().mockResolvedValue({ id: userId }) },
  };
  const service = new UsersService(prisma as unknown as PrismaService, { log: jest.fn() } as unknown as AuditService);
  return { service, prisma };
}

const ownImage = { ownerId: userId, kind: 'IMAGE', status: 'READY', isPublic: true };

describe('UsersService.updateProfile (profile picture)', () => {
  it('sets the picture to the user’s own uploaded image', async () => {
    const { service, prisma } = setup(ownImage);
    await service.updateProfile(userId, { avatarAssetId: assetId });
    expect(prisma.user.update.mock.calls[0][0].data).toMatchObject({ avatarAssetId: assetId });
  });

  it('removes the picture with null, without looking up an asset', async () => {
    const { service, prisma } = setup(null);
    await service.updateProfile(userId, { avatarAssetId: null });
    expect(prisma.mediaAsset.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.update.mock.calls[0][0].data).toMatchObject({ avatarAssetId: null });
  });

  it.each([
    ['someone else’s image', { ...ownImage, ownerId: 'other' }],
    ['a private upload (e.g. an assignment file)', { ...ownImage, isPublic: false }],
    ['an unfinished upload', { ...ownImage, status: 'PENDING' }],
    ['a PDF', { ...ownImage, kind: 'PDF' }],
    ['a missing asset', null],
  ])('refuses %s', async (_label, asset) => {
    const { service, prisma } = setup(asset);
    await expect(service.updateProfile(userId, { avatarAssetId: assetId })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
