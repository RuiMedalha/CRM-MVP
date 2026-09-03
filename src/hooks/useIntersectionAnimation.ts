import { useEffect, useRef, useState } from "react";

/**
 * Hook that triggers animation class when element enters viewport.
 * Respects prefers-reduced-motion.
 */
export function useIntersectionAnimation<T extends HTMLElement = HTMLDivElement>(
  options?: IntersectionObserverInit
) {
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Respect prefers-reduced-motion
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) {
      setIsVisible(true);
      return;
    }

    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(element);
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px", ...options }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [options]);

  return { ref, isVisible };
}

/**
 * Hook variant that returns a className string for convenience.
 */
export function useSlideUp<T extends HTMLElement = HTMLDivElement>(
  options?: IntersectionObserverInit
) {
  const { ref, isVisible } = useIntersectionAnimation<T>(options);
  const className = `he-slide-up${isVisible ? " he-visible" : ""}`;
  return { ref, className, isVisible };
}
