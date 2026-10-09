import "dotenv/config";
import { docsStorageConfig } from '../src/modules/docs/shared/storage-config';
import { hrStorageConfig } from '../src/modules/hr/lib/storage-config';
import { databasePlan } from '../src/lib/database-environment';

/** Run before every build. A deployment that boots without a database and
 *  discovers it on the first request has already served the error to someone;
 *  failing here costs nothing and names the fix. */
const errors: string[] = [];
const warnings: string[] = [];
try { docsStorageConfig(process.env); }
catch (error) { errors.push(error instanceof Error && error.name !== 'TypeError' ? error.message : 'Check the Docs database URLs.'); }
// HR is optional until its database is provisioned, but never in a shared one.
try { if (!hrStorageConfig(process.env)) warnings.push('No HR database is set (HR_DATABASE_URL or HR_DB_DATABASE_URL), so HR and performance stays switched off.'); }
catch (error) { errors.push(error instanceof Error && error.name !== 'TypeError' ? error.message : 'Check the HR database URLs.'); }

// Production and dev must not share a database; see src/lib/database-environment.ts.
const plan = databasePlan(process.env);
errors.push(...plan.errors);
warnings.push(...plan.warnings);

if (!process.env.DATABASE_URL) {
  errors.push(
    "DATABASE_URL is not set. Set it to a Postgres connection string — in .env locally, " +
      "or in the deployment's environment settings."
  );
}

if (process.env.DATABASE_URL && !process.env.DIRECT_URL && !process.env.DATABASE_URL_UNPOOLED) {
  const url = process.env.DATABASE_URL;
  // Pooled connections cannot run DDL, so migrations need the unpooled host.
  if (/pgbouncer=true|-pooler\./.test(url)) {
    warnings.push(
      "DATABASE_URL looks pooled but DIRECT_URL is not set. Migrations run over " +
        "DIRECT_URL; set it to the unpooled counterpart of the same database."
    );
  }
}

if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
  warnings.push(
    "AUTH_SECRET is not set. Sessions will not survive a restart, and this is fatal " +
      "in production. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
  );
}

if (process.env.NODE_ENV === "production" && process.env.DEV_AUTH_BYPASS === "1") {
  warnings.push(
    "DEV_AUTH_BYPASS is set in a production build. It is ignored there by design — " +
      "remove it so nobody reads it as working."
  );
}

for (const warning of warnings) console.warn(`warn  ${warning}`);
for (const error of errors) console.error(`error ${error}`);

if (errors.length > 0) process.exit(1);
console.log(`Environment OK${warnings.length ? ` (${warnings.length} warning(s))` : ""}.`);
