const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");

function isBcryptHash(value) {
  return typeof value === "string" && value.startsWith("$2");
}

async function verifyPassword(inputPassword, storedPasswordHash) {
  if (isBcryptHash(storedPasswordHash)) {
    return bcrypt.compare(inputPassword, storedPasswordHash);
  }
  // Dev convenience: allows TEMP plain values until hashes are seeded.
  return inputPassword === storedPasswordHash;
}

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "email and password are required" });
  }

  const [rows] = await pool.execute(
    "SELECT id, name, email, password_hash, role FROM users WHERE email = ? LIMIT 1",
    [email]
  );

  const user = rows[0];
  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || "dev_secret",
    { expiresIn: "8h" }
  );

  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
}

function me(req, res) {
  return res.json({ user: req.user });
}

module.exports = {
  login,
  me,
};
