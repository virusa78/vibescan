/**
 * Seed demo users with Wasp auth structure
 * 
 * Creates Auth and AuthIdentity records required by Wasp v0.23
 */

import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

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
  console.log('🌱 Setting up Wasp auth for demo users...\n');

  for (const user of DEMO_USERS) {
    try {
      // Find existing user
      const existingUser = await prisma.user.findUnique({
        where: { email: user.email }
      });

      if (!existingUser) {
        console.log(`⚠️  ${user.email} - user not found in users table`);
        continue;
      }

      // Check if Auth already exists
      const existingAuth = await prisma.auth.findUnique({
        where: { userId: existingUser.id }
      });

      if (existingAuth) {
        console.log(`⚠️  ${user.email} - auth already configured`);
        continue;
      }

      // Create Auth record
      const authId = randomUUID();
      await prisma.auth.create({
        data: {
          id: authId,
          userId: existingUser.id
        }
      });

      // Hash password
      const passwordHash = await bcrypt.hash(user.password, 10);

      // Create AuthIdentity record for email provider
      await prisma.authIdentity.create({
        data: {
          providerName: 'email',
          providerUserId: user.email,
          providerData: JSON.stringify({
            password: passwordHash
          }),
          authId: authId
        }
      });

      console.log(`✅ ${user.email} (${user.plan})`);
      console.log(`   Password: ${user.password}`);

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
