import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ContactService } from './contact.service';
import { AdminContentController, ContentController } from './content.controller';
import { ContentService } from './content.service';
import { MessageOverridesService } from './message-overrides.service';

@Module({
  imports: [AuthModule],
  controllers: [ContentController, AdminContentController],
  providers: [ContentService, ContactService, MessageOverridesService],
})
export class ContentModule {}
