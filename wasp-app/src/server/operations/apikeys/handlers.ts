import { HttpError } from 'wasp/server';
import type { Request, Response } from 'express';
import {
  generateAPIKey,
  listAPIKeys,
  getAPIKeyDetails,
  revokeAPIKey,
  type GenerateAPIKeyInput,
  type GetAPIKeyDetailsInput,
  type RevokeAPIKeyInput,
} from './index';

function handleOperationError(error: any, response: Response) {
  if (error instanceof HttpError) {
    response.status(error.statusCode).json({ error: error.message });
  } else {
    response.status(500).json({ error: 'Internal server error' });
  }
}

export async function generateAPIKeyApiHandler(
  request: Request,
  response: Response,
  context: any
) {
  try {
    let body: any = {};
    if (request.body) {
      body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    }

    const result = await generateAPIKey(body as GenerateAPIKeyInput, {
      user: (request as any).user,
      entities: context.entities,
    });

    response.status(201).json(result);
  } catch (error) {
    handleOperationError(error, response);
  }
}

export async function listAPIKeysApiHandler(
  request: Request,
  response: Response,
  context: any
) {
  try {
    const result = await listAPIKeys(
      {},
      {
        user: (request as any).user,
        entities: context.entities,
      }
    );

    response.status(200).json(result);
  } catch (error) {
    handleOperationError(error, response);
  }
}

export async function getAPIKeyDetailsApiHandler(
  request: Request,
  response: Response,
  context: any
) {
  try {
    const keyId = request.params.keyId;
    const result = await getAPIKeyDetails(
      { keyId },
      {
        user: (request as any).user,
        entities: context.entities,
      }
    );

    response.status(200).json(result);
  } catch (error) {
    handleOperationError(error, response);
  }
}

export async function revokeAPIKeyApiHandler(
  request: Request,
  response: Response,
  context: any
) {
  try {
    const keyId = request.params.keyId;
    const result = await revokeAPIKey(
      { keyId },
      {
        user: (request as any).user,
        entities: context.entities,
      }
    );

    response.status(200).json(result);
  } catch (error) {
    handleOperationError(error, response);
  }
}
