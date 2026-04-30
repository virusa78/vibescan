import { schemas } from './schemas';
import {
  getRepoRoot,
  getV1FallbackSwaggerGlobsAbsolute,
  getV1ManifestSwaggerSourceFilesAbsolute,
  type V1EndpointManifestEntry,
  v1EndpointManifest,
} from './v1EndpointManifest';

type OpenApiDocument = Record<string, any>;

interface SwaggerOptionsLike {
  definition: OpenApiDocument;
  apis: string[];
}

type SwaggerGenerator = (options: SwaggerOptionsLike) => OpenApiDocument;

const defaultSecurity = [
  { bearerAuth: [] },
  { apiKeyAuth: [] },
];

const errorSchemaRef = {
  $ref: '#/components/schemas/ErrorResponse',
};

const baseDefinition: OpenApiDocument = {
  openapi: '3.0.0',
  info: {
    title: 'VibeScan API',
    version: '1.0.0',
    description: 'Vulnerability scanning platform API - Submit scans, manage API keys, view reports',
    contact: {
      name: 'VibeScan Support',
      url: 'https://vibescan.app',
    },
  },
  servers: [
    {
      url: process.env.WASP_SERVER_URL || 'http://192.168.1.17:3555',
      description: 'Development server',
    },
    {
      url: 'https://app.vibescan.app',
      description: 'Production server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT Bearer token from /auth/login (15 min expiry)',
      },
      apiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'Authorization',
        description: 'API Key (format: vsk_...; legacy sk_live_... still accepted) generated from /api/v1/api-keys',
      },
    },
    schemas,
  },
  security: defaultSecurity,
  tags: [
    { name: 'Authentication', description: 'User authentication and authorization' },
    { name: 'API Keys', description: 'Manage API keys for programmatic access' },
    { name: 'Scans', description: 'Submit and manage vulnerability scans' },
    { name: 'Reports', description: 'Retrieve scan reports and results' },
    { name: 'Webhooks', description: 'Configure and manage webhooks' },
    { name: 'Dashboard', description: 'Dashboard analytics and metrics' },
    { name: 'Settings', description: 'Profile and notification settings' },
    { name: 'Billing', description: 'Billing and payment operations' },
  ],
};

function getApiErrorSchema() {
  return {
    type: 'object',
    properties: {
      error: { type: 'string', description: 'Stable machine-readable error code' },
      message: { type: 'string', description: 'Human-readable error message' },
      validation_errors: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
      details: {
        type: 'object',
        additionalProperties: true,
        description: 'Optional contextual details',
      },
    },
    required: ['error', 'message'],
  };
}

function toOperation(pathItem: Record<string, any>, method: string): Record<string, any> | undefined {
  const operation = (pathItem as Record<string, unknown>)[method];
  if (!operation || typeof operation !== 'object') {
    return undefined;
  }
  return operation as Record<string, any>;
}

function ensureV1OperationDefaults(spec: OpenApiDocument, entry: V1EndpointManifestEntry): void {
  const pathItem = spec.paths?.[entry.path] as Record<string, any> | undefined;
  if (!pathItem) {
    return;
  }

  const operation = toOperation(pathItem, entry.method);
  if (!operation) {
    return;
  }

  if (!operation.operationId) {
    operation.operationId = entry.operationId;
  }

  if (!operation.security || operation.security.length === 0) {
    operation.security = defaultSecurity;
  }

  if (entry.requiresRequestBody && !operation.requestBody) {
    operation.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            additionalProperties: true,
            description: 'Request body schema should be documented in endpoint swagger block.',
          },
        },
      },
    };
  }

  operation.responses = operation.responses ?? {};

  const responseCodes = Object.keys(operation.responses);
  const has2xx = responseCodes.some((code) => code.startsWith('2'));
  const has4xx = responseCodes.some((code) => code.startsWith('4'));
  const has5xx = responseCodes.some((code) => code.startsWith('5'));

  if (!has2xx) {
    operation.responses['200'] = {
      description: 'Successful response',
    };
  }

  if (!has4xx) {
    operation.responses['400'] = {
      description: 'Client error',
      content: {
        'application/json': {
          schema: errorSchemaRef,
        },
      },
    };
  }

  if (!has5xx) {
    operation.responses['500'] = {
      description: 'Server error',
      content: {
        'application/json': {
          schema: errorSchemaRef,
        },
      },
    };
  }

  for (const [code, response] of Object.entries(operation.responses)) {
    if (!/^[45]\d\d$/.test(code)) {
      continue;
    }

    if (!response || typeof response !== 'object' || '$ref' in response) {
      continue;
    }

    const target = response as Record<string, any>;
    const content = target.content ?? {};
    const appJson = content['application/json'];

    if (!appJson || !('schema' in appJson) || !appJson.schema) {
      content['application/json'] = { schema: errorSchemaRef };
      target.content = content;
      continue;
    }

    if ('$ref' in appJson.schema && appJson.schema.$ref === '#/components/schemas/ErrorResponse') {
      continue;
    }

    content['application/json'] = { schema: errorSchemaRef };
    target.content = content;
  }
}

function enrichV1Operations(spec: OpenApiDocument): OpenApiDocument {
  spec.paths = spec.paths ?? {};
  spec.components = spec.components ?? {};
  spec.components.schemas = spec.components.schemas ?? {};

  if (!spec.components.schemas.ErrorResponse) {
    spec.components.schemas.ErrorResponse = getApiErrorSchema();
  }

  for (const entry of v1EndpointManifest) {
    ensureV1OperationDefaults(spec, entry);
  }

  return spec;
}

function countV1Operations(spec: OpenApiDocument): number {
  const paths = spec.paths ?? {};
  let count = 0;

  for (const [pathName, pathItemRaw] of Object.entries(paths)) {
    if (!pathName.startsWith('/api/v1/')) {
      continue;
    }

    const pathItem = pathItemRaw as Record<string, any>;
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
      if (toOperation(pathItem, method)) {
        count += 1;
      }
    }
  }

  return count;
}

async function createSwaggerGenerator(): Promise<SwaggerGenerator> {
  const refParserModulePath = '@apidevtools/json-schema-ref-parser/lib/util/url.js';
  const refParserModule = (await import(refParserModulePath)) as any;
  const refParserUrl = refParserModule.default ?? refParserModule;

  if (!(refParserUrl as any).__vibescanResolvePatched) {
    const originalResolve = refParserUrl.resolve;
    refParserUrl.resolve = function patchedResolve(path1: string, path2?: string) {
      if (path2 == null) {
        return path1;
      }
      return originalResolve(path1, path2);
    };
    (refParserUrl as any).__vibescanResolvePatched = true;
  }

  const swaggerJsdocModule = await import('swagger-jsdoc');
  const swaggerJsdoc = (swaggerJsdocModule as any).default ?? (swaggerJsdocModule as any);
  return swaggerJsdoc as SwaggerGenerator;
}

function buildSwaggerOptions(apis: string[]): SwaggerOptionsLike {
  return {
    definition: structuredClone(baseDefinition),
    apis,
  };
}

export async function generateOpenApiSpec(options?: {
  generator?: SwaggerGenerator;
  primaryApis?: string[];
  fallbackApis?: string[];
}): Promise<OpenApiDocument> {
  const generator = options?.generator ?? (await createSwaggerGenerator());
  const primaryApis = options?.primaryApis ?? getV1ManifestSwaggerSourceFilesAbsolute();
  const fallbackApis = options?.fallbackApis ?? getV1FallbackSwaggerGlobsAbsolute();

  let spec = generator(buildSwaggerOptions(primaryApis));
  let source = 'manifest-primary';

  if (countV1Operations(spec) === 0) {
    spec = generator(buildSwaggerOptions(fallbackApis));
    source = 'absolute-fallback-glob';
  }

  if (countV1Operations(spec) === 0) {
    const diagnostics = [
      `OpenAPI generation failed: /api/v1 paths are empty after primary and fallback scan.`,
      `repoRoot=${getRepoRoot()}`,
      `primaryApis=${JSON.stringify(primaryApis)}`,
      `fallbackApis=${JSON.stringify(fallbackApis)}`,
    ].join('\n');
    throw new Error(diagnostics);
  }

  const enriched = enrichV1Operations(spec);
  (enriched as any).__generationSource = source;
  return enriched;
}

export function getOpenApiPrimaryApis(): string[] {
  return getV1ManifestSwaggerSourceFilesAbsolute();
}

export function getOpenApiFallbackApis(): string[] {
  return getV1FallbackSwaggerGlobsAbsolute();
}
