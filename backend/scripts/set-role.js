#!/usr/bin/env node
/**
 * Grants or removes the admin role for an EXISTING account, directly in MongoDB.
 *
 *   npm run set-role -- --email you@example.com --role admin
 *   npm run set-role -- --email someone@example.com --role client
 *
 * This is the only way to create the first admin. It needs shell access to the
 * server and its database, so it can't be reached over HTTP. It never creates
 * accounts or touches passwords: sign up through the app first, then promote
 * that account here. After that, admins can manage roles in the Admin Portal.
 *
 * MONGO_URL overrides the database (default: the app's development database).
 */
const mongoose = require("mongoose");
const User = require("../models/User");

const DEFAULT_URL = "mongodb://localhost:27017/APImanagement";
const ROLES = ["client", "admin"];

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const [flag, inline] = argv[i].split("=", 2);
    if (flag === "--email" || flag === "--role") args[flag.slice(2)] = inline ?? argv[(i += 1)];
  }
  return args;
}

async function main() {
  require("dotenv").config({ quiet: true });
  const { email, role } = parseArgs(process.argv.slice(2));

  if (typeof email !== "string" || !email.includes("@") || !ROLES.includes(role)) {
    console.error("Usage: npm run set-role -- --email <existing account email> --role <admin|client>");
    process.exitCode = 2;
    return;
  }

  await mongoose.connect(process.env.MONGO_URL || DEFAULT_URL, { serverSelectionTimeoutMS: 5000 });
  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      console.error(`No account with that email. Sign up in the app first, then run this again.`);
      process.exitCode = 1;
      return;
    }

    if (user.role === role) {
      console.log(`No change: ${user.email} already has the "${role}" role.`);
      return;
    }

    if (user.role === "admin" && role !== "admin") {
      const otherAdmins = await User.countDocuments({ role: "admin", _id: { $ne: user._id } });
      if (otherAdmins === 0) {
        console.error("Refusing to remove the last admin. Promote another account first.");
        process.exitCode = 1;
        return;
      }
    }

    // updateOne, not save(): only the role changes and the password hook never runs.
    await User.updateOne({ _id: user._id }, { $set: { role } }, { runValidators: true });
    console.log(`Updated: ${user.email} now has the "${role}" role. It applies on their next request.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(`set-role failed: ${err.message}`);
  process.exitCode = 1;
});
