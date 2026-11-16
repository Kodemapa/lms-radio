export class TokenPairDto {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires. */
  accessTokenExpiresIn: number;
  refreshTokenExpiresAt: string;
}
