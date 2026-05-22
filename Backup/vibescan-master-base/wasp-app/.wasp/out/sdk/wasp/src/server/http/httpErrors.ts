import { randomUUID } from 'crypto';
import type { Response } from 'express';
import { isTestEnvironment } from '../config/env.js';

type HttpErrorLike = Error & {
  statusCode?: number;
  data?: { error?: string };
};

function getErrorCode(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'bad_request';
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 404:
      return 'not_found';
    case 413:
      return 'request_too_large';
    case 429:
      return 'quota_exceeded';
    default:
      return 'internal_error';
  }
}

function isHttpErrorLike(error: unknown): error is HttpErrorLike {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof (error as HttpErrorLike).statusCode === 'number'
  );
}

export function sendOperationError(operation: string, error: unknown, response: Response): void {
  if (isHttpErrorLike(error)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal server error';
    const data = error.data;

    response.status(statusCode).json({
      error: data?.error || getErrorCode(statusCode),
      message,
      ...(data && { details: data }),
    });
    return;
  }

  if (error instanceof SyntaxError) {
    response.status(400).json({
      error: 'validation_error',
      message: 'Invalid JSON in request body',
    });
    return;
  }

  const requestId = randomUUID();
  if (!isTestEnvironment()) {
    console.error(`[${operation}] ${requestId}`, error);
  }
  response.status(500).json({
    error: 'internal_error',
    message: 'An unexpected error occurred',
    requestId,
  });
}
