const { parse } = require("csv-parse/sync");
const { pool } = require("../config/db");

function dedupKey(questionText, level) {
  return `${questionText.toLowerCase().replace(/\s+/g, " ").trim()}::${level}`;
}

function normalizeAndValidateRow(row, rowNumber) {
  const question = String(row.question || "").trim();
  const answer = String(row.answer || "").trim();
  const levelValue = String(row.level || "").trim();
  const level = Number(levelValue);

  if (!question) {
    return { isValid: false, reason: "question is required", rowNumber };
  }

  if (!answer) {
    return { isValid: false, reason: "answer is required", rowNumber };
  }

  if (!Number.isInteger(level) || level < 1 || level > 6) {
    return { isValid: false, reason: "level must be an integer between 1 and 6", rowNumber };
  }

  return {
    isValid: true,
    value: {
      question_text: question,
      answer_text: answer,
      level,
    },
    rowNumber,
  };
}

async function uploadQuestionsCsv(req, res) {
  if (!req.file) {
    return res.status(400).json({ message: "CSV file is required (field name: file)" });
  }
  const mode = String(req.body.mode || "append").toLowerCase();
  if (!["append", "replace"].includes(mode)) {
    return res.status(400).json({ message: "mode must be either 'append' or 'replace'" });
  }

  let records = [];
  try {
    const csvText = req.file.buffer.toString("utf8");
    records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (error) {
    return res.status(400).json({ message: "Invalid CSV format" });
  }

  if (!records.length) {
    return res.status(400).json({ message: "CSV has no rows" });
  }

  const validRows = [];
  const failedRows = [];

  records.forEach((row, idx) => {
    const rowNumber = idx + 2; // +2 accounts for header row and 0-index
    const checked = normalizeAndValidateRow(row, rowNumber);
    if (!checked.isValid) {
      failedRows.push({
        rowNumber,
        reason: checked.reason,
        row,
      });
      return;
    }
    validRows.push({ ...checked.value, rowNumber });
  });

  if (!validRows.length) {
    return res.status(400).json({
      message: "No valid rows found in CSV",
      report: {
        totalRows: records.length,
        insertedCount: 0,
        failedCount: failedRows.length,
        failedRows,
      },
    });
  }

  const connection = await pool.getConnection();
  let insertedCount = 0;
  let deletedQuestionsCount = 0;
  let deletedAttemptsCount = 0;
  const duplicateRows = [];
  const uploadSeenKeys = new Set();
  try {
    await connection.beginTransaction();

    if (mode === "replace") {
      const [attemptCountRows] = await connection.execute(
        "SELECT COUNT(*) AS total FROM attempts"
      );
      deletedAttemptsCount = Number(attemptCountRows[0]?.total || 0);

      const [countRows] = await connection.execute(
        "SELECT COUNT(*) AS total FROM questions"
      );
      deletedQuestionsCount = Number(countRows[0]?.total || 0);
      await connection.execute("DELETE FROM attempts");
      await connection.execute("DELETE FROM questions");
    }

    for (const row of validRows) {
      const rowKey = dedupKey(row.question_text, row.level);
      if (uploadSeenKeys.has(rowKey)) {
        duplicateRows.push({
          rowNumber: row.rowNumber,
          reason: "duplicate question in uploaded CSV for the same level",
          row: {
            question: row.question_text,
            answer: row.answer_text,
            level: row.level,
          },
        });
        continue;
      }
      uploadSeenKeys.add(rowKey);

      const [existingRows] = await connection.execute(
        `SELECT id FROM questions
         WHERE level = ?
           AND LOWER(TRIM(question_text)) = LOWER(TRIM(?))
         LIMIT 1`,
        [row.level, row.question_text]
      );

      if (existingRows.length > 0) {
        duplicateRows.push({
          rowNumber: row.rowNumber,
          reason: "question already exists in database for this level",
          row: {
            question: row.question_text,
            answer: row.answer_text,
            level: row.level,
          },
        });
        continue;
      }

      await connection.execute(
        `INSERT INTO questions (question_text, answer_text, level, created_by)
         VALUES (?, ?, ?, ?)`,
        [row.question_text, row.answer_text, row.level, req.user.id]
      );
      insertedCount += 1;
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.error("Failed to save questions:", error.message);
    return res.status(500).json({ message: "Failed to save questions" });
  } finally {
    connection.release();
  }

  const failedCount = failedRows.length + duplicateRows.length;
  const statusCode = insertedCount > 0 ? 201 : 200;

  return res.status(statusCode).json({
    message: insertedCount > 0 ? "Upload processed" : "Upload processed with no new inserts",
    report: {
      mode,
      totalRows: records.length,
      insertedCount,
      deletedAttemptsCount,
      deletedQuestionsCount,
      duplicateCount: duplicateRows.length,
      failedCount,
      failedRows,
      duplicateRows,
    },
  });
}

async function listQuestions(req, res) {
  const level = req.query.level ? Number(req.query.level) : null;
  if (level !== null && (!Number.isInteger(level) || level < 1 || level > 6)) {
    return res.status(400).json({ message: "level must be an integer between 1 and 6" });
  }

  const params = [];
  let query = `
    SELECT q.id, q.question_text, q.answer_text, q.level, q.created_at, u.name AS created_by_name
    FROM questions q
    JOIN users u ON q.created_by = u.id
  `;

  if (level !== null) {
    query += " WHERE q.level = ?";
    params.push(level);
  }

  query += " ORDER BY q.created_at DESC";

  const [rows] = await pool.execute(query, params);
  return res.json({ questions: rows });
}

async function listSubmissions(req, res) {
  const level = req.query.level ? Number(req.query.level) : null;
  const studentEmail = String(req.query.studentEmail || "").trim();

  if (level !== null && (!Number.isInteger(level) || level < 1 || level > 6)) {
    return res.status(400).json({ message: "level must be an integer between 1 and 6" });
  }

  const where = [];
  const params = [];

  if (level !== null) {
    where.push("q.level = ?");
    params.push(level);
  }

  if (studentEmail) {
    where.push("LOWER(u.email) LIKE LOWER(?)");
    params.push(`%${studentEmail}%`);
  }

  let query = `
    SELECT
      a.id AS attempt_id,
      a.student_answer,
      a.submitted_at,
      u.name AS student_name,
      u.email AS student_email,
      q.level,
      q.question_text,
      q.answer_text AS correct_answer
    FROM attempts a
    JOIN users u ON a.student_id = u.id
    JOIN questions q ON a.question_id = q.id
  `;

  if (where.length > 0) {
    query += ` WHERE ${where.join(" AND ")}`;
  }

  query += " ORDER BY a.submitted_at DESC LIMIT 300";

  const [rows] = await pool.execute(query, params);
  return res.json({ submissions: rows });
}

module.exports = {
  uploadQuestionsCsv,
  listQuestions,
  listSubmissions,
};
