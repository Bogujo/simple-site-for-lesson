(() => {
  if (window.__notesAppInitialized) return;
  window.__notesAppInitialized = true;

  const PAGE_LIMIT = 20;
  let currentOrder = "desc";
  let currentOffset = 0;
  let hasMore = false;

  const statusNode = document.getElementById("status");
  const noteInput = document.getElementById("noteInput");
  const addNoteBtn = document.getElementById("addNoteBtn");
  const sortBtn = document.getElementById("sortBtn");
  const themeToggle = document.getElementById("themeToggle");
  const notesList = document.getElementById("notesList");
  const loadMoreBtn = document.getElementById("loadMoreBtn");

  const ERROR_MESSAGES = {
    empty_note: "Введите текст заметки",
    invalid_id: "Некорректный ID заметки",
    not_found: "Заметка не найдена",
    too_many_requests: "Слишком много запросов, попробуйте позже",
    database_error: "Ошибка базы данных",
  };

  function getErrorMessage(code, fallback) {
    return ERROR_MESSAGES[code] || fallback;
  }

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

  function updateLoadMoreButton() {
    if (!loadMoreBtn) return;
    loadMoreBtn.hidden = !hasMore;
  }

  function buildActionButton(label, clickHandler) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", clickHandler);
    return button;
  }

  function finishInlineEdit(li, note) {
    li.replaceWith(renderNote(note));
  }

  function startInlineEdit(li, note) {
    const input = document.createElement("textarea");
    input.className = "edit-input";
    input.maxLength = 2000;
    input.value = note.text;

    const saveBtn = buildActionButton("💾", async () => {
      const nextText = input.value.trim();
      if (!nextText) {
        setStatus("Пустую заметку сохранить нельзя", "error");
        return;
      }

      try {
        await requestJson(`/notes/${note.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: nextText }),
        });
        note.text = nextText;
        setStatus("Заметка обновлена", "success");
        finishInlineEdit(li, note);
      } catch (error) {
        setStatus(getErrorMessage(error.message, "Не удалось обновить заметку"), "error");
      }
    });

    const cancelBtn = buildActionButton("↩", () => {
      finishInlineEdit(li, note);
    });

    const editWrap = document.createElement("div");
    editWrap.className = "note-content";
    editWrap.append(input);

    const actions = document.createElement("div");
    actions.className = "note-actions";
    actions.append(saveBtn, cancelBtn);

    li.innerHTML = "";
    li.append(editWrap, actions);
  }

  function renderNote(note) {
    const li = document.createElement("li");
    if (note.pinned === 1) li.classList.add("pinned");

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

    const pinBtn = buildActionButton(note.pinned === 1 ? "📌" : "📍", async () => {
      await togglePin(note.id);
    });

    const editBtn = buildActionButton("✏️", () => {
      startInlineEdit(li, note);
    });

    const deleteBtn = buildActionButton("❌", async () => {
      await deleteNote(note.id);
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
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const code = payload?.error || `http_${response.status}`;
      throw new Error(code);
    }

    return payload;
  }

  async function loadNotes(append = false) {
    if (!notesList) return;

    if (!append) {
      currentOffset = 0;
    }

    try {
      const payload = await requestJson(
        `/notes?order=${currentOrder}&limit=${PAGE_LIMIT}&offset=${currentOffset}`
      );

      const items = payload.items || [];
      if (!append) {
        notesList.innerHTML = "";
      }

      items.forEach((note) => {
        notesList.appendChild(renderNote(note));
      });

      hasMore = Boolean(payload.pagination?.hasMore);
      currentOffset += items.length;
      updateLoadMoreButton();
      clearStatus();
    } catch (error) {
      setStatus(getErrorMessage(error.message, "Не удалось загрузить заметки"), "error");
    }
  }

  function toggleSort() {
    currentOrder = currentOrder === "desc" ? "asc" : "desc";
    updateSortButtonText();
    loadNotes();
  }

  async function addNote() {
    if (!noteInput) return;
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
      setStatus(getErrorMessage(error.message, "Не удалось добавить заметку"), "error");
    }
  }

  async function deleteNote(id) {
    try {
      await requestJson(`/notes/${id}`, { method: "DELETE" });
      setStatus("Заметка удалена", "success");
      await loadNotes();
    } catch (error) {
      setStatus(getErrorMessage(error.message, "Не удалось удалить заметку"), "error");
    }
  }

  async function togglePin(id) {
    try {
      await requestJson(`/notes/${id}/pin`, { method: "PUT" });
      await loadNotes();
    } catch (error) {
      setStatus(getErrorMessage(error.message, "Не удалось закрепить заметку"), "error");
    }
  }

  if (addNoteBtn) {
    addNoteBtn.addEventListener("click", addNote);
  }

  if (noteInput) {
    noteInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addNote();
      }
    });
  }

  if (sortBtn) {
    sortBtn.addEventListener("click", toggleSort);
  }

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => loadNotes(true));
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", toggleTheme);
  }

  applySavedTheme();
  updateSortButtonText();
  loadNotes();
})();
