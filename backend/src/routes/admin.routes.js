const express = require("express");
const multer = require("multer");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  uploadQuestionsCsv,
  listQuestions,
  listSubmissions,
} = require("../controllers/adminQuestions.controller");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

router.get("/ping", requireAuth, requireRole("admin"), (req, res) => {
  res.json({ message: "Admin route is accessible" });
});

router.post(
  "/questions/upload",
  requireAuth,
  requireRole("admin"),
  upload.single("file"),
  uploadQuestionsCsv
);

router.get("/questions", requireAuth, requireRole("admin"), listQuestions);
router.get("/submissions", requireAuth, requireRole("admin"), listSubmissions);

module.exports = router;
