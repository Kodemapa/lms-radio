import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoursesModule } from '../courses/courses.module';
import { CollaboratorsService } from './collaborators.service';
import { InsightsService } from './insights.service';
import { TeachingReviewsService } from './reviews.service';
import { TeachingController } from './teaching.controller';

@Module({
  imports: [AuthModule, CoursesModule],
  controllers: [TeachingController],
  providers: [CollaboratorsService, InsightsService, TeachingReviewsService],
  exports: [CollaboratorsService],
})
export class TeachingModule {}
