import type { Game } from '../data/games';

export function calcCm360(dpi: number, sens: number, yaw: number): number {
  if (dpi <= 0 || sens <= 0 || yaw <= 0) return 0;
  return (360 * 2.54) / (dpi * sens * yaw);
}

export function sensFromCm360(cm360: number, dpi: number, yaw: number): number {
  if (cm360 <= 0 || dpi <= 0 || yaw <= 0) return 0;
  return (360 * 2.54) / (cm360 * dpi * yaw);
}

export function convertSensitivity(
  fromGame: Game,
  toGame: Game,
  fromSens: number,
  dpi: number,
): number {
  const cm360 = calcCm360(dpi, fromSens, fromGame.yaw);
  return sensFromCm360(cm360, dpi, toGame.yaw);
}

export function calcEDPI(dpi: number, sens: number): number {
  return dpi * sens;
}

export interface Playstyle {
  name: string;
  description: string;
  range: string;
}

export function getPlaystyle(cm360: number): Playstyle {
  if (cm360 >= 50) {
    return {
      name: 'Ultra Low',
      description: 'Arm aimer, sniper specialist. Full arm movements for maximum precision.',
      range: '50+ cm/360',
    };
  }
  if (cm360 >= 35) {
    return {
      name: 'Low',
      description: 'Tactical, precision-focused. Common in CS2 and Valorant pros.',
      range: '35-50 cm/360',
    };
  }
  if (cm360 >= 25) {
    return {
      name: 'Medium-Low',
      description: 'Balanced and most popular range. Good mix of tracking and flicking.',
      range: '25-35 cm/360',
    };
  }
  if (cm360 >= 18) {
    return {
      name: 'Medium',
      description: 'Versatile all-rounder. Works well in hero shooters and battle royales.',
      range: '18-25 cm/360',
    };
  }
  if (cm360 >= 10) {
    return {
      name: 'High',
      description: 'Wrist aimer, aggressive playstyle. Fast 180s and close-quarters combat.',
      range: '10-18 cm/360',
    };
  }
  return {
    name: 'Ultra High',
    description: 'Extreme wrist aimer. Very fast but hard to control precisely.',
    range: '<10 cm/360',
  };
}

export const PLAYSTYLE_RANGES = [
  { name: 'Ultra High', min: 0, max: 10, description: 'Extreme wrist' },
  { name: 'High', min: 10, max: 18, description: 'Wrist aimer' },
  { name: 'Medium', min: 18, max: 25, description: 'Versatile' },
  { name: 'Medium-Low', min: 25, max: 35, description: 'Balanced' },
  { name: 'Low', min: 35, max: 50, description: 'Precision' },
  { name: 'Ultra Low', min: 50, max: 80, description: 'Arm aimer' },
];
