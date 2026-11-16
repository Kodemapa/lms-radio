import { BadRequestException } from '@nestjs/common';

type SafeParser<T> = {
  safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: { issues: { message: string; path: (string | number)[] }[] } };
};

/** Validates a nested payload with a shared zod schema (same rules as the web form). */
export function zodOrThrow<T>(schema: SafeParser<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new BadRequestException(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  }
  return parsed.data;
}
