"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import type { AppearanceTheme } from "./use-appearance-theme";

gsap.registerPlugin(useGSAP);

export function useWorkspaceMotion(theme: AppearanceTheme) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (theme !== "ga") return;

    const media = gsap.matchMedia();
    media.add({ reduceMotion: "(prefers-reduced-motion: reduce)" }, ({ conditions }) => {
      if (conditions?.reduceMotion) return;

      const timeline = gsap.timeline({ defaults: { duration: 0.62, ease: "power3.out" } });
      timeline
        .from(".app-sidebar", { x: -22, autoAlpha: 0, duration: 0.52 })
        .from(".workspace-topbar", { y: -16, autoAlpha: 0 }, "<0.1")
        .from(".workspace-module-nav", { y: 14, autoAlpha: 0 }, "<0.1")
        .from(".workspace-page.is-active > *", { y: 16, autoAlpha: 0, stagger: 0.045, duration: 0.5 }, "<0.12");

      return () => timeline.kill();
    }, scope.current ?? undefined);

    return () => media.revert();
  }, { scope, dependencies: [theme], revertOnUpdate: true });

  return scope;
}
