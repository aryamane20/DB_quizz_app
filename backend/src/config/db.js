const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "quiz_user",
  password: process.env.DB_PASSWORD || "quiz_pass",
  database: process.env.DB_NAME || "quiz_app",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function checkDatabaseConnection() {
  const connection = await pool.getConnection();
  await connection.ping();
  connection.release();
}

module.exports = {
  pool,
  checkDatabaseConnection,
};
