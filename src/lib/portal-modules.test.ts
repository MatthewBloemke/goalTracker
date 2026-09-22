import { portalModules } from './portal-modules'

describe('Family Portal module registry', () => {
  test('contains the four initial modules in navigation order', () => {
    expect(portalModules.map(({ href }) => href)).toEqual([
      '/budget',
      '/meal-planning',
      '/family-library',
      '/task-planner',
    ])
  })

  test('provides unique routes and complete display metadata', () => {
    expect(new Set(portalModules.map(({ href }) => href)).size).toBe(portalModules.length)

    for (const portalModule of portalModules) {
      expect(portalModule).toEqual(expect.objectContaining({
        accent: expect.stringMatching(/^#[0-9a-f]{6}$/i),
        description: expect.any(String),
        icon: expect.any(String),
        name: expect.any(String),
        shortName: expect.any(String),
      }))
    }
  })
})
