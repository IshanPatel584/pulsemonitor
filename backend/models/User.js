const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, "Please enter your Username"],
  },
  email: {
    type: String,
    required: [true, "Please enter your Email"],
    trim: true,
    lowercase: true,
    unique: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please enter a valid Email"],
  },
  password: {
    type: String,
    required: [true, "Please enter your Password"],
    minLength: [6, "Minimum password length should be 6"],
  },
  // "admin" is never set through the API: signup ignores any role in the body,
  // and only an existing admin (PATCH /api/admin/users/:id/role) or the
  // server-side CLI (scripts/set-role.js) can change it.
  role: {
    type: String,
    enum: ["client", "admin"],
    default: "client",
  },
}, {
  // The password hash never leaves the server, even if a whole document is serialised.
  toJSON: {
    transform: (_doc, ret) => {
      delete ret.password;
      return ret;
    },
  },
});

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt();
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.statics.login = async function (email, password) {

    const user = await this.findOne({ email });

    if (user) {

        const auth = await bcrypt.compare(password, user.password);

        if (auth) {
            return user;
        }

        throw Error("Incorrect Password");
    }

    throw Error("Incorrect Email");
};

userSchema.index({ role: 1 });

const User = mongoose.model("user", userSchema);

module.exports = User;
