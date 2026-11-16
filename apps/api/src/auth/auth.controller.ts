import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { type Request } from 'express';
import { requestContext } from '../common/request-context';
import { type AuthUser } from './auth-user';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { DevLoginDto } from './dto/dev-login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { OtpChallengeResponseDto, RequestOtpDto } from './dto/request-otp.dto';
import { TokenPairDto } from './dto/token-pair.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Send a one-time code by SMS or email. */
  @Post('otp/request')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  requestOtp(@Body() dto: RequestOtpDto): Promise<OtpChallengeResponseDto> {
    return this.auth.requestOtp(dto);
  }

  /** Exchange a one-time code for tokens, binding this device to the account. */
  @Post('otp/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: Request): Promise<TokenPairDto> {
    return this.auth.verifyOtp(dto, requestContext(req));
  }

  /** Development only: email + fixed dev password. 404 in production. */
  @Post('dev-login')
  @HttpCode(200)
  @SkipThrottle()
  devLogin(@Body() dto: DevLoginDto, @Req() req: Request): Promise<TokenPairDto> {
    return this.auth.devLogin(dto, requestContext(req));
  }

  /** Rotate the refresh token and get a new access token. */
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  refresh(@Body() dto: RefreshDto, @Req() req: Request): Promise<TokenPairDto> {
    return this.auth.refresh(dto, requestContext(req));
  }

  /** Revoke the current session. */
  @Post('logout')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async logout(@CurrentUser() user: AuthUser, @Req() req: Request): Promise<void> {
    await this.auth.logout(user, requestContext(req));
  }
}
