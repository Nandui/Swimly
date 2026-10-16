import type { PrismaClient } from "../src/generated/prisma/client";

/** A year of made-up swim school history at Hillview (club_churchfield) for
 *  Analytics: four more teachers, eighteen weekly classes across five levels,
 *  swimmers joining, passing levels, moving up and leaving (with reasons),
 *  registers, start records (some late, some cover, a few never started),
 *  skill ticks, waiting lists and assessments. Deterministic, so screenshots
 *  repeat. Every person here is invented. Loaded last by sandbox-seed.ts. */

const DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;
const FIRST = ["Aoife", "Ben", "Cian", "Dara", "Eabha", "Fionn", "Grace", "Harry", "Isla", "Jack", "Kate", "Liam", "Molly", "Niall", "Orla", "Paddy", "Rosie", "Sean", "Tara", "Una", "Victor", "Willow", "Zoe", "Adam", "Bella", "Conor", "Daisy", "Eoin", "Freya", "Gavin", "Hannah", "Ivan", "Jess", "Kian", "Lucy", "Max", "Nora", "Oscar", "Poppy", "Ronan", "Sophie", "Tom", "Ursula", "Vera", "Will", "Yasmin", "Zach", "Alice", "Bryan", "Cara"];
const LAST = ["Sample", "Example", "Fictional", "Placeholder", "Demo", "Testcase", "Madeup", "Pretend", "Mockley", "Dummy"];

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
/** Minutes Dublin is ahead of UTC on a date, so start times land on the local clock. */
const dublin = (d: Date) => (new Date(d.toLocaleString("en-US", { timeZone: "Europe/Dublin" })).getTime() - new Date(d.toLocaleString("en-US", { timeZone: "UTC" })).getTime()) / 60_000;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

type Teacher = { id: string; name: string; /** chance a swimmer misses a lesson */ absence: number; /** chance a swimmer leaves each week */ leave: number; /** minutes late, at worst */ late: number; /** weeks to pass a level, on average */ pace: number };

export async function seedSwimHistory(db: PrismaClient, instructorRoleId: string) {
  const random = rng(20261016);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(random() * list.length)];
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const start = addDays(today, -400);

  const teachers: Teacher[] = [
    { id: "sbx_ava", name: "Ava Example", absence: 0.1, leave: 0.008, late: 3, pace: 16 },
    { id: "sbx_ben", name: "Ben Example", absence: 0.12, leave: 0.01, late: 4, pace: 18 },
    { id: "sbx_chloe", name: "Chloe Example", absence: 0.09, leave: 0.007, late: 2, pace: 14 },
    { id: "sbx_darragh", name: "Darragh Example", absence: 0.24, leave: 0.026, late: 14, pace: 26 },
    { id: "sbx_erin", name: "Erin Example", absence: 0.13, leave: 0.012, late: 5, pace: 20 },
  ];
  for (const t of teachers.slice(1)) {
    await db.user.create({ data: {
      id: t.id, name: t.name, email: `${t.id.slice(4)}@sandbox.invalid`, staffRoleId: instructorRoleId, orgId: "org_leisureworld",
      jobTitle: "Swim teacher", primaryClubId: "club_churchfield", siteIds: ["club_churchfield"], startedOn: new Date("2024-09-02T00:00:00Z"),
    } });
  }

  // Five levels in the Learn to swim programme: Starfish, Otters, Seals, Dolphins, Sharks.
  const programme = await db.programme.findFirstOrThrow({ where: { clubId: "club_churchfield", name: "Learn to swim" } });
  const existing = await db.level.findMany({ where: { programmeId: programme.id } });
  const level = async (name: string, sortOrder: number, skills: string[]) => {
    const found = existing.find(l => l.name === name) ?? await db.level.create({ data: { programmeId: programme.id, name, sortOrder } });
    if (!found.sortOrder && sortOrder) await db.level.update({ where: { id: found.id }, data: { sortOrder } });
    const have = await db.competency.findMany({ where: { levelId: found.id }, orderBy: { sortOrder: "asc" } });
    const extra = await Promise.all(skills.slice(have.length).map((name, i) => db.competency.create({ data: { levelId: found.id, name, sortOrder: have.length + i } })));
    return { id: found.id, name, skills: [...have, ...extra].map(s => s.id) };
  };
  const levels = [
    await level("Starfish", 0, ["Enter the water safely", "Blow bubbles", "Walk across the shallow end", "Float with support"]),
    await level("Otters", 1, ["Submerge and blow bubbles", "Float on the back for five seconds", "Push and glide on the front", "Kick on the front with a float", "Retrieve an object from the step"]),
    await level("Seals", 2, ["Swim 10 metres front crawl", "Swim 10 metres back crawl", "Tread water for 30 seconds", "Push and glide on the back"]),
    await level("Dolphins", 3, ["Swim 25 metres front crawl", "Swim 25 metres back crawl", "Breaststroke kick", "Surface dive", "Treading water for one minute"]),
    await level("Sharks", 4, ["Swim 50 metres in two strokes", "Tumble turn", "Sculling head first", "Deep water treading for two minutes"]),
  ];

  // Eighteen weekly classes: weekday afternoons and Saturday mornings.
  const plan: [number, number, number, number, number][] = [ // [day 1-6, start minutes, level index, teacher index, capacity]
    [1, 960, 0, 0, 6], [1, 990, 1, 0, 6], [1, 1020, 2, 1, 8],
    [2, 960, 1, 3, 6], [2, 990, 2, 3, 8], [2, 1020, 3, 3, 8],
    [3, 960, 0, 2, 6], [3, 990, 1, 2, 6], [3, 1020, 3, 4, 8],
    [4, 960, 1, 1, 6], [4, 990, 2, 4, 8], [4, 1050, 4, 4, 10],
    [5, 960, 0, 1, 6], [5, 990, 2, 2, 8],
    [6, 540, 0, 0, 6], [6, 570, 1, 2, 6], [6, 600, 2, 1, 8], [6, 630, 3, 3, 8],
  ];
  const courses: (Awaited<ReturnType<typeof db.course.create>> & { li: number; teacher: (typeof teachers)[number] })[] = [];
  for (const [day, startMinutes, li, ti, capacity] of plan) {
    courses.push({ ...await db.course.create({ data: {
      clubId: "club_churchfield", levelId: levels[li].id, dayOfWeek: DAYS[day], startMinutes, durationMinutes: 30, capacity,
      location: li < 2 ? "Learner pool" : "Main pool", instructorId: teachers[ti].id, createdAt: addDays(start, -14),
    } }), li, teacher: teachers[ti] });
  }

  type Place = { id: string; studentId: string; courseIndex: number; startedOn: Date; endedOn: Date | null; status: string; leaveReason: string | null };
  type Swimmer = { id: string; levelIndex: number; atLevelSince: Date; place: Place | null; skills: number; hasLeft: boolean; passed: boolean };
  const swimmers: Swimmer[] = [];
  const places: Place[] = [];
  const attendance: { courseId: string; studentId: string; date: Date; status: "PRESENT" | "LATE" | "ABSENT"; markedById: string; markedByName: string; markedAt: Date }[] = [];
  const covers: { courseId: string; date: Date; coverById: string; coverByName: string; instructorId: string; instructorName: string; createdAt: Date }[] = [];
  const results = new Map<string, { studentId: string; competencyId: string; status: "ACHIEVED"; assessedInCourseId: string; assessedById: string; assessedByName: string; assessedOn: Date }>();
  const completions: { studentId: string; levelId: string; programmeId: string; completedOn: Date; competenciesAchieved: number; competencyCount: number; confirmedById: string; confirmedByName: string }[] = [];
  const cancellations: { courseId: string; date: Date; reason: string }[] = [];
  let counter = 0;
  const reasons = ["moving", "timing", "cost", "progress", "teaching", "enjoyment", "health", "other-activity", "stopping", "unknown"];

  const newSwimmer = async (levelIndex: number, joined: Date) => {
    counter++;
    const age = 3 + levelIndex * 2 + Math.floor(random() * 3);
    const dob = new Date(Date.UTC(today.getUTCFullYear() - age, Math.floor(random() * 12), 1 + Math.floor(random() * 27)));
    const student = await db.student.create({ data: {
      clubId: "club_churchfield", firstName: FIRST[counter % FIRST.length], lastName: `${LAST[Math.floor(counter / FIRST.length) % LAST.length]}`,
      memberNumber: `SBX-${String(2000 + counter)}`, dateOfBirth: dob, joinedOn: joined,
    } });
    const swimmer: Swimmer = { id: student.id, levelIndex, atLevelSince: joined, place: null, skills: 0, hasLeft: false, passed: false };
    swimmers.push(swimmer);
    return swimmer;
  };
  const occupied = (ci: number) => places.filter(p => p.courseIndex === ci && p.endedOn === null && p.status === "ACTIVE").length;
  const placeIn = (s: Swimmer, ci: number, on: Date) => {
    const place: Place = { id: `sbx_place_${places.length}`, studentId: s.id, courseIndex: ci, startedOn: on, endedOn: null, status: "ACTIVE", leaveReason: null };
    places.push(place); s.place = place; return place;
  };

  // Week by week from a year ago: fill classes, run lessons, move up, leave.
  for (let week = 0; addDays(start, week * 7) < today; week++) {
    const monday = addDays(start, week * 7 - ((start.getUTCDay() + 6) % 7));
    // New swimmers join Starfish and Otters, more in September and January.
    const month = monday.getUTCMonth();
    const joiners = week === 0 ? 0 : Math.round((month === 8 || month === 0 ? 4 : 1.6) * random() + (month === 6 || month === 7 ? 0 : 0.6));
    if (week === 0) {
      for (const [ci, c] of courses.entries()) {
        const fill = Math.max(2, c.capacity! - Math.floor(random() * 3));
        for (let i = 0; i < fill; i++) {
          const s = await newSwimmer(c.li, addDays(monday, -Math.floor(random() * 300)));
          s.atLevelSince = addDays(monday, -Math.floor(random() * 20) * 7);
          placeIn(s, ci, s.atLevelSince);
        }
      }
    }
    for (let j = 0; j < joiners; j++) {
      const li = random() < 0.7 ? 0 : 1;
      const options = courses.map((c, ci) => ({ c, ci })).filter(o => o.c.li === li && occupied(o.ci) < o.c.capacity!);
      if (!options.length) continue;
      const { ci } = pick(options);
      const s = await newSwimmer(li, monday);
      placeIn(s, ci, addDays(monday, 0));
    }
    for (const [ci, c] of courses.entries()) {
      const date = addDays(monday, (DAYS.indexOf(c.dayOfWeek as typeof DAYS[number]) + 6) % 7);
      if (date >= today || date < start) continue;
      const roster = places.filter(p => p.courseIndex === ci && p.status === "ACTIVE" && p.startedOn <= date && (p.endedOn === null || p.endedOn > date));
      if (random() < 0.012) { cancellations.push({ courseId: c.id, date, reason: pick(["Pool closed: water quality", "No teacher available", "Pool closed: fouling"]) }); continue; }
      // Who teaches: the class's teacher, or cover now and then; a few never started.
      const teacher = random() < 0.08 ? pick(teachers.filter(t => t !== c.teacher)) : c.teacher;
      const started = random() > (c.teacher.id === "sbx_darragh" ? 0.04 : 0.008);
      if (started) {
        const late = random() < (teacher.late > 10 ? 0.35 : 0.06) ? 6 + Math.floor(random() * teacher.late) : Math.floor(random() * 4) - 2;
        covers.push({ courseId: c.id, date, coverById: teacher.id, coverByName: teacher.name, instructorId: c.teacher.id, instructorName: c.teacher.name, createdAt: new Date(date.getTime() + (c.startMinutes + late - dublin(date)) * 60_000) });
      }
      const skipRegister = !started || random() < (teacher.id === "sbx_darragh" ? 0.1 : 0.02);
      for (const p of roster) {
        const s = swimmers.find(x => x.id === p.studentId)!;
        const r = random();
        const status = r < teacher.absence ? "ABSENT" : r < teacher.absence + 0.05 ? "LATE" : "PRESENT";
        if (!skipRegister || random() < 0.4) attendance.push({ courseId: c.id, studentId: s.id, date, status, markedById: teacher.id, markedByName: teacher.name, markedAt: new Date(date.getTime() + (c.startMinutes + 25 - dublin(date)) * 60_000) });
        // Skills: a tick now and then, faster with a quicker teacher.
        const skills = levels[c.li].skills;
        if (status !== "ABSENT" && s.skills < skills.length && random() < skills.length / teacher.pace) {
          results.set(`${s.id}:${skills[s.skills]}`, { studentId: s.id, competencyId: skills[s.skills], status: "ACHIEVED", assessedInCourseId: c.id, assessedById: teacher.id, assessedByName: teacher.name, assessedOn: date });
          s.skills++;
        }
      }
    }
    // End of the week: pass a level and move up, or leave.
    const sunday = addDays(monday, 6);
    for (const s of swimmers) {
      const p = s.place;
      if (!p || p.endedOn || s.hasLeft) continue;
      const c = courses[p.courseIndex];
      if (sunday >= today) break;
      if (random() < c.teacher.leave * (s.levelIndex === 0 ? 1.4 : 1)) {
        const reason = c.teacher.id === "sbx_darragh" && random() < 0.4 ? "teaching" : pick(reasons);
        p.endedOn = addDays(sunday, 1); p.status = "WITHDRAWN"; p.leaveReason = reason; s.hasLeft = true; s.place = null;
        continue;
      }
      if (s.skills >= levels[s.levelIndex].skills.length && s.levelIndex < levels.length - 1) {
        const next = courses.map((x, ci) => ({ x, ci })).filter(o => o.x.li === s.levelIndex + 1 && occupied(o.ci) < o.x.capacity!);
        if (!s.passed) completions.push({ studentId: s.id, levelId: levels[s.levelIndex].id, programmeId: programme.id, completedOn: sunday, competenciesAchieved: s.skills, competencyCount: s.skills, confirmedById: c.teacher.id, confirmedByName: c.teacher.name });
        s.passed = true;
        if (!next.length) continue;
        const target = pick(next);
        p.endedOn = addDays(sunday, 1); p.status = "TRANSFERRED";
        s.levelIndex++; s.skills = 0; s.passed = false; s.atLevelSince = addDays(sunday, 1);
        placeIn(s, target.ci, addDays(sunday, 1));
      }
    }
  }

  // A few last lessons booked, and waiting lists on the busiest classes.
  const active = places.filter(p => p.endedOn === null);
  for (const p of active.slice(0, 4)) { p.endedOn = addDays(today, 7 + (p.courseIndex % 3) * 7); p.leaveReason = pick(reasons); }
  const waiting: { studentId: string; courseIndex: number; since: Date }[] = [];
  for (const [ci, c] of courses.entries()) {
    if (occupied(ci) < c.capacity! || random() < 0.4) continue;
    for (let i = 0; i < 1 + Math.floor(random() * 3); i++) waiting.push({ studentId: (await newSwimmer(c.li, today)).id, courseIndex: ci, since: addDays(today, -Math.floor(random() * 60)) });
  }

  const chunk = async <T,>(rows: T[], write: (batch: T[]) => Promise<unknown>) => { for (let i = 0; i < rows.length; i += 500) await write(rows.slice(i, i + 500)); };
  await chunk(places, batch => db.enrolment.createMany({ data: batch.map(p => {
    const c = courses[p.courseIndex];
    const scheduled = p.endedOn && p.endedOn > today;
    return {
      id: p.id, studentId: p.studentId, courseId: c.id, levelId: levels[c.li].id, programmeId: programme.id,
      status: (p.status === "ACTIVE" ? "ACTIVE" : p.status) as "ACTIVE" | "WITHDRAWN" | "TRANSFERRED", startedOn: p.startedOn,
      endedOn: scheduled ? null : p.endedOn, scheduledEndOn: scheduled ? p.endedOn : null, leaveReason: p.leaveReason, legendAgreementStatus: "DONE" as const,
    };
  }) }));
  await chunk(waiting, batch => db.enrolment.createMany({ data: batch.map(w => ({
    studentId: w.studentId, courseId: courses[w.courseIndex].id, levelId: levels[courses[w.courseIndex].li].id, programmeId: programme.id, status: "WAITLISTED" as const, startedOn: w.since,
  })) }));
  await chunk(attendance, batch => db.attendanceRecord.createMany({ data: batch }));
  await chunk(covers, batch => db.classCover.createMany({ data: batch }));
  await chunk([...results.values()], batch => db.competencyResult.createMany({ data: batch }));
  await chunk(completions, batch => db.levelCompletion.createMany({ data: batch, skipDuplicates: true }));
  for (const x of cancellations) {
    const c = courses.find(k => k.id === x.courseId)!;
    await db.classCancellation.create({ data: {
      courseId: c.id, clubId: "club_churchfield", date: x.date, className: levels[c.li].name, levelName: levels[c.li].name, programmeName: programme.name,
      startMinutes: c.startMinutes, durationMinutes: 30, location: c.location, instructorName: c.teacher.name, reason: x.reason,
      cancelledById: "sbx_liam", cancelledByName: "Liam Example", billingNotifiedAt: new Date(), billingNotifiedById: "sbx_liam", billingNotifiedByName: "Liam Example",
    } });
  }
  // Assessments of new swimmers, most of whom then booked a class.
  const type = await db.assessmentType.findFirst({ where: { programmeId: programme.id } });
  for (let w = 1; w < 50; w += 3) {
    const date = addDays(today, -w * 7 - 2);
    const session = await db.assessmentSession.create({ data: { clubId: "club_churchfield", date, startMinutes: 600, durationMinutes: 45, location: "Learner pool", capacity: 8, instructorId: "sbx_chloe", programmeId: programme.id, typeId: type?.id } });
    const joinedSoon = swimmers.filter(s => places.some(p => p.studentId === s.id && iso(p.startedOn) > iso(date) && iso(p.startedOn) <= iso(addDays(date, 21)))).slice(0, 4);
    const walkIns = [await newSwimmer(0, date)];
    for (const s of [...joinedSoon, ...walkIns]) {
      const noShow = random() < 0.12;
      await db.assessmentBooking.create({ data: {
        sessionId: session.id, studentId: s.id, status: noShow ? "NO_SHOW" : "ATTENDED", bookedByName: "Noah Example",
        ...(noShow ? {} : { outcomeLevelId: levels[0].id, assessedById: "sbx_chloe", assessedByName: "Chloe Example", assessedOn: date }),
      } });
    }
  }
  console.log(`[sandbox] Swim school history: ${swimmers.length} swimmers, ${places.length} places, ${attendance.length} marks, ${covers.length} lesson starts.`);
}
