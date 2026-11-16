import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoursesModule } from '../courses/courses.module';
import { TeachingModule } from '../teaching/teaching.module';
import { AssessmentsController } from './assessments.controller';
import { AssessmentsService } from './assessments.service';
import { AuthoringController } from './authoring.controller';
import { BankController } from './bank.controller';
import { BankService } from './bank.service';
import { AuthoringService } from './authoring.service';

@Module({
  imports: [AuthModule, CoursesModule, TeachingModule],
  controllers: [AuthoringController, AssessmentsController, BankController],
  providers: [AuthoringService, AssessmentsService, BankService],
  exports: [BankService],
})
export class AuthoringModule {}
