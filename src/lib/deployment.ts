/** Staging is identified by either its explicit setting or its pinned branch,
 * so a missing branch environment variable cannot enable development access. */
export function isStaging(environment:Record<string,string|undefined>=process.env) {
  return environment.SWIMLY_DEPLOYMENT==="staging" || environment.VERCEL_GIT_COMMIT_REF==="codex/staging-redesign";
}
export function permitsDevSignIn(environment:Record<string,string|undefined>=process.env) {
  if(isStaging(environment)||environment.VERCEL_ENV==="production")return false;
  return Boolean(environment.VERCEL_ENV)||environment.NODE_ENV!=="production";
}
