import type { HttpMethod } from './v1EndpointManifest';
import { type OpenApiDocument } from './openapiTypes';
export interface RouteSignature {
    method: HttpMethod;
    path: string;
}
export interface ContractViolation {
    code: 'route_missing_in_spec' | 'route_extra_in_spec' | 'route_missing_in_manifest' | 'operation_id_missing' | 'security_missing' | 'request_body_missing' | 'responses_2xx_missing' | 'responses_4xx_missing' | 'responses_5xx_missing' | 'error_schema_missing';
    route: string;
    detail: string;
}
export interface ContractValidationReport {
    ok: boolean;
    routeCountMainWasp: number;
    routeCountSpec: number;
    violations: ContractViolation[];
}
export declare function normalizeWaspRoutePath(path: string): string;
export declare function parseV1RoutesFromMainWasp(mainWaspSource: string): RouteSignature[];
export declare function validateV1OpenApiContract(input: {
    mainWaspSource: string;
    spec: OpenApiDocument;
}): ContractValidationReport;
//# sourceMappingURL=openapiContractPolicy.d.ts.map