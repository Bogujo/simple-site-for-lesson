const express = require("express");

const MAX_NOTE_LENGTH = 2000;
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

function createNotesRouter(db) {
  const router = express.Router();

  function sendDbError(res, err) {
    console.error("Database error:", err);
    return res.status(500).json({ error: "database_error" });
  }

  function normalizeText(rawText) {
    const text = typeof rawText === "string" ? rawText.trim() : "";
    if (!text) return { error: "empty_note" };
    if (text.length > MAX_NOTE_LENGTH) {
      return { error: `too_long_max_${MAX_NOTE_LENGTH}` };
    }
    return { text };
  }

  function parseId(idCandidate) {
    const id = Number.parseInt(idCandidate, 10);
    if (!Number.isInteger(id) || id <= 0) return null;
    return id;
  }

  function parseLimit(limitCandidate) {
    const raw = Number.parseInt(limitCandidate, 10);
    if (!Number.isInteger(raw) || raw <= 0) return DEFAULT_LIMIT;
    return Math.min(raw, MAX_LIMIT);
  }

  function parseOffset(offsetCandidate) {
    const raw = Number.parseInt(offsetCandidate, 10);
    if (!Number.isInteger(raw) || raw < 0) return 0;
    return raw;
  }

  router.get("/", (req, res) => {
    const order = req.query.order === "asc" ? "ASC" : "DESC";
    const limit = parseLimit(req.query.limit);
    const offset = parseOffset(req.query.offset);

    db.get("SELECT COUNT(*) AS total FROM notes", [], (countErr, countRow) => {
      if (countErr) return sendDbError(res, countErr);

      db.all(
        `SELECT id, text, created_at, pinned FROM notes ORDER BY pinned DESC, id ${order} LIMIT ? OFFSET ?`,
        [limit, offset],
        (err, rows) => {
          if (err) return sendDbError(res, err);

          return res.json({
            items: rows,
            pagination: {
              total: countRow.total,
              limit,
              offset,
              hasMore: offset + rows.length < countRow.total,
            },
          });
        }
      );
    });
  });

  router.post("/", (req, res) => {
    const normalized = normalizeText(req.body?.text);
    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }

    const createdAt = new Date().toISOString();

    db.run(
      "INSERT INTO notes (text, created_at) VALUES (?, ?)",
      [normalized.text, createdAt],
      function onInsert(err) {
        if (err) return sendDbError(res, err);

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

  router.delete("/:id", (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "invalid_id" });

    db.run("DELETE FROM notes WHERE id = ?", [id], function onDelete(err) {
      if (err) return sendDbError(res, err);
      if (this.changes === 0) return res.status(404).json({ error: "not_found" });
      return res.json({ success: true });
    });
  });

  router.put("/:id", (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "invalid_id" });

    const normalized = normalizeText(req.body?.text);
    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }

    db.run(
      "UPDATE notes SET text = ? WHERE id = ?",
      [normalized.text, id],
      function onUpdate(err) {
        if (err) return sendDbError(res, err);
        if (this.changes === 0) return res.status(404).json({ error: "not_found" });
        return res.json({ success: true });
      }
    );
  });

  router.put("/:id/pin", (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "invalid_id" });

    db.get("SELECT pinned FROM notes WHERE id = ?", [id], (err, row) => {
      if (err) return sendDbError(res, err);
      if (!row) return res.status(404).json({ error: "not_found" });

      const newValue = row.pinned === 1 ? 0 : 1;
      db.run(
        "UPDATE notes SET pinned = ? WHERE id = ?",
        [newValue, id],
        (updateErr) => {
          if (updateErr) return sendDbError(res, updateErr);
          return res.json({ success: true, pinned: newValue });
        }
      );
    });
  });

  return router;
}

module.exports = createNotesRouter;
