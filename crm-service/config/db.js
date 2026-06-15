const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    let uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xeno_crm';

    // Auto-patch Railway MongoDB connection strings to avoid authentication errors
    if (uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://')) {
      try {
        const { URL } = require('url');
        const parsed = new URL(uri);
        // If there's no pathname (or it's just '/'), default to '/xeno_crm'
        if (!parsed.pathname || parsed.pathname === '/') {
          parsed.pathname = '/xeno_crm';
        }
        // If it's a Railway database and doesn't specify authSource, add it
        if (parsed.hostname.includes('rlwy.net') || parsed.hostname.includes('railway.internal')) {
          if (!parsed.searchParams.has('authSource')) {
            parsed.searchParams.set('authSource', 'admin');
          }
        }
        uri = parsed.toString();
      } catch (err) {
        console.warn('Failed to parse MONGODB_URI URL, using original value:', err.message);
      }
    }

    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
