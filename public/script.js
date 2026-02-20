let currentOrder = "desc";

const statusNode = document.getElementById("status");
const noteForm = document.getElementById("noteForm");
const noteInput = document.getElementById("noteInput");
const sortBtn = document.getElementById("sortBtn");
const themeToggle = document.getElementById("themeToggle");
const notesList = document.getElementById("notesList");

function setStatus(message, type = "info") {
  if (!statusNode) return;
  statusNode.textContent = message || "";
  statusNode.className = `status ${type}`;
}

function clearStatus() {
  setStatus("");
}

function updateSortButtonText() {
  if (!sortBtn) return;
  sortBtn.textContent = currentOrder === "desc"
    ? "Сортировка: сначала новые"
    : "Сортировка: сначала старые";
}

function applySavedTheme() {
  const savedTheme = localStorage.getItem("theme") || "light";
  document.body.classList.add(savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const isDark = document.body.classList.contains("dark");

  document.body.classList.remove("light", "dark");

  if (isDark) {
    document.body.classList.add("light");
    localStorage.setItem("theme", "light");
    updateThemeIcon("light");
  } else {
    document.body.classList.add("dark");
    localStorage.setItem("theme", "dark");
    updateThemeIcon("dark");
  }
}

function updateThemeIcon(theme) {
  if (!themeToggle) return;
  themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
}

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString();
}

function renderNote(note) {
  const li = document.createElement("li");

  if (note.pinned === 1) {
    li.classList.add("pinned");
  }

  const noteContent = document.createElement("div");
  noteContent.className = "note-content";

  const noteText = document.createElement("div");
  noteText.className = "note-text";
  noteText.textContent = note.text;

  const noteDate = document.createElement("div");
  noteDate.className = "note-date";
  noteDate.textContent = formatDate(note.created_at);

  noteContent.append(noteText, noteDate);

  const noteActions = document.createElement("div");
  noteActions.className = "note-actions";

  const pinBtn = document.createElement("button");
  pinBtn.type = "button";
  pinBtn.textContent = note.pinned === 1 ? "📌" : "📍";
  pinBtn.addEventListener("click", () => {
    togglePin(note.id);
  });

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.textContent = "✏️";
  editBtn.addEventListener("click", () => {
    editNote(note.id, note.text);
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.textContent = "❌";
  deleteBtn.addEventListener("click", () => {
    deleteNote(note.id);
  });

  noteActions.append(pinBtn, editBtn, deleteBtn);
  li.append(noteContent, noteActions);

  return li;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  let payload = null;

  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    const code = payload?.error || `http_${response.status}`;
    throw new Error(code);
  }

  return payload;
}

async function loadNotes() {
  try {
    const notes = await requestJson(`/notes?order=${currentOrder}`);
    notesList.innerHTML = "";
    notes.forEach((note) => {
      notesList.appendChild(renderNote(note));
    });
    clearStatus();
  } catch (error) {
    setStatus("Не удалось загрузить заметки", "error");
  }
}

function toggleSort() {
  currentOrder = currentOrder === "desc" ? "asc" : "desc";
  updateSortButtonText();
  loadNotes();
}

async function addNote() {
  const text = noteInput.value.trim();

  if (!text) {
    setStatus("Введите текст заметки", "error");
    return;
  }

  try {
    await requestJson("/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    noteInput.value = "";
    setStatus("Заметка добавлена", "success");
    await loadNotes();
  } catch (error) {
    setStatus("Не удалось добавить заметку", "error");
  }
}

async function deleteNote(id) {
  try {
    await requestJson(`/notes/${id}`, {
      method: "DELETE",
    });

    setStatus("Заметка удалена", "success");
    await loadNotes();
  } catch (error) {
    setStatus("Не удалось удалить заметку", "error");
  }
}

async function editNote(id, oldText) {
  const newText = prompt("Редактировать запись:", oldText);
  if (!newText) return;

  const trimmed = newText.trim();
  if (!trimmed) {
    setStatus("Пустую заметку сохранить нельзя", "error");
    return;
  }

  try {
    await requestJson(`/notes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed }),
    });

    setStatus("Заметка обновлена", "success");
    await loadNotes();
  } catch (error) {
    setStatus("Не удалось обновить заметку", "error");
  }
}

async function togglePin(id) {
  try {
    await requestJson(`/notes/${id}/pin`, {
      method: "PUT",
    });

    clearStatus();
    await loadNotes();
  } catch (error) {
    setStatus("Не удалось закрепить заметку", "error");
  }
}

noteForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addNote();
});

sortBtn.addEventListener("click", toggleSort);
themeToggle.addEventListener("click", toggleTheme);

applySavedTheme();
updateSortButtonText();
loadNotes();
