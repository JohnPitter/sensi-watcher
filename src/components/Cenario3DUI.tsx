// Lightweight UI helpers for the Cenario mode. No three.js imports here so
// AimLab can statically use these without pulling in the WebGL bundle.

export type CrosshairStyle = 'cross' | 'gap-cross' | 'dot' | 'circle' | 'tshape' | 'chevron';
export type EnemyColorId = 'cyan' | 'red' | 'green' | 'yellow' | 'purple' | 'white';

export const CROSSHAIR_OPTIONS: { id: CrosshairStyle; label: string }[] = [
  { id: 'cross',     label: 'Cruz' },
  { id: 'gap-cross', label: 'Cruz Aberta' },
  { id: 'dot',       label: 'Ponto' },
  { id: 'circle',    label: 'Círculo' },
  { id: 'tshape',    label: 'T' },
  { id: 'chevron',   label: 'Chevron' },
];

export const ENEMY_COLORS: { id: EnemyColorId; label: string; head: string; body: string }[] = [
  { id: 'cyan',   label: 'Ciano',    head: '#50d7eb', body: '#3cb9d2' },
  { id: 'red',    label: 'Vermelho', head: '#ff5566', body: '#d6404e' },
  { id: 'green',  label: 'Verde',    head: '#5fe070', body: '#42b855' },
  { id: 'yellow', label: 'Amarelo',  head: '#ffcb3d', body: '#d6a420' },
  { id: 'purple', label: 'Roxo',     head: '#b070ff', body: '#8a4ed4' },
  { id: 'white',  label: 'Branco',   head: '#f5f5f5', body: '#bcbcbc' },
];

export function CrosshairShape({ style, accentColor }: { style: CrosshairStyle; accentColor: string }) {
  const W = 'rgba(255,255,255,0.92)';
  switch (style) {
    case 'cross':
      return (
        <>
          <div className="absolute top-1/2 left-0 h-px -translate-y-1/2" style={{ width: 8, background: W }} />
          <div className="absolute top-1/2 right-0 h-px -translate-y-1/2" style={{ width: 8, background: W }} />
          <div className="absolute left-1/2 top-0 w-px -translate-x-1/2" style={{ height: 8, background: W }} />
          <div className="absolute left-1/2 bottom-0 w-px -translate-x-1/2" style={{ height: 8, background: W }} />
          <div className="absolute top-1/2 left-1/2 rounded-full" style={{ width: 2, height: 2, transform: 'translate(-50%, -50%)', background: accentColor, boxShadow: `0 0 4px ${accentColor}` }} />
        </>
      );
    case 'gap-cross':
      return (
        <>
          <div className="absolute top-1/2 left-0 h-px -translate-y-1/2" style={{ width: 7, background: W }} />
          <div className="absolute top-1/2 right-0 h-px -translate-y-1/2" style={{ width: 7, background: W }} />
          <div className="absolute left-1/2 top-0 w-px -translate-x-1/2" style={{ height: 7, background: W }} />
          <div className="absolute left-1/2 bottom-0 w-px -translate-x-1/2" style={{ height: 7, background: W }} />
        </>
      );
    case 'dot':
      return (
        <div className="absolute top-1/2 left-1/2 rounded-full" style={{ width: 4, height: 4, transform: 'translate(-50%, -50%)', background: accentColor, boxShadow: `0 0 6px ${accentColor}` }} />
      );
    case 'circle':
      return (
        <>
          <div className="absolute top-1/2 left-1/2 rounded-full" style={{ width: 14, height: 14, transform: 'translate(-50%, -50%)', border: `1px solid ${W}` }} />
          <div className="absolute top-1/2 left-1/2 rounded-full" style={{ width: 1.5, height: 1.5, transform: 'translate(-50%, -50%)', background: accentColor }} />
        </>
      );
    case 'tshape':
      return (
        <>
          <div className="absolute top-1/2 left-0 h-px -translate-y-1/2" style={{ width: 9, background: W }} />
          <div className="absolute top-1/2 right-0 h-px -translate-y-1/2" style={{ width: 9, background: W }} />
          <div className="absolute left-1/2 bottom-0 w-px -translate-x-1/2" style={{ height: 9, background: W }} />
          <div className="absolute top-1/2 left-1/2 rounded-full" style={{ width: 2, height: 2, transform: 'translate(-50%, -50%)', background: accentColor }} />
        </>
      );
    case 'chevron':
      return (
        <svg viewBox="0 0 22 22" className="absolute inset-0">
          <polyline points="3,7 11,14 19,7" fill="none" stroke={W} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="11" cy="11" r="1" fill={accentColor} />
        </svg>
      );
  }
}

export function CrosshairPreview({ style }: { style: CrosshairStyle }) {
  return (
    <div className="relative inline-block" style={{ width: 22, height: 22 }}>
      <CrosshairShape style={style} accentColor="#50d7eb" />
    </div>
  );
}
