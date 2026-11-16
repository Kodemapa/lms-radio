import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoursesModule } from '../courses/courses.module';
import { DrmModule } from '../drm/drm.module';
import { MediaSignerService } from './media-signer.service';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

@Module({
  imports: [AuthModule, CoursesModule, DrmModule],
  controllers: [MediaController],
  providers: [MediaService, MediaSignerService],
})
export class MediaModule {}
