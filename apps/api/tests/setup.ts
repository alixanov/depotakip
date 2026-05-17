import { beforeAll, afterAll, afterEach } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { connect, disconnect, mongoose } from "../src/config/db.ts";

let memoryServer: MongoMemoryReplSet;

beforeAll(async () => {
  memoryServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await connect(memoryServer.getUri());
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await disconnect();
  if (memoryServer) await memoryServer.stop();
});
