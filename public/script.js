async function loadNotes() {
  const res = await fetch("/notes");
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
      <button onclick="deleteNote(${note.id})">❌</button>
    `;

    list.appendChild(li);
  });
}

async function deleteNote(id) {
  await fetch(`/notes/${id}`, {
    method: "DELETE"
  });

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

loadNotes();