import { type OpenApiDocument } from './openapiTypes';
interface SwaggerOptionsLike {
    definition: OpenApiDocument;
    apis: string[];
}
type SwaggerGenerator = (options: SwaggerOptionsLike) => OpenApiDocument;
export declare function generateOpenApiSpec(options?: {
    generator?: SwaggerGenerator;
    primaryApis?: string[];
    fallbackApis?: string[];
}): Promise<OpenApiDocument>;
export declare function getOpenApiPrimaryApis(): string[];
export declare function getOpenApiFallbackApis(): string[];
export {};
//# sourceMappingURL=openapiSpec.d.ts.map