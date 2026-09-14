# Parent sign-in email through Google Workspace

Bookly uses the existing Google Workspace mailbox **info@leisureworldcork.com**
to send parent sign-in codes. This mailbox has its own sign-in, as confirmed by
the owner. Delivery goes through the Gmail HTTPS API from the staff application.
The parent frontend never receives Google credentials. No separate transactional
email service or mailbox password is used.

The code, mailbox authorization and Google email credentials in Vercel are
ready. Live sending still needs deployment and delivery verification. The parent
API remains disabled until the complete launch setup is ready.

## Setup status — 14 September 2026

- Company Google Cloud project: **Bookly Parent Email** (`bookly-parent-email`),
  under `leisureworldcork.com`.
- Gmail API enabled; **Bookly Parent Email** registered with an Internal audience.
- Web OAuth client **Bookly parent sign-in email** created with the Playground
  redirect below. Reuse this client instead of creating a duplicate.
- The owner completed mailbox authorization. The token exchange and a subsequent
  refresh both succeeded, with only `gmail.send` granted. No email was sent.
- After owner confirmation, all four settings below were saved as Secret
  variables in **swimly-crm → Production** and verified in Vercel. They were not
  added to Preview, Development or the parent frontend.
- The Google email adapter is ready for release. Production deployment and real
  delivery verification remain pending.

Manage the existing client in the
[Google Cloud project](https://console.cloud.google.com/auth/clients?project=bookly-parent-email).

## One-time Google setup

1. In a company-owned Google Cloud project, enable the **Gmail API**. Configure
   the Google Auth platform with an **Internal** audience under the LeisureWorld
   Workspace organization. Only the sending mailbox authorizes this integration;
   parents continue signing in to Bookly with email codes.
2. Create an OAuth client of type **Web application**. For the setup flow below,
   register `https://developers.google.com/oauthplayground` as an authorized
   redirect URI. Keep its client ID and secret private.
3. In Google's [OAuth Playground](https://developers.google.com/oauthplayground/),
   open its configuration, select **Use your own OAuth credentials**, and enter
   that client ID and secret. Keep Google endpoints, offline access and the
   consent prompt. Using the Playground's default client would produce a refresh
   token revoked after 24 hours.
4. Request only `https://www.googleapis.com/auth/gmail.send`. Sign in as
   **info@leisureworldcork.com** and have the mailbox owner approve sending.
   This scope permits sending mail; it does not permit reading or deleting
   inbox messages. Do not select the entire Gmail scope group or domain-wide
   delegation. Your Workspace administrator may need to allow this internal app.
5. Exchange the authorization code for tokens. Store the **refresh token**,
   client ID and client secret in the staff project's Vercel settings below.
   Do not paste them into chat, commit them, include them in shared links or
   copy them into the parent project. The short-lived access token is not a
   deployment setting.

An Internal app avoids the external test-app token lifecycle. If Internal is
unavailable, resolve the company's Cloud organization setup with its Workspace
administrator before using this for live sign-in.

Google references: [OAuth setup](https://developers.google.com/workspace/guides/configure-oauth-consent),
[send-only scope](https://developers.google.com/workspace/gmail/api/auth/scopes),
[offline authorization](https://developers.google.com/identity/protocols/oauth2/web-server#offline).

## Staff Vercel settings

Set these on **swimly-crm**, in the intended deployment environment:

| Variable | Value |
| --- | --- |
| `PARENT_GOOGLE_CLIENT_ID` | Company's Google OAuth client ID |
| `PARENT_GOOGLE_CLIENT_SECRET` | That client's secret |
| `PARENT_GOOGLE_REFRESH_TOKEN` | Mailbox's offline token with only `gmail.send` |
| `PARENT_EMAIL_FROM` | `Bookly <info@leisureworldcork.com>` |

The sender must match the authorized mailbox or a send-as alias it is already
authorized to use. Use the confirmed mailbox directly for this rollout.

Redeploy after setting the variables. Keep `PARENT_API_ENABLED=false` until the
production API, frontend connection and launch checks in [parent-app.md](parent-app.md)
are complete. No parent frontend code changes are needed for this provider switch.

## Delivery and failure behaviour

- Token refresh and message submission share a ten-second request deadline.
  Both finish before the sign-in endpoint responds; nothing sends in the background.
- OAuth credentials and codes are never logged or returned to the browser.
- Revoked authorization, provider rejection, invalid responses or timeouts
  invalidate the corresponding code and return the existing safe unavailable
  response. An uncertain send is not automatically retried.
- A Google acceptance response confirms submission, not inbox delivery.
  Google Workspace sending limits still apply; changing provider does not remove
  quotas. Verify real delivery with an explicitly approved recipient during the pilot.
- If Google revokes the refresh token, repeat the mailbox authorization and
  replace it in Vercel. Never weaken Workspace security policies to bypass a block.

## Isolated verification

`npx tsx --test src/lib/parent/email.test.ts src/lib/parent/api.test.ts`
checks the real email adapter and parent router with synthetic Google responses
and an in-memory database. The local parent preview also captures mail in memory.
Neither workflow contacts Google or sends real emails.
