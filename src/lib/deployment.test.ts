import assert from "node:assert/strict";
import { test } from "node:test";
import { isStaging, permitsDevSignIn } from "./deployment";
test("staging fails closed for passwordless development access",()=>{
  for(const env of [{SWIMLY_DEPLOYMENT:"staging",VERCEL_ENV:"preview"},{VERCEL_GIT_COMMIT_REF:"codex/staging-redesign",VERCEL_ENV:"preview"},{SWIMLY_DEPLOYMENT:"staging",NODE_ENV:"development"}]) {assert.equal(isStaging(env),true);assert.equal(permitsDevSignIn(env),false);}
  assert.equal(permitsDevSignIn({VERCEL_ENV:"production"}),false);
  assert.equal(permitsDevSignIn({NODE_ENV:"development"}),true);
});
