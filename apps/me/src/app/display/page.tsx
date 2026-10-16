"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Frame } from "@/components/frame";
import { ReadAloud, SPEECH_RATES, TEXT_SIZES, useSpeechRate, useTextSize } from "@/components/learner";
import { session } from "@/lib/api";

const noSubscription = () => () => {};

/** Text size and reading aloud (Training e-learning phase 6). Kept on this
 *  phone only, so it needs nothing from Turnfin. */
export default function DisplayPage() {
  const router = useRouter();
  const token = useSyncExternalStore(noSubscription, () => session.token(), () => undefined);
  useEffect(() => { if (token === null) router.replace(`/sign-in?next=${encodeURIComponent("/display")}`); }, [token, router]);
  const [size, setSize] = useTextSize();
  const [rate, setRate] = useSpeechRate();
  const sample = useRef<HTMLParagraphElement>(null);
  if (!token) return null;
  return (
    <Frame title="Text size and reading aloud">
      <div className="stack">
        <div className="stack-sm"><h1>Text size and reading aloud</h1><p className="muted">Saved on this phone. Every screen follows it straight away.</p></div>
        <fieldset className="pc-panel stack-sm">
          <legend className="panel-legend">Text size</legend>
          <div className="pc-rows">
            {TEXT_SIZES.map((s) => (
              <label key={s.id} className="pc-row"><input type="radio" name="size" checked={size === s.id} onChange={() => setSize(s.id)} />{s.label}</label>
            ))}
          </div>
          <p ref={sample} className="doc">Before you lift, check the scene is safe and tell your team what you are about to do.</p>
        </fieldset>
        <fieldset className="pc-panel stack-sm">
          <legend className="panel-legend">Reading aloud</legend>
          <p className="muted">Lessons have a Read aloud button. Your phone reads the lesson in its own voice; nothing is sent anywhere.</p>
          <div className="pc-rows">
            {SPEECH_RATES.map((r) => (
              <label key={r.id} className="pc-row"><input type="radio" name="rate" checked={rate === r.id} onChange={() => setRate(r.id)} />{r.label}</label>
            ))}
          </div>
          <div><ReadAloud target={sample} label="Try it" /></div>
        </fieldset>
      </div>
    </Frame>
  );
}
