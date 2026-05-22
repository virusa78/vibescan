import type { User } from "wasp/entities";
type AuthContext = {
    user?: User | null;
};
type PublicUserSettings = {
    id: string;
    displayName: string | null;
    timezone: string | null;
    language: string | null;
    region: string;
};
export declare const getUserSettings: (_args: unknown, context: AuthContext) => Promise<PublicUserSettings | null>;
export declare const updateUserSettings: (rawArgs: unknown, context: AuthContext) => Promise<void>;
export {};
//# sourceMappingURL=settingsOperations.d.ts.map