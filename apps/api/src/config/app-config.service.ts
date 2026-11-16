import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env } from './env.schema';

/** Typed access to the validated environment. */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService) {}

  /** Values come from validateEnv(), so they are already parsed and typed. */
  get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key) as Env[K];
  }

  get isProduction(): boolean {
    return this.get('NODE_ENV') === 'production';
  }
}
