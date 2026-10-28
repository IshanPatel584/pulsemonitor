const User = require('../models/User');
const jwt = require("jsonwebtoken");
const { loadAuthConfig } = require("../config/auth");


const handelError = (err) => {
  let errors = { email: "", password: "" };

  if (err.message === "Incorrect Email") {
    errors.email = "this email is not register";
  }
  if (err.message === "Incorrect Password") {
    errors.password = "this password is incorrect";
  }

  if (err.code === 11000) {
    errors.email = "this email already exist";
    return errors;
  }

  if (err.message.includes("user validation failed")) {
    // CastErrors (e.g. a non-string username) have no `properties`, so key by path and fall back to their message.
    Object.entries(err.errors).forEach(([path, error]) => {
      errors[path] = error.properties?.message ?? error.message;
    });
  }

  return errors;
};

const createtoken = (id, config) => {
  return jwt.sign({ id }, config.secret, { algorithm: config.algorithm, expiresIn: config.ttlSeconds });
};

// Issue the session cookie; its lifetime matches the token's expiry.
const setSessionCookie = (res, userId) => {
  const config = loadAuthConfig();
  res.cookie(config.cookieName, createtoken(userId, config), { ...config.cookie, maxAge: config.cookieMaxAgeMs });
};

module.exports.signup_post = async(req,res) =>{
    const username = req.body.username;
    const email = req.body.email;
    const password = req.body.password;

    try{
        const user = await User.create({username , email , password});
        setSessionCookie(res, user._id);
        res.status(200).json({user: user._id});
    }catch(err){
        const handelerror = handelError(err);
        res.status(400).json({ errors: handelerror });
    }
};

module.exports.login_post = async (req, res) => {
  const { email, password } = req.body;

  // Only plain strings may reach the query: an object like { "$ne": null } would
  // otherwise be treated as a MongoDB operator and match an arbitrary user.
  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ errors: { email: "Please enter your Email", password: "Please enter your Password" } });
  }

  try {
    const user = await User.login(email, password);
    setSessionCookie(res, user._id);
    res.status(200).json({ user: user._id});
  } catch (err) {
    const handelerror = handelError(err);
    res.status(400).json({ errors: handelerror });
  }
};

module.exports.logout_post = (req, res) => {
  const config = loadAuthConfig();
  // Same name, path, and flags as when it was set, or the browser keeps the original.
  res.clearCookie(config.cookieName, config.cookie);
  res.json({ success: true });
};


// The signed-in user's own profile, so the frontend can show the real name and
// decide whether to offer the Admin Portal. Never includes the password hash.
module.exports.me_get = (req, res) => {
  const { _id, username, email, role } = req.user;
  res.status(200).json({ user: { id: _id, username, email, role } });
};
