import * as dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';

dotenv.config();

// eslint-disable-next-line no-restricted-syntax
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('❌ DATABASE_URL is not set. Cannot run drizzle-kit.');
}

export default defineConfig({
  schema: './src/database/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: databaseUrl },
});
