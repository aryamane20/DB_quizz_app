import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5050";

function App() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // Student dashboard state
  const [levels, setLevels] = useState([]);
  const [progress, setProgress] = useState({
    completedLevels: [],
    inProgressLevels: [],
    unlockedLevel: 1,
    levelProgress: {},
  });
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [dashboardError, setDashboardError] = useState("");

  const [selectedLevel, setSelectedLevel] = useState(null);
  const [levelQuestions, setLevelQuestions] = useState([]);
  const [levelLoading, setLevelLoading] = useState(false);
  const [levelViewError, setLevelViewError] = useState("");
  const [questionAnswers, setQuestionAnswers] = useState({});
  const [questionSubmitting, setQuestionSubmitting] = useState({});
  const [questionErrors, setQuestionErrors] = useState({});
  const [questionComparisons, setQuestionComparisons] = useState({});

  // Admin dashboard state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadReport, setUploadReport] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [adminQuestions, setAdminQuestions] = useState([]);
  const [adminQuestionError, setAdminQuestionError] = useState("");
  const [adminLevelFilter, setAdminLevelFilter] = useState("all");
  const [adminView, setAdminView] = useState("questions");
  const [adminSubmissions, setAdminSubmissions] = useState([]);
  const [adminSubmissionError, setAdminSubmissionError] = useState("");
  const [adminSubmissionLevelFilter, setAdminSubmissionLevelFilter] = useState("all");
  const [adminSubmissionStudentFilter, setAdminSubmissionStudentFilter] = useState("");
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  const completedSet = useMemo(
    () => new Set(progress.completedLevels || []),
    [progress.completedLevels]
  );
  const inProgressSet = useMemo(
    () => new Set(progress.inProgressLevels || []),
    [progress.inProgressLevels]
  );
  const isAuthenticated = Boolean(token && user);

  function resetSessionWithMessage(message) {
    localStorage.removeItem("quiz_token");
    localStorage.removeItem("quiz_user");
    setToken("");
    setUser(null);
    setLoginError(message || "");
    setSelectedLevel(null);
    setLevelQuestions([]);
    setQuestionAnswers({});
    setQuestionSubmitting({});
    setQuestionComparisons({});
    setQuestionErrors({});
  }

  async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && token) {
        resetSessionWithMessage();
      }
      throw new Error(data.message || "Request failed");
    }
    return data;
  }

  async function loadDashboardData() {
    if (!token) return;
    setLoadingDashboard(true);
    setDashboardError("");
    try {
      const [levelsData, progressData] = await Promise.all([
        apiRequest("/student/levels"),
        apiRequest("/student/progress"),
      ]);
      setLevels(levelsData.levels || []);
      setProgress(progressData);
    } catch (error) {
      setDashboardError(error.message);
    } finally {
      setLoadingDashboard(false);
    }
  }

  async function loadAdminQuestions() {
    setAdminQuestionError("");
    try {
      const query =
        adminLevelFilter === "all" ? "" : `?level=${encodeURIComponent(adminLevelFilter)}`;
      const data = await apiRequest(`/admin/questions${query}`);
      setAdminQuestions(data.questions || []);
    } catch (error) {
      setAdminQuestionError(error.message);
    }
  }

  async function loadAdminSubmissions() {
    setAdminSubmissionError("");
    setLoadingSubmissions(true);
    try {
      const params = new URLSearchParams();
      if (adminSubmissionLevelFilter !== "all") {
        params.set("level", adminSubmissionLevelFilter);
      }
      if (adminSubmissionStudentFilter.trim()) {
        params.set("studentEmail", adminSubmissionStudentFilter.trim());
      }
      const query = params.toString() ? `?${params.toString()}` : "";
      const data = await apiRequest(`/admin/submissions${query}`);
      setAdminSubmissions(data.submissions || []);
    } catch (error) {
      setAdminSubmissionError(error.message);
    } finally {
      setLoadingSubmissions(false);
    }
  }

  useEffect(() => {
    if (token && user?.role === "student") {
      loadDashboardData();
    }
  }, [token, user?.role]);

  useEffect(() => {
    if (token && user?.role === "admin") {
      loadAdminQuestions();
      loadAdminSubmissions();
    }
  }, [token, user?.role, adminLevelFilter]);

  async function handleLogin(event) {
    event.preventDefault();
    setLoginError("");

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      localStorage.setItem("quiz_token", data.token);
      localStorage.setItem("quiz_user", JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
    } catch (error) {
      setLoginError(error.message);
    }
  }

  function handleLogout() {
    localStorage.removeItem("quiz_token");
    localStorage.removeItem("quiz_user");
    setToken("");
    setUser(null);
    setSelectedLevel(null);
    setLevelQuestions([]);
    setQuestionAnswers({});
    setQuestionSubmitting({});
    setQuestionComparisons({});
    setQuestionErrors({});
    setUploadFile(null);
    setUploadReport(null);
  }

  async function loadLevelQuestions(level) {
    setLevelLoading(true);
    setLevelViewError("");
    try {
      const data = await apiRequest(`/student/questions?level=${level}`);
      setLevelQuestions(data.questions || []);
    } catch (error) {
      setLevelViewError(error.message);
    } finally {
      setLevelLoading(false);
    }
  }

  function handleOpenLevel(level) {
    const isLocked = level.level > progress.unlockedLevel;
    if (isLocked || !level.hasQuestions) return;
    setSelectedLevel(level.level);
    setQuestionErrors({});
    setLevelQuestions([]);
    loadLevelQuestions(level.level);
  }

  async function handleSubmitAnswer(questionId) {
    const answer = String(questionAnswers[questionId] || "").trim();
    if (!answer) {
      setQuestionErrors((prev) => ({
        ...prev,
        [questionId]: "Please type an answer before submitting.",
      }));
      return;
    }

    setQuestionSubmitting((prev) => ({ ...prev, [questionId]: true }));
    setQuestionErrors((prev) => ({ ...prev, [questionId]: "" }));

    try {
      const attempt = await apiRequest("/student/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId,
          studentAnswer: answer,
        }),
      });

      const compared = await apiRequest(
        `/student/attempts/${attempt.attemptId}/comparison`
      );
      setQuestionComparisons((prev) => ({
        ...prev,
        [questionId]: compared.comparison,
      }));
      await loadDashboardData();
    } catch (error) {
      setQuestionErrors((prev) => ({ ...prev, [questionId]: error.message }));
    } finally {
      setQuestionSubmitting((prev) => ({ ...prev, [questionId]: false }));
    }
  }

  async function handleAdminUpload(event) {
    event.preventDefault();
    if (!uploadFile) {
      setUploadError("Please select a CSV file.");
      return;
    }

    setUploadError("");
    setUploading(true);
    setUploadReport(null);

    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      const shouldReplace = window.confirm(
        "Do you want to replace existing questions?\n\nPress OK to REPLACE existing questions.\nPress Cancel to KEEP existing questions and append."
      );
      formData.append("mode", shouldReplace ? "replace" : "append");

      const response = await fetch(`${API_BASE_URL}/admin/questions/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Upload failed");
      }

      setUploadReport(data.report || null);
      setUploadFile(null);
      await loadAdminQuestions();
      await loadAdminSubmissions();
    } catch (error) {
      setUploadError(error.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    !isAuthenticated ? (
      <div className="app-shell landing-shell">
        <div className="landing-card">
          <div className="main-title">Database Quiz</div>
          <div className="main-tagline">
            Welcome to your interactive quiz portal. Sign in as Admin or Student to continue.
          </div>
          <div className="landing-login-panel">
            <div className="section-title">Login</div>
            <p>Use admin or student account to continue.</p>
            <p className="hint-text">
              Admin: admin@quiz.com / admin123 | Student: student1@quiz.com / student123
            </p>
            {loginError ? <p className="error-text">{loginError}</p> : null}
            <form className="landing-login-form" onSubmit={handleLogin}>
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>
              <button type="submit" className="primary-btn">
                Login
              </button>
            </form>
          </div>
        </div>
      </div>
    ) : (
    <div className="app-shell">
      <header className="topbar">
        <div className="main-title-row">
          <div className="main-title">Quiz Quest Arena</div>
        </div>
        <div className="subheader-row">
          <div className="main-tagline">
            {user?.role === "admin"
              ? "Craft epic challenges and spark your classroom."
              : "Pop a level card, conquer every question, and unlock your next quest."}
          </div>
          {user && (
            <div className="user-block">
              <span className="user-name">{user.name}</span>
              <button className="outline-btn" onClick={handleLogout}>
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      {user?.role === "student" ? (
        <>
          {loadingDashboard ? <p>Loading dashboard...</p> : null}
          {dashboardError ? <p className="error-text">{dashboardError}</p> : null}

          <section className="levels-grid">
            {levels.map((levelData) => {
              const isLocked = levelData.level > progress.unlockedLevel;
              const isCompleted = completedSet.has(levelData.level);
              const isInProgress = inProgressSet.has(levelData.level);
              const progressInfo = progress.levelProgress?.[levelData.level];

              return (
                <button
                  key={levelData.level}
                  className={`level-card ${isLocked ? "locked" : ""} ${
                    isCompleted ? "completed" : ""
                  } ${isInProgress ? "in-progress" : ""} ${
                    !isCompleted && !isInProgress && !isLocked ? "ready" : ""
                  }`}
                  onClick={() => handleOpenLevel(levelData)}
                  disabled={isLocked || !levelData.hasQuestions}
                >
                  <div className="level-title">Level {levelData.level}</div>
                  <div className="level-meta">
                    {levelData.questionCount} question(s)
                    {progressInfo ? (
                      <div className="progress-mini">
                        Answered: {progressInfo.attemptedQuestions}/{progressInfo.totalQuestions}
                      </div>
                    ) : null}
                  </div>
                  <div className="level-status">
                    {isCompleted
                      ? "✅ Completed"
                      : isInProgress
                      ? "🟡 In Progress"
                      : isLocked
                      ? "🔒 Locked"
                      : "🔓 Unlocked"}
                  </div>
                </button>
              );
            })}
          </section>

          {selectedLevel ? (
            <section className="level-fullscreen popout">
              <div className="level-fullscreen-header">
                <button
                  className="outline-btn"
                  onClick={() => setSelectedLevel(null)}
                >
                  Back To Levels
                </button>
                <div className="fullscreen-title">
                  Level {selectedLevel} Challenge Zone
                </div>
              </div>

              <div className="level-fullscreen-body">
                {levelLoading ? <p>Loading questions...</p> : null}
                {levelViewError ? <p className="error-text">{levelViewError}</p> : null}

                {!levelLoading && !levelViewError ? (
                  <div className="question-stack">
                    {levelQuestions.map((item, idx) => (
                      <article key={item.id} className="question-card">
                        <div className="question-card-title">Question {idx + 1}</div>
                        <p className="question-text">{item.question_text}</p>

                        <textarea
                          value={questionAnswers[item.id] || ""}
                          onChange={(event) =>
                            setQuestionAnswers((prev) => ({
                              ...prev,
                              [item.id]: event.target.value,
                            }))
                          }
                          placeholder="Type your answer here..."
                          rows={4}
                        />

                        <button
                          className="primary-btn"
                          onClick={() => handleSubmitAnswer(item.id)}
                          disabled={Boolean(questionSubmitting[item.id])}
                        >
                          {questionSubmitting[item.id]
                            ? "Submitting..."
                            : "Submit & Compare"}
                        </button>

                        {questionErrors[item.id] ? (
                          <p className="error-text">{questionErrors[item.id]}</p>
                        ) : null}

                        {questionComparisons[item.id] ? (
                          <div className="comparison-grid inline-compare">
                            <div>
                              <div className="compare-title">Original Answer</div>
                              <p>{questionComparisons[item.id].correctAnswer}</p>
                            </div>
                            <div>
                              <div className="compare-title">Your Answer</div>
                              <p>{questionComparisons[item.id].studentAnswer}</p>
                            </div>
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {user?.role === "admin" ? (
        <>
          <section className="quiz-panel">
            <div className="section-title">Upload Questions CSV</div>
            <form className="admin-upload-form" onSubmit={handleAdminUpload}>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
              />
              <button className="primary-btn" type="submit" disabled={uploading}>
                {uploading ? "Uploading..." : "Upload CSV"}
              </button>
            </form>
            {uploadError ? <p className="error-text">{uploadError}</p> : null}
            {uploadReport ? (
              <div className="report-box">
                <p>Total rows: {uploadReport.totalRows}</p>
                <p>Mode: {uploadReport.mode}</p>
                <p>Deleted existing attempts: {uploadReport.deletedAttemptsCount || 0}</p>
                <p>Inserted: {uploadReport.insertedCount}</p>
                <p>Deleted existing questions: {uploadReport.deletedQuestionsCount || 0}</p>
                <p>Duplicates: {uploadReport.duplicateCount || 0}</p>
                <p>Failed: {uploadReport.failedCount}</p>
              </div>
            ) : null}
          </section>

          <section className="comparison-panel">
            <div className="admin-menu">
              <button
                className={`admin-menu-btn ${adminView === "questions" ? "active" : ""}`}
                onClick={() => setAdminView("questions")}
              >
                Question Bank
              </button>
              <button
                className={`admin-menu-btn ${adminView === "submissions" ? "active" : ""}`}
                onClick={() => setAdminView("submissions")}
              >
                Student Submissions
              </button>
            </div>

            {adminView === "questions" ? (
              <>
                <div className="section-title">Question Bank</div>
                <div className="admin-toolbar">
                  <label>
                    Level filter:
                    <select
                      value={adminLevelFilter}
                      onChange={(event) => setAdminLevelFilter(event.target.value)}
                    >
                      <option value="all">All</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4</option>
                      <option value="5">5</option>
                      <option value="6">6</option>
                    </select>
                  </label>
                </div>
                {adminQuestionError ? <p className="error-text">{adminQuestionError}</p> : null}
                <div className="question-list">
                  {adminQuestions.map((item) => (
                    <div key={item.id} className="question-item">
                      <strong>Level {item.level}</strong>
                      <p>{item.question_text}</p>
                    </div>
                  ))}
                  {adminQuestions.length === 0 ? <p>No questions found.</p> : null}
                </div>
              </>
            ) : null}

            {adminView === "submissions" ? (
              <>
                <div className="section-title">Student Submissions</div>
                <div className="admin-toolbar submissions-toolbar">
                  <label>
                    Level:
                    <select
                      value={adminSubmissionLevelFilter}
                      onChange={(event) => setAdminSubmissionLevelFilter(event.target.value)}
                    >
                      <option value="all">All</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4</option>
                      <option value="5">5</option>
                      <option value="6">6</option>
                    </select>
                  </label>
                  <label>
                    Student Email:
                    <input
                      type="text"
                      value={adminSubmissionStudentFilter}
                      onChange={(event) => setAdminSubmissionStudentFilter(event.target.value)}
                      placeholder="Filter by email"
                    />
                  </label>
                  <button className="primary-btn" onClick={loadAdminSubmissions}>
                    Apply Filters
                  </button>
                </div>

                {loadingSubmissions ? <p>Loading submissions...</p> : null}
                {adminSubmissionError ? <p className="error-text">{adminSubmissionError}</p> : null}

                <div className="submissions-list">
                  {adminSubmissions.map((item) => (
                    <div key={item.attempt_id} className="submission-card">
                      <div className="submission-head">
                        <div className="submission-student">
                          {item.student_name} ({item.student_email})
                        </div>
                        <div className="submission-meta">
                          Level {item.level} | {new Date(item.submitted_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="submission-question">{item.question_text}</div>
                      <div className="comparison-grid inline-compare">
                        <div>
                          <div className="compare-title">Correct Answer</div>
                          <p>{item.correct_answer}</p>
                        </div>
                        <div>
                          <div className="compare-title">Student Answer</div>
                          <p>{item.student_answer}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!loadingSubmissions && adminSubmissions.length === 0 ? (
                    <p>No submissions found.</p>
                  ) : null}
                </div>
              </>
            ) : null}
          </section>
        </>
      ) : null}

    </div>
    )
  );
}

export default App;
