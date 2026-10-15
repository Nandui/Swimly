"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Field } from "@/components/form-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Notice } from "@/components/ui-kit/notice";
import {
  MAX_CARDS, MAX_CHOICES, MAX_ITEMS, MAX_SCENES, scenarioProblems,
  type ChecklistItem, type Flashcard, type LessonData, type ScenarioChoice, type ScenarioStep,
} from "@/modules/training/shared/lessons";
import type { UploadedFile } from "@/modules/training/features/builder/components/rich-text";

/** Editors for the lesson kinds that aren't text (e-learning phase 3):
 *  Scenario, Flashcards and Checklist. Each edits the lesson's `data`; the
 *  server cleans it again on save (`cleanLessonData`). */

export const id = () => crypto.randomUUID().replace(/-/g, "").slice(0, 8);
export function moved<T>(rows: T[], index: number, by: -1 | 1) {
  const next = [...rows];
  [next[index], next[index + by]] = [next[index + by], next[index]];
  return next;
}

export function RowTools({ label, index, count, min, onMove, onRemove }: { label: string; index: number; count: number; min: number; onMove: (by: -1 | 1) => void; onRemove: () => void }) {
  return (
    <span className="flex shrink-0 gap-1">
      <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Move ${label} up`} disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp aria-hidden="true" /></Button>
      <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Move ${label} down`} disabled={index === count - 1} onClick={() => onMove(1)}><ArrowDown aria-hidden="true" /></Button>
      <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Remove ${label}`} disabled={count <= min} onClick={onRemove}><X aria-hidden="true" /></Button>
    </span>
  );
}

function PictureSelect({ id: field, value, images, onChange }: { id: string; value: string | null; images: UploadedFile[]; onChange: (value: string | null) => void }) {
  if (!images.length) return null;
  return (
    <Field label="Picture (optional)" htmlFor={field}>
      <NativeSelect id={field} value={value ?? ""} onChange={(event) => onChange(event.target.value || null)} className="min-h-11 w-full">
        <NativeSelectOption value="">No picture</NativeSelectOption>
        {images.map((f) => <NativeSelectOption key={f.id} value={f.id}>{f.name}</NativeSelectOption>)}
      </NativeSelect>
    </Field>
  );
}

// ---------------------------------------------------------------------------
// Scenario
// ---------------------------------------------------------------------------

const END_BEST = "end:best", END = "end";
const nextValue = (c: ScenarioChoice) => c.next ?? (c.best ? END_BEST : END);
const fromValue = (value: string): Pick<ScenarioChoice, "next" | "best"> => value === END_BEST ? { next: null, best: true } : value === END ? { next: null, best: false } : { next: value, best: false };
const newChoice = (): ScenarioChoice => ({ id: id(), text: "", feedback: "", next: null, best: false });
export const newScene = (): ScenarioStep => ({ id: id(), text: "", imageId: null, choices: [newChoice(), newChoice()] });

export function ScenarioEditor({ title, data, onChange, images, disabled }: { title: string; data: LessonData | null; onChange: (data: LessonData) => void; images: UploadedFile[]; disabled: boolean }) {
  const steps = data?.steps ?? [];
  const set = (next: ScenarioStep[]) => onChange({ steps: next });
  const setStep = (index: number, patch: Partial<ScenarioStep>) => set(steps.map((s, i) => i === index ? { ...s, ...patch } : s));
  const setChoice = (si: number, ci: number, patch: Partial<ScenarioChoice>) => setStep(si, { choices: steps[si].choices.map((c, i) => i === ci ? { ...c, ...patch } : c) });
  const problems = steps.length ? scenarioProblems(title || "This scenario", steps) : [];
  const sceneName = (s: ScenarioStep, i: number) => `Scene ${i + 1}${s.text ? `: ${s.text.slice(0, 40)}${s.text.length > 40 ? "…" : ""}` : ""}`;
  return (
    <fieldset className="flex flex-col gap-4" disabled={disabled}>
      <legend className="mb-1 text-sm font-semibold">Scenes</legend>
      <p className="text-sm text-ui-muted-foreground">Tell a real situation in scenes. Learners read a scene and choose what to do. Each choice says what happened, then leads to another scene or ends it. Learners finish when they reach an ending you mark as the best outcome; any other ending lets them try again.</p>
      {steps.map((step, si) => (
        <section key={step.id} className="flex flex-col gap-3 rounded-[var(--pc-radius-card)] bg-ui-muted p-4" aria-label={`Scene ${si + 1}`}>
          <div className="flex items-center gap-2">
            <h3 className="min-w-0 flex-1 font-semibold">Scene {si + 1}{si === 0 ? " (where it starts)" : ""}</h3>
            <RowTools label={`scene ${si + 1}`} index={si} count={steps.length} min={1} onMove={(by) => set(moved(steps, si, by))}
              onRemove={() => set(steps.filter((s) => s.id !== step.id).map((s) => ({ ...s, choices: s.choices.map((c) => c.next === step.id ? { ...c, next: null } : c) })))} />
          </div>
          <Textarea id={`scene-${step.id}`} label="What happens" value={step.text} onChange={(event) => setStep(si, { text: event.target.value })} maxLength={1500} rows={3}
            placeholder="It's 4pm on a busy Saturday. You hear a shout from the deep end and see a child struggling…" />
          <PictureSelect id={`scene-img-${step.id}`} value={step.imageId} images={images} onChange={(imageId) => setStep(si, { imageId })} />
          <ol className="flex flex-col gap-3">
            {step.choices.map((choice, ci) => (
              <li key={choice.id} className="flex flex-col gap-2 rounded-[var(--pc-radius-card)] bg-ui-card p-3">
                <div className="flex items-end gap-2">
                  <Input id={`choice-${choice.id}`} label={`Choice ${ci + 1}`} value={choice.text} onChange={(value) => setChoice(si, ci, { text: value })} maxLength={200} className="min-w-0 flex-1" placeholder="Blow your whistle and enter the water" />
                  <RowTools label={`choice ${ci + 1}`} index={ci} count={step.choices.length} min={1} onMove={(by) => setStep(si, { choices: moved(step.choices, ci, by) })}
                    onRemove={() => setStep(si, { choices: step.choices.filter((c) => c.id !== choice.id) })} />
                </div>
                <Textarea id={`feedback-${choice.id}`} label="What happens next (shown after they choose)" value={choice.feedback} onChange={(event) => setChoice(si, ci, { feedback: event.target.value })} maxLength={600} rows={2} />
                <Field label="Then" htmlFor={`next-${choice.id}`}>
                  <NativeSelect id={`next-${choice.id}`} value={nextValue(choice)} onChange={(event) => setChoice(si, ci, fromValue(event.target.value))} className="min-h-11 w-full">
                    <NativeSelectOption value={END_BEST}>It ends: the best outcome</NativeSelectOption>
                    <NativeSelectOption value={END}>It ends: not the best, try again</NativeSelectOption>
                    {steps.map((s, i) => s.id === step.id ? null : <NativeSelectOption key={s.id} value={s.id}>Go to {sceneName(s, i)}</NativeSelectOption>)}
                  </NativeSelect>
                </Field>
              </li>
            ))}
          </ol>
          {step.choices.length < MAX_CHOICES ? (
            <Button type="button" variant="outline" className="min-h-11 self-start" onClick={() => setStep(si, { choices: [...step.choices, newChoice()] })}><Plus aria-hidden="true" />Add a choice</Button>
          ) : null}
        </section>
      ))}
      {steps.length < MAX_SCENES ? (
        <Button type="button" variant="outline" className="min-h-11 self-start" onClick={() => set([...steps, newScene()])}><Plus aria-hidden="true" />Add a scene</Button>
      ) : null}
      {problems.length ? (
        <Notice tone="warning" title="Before learners can play it">
          <ul className="list-disc pl-5">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
        </Notice>
      ) : steps.length ? <Notice tone="success" title="Every scene can be reached, and there is a best outcome" /> : null}
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Flashcards
// ---------------------------------------------------------------------------

const newCard = (): Flashcard => ({ id: id(), front: "", back: "", imageId: null });

export function CardsEditor({ data, onChange, images, disabled }: { data: LessonData | null; onChange: (data: LessonData) => void; images: UploadedFile[]; disabled: boolean }) {
  const cards = data?.cards ?? [];
  const set = (next: Flashcard[]) => onChange({ cards: next });
  const setCard = (index: number, patch: Partial<Flashcard>) => set(cards.map((c, i) => i === index ? { ...c, ...patch } : c));
  return (
    <fieldset className="flex flex-col gap-3" disabled={disabled}>
      <legend className="mb-1 text-sm font-semibold">Cards</legend>
      <p className="text-sm text-ui-muted-foreground">Learners see the front, think of the answer, then flip it. Cards they didn’t know come back at the end until they know them all.</p>
      <ol className="flex flex-col gap-3">
        {cards.map((card, i) => (
          <li key={card.id} className="flex flex-col gap-2 rounded-[var(--pc-radius-card)] bg-ui-muted p-3">
            <div className="flex items-end gap-2">
              <Input id={`front-${card.id}`} label={`Card ${i + 1}: front`} value={card.front} onChange={(value) => setCard(i, { front: value })} maxLength={200} className="min-w-0 flex-1" placeholder="Combined chlorine" />
              <RowTools label={`card ${i + 1}`} index={i} count={cards.length} min={1} onMove={(by) => set(moved(cards, i, by))} onRemove={() => set(cards.filter((c) => c.id !== card.id))} />
            </div>
            <Textarea id={`back-${card.id}`} label="Back" value={card.back} onChange={(event) => setCard(i, { back: event.target.value })} maxLength={600} rows={2} placeholder="Chlorine that has reacted with sweat and urine. Keep it below 1.0 mg/l." />
            <PictureSelect id={`card-img-${card.id}`} value={card.imageId} images={images} onChange={(imageId) => setCard(i, { imageId })} />
          </li>
        ))}
      </ol>
      {cards.length < MAX_CARDS ? <Button type="button" variant="outline" className="min-h-11 self-start" onClick={() => set([...cards, newCard()])}><Plus aria-hidden="true" />Add a card</Button> : null}
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

export function ChecklistEditor({ data, onChange, disabled }: { data: LessonData | null; onChange: (data: LessonData) => void; disabled: boolean }) {
  const items = data?.items ?? [];
  const set = (next: ChecklistItem[]) => onChange({ items: next });
  return (
    <fieldset className="flex flex-col gap-3" disabled={disabled}>
      <legend className="mb-1 text-sm font-semibold">Things to tick off</legend>
      <p className="text-sm text-ui-muted-foreground">Learners tick each one as they find, check or do it. They finish once every one is ticked.</p>
      <ol className="flex flex-col gap-2">
        {items.map((item, i) => (
          <li key={item.id} className="flex items-end gap-2">
            <Input id={`item-${item.id}`} label={`${i + 1}`} value={item.text} onChange={(value) => set(items.map((x) => x.id === item.id ? { ...x, text: value } : x))} maxLength={200} className="min-w-0 flex-1"
              placeholder="Find the spinal board and check its straps" />
            <RowTools label={`item ${i + 1}`} index={i} count={items.length} min={1} onMove={(by) => set(moved(items, i, by))} onRemove={() => set(items.filter((x) => x.id !== item.id))} />
          </li>
        ))}
      </ol>
      {items.length < MAX_ITEMS ? <Button type="button" variant="outline" className="min-h-11 self-start" onClick={() => set([...items, { id: id(), text: "" }])}><Plus aria-hidden="true" />Add one</Button> : null}
    </fieldset>
  );
}
