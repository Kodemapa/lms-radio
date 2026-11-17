import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AdminDrmQuerySchema, DRM_PACKAGE_STATUSES, type AdminDrmList, type DrmPackageStatus } from '@obgyn/types';
import { type Prisma } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { type AuthUser } from '../../auth/auth-user';
import { zodOrThrow } from '../../common/zod';
import { DrmPackagerService } from '../../drm/drm-packager.service';
import { DrmService } from '../../drm/drm.service';
import { PrismaService } from '../../prisma/prisma.service';
import { pageArgs, pageCount } from '../paging';

/** Status of encrypted video packaging, with a retry for failed jobs. Keys never leave the DB. */
@Injectable()
export class AdminMediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly drm: DrmService,
    private readonly packager: DrmPackagerService,
    private readonly audit: AuditService,
  ) {}

  async list(rawQuery: unknown): Promise<AdminDrmList> {
    const query = zodOrThrow(AdminDrmQuerySchema, rawQuery);
    const where: Prisma.DrmPackageWhereInput = query.status ? { status: query.status } : {};
    const [rows, total, grouped] = await Promise.all([
      this.prisma.drmPackage.findMany({
        where,
        // Explicit select: keyCiphertext and keyId must never be returned.
        select: {
          assetId: true,
          status: true,
          attempts: true,
          error: true,
          packagedAt: true,
          updatedAt: true,
          asset: {
            select: {
              originalName: true,
              owner: { select: { displayName: true } },
              lessons: {
                where: { deletedAt: null },
                select: { id: true, title: true, course: { select: { title: true } } },
                take: 5,
              },
            },
          },
        },
        // Most recently changed first; the page filters by status to isolate failures.
        orderBy: [{ updatedAt: 'desc' }, { assetId: 'asc' }],
        ...pageArgs(query.page, query.pageSize),
      }),
      this.prisma.drmPackage.count({ where }),
      this.prisma.drmPackage.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    const counts = Object.fromEntries(DRM_PACKAGE_STATUSES.map((status) => [status, 0])) as Record<DrmPackageStatus, number>;
    for (const group of grouped) counts[group.status] = group._count._all;
    return {
      enabled: this.drm.enabled,
      counts,
      items: rows.map((row) => ({
        assetId: row.assetId,
        originalName: row.asset.originalName,
        ownerName: row.asset.owner?.displayName ?? null,
        lessons: row.asset.lessons.map((lesson) => ({ id: lesson.id, title: lesson.title, courseTitle: lesson.course.title })),
        status: row.status,
        attempts: row.attempts,
        error: row.error,
        packagedAt: row.packagedAt?.toISOString() ?? null,
        updatedAt: row.updatedAt.toISOString(),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: pageCount(total, query.pageSize),
    };
  }

  /** Re-queues a video. READY videos are re-packaged only when `force` (new keys and segments). */
  async retry(admin: AuthUser, assetId: string, force: boolean): Promise<void> {
    if (!this.drm.enabled) throw new ConflictException({ code: 'DRM_DISABLED' });
    const pkg = await this.prisma.drmPackage.findUnique({ where: { assetId }, select: { status: true } });
    if (!pkg) throw new NotFoundException();
    if (pkg.status === 'PACKAGING' || pkg.status === 'QUEUED') throw new ConflictException({ code: 'ALREADY_QUEUED' });
    if (pkg.status === 'READY' && !force) throw new ConflictException({ code: 'ALREADY_READY' });
    await this.packager.enqueue(assetId, { force: true });
    await this.audit.log({
      actorId: admin.userId,
      action: 'admin.drm_retry',
      resource: 'media_asset',
      resourceId: assetId,
      metadata: { previousStatus: pkg.status },
    });
  }
}
