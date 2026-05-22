import type { Response } from 'express';
import type { HandlerRequest } from '../../http/handlerTypes';
export declare function getReportApiHandler(request: HandlerRequest, response: Response, context: any): Promise<void>;
export declare function getReportSummaryApiHandler(request: HandlerRequest, response: Response, context: any): Promise<void>;
export declare function generateReportPDFApiHandler(request: HandlerRequest, response: Response, context: any): Promise<void>;
export declare function getCIDecisionApiHandler(request: HandlerRequest, response: Response, context: any): Promise<void>;
export declare function upsertFindingAnnotationApiHandler(request: HandlerRequest, response: Response, context: any): Promise<void>;
export declare function listFindingAnnotationsApiHandler(request: HandlerRequest, response: Response, context: any): Promise<void>;
//# sourceMappingURL=handlers.d.ts.map