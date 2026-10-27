export const motion001 = {
  id: 'Motion001',
  durationInFrames: 300,
  timing: {nodes: [12, 30, 48], arrows: [75, 96], behavior: 126, dimensions: 192},
  layout: {left: 390, top: 426, nodeWidth: 360, nodeHeight: 140, gap: 72, behaviorTop: 382, behaviorHeight: 350},
  copy: {
    eyebrow: 'ODYSSEY / HOW 002                                      MOTION 001',
    title: 'Execution Module × Execution Behavior',
    subtitle: 'Two dimensions of execution configuration',
    nodes: ['Input Guardrail', 'Agent', 'Output Guardrail'],
    behavior: 'Execution Behavior',
    behaviorDescription: 'Cross-cutting throughout execution · Does not advance system state',
    horizontal: 'Execution Modules / State Progression',
    horizontalNote: 'Module / Pattern actively advances system state',
    vertical: 'Execution Behaviors',
    verticalNote: 'Cross-cutting Behavior',
    footer: 'Simplified execution order · Not a multi-agent Pattern topology',
  },
} as const;
