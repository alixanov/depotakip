import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "../lib/logger.js";

mongoose.set("strictQuery", true);

export async function connect(uri: string = env.MONGODB_URI): Promise<typeof mongoose> {
  await mongoose.connect(uri);
  logger.info({ uri: maskUri(uri) }, "MongoDB connected");
  return mongoose;
}

export async function disconnect(): Promise<void> {
  await mongoose.disconnect();
}

export { mongoose };

function maskUri(uri: string): string {
  return uri.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@");
}
