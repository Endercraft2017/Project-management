/**
 * Ambient Background
 * Three blurred color blobs that wander behind the glass UI. Each blob follows
 * a Lissajous path built from sine waves with non-harmonic frequencies, so the
 * motion stays smooth but never visibly loops. Motion stops when the user
 * prefers reduced motion or turns it off in the user menu.
 */

import { useEffect, useRef } from 'react';
import { useUiStore } from '@/store/uiStore';

const BLOBS = [
  { color: 'var(--blob-1)', className: '-left-[10%] -top-[15%] h-[55vw] w-[55vw]' },
  { color: 'var(--blob-2)', className: '-bottom-[20%] -right-[10%] h-[55vw] w-[55vw]' },
  { color: 'var(--blob-3)', className: 'left-[35%] top-[30%] h-[40vw] w-[40vw]' },
];

// Frequencies are radians/second; dominant periods land around 10-25s.
const PARAMS = BLOBS.map((_, i) => ({
  phase: i * 137.5,
  fx1: 0.26 + i * 0.07,
  fx2: 0.45 + i * 0.105,
  fy1: 0.31 + i * 0.07,
  fy2: 0.57 + i * 0.065,
  ampX: 70 + i * 22,
  ampY: 55 + i * 26,
  rotSpeed: 0.16 + i * 0.04,
  rotAmp: 18 + i * 6,
}));

export default function AmbientBackground() {
  const blobRefs = useRef<(HTMLDivElement | null)[]>([]);
  const ambientMotion = useUiStore((state) => state.ambientMotion);

  useEffect(() => {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!ambientMotion || reducedMotion || typeof requestAnimationFrame !== 'function') {
      blobRefs.current.forEach((el) => el && (el.style.transform = ''));
      return;
    }

    let frame = 0;
    let mouseX = 0;
    let mouseY = 0;

    const onMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    const tick = (now: number) => {
      const t = now * 0.001;
      PARAMS.forEach((p, i) => {
        const el = blobRefs.current[i];
        if (!el) return;
        const x =
          Math.sin(t * p.fx1 + p.phase) * p.ampX + Math.sin(t * p.fx2 + p.phase * 1.7) * p.ampX * 0.45;
        const y =
          Math.cos(t * p.fy1 + p.phase * 0.6) * p.ampY +
          Math.cos(t * p.fy2 + p.phase * 2.1) * p.ampY * 0.45;
        const rotate = Math.sin(t * p.rotSpeed + p.phase) * p.rotAmp;
        const scale = 1 + Math.sin(t * (0.32 + i * 0.05) + p.phase) * 0.12;
        const parallax = (i + 1) * 12;
        el.style.transform = `translate(${(x + mouseX * parallax).toFixed(1)}px, ${(y + mouseY * parallax).toFixed(1)}px) rotate(${rotate.toFixed(1)}deg) scale(${scale.toFixed(3)})`;
      });
      frame = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [ambientMotion]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {BLOBS.map((blob, i) => (
        <div
          key={i}
          ref={(el) => (blobRefs.current[i] = el)}
          className={`ambient-blob ${blob.className}`}
          style={{ background: `radial-gradient(circle, ${blob.color}, transparent 70%)` }}
        />
      ))}
    </div>
  );
}
