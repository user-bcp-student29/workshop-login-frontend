import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: [
        'src/app/login/login.component.ts',
        'src/app/dashboard/dashboard.component.ts',
        'src/app/services/session.service.ts',
        'src/app/utils/error-message.ts',
        'src/app/utils/type-guards.ts',
        'src/app/utils/legacy-format.ts'
      ],
      thresholds: {
        statements: 85,
        branches: 85,
        functions: 85,
        lines: 85
      }
    }
  }
});
