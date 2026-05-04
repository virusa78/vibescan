import type { Request } from 'express';
export type HandlerUser = {
    id: string;
};
export type HandlerContext = {
    user?: HandlerUser | null;
    entities: Record<string, unknown>;
};
export type HandlerRequest = Request & {
    user?: HandlerUser | null;
};
//# sourceMappingURL=handlerTypes.d.ts.map