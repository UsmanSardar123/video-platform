require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/user.model');
const Video = require('../models/video.model');

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing from the server environment');
  await mongoose.connect(process.env.MONGODB_URI);

  // Existing video ownership is the only basis for assigning creator; no user or video is removed.
  const creatorIds = await Video.distinct('creator');
  const result = creatorIds.length
    ? await User.updateMany({ _id: { $in: creatorIds }, role: 'user' }, { $set: { role: 'creator' } })
    : { modifiedCount: 0 };
  console.log(`Creator role migration complete: ${result.modifiedCount ?? result.nModified ?? 0} existing owners updated.`);
}

main()
  .catch((error) => {
    console.error('Creator role migration failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
