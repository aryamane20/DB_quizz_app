require("dotenv").config();

const app = require("./app");
const { checkDatabaseConnection } = require("./config/db");

const PORT = Number(process.env.PORT || 5050);

async function start() {
  try {
    await checkDatabaseConnection();
    app.listen(PORT, () => {
      console.log(`Backend server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

start();
