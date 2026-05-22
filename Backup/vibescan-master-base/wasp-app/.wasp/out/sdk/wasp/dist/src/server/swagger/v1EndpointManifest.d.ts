export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';
export interface V1EndpointManifestEntry {
    method: HttpMethod;
    path: string;
    operationId: string;
    requiresRequestBody: boolean;
    sourceFile: string;
}
export declare const v1EndpointManifest: V1EndpointManifestEntry[];
export declare function getV1ManifestSwaggerSourceFilesAbsolute(): string[];
export declare function getV1FallbackSwaggerGlobsAbsolute(): string[];
export declare function getRepoRoot(): string;
//# sourceMappingURL=v1EndpointManifest.d.ts.map