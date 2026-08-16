import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CompactPatternPreview from './CompactPatternPreview.vue'

describe('CompactPatternPreview', () => {
  it.each([
    ['hub_and_spoke', 4],
    ['diamond_loop', 4],
    ['linear_sequence', 3],
  ] as const)('uses the shared arrow marker for %s routes', (patternKey, routeCount) => {
    const wrapper = mount(CompactPatternPreview, { props: { patternKey } })
    const markerId = wrapper.get('marker').attributes('id')
    const routes = wrapper.findAll('path.route')

    expect(routes).toHaveLength(routeCount)
    expect(routes.every((route) => route.attributes('marker-end') === `url(#${markerId})`)).toBe(true)
    expect(wrapper.get('path.marker-arrow').attributes('d')).toBe('M0 0 7 3.5 0 7Z')
  })

  it('does not show a route for the solo Pattern', () => {
    const wrapper = mount(CompactPatternPreview, { props: { patternKey: 'solo_component' } })
    expect(wrapper.findAll('path.route')).toHaveLength(0)
  })
})
