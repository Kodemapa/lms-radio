import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoursesModule } from '../courses/courses.module';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';
import { SignalHub } from './signal-hub';

@Module({
  imports: [AuthModule, CoursesModule],
  controllers: [ExamsController],
  providers: [ExamsService, SignalHub],
  exports: [ExamsService],
})
export class ExamsModule {}
