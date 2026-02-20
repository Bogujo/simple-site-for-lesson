const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const createNotesRouter = require("./routes/notes");

const db = new sqlite3.Database("database.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      pinned INTEGER DEFAULT 0
    )
  `);
});

const app = express();

const requestBuckets = new Map();
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 120;

function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;");
  next();
}

function notesRateLimiter(req, res, next) {
  const key = req.ip || "local";
  const now = Date.now();
  const current = requestBuckets.get(key);

  if (!current || now > current.resetAt) {
    requestBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return next();
  }

  if (current.count >= RATE_LIMIT) {
    return res.status(429).json({ error: "too_many_requests" });
  }

  current.count += 1;
  return next();
}

app.use(securityHeaders);
app.use(express.json({ limit: "16kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/notes", notesRateLimiter, createNotesRouter(db));

app.use((req, res) => {
  res.status(404).json({ error: "not_found" });
});

module.exports = app;
