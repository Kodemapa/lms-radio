import { Type } from 'class-transformer';
import { IsInt, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class StreamQueryDto {
  /** Asset id */
  @IsUUID()
  a: string;

  /** Session id the grant was issued to */
  @IsUUID()
  s: string;

  /** Expiry, unix seconds */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  e: number;

  /** HMAC signature */
  @IsString()
  @MaxLength(100)
  sig: string;
}
