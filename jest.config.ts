import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
  dir: './',
})

const config: Config = {
  clearMocks: true,
  collectCoverageFrom: [
    'src/lib/**/*.{ts,tsx}',
    'src/app/**/_lib/**/*.{ts,tsx}',
    'supabase/functions/_shared/recipe.ts',
    'supabase/functions/analyze-recipe/recipe-import.ts',
    'supabase/functions/analyze-recipe/openai-errors.ts',
    'supabase/functions/analyze-recipe/public-web.ts',
    '!src/lib/supabase/**',
    '!src/app/**/_lib/**/*.test.{ts,tsx}',
  ],
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
  coverageReporters: ['text', 'html', 'lcov'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleNameMapper: {
    '^npm:undici@6\\.29\\.1$': 'undici',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jsdom',
}

export default createJestConfig(config)
