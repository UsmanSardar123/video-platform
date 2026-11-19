
require('dotenv').config({
  path: require('path').resolve(__dirname, '../.env'),
});

const mongoose = require('mongoose');
const readline = require('readline/promises');
const { stdin, stdout } = require('process');
const User = require('../models/user.model');

async function main() {
  const rl = readline.createInterface({ input: stdin, output: stdout });

  try {
    console.log('--- Streanub Admin Provisioning Tool ---');

    const username = (
      await rl.question('Admin Username (min 3 chars, a-z0-9_): ')
    ).trim().toLowerCase();

    const email = (
      await rl.question('Admin Email: ')
    ).trim().toLowerCase();

    const password = await rl.question('Admin Password (min 8 chars): ');

    if (
      !/^[a-z0-9_]{3,}$/.test(username) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 8
    ) {
      throw new Error(
        'Invalid input. Use a username with at least 3 characters (a-z, 0-9, _), a valid email, and a password of at least 8 characters.'
      );
    }

    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is missing from the server .env file.');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.');

    const existing = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existing) {
      const confirm = (
        await rl.question(
          `A user already exists with this email or username. Promote that account and reset its password? Type YES to confirm: `
        )
      ).trim();

      if (confirm !== 'YES') {
        console.log('Cancelled. Existing account was not changed.');
        return;
      }

      existing.role = 'admin';
      existing.password = password;
      await existing.save();

      console.log(
        `Updated existing user ${existing.email} to admin and reset its password.`
      );
    } else {
      await User.create({
        username,
        email,
        password,
        fullName: 'Platform Administrator',
        role: 'admin',
      });

      console.log(`Successfully created admin account ${email}.`);
    }
  } catch (error) {
    console.error('Admin provisioning failed:', error.message);
    process.exitCode = 1;
  } finally {
    rl.close();

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

main();
