const express = require("express");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const db = new sqlite3.Database("database.db");

app.use(express.json());
app.use(express.static("public"));

db.run(`
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT
  )
`);

app.get("/notes", (req, res) => {
  db.all("SELECT * FROM notes ORDER BY id DESC", [], (err, rows) => {
    res.json(rows);
  });
});

app.post("/notes", (req, res) => {
  const { text } = req.body;

  db.run("INSERT INTO notes (text) VALUES (?)", [text], () => {
    res.json({ success: true });
  });
});

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});

app.delete("/notes/:id", (req, res) => {
  const id = req.params.id;

  db.run("DELETE FROM notes WHERE id = ?", [id], () => {
    res.json({ success: true });
  });
});

