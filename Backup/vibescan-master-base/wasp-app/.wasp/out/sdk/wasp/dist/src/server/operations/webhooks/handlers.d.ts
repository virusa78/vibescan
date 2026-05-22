import type { Response } from 'express';
import type { HandlerRequest } from '../../http/handlerTypes';
export declare function createWebhookApiHandler(request: HandlerRequest, response: Response, context: any): Promise<void>;
export declare function listWebhooksApiHandler(_request: HandlerRequest, response: Response, context: any): Promise<void>;
export declare function getWebhookApiHandler(request: HandlerRequest, response: Response, context: any): Promise<void>;
export declare function updateWebhookApiHandler(request: HandlerRequest, response: Response, context: any): Promise<void>;
export declare function deleteWebhookApiHandler(request: HandlerRequest, response: Response, context: any): Promise<void>;
export declare function listWebhookDeliveriesApiHandler(request: HandlerRequest, response: Response, context: any): Promise<void>;
export declare function testWebhookDeliveryApiHandler(request: HandlerRequest, response: Response, context: any): Promise<void>;
export declare function retryWebhookDeliveryApiHandler(request: HandlerRequest, response: Response, context: any): Promise<void>;
//# sourceMappingURL=handlers.d.ts.map