import { HttpErrorResponse } from '@angular/common/http';

/** Relative URL: proxied to the backend by `ng serve` (proxy.conf.json) and by nginx in Docker. */
export const API_URL = '/api';

export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return 'Server unreachable';
    return error.error?.detail ?? error.message;
  }
  return 'Unexpected error';
}
