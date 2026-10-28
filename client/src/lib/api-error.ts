import { isAxiosError } from 'axios';
/** Read only the supported public error message, never stringify a request. */
export function apiErrorMessage(error: unknown): string | undefined {
  if (isAxiosError<{message?:unknown}>(error) && typeof error.response?.data?.message === 'string') return error.response.data.message;
  return error instanceof Error ? error.message : undefined;
}
