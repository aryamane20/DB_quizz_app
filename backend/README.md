# Quiz App Backend (Day 1 + Day 2 + Day 3)

## Setup

1. Install dependencies:
   - `npm install`
2. Copy environment file:
   - `cp .env.example .env`
3. Start API:
   - `npm run dev`

## Auth API

- `POST /auth/login`
  - body: `{ "email": "admin@quiz.com", "password": "admin123" }`
- `GET /auth/me` (requires `Authorization: Bearer <token>`)

## Protected route checks

- `GET /admin/ping` (admin only)
- `GET /student/ping` (student only)

## Day 2 Admin Question Upload

- `POST /admin/questions/upload` (admin only, multipart form-data, field name: `file`)
- upload mode via form-data field `mode`:
  - `append` (default): keep existing questions and add new ones
  - `replace`: remove existing questions first, then import CSV
- `GET /admin/questions?level=1` (admin only, optional level filter 1-6)

CSV format:

```csv
question,answer,level
What does SQL stand for?,Structured Query Language,1
```

Quick test:

1. Login and copy token:
   - `curl -X POST http://localhost:5050/auth/login -H "Content-Type: application/json" -d '{"email":"admin@quiz.com","password":"admin123"}'`
2. Upload questions:
   - `curl -X POST http://localhost:5050/admin/questions/upload -H "Authorization: Bearer <token>" -F "file=@sample-questions.csv"`
3. List level 1:
   - `curl "http://localhost:5050/admin/questions?level=1" -H "Authorization: Bearer <token>"`

Dedup behavior:

- If the same question is uploaded again for the same level, it is skipped.
- API response includes `duplicateCount` and `duplicateRows` so admin can review what was ignored.

## Day 3 Student Quiz Flow

- `GET /student/levels` (student only)
- `GET /student/progress` (student only)
- `GET /student/questions/random?level=1` (student only)
- `POST /student/attempts` (student only)
  - body: `{ "questionId": 1, "studentAnswer": "your typed answer" }`
- `GET /student/attempts/:id/comparison` (student only, own attempts only)

## Seed password update (run once after schema seed)

Run these inside MySQL to replace `TEMP_HASH` with bcrypt hashes:

```sql
UPDATE users SET password_hash = '$2b$10$fXJmIwJJlZbOXCx3t3qBsOj74RMHbkVDiTD67dfaTTmFThUuwiDne' WHERE email = 'admin@quiz.com';
UPDATE users SET password_hash = '$2b$10$HjgiuQTxWDCa2wOIU62OA.QDwXlkkl1r5LN3kzoG.oo/AA3K8q.dS' WHERE email = 'student1@quiz.com';
UPDATE users SET password_hash = '$2b$10$zYo3kV7to72VpXo8Th.FxuMmNvro58LiYXbkoPH0/tvLUfM12b9KS' WHERE email = 'student2@quiz.com';
```

Credentials after update:

- admin: `admin@quiz.com` / `admin123`
- student: `student1@quiz.com` / `student123`
- student: `student2@quiz.com` / `student123`
