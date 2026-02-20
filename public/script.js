async function loadNotes() {
  const res = await fetch("/notes");
  const notes = await res.json();

  const list = document.getElementById("notesList");
  list.innerHTML = "";

  notes.forEach(note => {
    const li = document.createElement("li");

    li.innerHTML = `
      ${note.text}
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
  const text = input.value;

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