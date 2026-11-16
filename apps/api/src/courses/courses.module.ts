import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccessService } from './access.service';
import { CoursePermissions } from './course-permissions';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

@Module({
  imports: [AuthModule],
  controllers: [CoursesController],
  providers: [CoursesService, AccessService, CoursePermissions],
  exports: [AccessService, CoursePermissions],
})
export class CoursesModule {}
