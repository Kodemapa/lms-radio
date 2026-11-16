import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoursesModule } from '../courses/courses.module';
import { ImagingAuthoringController, ImagingLearningController } from './imaging.controller';
import { ImagingService } from './imaging.service';

@Module({
  imports: [AuthModule, CoursesModule],
  controllers: [ImagingAuthoringController, ImagingLearningController],
  providers: [ImagingService],
  exports: [ImagingService],
})
export class ImagingModule {}
