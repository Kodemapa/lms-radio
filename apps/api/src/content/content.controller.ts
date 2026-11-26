import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBody, ApiNoContentResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type ContactMessage,
  type ContactMessageList,
  type ContentPage,
  type Faq,
  type MessageOverride,
  type PublicPageRef,
  type SiteSettings,
} from '@obgyn/types';
import { AdminOnly } from '../admin/admin-only.decorator';
import { type AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { ContactService } from './contact.service';
import { ContentService } from './content.service';
import { MessageOverridesService } from './message-overrides.service';
import { CachedPublic } from '../cache/cached.decorator';

const uuid = new ParseUUIDPipe();

const CONTACT_BODY = {
  schema: {
    type: 'object',
    required: ['name', 'email', 'subject', 'message', 'consent'],
    properties: {
      name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string' },
      subject: { type: 'string' },
      message: { type: 'string' },
      consent: { type: 'boolean', enum: [true] },
      website: { type: 'string', description: 'Honeypot; must be empty' },
    },
  },
};

/** Public: published pages, FAQs, site settings and UI text overrides, plus the contact form. */
@ApiTags('content')
@Controller('content')
export class ContentController {
  constructor(
    private readonly content: ContentService,
    private readonly contact: ContactService,
    private readonly messages: MessageOverridesService,
  ) {}

  @Get('pages')
  @CachedPublic(300)
  @ApiOperation({ summary: 'Published page slugs and languages (for the sitemap)' })
  pageRefs(): Promise<PublicPageRef[]> {
    return this.content.publicPageRefs();
  }

  @Get('pages/:slug')
  @CachedPublic(300)
  @ApiOperation({ summary: 'A published page (falls back to English)' })
  @ApiQuery({ name: 'locale', required: false, enum: ['en', 'hi'] })
  page(@Param('slug') slug: string, @Query('locale', new DefaultValuePipe('en')) locale: string): Promise<ContentPage> {
    return this.content.publicPage(slug.slice(0, 80), locale);
  }

  @Get('faqs')
  @CachedPublic(300)
  @ApiOperation({ summary: 'Published FAQs (falls back to English)' })
  @ApiQuery({ name: 'locale', required: false, enum: ['en', 'hi'] })
  faqs(@Query('locale', new DefaultValuePipe('en')) locale: string): Promise<Faq[]> {
    return this.content.publicFaqs(locale);
  }

  @Get('settings')
  @CachedPublic(60)
  @ApiOperation({ summary: 'Public site settings (SEO defaults, contact details)' })
  settings(): Promise<SiteSettings> {
    return this.content.settings();
  }

  @Get('messages/:locale')
  @CachedPublic(300)
  @ApiOperation({ summary: 'Admin overrides of UI text for one language, keyed by message path' })
  messageOverrides(@Param('locale') locale: string): Promise<Record<string, string>> {
    return this.messages.publicMap(locale);
  }

  @Post('contact')
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send a message to the site admins (stored in the admin inbox)' })
  @ApiQuery({ name: 'locale', required: false, enum: ['en', 'hi'] })
  @ApiBody(CONTACT_BODY)
  @ApiNoContentResponse()
  submitContact(@Body() body: unknown, @Query('locale', new DefaultValuePipe('en')) locale: string): Promise<void> {
    return this.contact.submit(body, locale);
  }
}

const PAGE_BODY = {
  schema: {
    type: 'object',
    required: ['slug', 'locale', 'title', 'body'],
    properties: {
      slug: { type: 'string', example: 'privacy' },
      locale: { type: 'string', enum: ['en', 'hi'] },
      title: { type: 'string' },
      body: { type: 'string', description: 'Light Markdown: #/## headings, - lists, blank-line paragraphs' },
      published: { type: 'boolean' },
    },
  },
};
const FAQ_BODY = {
  schema: {
    type: 'object',
    required: ['locale', 'question', 'answer'],
    properties: {
      locale: { type: 'string', enum: ['en', 'hi'] },
      question: { type: 'string' },
      answer: { type: 'string' },
      position: { type: 'integer' },
      published: { type: 'boolean' },
    },
  },
};

@ApiTags('admin content')
@AdminOnly()
@Controller('admin/content')
export class AdminContentController {
  constructor(
    private readonly content: ContentService,
    private readonly contact: ContactService,
    private readonly messages: MessageOverridesService,
  ) {}

  @Get('pages')
  @ApiOperation({ summary: 'All pages, every language, drafts included' })
  pages(): Promise<ContentPage[]> {
    return this.content.pages();
  }

  @Post('pages')
  @ApiBody(PAGE_BODY)
  createPage(@CurrentUser() admin: AuthUser, @Body() body: unknown): Promise<ContentPage> {
    return this.content.createPage(admin, body);
  }

  @Patch('pages/:id')
  @ApiBody(PAGE_BODY)
  updatePage(@CurrentUser() admin: AuthUser, @Param('id', uuid) id: string, @Body() body: unknown): Promise<ContentPage> {
    return this.content.updatePage(admin, id, body);
  }

  @Delete('pages/:id')
  @HttpCode(204)
  @ApiNoContentResponse()
  deletePage(@CurrentUser() admin: AuthUser, @Param('id', uuid) id: string): Promise<void> {
    return this.content.deletePage(admin, id);
  }

  @Get('faqs')
  faqs(): Promise<Faq[]> {
    return this.content.faqs();
  }

  @Post('faqs')
  @ApiBody(FAQ_BODY)
  createFaq(@CurrentUser() admin: AuthUser, @Body() body: unknown): Promise<Faq> {
    return this.content.createFaq(admin, body);
  }

  @Patch('faqs/:id')
  @ApiBody(FAQ_BODY)
  updateFaq(@CurrentUser() admin: AuthUser, @Param('id', uuid) id: string, @Body() body: unknown): Promise<Faq> {
    return this.content.updateFaq(admin, id, body);
  }

  @Delete('faqs/:id')
  @HttpCode(204)
  @ApiNoContentResponse()
  deleteFaq(@CurrentUser() admin: AuthUser, @Param('id', uuid) id: string): Promise<void> {
    return this.content.deleteFaq(admin, id);
  }

  @Get('settings')
  settings(): Promise<SiteSettings> {
    return this.content.settings();
  }

  @Put('settings')
  @ApiOperation({ summary: 'Save public site settings (never secrets)' })
  saveSettings(@CurrentUser() admin: AuthUser, @Body() body: unknown): Promise<SiteSettings> {
    return this.content.saveSettings(admin, body);
  }

  @Get('contact')
  @ApiOperation({ summary: 'Contact-form inbox, newest first, paged' })
  @ApiQuery({ name: 'status', required: false, enum: ['NEW', 'HANDLED'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: '1–100, default 10' })
  contactMessages(@Query() query: Record<string, unknown>): Promise<ContactMessageList> {
    return this.contact.list(query);
  }

  @Patch('contact/:id')
  @ApiBody({ schema: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['NEW', 'HANDLED'] } } } })
  setContactStatus(@CurrentUser() admin: AuthUser, @Param('id', uuid) id: string, @Body() body: unknown): Promise<ContactMessage> {
    return this.contact.setStatus(admin, id, body);
  }

  @Delete('contact/:id')
  @HttpCode(204)
  @ApiNoContentResponse()
  deleteContact(@CurrentUser() admin: AuthUser, @Param('id', uuid) id: string): Promise<void> {
    return this.contact.remove(admin, id);
  }

  @Get('messages')
  @ApiOperation({ summary: 'All UI text overrides' })
  messageOverrides(): Promise<MessageOverride[]> {
    return this.messages.list();
  }

  @Put('messages')
  @HttpCode(204)
  @ApiOperation({ summary: 'Save a UI text override; value null restores the shipped text' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['locale', 'key', 'value'],
      properties: { locale: { type: 'string', enum: ['en', 'hi'] }, key: { type: 'string', example: 'Footer.about' }, value: { type: 'string', nullable: true } },
    },
  })
  @ApiNoContentResponse()
  saveMessageOverride(@CurrentUser() admin: AuthUser, @Body() body: unknown): Promise<void> {
    return this.messages.save(admin, body);
  }
}
