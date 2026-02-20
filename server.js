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
    created_at TEXT
  )
`);

// получить заметки с сортировкой
app.get("/notes", (req, res) => {
  const order = req.query.order === "asc" ? "ASC" : "DESC";

  db.all(
    `SELECT * FROM notes ORDER BY id ${order}`,
    [],
    (err, rows) => {
      res.json(rows);
    }
  );
});

// добавить заметку
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

// удалить заметку
app.delete("/notes/:id", (req, res) => {
  const id = req.params.id;

  db.run("DELETE FROM notes WHERE id = ?", [id], () => {
    res.json({ success: true });
  });
});

// редактировать заметку
app.put("/notes/:id", (req, res) => {
  const id = req.params.id;
  const text = req.body.text?.trim();

  if (!text) {
    return res.status(400).json({ error: "empty note" });
  }

  if (text.length > 25000) {
    return res.status(400).json({ error: "too long" });
  }

  db.run(
    "UPDATE notes SET text = ? WHERE id = ?",
    [text, id],
    () => {
      res.json({ success: true });
    }
  );
});

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});