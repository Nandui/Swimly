# Parent sign-in email through Google Workspace

Bookly uses the existing Google Workspace mailbox **info@leisureworldcork.com**
to send parent sign-in codes. This mailbox has its own sign-in, as confirmed by
the owner. Delivery goes through the Gmail HTTPS API from the staff application.
The parent frontend never receives Google credentials. No separate transactional
email service or mailbox password is used.

Google Workspace sending and parent sign-in are live in Vercel Production.
One owner-approved code was sent through the live parent app and its arrival in
the `info@leisureworldcork.com` inbox was verified on 14 September 2026.

## Setup status — 14 September 2026

- Company Google Cloud project: **Bookly Parent Email** (`bookly-parent-email`),
  under `leisureworldcork.com`.
- Gmail API enabled; **Bookly Parent Email** registered with an Internal audience.
- Web OAuth client **Bookly parent sign-in email** created with the Playground
  redirect below. Reuse this client instead of creating a duplicate.
- The owner completed mailbox authorization. The token exchange and a subsequent
  refresh both succeeded, with only `gmail.send` granted.
- After owner confirmation, all four settings below were saved as Secret
  variables in **swimly-crm → Production** and verified in Vercel. They were not
  added to Preview, Development or the parent frontend.
- Verified activated deployments: **swimly-crm** `dpl_3NF5ZBJ6BonborrSEvjCNffkP9vR`
  (code `d21755c8`) and **swimly-public-app** `dpl_GEWKT8SCEiTqF5BXB7BWUvzWtqXR`
  (code `09cf41e`), both READY in Production.
- With owner approval, `PARENT_API_ENABLED=true`, independent 256-bit signing
  secrets, the origin allowlist and the frontend connection were configured.
  Parent connection entries have separate Production and Preview scopes.
- The live parent app reached its code-entry step and the single test email
  arrived in the sender mailbox's Inbox. The code was not used to create a
  parent account. No swimmers, guardian links or assessment bookings were added.
- Public site and assessment reads succeed. Unauthenticated child reads return
  401, and an unapproved origin returns 403. No staff runtime errors were found
  in the release window.
- Current parent URL: `https://swimly-public-app.vercel.app`. The custom domain
  still awaits DNS; see the rollout section in [parent-app.md](parent-app.md).

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
| `PARENT_EMAIL_FROM` | `LeisureWorld Aquatics <info@leisureworldcork.com>` |

The sender must match the authorized mailbox or a send-as alias it is already
authorized to use. Use the confirmed mailbox directly for this rollout.

Redeploy after changing variables. For a new environment, keep
`PARENT_API_ENABLED=false` until the API and frontend configuration are ready for
authorized activation. Production is already enabled and delivery-verified.
See [parent-app.md](parent-app.md) for the complete connection configuration.

## Delivery and failure behaviour

Parent sign-in messages now include a branded HTML version and an equivalent
plain-text alternative. The template in `src/lib/parent/sign-in-email.ts` uses
the parent app's LeisureWorld blue palette, original white logo, readable
six-digit code and ten-minute expiry. It works for both new and returning
families and directs parents back to their existing verification page.

The logo is embedded as a CID inline image, with no external image requests,
tracking pixels, remote fonts or authentication links. Code digits remain one
selectable text string; neither subject nor preheader exposes the code. A parent
can still use the email if images or styles are blocked. Manrope is preferred
where installed, with system/Arial fallbacks for email-client compatibility.
The template includes a narrow-screen layout, dark-mode overrides and an Outlook
table-width fallback; exact rendering remains controlled by each email client.

`assets/email/leisureworld-white-no-tagline.png` is an unchanged copy of the
approved parent-app logo. Its dimensions are 1774 × 887; HTML displays it at
144 × 72. Next's output tracing explicitly bundles it with the parent API.
The shared Google transport uses `multipart/related` containing a
`multipart/alternative` text/HTML part and the inline logo. Existing Refunds
messages keep their plain-text format and their own display name. The legacy
`Bookly` sender name still maps to LeisureWorld Aquatics.

Deploy this change in the **staff app**, which sends the email. No parent frontend
deployment, new credentials, permission grants or database migrations are needed.

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

Run `npx tsx scripts/preview-parent-sign-in-email.ts --serve` for a loopback-only
browser preview using the fixed synthetic code `012345`. It writes standalone
light/dark HTML previews under ignored `.impeccable/review/` and prints the local
URL. The preview substitutes a data URL for the email's CID image; `/dark` forces
the template's dark styles for inspection. No code or message is actually sent.
