import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, AuditEvent } from './models.js';

async function main() {
  const email = (process.argv[2] || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.argv[3] || process.env.ADMIN_PASSWORD || '';
  const displayName = process.argv[4] || 'System Administrator';

  if (!email || !email.includes('@')) {
    console.error('Usage: node src/seedAdmin.js <email> <password> [displayName]');
    console.error('Or set ADMIN_EMAIL and ADMIN_PASSWORD environment variables.');
    process.exit(1);
  }

  if (!password || password.length < 10) {
    console.error('Error: Administrator password must be at least 10 characters.');
    process.exit(1);
  }

  const mongoUri = (process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || process.env.MONGODB_URL || '').trim();
  if (!mongoUri) {
    console.error('Error: MONGODB_URI (or MONGO_URI/DATABASE_URL) environment variable is required to provision administrator.');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000, family: 4 });
    console.log('Connected to MongoDB database.');

    const passwordHash = await bcrypt.hash(password, 10);
    const existing = await User.findOne({ email });

    if (existing) {
      existing.role = 'admin';
      existing.status = 'active';
      existing.passwordHash = passwordHash;
      if (displayName) existing.displayName = displayName;
      await existing.save();
      console.log(`[Success] Existing user "${email}" elevated to Administrator.`);
    } else {
      const created = await User.create({
        email,
        passwordHash,
        displayName,
        role: 'admin',
        status: 'active'
      });
      console.log(`[Success] New Administrator account provisioned: "${created.email}" (ID: ${created._id})`);
    }

    await AuditEvent.create({
      actorId: existing?._id || new mongoose.Types.ObjectId(),
      action: 'admin_provisioned',
      resourceType: 'User',
      resourceId: email,
      result: 'success',
      reason: 'CLI administrator provisioning script'
    });

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error provisioning administrator:', err.message);
    process.exit(1);
  }
}

main();
