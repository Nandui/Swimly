# Reception (retired)

The dedicated Reception view has been removed from main. Desk work remains in
Swimmers, Classes, Today, Together and Assessments, according to each role's
existing screen access and permissions.

Reception is no longer offered in navigation, role screen choices or landing-page
choices. Stored `reception` screen keys are ignored. Roles with that old home
use the normal fallback: Overview when available, then their first accessible
screen, then Account. No database or role-permission change is required.

Old `/reception?swimmer=<id>` bookmarks redirect to the swimmer profile when
Swimmers is accessible. Without a selected swimmer they open the Swimmers list.
Other roles go to their accessible home. All redirects require sign-in.

Shared swimmers, curriculum, progress, site filters and cross-site enrolment
remain available through the existing swimmer profiles and class pages.
