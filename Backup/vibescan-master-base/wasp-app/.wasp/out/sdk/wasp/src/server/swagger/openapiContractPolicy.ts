import type { HttpMethod } from './v1EndpointManifest';
import { v1EndpointManifest } from './v1EndpointManifest';
import {
  getOperation,
  isReferenceObject,
  type OpenApiDocument,
  type OpenApiPathItemObject,
  type OpenApiResponseObject,
  type OpenApiResponsesObject,
} from './openapiTypes';

const HTTP_METHODS: HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete'];
const pathTokenRegex = /:([A-Za-z0-9_]+)/g;

export interface RouteSignature {
  method: HttpMethod;
  path: string;
}

export interface ContractViolation {
  code:
    | 'route_missing_in_spec'
    | 'route_extra_in_spec'
    | 'route_missing_in_manifest'
    | 'operation_id_missing'
    | 'security_missing'
    | 'request_body_missing'
    | 'responses_2xx_missing'
    | 'responses_4xx_missing'
    | 'responses_5xx_missing'
    | 'error_schema_missing';
  route: string;
  detail: string;
}

export interface ContractValidationReport {
  ok: boolean;
  routeCountMainWasp: number;
  routeCountSpec: number;
  violations: ContractViolation[];
}

export function normalizeWaspRoutePath(path: string): string {
  return path.replace(pathTokenRegex, '{$1}');
}

export function parseV1RoutesFromMainWasp(mainWaspSource: string): RouteSignature[] {
  const matches = mainWaspSource.matchAll(/httpRoute:\s*\((GET|POST|PUT|PATCH|DELETE),\s*"([^"]+)"\)/g);
  const routes: RouteSignature[] = [];

  for (const match of matches) {
    const method = match[1].toLowerCase() as HttpMethod;
    const routePath = match[2];
    if (!routePath.startsWith('/api/v1/')) {
      continue;
    }
    routes.push({ method, path: normalizeWaspRoutePath(routePath) });
  }

  return routes;
}

function routeKey(route: RouteSignature): string {
  return `${route.method.toUpperCase()} ${route.path}`;
}

function getSpecV1Routes(spec: OpenApiDocument): RouteSignature[] {
  const routes: RouteSignature[] = [];
  const paths = spec.paths ?? {};

  for (const [pathName, pathItemRaw] of Object.entries(paths)) {
    if (!pathName.startsWith('/api/v1/')) {
      continue;
    }

    const pathItem = pathItemRaw as OpenApiPathItemObject;
    for (const method of HTTP_METHODS) {
      const maybeOperation = getOperation(pathItem, method);
      if (maybeOperation) {
        routes.push({ method, path: pathName });
      }
    }
  }

  return routes;
}

function hasHttpClassResponse(responses: OpenApiResponsesObject | undefined, clazz: '2' | '4' | '5'): boolean {
  if (!responses) {
    return false;
  }
  return Object.keys(responses).some((code) => code.startsWith(clazz));
}

function hasErrorSchemaRef(response: OpenApiResponseObject | undefined): boolean {
  if (!response) {
    return false;
  }

  const appJson = response.content?.['application/json'];
  if (!appJson?.schema) {
    return false;
  }

  if (isReferenceObject(appJson.schema)) {
    return appJson.schema.$ref === '#/components/schemas/ErrorResponse';
  }

  return false;
}

export function validateV1OpenApiContract(input: {
  mainWaspSource: string;
  spec: OpenApiDocument;
}): ContractValidationReport {
  const violations: ContractViolation[] = [];
  const mainRoutes = parseV1RoutesFromMainWasp(input.mainWaspSource);
  const specRoutes = getSpecV1Routes(input.spec);
  const expectedRoutes = [
    ...mainRoutes,
    ...v1EndpointManifest.map((entry) => ({ method: entry.method, path: entry.path })),
  ].filter((route, index, allRoutes) => {
    const key = routeKey(route);
    return allRoutes.findIndex((candidate) => routeKey(candidate) === key) === index;
  });

  const mainRouteKeySet = new Set(mainRoutes.map(routeKey));
  const expectedRouteKeySet = new Set(expectedRoutes.map(routeKey));
  const specRouteKeySet = new Set(specRoutes.map(routeKey));
  const manifestMap = new Map(v1EndpointManifest.map((entry) => [`${entry.method.toUpperCase()} ${entry.path}`, entry]));

  for (const route of expectedRoutes) {
    const key = routeKey(route);
    if (!specRouteKeySet.has(key)) {
      violations.push({
        code: 'route_missing_in_spec',
        route: key,
        detail: 'Route is present in the declared v1 surface but missing in OpenAPI spec.',
      });
    }
    if (mainRouteKeySet.has(key) && !manifestMap.has(key)) {
      violations.push({
        code: 'route_missing_in_manifest',
        route: key,
        detail: 'Route is present in main.wasp but missing in /api/v1 endpoint manifest.',
      });
    }
  }

  for (const route of specRoutes) {
    const key = routeKey(route);
    if (!expectedRouteKeySet.has(key)) {
      violations.push({
        code: 'route_extra_in_spec',
        route: key,
        detail: 'Route is present in OpenAPI spec but not declared in main.wasp or the /api/v1 manifest.',
      });
    }
  }

  for (const route of expectedRoutes) {
    const key = routeKey(route);
    const pathItem = input.spec.paths?.[route.path];
    const operation = getOperation(pathItem, route.method);
    const manifestEntry = manifestMap.get(key);

    if (!operation) {
      continue;
    }

    if (!operation.operationId || operation.operationId.trim().length === 0) {
      violations.push({
        code: 'operation_id_missing',
        route: key,
        detail: 'operationId is required for /api/v1 operations.',
      });
    }

    if (!operation.security || operation.security.length === 0) {
      violations.push({
        code: 'security_missing',
        route: key,
        detail: 'security is required for /api/v1 operations.',
      });
    }

    if (manifestEntry?.requiresRequestBody && !operation.requestBody) {
      violations.push({
        code: 'request_body_missing',
        route: key,
        detail: 'requestBody is required by manifest policy for this operation.',
      });
    }

    if (!hasHttpClassResponse(operation.responses, '2')) {
      violations.push({
        code: 'responses_2xx_missing',
        route: key,
        detail: 'At least one 2xx response is required.',
      });
    }

    if (!hasHttpClassResponse(operation.responses, '4')) {
      violations.push({
        code: 'responses_4xx_missing',
        route: key,
        detail: 'At least one 4xx response is required.',
      });
    }

    if (!hasHttpClassResponse(operation.responses, '5')) {
      violations.push({
        code: 'responses_5xx_missing',
        route: key,
        detail: 'At least one 5xx response is required.',
      });
    }

    const has4xxErrorRef = Object.entries(operation.responses ?? {}).some(([code, response]) => {
      if (!code.startsWith('4') || isReferenceObject(response)) {
        return false;
      }
      return hasErrorSchemaRef(response);
    });
    const has5xxErrorRef = Object.entries(operation.responses ?? {}).some(([code, response]) => {
      if (!code.startsWith('5') || isReferenceObject(response)) {
        return false;
      }
      return hasErrorSchemaRef(response);
    });

    if (!has4xxErrorRef || !has5xxErrorRef) {
      violations.push({
        code: 'error_schema_missing',
        route: key,
        detail: '4xx and 5xx responses must reference #/components/schemas/ErrorResponse.',
      });
    }
  }

  return {
    ok: violations.length === 0,
    routeCountMainWasp: mainRoutes.length,
    routeCountSpec: specRoutes.length,
    violations,
  };
}
