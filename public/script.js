let currentOrder = "desc";

async function loadNotes() {
  const res = await fetch(`/notes?order=${currentOrder}`);
  const notes = await res.json();

  const list = document.getElementById("notesList");
  list.innerHTML = "";

  notes.forEach(note => {
    const li = document.createElement("li");

    li.innerHTML = `
      <div class="note-content">
        <div class="note-text">${note.text}</div>
        <div class="note-date">${note.created_at || ""}</div>
      </div>
      <div class="note-actions">
        <button onclick="editNote(${note.id}, \`${note.text.replace(/`/g, "\\`")}\`)">✏️</button>
        <button onclick="deleteNote(${note.id})">❌</button>
      </div>
    `;

    list.appendChild(li);
  });
}

function toggleSort() {
  currentOrder = currentOrder === "desc" ? "asc" : "desc";
  loadNotes();
}

async function addNote() {
  const input = document.getElementById("noteInput");
  const text = input.value.trim();

  if (!text) return;

  await fetch("/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });

  input.value = "";
  loadNotes();
}

async function deleteNote(id) {
  await fetch(`/notes/${id}`, {
    method: "DELETE"
  });

  loadNotes();
}

async function editNote(id, oldText) {
  const newText = prompt("Редактировать запись:", oldText);

  if (!newText) return;

  const trimmed = newText.trim();

  if (!trimmed) return;
  if (trimmed.length > 25000) return;

  await fetch(`/notes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: trimmed })
  });

  loadNotes();
}

loadNotes();