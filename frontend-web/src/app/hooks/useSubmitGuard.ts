import { useCallback, useRef, useState } from 'react';

/**
 * Prevents a slow save from being submitted twice.
 *
 * `disabled={submitting}` alone is not enough. React state updates are applied
 * on the next render, so two clicks landing in the same frame -- which is what
 * an impatient double-click on a slow connection produces -- both observe
 * `submitting === false` and both fire. That is how duplicate appointments and
 * duplicate lab orders were being created.
 *
 * The ref is the actual lock: it flips synchronously, so the second call is
 * rejected immediately. The state exists only to drive the button's appearance.
 *
 * Usage:
 *   const { submitting, guard } = useSubmitGuard();
 *   const handleAdd = guard(async () => { await createThing(); });
 *   <button disabled={submitting} onClick={handleAdd}>
 */
export function useSubmitGuard() {
  const inFlight = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  const guard = useCallback(
    <TArgs extends unknown[]>(fn: (...args: TArgs) => Promise<void> | void) =>
      async (...args: TArgs): Promise<void> => {
        if (inFlight.current) return;
        inFlight.current = true;
        setSubmitting(true);
        try {
          await fn(...args);
        } finally {
          inFlight.current = false;
          setSubmitting(false);
        }
      },
    []
  );

  return { submitting, guard };
}
