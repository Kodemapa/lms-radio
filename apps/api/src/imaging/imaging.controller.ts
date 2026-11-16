import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AnnotationTerm, type DicomImageMeta, type ImagingResult, type InstructorImagingCase,
  type AttemptWorking,
} from '@obgyn/types';
import { type AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ImagingService } from './imaging.service';

const uuid = new ParseUUIDPipe();

/** Payloads are nested; they are validated with the shared zod schemas (same rules as the web form). */
@ApiTags('instructor')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('FACULTY', 'ADMIN')
@Controller('instructor')
export class ImagingAuthoringController {
  constructor(private readonly imaging: ImagingService) {}

  @Get('courses/:id/annotation-terms')
  @ApiOperation({ summary: "The course's annotation shorthand dictionary" })
  dictionary(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<AnnotationTerm[]> {
    return this.imaging.instructorDictionary(user, id);
  }

  @Put('courses/:id/annotation-terms')
  @ApiOperation({ summary: 'Replace the annotation shorthand dictionary' })
  saveDictionary(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body() body: unknown): Promise<AnnotationTerm[]> {
    return this.imaging.saveDictionary(user, id, body);
  }

  @Put('media/:id/calibration')
  @ApiOperation({ summary: 'Set the scale (mm per pixel) of an uploaded case image' })
  calibrate(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body() body: { mmPerPx?: unknown }): Promise<DicomImageMeta> {
    return this.imaging.setCalibration(user, id, body?.mmPerPx);
  }

  @Get('lessons/:id/imaging')
  @ApiOperation({ summary: 'Imaging case: images, reference measurements, tolerances, findings' })
  get(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<InstructorImagingCase> {
    return this.imaging.instructorCase(user, id);
  }

  @Put('imaging-attempts/:id/working')
  @ApiOperation({ summary: "Verify a learner's working on a DICOM case, or return it with feedback" })
  reviewWorking(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body() body: unknown): Promise<AttemptWorking> {
    return this.imaging.reviewWorking(user, id, body);
  }

  @Put('lessons/:id/imaging')
  @ApiOperation({ summary: 'Save the case and regenerate the reference DICOM SR' })
  save(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body() body: unknown): Promise<InstructorImagingCase> {
    return this.imaging.saveCase(user, id, body);
  }
}

@ApiTags('learning')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('learn')
export class ImagingLearningController {
  constructor(private readonly imaging: ImagingService) {}

  @Post('lessons/:id/imaging/attempts')
  @ApiOperation({ summary: 'Submit a DICOM SR (base64) for grading' })
  submit(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body() body: unknown): Promise<ImagingResult> {
    return this.imaging.submit(user, id, body);
  }
}
