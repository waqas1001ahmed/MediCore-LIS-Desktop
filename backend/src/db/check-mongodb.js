import { closeMongo, getMongoDatabase } from './mongodb.js';

try {
  const database = await getMongoDatabase();
  await database.command({ ping: 1 });
  console.log(`MongoDB connection successful: ${database.databaseName}`);
} catch (error) {
  console.error(`MongoDB connection failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await closeMongo();
}