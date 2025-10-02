// MongoDB Initialization Script
// This script creates an application user with proper permissions

// Get environment variables (passed by Docker)
const dbName = process.env.MONGO_INITDB_DATABASE;
const appUsername = process.env.MONGO_USERNAME;
const appPassword = process.env.MONGO_PASSWORD;

// Switch to the application database
db = db.getSiblingDB(dbName);

// Create application user with read/write permissions
db.createUser({
  user: appUsername,
  pwd: appPassword,
  roles: [
    {
      role: 'readWrite',
      db: dbName
    },
    {
      role: 'dbAdmin',
      db: dbName
    }
  ]
});

print('MongoDB initialization completed successfully');
print('Created user: ' + appUsername + ' with readWrite and dbAdmin roles on ' + dbName + ' database');
