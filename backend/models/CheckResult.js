const mongoose = require("mongoose");

// How long individual check results are kept before MongoDB's TTL monitor deletes them.
const RETENTION_DAYS = Number(process.env.CHECK_RETENTION_DAYS) || 30;

// One document per check the scheduler runs. Written only by the monitoring engine.
const checkResultSchema = new mongoose.Schema(
  {
    monitorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "monitor",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    checkedAt: {
      type: Date,
      required: true,
    },
    // null when no HTTP response was received (timeout, DNS failure, blocked, ...)
    statusCode: {
      type: Number,
      default: null,
    },
    // milliseconds until response headers; null when no response was received
    responseTime: {
      type: Number,
      default: null,
    },
    success: {
      type: Boolean,
      required: true,
    },
    error: {
      type: String,
      default: null,
    },
  },
  { versionKey: false },
);

checkResultSchema.index({ monitorId: 1, checkedAt: -1 });
checkResultSchema.index({ checkedAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });

const CheckResult = mongoose.model("checkResult", checkResultSchema);
module.exports = CheckResult;
