import type { HttpMethod } from './v1EndpointManifest';
export type OpenApiReferenceObject = {
    $ref: string;
};
export type OpenApiSchemaObject = {
    type?: string;
    description?: string;
    format?: string;
    properties?: Record<string, OpenApiSchema>;
    items?: OpenApiSchema;
    required?: string[];
    additionalProperties?: boolean | OpenApiSchema;
    enum?: string[];
    nullable?: boolean;
};
export type OpenApiSchema = OpenApiReferenceObject | OpenApiSchemaObject;
export type OpenApiMediaTypeObject = {
    schema?: OpenApiSchema;
};
export type OpenApiContentObject = Record<string, OpenApiMediaTypeObject>;
export type OpenApiResponseObject = {
    description?: string;
    content?: OpenApiContentObject;
};
export type OpenApiResponsesObject = Record<string, OpenApiResponseObject | OpenApiReferenceObject>;
export type OpenApiRequestBodyObject = {
    required?: boolean;
    content: OpenApiContentObject;
};
export type OpenApiSecurityRequirement = Record<string, string[]>;
export type OpenApiOperationObject = {
    operationId?: string;
    security?: OpenApiSecurityRequirement[];
    requestBody?: OpenApiRequestBodyObject | OpenApiReferenceObject;
    responses?: OpenApiResponsesObject;
};
export type OpenApiPathItemObject = Partial<Record<HttpMethod, OpenApiOperationObject | OpenApiReferenceObject>> & {
    [key: string]: unknown;
};
export type OpenApiDocument = {
    openapi?: string;
    info?: Record<string, unknown>;
    servers?: Array<{
        url: string;
        description?: string;
    }>;
    components?: {
        schemas?: Record<string, unknown>;
        securitySchemes?: Record<string, unknown>;
    };
    security?: OpenApiSecurityRequirement[];
    tags?: Array<{
        name: string;
        description?: string;
    }>;
    paths?: Record<string, OpenApiPathItemObject>;
    __generationSource?: string;
    [key: string]: unknown;
};
export declare function isReferenceObject(value: unknown): value is OpenApiReferenceObject;
export declare function getOperation(pathItem: OpenApiPathItemObject | undefined, method: HttpMethod): OpenApiOperationObject | undefined;
//# sourceMappingURL=openapiTypes.d.ts.map