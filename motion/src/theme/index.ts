import {colors, radii} from '@odyssey/design-tokens';

export const theme = {
  colors,
  radius: Number.parseInt(radii.md, 10),
  // Matches apps/web/src/styles/main.css. No remote font requests during render.
  fontFamily: 'Inter, "Segoe UI", ui-sans-serif, system-ui, sans-serif',
  type: {title: 64, heading: 32, body: 26, caption: 22, eyebrow: 19},
  spacing: {unit: 8, page: 120},
} as const;

export const video = {width: 1920, height: 1080, fps: 30} as const;
