import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

async function seedAdmin() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
  });

  const db = drizzle(pool);

  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@vex.local';

  try {
    console.log('🔍 Checking for existing admin user...');
    
    const existingAdmin = await db.select().from(users).where(eq(users.username, adminUsername)).limit(1);
    
    if (existingAdmin.length > 0) {
      console.log(`✅ Admin user '${adminUsername}' already exists (ID: ${existingAdmin[0].id})`);
      console.log('ℹ️  Skipping admin creation');
      await pool.end();
      process.exit(0);
    }

    console.log('📝 Creating admin user...');
    
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    const [newAdmin] = await db.insert(users).values({
      username: adminUsername,
      password: hashedPassword,
      email: adminEmail,
      role: 'admin',
      status: 'active',
      balance: '0',
      currency: 'USD',
      vipLevel: 10,
      isVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning({ id: users.id, username: users.username });

    console.log('');
    console.log('╔════════════════════════════════════════╗');
    console.log('║  ✅ Admin user created successfully!   ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('');
    console.log(`   Username: ${adminUsername}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   Email: ${adminEmail}`);
    console.log(`   ID: ${newAdmin.id}`);
    console.log('');
    console.log('⚠️  IMPORTANT: Change the password immediately after first login!');
    console.log('⚠️  مهم: غيّر كلمة المرور فوراً بعد الدخول الأول!');
    console.log('');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    await pool.end();
    process.exit(1);
  }
}

seedAdmin();
