import { HttpError } from 'wasp/server';
import type { Request, Response } from 'express';
import { getReport, getReportSummary, generateReportPDF, getCIDecision } from './index';

export async function getReportApiHandler(request: Request, response: Response, context: any) {
  try {
    const result = await getReport(
      { scanId: String(request.params.scanId) },
      {
        user: (request as any).user,
        entities: context.entities,
      },
    );

    response.status(200).json(result);
  } catch (error) {
    handleOperationError(error, response);
  }
}

export async function getReportSummaryApiHandler(request: Request, response: Response, context: any) {
  try {
    const result = await getReportSummary(
      { scanId: String(request.params.scanId) },
      {
        user: (request as any).user,
        entities: context.entities,
      },
    );

    response.status(200).json(result);
  } catch (error) {
    handleOperationError(error, response);
  }
}

export async function generateReportPDFApiHandler(request: Request, response: Response, context: any) {
  try {
    let body: Record<string, unknown> = {};
    if (request.body) {
      body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    }

    const result = await generateReportPDF(
      {
        scanId: String(request.params.scanId),
        ...body,
      },
      {
        user: (request as any).user,
        entities: context.entities,
      },
    );

    response.status(200).json(result);
  } catch (error) {
    handleOperationError(error, response);
  }
}

export async function getCIDecisionApiHandler(request: Request, response: Response, context: any) {
  try {
    const result = await getCIDecision(
      { scanId: String(request.params.scanId) },
      {
        user: (request as any).user,
        entities: context.entities,
      },
    );

    response.status(200).json(result);
  } catch (error) {
    handleOperationError(error, response);
  }
}

function handleOperationError(error: any, response: Response) {
  if (error instanceof HttpError) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal server error';
    const data = (error as any).data;

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

  console.error('Unexpected error in report operation:', error);
  response.status(500).json({
    error: 'internal_error',
    message: 'An unexpected error occurred',
  });
}

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
    case 429:
      return 'too_many_requests';
    default:
      return 'internal_error';
  }
}
