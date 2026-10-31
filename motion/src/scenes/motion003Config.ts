export const motion003 = {
  duration: 615,
  audio: 'm3/narration.m4a',
  timing: {question: 90, agent: 210, goal: 285, task: 360, contrast: 480},
  layout: {agent: {x: 110, y: 350, width: 810, height: 500},
    task: {x: 1010, y: 400, width: 800, height: 400}},
  agentRows: ['Model   GPT-4o', 'Goal   Analyze evidence for the brief',
    'Knowledge Spaces   Paper Research', 'Toolbox   Web Search · Read File'],
  steps: ['Knowledge Retrieval', 'Extract Section', 'Write Variable'],
} as const;
