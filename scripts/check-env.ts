import "dotenv/config";

/** Run before every build. A deployment that boots without a database and
 *  discovers it on the first request has already served the error to someone;
 *  failing here costs nothing and names the fix. */
const errors: string[] = [];
const warnings: string[] = [];

if (!process.env.DATABASE_URL) {
  errors.push(
    "DATABASE_URL is not set. Set it to a Postgres connection string — in .env locally, " +
      "or in the deployment's environment settings."
  );
}

if (process.env.DATABASE_URL && !process.env.DIRECT_URL) {
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
