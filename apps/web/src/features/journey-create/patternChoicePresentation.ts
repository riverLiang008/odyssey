import type { PatternTemplateKey } from '@odyssey/schemas'

export interface PatternChoicePresentation {
  key: PatternTemplateKey
  name: string
  descriptor: string
  useCase: string
}

export const patternChoices: readonly PatternChoicePresentation[] = [
  { key: 'hub_and_spoke', name: 'Hub and Spoke', descriptor: 'Flexible coordinator + spokes', useCase: 'Coordinator-led specialist teams' },
  { key: 'diamond_loop', name: 'Circular Loop', descriptor: 'Directed cycle · one entry', useCase: 'Review, refinement, and iteration' },
  { key: 'linear_sequence', name: 'Linear Sequence', descriptor: 'Flexible ordered sequence', useCase: 'Ordered pipelines and handoffs' },
  { key: 'solo_component', name: 'Solo Component', descriptor: 'One focused Agent', useCase: 'Focused single-Agent tasks' },
]
