import { describe, expect, it } from 'vitest';
import { getErrorMessage } from './error-message';

describe('getErrorMessage', () => {
  it('prefers the response field when present', () => {
    expect(getErrorMessage({ response: { data: { message: 'Backend detail' } } }, 'message', 'Fallback'))
      .toBe('Backend detail');
  });

  it('falls back to an error message and then to the supplied default', () => {
    expect(getErrorMessage(new Error('Request failed'), 'detail', 'Fallback')).toBe('Request failed');
    expect(getErrorMessage(null, 'detail', 'Fallback')).toBe('Fallback');
  });
});