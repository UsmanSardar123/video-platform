require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/user.model');

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.log('Usage: node scripts/promoteAdmin.js <user-email>');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas');

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    console.error('No user found with email:', email);
    process.exit(1);
  }

  user.role = 'admin';
  await user.save();
  console.log(Successfully updated user @ () to role: 'admin');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Failed to promote user:', err.message);
  process.exit(1);
});