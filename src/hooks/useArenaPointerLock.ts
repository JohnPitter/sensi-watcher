import { useEffect, useRef, useState, type RefObject } from 'react';

interface Options {
  arenaRef: RefObject<HTMLElement | null>;
  sensitivity: number;
  active: boolean;
  // Called on every cursor move with virtual cursor in arena pixels (and arena dims).
  onMove?: (vx: number, vy: number, w: number, h: number) => void;
}

interface Result {
  isLocked: boolean;
  cursorRef: RefObject<HTMLDivElement | null>;
  posRef: RefObject<{ x: number; y: number }>;
  exit: () => void;
}

/**
 * Pointer-locks the arena so we can apply a custom mouse sensitivity multiplier.
 * Captures the native click while locked and re-dispatches a synthetic click at
 * the virtual cursor's position so existing target onClick handlers / R3F
 * raycasters keep working unchanged.
 */
export function useArenaPointerLock({ arenaRef, sensitivity, active, onMove }: Options): Result {
  const [isLocked, setIsLocked] = useState(false);
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const sensRef = useRef(sensitivity);
  const onMoveRef = useRef(onMove);
  sensRef.current = sensitivity;
  onMoveRef.current = onMove;

  useEffect(() => {
    if (!active) return;
    const arena = arenaRef.current;
    if (!arena) return;

    function paint() {
      const ch = cursorRef.current;
      if (ch) {
        ch.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px) translate(-50%, -50%)`;
      }
    }

    function lockChange() {
      const locked = document.pointerLockElement === arena;
      setIsLocked(locked);
      if (locked && arena) {
        const rect = arena.getBoundingClientRect();
        posRef.current = { x: rect.width / 2, y: rect.height / 2 };
        paint();
        onMoveRef.current?.(posRef.current.x, posRef.current.y, rect.width, rect.height);
      }
    }

    function move(e: MouseEvent) {
      if (document.pointerLockElement !== arena || !arena) return;
      const rect = arena.getBoundingClientRect();
      const s = sensRef.current;
      const nx = Math.max(0, Math.min(rect.width,  posRef.current.x + e.movementX * s));
      const ny = Math.max(0, Math.min(rect.height, posRef.current.y + e.movementY * s));
      posRef.current = { x: nx, y: ny };
      paint();
      onMoveRef.current?.(nx, ny, rect.width, rect.height);
    }

    function clickCapture(e: MouseEvent) {
      // Our own re-dispatched click — let it through normally
      if ((e as unknown as { __virt?: boolean }).__virt) return;

      if (!arena) return;

      if (document.pointerLockElement !== arena) {
        // Not locked: engage lock and swallow the click
        e.preventDefault();
        e.stopPropagation();
        const req = (arena as HTMLElement & { requestPointerLock?: () => void }).requestPointerLock;
        if (req) req.call(arena);
        return;
      }

      // Locked: synthesize a click at the virtual cursor's position
      e.preventDefault();
      e.stopPropagation();
      const rect = arena.getBoundingClientRect();
      const px = rect.left + posRef.current.x;
      const py = rect.top  + posRef.current.y;
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
    arena.addEventListener('click', clickCapture, true);

    return () => {
      document.removeEventListener('pointerlockchange', lockChange);
      document.removeEventListener('mousemove', move);
      arena.removeEventListener('click', clickCapture, true);
      if (document.pointerLockElement === arena) {
        document.exitPointerLock?.();
      }
    };
  }, [arenaRef, active]);

  // Auto-release when deactivated (game ends, user cancels, etc.)
  useEffect(() => {
    if (!active && document.pointerLockElement) {
      document.exitPointerLock?.();
    }
  }, [active]);

  function exit() {
    if (document.pointerLockElement) document.exitPointerLock?.();
  }

  return { isLocked, cursorRef, posRef, exit };
}
