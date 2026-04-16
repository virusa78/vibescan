import { faker } from "@faker-js/faker";
import type { PrismaClient } from "@prisma/client";
import { PlanTier } from "@prisma/client";
import {
  SubscriptionStatus,
} from "../../payment/plans";

type MockUserData = {
  email: string;
  username: string;
  passwordHash?: string | null;
  displayName?: string;
  isAdmin: boolean;
  plan: PlanTier;
  stripeCustomerId?: string | null;
  subscriptionStatus?: string | null;
  monthlyQuotaLimit: number;
  monthlyQuotaUsed: number;
  region: string;
  timezone?: string | null;
  language: string;
};

/**
 * Seed the database with mock users via the `wasp db seed` command.
 * For more info see: https://wasp.sh/docs/data-model/backends#seeding-the-database
 */
export async function seedMockUsers(prismaClient: PrismaClient) {
  await Promise.all(
    generateMockUsersData(50).map((data) => prismaClient.user.create({ data })),
  );
}

function generateMockUsersData(numOfUsers: number): MockUserData[] {
  return faker.helpers.multiple(generateMockUserData, { count: numOfUsers });
}

function generateMockUserData(): MockUserData {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  
  // Randomly assign plans
  const planOptions: PlanTier[] = ["free_trial", "starter", "pro", "enterprise"];
  const plan = faker.helpers.arrayElement(planOptions);
  
  const subscriptionStatus = plan === "free_trial" ? null : "active";
  const hasCustomer = plan !== "free_trial";
  
  return {
    email: faker.internet.email({ firstName, lastName }),
    username: faker.internet.userName({ firstName, lastName }),
    displayName: `${firstName} ${lastName}`,
    isAdmin: faker.datatype.boolean({ probability: 0.1 }),
    plan,
    stripeCustomerId: hasCustomer
      ? `cus_test_${faker.string.uuid()}`
      : null,
    subscriptionStatus,
    monthlyQuotaLimit: plan === "enterprise" ? 1000 : plan === "pro" ? 100 : 10,
    monthlyQuotaUsed: faker.number.int({ min: 0, max: 50 }),
    region: faker.helpers.arrayElement(["IN", "PK", "OTHER"]),
    timezone: faker.location.timeZone(),
    language: faker.helpers.arrayElement(["en", "ru"]),
  };
}
