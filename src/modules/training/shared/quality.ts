import { docChecks, lessonMinutes, readingMinutes, type DocNode, type Outline } from "@/modules/training/shared/lessons";

/** The builder's quality check (e-learning phase 8): advice on making a course
 *  easier to take, worded for its author. Unlike publishProblems none of it
 *  stops publishing. Pure and client-safe. */

export type QualityTip = { lessonId: string | null; sectionId: string | null; text: string };

/** Images in the text with no description for screen readers. */
function imagesWithoutAlt(node: DocNode | null | undefined): number {
  if (!node) return 0;
  return (node.type === "image" && !String(node.attrs?.alt ?? "").trim() ? 1 : 0) + (node.content ?? []).reduce((n, c) => n + imagesWithoutAlt(c), 0);
}

export const LONG_LESSON_MINUTES = 10;
export const LONG_COURSE_MINUTES = 60;

export function qualityTips(outline: Outline): QualityTip[] {
  const tips: QualityTip[] = [];
  const tip = (text: string, lessonId: string | null = null, sectionId: string | null = null) => tips.push({ lessonId, sectionId, text });
  const lessons = outline.sections.flatMap((s) => s.lessons);
  for (const lesson of lessons) {
    const missingAlt = imagesWithoutAlt(lesson.body);
    if (missingAlt) tip(`${missingAlt === 1 ? "An image" : `${missingAlt} images`} in “${lesson.title}” ${missingAlt === 1 ? "has" : "have"} no description, so screen readers can’t say what ${missingAlt === 1 ? "it shows" : "they show"}.`, lesson.id);
    if (lesson.kind === "READING" && readingMinutes(lesson.body) > LONG_LESSON_MINUTES) tip(`“${lesson.title}” takes about ${readingMinutes(lesson.body)} minutes to read. People learn better from lessons under ${LONG_LESSON_MINUTES} minutes: split it, or turn part of it into tabs or a step by step.`, lesson.id);
    if (lesson.kind === "AUDIO" && !lesson.body) tip(`“${lesson.title}” has no transcript, so anyone who can’t listen misses it.`, lesson.id);
    if ((lesson.kind === "VIDEO" || lesson.kind === "EMBED") && !lesson.minutes) tip(`Say how many minutes “${lesson.title}” takes, so learners can plan their time.`, lesson.id);
    if (lesson.kind === "FLASHCARDS" && (lesson.data?.cards ?? []).length > 20) tip(`“${lesson.title}” has ${(lesson.data?.cards ?? []).length} cards. Two shorter decks are easier to learn.`, lesson.id);
    if (lesson.title.length > 60) tip(`“${lesson.title.slice(0, 40)}…” is a long name. A short one fits better on a phone.`, lesson.id);
    if (lesson.kind === "EXPLORE" && (lesson.data?.spots ?? []).some((sp) => !sp.text)) tip(`A spot in “${lesson.title}” has a name but nothing to say when it opens.`, lesson.id);
  }
  for (const section of outline.sections) {
    if (section.lessons.length < 3) continue;
    const checked = outline.questions.some((q) => q.sectionId === section.id) || section.lessons.some((l) => docChecks(l.body).length || ["QUIZ", "SCENARIO", "SORTING", "FLASHCARDS", "ASSIGNMENT"].includes(l.kind));
    if (!checked) tip(`Nothing in “${section.title}” checks that people understood it. Add a knowledge check, a quiz, a scenario or a sort into groups.`, null, section.id);
  }
  if (outline.exam) {
    for (const section of outline.sections) {
      if (section.lessons.length && !outline.questions.some((q) => q.sectionId === section.id)) tip(`The final exam asks nothing about “${section.title}”. Add a question or two to it.`, null, section.id);
    }
  }
  const unexplained = outline.questions.filter((q) => !q.explanation).length;
  if (unexplained) tip(`${unexplained} ${unexplained === 1 ? "question doesn’t" : "questions don’t"} say why the answer is right. A line of why helps people remember it.`);
  const minutes = lessons.reduce((n, l) => n + (lessonMinutes(l) ?? 0), 0);
  if (minutes > LONG_COURSE_MINUTES) tip(`The course takes about ${minutes} minutes. Over an hour, think about splitting it into shorter courses on a learning path.`);
  if (lessons.length >= 4 && lessons.every((l) => l.kind === "READING")) tip("Every lesson is reading. Mix in a video, a scenario, flashcards or a sort into groups to keep people with you.");
  return tips;
}
