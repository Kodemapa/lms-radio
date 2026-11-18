import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { ApplicationsModule } from './applications/applications.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { AuthoringModule } from './authoring/authoring.module';
import { CategoriesModule } from './categories/categories.module';
import { ContentModule } from './content/content.module';
import { AppConfigModule } from './config/app-config.module';
import { CoursesModule } from './courses/courses.module';
import { FilesModule } from './files/files.module';
import { HealthModule } from './health/health.module';
import { ImagingModule } from './imaging/imaging.module';
import { InstructorsModule } from './instructors/instructors.module';
import { LearningModule } from './learning/learning.module';
import { MailModule } from './mail/mail.module';
import { MediaModule } from './media/media.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { StorageModule } from './storage/storage.module';
import { TeachingModule } from './teaching/teaching.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    AppConfigModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    AuditModule,
    MailModule,
    StorageModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    CoursesModule,
    InstructorsModule,
    AuthoringModule,
    LearningModule,
    UploadsModule,
    ApplicationsModule,
    AdminModule,
    ContentModule,
    MediaModule,
    ImagingModule,
    TeachingModule,
    ReportsModule,
    FilesModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
