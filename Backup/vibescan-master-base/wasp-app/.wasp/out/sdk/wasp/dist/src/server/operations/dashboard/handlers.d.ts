import type { Response } from 'express';
import type { HandlerRequest } from '../../http/handlerTypes';
export declare function getDashboardMetricsApiHandler(request: HandlerRequest, response: Response, context: any): Promise<void>;
export declare function getRecentScansApiHandler(request: HandlerRequest, response: Response, context: any): Promise<void>;
export declare function getSeverityBreakdownApiHandler(request: HandlerRequest, response: Response, context: any): Promise<void>;
export declare function getQuotaStatusApiHandler(request: HandlerRequest, response: Response, context: any): Promise<void>;
export declare function getTrendSeriesApiHandler(request: HandlerRequest, response: Response, context: any): Promise<void>;
export declare function listScanSavedViewsApiHandler(request: HandlerRequest, response: Response, context: any): Promise<void>;
export declare function createScanSavedViewApiHandler(request: HandlerRequest, response: Response, context: any): Promise<void>;
export declare function updateScanSavedViewApiHandler(request: HandlerRequest, response: Response, context: any): Promise<void>;
export declare function deleteScanSavedViewApiHandler(request: HandlerRequest, response: Response, context: any): Promise<void>;
export declare function bulkCancelScansApiHandler(request: HandlerRequest, response: Response, context: any): Promise<void>;
export declare function bulkRerunScansApiHandler(request: HandlerRequest, response: Response, context: any): Promise<void>;
export declare function exportScansApiHandler(request: HandlerRequest, response: Response, context: any): Promise<void>;
//# sourceMappingURL=handlers.d.ts.map