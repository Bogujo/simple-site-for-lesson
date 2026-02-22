const express = require("express");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const db = new sqlite3.Database("database.db");

app.use(express.json());
app.use(express.static("public"));

// Расширенная схема базы данных
db.run(`
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    pinned INTEGER DEFAULT 0,
    priority INTEGER DEFAULT 2,
    tags TEXT DEFAULT '',
    archived INTEGER DEFAULT 0,
    reminder TEXT,
    template TEXT DEFAULT '',
    theme TEXT DEFAULT 'default',
    clone_count INTEGER DEFAULT 0,
    position INTEGER DEFAULT 0
  )
`);

// Функция для обновления updated_at
function updateTimestamp(db, id, callback) {
  db.run(
    "UPDATE notes SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [id],
    callback
  );
}

app.get("/notes", (req, res) => {
  const {
    order = "desc",
    view = "all",
    search = "",
    tags = "",
    priority = "",
    archived = "0"
  } = req.query;

  let query = "SELECT * FROM notes WHERE 1=1";
  const params = [];

  if (view === "pinned") {
    query += " AND pinned = 1";
  } else if (view === "unpinned") {
    query += " AND pinned = 0";
  }

  if (priority) {
    query += " AND priority = ?";
    params.push(priority);
  }

  if (search) {
    query += " AND (text LIKE ? OR tags LIKE ?)";
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm);
  }

  if (tags) {
    const tagList = tags.split(',').map(tag => tag.trim());
    tagList.forEach(tag => {
      query += " AND tags LIKE ?";
      params.push(`%${tag}%`);
    });
  }

  if (archived === "0") {
    query += " AND archived = 0";
  } else if (archived === "1") {
    query += " AND archived = 1";
  }

  let orderClause = "ORDER BY ";
  
  if (order === "drag") {
    orderClause += "position ASC, pinned DESC, updated_at DESC";
  } else if (order === "priority") {
    orderClause += "priority DESC, pinned DESC, updated_at DESC";
  } else if (order === "alphabetical") {
    orderClause += "text COLLATE NOCASE ASC";
  } else if (order === "asc") {
    orderClause += "id ASC";
  } else {
    orderClause += "pinned DESC, updated_at DESC, id DESC";
  }

  query += " " + orderClause;

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(rows);
  });
});

// Получить статистику
app.get("/notes/stats", (req, res) => {
  db.all(
    `SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN pinned = 1 THEN 1 ELSE 0 END) as pinned,
      SUM(CASE WHEN priority = 3 THEN 1 ELSE 0 END) as highPriority,
      SUM(CASE WHEN priority = 2 THEN 1 ELSE 0 END) as mediumPriority,
      SUM(CASE WHEN priority = 1 THEN 1 ELSE 0 END) as lowPriority
     FROM notes`,
    [],
    (err, rows) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: "Database error" });
      }
      res.json(rows[0] || {});
    }
  );
});

app.post("/notes", (req, res) => {
  const { text, priority = 2, tags = "", template = "", theme = "default", reminder = "" } = req.body;
  const trimmedText = text?.trim();

  if (!trimmedText) {
    return res.status(400).json({ error: "Текст заметки не может быть пустым" });
  }

  if (trimmedText.length > 25000) {
    return res.status(400).json({ error: "Заметка слишком длинная (макс. 25000 символов)" });
  }

  const validPriority = Math.max(1, Math.min(3, parseInt(priority) || 2));

  db.run(
    `INSERT INTO notes (text, priority, tags, template, theme, reminder, created_at, updated_at) 
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [trimmedText, validPriority, tags, template, theme, reminder],
    function (err) {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: "Database error" });
      }
      res.json({ 
        success: true, 
        id: this.lastID,
        message: "Заметка успешно создана"
      });
    }
  );
});

app.put("/notes/:id", (req, res) => {
  const { id } = req.params;
  const { text, priority, tags, archived, reminder, theme, position } = req.body;

  db.get("SELECT id FROM notes WHERE id = ?", [id], (err, row) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: "Database error" });
    }
    
    if (!row) {
      return res.status(404).json({ error: "Заметка не найдена" });
    }

    const updates = [];
    const params = [];

    if (text !== undefined) {
      const trimmedText = text.trim();
      if (!trimmedText) {
        return res.status(400).json({ error: "Текст заметки не может быть пустым" });
      }
      if (trimmedText.length > 25000) {
        return res.status(400).json({ error: "Заметка слишком длинная" });
      }
      updates.push("text = ?");
      params.push(trimmedText);
    }

    if (priority !== undefined) {
      const validPriority = Math.max(1, Math.min(3, parseInt(priority) || 2));
      updates.push("priority = ?");
      params.push(validPriority);
    }

    if (tags !== undefined) {
      updates.push("tags = ?");
      params.push(tags);
    }

    if (archived !== undefined) {
      updates.push("archived = ?");
      params.push(archived ? 1 : 0);
    }

    if (reminder !== undefined) {
      updates.push("reminder = ?");
      params.push(reminder);
    }

    if (theme !== undefined) {
      updates.push("theme = ?");
      params.push(theme);
    }

    if (position !== undefined) {
      updates.push("position = ?");
      params.push(position);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "Нет данных для обновления" });
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    params.push(id);

    const query = `UPDATE notes SET ${updates.join(", ")} WHERE id = ?`;

    db.run(query, params, function (err) {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: "Database error" });
      }
      
      res.json({ 
        success: true, 
        message: "Заметка успешно обновлена",
        changes: this.changes
      });
    });
  });
});

// Удалить заметку
app.delete("/notes/:id", (req, res) => {
  const { id } = req.params;

  db.run("DELETE FROM notes WHERE id = ?", [id], function (err) {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: "Database error" });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: "Заметка не найдена" });
    }
    
    res.json({ 
      success: true, 
      message: "Заметка успешно удалена",
      changes: this.changes
    });
  });
});

// Закрепить/открепить заметку
app.put("/notes/:id/pin", (req, res) => {
  const { id } = req.params;

  db.get("SELECT pinned FROM notes WHERE id = ?", [id], (err, row) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: "Database error" });
    }
    
    if (!row) {
      return res.status(404).json({ error: "Заметка не найдена" });
    }

    const newValue = row.pinned === 1 ? 0 : 1;

    db.run(
      "UPDATE notes SET pinned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [newValue, id],
      function (err) {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ error: "Database error" });
        }
        
        res.json({ 
          success: true, 
          message: newValue === 1 ? "Заметка закреплена" : "Заметка откреплена",
          pinned: newValue
        });
      }
    );
  });
});

// Получить одну заметку
app.get("/notes/:id", (req, res) => {
  const { id } = req.params;

  db.get(
    "SELECT id, text, created_at, updated_at, pinned, priority, tags, template, theme, reminder, archived, clone_count FROM notes WHERE id = ?",
    [id],
    (err, row) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: "Database error" });
      }
      
      if (!row) {
        return res.status(404).json({ error: "Заметка не найдена" });
      }
      
      res.json(row);
    }
  );
});

// Экспорт заметок в JSON
app.get("/notes/export/json", (req, res) => {
  db.all(
    "SELECT id, text, created_at, updated_at, pinned, priority, tags, template, theme, reminder, archived, clone_count FROM notes ORDER BY updated_at DESC",
    [],
    (err, rows) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: "Database error" });
      }
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="notes_export_${Date.now()}.json"`);
      res.json(rows);
    }
  );
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Database file: database.db`);
});