"use client";

import { useRef, type PointerEvent } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { RadioGroup } from "@/components/shadcn/radio-group";
import { ChoiceRow } from "@/components/ui/choice-row";
import { Switch } from "@/components/ui/switch";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Field } from "@/components/form-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Notice } from "@/components/ui-kit/notice";
import {
  fileSrc, HAND_IN_PARTS, MAX_CARDS, MAX_CHOICES, MAX_GROUPS, MAX_ITEMS, MAX_SCENES, MAX_SORTS, MAX_SPOTS, scenarioProblems, sortingProblems,
  type ChecklistItem, type ExploreSpot, type Flashcard, type HandInPart, type HandInSettings, type LessonData, type ScenarioChoice, type ScenarioStep, type SortItem,
} from "@/modules/training/shared/lessons";
import type { UploadedFile } from "@/modules/training/features/builder/components/upload";
import { leftOf, topOf } from "@/components/ui-kit/scale";

/** Editors for the lesson kinds that aren't text (e-learning phases 3 and 8):
 *  Scenario, Flashcards, Checklist, Sort into groups, Explore a picture and
 *  Hand in work. Each edits the lesson's `data`; the
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
const newScene = (): ScenarioStep => ({ id: id(), text: "", imageId: null, choices: [newChoice(), newChoice()] });

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
        <section key={step.id} className="flex flex-col gap-3 rounded-card bg-ui-muted p-4" aria-label={`Scene ${si + 1}`}>
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
              <li key={choice.id} className="flex flex-col gap-2 rounded-card bg-ui-card p-3">
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
          <li key={card.id} className="flex flex-col gap-2 rounded-card bg-ui-muted p-3">
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

// ---------------------------------------------------------------------------
// Sort into groups (phase 8)
// ---------------------------------------------------------------------------

export function SortingEditor({ title, data, onChange, disabled }: { title: string; data: LessonData | null; onChange: (data: LessonData) => void; disabled: boolean }) {
  const groups = data?.groups ?? [], sorts = data?.sorts ?? [];
  const set = (patch: LessonData) => onChange({ groups, sorts, ...patch });
  const problems = sortingProblems(title || "This lesson", { groups, sorts });
  return (
    <fieldset className="flex flex-col gap-4" disabled={disabled}>
      <legend className="mb-1 text-sm font-semibold">Groups and what goes in them</legend>
      <p className="text-sm text-ui-muted-foreground">Learners get everything shuffled and put each one in a group. They check their answer, see which are in the wrong place, and finish once all are right.</p>
      <ol className="grid gap-2 sm:grid-cols-2">
        {groups.map((g, i) => (
          <li key={g.id} className="flex items-end gap-2">
            <Input id={`group-${g.id}`} label={`Group ${i + 1}`} value={g.name} onChange={(value) => set({ groups: groups.map((x) => x.id === g.id ? { ...x, name: value } : x) })} maxLength={60} className="min-w-0 flex-1"
              placeholder={i === 0 ? "Safe to mix" : "Never mix"} />
            <RowTools label={`group ${i + 1}`} index={i} count={groups.length} min={2} onMove={(by) => set({ groups: moved(groups, i, by) })}
              onRemove={() => set({ groups: groups.filter((x) => x.id !== g.id), sorts: sorts.map((x) => x.group === g.id ? { ...x, group: "" } : x) })} />
          </li>
        ))}
      </ol>
      {groups.length < MAX_GROUPS ? <Button type="button" variant="outline" className="min-h-11 self-start" onClick={() => set({ groups: [...groups, { id: id(), name: "" }] })}><Plus aria-hidden="true" />Add a group</Button> : null}
      <ol className="flex flex-col gap-2">
        {sorts.map((item, i) => (
          <li key={item.id} className="flex flex-wrap items-end gap-2 rounded-card bg-ui-muted p-3">
            <Input id={`sort-${item.id}`} label={`Thing ${i + 1}`} value={item.text} onChange={(value) => set({ sorts: sorts.map((x) => x.id === item.id ? { ...x, text: value } : x) })} maxLength={200} className="min-w-0 flex-1"
              placeholder="Sodium hypochlorite and acid" />
            <Field label="Belongs in" htmlFor={`sort-group-${item.id}`}>
              <NativeSelect id={`sort-group-${item.id}`} value={item.group} onChange={(event) => set({ sorts: sorts.map((x) => x.id === item.id ? { ...x, group: event.target.value } : x) })} className="min-h-11">
                <NativeSelectOption value="">Choose a group</NativeSelectOption>
                {groups.map((g, gi) => <NativeSelectOption key={g.id} value={g.id}>{g.name || `Group ${gi + 1}`}</NativeSelectOption>)}
              </NativeSelect>
            </Field>
            <RowTools label={`thing ${i + 1}`} index={i} count={sorts.length} min={1} onMove={(by) => set({ sorts: moved(sorts, i, by) })} onRemove={() => set({ sorts: sorts.filter((x) => x.id !== item.id) })} />
          </li>
        ))}
      </ol>
      {sorts.length < MAX_SORTS ? (
        <Button type="button" variant="outline" className="min-h-11 self-start" onClick={() => set({ sorts: [...sorts, { id: id(), text: "", group: groups[0]?.id ?? "" } satisfies SortItem] })}><Plus aria-hidden="true" />Add a thing to sort</Button>
      ) : null}
      {problems.length ? (
        <Notice tone="warning" title="Before learners can do it"><ul className="list-disc pl-5">{problems.map((p) => <li key={p}>{p}</li>)}</ul></Notice>
      ) : null}
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Explore a picture (phase 8)
// ---------------------------------------------------------------------------

export function ExploreEditor({ imageId, data, onChange, disabled }: { imageId: string | null; data: LessonData | null; onChange: (data: LessonData) => void; disabled: boolean }) {
  const spots = data?.spots ?? [];
  const frame = useRef<HTMLDivElement>(null);
  const set = (next: ExploreSpot[]) => onChange({ spots: next });
  const update = (spotId: string, patch: Partial<ExploreSpot>) => set(spots.map((sp) => sp.id === spotId ? { ...sp, ...patch } : sp));
  const round = (n: number) => Math.round(Math.min(100, Math.max(0, n)) * 10) / 10;
  function place(event: PointerEvent<HTMLDivElement>) {
    if (disabled || spots.length >= MAX_SPOTS || event.button !== 0) return;
    const box = frame.current!.getBoundingClientRect();
    set([...spots, { id: id(), x: round(((event.clientX - box.left) / box.width) * 100), y: round(((event.clientY - box.top) / box.height) * 100), title: "", text: "" }]);
  }
  if (!imageId) return <Notice tone="info" title="Choose or add the picture first">Then tap it wherever you want a numbered spot for learners to open.</Notice>;
  return (
    <fieldset className="flex flex-col gap-3" disabled={disabled}>
      <legend className="mb-1 text-sm font-semibold">Spots to explore</legend>
      <p className="text-sm text-ui-muted-foreground">Tap the picture to add a numbered spot. Learners open each one to read about it, and finish once they have opened them all.</p>
      <div ref={frame} className="tf-spot-frame" role="presentation" onPointerDown={place}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a private file served by this app */}
        <img src={fileSrc(imageId)} alt="The picture to explore" draggable={false} />
        {spots.map((sp, i) => <span key={sp.id} className={`tf-explore-marker ${leftOf(sp.x / 100)} ${topOf(sp.y / 100)}`} aria-hidden="true">{i + 1}</span>)}
      </div>
      <ol className="flex flex-col gap-3">
        {spots.map((sp, i) => (
          <li key={sp.id} className="flex flex-col gap-2 rounded-card bg-ui-muted p-3">
            <div className="flex flex-wrap items-end gap-2">
              <span className="flex min-h-11 items-center font-semibold tabular-nums">{i + 1}</span>
              <Input id={`explore-${sp.id}-title`} label="Name" value={sp.title} onChange={(value) => update(sp.id, { title: value })} maxLength={120} className="min-w-0 flex-1" placeholder="Chlorine dosing pump" />
              <Input id={`explore-${sp.id}-x`} label="From left %" type="number" inputMode="decimal" min={0} max={100} step={0.5} value={String(sp.x)} className="w-28" onChange={(value) => update(sp.id, { x: round(Number(value) || 0) })} />
              <Input id={`explore-${sp.id}-y`} label="From top %" type="number" inputMode="decimal" min={0} max={100} step={0.5} value={String(sp.y)} className="w-28" onChange={(value) => update(sp.id, { y: round(Number(value) || 0) })} />
              <RowTools label={`spot ${i + 1}`} index={i} count={spots.length} min={0} onMove={(by) => set(moved(spots, i, by))} onRemove={() => set(spots.filter((x) => x.id !== sp.id))} />
            </div>
            <Textarea id={`explore-${sp.id}-text`} label="What learners read when they open it" value={sp.text} onChange={(event) => update(sp.id, { text: event.target.value })} maxLength={1000} rows={2}
              placeholder="Pumps sodium hypochlorite into the return line. Never open it while it runs." />
          </li>
        ))}
      </ol>
      {spots.length < MAX_SPOTS ? (
        <Button type="button" variant="outline" className="min-h-11 self-start" onClick={() => set([...spots, { id: id(), x: 50, y: 50, title: "", text: "" }])}><Plus aria-hidden="true" />Add a spot in the middle</Button>
      ) : null}
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Hand in work (phase 8)
// ---------------------------------------------------------------------------

const PART_LABEL: Record<HandInPart, string> = { required: "Must", optional: "May", off: "None" };

export function HandInEditor({ data, onChange, disabled }: { data: LessonData | null; onChange: (data: LessonData) => void; disabled: boolean }) {
  const handIn: HandInSettings = data?.handIn ?? { text: "required", photo: "optional", review: true };
  const set = (patch: Partial<HandInSettings>) => onChange({ handIn: { ...handIn, ...patch } });
  return (
    <fieldset className="flex flex-col gap-4" disabled={disabled}>
      <legend className="mb-1 text-sm font-semibold">What learners hand in</legend>
      <p className="text-sm text-ui-muted-foreground">Write the task in the text below: what to do, and what a good answer looks like. Learners hand it in from their phone.</p>
      {(["text", "photo"] as const).map((part) => (
        <div key={part} className="flex flex-col gap-2">
          <span className="text-sm font-semibold">{part === "text" ? "A written answer" : "A photo or PDF"}</span>
          <RadioGroup value={handIn[part]} onValueChange={(value) => set({ [part]: value as HandInPart })} className="grid gap-2 sm:grid-cols-3" aria-label={part === "text" ? "A written answer" : "A photo or PDF"}>
            {HAND_IN_PARTS.map((p) => <ChoiceRow key={p} type="radio" value={p} id={`handin-${part}-${p}`} title={PART_LABEL[p]} hint={p === "required" ? "They can’t hand in without it" : p === "optional" ? "If they want to" : "Not asked for"} />)}
          </RadioGroup>
        </div>
      ))}
      {handIn.text === "off" && handIn.photo === "off" ? <Notice tone="warning" title="Ask for a written answer, a photo or both" /> : null}
      <Switch id="handin-review" label="A trainer checks it" checked={handIn.review} onCheckedChange={(review) => set({ review })}
        description={handIn.review ? "The lesson is done once a trainer accepts it under Sign-off. They can send it back with what to change." : "The lesson is done as soon as they hand it in. Trainers can still read it."} />
    </fieldset>
  );
}
