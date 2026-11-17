import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ApplicationFieldInputSchema,
  ApplicationFieldOrderSchema,
  findFetalSexDeterminationText,
  type ApplicationField,
  type ApplicationFieldInput,
} from '@obgyn/types';
import { Prisma } from '@prisma/client';
import { APPLICATION_FIELD_SELECT } from '../../applications/applications.service';
import { AuditService } from '../../audit/audit.service';
import { type AuthUser } from '../../auth/auth-user';
import { zodOrThrow } from '../../common/zod';
import { PrismaService } from '../../prisma/prisma.service';

/** Extra questions on the "Become an instructor" form. Answers are kept when a field is removed. */
@Injectable()
export class AdminApplicationFieldsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(): Promise<ApplicationField[]> {
    return this.prisma.applicationField.findMany({
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: APPLICATION_FIELD_SELECT,
    });
  }

  async create(admin: AuthUser, body: unknown): Promise<ApplicationField> {
    const input = this.parse(body);
    const last = await this.prisma.applicationField.aggregate({ _max: { position: true } });
    const row = await this.unique(() =>
      this.prisma.applicationField.create({
        data: { ...this.data(input), key: input.key, position: (last._max.position ?? -1) + 1 },
        select: APPLICATION_FIELD_SELECT,
      }),
    );
    await this.log(admin, 'admin.application_field_created', row.id, { key: row.key, label: row.label });
    return row;
  }

  async update(admin: AuthUser, id: string, body: unknown): Promise<ApplicationField> {
    const input = this.parse(body);
    const current = await this.prisma.applicationField.findUnique({ where: { id }, select: { key: true } });
    if (!current) throw new NotFoundException();
    if (current.key !== input.key) throw new ConflictException({ code: 'KEY_IMMUTABLE' });
    const row = await this.prisma.applicationField.update({
      where: { id },
      data: this.data(input),
      select: APPLICATION_FIELD_SELECT,
    });
    await this.log(admin, 'admin.application_field_updated', id, { key: row.key, active: row.active, required: row.required });
    return row;
  }

  async reorder(admin: AuthUser, body: unknown): Promise<ApplicationField[]> {
    const { ids } = zodOrThrow(ApplicationFieldOrderSchema, body);
    const existing = await this.prisma.applicationField.findMany({ select: { id: true } });
    const known = new Set(existing.map((row) => row.id));
    if (ids.length !== known.size || new Set(ids).size !== ids.length || ids.some((id) => !known.has(id))) {
      throw new BadRequestException({ code: 'ORDER_MISMATCH' });
    }
    await this.prisma.$transaction(
      ids.map((id, position) => this.prisma.applicationField.update({ where: { id }, data: { position } })),
    );
    await this.log(admin, 'admin.application_fields_reordered', null, { count: ids.length });
    return this.list();
  }

  async remove(admin: AuthUser, id: string): Promise<void> {
    const row = await this.prisma.applicationField.findUnique({ where: { id }, select: { key: true, label: true } });
    if (!row) throw new NotFoundException();
    await this.prisma.applicationField.delete({ where: { id } });
    await this.log(admin, 'admin.application_field_deleted', id, row);
  }

  private parse(body: unknown): ApplicationFieldInput {
    const input = zodOrThrow(ApplicationFieldInputSchema, body);
    const text = [input.label, input.labelHi ?? '', input.helpText ?? '', ...input.options].join('\n');
    if (findFetalSexDeterminationText(text).length) throw new BadRequestException({ code: 'PCPNDT_BLOCKED' });
    return input;
  }

  private data(input: ApplicationFieldInput) {
    return {
      label: input.label,
      labelHi: input.labelHi,
      helpText: input.helpText,
      type: input.type,
      options: input.type === 'SELECT' ? input.options : [],
      required: input.required,
      active: input.active,
    };
  }

  private async unique<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ code: 'KEY_TAKEN' });
      }
      throw error;
    }
  }

  private log(admin: AuthUser, action: string, resourceId: string | null, metadata: Prisma.InputJsonObject) {
    return this.audit.log({ actorId: admin.userId, action, resource: 'application_field', resourceId, metadata });
  }
}
