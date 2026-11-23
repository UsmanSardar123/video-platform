const path = require('path');
const dotenv = require('dotenv');

// Load environment variables before importing app
dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = require('./app');
const { connectDB, disconnectDB } = require('./config/db.config');
const { validateEnv } = require('./config/env.config');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Validate environment configuration
    validateEnv();

    // Connect to database before accepting incoming connections
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });

    // Graceful shutdown handling
    const shutdown = (signal) => {
      console.log(`\nReceived ${signal}. Shutting down HTTP server gracefully...`);
      server.close(async () => {
        console.log('HTTP server closed.');
        try {
          await disconnectDB();
        } catch (err) {
          console.error(`Error disconnecting DB: ${err.message}`);
        }
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error(`FATAL: Server startup failed - ${error.message}`);
    process.exit(1);
  }
};

startServer();
