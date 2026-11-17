import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

/** Signed-in admins only (live session + ADMIN role). */
export const AdminOnly = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiForbiddenResponse({ description: 'Not an admin' }),
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles('ADMIN'),
  );
