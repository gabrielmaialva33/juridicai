import { configApp } from '@adonisjs/eslint-config'

export default [
  {
    ignores: [
      'inertia/components/**',
      'inertia/hooks/**',
      'inertia/lib/**',
      'inertia/styles/**',
      'inertia/config/types.ts',
    ],
  },
  ...configApp(),
]
