import { Body, Controller, Get, Header, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { type Request } from 'express';
import { requestContext } from '../common/request-context';
import { type AuthUser } from './auth-user';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import {
  ChangePasswordDto,
  PasswordChangeOtpRequestDto,
  PasswordLoginDto,
  PasswordResetDto,
  PasswordResetRequestDto,
  SignupDto,
} from './dto/password-auth.dto';
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

  /** Create a learner account after mobile OTP verification; signs it in. 409 if it exists. */
  @Post('signup')
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  signup(@Body() dto: SignupDto, @Req() req: Request): Promise<TokenPairDto> {
    return this.auth.signup(dto, requestContext(req));
  }

  /** Email/mobile + password sign-in. 401 for invalid credentials, 403 for a blocked account. */
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() dto: PasswordLoginDto, @Req() req: Request): Promise<TokenPairDto> {
    return this.auth.passwordLogin(dto, requestContext(req));
  }

  /** Request a reset code without disclosing whether the account exists. */
  @Post('password/forgot')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  forgotPassword(@Body() dto: PasswordResetRequestDto): Promise<OtpChallengeResponseDto> {
    return this.auth.requestPasswordReset(dto.target);
  }

  /** Verify a password-reset OTP; the challenge is single-use and expires. */
  @Post('password/reset')
  @HttpCode(204)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async resetPassword(@Body() dto: PasswordResetDto, @Req() req: Request): Promise<void> {
    await this.auth.resetPassword(dto, requestContext(req));
  }

  /** Re-verify the signed-in user before changing a password without their current password. */
  @Post('password/otp/request')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  requestPasswordChangeOtp(
    @CurrentUser() user: AuthUser,
    @Body() dto: PasswordChangeOtpRequestDto,
  ): Promise<OtpChallengeResponseDto> {
    return this.auth.requestPasswordChangeOtp(user, dto.channel);
  }

  /** Change the password; signs out every other session of this user. */
  @Post('password')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ): Promise<void> {
    await this.auth.changePassword(user, dto, requestContext(req));
  }

  /** Rotate the refresh token and get a new access token. */
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  refresh(@Body() dto: RefreshDto, @Req() req: Request): Promise<TokenPairDto> {
    return this.auth.refresh(dto, requestContext(req));
  }

  /**
   * Is my session still valid? 204 if so, 401 if it was signed out, revoked, expired or
   * the account was blocked/deleted. JwtAuthGuard does the whole check (token signature +
   * a database lookup of the session), and nothing else runs: no profile is loaded, so
   * the web app's periodic session check costs one indexed lookup.
   */
  @Get('session')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check that the current session is still valid (204 or 401)' })
  @ApiNoContentResponse()
  session(): void {
    // The guard has already decided.
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
