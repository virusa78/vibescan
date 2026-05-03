import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_USERS = [
  {
    email: 'arjun.mehta@finstack.io',
    password: 'vs_demo_pro_2026',
    username: 'Arjun Mehta',
    displayName: 'Arjun Mehta',
    plan: 'pro'
  },
  {
    email: 'priya.sharma@devcraft.in',
    password: 'vs_demo_starter_2026',
    username: 'Priya Sharma',
    displayName: 'Priya Sharma',
    plan: 'starter'
  },
  {
    email: 'rafael.torres@securecorp.com',
    password: 'vs_demo_ent_2026',
    username: 'Rafael Torres',
    displayName: 'Rafael Torres',
    plan: 'enterprise'
  }
];

async function main() {
  console.log('🌱 Seeding demo users...\n');

  for (const user of DEMO_USERS) {
    try {
      const passwordHash = await bcrypt.hash(user.password, 10);
      
      // Use raw SQL to bypass Prisma schema mismatch
      const result = await prisma.$executeRawUnsafe(
        `INSERT INTO "User" (id, email, username, "displayName", "passwordHash", plan, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (email) DO NOTHING`,
        user.email,
        user.username,
        user.displayName,
        passwordHash,
        user.plan
      );

      if (result === 0) {
        console.log(`⚠️  ${user.email} - already exists`);
      } else {
        console.log(`✅ ${user.email} (${user.plan})`);
        console.log(`   Password: ${user.password}`);
      }

    } catch (e) {
      console.log(`❌ ${user.email}: ${e.message}`);
    }
  }

  console.log('\n✅ Done!');
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
