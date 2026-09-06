/** A timeout is an unknown save outcome; it does not cancel the server action. */
export const SAVE_TIMEOUT_MS = 15_000;
export const SAVE_UNCONFIRMED_MESSAGE =
  "The save could not be confirmed. Keep this tab open and try again when the signal is back.";

export function withTimeout<T>(promise: Promise<T>, ms = SAVE_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); },
    );
  });
}
