import { severities, type IncidentCategory, type Severity } from "@/modules/incidents/shared/types";

/** Triage fitted to what the report is about (owner request, 19 October 2026:
 *  the injury scale and HSA questions only made sense for accidents). Each
 *  category has a guide: what each level means for that kind of report, and
 *  the few things worth recording at triage, such as the Garda incident number
 *  for a theft. The 1 to 5 levels, and what they decide (closing at triage,
 *  sign-off from 3 up), are the same for every kind. Pure data, so the form,
 *  the report and the full record read the same words. */

export type TriageCheck = {
  key: string;
  label: string;
  hint?: string;
  /** Shown only when another check has this answer (true for a tick). */
  when?: { key: string; is: true | string };
} & ({ type: "tick" } | { type: "text"; placeholder?: string } | { type: "choice"; options: Record<string, string> });

export type TriageGuide = {
  label: string;
  /** One line above the ratings: what to weigh for this kind of report. */
  intro: string;
  /** What each level means for this kind of report. */
  scale: Record<Severity, string>;
  checks: readonly TriageCheck[];
  /** Could be a dangerous occurrence under Schedule 15 (a release, a fire, a
   *  structural or electrical failure), so that HSA question is shown. */
  dangerous: boolean;
};

const injuryScale = Object.fromEntries(Object.entries(severities).map(([n, s]) => [n, s.help])) as Record<Severity, string>;

const gardai: readonly TriageCheck[] = [
  { key: "gardaiTold", type: "tick", label: "The Gardaí were told" },
  { key: "gardaiRef", type: "text", label: "Garda incident number", hint: "Or the station and the name of the Garda, if no number was given.", when: { key: "gardaiTold", is: true } },
];
const cctv: TriageCheck = { key: "cctvKept", type: "tick", label: "CCTV saved", hint: "Saved before it records over, for the Gardaí or the insurer." };

/** Asked on every report that names a staff member, or behaviour aimed at one. */
export const staffSupportCheck: TriageCheck = {
  key: "staffSupport", type: "text", label: "Support offered to the staff member",
  hint: "A word after it, time out, or the employee assistance programme. Say who offered it and when.",
};

const guides = {
  injury: {
    label: "Injury or illness",
    intro: "Rate the harm to the person, and the worst injury it realistically could have caused.",
    scale: injuryScale,
    checks: [],
    dangerous: false,
  },
  water: {
    label: "Pool water",
    intro: "Rate how long the pool was out and who was exposed, and the worst it realistically could have led to.",
    scale: {
      1: "Cleared in minutes; the pool stayed open.",
      2: "The pool, or part of it, closed for under an hour.",
      3: "Closed for hours, or swimmers had to be told they were exposed.",
      4: "Closed for a day or more, or people became ill.",
      5: "An outbreak: many people ill.",
    },
    checks: [
      { key: "contaminant", type: "choice", label: "What was in the water", options: { solid: "Solid faeces", loose: "Loose faeces or diarrhoea", vomit: "Vomit", blood: "Blood", other: "Something else" } },
      { key: "poolClosed", type: "tick", label: "The pool was closed" },
      { key: "closedFor", type: "text", label: "How long it was closed", placeholder: "For example: 14:10 to 15:05", when: { key: "poolClosed", is: true } },
      { key: "waterTested", type: "tick", label: "Water tested and in range before reopening" },
    ],
    dangerous: false,
  },
  chemical: {
    label: "Chemicals",
    intro: "Rate the exposure and the release, and the worst it realistically could have been.",
    scale: {
      1: "A small spill, cleaned up, nobody near it.",
      2: "Contained; the area cleared for a short time.",
      3: "Someone was exposed, or part of the building was cleared.",
      4: "An uncontrolled release, or someone needed treatment.",
      5: "A major release: emergency services and a full evacuation.",
    },
    checks: [
      { key: "chemical", type: "text", label: "Which chemical", placeholder: "For example: sodium hypochlorite" },
      { key: "evacuated", type: "tick", label: "People were moved away or the building was evacuated" },
      { key: "emergencyServices", type: "tick", label: "The fire brigade or an ambulance came" },
      { key: "plantChecked", type: "text", label: "Plant or dosing checked by", hint: "The engineer or contractor, and when." },
    ],
    dangerous: true,
  },
  theft: {
    label: "Theft, loss or damage",
    intro: "Rate the loss and how it happened, and the worst it realistically could have been.",
    scale: {
      1: "Nothing taken or damaged, or something of little value.",
      2: "A small loss or damage, easily replaced.",
      3: "A break-in, or cash, keys, cards or valuables taken.",
      4: "A large loss, or threats while it happened.",
      5: "A robbery with violence or a weapon.",
    },
    checks: [
      { key: "whose", type: "choice", label: "Whose property", options: { customer: "A customer's", staff: "A staff member's", centre: "The centre's", none: "Nothing was taken" } },
      { key: "value", type: "text", label: "Roughly what it was worth", placeholder: "For example: phone and wallet, about €600" },
      ...gardai,
      cctv,
      { key: "insurerTold", type: "tick", label: "The centre's insurer was told", when: { key: "whose", is: "centre" } },
    ],
    dangerous: false,
  },
  behaviour: {
    label: "Behaviour",
    intro: "Rate how threatening it was and who it affected, and the worst it realistically could have become.",
    scale: {
      1: "Rude or unsafe, settled with a word.",
      2: "Abuse or unsafe behaviour that went on; asked to stop or leave.",
      3: "Threats, or someone frightened; asked to leave.",
      4: "A physical assault, or a weapon shown.",
      5: "A serious assault.",
    },
    checks: [
      { key: "aimedAt", type: "choice", label: "Who it was aimed at", options: { staff: "A staff member", customer: "A customer", nobody: "Nobody in particular" } },
      { key: "outcome", type: "choice", label: "What happened to the person", options: { none: "Nothing more", warned: "Warned", left: "Asked to leave", barred: "Barred" } },
      ...gardai,
      cctv,
    ],
    dangerous: false,
  },
  missing: {
    label: "Missing child",
    intro: "Rate how long they were missing and where they were found, and the worst it realistically could have been. A child protection concern goes to the Designated Liaison Person, not this report.",
    scale: {
      1: "Found within minutes, still in sight of staff.",
      2: "Found on site after a short search.",
      3: "The missing child procedure was used, or the search took a while.",
      4: "The Gardaí were called, or the child was found off site.",
      5: "Not found, or came to harm.",
    },
    checks: [
      { key: "missingFor", type: "text", label: "How long they were missing", placeholder: "For example: about 8 minutes" },
      { key: "foundWhere", type: "text", label: "Where they were found" },
      { key: "procedureUsed", type: "tick", label: "The missing child procedure was used" },
      ...gardai,
    ],
    dangerous: false,
  },
  building: {
    label: "Equipment or building",
    intro: "Rate the fault and who was at risk, and the worst it realistically could have caused.",
    scale: {
      1: "Fixed at once; nobody was at risk.",
      2: "Taken out of use until fixed; little risk.",
      3: "An area or the pool closed, or it could have hurt someone.",
      4: "A structural, electrical or gas failure.",
      5: "A collapse, or a failure that could kill.",
    },
    checks: [
      { key: "outOfUse", type: "tick", label: "Taken out of use or fenced off" },
      { key: "repairBy", type: "text", label: "Repair logged with", hint: "Maintenance or the contractor, and any job number." },
    ],
    dangerous: true,
  },
  fire: {
    label: "Fire, alarm or evacuation",
    intro: "Rate what happened and how the evacuation went, and the worst it realistically could have been.",
    scale: {
      1: "A false alarm; nobody had to leave.",
      2: "An evacuation, with everyone back in within half an hour.",
      3: "A small fire put out on site, or a long evacuation.",
      4: "The fire brigade put out a fire, or someone was hurt.",
      5: "A major fire.",
    },
    checks: [
      { key: "cause", type: "choice", label: "What set it off", options: { false_alarm: "A false alarm", fire: "A real fire", other: "Something else, such as a gas smell" } },
      { key: "evacuated", type: "tick", label: "The building was evacuated" },
      { key: "evacuationTime", type: "text", label: "How long until everyone was out and accounted for", placeholder: "For example: 4 minutes", when: { key: "evacuated", is: true } },
      { key: "fireBrigade", type: "tick", label: "The fire brigade came" },
    ],
    dangerous: true,
  },
  staff: {
    label: "Staff conduct or welfare",
    intro: "Rate what happened on shift and the risk it put people at, and the worst it realistically could have led to. Discipline and grievances themselves go through HR, not this report.",
    scale: {
      1: "A small slip, sorted with a word.",
      2: "Needs a conversation with their manager.",
      3: "A procedure not followed that put someone at risk, or a staff member unable to finish their shift.",
      4: "Serious misconduct, or a staff member's health or safety at serious risk.",
      5: "Gross misconduct, or lasting harm to someone.",
    },
    checks: [
      { key: "matter", type: "choice", label: "What it was about", options: { conduct: "Conduct or a procedure not followed", welfare: "A staff member's health or welfare", conflict: "A dispute between staff", other: "Something else" } },
      { key: "managerTold", type: "tick", label: "Their manager was told" },
      { key: "hrTold", type: "tick", label: "Passed to HR", hint: "For anything that may lead to discipline, a grievance or time off." },
      staffSupportCheck,
    ],
    dangerous: false,
  },
  other: {
    label: "Something else",
    intro: "Rate what happened and the worst it realistically could have led to.",
    scale: {
      1: "No harm and no lasting effect.",
      2: "A small effect, sorted the same day.",
      3: "Real disruption, or someone could have been hurt.",
      4: "Serious harm or loss.",
      5: "Severe or lasting harm.",
    },
    checks: [],
    dangerous: true,
  },
} satisfies Record<string, TriageGuide>;
export type TriageGuideKey = keyof typeof guides;

/** Which guide each category triages with. */
const guideOf: Record<IncidentCategory, TriageGuideKey> = {
  slip_trip_fall: "injury", struck: "injury", water_rescue: "injury", illness: "injury",
  contamination: "water", chemical: "chemical", equipment: "building", behaviour: "behaviour",
  lost_child: "missing", security: "theft", fire: "fire", staff: "staff", other: "other",
};
export const injuryGuide: TriageGuide = guides.injury;
export const triageGuide = (category: string): TriageGuide => guides[guideOf[category as IncidentCategory] ?? "other"];


/** What a report brings to its triage. */
export type TriageContext = { category: string; hasStaff: boolean };

export type TriageAnswers = Record<string, boolean | string>;

const shows = (check: TriageCheck, answers: TriageAnswers) => !check.when || answers[check.when.key] === check.when.is;

/** The checks to ask for this report, given the answers so far. */
export function triageChecks(context: TriageContext, answers: TriageAnswers): TriageCheck[] {
  const guide = triageGuide(context.category);
  const list = guide.checks.filter((c) => shows(c, answers));
  if ((context.hasStaff || answers.aimedAt === "staff") && !list.includes(staffSupportCheck)) list.push(staffSupportCheck);
  return list;
}

/** Keeps only the answers this report asks for, in the right shape: a tick is
 *  yes or no, a choice one of its options, text trimmed and short. */
export function cleanTriageAnswers(context: TriageContext, input: TriageAnswers): TriageAnswers {
  const out: TriageAnswers = {};
  for (const check of new Set([...triageGuide(context.category).checks, staffSupportCheck])) {
    const value = input[check.key];
    if (check.type === "tick") out[check.key] = value === true;
    else if (check.type === "choice") { if (typeof value === "string" && value in check.options) out[check.key] = value; }
    else if (typeof value === "string" && value.trim()) out[check.key] = value.trim().slice(0, 300);
  }
  const asked = new Set(triageChecks(context, out).map((c) => c.key));
  return Object.fromEntries(Object.entries(out).filter(([key]) => asked.has(key)));
}

/** The answers as label and text, in the guide's order, for the report and the full record. */
export function triageAnswerRows(context: TriageContext, stored: unknown): [string, string][] {
  const answers = (stored && typeof stored === "object" ? stored : {}) as TriageAnswers;
  return triageChecks(context, answers).filter((c) => c.key in answers).map((c) => {
    const value = answers[c.key];
    const text = c.type === "tick" ? (value ? "Yes" : "No") : c.type === "choice" ? c.options[value as string] ?? String(value) : String(value);
    return [c.label, text];
  });
}
