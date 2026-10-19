import { isRecord } from './type-guards';

export function getErrorMessage(
  error: unknown,
  responseField: 'message' | 'detail',
  fallback: string
): string {
  if (isRecord(error)) {
    const response = error['response'];
    const data = isRecord(response) ? response['data'] : undefined;
    const responseMessage = isRecord(data) ? data[responseField] : undefined;
    if (responseMessage) {
      return String(responseMessage);
    }
    if (error['message']) {
      return String(error['message']);
    }
  }
  return fallback;
}