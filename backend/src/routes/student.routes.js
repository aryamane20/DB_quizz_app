const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  getLevels,
  getProgress,
  getQuestionsByLevel,
  getRandomQuestionByLevel,
  submitAttempt,
  getAttemptComparison,
} = require("../controllers/student.controller");

const router = express.Router();

router.use(requireAuth, requireRole("student"));

router.get("/ping", (req, res) => {
  res.json({ message: "Student route is accessible" });
});

router.get("/levels", getLevels);
router.get("/progress", getProgress);
router.get("/questions", getQuestionsByLevel);
router.get("/questions/random", getRandomQuestionByLevel);
router.post("/attempts", submitAttempt);
router.get("/attempts/:id/comparison", getAttemptComparison);

module.exports = router;
