const mongoose = require("mongoose");

// Tests always use a freshly named database on the local MongoDB server (or
// TEST_MONGO_URL), never the development database `APImanagement`.
const BASE_URL = (process.env.TEST_MONGO_URL || "mongodb://127.0.0.1:27017").replace(/\/+$/, "");
const DEV_DB_NAME = "APImanagement";

function assertTestDatabase(name) {
  if (!/_test(_|$)/.test(name) || name.toLowerCase() === DEV_DB_NAME.toLowerCase()) {
    throw new Error(`Refusing to use database "${name}": test database names must contain "_test".`);
  }
}

/** Connects mongoose to a new, uniquely named test database and builds model indexes. */
async function connectTestDb() {
  const name = `pulsemonitor_test_${process.pid}_${Date.now()}`;
  assertTestDatabase(name);
  await mongoose.connect(`${BASE_URL}/${name}`, {
    serverSelectionTimeoutMS: 5000,
    // MongoDB driver 7 loads `os` with a dynamic import(), which fails inside Jest's
    // CommonJS sandbox and leaves the handshake metadata empty (the server then
    // rejects it with "Missing required sub-document 'driver'"). Supplying the
    // module directly avoids the dynamic import. Test-only; the app is unaffected.
    runtimeAdapters: { os: require("node:os") },
  });

  // Unique (email) and TTL indexes must exist before tests rely on them.
  require("../../models/User");
  require("../../models/Monitor");
  require("../../models/CheckResult");
  require("../../models/Incident");
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  return name;
}

/** Removes every document created by the previous test (test database only). */
async function clearTestDb() {
  assertTestDatabase(mongoose.connection.name);
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

/** Drops the test database this file created, then disconnects. */
async function closeTestDb() {
  if (mongoose.connection.readyState === 1) {
    assertTestDatabase(mongoose.connection.name);
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
}

module.exports = { connectTestDb, clearTestDb, closeTestDb };
