#!/usr/bin/env bash
# Stage gate: checks, then screenshots of every route at 375 dark and 1280 light.
# Usage: gate.sh <stage-label>     Prints a summary; full logs in shots/gate/<label>/.
set -u
LABEL="${1:?stage label}"
OUT="/home/user/audit-kit/shots/gate/$LABEL"
mkdir -p "$OUT"
cd /home/user/swimly || exit 1

fail=0
run() { local name="$1"; shift; if "$@" >"$OUT/$name.log" 2>&1; then echo "PASS $name"; else echo "FAIL $name (see $OUT/$name.log)"; tail -25 "$OUT/$name.log"; fail=1; fi; }
run typecheck npm run typecheck
run lint npm run lint
run test npm test
run me-typecheck bash -c 'cd apps/me && npm run typecheck'
run me-lint bash -c 'cd apps/me && npm run lint'

code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3100/sign-in)
echo "sandbox /sign-in: $code"

ROUTES="/ /swim-school /duty /schedule /students /students/parents /students/parent-changes /courses /assessments /assessments/setup /assessments/awaiting-enrolment /awaiting-enrolment /legend-agreements /programmes /together /cancellations /analytics /analytics/instructors /analytics/reception /instructor /instructor/swimmers /refunds /refunds/new /docs /docs/library /docs/work /docs/reports /docs/admin /docs/documents/new /training /training/sign-off /training/expiring /training/certificates /training/courses /hr /hr/activity /rota/overview /rota /rota/day /rota/today /rota/bookings /rota/absences /core /staff /staff/details-requests /staff/devices /staff/organisation /roles /clubs /activity /account /help"
cd /home/user/audit-kit/tools
# One record of each kind, discovered fresh (ids change when the sandbox restarts).
RECS=$(timeout 240 node cdp-links.mjs x alex@sandbox.invalid sandbox-turnfin-2026 /students /courses /programmes /staff /refunds /docs/library 2>/dev/null \
  | grep -oE '/(students|courses|programmes|staff|refunds|docs/documents)/[A-Za-z0-9_]{6,}' | grep -v '/new$' | sort -u \
  | awk -F/ '{k=$2; if(!(k in s)){s[k]=1; print}}')
ARGS=()
for r in $ROUTES $RECS; do ARGS+=("$r@375@dark" "$r@1280@light"); done
timeout 1500 node cdp-shoot.mjs "$OUT/shots" alex@sandbox.invalid sandbox-turnfin-2026 "${ARGS[@]}" >"$OUT/shots.log" 2>&1
echo "screenshots: $(grep -c '\.png' "$OUT/shots.log") taken"
echo "problems (over / clipped / small / errors):"
grep -E '"over":true|"clipped":\[[^]]|"small":\[[^]]|rror' "$OUT/shots.log" | head -60
cd /home/user/swimly
[ $fail = 0 ] && echo "GATE CHECKS PASSED" || echo "GATE CHECKS FAILED"
