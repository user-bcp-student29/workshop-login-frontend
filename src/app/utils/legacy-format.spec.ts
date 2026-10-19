import { describe, expect, it } from 'vitest';
import { formatTaskLabel } from './legacy-format';

describe('formatTaskLabel', () => {
  it.each([null, undefined])('returns SIN-DATOS for %s', (task) => {
    expect(formatTaskLabel(task)).toBe('SIN-DATOS');
  });

  it.each([
    {},
    { priority: '', owner: '' }
  ])('uses defaults when priority and owner are absent or empty', (task) => {
    expect(formatTaskLabel(task)).toBe('NORMAL · SIN-ASIGNAR');
  });

  it('formats priority and owner', () => {
    expect(formatTaskLabel({ priority: 'high', owner: 'student' })).toBe('HIGH · STUDENT');
  });
});
