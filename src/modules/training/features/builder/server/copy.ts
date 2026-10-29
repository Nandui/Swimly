import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { cleanDoc, fileIdFromSrc, fileSrc, type DocNode, type LessonData } from "@/modules/training/shared/lessons";
import type { QuestionOption } from "@/modules/training/shared/questions";

/** Copying course material between courses (e-learning phase 3): duplicating
 *  a course and copying lessons or questions in. Files belong to one course,
 *  so each one used is copied too, and every reference is pointed at the copy. */

type Ids = ReadonlyMap<string, string>;

/** Copies these files into the course, returning old id to new id. Only files
 *  of the same organisation's courses are read. */
export async function copyFiles(tx: Prisma.TransactionClient, orgId: string, toCourseId: string, ids: Iterable<string>, who: { id: string; name: string }) {
  const wanted = [...new Set(ids)];
  const map = new Map<string, string>();
  if (!wanted.length) return map;
  const files = await tx.trainingFile.findMany({ where: { id: { in: wanted }, course: { orgId } }, select: { id: true, courseId: true, name: true, mime: true, size: true, bytes: true } });
  for (const file of files) {
    if (file.courseId === toCourseId) { map.set(file.id, file.id); continue; }
    const copy = await tx.trainingFile.create({ data: { courseId: toCourseId, name: file.name, mime: file.mime, size: file.size, bytes: file.bytes, addedById: who.id, addedByName: who.name }, select: { id: true } });
    map.set(file.id, copy.id);
  }
  return map;
}

/** Lesson text with its images and knowledge checks pointing at the copies.
 *  A knowledge check whose question wasn't copied is dropped. */
export function remapDoc(body: unknown, files: Ids, questions: Ids | null): DocNode | null {
  const walk = (node: DocNode): DocNode | null => {
    if (node.type === "image") {
      const id = fileIdFromSrc(node.attrs?.src);
      const next = id ? files.get(id) : null;
      return next ? { ...node, attrs: { ...node.attrs, src: fileSrc(next) } } : null;
    }
    if (node.type === "fileButton" || node.type === "audioBlock" || node.type === "fileView") {
      const next = files.get(String(node.attrs?.fileId ?? ""));
      return next ? { ...node, attrs: { ...node.attrs, fileId: next } } : null;
    }
    if (node.type === "activity") {
      const fileId = node.attrs?.fileId ? files.get(String(node.attrs.fileId)) ?? null : null;
      return { ...node, attrs: { ...node.attrs, fileId, data: remapData((node.attrs?.data ?? null) as LessonData | null, files) } };
    }
    if (node.type === "knowledgeCheck") {
      const id = String(node.attrs?.questionId ?? "");
      const next = questions ? questions.get(id) : id;
      return next ? { type: "knowledgeCheck", attrs: { questionId: next } } : null;
    }
    return node.content ? { ...node, content: node.content.map(walk).filter((n): n is DocNode => !!n) } : node;
  };
  const doc = cleanDoc(body);
  return doc ? cleanDoc(walk(doc)) : null;
}

export const remapData = (data: LessonData | null, files: Ids): LessonData | null => data && {
  ...data,
  steps: data.steps?.map((s) => ({ ...s, imageId: s.imageId ? files.get(s.imageId) ?? null : null })),
  cards: data.cards?.map((c) => ({ ...c, imageId: c.imageId ? files.get(c.imageId) ?? null : null })),
};

export const remapOptions = (options: QuestionOption[], files: Ids) => options.map((o) => ({ ...o, imageId: o.imageId ? files.get(o.imageId) ?? null : null }));
