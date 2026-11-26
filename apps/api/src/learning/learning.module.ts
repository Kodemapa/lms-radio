import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuthoringModule } from '../authoring/authoring.module';
import { CoursesModule } from '../courses/courses.module';
import { ExamsModule } from '../exams/exams.module';
import { ImagingModule } from '../imaging/imaging.module';
import { EngagementService } from './engagement.service';
import { EntranceService } from './entrance.service';
import { LearningController, PublicEngagementController } from './learning.controller';
import { LearningService } from './learning.service';

@Module({
  imports: [AuthModule, CoursesModule, AuthoringModule, ImagingModule, ExamsModule],
  controllers: [LearningController, PublicEngagementController],
  providers: [LearningService, EngagementService, EntranceService],
})
export class LearningModule {}
