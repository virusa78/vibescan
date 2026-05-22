import { schemas } from './schemas';
import { getBackendBaseUrl } from '../config/runtime.js';
import {
  getRepoRoot,
  getV1FallbackSwaggerGlobsAbsolute,
  getV1ManifestSwaggerSourceFilesAbsolute,
  type V1EndpointManifestEntry,
  type HttpMethod,
  v1EndpointManifest,
} from './v1EndpointManifest';
import {
  getOperation,
  isReferenceObject,
  type OpenApiContentObject,
  type OpenApiDocument,
  type OpenApiPathItemObject,
  type OpenApiReferenceObject,
  type OpenApiResponseObject,
  type OpenApiSecurityRequirement,
} from './openapiTypes';

interface SwaggerOptionsLike {
  definition: OpenApiDocument;
  apis: string[];
}

type SwaggerGenerator = (options: SwaggerOptionsLike) => OpenApiDocument;

const defaultSecurity: OpenApiSecurityRequirement[] = [
  { bearerAuth: [] },
  { apiKeyAuth: [] },
];

const errorSchemaRef = {
  $ref: '#/components/schemas/ErrorResponse',
} satisfies OpenApiReferenceObject;

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
      url: getBackendBaseUrl(),
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

const HTTP_METHODS: HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete'];

function ensureJsonErrorSchema(target: OpenApiResponseObject): void {
  const content: OpenApiContentObject = target.content ?? {};
  const appJson = content['application/json'];

  if (!appJson?.schema || (isReferenceObject(appJson.schema) && appJson.schema.$ref === errorSchemaRef.$ref)) {
    content['application/json'] = { schema: errorSchemaRef };
    target.content = content;
    return;
  }

  content['application/json'] = { schema: errorSchemaRef };
  target.content = content;
}

function ensureV1OperationDefaults(spec: OpenApiDocument, entry: V1EndpointManifestEntry): void {
  const pathItem = spec.paths?.[entry.path];
  if (!pathItem) {
    return;
  }

  const operation = getOperation(pathItem, entry.method);
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

    if (!response || typeof response !== 'object' || isReferenceObject(response)) {
      continue;
    }

    ensureJsonErrorSchema(response);
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

    const pathItem = pathItemRaw as OpenApiPathItemObject;
    for (const method of HTTP_METHODS) {
      if (getOperation(pathItem, method)) {
        count += 1;
      }
    }
  }

  return count;
}

async function createSwaggerGenerator(): Promise<SwaggerGenerator> {
  const refParserModulePath = '@apidevtools/json-schema-ref-parser/lib/util/url.js';
  const refParserModule = await import(refParserModulePath) as {
    default?: {
      resolve(path1: string, path2?: string): string;
      __vibescanResolvePatched?: boolean;
    };
    resolve?: (path1: string, path2?: string) => string;
    __vibescanResolvePatched?: boolean;
  };
  const refParserUrl = refParserModule.default ?? refParserModule;

  if (!refParserUrl.__vibescanResolvePatched) {
    try {
      const originalResolve = refParserUrl.resolve;
      refParserUrl.resolve = function patchedResolve(path1: string, path2?: string) {
        if (path2 == null) {
          return path1;
        }
        return originalResolve?.(path1, path2) || path1;
      };
      refParserUrl.__vibescanResolvePatched = true;
    } catch {
      // Newer module shapes can expose readonly namespace exports.
      // In that case we keep the original resolver untouched and continue.
    }
  }

  const swaggerJsdocModule = await import('swagger-jsdoc');
  const swaggerJsdocExports = swaggerJsdocModule as unknown as {
    default?: SwaggerGenerator;
  };
  const swaggerJsdoc = swaggerJsdocExports.default ?? (swaggerJsdocModule as unknown as SwaggerGenerator);
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
  enriched.__generationSource = source;
  return enriched;
}

export function getOpenApiPrimaryApis(): string[] {
  return getV1ManifestSwaggerSourceFilesAbsolute();
}

export function getOpenApiFallbackApis(): string[] {
  return getV1FallbackSwaggerGlobsAbsolute();
}
