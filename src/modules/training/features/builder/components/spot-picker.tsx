"use client";

import { useRef, useState, type PointerEvent } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/ui/input";
import { cleanArea, type Area } from "@/modules/training/shared/questions";
import { fileSrc } from "@/modules/training/shared/lessons";
import { heightOf, leftOf, topOf, widthOf } from "@/components/ui-kit/scale";

/** The right spots on a Pick the spot question: drag a box over the picture
 *  for each one. Every box can also be set in numbers, for keyboard users. */
export type SpotDraft = { key: string; id?: string; text: string; area: Area };

export function SpotPicker({ imageId, spots, onChange, newKey }: { imageId: string; spots: SpotDraft[]; onChange: (spots: SpotDraft[]) => void; newKey: () => string }) {
  const frame = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState<{ x: number; y: number; to: { x: number; y: number } } | null>(null);
  const at = (event: PointerEvent) => {
    const box = frame.current!.getBoundingClientRect();
    return { x: ((event.clientX - box.left) / box.width) * 100, y: ((event.clientY - box.top) / box.height) * 100 };
  };
  const rect = (d: NonNullable<typeof drawing>): Area => ({ x: Math.min(d.x, d.to.x), y: Math.min(d.y, d.to.y), w: Math.abs(d.to.x - d.x), h: Math.abs(d.to.y - d.y) });
  function finish() {
    if (!drawing) return;
    const area = cleanArea(rect(drawing));
    setDrawing(null);
    if (area && spots.length < 8) onChange([...spots, { key: newKey(), text: "", area }]);
  }
  const update = (key: string, patch: Partial<SpotDraft>) => onChange(spots.map((s) => s.key === key ? { ...s, ...patch } : s));
  const shown = [...spots.map((s) => s.area), ...(drawing ? [rect(drawing)] : [])];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ui-muted-foreground">Drag a box over each right place on the picture. A tap anywhere inside a box counts as right.</p>
      <div ref={frame} className="tf-spot-frame" role="presentation"
        onPointerDown={(event) => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); const p = at(event); setDrawing({ ...p, to: p }); }}
        onPointerMove={(event) => { if (drawing) setDrawing({ ...drawing, to: at(event) }); }}
        onPointerUp={finish} onPointerCancel={() => setDrawing(null)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a private file served by this app */}
        <img src={fileSrc(imageId)} alt="The question's picture" draggable={false} />
        {shown.map((a, i) => (
          <span key={i} className={`tf-spot-area ${leftOf(a.x / 100)} ${topOf(a.y / 100)} ${widthOf(a.w / 100)} ${heightOf(a.h / 100)}`} aria-hidden="true">
            <span className="tf-spot-number">{i + 1}</span>
          </span>
        ))}
      </div>
      {spots.length ? (
        <ol className="flex flex-col gap-2">
          {spots.map((s, i) => (
            <li key={s.key} className="flex flex-wrap items-end gap-2 rounded-card bg-ui-muted p-3">
              <span className="flex min-h-11 items-center font-semibold tabular-nums">{i + 1}</span>
              <Input id={`spot-${s.key}-label`} label="Name (optional)" value={s.text} onChange={(value) => update(s.key, { text: value })} maxLength={300} className="min-w-0 flex-1" />
              {(["x", "y", "w", "h"] as const).map((k) => (
                <Input key={k} id={`spot-${s.key}-${k}`} label={{ x: "From left %", y: "From top %", w: "Width %", h: "Height %" }[k]} type="number" inputMode="decimal" min={0} max={100} step={0.5}
                  value={String(s.area[k])} className="w-28"
                  onChange={(value) => { const area = cleanArea({ ...s.area, [k]: Number(value) }); if (area) update(s.key, { area }); }} />
              ))}
              <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Remove spot ${i + 1}`} onClick={() => onChange(spots.filter((x) => x.key !== s.key))}><X aria-hidden="true" /></Button>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
