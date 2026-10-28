const mongoose = require("mongoose");
const { checkUrlTarget } = require("../monitoring/ssrf");

// Custom request header (API key, bearer token, ...). `value` is always the
// AES-256-GCM ciphertext from monitoring/credentials.js, never plain text.
const headerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    value: { type: String, required: true },
  },
  { _id: false },
);

const monitorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },

    name: {
      type: String,
      required: [true, "Please enter Name for API"],
      trim: true,
    },

    url: {
      type: String,
      required: [true, "Please enter URL for API"],
      trim: true,
      validate: [
        {
          validator: function (value) {
            try {
              const parsedUrl = new URL(value);
              return (
                parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:"
              );
            } catch {
              return false;
            }
          },
          message: "Please enter a valid HTTP or HTTPS URL",
        },
        {
          // Reject obvious SSRF targets up front; DNS-based checks happen again at check time.
          validator: (value) => checkUrlTarget(value) === null,
          message: (props) => checkUrlTarget(props.value) ?? "This URL cannot be monitored",
        },
      ],
    },
    method: {
      type: String,
      required: [true, "Please enter type of API"],
      enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      default: "GET",
      uppercase: true,
    },
    interval: {
      type: Number,
      required: [true, "Please enter after which time should we check"],
      min: 60,
      default: 60,
    },
    expectedStatusCode: {
      type: Number,
      required: [true, "Please enter type of status expected for API"],
      min: 100,
      max: 599,
      default: 200,
    },
    status : {
        type : String,
        enum : ['up' , 'down' , 'unknown'],
        default : 'unknown',
    },

    // Latest check, maintained by the monitoring engine (monitoring/scheduler.js).
    lastCheckedAt: {
      type: Date,
      default: null,
    },
    lastStatusCode: {
      type: Number,
      default: null,
    },
    lastResponseTime: {
      type: Number,
      default: null,
    },
    lastError: {
      type: String,
      default: null,
    },

    // Set only through the monitor controller, which validates and encrypts.
    headers: {
      type: [headerSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    // Responses show which headers are configured, never their values.
    toJSON: {
      transform: (_doc, ret) => {
        // Only when loaded: populated monitors (e.g. on incidents) keep their shape.
        if (ret.headers) ret.headers = ret.headers.map((h) => ({ name: h.name, configured: true }));
        return ret;
      },
    },
  },
);

const Monitor = mongoose.model("monitor", monitorSchema);
module.exports = Monitor;
