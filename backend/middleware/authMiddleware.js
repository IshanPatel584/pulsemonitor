const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { loadAuthConfig } = require("../config/auth");

// currentuser runs on every request and sets req.user from the jwt cookie (or null).
// The guards below only read req.user and answer with JSON, the React app decides where to go.

const currentuser = (req, res, next) => {
  const config = loadAuthConfig();
  const token = req.cookies[config.cookieName];

  if (!token) {
    req.user = null;
    return next();
  }

  // Signature, expiry (`exp`), and algorithm are all checked; only HS256 is
  // accepted so tokens with `alg: none` or another algorithm are rejected.
  jwt.verify(token, config.secret, { algorithms: [config.algorithm] }, async (err, decodedtoken) => {
    if (err) {
      // Expired, tampered, or signed with another secret: drop the stale cookie.
      req.user = null;
      res.clearCookie(config.cookieName, config.cookie);
      return next();
    }

    try {
      const user = await User.findById(decodedtoken.id);
      req.user = user || null;
      next();
    } catch (err) {
      console.log(err);
      req.user = null;
      next();
    }
  });
};

const requiredAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Please log in to continue." });
  }
  next();
};

// Role check against the user loaded from the database on this request, so a
// demoted admin loses access immediately, whatever their token says.
// 401 when signed out, 403 when signed in without one of the roles.
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Please log in to continue." });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: "You don't have permission to access this resource." });
  }
  next();
};

module.exports = { requiredAuth, requireRole, currentuser };
