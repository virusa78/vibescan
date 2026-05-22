import { faker } from "@faker-js/faker";
import { ensureWorkspaceFoundationForUser, } from "../services/workspaceFoundation";
/**
 * Seed the database with mock users via the `wasp db seed` command.
 * For more info see: https://wasp.sh/docs/data-model/backends#seeding-the-database
 */
export async function seedMockUsers(prismaClient) {
    const workspaceDb = prismaClient;
    await Promise.all(generateMockUsersData(50).map(async (data) => {
        const user = await prismaClient.user.create({ data });
        await ensureWorkspaceFoundationForUser(workspaceDb, user.id);
    }));
}
function generateMockUsersData(numOfUsers) {
    return faker.helpers.multiple(generateMockUserData, { count: numOfUsers });
}
function generateMockUserData() {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    // Randomly assign plans
    const planOptions = ["free_trial", "starter", "pro", "enterprise"];
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
//# sourceMappingURL=dbSeeds.js.map