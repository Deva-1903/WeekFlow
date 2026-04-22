import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { normalizePostgresUrlForPg } from "../lib/postgres-url";

const pool = new Pool({
  connectionString: normalizePostgresUrlForPg(process.env.DATABASE_URL),
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const EMAIL = process.env.REAL_USER_EMAIL ?? "devaanand@umass.edu";
const PASSWORD = process.env.REAL_USER_PASSWORD ?? "changeme123";

async function main() {
  console.log("🧹 Wiping all data...");

  await prisma.dailyBigRock.deleteMany();
  await prisma.weeklyPlanTask.deleteMany();
  await prisma.dailyPlan.deleteMany();
  await prisma.weeklyPlan.deleteMany();
  await prisma.timeBlock.deleteMany();
  await prisma.activityEvent.deleteMany();
  await prisma.healthLog.deleteMany();
  await prisma.task.deleteMany();
  await prisma.somedayItem.deleteMany();
  await prisma.recurringTaskTemplate.deleteMany();
  await prisma.recurringCommitmentTemplate.deleteMany();
  await prisma.externalEvent.deleteMany();
  await prisma.externalCalendar.deleteMany();
  await prisma.calendarConnection.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  console.log("✓ All data wiped");

  const hash = await bcrypt.hash(PASSWORD, 12);
  const user = await prisma.user.create({
    data: {
      email: EMAIL,
      name: "Dev",
      passwordHash: hash,
      weeklyCapacityMinutes: 2400,
      workingDaysPerWeek: 5,
      bigRockLimit: 3,
    },
  });

  console.log(`✅ Created user: ${user.email}`);
  console.log(`   Password: ${PASSWORD}`);
  console.log(`\n   Log in at http://localhost:3000`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
