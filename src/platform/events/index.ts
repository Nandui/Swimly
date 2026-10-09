/** The in-process event bus (CLAUDE.md, section 6): a module announces that
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
 *  event in docs/architecture/events.md. The bus knows no module. */

// Modules add their events here by declaration merging.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface PlatformEvents {}

export type EventName = keyof PlatformEvents & string;
export type Listener<K extends EventName> = (payload: PlatformEvents[K]) => void | Promise<void>;

const listeners = new Map<string, Set<Listener<EventName>>>();

/** Listen to an event. Returns a function that stops listening. */
export function on<K extends EventName>(name: K, listener: Listener<K>): () => void {
  const set = listeners.get(name) ?? new Set();
  set.add(listener as Listener<EventName>);
  listeners.set(name, set);
  return () => { set.delete(listener as Listener<EventName>); };
}

/** Announce an event after the change is saved. Every listener runs, one
 *  after another; a listener's failure is logged and never reaches the caller. */
export async function emit<K extends EventName>(name: K, payload: PlatformEvents[K]): Promise<void> {
  for (const listener of [...(listeners.get(name) ?? [])]) {
    try {
      await listener(payload);
    } catch (error) {
      console.error(`Event listener for "${name}" failed`, error);
    }
  }
}
