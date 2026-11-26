# Turnfin Classes API: guide for an outside developer

For the developer of an app that reads LeisureWorld's swim school timetable and tells Turnfin who teaches each lesson. The exact contract is [classes-api.openapi.json](classes-api.openapi.json); this page is the short version. Turnfin's side (settings, making and ending keys) is in [operations.md](operations.md).

## The basics

- **Address:** `https://turnfin.app/api/classes/v1`
- **Your key:** LeisureWorld gives you one key for your app. Send it on every request as `Authorization: Bearer <key>`. Keep it on your server; if it leaks, tell LeisureWorld and it is replaced.
- **Server to server only.** A request from a browser (one with an `Origin` header) is refused.
- **Limit:** 120 requests a minute. Past that you get `429` with a `Retry-After` header in seconds.
- **Times** are 24-hour clock times at the pool (Europe/Dublin). Dates are `YYYY-MM-DD`.
- **Errors** are always `{ "error": { "code": "...", "message": "..." } }`. Rely on the status and `code`; the message is for a person.
- **It only grows.** Fields and endpoints are added, never renamed or removed. Ignore fields you do not know.

## Classes and lessons

A **class** repeats every week and keeps one `id`. A **lesson** is that class on one date, so a lesson is `id` + `date`. The instructor is chosen **per lesson**: to give someone a class for four weeks, send four requests.

## Read the timetable

```
curl -H "Authorization: Bearer $KEY" \
  "https://turnfin.app/api/classes/v1/classes?from=2026-12-07&days=7"
```

```json
{
  "from": "2026-12-07",
  "days": 7,
  "classes": [
    {
      "id": "cmexampleclass01",
      "date": "2026-12-07",
      "day": "MONDAY",
      "start": "15:10",
      "end": "15:40",
      "durationMinutes": 30,
      "name": "Level 3",
      "programme": "Swimming Skills",
      "level": "Level 3",
      "location": "Learner pool",
      "site": { "id": "cmexamplesite01", "name": "Example site" },
      "instructor": { "id": "cmexamplestaff01", "name": "Alex Example" },
      "started": false
    }
  ]
}
```

`from` defaults to today and `days` to 7 (at most 31); `site` narrows to one site from `GET /sites`. Cancelled lessons are left out. `instructor` is `null` when nobody is chosen yet.

## See who can teach

`GET /instructors` answers `{ "instructors": [{ "id": "...", "name": "..." }] }`: the staff a class can be given to. Nobody else can be named.

## Set a lesson's instructor

```
curl -X PUT -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"date":"2026-12-07","instructorId":"cmexamplestaff01"}' \
  "https://turnfin.app/api/classes/v1/classes/cmexampleclass01/instructor"
```

Send `date` and **exactly one** of:

| Field | Meaning |
| --- | --- |
| `instructorId` | an id from `/instructors` (the surest), or `null` to leave the lesson with nobody |
| `instructorEmail` | the person's work email |
| `instructorName` | their full name as `/instructors` gives it; capitals and extra spaces do not matter |

The answer is `{ "class": { ...the lesson as it now stands... } }`. Sending the same request twice changes nothing, so it is safe to retry.

Staff can still change the instructor inside Turnfin afterwards, and the last change stands. Treat Turnfin as the record: read `/classes` again rather than assuming your last write still holds.

| Status | Code | What it means |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | a bad date, an unknown field, or not exactly one instructor field |
| 401 | `UNAUTHORIZED` | the key is missing or wrong |
| 404 | `NOT_FOUND` | no such class on the timetable |
| 409 | `INSTRUCTOR_AMBIGUOUS` | two people share that name: send `instructorId` |
| 409 | `CANNOT_ASSIGN` | the class does not run that day, is cancelled, or has already started |
| 422 | `INSTRUCTOR_NOT_FOUND` | nobody who can teach matches |
| 429 | `RATE_LIMITED` | slow down; see `Retry-After` |
| 503 | `UNAVAILABLE` | the API is switched off |

## What it never gives

No swimmers, parents, contacts, emails or attendance. Only the timetable, site names and the names of staff who can teach.
