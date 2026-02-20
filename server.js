const express = require("express");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const db = new sqlite3.Database("database.db");

app.use(express.json());
app.use(express.static("public"));

db.run(`
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT,
    created_at TEXT,
    pinned INTEGER DEFAULT 0
  )
`);


app.get("/notes", (req, res) => {
  const order = req.query.order === "asc" ? "ASC" : "DESC";

  db.all(
    `SELECT * FROM notes 
     ORDER BY pinned DESC, id ${order}`,
    [],
    (err, rows) => {
      res.json(rows);
    }
  );
});


app.post("/notes", (req, res) => {
  const text = req.body.text?.trim();

  if (!text) {
    return res.status(400).json({ error: "empty note" });
  }

  if (text.length > 25000) {
    return res.status(400).json({ error: "too long" });
  }

  const createdAt = new Date().toLocaleString();

  db.run(
    "INSERT INTO notes (text, created_at) VALUES (?, ?)",
    [text, createdAt],
    () => {
      res.json({ success: true });
    }
  );
});


app.delete("/notes/:id", (req, res) => {
  db.run("DELETE FROM notes WHERE id = ?", [req.params.id], () => {
    res.json({ success: true });
  });
});


app.put("/notes/:id", (req, res) => {
  const text = req.body.text?.trim();

  if (!text) {
    return res.status(400).json({ error: "empty note" });
  }

  if (text.length > 25000) {
    return res.status(400).json({ error: "too long" });
  }

  db.run(
    "UPDATE notes SET text = ? WHERE id = ?",
    [text, req.params.id],
    () => {
      res.json({ success: true });
    }
  );
});


app.put("/notes/:id/pin", (req, res) => {
  const id = req.params.id;

  db.get("SELECT pinned FROM notes WHERE id = ?", [id], (err, row) => {
    if (!row) return res.status(404).json({ error: "not found" });

    const newValue = row.pinned === 1 ? 0 : 1;

    db.run(
      "UPDATE notes SET pinned = ? WHERE id = ?",
      [newValue, id],
      () => {
        res.json({ success: true });
      }
    );
  });
});

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});