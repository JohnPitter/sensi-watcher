import { useCallback, useEffect, useRef, useState, type RefCallback, type RefObject } from 'react';

interface Options {
  sensitivity: number;
  active: boolean;
  // Called on every cursor move with virtual cursor in arena pixels (and arena dims).
  onMove?: (vx: number, vy: number, w: number, h: number) => void;
  // Called when the locked arena receives a click. Return true to skip the
  // fallback synthetic DOM click.
  onVirtualClick?: (clientX: number, clientY: number) => boolean | void;
}

interface Result {
  isLocked: boolean;
  cooldown: boolean;
  arenaRef: RefCallback<HTMLElement>;
  arenaEl: HTMLElement | null;
  cursorRef: RefObject<HTMLDivElement | null>;
  posRef: RefObject<{ x: number; y: number }>;
  exit: () => void;
  requestLock: () => void;
}

/**
 * Pointer-locks the arena so we can apply a custom mouse sensitivity multiplier.
 * Captures the native shot while locked and re-dispatches a synthetic click at
 * the virtual cursor's position so existing target onClick handlers / R3F
 * raycasters keep working unchanged.
 *
 * Uses a callback ref so the setup effect re-runs when the arena element
 * actually mounts (which can happen after `active` flips to true if the arena
 * is gated behind an animated parent like AnimatePresence/motion).
 */
export function useArenaPointerLock({ sensitivity, active, onMove, onVirtualClick }: Options): Result {
  const [isLocked, setIsLocked] = useState(false);
  const [arena, setArena] = useState<HTMLElement | null>(null);
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const sensRef = useRef(sensitivity);
  const onMoveRef = useRef(onMove);
  const onVirtualClickRef = useRef(onVirtualClick);
  const lastShotAt = useRef(0);
  const ignoreMovesUntil = useRef(0);

  useEffect(() => {
    sensRef.current = sensitivity;
    onMoveRef.current = onMove;
    onVirtualClickRef.current = onVirtualClick;
  }, [sensitivity, onMove, onVirtualClick]);

  const arenaRef = useCallback<RefCallback<HTMLElement>>((el) => {
    setArena(el);
  }, []);

  useEffect(() => {
    if (!active || !arena) return;

    function paint() {
      const ch = cursorRef.current;
      if (ch) {
        ch.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px) translate(-50%, -50%)`;
      }
    }

    function isLockedToArena() {
      return document.pointerLockElement === arena;
    }

    function lockChange() {
      const locked = document.pointerLockElement === arena;
      setIsLocked(locked);
      if (locked && arena) {
        const rect = arena.getBoundingClientRect();
        posRef.current = { x: rect.width / 2, y: rect.height / 2 };
        paint();
        onMoveRef.current?.(posRef.current.x, posRef.current.y, rect.width, rect.height);
        // Ignore the next ~120ms of mousemove events — the browser may fire a
        // synthetic "warp" with extreme deltas that would clamp the cursor to
        // the corner.
        ignoreMovesUntil.current = performance.now() + 120;
      }
    }

    function move(e: MouseEvent) {
      if (!arena || !isLockedToArena()) return;
      if (performance.now() < ignoreMovesUntil.current) return;
      if (Math.abs(e.movementX) > 500 || Math.abs(e.movementY) > 500) return;

      const rect = arena.getBoundingClientRect();
      const s = sensRef.current;
      const nx = Math.max(0, Math.min(rect.width,  posRef.current.x + e.movementX * s));
      const ny = Math.max(0, Math.min(rect.height, posRef.current.y + e.movementY * s));
      posRef.current = { x: nx, y: ny };
      paint();
      onMoveRef.current?.(nx, ny, rect.width, rect.height);
    }

    function shootCapture(e: MouseEvent) {
      if (e.button !== 0) return;
      if ((e as unknown as { __virt?: boolean }).__virt) return;
      if (!arena) return;

      // Not locked: let the arena's onClick handle engagement via requestLock()
      if (!isLockedToArena()) return;

      // Locked: synthesize a click at the virtual cursor's position
      e.preventDefault();
      e.stopPropagation();
      // Only dispatch on mousedown, not click — click fires after mousedown for the
      // same physical press and would double-register. Cooldown also covers
      // accidental double-clicks (>120ms = realistic min between intentional shots).
      if (e.type !== 'mousedown') return;
      const now = performance.now();
      if (now - lastShotAt.current < 120) return;
      lastShotAt.current = now;

      const rect = arena.getBoundingClientRect();
      const px = rect.left + posRef.current.x;
      const py = rect.top  + posRef.current.y;
      if (onVirtualClickRef.current?.(px, py)) return;

      const target = document.elementFromPoint(px, py) || arena;
      const synth = new MouseEvent('click', {
        clientX: px, clientY: py,
        button: 0, buttons: 1,
        bubbles: true, cancelable: true, view: window,
      });
      (synth as unknown as { __virt: boolean }).__virt = true;
      target.dispatchEvent(synth);
    }

    document.addEventListener('pointerlockchange', lockChange);
    document.addEventListener('mousemove', move);
    arena.addEventListener('mousedown', shootCapture, true);
    arena.addEventListener('click', shootCapture, true);

    return () => {
      document.removeEventListener('pointerlockchange', lockChange);
      document.removeEventListener('mousemove', move);
      arena.removeEventListener('mousedown', shootCapture, true);
      arena.removeEventListener('click', shootCapture, true);
      if (document.pointerLockElement === arena) {
        document.exitPointerLock?.();
      }
    };
  }, [arena, active]);

  // Auto-release when deactivated (game ends, user cancels, etc.)
  useEffect(() => {
    if (!active && document.pointerLockElement) {
      document.exitPointerLock?.();
    }
  }, [active]);

  function exit() {
    if (document.pointerLockElement) document.exitPointerLock?.();
  }

  function requestLock() {
    if (!arena) return;
    if (document.pointerLockElement === arena) return;
    if (typeof arena.requestPointerLock !== 'function') return;

    try {
      const result = arena.requestPointerLock();
      if (result && typeof (result as Promise<void>).catch === 'function') {
        (result as Promise<void>).catch((err: unknown) => {
          const name = (err as { name?: string } | null | undefined)?.name;
          if (name !== 'SecurityError' && name !== 'AbortError') {
            console.warn('[pointer-lock] failed:', err);
          }
        });
      }
    } catch (err) {
      console.warn('[pointer-lock] threw:', err);
    }
  }

  return { isLocked, cooldown: false, arenaRef, arenaEl: arena, cursorRef, posRef, exit, requestLock };
}
