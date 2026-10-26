"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Frame } from "@/components/frame";
import { Section } from "@/components/ui";
import { ReadAloud, SPEECH_RATES, TEXT_SIZES, useSpeechRate, useTextSize, type SpeechRate, type TextSize } from "@/components/learner";
import { session } from "@/lib/api";
import { RadioGroup } from "@/components/shadcn/radio-group";
import { ChoiceRow } from "@/components/ui/choice-row";
import { PageShell } from "@/components/ui-kit/page-shell";
import { PageHeader } from "@/components/ui-kit/page-header";

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
      <PageShell spacing="roomy" header={<PageHeader back={{ href: "/more", label: "More" }} title="Text size and reading aloud" description="Saved on this phone. Every screen follows it straight away." />}>
        <Section id="display-size" title="Text size">
        <fieldset className="pc-panel stack-sm" aria-labelledby="display-size">
          <RadioGroup className="pc-rows" name="size" value={size} onValueChange={(value) => setSize(value as TextSize)} aria-label="Text size">
            {TEXT_SIZES.map((s) => <ChoiceRow key={s.id} type="radio" value={s.id} title={s.label} />)}
          </RadioGroup>
          <p ref={sample} className="doc">Before you lift, check the scene is safe and tell your team what you are about to do.</p>
        </fieldset>
        </Section>
        <Section id="display-rate" title="Reading aloud">
        <fieldset className="pc-panel stack-sm" aria-labelledby="display-rate">
          <p className="text-ui-muted-foreground">Lessons have a Read aloud button. Your phone reads the lesson in its own voice; nothing is sent anywhere.</p>
          <RadioGroup className="pc-rows" name="rate" value={rate} onValueChange={(value) => setRate(value as SpeechRate)} aria-label="Reading speed">
            {SPEECH_RATES.map((r) => <ChoiceRow key={r.id} type="radio" value={r.id} title={r.label} />)}
          </RadioGroup>
          <div><ReadAloud target={sample} label="Try it" /></div>
        </fieldset>
        </Section>
      </PageShell>
    </Frame>
  );
}
