import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoursesModule } from '../courses/courses.module';
import { InstructorReportsController, LearnerReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [AuthModule, CoursesModule],
  controllers: [InstructorReportsController, LearnerReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
