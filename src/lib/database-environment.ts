/** Which database a deployment is allowed to use, and whether it applies
 *  migrations to it. Read by `scripts/check-env.ts` and
 *  `scripts/migrate-production.ts` before every build.
 *
 *  Production and the `dev` deployment used to share one database, so only
 *  production applied migrations and `dev` ran new code against old tables.
 *  Give `dev` its own database and mark it `DATABASE_ENVIRONMENT=development`:
 *  it then applies migrations to that database on every deploy, and can never
 *  be mistaken for production. See docs/database-operations.md. */

type Env = Record<string, string | undefined>;

export type DatabasePlan = {
  /** Apply committed migrations before building. */
  migrate: boolean;
  errors: string[];
  warnings: string[];
};

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function databasePlan(env: Env): DatabasePlan {
  const role = env.DATABASE_ENVIRONMENT?.trim().toLowerCase() || undefined;
  const vercel = env.VERCEL_ENV;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (role && role !== "production" && role !== "development") {
    errors.push(`DATABASE_ENVIRONMENT must be "production" or "development", not "${env.DATABASE_ENVIRONMENT}".`);
    return { migrate: false, errors, warnings };
  }

  if (vercel === "production") {
    if (role === "development") errors.push("The production deployment is pointed at a database marked DATABASE_ENVIRONMENT=development. Use the production database.");
    return { migrate: errors.length === 0, errors, warnings };
  }

  if (!vercel) return { migrate: false, errors, warnings }; // Local work never migrates automatically.

  // A preview or development deployment, such as `dev`.
  if (role === "development") {
    const production = hostOf(env.PRODUCTION_DATABASE_HOST ? `postgres://${env.PRODUCTION_DATABASE_HOST}` : undefined);
    const current = hostOf(env.DIRECT_URL ?? env.DATABASE_URL);
    if (production && current && production === current) {
      errors.push("DATABASE_ENVIRONMENT=development, but DATABASE_URL points at the production database host. Use the development database.");
      return { migrate: false, errors, warnings };
    }
    return { migrate: true, errors, warnings };
  }

  const message = "This deployment shares the production database (DATABASE_ENVIRONMENT is not development), so migrations are not applied and pages using new tables will fail. Give it its own database and set DATABASE_ENVIRONMENT=development.";
  if (env.REQUIRE_DEV_DATABASE === "true") errors.push(message);
  else warnings.push(message);
  return { migrate: false, errors, warnings };
}
