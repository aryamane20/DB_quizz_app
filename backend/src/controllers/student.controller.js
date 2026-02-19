const { pool } = require("../config/db");

function parseLevel(rawLevel) {
  const level = Number(rawLevel);
  if (!Number.isInteger(level) || level < 1 || level > 6) {
    return null;
  }
  return level;
}

async function getLevels(req, res) {
  const [rows] = await pool.execute(
    `SELECT level, COUNT(*) AS question_count
     FROM questions
     GROUP BY level`
  );

  const countMap = new Map(rows.map((row) => [Number(row.level), Number(row.question_count)]));

  const levels = Array.from({ length: 6 }, (_, idx) => {
    const level = idx + 1;
    const questionCount = countMap.get(level) || 0;
    return {
      level,
      questionCount,
      hasQuestions: questionCount > 0,
    };
  });

  return res.json({ levels });
}

async function getProgress(req, res) {
  const [rows] = await pool.execute(
    `SELECT
       q.level,
       COUNT(DISTINCT q.id) AS total_questions,
       COUNT(DISTINCT a.question_id) AS attempted_questions
     FROM questions q
     LEFT JOIN attempts a
       ON a.question_id = q.id
      AND a.student_id = ?
     GROUP BY q.level
     ORDER BY q.level ASC`,
    [req.user.id]
  );

  const completedLevels = [];
  const inProgressLevels = [];
  const levelProgress = {};

  rows.forEach((row) => {
    const level = Number(row.level);
    const totalQuestions = Number(row.total_questions || 0);
    const attemptedQuestions = Number(row.attempted_questions || 0);

    levelProgress[level] = {
      totalQuestions,
      attemptedQuestions,
    };

    if (totalQuestions > 0 && attemptedQuestions >= totalQuestions) {
      completedLevels.push(level);
    } else if (attemptedQuestions > 0) {
      inProgressLevels.push(level);
    }
  });

  let unlockedLevel = 1;

  while (completedLevels.includes(unlockedLevel) && unlockedLevel < 6) {
    unlockedLevel += 1;
  }

  return res.json({
    completedLevels,
    inProgressLevels,
    unlockedLevel,
    levelProgress,
  });
}

async function getRandomQuestionByLevel(req, res) {
  const level = parseLevel(req.query.level);
  if (level === null) {
    return res.status(400).json({ message: "level must be an integer between 1 and 6" });
  }

  const [rows] = await pool.execute(
    `SELECT id, question_text, level
     FROM questions
     WHERE level = ?
     ORDER BY RAND()
     LIMIT 1`,
    [level]
  );

  if (rows.length === 0) {
    return res.status(404).json({ message: "No question found for this level" });
  }

  return res.json({ question: rows[0] });
}

async function getQuestionsByLevel(req, res) {
  const level = parseLevel(req.query.level);
  if (level === null) {
    return res.status(400).json({ message: "level must be an integer between 1 and 6" });
  }

  const [rows] = await pool.execute(
    `SELECT id, question_text, level
     FROM questions
     WHERE level = ?
     ORDER BY id ASC`,
    [level]
  );

  if (rows.length === 0) {
    return res.status(404).json({ message: "No questions found for this level" });
  }

  return res.json({ questions: rows });
}

async function submitAttempt(req, res) {
  const questionId = Number(req.body.questionId);
  const studentAnswer = String(req.body.studentAnswer || "").trim();

  if (!Number.isInteger(questionId) || questionId <= 0) {
    return res.status(400).json({ message: "questionId must be a positive integer" });
  }

  if (!studentAnswer) {
    return res.status(400).json({ message: "studentAnswer is required" });
  }

  const [questionRows] = await pool.execute(
    "SELECT id FROM questions WHERE id = ? LIMIT 1",
    [questionId]
  );

  if (questionRows.length === 0) {
    return res.status(404).json({ message: "Question not found" });
  }

  const [result] = await pool.execute(
    `INSERT INTO attempts (student_id, question_id, student_answer)
     VALUES (?, ?, ?)`,
    [req.user.id, questionId, studentAnswer]
  );

  return res.status(201).json({
    message: "Attempt submitted",
    attemptId: result.insertId,
  });
}

async function getAttemptComparison(req, res) {
  const attemptId = Number(req.params.id);
  if (!Number.isInteger(attemptId) || attemptId <= 0) {
    return res.status(400).json({ message: "attempt id must be a positive integer" });
  }

  const [rows] = await pool.execute(
    `SELECT
       a.id AS attempt_id,
       a.student_id,
       a.student_answer,
       a.submitted_at,
       q.id AS question_id,
       q.question_text,
       q.answer_text AS correct_answer,
       q.level
     FROM attempts a
     JOIN questions q ON q.id = a.question_id
     WHERE a.id = ?
     LIMIT 1`,
    [attemptId]
  );

  if (rows.length === 0) {
    return res.status(404).json({ message: "Attempt not found" });
  }

  const row = rows[0];
  if (row.student_id !== req.user.id) {
    return res.status(403).json({ message: "Forbidden" });
  }

  return res.json({
    comparison: {
      attemptId: row.attempt_id,
      questionId: row.question_id,
      level: row.level,
      question: row.question_text,
      correctAnswer: row.correct_answer,
      studentAnswer: row.student_answer,
      submittedAt: row.submitted_at,
    },
  });
}

module.exports = {
  getLevels,
  getProgress,
  getQuestionsByLevel,
  getRandomQuestionByLevel,
  submitAttempt,
  getAttemptComparison,
};
