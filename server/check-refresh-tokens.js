
require('dotenv').config();

const crypto = require('crypto');
const mongoose = require('mongoose');
const readline = require('readline/promises');
const { stdin, stdout } = require('process');
const RefreshToken = require('./models/refreshToken.model');

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

async function diagnoseRefreshToken() {
  const rl = readline.createInterface({ input: stdin, output: stdout });

  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log('Connected database:', mongoose.connection.name);
    console.log('Paste the latest refresh token from Postman below.');
    console.log('Your token will not be printed or sent anywhere.');

    const token = await rl.question('Refresh token: ');

    if (!token) {
      console.log('No token entered.');
      return;
    }

    const tokenHash = hashToken(token);

    const record = await RefreshToken.findOne({ tokenHash })
      .select('+tokenHash user expiresAt revokedAt createdAt')
      .lean();

    if (!record) {
      console.log('\nRESULT: TOKEN HASH NOT FOUND');
      console.log('The token entered does not match any stored record.');
      console.log('Check that you copied the latest refreshToken value,');
      console.log('not the accessToken, and that no spaces were included.');
      return;
    }

    console.log('\nRESULT: TOKEN HASH MATCHED');
    console.log({
      userId: String(record.user),
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      isExpired: record.expiresAt <= new Date(),
      isRevoked: Boolean(record.revokedAt),
    });
  } catch (error) {
    console.error('Diagnostic failed:', error.message);
    process.exitCode = 1;
  } finally {
    rl.close();
    await mongoose.disconnect();
  }
}

diagnoseRefreshToken();
