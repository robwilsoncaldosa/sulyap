import { useEffect, useRef, type RefObject } from "react";
import { flushSync } from "react-dom";

export function useJourneyNavigation(heading: RefObject<HTMLHeadingElement | null>) {
  const revision = useRef(0);
  const active = useRef<ViewTransition | null>(null);

  useEffect(() => () => {
    revision.current += 1;
    active.current?.skipTransition();
  }, []);

  return (update: () => void, pointer = false, carryPhotos = false) => {
    const current = ++revision.current;
    const interrupted = active.current !== null;
    active.current?.skipTransition();
    active.current = null;
    const commit = () => {
      // Skipping a native transition still invokes its queued update callback.
      if (current !== revision.current) return;
      flushSync(update);
      heading.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    if (!pointer || !carryPhotos || interrupted || matchMedia("(prefers-reduced-motion: reduce)").matches || !document.startViewTransition) {
      document.documentElement.dataset.journeyMotion = "fallback";
      commit();
      return;
    }
    document.documentElement.dataset.journeyMotion = "photos";
    try {
      const transition = document.startViewTransition(commit);
      active.current = transition;
      void transition.ready.catch(() => undefined);
      void transition.finished.catch(() => undefined).then(() => {
        if (active.current === transition) active.current = null;
      });
    } catch {
      document.documentElement.dataset.journeyMotion = "fallback";
      commit();
    }
  };
}
