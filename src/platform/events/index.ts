/** The in-process event bus (AGENTS.md, How apps talk): a module announces that
 *  something happened, and other modules react without importing it.
 *
 *  Each module declares its events in its own `events.ts` by adding to
 *  `PlatformEvents`, so names and payloads are typed everywhere:
 *
 *    declare module "@/platform/events" {
 *      interface PlatformEvents { "rota.shift.changed": { userId: string; line: string } }
 *    }
 *
 *  Rules: emit only after the database transaction commits; payloads carry ids
 *  and the little listeners need, never table rows; a failing listener is
 *  logged and never breaks the emitter or the other listeners. List every
 *  event in docs/architecture.md. The bus knows no module: a listener names the
 *  app it belongs to by id, so `announce` can leave out an app that is switched off. */

// Modules add their events here by declaration merging.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface PlatformEvents {}

export type EventName = keyof PlatformEvents & string;
export type Listener<K extends EventName> = (payload: PlatformEvents[K]) => void | Promise<void>;
/** Whether the listener's app may hear this event (the app switch, asked by `announce`). */
export type ListenerGate = (app: string) => boolean | Promise<boolean>;

type Entry = { listener: Listener<EventName>; app: string | null };
const listeners = new Map<string, Set<Entry>>();

/** Listen to an event, as the app `options.app` (its manifest id). Returns a function that stops listening. */
export function on<K extends EventName>(name: K, listener: Listener<K>, options: { app?: string } = {}): () => void {
  const set = listeners.get(name) ?? new Set();
  const entry: Entry = { listener: listener as Listener<EventName>, app: options.app ?? null };
  set.add(entry);
  listeners.set(name, set);
  return () => { set.delete(entry); };
}

/** Announce an event after the change is saved. Every listener runs, one
 *  after another; a listener's failure is logged and never reaches the caller.
 *  With a gate, a listener whose app the gate refuses does not run. */
export async function emit<K extends EventName>(name: K, payload: PlatformEvents[K], gate?: ListenerGate): Promise<void> {
  for (const { listener, app } of [...(listeners.get(name) ?? [])]) {
    try {
      if (app && gate && !(await gate(app))) continue;
      await listener(payload);
    } catch (error) {
      console.error(`Event listener for "${name}" failed`, error);
    }
  }
}
