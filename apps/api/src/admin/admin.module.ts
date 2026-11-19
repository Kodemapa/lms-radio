import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DrmModule } from '../drm/drm.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminApplicationFieldsController } from './application-fields/admin-application-fields.controller';
import { AdminApplicationFieldsService } from './application-fields/admin-application-fields.service';
import { AdminAuditController } from './audit/admin-audit.controller';
import { AdminAuditService } from './audit/admin-audit.service';
import { AdminCategoriesController } from './categories/admin-categories.controller';
import { AdminCategoriesService } from './categories/admin-categories.service';
import { AdminExportsController } from './exports/admin-exports.controller';
import { AdminExportsService } from './exports/admin-exports.service';
import { AdminMailController } from './mail/admin-mail.controller';
import { AdminMailService } from './mail/admin-mail.service';
import { AdminMediaController } from './media/admin-media.controller';
import { AdminMediaService } from './media/admin-media.service';
import { AdminReviewsController } from './reviews/admin-reviews.controller';
import { AdminReviewsService } from './reviews/admin-reviews.service';
import { AdminStatsController } from './stats/admin-stats.controller';
import { AdminStatsService } from './stats/admin-stats.service';
import { AdminUsersModule } from './users/admin-users.module';

@Module({
  imports: [AuthModule, DrmModule, AdminUsersModule],
  controllers: [
    AdminController,
    AdminStatsController,
    AdminCategoriesController,
    AdminAuditController,
    AdminReviewsController,
    AdminMediaController,
    AdminExportsController,
    AdminApplicationFieldsController,
    AdminMailController,
  ],
  providers: [
    AdminService,
    AdminStatsService,
    AdminCategoriesService,
    AdminAuditService,
    AdminReviewsService,
    AdminMediaService,
    AdminExportsService,
    AdminApplicationFieldsService,
    AdminMailService,
  ],
})
export class AdminModule {}
