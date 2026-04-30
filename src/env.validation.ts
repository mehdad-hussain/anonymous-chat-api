import { plainToInstance } from 'class-transformer';
import { IsEnum, IsInt, IsUrl, Max, Min, validateSync } from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsUrl(
    { require_tld: false },
    { message: 'DATABASE_URL must be a valid URL' },
  )
  DATABASE_URL!: string;

  @IsUrl({ require_tld: false }, { message: 'REDIS_URL must be a valid URL' })
  REDIS_URL!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsInt()
  @Min(60)
  SESSION_TTL_SECONDS: number = 86400;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const messages = errors
      .map((e) => Object.values(e.constraints ?? {}).join(', '))
      .join('\n  ');

    throw new Error(`\n\n❌ Invalid environment variables:\n  ${messages}\n`);
  }

  return validatedConfig;
}
