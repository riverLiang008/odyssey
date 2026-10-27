export const m1V2 = {
  duration: 1723,
  // Source SRT milliseconds mapped to 30fps; narration-2 starts at 40.4s.
  timing: {sketchOut: 105, structure: 120, modules: 300, pattern: 450,
    behavior: 630, comparison: 810, behaviorContrast: 1020, ui: 1212, overview: 1476},
  layout: {left: 150, top: 350, height: 220, sideWidth: 335,
    centerLeft: 615, centerWidth: 690, right: 1435, behaviorTop: 695, behaviorHeight: 120},
  assets: {sketch: 'm1-v2/sketch.png', system: 'm1-v2/system.png',
    audio1: 'm1-v2/narration-1.m4a', audio2: 'm1-v2/narration-2.m4a'},
} as const;
