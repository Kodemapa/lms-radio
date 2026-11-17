import { Injectable } from '@nestjs/common';
import { AdminAuditQuerySchema, type AdminAuditEntry, type AdminAuditPage, type AdminAuditQuery } from '@obgyn/types';
import { type Prisma } from '@prisma/client';
import { type Response } from 'express';
import { AuditService } from '../../audit/audit.service';
import { type AuthUser } from '../../auth/auth-user';
import { startCsv, streamCsvRows } from '../../common/csv';
import { zodOrThrow } from '../../common/zod';
import { PrismaService } from '../../prisma/prisma.service';

const IST = '+05:30';
const INCLUDE = { actor: { select: { displayName: true } } } satisfies Prisma.AuditLogInclude;
type Row = Prisma.AuditLogGetPayload<{ include: typeof INCLUDE }>;

/** Read-only view of the append-only audit trail. */
@Injectable()
export class AdminAuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  parse(query: unknown): AdminAuditQuery {
    return zodOrThrow(AdminAuditQuerySchema, query);
  }

  async list(query: AdminAuditQuery): Promise<AdminAuditPage> {
    const rows = await this.prisma.auditLog.findMany({
      where: this.where(query),
      include: INCLUDE,
      orderBy: { id: 'desc' },
      take: query.limit + 1,
    });
    const more = rows.length > query.limit;
    const items = rows.slice(0, query.limit).map(toEntry);
    return { items, nextCursor: more ? items[items.length - 1]!.id : null };
  }

  async exportCsv(admin: AuthUser, query: AdminAuditQuery, res: Response): Promise<void> {
    const where = this.where({ ...query, cursor: undefined });
    startCsv(res, 'audit-log.csv', ['Time (UTC)', 'Actor', 'Actor ID', 'Action', 'Resource', 'Resource ID', 'IP', 'Details']);
    const count = await streamCsvRows<Row>(
      res,
      (last) =>
        this.prisma.auditLog.findMany({
          where: last ? { AND: [where, { id: { lt: last.id } }] } : where,
          include: INCLUDE,
          orderBy: { id: 'desc' },
          take: 1000,
        }),
      (row) => [
        row.createdAt.toISOString(),
        row.actor?.displayName ?? null,
        row.actorId,
        row.action,
        row.resource,
        row.resourceId,
        row.ip,
        row.metadata === null ? null : JSON.stringify(row.metadata),
      ],
    );
    res.end();
    await this.audit.log({
      actorId: admin.userId,
      action: 'admin.export',
      resource: 'audit_log',
      metadata: { kind: 'audit-log', rows: count, filters: { ...query, cursor: undefined, limit: undefined } },
    });
  }

  private where(query: AdminAuditQuery): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = {};
    if (query.actorId) where.actorId = query.actorId;
    if (query.action) where.action = { startsWith: query.action };
    if (query.resource) where.resource = query.resource;
    if (query.resourceId) where.resourceId = query.resourceId;
    if (query.from || query.to) {
      // Dates are days in India time; `to` is inclusive.
      where.createdAt = {
        ...(query.from ? { gte: new Date(`${query.from}T00:00:00${IST}`) } : {}),
        ...(query.to ? { lt: new Date(new Date(`${query.to}T00:00:00${IST}`).getTime() + 86_400_000) } : {}),
      };
    }
    if (query.cursor) where.id = { lt: BigInt(query.cursor) };
    return where;
  }
}

function toEntry(row: Row): AdminAuditEntry {
  return {
    id: row.id.toString(),
    actorId: row.actorId,
    actorName: row.actor?.displayName ?? null,
    action: row.action,
    resource: row.resource,
    resourceId: row.resourceId,
    ip: row.ip,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
  };
}
