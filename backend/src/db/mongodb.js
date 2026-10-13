import { MongoClient } from 'mongodb';
import { config } from '../config.js';

let client;
let database;
let connectPromise;

function assertConfigured() {
  if (!config.mongodb.configured) {
    throw new Error('MONGODB_URI is not configured. Set it in backend/.env before connecting to MongoDB.');
  }
}

export async function resetMongoClient() {
  if (connectPromise) {
    try {
      await connectPromise;
    } catch {
      // Ignore in-flight connection failures while tearing the client down.
    }
  }

  if (client) {
    try {
      await client.close();
    } catch {
      // Ignore close failures during reset.
    }
  }

  client = undefined;
  database = undefined;
  connectPromise = undefined;
}

/**
 * Connects once and returns the configured MongoDB database.
 */
export async function connectMongo() {
  assertConfigured();

  if (database && client) return database;
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    let attempt = 0;
    let mongoClient;
    while (true) {
      try {
        mongoClient = new MongoClient(config.mongodb.uri, {
          serverSelectionTimeoutMS: 15000,
          connectTimeoutMS: 15000,
          socketTimeoutMS: 30000,
          maxPoolSize: 10,
          minPoolSize: 0,
          retryReads: true,
          retryWrites: false,
          appName: 'MediCoreLIS',
          tls: true,
        });

        await mongoClient.connect();
        const mongoDatabase = mongoClient.db(config.mongodb.database);
        await mongoDatabase.command({ ping: 1 });

        client = mongoClient;
        database = mongoDatabase;
        return mongoDatabase;
      } catch (error) {
        try {
          await mongoClient?.close?.();
        } catch {
          // Ignore close failures while retrying.
        }

        attempt += 1;
        if (attempt >= 5) {
          await resetMongoClient();
          throw error;
        }

        const delayMs = Math.min(1000 * attempt * 2, 5000);
        console.warn(`[mongo] connection attempt ${attempt} failed (${error.name}: ${error.message}). Retrying in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  })();

  try {
    return await connectPromise;
  } finally {
    connectPromise = undefined;
  }
}

/** Returns the active MongoDB database, connecting lazily when needed. */
export async function getMongoDatabase() {
  try {
    return await connectMongo();
  } catch (error) {
    const message = `${error?.message || ''}`;
    if (/ssl|tls|network|handshake|pool|econnreset|ECONNRESET/i.test(message)) {
      await resetMongoClient();
    }
    throw error;
  }
}

/** Closes the shared MongoDB client, if it has been opened. */
export async function closeMongo() {
  await resetMongoClient();
}

export function getMongoClient() {
  return client;
}
