const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const db = new sqlite3.Database("database.db");
const PORT = process.env.PORT || 3000;
const MAX_NOTE_LENGTH = 2000;

app.use(express.json({ limit: "16kb" }));
app.use(express.static(path.join(__dirname, "public")));

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

function sendDbError(res, err) {
  console.error("Database error:", err);
  return res.status(500).json({ error: "database_error" });
}

function normalizeText(rawText) {
  const text = typeof rawText === "string" ? rawText.trim() : "";

  if (!text) {
    return { error: "empty_note" };
  }

  if (text.length > MAX_NOTE_LENGTH) {
    return { error: `too_long_max_${MAX_NOTE_LENGTH}` };
  }

  return { text };
}

function parseId(idCandidate) {
  const id = Number.parseInt(idCandidate, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/notes", (req, res) => {
  const order = req.query.order === "asc" ? "ASC" : "DESC";

  db.all(
    `SELECT id, text, created_at, pinned FROM notes ORDER BY pinned DESC, id ${order}`,
    [],
    (err, rows) => {
      if (err) {
        return sendDbError(res, err);
      }
      return res.json(rows);
    }
  );
});

app.post("/notes", (req, res) => {
  const normalized = normalizeText(req.body?.text);
  if (normalized.error) {
    return res.status(400).json({ error: normalized.error });
  }

  const createdAt = new Date().toISOString();

  db.run(
    "INSERT INTO notes (text, created_at) VALUES (?, ?)",
    [normalized.text, createdAt],
    function onInsert(err) {
      if (err) {
        return sendDbError(res, err);
      }

      return res.status(201).json({
        success: true,
        note: {
          id: this.lastID,
          text: normalized.text,
          created_at: createdAt,
          pinned: 0,
        },
      });
    }
  );
});

app.delete("/notes/:id", (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "invalid_id" });
  }

  db.run("DELETE FROM notes WHERE id = ?", [id], function onDelete(err) {
    if (err) {
      return sendDbError(res, err);
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: "not_found" });
    }

    return res.json({ success: true });
  });
});

app.put("/notes/:id", (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "invalid_id" });
  }

  const normalized = normalizeText(req.body?.text);
  if (normalized.error) {
    return res.status(400).json({ error: normalized.error });
  }

  db.run(
    "UPDATE notes SET text = ? WHERE id = ?",
    [normalized.text, id],
    function onUpdate(err) {
      if (err) {
        return sendDbError(res, err);
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: "not_found" });
      }

      return res.json({ success: true });
    }
  );
});

app.put("/notes/:id/pin", (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "invalid_id" });
  }

  db.get("SELECT pinned FROM notes WHERE id = ?", [id], (err, row) => {
    if (err) {
      return sendDbError(res, err);
    }

    if (!row) {
      return res.status(404).json({ error: "not_found" });
    }

    const newValue = row.pinned === 1 ? 0 : 1;

    db.run(
      "UPDATE notes SET pinned = ? WHERE id = ?",
      [newValue, id],
      (updateErr) => {
        if (updateErr) {
          return sendDbError(res, updateErr);
        }

        return res.json({ success: true, pinned: newValue });
      }
    );
  });
});

app.use((req, res) => {
  res.status(404).json({ error: "not_found" });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
