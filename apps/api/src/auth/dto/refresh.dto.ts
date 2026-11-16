import { IsString, IsUUID, MaxLength } from 'class-validator';

export class RefreshDto {
  @IsString()
  @MaxLength(200)
  refreshToken: string;

  @IsUUID()
  deviceId: string;
}
