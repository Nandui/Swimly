import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import { formatDate, formatDateTime } from "@/lib/format";
import type { IncidentExport } from "@/modules/incidents/features/export/server/data";
import { triageAnswerRows } from "@/modules/incidents/shared/triage-guides";
import { actionStatuses, ageGroups, incidentActions, incidentCategories, incidentKinds, incidentNumber, incidentStatuses, levelOf, personTypes, severities,
  type AgeGroup, type IncidentCategory, type IncidentKind, type IncidentStatus, type PersonType, type Severity } from "@/modules/incidents/shared/types";

/** The full record as a PDF file: an A4 document with a title block, numbered sections,
 *  tables and a footer on every page, for the insurer or a solicitor. It draws only what
 *  `incidentExport` returned, so who may have it is decided there.
 *
 *  A PDF cannot read the theme, so it is drawn in black and greys (named colours) in
 *  Manrope, the app's type family, from assets/pdf. Keep next.config.ts's output tracing
 *  for assets/pdf when moving the fonts. */

const TEXT = "body", BOLD = "bold";
const INK = "black", MUTED = "dimgray", RULE = "silver", TINT = "whitesmoke";
/** Points. A4 is 595 by 842. */
const SIDE = 48, TOP = 64, BOTTOM = 64, PAD = 6;

let fonts: Promise<[Buffer, Buffer]> | undefined;
const loadFonts = () => (fonts ??= Promise.all([
  readFile(join(process.cwd(), "assets/pdf/Manrope_500Medium.ttf")),
  readFile(join(process.cwd(), "assets/pdf/Manrope_800ExtraBold.ttf")),
]));

const day = (iso: string) => formatDate(new Date(`${iso}T12:00:00Z`));
const rated = (n: number | null) => (n ? `${n} ${severities[n as Severity].label}` : "Not rated");
const or = (value: string | null | undefined, empty = "None recorded") => value?.trim() || empty;
const yesNo = (value: boolean) => (value ? "Yes" : "No");

/** Ligatures off, so "fi" and "ff" stay separate letters that can be searched and copied;
 *  figures all one width, so numbers line up. */
const FEATURES = { liga: false, tnum: true } as unknown as PDFKit.Mixins.OpenTypeFeatures[];
type Pen = PDFKit.PDFDocument;
type TextOptions = PDFKit.Mixins.TextOptions;
const put = (pen: Pen, text: string, x: number, y: number, options: TextOptions = {}) => pen.text(text, x, y, { ...options, features: FEATURES });
const tall = (pen: Pen, text: string, options: TextOptions = {}) => pen.heightOfString(text, { ...options, features: FEATURES });

type Fact = [label: string, value: string];
type Column = { title: string; share: number };

export async function incidentPdf(data: IncidentExport): Promise<Buffer> {
  const [medium, extraBold] = await loadFonts();
  const { report: r } = data;
  const number = incidentNumber(r.number);
  const kind = `${incidentKinds[r.kind as IncidentKind]?.label ?? r.kind}: ${incidentCategories[r.category as IncidentCategory]?.label ?? r.category}`;

  const doc = new PDFDocument({
    size: "A4", bufferPages: true, font: "",
    margins: { top: TOP, bottom: BOTTOM, left: SIDE, right: SIDE },
    info: { Title: `${number} incident report`, Author: r.site.name, Subject: kind, Creator: "Turnfin" },
  });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  doc.registerFont(TEXT, medium);
  doc.registerFont(BOLD, extraBold);

  const width = doc.page.width - SIDE * 2;
  const bottom = () => doc.page.height - BOTTOM;
  const body = () => doc.font(TEXT).fontSize(9.5).fillColor(INK);
  const small = () => doc.font(TEXT).fontSize(8).fillColor(MUTED);
  const caption = () => doc.font(BOLD).fontSize(7).fillColor(MUTED);
  /** Starts a new page when the next block would not fit on this one. */
  const room = (height: number) => { if (doc.y + height > bottom()) doc.addPage(); };
  const gap = (points: number) => { doc.y += points; };
  const line = (y: number, weight = 0.5, colour = RULE) => doc.moveTo(SIDE, y).lineTo(SIDE + width, y).lineWidth(weight).strokeColor(colour).stroke();

  let sections = 0;
  /** `keep` is the room the heading and the start of the section need to stay on one page. */
  function section(title: string, keep = 90) {
    room(keep);
    gap(sections ? 20 : 0);
    sections += 1;
    put(doc.font(BOLD).fontSize(12).fillColor(INK), `${sections}. ${title}`, SIDE, doc.y, { width });
    gap(4);
    line(doc.y, 1, INK);
    gap(10);
  }
  /** `keep` is the room the heading and what follows it need to stay on one page. */
  function heading(text: string, keep = 50) {
    room(keep);
    put(doc.font(BOLD).fontSize(9.5).fillColor(INK), text, SIDE, doc.y, { width });
    gap(4);
  }
  /** A label over running text that may flow on to the next page. */
  function passage(label: string, text: string) {
    room(44);
    put(caption(), label.toUpperCase(), SIDE, doc.y, { width, characterSpacing: 0.5 });
    gap(3);
    put(body(), or(text), SIDE, doc.y, { width, lineGap: 2.5 });
    gap(10);
  }
  function note(text: string) {
    room(24);
    put(small(), text, SIDE, doc.y, { width, lineGap: 1.5 });
    gap(8);
  }

  /** Short facts in boxes, each a label over its value, so many to a row. */
  function facts(rows: Fact[], perRow = 2) {
    const cell = width / perRow, inner = cell - PAD * 2;
    const lines: { row: Fact[]; height: number }[] = [];
    for (let i = 0; i < rows.length; i += perRow) {
      const row = rows.slice(i, i + perRow);
      const heights = row.map(([label, value]) =>
        tall(caption(), label.toUpperCase(), { width: inner, characterSpacing: 0.5 }) + 3 + tall(body(), or(value), { width: inner, lineGap: 1.5 }));
      lines.push({ row, height: Math.max(...heights) + PAD * 2 });
    }
    // The whole block moves to the next page together when it would otherwise be split.
    const all = lines.reduce((sum, l) => sum + l.height, 0);
    if (all <= bottom() - TOP) room(all);
    for (const { row, height } of lines) {
      room(height);
      const y = doc.y;
      row.forEach(([label, value], at) => {
        const x = SIDE + cell * at;
        // The last box of a short row runs to the edge, so the grid stays square.
        const boxWidth = at === row.length - 1 ? width - cell * at : cell;
        doc.rect(x, y, boxWidth, height).lineWidth(0.5).strokeColor(RULE).stroke();
        put(caption(), label.toUpperCase(), x + PAD, y + PAD, { width: inner, characterSpacing: 0.5 });
        put(body(), or(value), x + PAD, doc.y + 3, { width: inner, lineGap: 1.5 });
      });
      doc.y = y + height;
    }
    gap(10);
  }

  /** A ruled table whose heading row repeats when it runs on to another page. */
  function table(columns: Column[], rows: string[][], empty: string) {
    if (rows.length === 0) { put(body(), empty, SIDE, doc.y, { width }); gap(10); return; }
    const total = columns.reduce((sum, c) => sum + c.share, 0);
    const widths = columns.map((c) => (width * c.share) / total);
    const left = widths.map((_, i) => SIDE + widths.slice(0, i).reduce((sum, w) => sum + w, 0));
    const head = () => {
      const height = Math.max(...columns.map((c, i) => tall(caption(), c.title.toUpperCase(), { width: widths[i] - PAD * 2, characterSpacing: 0.5 }))) + PAD * 2;
      const y = doc.y;
      doc.rect(SIDE, y, width, height).fill(TINT);
      columns.forEach((c, i) => put(caption().fillColor(INK), c.title.toUpperCase(), left[i] + PAD, y + PAD, { width: widths[i] - PAD * 2, characterSpacing: 0.5 }));
      doc.y = y + height;
      line(doc.y, 0.75, INK);
    };
    room(60);
    head();
    for (const row of rows) {
      const height = Math.max(...row.map((text, i) => tall(body().fontSize(9), or(text, ""), { width: widths[i] - PAD * 2, lineGap: 1.5 }))) + PAD * 2;
      if (doc.y + height > bottom()) { doc.addPage(); head(); }
      const y = doc.y;
      row.forEach((text, i) => put(body().fontSize(9), or(text, ""), left[i] + PAD, y + PAD, { width: widths[i] - PAD * 2, lineGap: 1.5 }));
      doc.y = y + height;
      line(doc.y);
    }
    gap(12);
  }

  // ── The title block.
  put(caption().fontSize(8), r.site.name.toUpperCase(), SIDE, TOP, { width, characterSpacing: 0.8 });
  gap(6);
  const titleY = doc.y;
  put(doc.font(BOLD).fontSize(24).fillColor(INK), "Incident report", SIDE, titleY, { width: width * 0.6 });
  const afterTitle = doc.y;
  put(doc.font(BOLD).fontSize(24).fillColor(INK), number, SIDE + width * 0.6, titleY, { width: width * 0.4, align: "right" });
  doc.y = afterTitle + 2;
  put(body().fontSize(11).fillColor(MUTED), kind, SIDE, doc.y, { width });
  gap(10);
  line(doc.y, 2, INK);
  gap(14);

  const level = r.severityActual && r.severityPotential ? levelOf(r.severityActual, r.severityPotential) : null;
  facts([
    ["Status", incidentStatuses[r.status as IncidentStatus]?.label ?? r.status],
    ["Handled at", r.triagedAt ? rated(level) : "Not triaged yet"],
    ["Serious", yesNo(r.serious)],
    ["Date of incident", day(r.occurredOn)],
    ["Time", r.occurredAt],
    ["Site", r.site.name],
    ["Area", or(r.area, "Not given")],
    ["Reported by", r.reporterName],
    ["Reported on", formatDateTime(r.createdAt)],
  ], 3);
  const confidential = `Confidential. This is the full record of ${number} as held in Turnfin on ${formatDateTime(data.exportedAt)}, produced by ${data.exportedBy}. It holds health information: share it only with the insurer or your adviser.`;
  const boxHeight = tall(small(), confidential, { width: width - PAD * 4, lineGap: 1.5 }) + PAD * 2;
  doc.rect(SIDE, doc.y, width, boxHeight).fill(TINT);
  put(small().fillColor(INK), confidential, SIDE + PAD * 2, doc.y + PAD, { width: width - PAD * 4, lineGap: 1.5 });
  gap(PAD + 6);

  // ── What happened.
  section("What happened");
  passage("Description", r.description);
  passage("What was done straight away", r.immediateAction);
  passage("First told by", or(r.raisedBy, "Seen by the reporter"));
  const addenda = r.events.filter((e) => e.action === "addendum");
  if (addenda.length) {
    heading("Added later");
    for (const e of addenda) passage(`${e.actorName}, ${formatDateTime(e.createdAt)}`, e.note);
  }

  // ── People.
  section("People involved", r.people.length ? 260 : 90);
  if (r.people.length === 0) { put(body(), "Nobody named.", SIDE, doc.y, { width }); gap(10); }
  r.people.forEach((p, i) => {
    heading(`Person ${i + 1}: ${or(p.name, "Not named")}`, 160);
    facts([
      ["Who they are", personTypes[p.type as PersonType] ?? p.type],
      ["Age group", ageGroups[p.ageGroup as AgeGroup] ?? p.ageGroup],
      ["Contact", p.contact],
      ["Injury", p.injured ? or(p.injury, "Hurt or ill, not described") : "Not hurt"],
      ["Part of the body", p.injured ? or(p.bodyPart, "Not given") : "Does not apply"],
      ["First aid", or(p.firstAid, "None given")],
      ["First aid by", or(p.firstAidBy, p.firstAid ? "Not given" : "Nobody")],
      ["Ambulance called", yesNo(p.ambulance)],
      ["Hospital or doctor", yesNo(p.hospital)],
    ], 3);
  });
  heading("Witnesses");
  table([{ title: "Name", share: 2 }, { title: "Contact", share: 3 }], r.witnesses.map((w) => [w.name, or(w.contact, "Not given")]), "No witnesses named.");

  // ── Triage.
  if (r.triagedAt) {
    section("Triage");
    facts([
      ["What happened", rated(r.severityActual)],
      ["What could have happened", rated(r.severityPotential)],
      ["Handled at", rated(level)],
    ], 3);
    facts([
      ["Health and Safety Authority", r.hsaReportable ? `Reportable${r.hsaFatal ? " (a death)" : ""}, due by ${r.hsaDueOn ? day(r.hsaDueOn) : "the deadline"}` : "Not reportable"],
      ["Authority reference", r.hsaReportable ? or(r.hsaReference, "Not recorded yet") : "Does not apply"],
      ["Parent or guardian told", or(r.parentInformed, "Not recorded")],
      ["Triaged by", `${or(r.triagedByName, "Not recorded")}, ${formatDateTime(r.triagedAt)}`],
      ...triageAnswerRows({ category: r.category, hasStaff: r.people.some((p) => p.type === "staff") }, r.triageAnswers),
    ]);
    passage("Triage note", r.triageNote);
  }

  // ── Investigation.
  if (r.statements.length || r.whys.length || r.rootCause || r.actions.length) {
    section("Investigation", 150);
    r.statements.forEach((s, i) => {
      heading(`Statement ${i + 1}: ${s.givenBy}${s.givenAs ? `, ${s.givenAs}` : ""}`, 100);
      passage(`Taken ${day(s.takenOn)}, recorded by ${s.recordedByName}`, s.text);
    });
    if (r.whys.length) {
      heading("Why it happened");
      r.whys.forEach((why, i) => {
        room(20);
        const y = doc.y;
        put(body(), `${i + 1}.`, SIDE, y, { width: 16 });
        put(body(), why, SIDE + 16, y, { width: width - 16, lineGap: 2.5 });
        gap(4);
      });
      gap(6);
    }
    if (r.rootCause) passage("Root cause", r.rootCause);
    if (r.actions.length) {
      heading("Actions");
      table(
        [{ title: "Action", share: 5 }, { title: "Owner", share: 2 }, { title: "Due", share: 2 }, { title: "Outcome", share: 3 }],
        r.actions.map((a) => [
          a.title, a.ownerName, day(a.dueOn),
          `${actionStatuses[a.status as "open" | "done" | "cancelled"]?.label ?? a.status}${a.doneAt ? ` ${formatDateTime(a.doneAt)}${a.doneByName ? ` by ${a.doneByName}` : ""}` : ""}${a.note ? `. ${a.note}` : ""}`,
        ]),
        "No actions.",
      );
    }
  }

  // ── Closing.
  if (r.closedAt) {
    section("Closed");
    facts([["Closed by", or(r.closedByName, "Not recorded")], ["Closed on", formatDateTime(r.closedAt)]]);
    passage("Closing note", r.closeNote);
  }

  // ── What is kept with the report.
  section("Photos, files and CCTV");
  heading("Photos and files");
  table([{ title: "File", share: 4 }, { title: "Added by", share: 2 }, { title: "Added on", share: 2 }], r.files.map((f) => [f.name, f.addedByName, formatDateTime(f.createdAt)]), "None.");
  if (r.footage.length) {
    heading("CCTV footage");
    table([{ title: "Video", share: 4 }, { title: "Sent by", share: 2 }, { title: "Received", share: 2 }], r.footage.map((f) => [f.name, f.uploadedBy, f.receivedAt ? formatDateTime(f.receivedAt) : ""]), "None.");
  }
  note("The files and videos themselves are kept with the report in Turnfin and are not part of this document. They can be sent from the report's page if the insurer asks for them.");

  // ── History.
  section("History of the record");
  table(
    [{ title: "When", share: 2 }, { title: "Who", share: 2 }, { title: "What", share: 3 }],
    r.events.map((e) => [formatDateTime(e.createdAt), e.actorName, incidentActions[e.action as keyof typeof incidentActions] ?? e.action]),
    "Nothing recorded.",
  );

  // ── Every page's footer, and a running head after the first. Drawn last, when the number
  // of pages is known; the margins are lifted so writing in them starts no new page.
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(pages.start + i);
    doc.page.margins.top = 0;
    doc.page.margins.bottom = 0;
    if (i > 0) {
      put(small(), `${number} incident report`, SIDE, 34, { width: width / 2, lineBreak: false });
      put(small(), r.site.name, SIDE + width / 2, 34, { width: width / 2, align: "right", lineBreak: false });
      line(48);
    }
    const y = doc.page.height - 44;
    line(y);
    put(small(), `${number} · Confidential: holds health information`, SIDE, y + 8, { width: width * 0.7, lineBreak: false });
    put(small(), `Page ${i + 1} of ${pages.count}`, SIDE + width * 0.7, y + 8, { width: width * 0.3, align: "right", lineBreak: false });
  }

  doc.end();
  return done;
}
