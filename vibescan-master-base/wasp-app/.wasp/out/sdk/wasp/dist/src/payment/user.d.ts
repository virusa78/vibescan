import { User } from "wasp/entities";
import { PrismaClient } from "wasp/server";
import { SubscriptionStatus } from "./plans";
export declare function fetchUserStripeCustomerId(userId: User["id"], prismaUserDelegate: PrismaClient["user"]): Promise<string | null>;
export declare function fetchUserPaymentProcessorUserId(userId: User["id"], prismaUserDelegate: PrismaClient["user"]): Promise<string | null>;
interface UpdateUserStripeCustomerIdArgs {
    userId: User["id"];
    stripeCustomerId: string;
}
export declare function updateUserStripeCustomerId({ userId, stripeCustomerId }: UpdateUserStripeCustomerIdArgs, prismaUserDelegate: PrismaClient["user"]): Promise<void>;
export declare function updateUserPaymentProcessorUserId({ userId, paymentProcessorUserId }: {
    userId: User["id"];
    paymentProcessorUserId: string;
}, prismaUserDelegate: PrismaClient["user"]): Promise<void>;
interface UpdateUserSubscriptionArgs {
    stripeCustomerId: string;
    subscriptionStatus: SubscriptionStatus;
    plan?: string;
}
export declare function updateUserSubscription({ stripeCustomerId, plan, subscriptionStatus }: UpdateUserSubscriptionArgs, userDelegate: PrismaClient["user"]): Promise<void>;
export {};
//# sourceMappingURL=user.d.ts.map