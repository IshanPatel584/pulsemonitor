const express = require("express");
const mongoose = require("mongoose");
const cookie = require("cookie-parser");
const routes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const { currentuser } = require("./middleware/authMiddleware");
const { startScheduler } = require("./monitoring/scheduler");
const { loadAuthConfig } = require("./config/auth");
const { loadCredentialsKey } = require("./monitoring/credentials");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookie());

app.use(currentuser);

// Every /api/admin route requires a signed-in admin (see routes/adminRoutes.js).
app.use("/api/admin", adminRoutes);
app.use("/api", routes);

app.use("/api", (req, res) => {
    res.status(404).json({ error: "Not found" });
});

// Only connect, listen, and start the scheduler when run directly
// (`node app.js` / nodemon). Tests import `app` without touching the real database.
if (require.main === module) {
    // Values already in the environment win over backend/.env.
    require("dotenv").config({ quiet: true });

    // Refuse to start without a valid JWT secret; there is no fallback.
    try {
        loadAuthConfig();
        if (!loadCredentialsKey()) {
            console.warn("[config] MONITOR_CREDENTIALS_KEY is not set: custom monitor headers are disabled.");
        }
    } catch (err) {
        console.error(`[config] ${err.message}`);
        process.exit(1);
    }

    mongoose.connect("mongodb://localhost:27017/APImanagement")
    .then(() => {
        console.log("MongoDB connected");
        app.listen(5000, () => {
            console.log("listening to 5000");
            // Monitoring engine: checks saved monitors on their intervals.
            startScheduler();
        });
    })
    .catch((err) => {
        console.log(err);
    });
}

module.exports = app;
