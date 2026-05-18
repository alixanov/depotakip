import { beforeAll, afterAll, afterEach } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import {
  SYSTEM_PERMISSIONS,
  SYSTEM_ROLE_NAMES,
  SYSTEM_ROLE_PERMISSIONS,
} from "@sadiyakargo/shared";
import { connect, disconnect, mongoose } from "../src/config/db.ts";
import { env } from "../src/config/env.ts";
import { Permission } from "../src/modules/access/permission.model.ts";
import { Role } from "../src/modules/access/role.model.ts";

let memoryServer: MongoMemoryReplSet;

/** Seeds system permissions + roles. Run once per `beforeAll` and re-run in
 *  `afterEach` because we wipe all collections between tests. */
async function seedRbac(): Promise<void> {
  await Permission.bulkWrite(
    SYSTEM_PERMISSIONS.map((p) => ({
      updateOne: {
        filter: { key: p.key },
        update: {
          $set: { label: p.label, group: p.group, description: "", isSystem: true },
          $setOnInsert: { key: p.key },
        },
        upsert: true,
      },
    }))
  );
  const orgId = new mongoose.Types.ObjectId(env.DEFAULT_ORG_ID);
  for (const name of SYSTEM_ROLE_NAMES) {
    await Role.updateOne(
      { orgId, name },
      {
        $set: {
          description: `System role — ${name}`,
          permissions: [...SYSTEM_ROLE_PERMISSIONS[name]],
          isSystem: true,
        },
        $setOnInsert: { orgId, name },
      },
      { upsert: true }
    );
  }
}

beforeAll(async () => {
  memoryServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await connect(memoryServer.getUri());
  await seedRbac();
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
  // System roles + permissions live across tests — they're seed data, not
  // per-test state — so re-create them after the wipe.
  await seedRbac();
});

afterAll(async () => {
  await disconnect();
  if (memoryServer) await memoryServer.stop();
});
