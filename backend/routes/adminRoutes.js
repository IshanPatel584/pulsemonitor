const { Router } = require("express");
const admin = require("../controller/adminController");
const { requiredAuth, requireRole } = require("../middleware/authMiddleware");

const routes = Router();

// Guards every route below, including unknown /api/admin paths: signed-out
// requests get 401 and non-admins 403 before any handler or database query runs.
routes.use(requiredAuth, requireRole("admin"));

routes.get("/stats", admin.getStats);
routes.get("/analytics", admin.getAnalytics);

routes.get("/users", admin.listUsers);
routes.get("/users/:id", admin.getUser);
routes.patch("/users/:id/role", admin.updateUserRole);

routes.get("/monitors", admin.listMonitors);
routes.get("/monitors/:id", admin.getMonitor);

routes.get("/incidents", admin.listIncidents);

routes.get("/health", admin.getHealth);
routes.get("/settings", admin.getSettings);

module.exports = routes;
