// ===== STATE & CONFIGURATION =====
let currentState = {
  sortOrder: 'desc',
  viewFilter: 'all',
  searchQuery: '',
  currentCategory: 'all',
  activeTags: new Set(),
  showArchived: false,
  userCategories: ['Все заметки', 'Закрепленные', 'Недавние'],
  dragEnabled: false,
  autoSaveInterval: null
};

let dragData = {
  dragging: false,
  draggedId: null,
  draggedElement: null
};

let pendingAction = null;

// ===== THEME MANAGEMENT =====
function applySavedTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.body.classList.remove('light', 'dark');
  document.body.classList.add(savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const isDark = document.body.classList.contains('dark');
  const newTheme = isDark ? 'light' : 'dark';
  
  document.body.classList.remove('light', 'dark');
  document.body.classList.add(newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
  const icon = document.querySelector('#themeToggle i');
  if (!icon) return;
  
  if (theme === 'dark') {
    icon.className = 'fas fa-sun';
    icon.title = 'Светлая тема';
  } else {
    icon.className = 'fas fa-moon';
    icon.title = 'Тёмная тема';
  }
}

// ===== INITIALIZATION =====
function initApp() {
  applySavedTheme();
  setupEventListeners();
  setupDragAndDrop();
  setupAutoSave();
  loadUserCategories();
  loadNotes();
  updateStats();
  setupTemplateSystem();
}

function setupEventListeners() {
  // Search
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => {
      currentState.searchQuery = searchInput.value.trim();
      loadNotes();
    }, 300));
  }
  
  // Sort
  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      currentState.sortOrder = sortSelect.value;
      loadNotes();
    });
  }
  
  // View filter
  const viewSelect = document.getElementById('viewSelect');
  if (viewSelect) {
    viewSelect.addEventListener('change', () => {
      currentState.viewFilter = viewSelect.value;
      loadNotes();
    });
  }
  
  // Categories
  document.querySelectorAll('.categories li').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.categories li').forEach(li => li.classList.remove('active'));
      item.classList.add('active');
      currentState.currentCategory = item.dataset.category;
      loadNotes();
    });
  });
  
  // Tags
  document.querySelectorAll('.tag, .btn-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      const tagText = tag.dataset.tag || tag.textContent;
      toggleTag(tagText);
    });
  });
  
  // New tag input
  const newTagInput = document.getElementById('newTagInput');
  if (newTagInput) {
    newTagInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && newTagInput.value.trim()) {
        addNewTag(newTagInput.value.trim());
        newTagInput.value = '';
      }
    });
  }
  
  // Export button
  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportNotes);
  }
  
  // Filter toggle
  const filterToggle = document.getElementById('filterToggle');
  if (filterToggle) {
    filterToggle.addEventListener('click', () => {
      const filterBar = document.getElementById('filterBar');
      filterBar.classList.toggle('hidden');
    });
  }
  
  // Enter key to add note
  const noteInput = document.getElementById('noteInput');
  if (noteInput) {
    noteInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        addNote();
      }
    });
  }
}

// ===== NOTES MANAGEMENT =====
async function loadNotes() {
  try {
    const params = new URLSearchParams({
      order: currentState.sortOrder,
      view: currentState.viewFilter,
      category: currentState.currentCategory,
      search: currentState.searchQuery,
      tags: Array.from(currentState.activeTags).join(',')
    });
    
    const res = await fetch(`/notes?${params}`);
    if (!res.ok) throw new Error('Failed to load notes');
    
    const notes = await res.json();
    renderNotes(notes);
    updateStats();
  } catch (error) {
    console.error('Error loading notes:', error);
    showNotification('Ошибка загрузки заметок', 'error');
  }
}

function renderNotes(notes) {
  const notesGrid = document.getElementById('notesGrid');
  const emptyState = document.getElementById('emptyState');
  
  if (!notesGrid || !emptyState) return;
  
  if (notes.length === 0) {
    notesGrid.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }
  
  emptyState.classList.add('hidden');
  
  notesGrid.innerHTML = notes.map(note => `
    <div class="note-card ${note.pinned ? 'pinned' : ''} ${getPriorityClass(note.priority)}" 
         data-id="${note.id}">
      <div class="note-header">
        <h3 class="note-title">${escapeHtml(truncateText(note.text, 50))}</h3>
        <div class="note-actions">
          <button class="btn-icon" onclick="togglePin(${note.id})" title="${note.pinned ? 'Открепить' : 'Закрепить'}">
            <i class="${note.pinned ? 'fas fa-thumbtack' : 'fas fa-map-pin'}"></i>
          </button>
          <button class="btn-icon" onclick="editNote(${note.id})" title="Редактировать">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-icon" onclick="confirmDelete(${note.id})" title="Удалить">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
      <div class="note-content">
        ${escapeHtml(note.text)}
      </div>
      <div class="note-footer">
        <div class="note-tags">
          ${note.tags ? note.tags.split(',').map(tag => `
            <span class="note-tag">${escapeHtml(tag.trim())}</span>
          `).join('') : ''}
        </div>
        <div class="note-date">
          <i class="far fa-clock"></i> ${note.created_at || formatDate(new Date())}
        </div>
      </div>
    </div>
  `).join('');
}

function getPriorityClass(priority) {
  switch (parseInt(priority)) {
    case 3: return 'high-priority';
    case 2: return 'medium-priority';
    case 1: return 'low-priority';
    default: return '';
  }
}

// ===== NOTE CRUD OPERATIONS =====
async function addNote() {
  const input = document.getElementById('noteInput');
  const prioritySelect = document.getElementById('prioritySelect');
  const tags = Array.from(currentState.activeTags);
  
  const text = input.value.trim();
  if (!text) {
    showNotification('Введите текст заметки', 'warning');
    return;
  }

  try {
    const response = await fetch('/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        priority: prioritySelect?.value || 2,
        tags: tags.join(',')
      })
    });
    
    if (!response.ok) throw new Error('Failed to add note');
    
    input.value = '';
    showNotification('Заметка добавлена', 'success');
    loadNotes();
  } catch (error) {
    console.error('Error adding note:', error);
    showNotification('Ошибка добавления заметки', 'error');
  }
}

async function editNote(id) {
  const noteCard = document.querySelector(`.note-card[data-id="${id}"]`);
  const currentText = noteCard?.querySelector('.note-content').textContent;
  
  const newText = prompt('Редактировать заметку:', currentText);
  if (!newText || newText.trim() === '') return;
  
  const trimmedText = newText.trim();
  if (trimmedText.length > 25000) {
    showNotification('Заметка слишком длинная (макс. 25000 символов)', 'warning');
    return;
  }
  
  try {
    const response = await fetch(`/notes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: trimmedText })
    });
    
    if (!response.ok) throw new Error('Failed to update note');
    
    showNotification('Заметка обновлена', 'success');
    loadNotes();
  } catch (error) {
    console.error('Error updating note:', error);
    showNotification('Ошибка обновления заметки', 'error');
  }
}

function confirmDelete(id) {
  pendingAction = { type: 'delete', id };
  const modal = document.getElementById('confirmModal');
  const message = document.getElementById('confirmMessage');
  
  if (modal && message) {
    message.textContent = 'Вы уверены, что хотите удалить эту заметку?';
    modal.classList.add('active');
  }
}

async function deleteNote(id) {
  try {
    const response = await fetch(`/notes/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) throw new Error('Failed to delete note');
    
    showNotification('Заметка удалена', 'success');
    loadNotes();
  } catch (error) {
    console.error('Error deleting note:', error);
    showNotification('Ошибка удаления заметки', 'error');
  }
}

async function togglePin(id) {
  try {
    const response = await fetch(`/notes/${id}/pin`, {
      method: 'PUT'
    });
    
    if (!response.ok) throw new Error('Failed to toggle pin');
    
    loadNotes();
  } catch (error) {
    console.error('Error toggling pin:', error);
    showNotification('Ошибка изменения статуса заметки', 'error');
  }
}

// ===== TAGS MANAGEMENT =====
function toggleTag(tag) {
  if (currentState.activeTags.has(tag)) {
    currentState.activeTags.delete(tag);
  } else {
    currentState.activeTags.add(tag);
  }
  
  // Update UI
  document.querySelectorAll('.tag, .btn-tag').forEach(element => {
    const tagText = element.dataset.tag || element.textContent;
    if (tagText === tag) {
      element.classList.toggle('active');
    }
  });

  loadNotes();
}

function addNewTag(tag) {
  if (!tag || tag.length > 20) return;
  
  // Add to state
  currentState.activeTags.add(tag);
  
  // Add to UI
  const tagsContainer = document.querySelector('.tags');
  if (tagsContainer) {
    const tagElement = document.createElement('span');
    tagElement.className = 'tag active';
    tagElement.dataset.tag = tag;
    tagElement.textContent = tag;
    tagElement.addEventListener('click', () => toggleTag(tag));
    tagsContainer.appendChild(tagElement);
  }
}

// ===== FILTERS =====
function clearFilters() {
  currentState = {
    sortOrder: 'desc',
    viewFilter: 'all',
    searchQuery: '',
    currentCategory: 'all',
    activeTags: new Set()
  };
  
  // Reset UI
  const searchInput = document.getElementById('searchInput');
  const sortSelect = document.getElementById('sortSelect');
  const viewSelect = document.getElementById('viewSelect');
  
  if (searchInput) searchInput.value = '';
  if (sortSelect) sortSelect.value = 'desc';
  if (viewSelect) viewSelect.value = 'all';
  
  // Reset categories
  document.querySelectorAll('.categories li').forEach(li => {
    li.classList.remove('active');
    if (li.dataset.category === 'all') li.classList.add('active');
  });
  
  // Reset tags
  document.querySelectorAll('.tag, .btn-tag').forEach(el => {
    el.classList.remove('active');
  });
  
  loadNotes();
}

// ===== STATS & EXPORT =====
function updateStats() {
  // In a real app, you would fetch actual counts from the server
  document.getElementById('countAll').textContent = '...';
  document.getElementById('countPinned').textContent = '...';
  document.getElementById('countRecent').textContent = '...';
}

function exportNotes() {
  // Simple export to JSON
  fetch('/notes?order=desc')
    .then(res => res.json())
    .then(notes => {
      const dataStr = JSON.stringify(notes, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `notes_${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      showNotification('Заметки экспортированы в JSON', 'success');
    })
    .catch(error => {
      console.error('Export error:', error);
      showNotification('Ошибка экспорта', 'error');
    });
}

// ===== MODAL MANAGEMENT =====
function closeModal() {
  const modal = document.getElementById('confirmModal');
  if (modal) modal.classList.remove('active');
  pendingAction = null;
}

function confirmAction() {
  if (!pendingAction) return;
  
  switch (pendingAction.type) {
    case 'delete':
      deleteNote(pendingAction.id);
      break;
  }
  
  closeModal();
}

// ===== UTILITY FUNCTIONS =====
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(date) {
  return new Intl.DateTimeFormat('ru-RU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function showNotification(message, type = 'info') {
  // Simple notification implementation
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
    <span>${message}</span>
  `;
  
  document.body.appendChild(notification);
  
  // Add styles if not already present
  if (!document.querySelector('#notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
      .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        border-radius: 12px;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        box-shadow: var(--shadow-lg);
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 9999;
        animation: slideInRight 0.3s ease-out;
        max-width: 400px;
      }
      
      .notification.success {
        border-left: 4px solid var(--success);
      }
      
      .notification.error {
        border-left: 4px solid var(--danger);
      }
      
      .notification.warning {
        border-left: 4px solid var(--warning);
      }
      
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }
  
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateY(-10px)';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// ===== INITIALIZE APP =====
document.addEventListener('DOMContentLoaded', initApp);

// Setup modal confirm button
const confirmActionBtn = document.getElementById('confirmActionBtn');
if (confirmActionBtn) {
  confirmActionBtn.addEventListener('click', confirmAction);
}

// Close modal on background click
const modal = document.getElementById('confirmModal');
if (modal) {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

// ===== NEW MODAL FUNCTIONS =====
function showAboutModal() {
  const modal = document.getElementById('aboutModal');
  if (modal) modal.classList.add('active');
}

function closeAboutModal() {
  const modal = document.getElementById('aboutModal');
  if (modal) modal.classList.remove('active');
}

function showHelpModal() {
  const modal = document.getElementById('helpModal');
  if (modal) modal.classList.add('active');
}

function closeHelpModal() {
  const modal = document.getElementById('helpModal');
  if (modal) modal.classList.remove('active');
}

function showSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (modal) modal.classList.add('active');
}

function closeSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (modal) modal.classList.remove('active');
}

function saveSettings() {
  const autoSave = document.getElementById('autoSaveSetting').checked;
  const confirmDelete = document.getElementById('confirmDeleteSetting').checked;
  const showAnimations = document.getElementById('showAnimationsSetting').checked;
  const notesPerPage = document.getElementById('notesPerPage').value;
  
  // Save to localStorage
  localStorage.setItem('appSettings', JSON.stringify({
    autoSave,
    confirmDelete,
    showAnimations,
    notesPerPage
  }));
  
  showNotification('Настройки сохранены', 'success');
  closeSettingsModal();
}

function loadSettings() {
  const saved = localStorage.getItem('appSettings');
  if (saved) {
    const settings = JSON.parse(saved);
    const autoSaveCheckbox = document.getElementById('autoSaveSetting');
    const confirmDeleteCheckbox = document.getElementById('confirmDeleteSetting');
    const showAnimationsCheckbox = document.getElementById('showAnimationsSetting');
    const notesPerPageSelect = document.getElementById('notesPerPage');
    
    if (autoSaveCheckbox) autoSaveCheckbox.checked = settings.autoSave;
    if (confirmDeleteCheckbox) confirmDeleteCheckbox.checked = settings.confirmDelete;
    if (showAnimationsCheckbox) showAnimationsCheckbox.checked = settings.showAnimations;
    if (notesPerPageSelect) notesPerPageSelect.value = settings.notesPerPage;
  }
}

// Setup event listeners for new modals
document.addEventListener('DOMContentLoaded', () => {
  // About modal
  const aboutModal = document.getElementById('aboutModal');
  if (aboutModal) {
    aboutModal.addEventListener('click', (e) => {
      if (e.target === aboutModal) closeAboutModal();
    });
  }
  
  // Help modal
  const helpModal = document.getElementById('helpModal');
  if (helpModal) {
    helpModal.addEventListener('click', (e) => {
      if (e.target === helpModal) closeHelpModal();
    });
  }
  
  // Settings modal
  const settingsModal = document.getElementById('settingsModal');
  if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) closeSettingsModal();
    });
  }
  
  // Load saved settings
  loadSettings();
});

// ===== 10 НОВЫХ ФУНКЦИЙ =====

// 1. АРХИВАЦИЯ ЗАМЕТОК
async function archiveNote(id) {
  try {
    const response = await fetch(`/notes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: true })
    });
    
    if (!response.ok) throw new Error('Failed to archive note');
    
    showNotification('Заметка архивирована', 'success');
    loadNotes();
  } catch (error) {
    console.error('Error archiving note:', error);
    showNotification('Ошибка архивации заметки', 'error');
  }
}

async function unarchiveNote(id) {
  try {
    const response = await fetch(`/notes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: false })
    });
    
    if (!response.ok) throw new Error('Failed to unarchive note');
    
    showNotification('Заметка восстановлена', 'success');
    loadNotes();
  } catch (error) {
    console.error('Error unarchiving note:', error);
    showNotification('Ошибка восстановления заметки', 'error');
  }
}

function toggleArchiveView() {
  currentState.showArchived = !currentState.showArchived;
  const archiveBtn = document.getElementById('archiveToggle');
  if (archiveBtn) {
    archiveBtn.innerHTML = currentState.showArchived ? 
      '<i class="fas fa-box-open"></i> Показать активные' : 
      '<i class="fas fa-archive"></i> Показать архив';
  }
  loadNotes();
}

// 2. НАПОМИНАНИЯ
async function setReminder(id) {
  const reminderTime = prompt('Введите дату и время напоминания (формат: ГГГГ-ММ-ДД ЧЧ:ММ):');
  if (!reminderTime) return;
  
  try {
    const response = await fetch(`/notes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reminder: reminderTime })
    });
    
    if (!response.ok) throw new Error('Failed to set reminder');
    
    showNotification('Напоминание установлено', 'success');
    loadNotes();
  } catch (error) {
    console.error('Error setting reminder:', error);
    showNotification('Ошибка установки напоминания', 'error');
  }
}

async function removeReminder(id) {
  try {
    const response = await fetch(`/notes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reminder: '' })
    });
    
    if (!response.ok) throw new Error('Failed to remove reminder');
    
    showNotification('Напоминание удалено', 'success');
    loadNotes();
  } catch (error) {
    console.error('Error removing reminder:', error);
    showNotification('Ошибка удаления напоминания', 'error');
  }
}

function checkReminders() {
  // Проверяем напоминания каждую минуту
  setInterval(() => {
    const now = new Date();
    const nowStr = now.toISOString().slice(0, 16).replace('T', ' ');
    
    // В реальном приложении здесь был бы запрос к серверу
    // для проверки напоминаний
    console.log('Checking reminders at:', nowStr);
  }, 60000);
}

// 3. ИМПОРТ ЗАМЕТОК
function importNotes() {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json';
  
  fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const notes = JSON.parse(text);
      
      if (!Array.isArray(notes)) {
        throw new Error('Invalid file format');
      }
      
      let importedCount = 0;
      for (const note of notes) {
        try {
          const response = await fetch('/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: note.text || '',
              priority: note.priority || 2,
              tags: note.tags || '',
              template: note.template || '',
              theme: note.theme || 'default',
              reminder: note.reminder || ''
            })
          });
          
          if (response.ok) importedCount++;
        } catch (error) {
          console.error('Error importing note:', error);
        }
      }
      
      showNotification(`Импортировано ${importedCount} заметок`, 'success');
      loadNotes();
    } catch (error) {
      console.error('Error importing notes:', error);
      showNotification('Ошибка импорта файла', 'error');
    }
  };
  
  fileInput.click();
}

// 4. КАТЕГОРИИ ПОЛЬЗОВАТЕЛЯ
function loadUserCategories() {
  const saved = localStorage.getItem('userCategories');
  if (saved) {
    currentState.userCategories = JSON.parse(saved);
    renderUserCategories();
  }
}

function saveUserCategories() {
  localStorage.setItem('userCategories', JSON.stringify(currentState.userCategories));
}

function renderUserCategories() {
  const categoriesList = document.querySelector('.categories');
  if (!categoriesList) return;
  
  // Оставляем только системные категории
  const systemCategories = categoriesList.querySelectorAll('li[data-category]');
  const userCategoriesContainer = document.createElement('div');
  userCategoriesContainer.className = 'user-categories';
  
  currentState.userCategories.forEach((category, index) => {
    if (['all', 'pinned', 'recent'].includes(category)) return;
    
    const categoryItem = document.createElement('div');
    categoryItem.className = 'user-category-item';
    categoryItem.innerHTML = `
      <span>${category}</span>
      <button class="btn-icon" onclick="removeUserCategory(${index})" title="Удалить">
        <i class="fas fa-times"></i>
      </button>
    `;
    userCategoriesContainer.appendChild(categoryItem);
  });
  
  // Добавляем поле для новой категории
  const addCategoryDiv = document.createElement('div');
  addCategoryDiv.className = 'add-category';
  addCategoryDiv.innerHTML = `
    <input type="text" id="newCategoryInput" placeholder="Новая категория">
    <button class="btn-secondary" onclick="addUserCategory()">
      <i class="fas fa-plus"></i>
    </button>
  `;
  userCategoriesContainer.appendChild(addCategoryDiv);
  
  // Удаляем старые пользовательские категории и добавляем новые
  const oldContainer = categoriesList.querySelector('.user-categories');
  if (oldContainer) oldContainer.remove();
  
  categoriesList.appendChild(userCategoriesContainer);
}

function addUserCategory() {
  const input = document.getElementById('newCategoryInput');
  const category = input.value.trim();
  
  if (category && !currentState.userCategories.includes(category)) {
    currentState.userCategories.push(category);
    saveUserCategories();
    renderUserCategories();
    input.value = '';
    showNotification('Категория добавлена', 'success');
  }
}

function removeUserCategory(index) {
  currentState.userCategories.splice(index, 1);
  saveUserCategories();
  renderUserCategories();
  showNotification('Категория удалена', 'success');
}

// 5. ШАБЛОНЫ ЗАМЕТОК
function setupTemplateSystem() {
  const templateSelect = document.getElementById('templateSelect');
  if (templateSelect) {
    templateSelect.addEventListener('change', applyTemplate);
  }
}

function applyTemplate() {
  const templateSelect = document.getElementById('templateSelect');
  const noteInput = document.getElementById('noteInput');
  
  if (!templateSelect || !noteInput) return;
  
  const template = templateSelect.value;
  let templateText = '';
  
  switch (template) {
    case 'todo':
      templateText = '## Список дел\n\n- [ ] Задача 1\n- [ ] Задача 2\n- [ ] Задача 3';
      break;
    case 'meeting':
      templateText = '## Встреча\n\n**Дата:** \n**Участники:** \n**Повестка:** \n\n1. \n2. \n3. \n\n**Итоги:**';
      break;
    case 'idea':
      templateText = '## Идея\n\n**Описание:** \n\n**Преимущества:**\n- \n- \n\n**Недостатки:**\n- \n- \n\n**Действия:**';
      break;
    case 'shopping':
      templateText = '## Список покупок\n\n- [ ] \n- [ ] \n- [ ] \n- [ ] \n- [ ]';
      break;
    default:
      return;
  }
  
  noteInput.value = templateText;
}

// 6. MARKDOWN ПОДДЕРЖКА
function renderMarkdown(text) {
  // Простой Markdown парсер
  let html = escapeHtml(text);
  
  // Заголовки
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  
  // Жирный текст
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  
  // Курсив
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  
  // Списки
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^(\s*)- (.+)$/gm, '$1<li>$2</li>');
  html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
  
  // Чекбоксы
  html = html.replace(/^- \[ \] (.+)$/gm, '<li><input type="checkbox"> $1</li>');
  html = html.replace(/^- \[x\] (.+)$/gm, '<li><input type="checkbox" checked> $1</li>');
  
  // Код
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');
  
  // Блоки кода
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  
  // Ссылки
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>');
  
  // Перенос строк
  html = html.replace(/\n/g, '<br>');
  
  return html;
}

// 7. ТЕМЫ ОФОРМЛЕНИЯ
async function changeNoteTheme(id, theme) {
  try {
    const response = await fetch(`/notes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme })
    });
    
    if (!response.ok) throw new Error('Failed to change theme');
    
    showNotification('Тема изменена', 'success');
    loadNotes();
  } catch (error) {
    console.error('Error changing theme:', error);
    showNotification('Ошибка изменения темы', 'error');
  }
}

// 8. КЛОНИРОВАНИЕ ЗАМЕТОК
async function cloneNote(id) {
  try {
    const response = await fetch(`/notes/${id}`);
    if (!response.ok) throw new Error('Failed to get note');
    
    const note = await response.json();
    
    const cloneResponse = await fetch('/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `${note.text} (копия)`,
        priority: note.priority,
        tags: note.tags,
        template: note.template,
        theme: note.theme,
        reminder: note.reminder
      })
    });
    
    if (!cloneResponse.ok) throw new Error('Failed to clone note');
    
    showNotification('Заметка скопирована', 'success');
    loadNotes();
  } catch (error) {
    console.error('Error cloning note:', error);
    showNotification('Ошибка копирования заметки', 'error');
  }
}

// 9. DRAG & DROP СОРТИРОВКА
function setupDragAndDrop() {
  const notesGrid = document.getElementById('notesGrid');
  if (!notesGrid) return;
  
  notesGrid.addEventListener('mousedown', startDrag);
  notesGrid.addEventListener('touchstart', startDrag);
  document.addEventListener('mousemove', handleDrag);
  document.addEventListener('touchmove', handleDrag);
  document.addEventListener('mouseup', stopDrag);
  document.addEventListener('touchend', stopDrag);
}

function startDrag(e) {
  if (!currentState.dragEnabled) return;
  
  const target = e.target.closest('.note-card');
  if (!target) return;
  
  e.preventDefault();
  dragData.dragging = true;
  dragData.draggedId = target.dataset.id;
  dragData.draggedElement = target;
  
  target.classList.add('dragging');
  document.getElementById('notesGrid').classList.add('drag-active');
}

function handleDrag(e) {
  if (!dragData.dragging) return;
  
  e.preventDefault();
  
  // В реальном приложении здесь была бы логика
  // перемещения элемента и обновления позиций
}

async function stopDrag() {
  if (!dragData.dragging) return;
  
  dragData.dragging = false;
  
  if (dragData.draggedElement) {
    dragData.draggedElement.classList.remove('dragging');
  }
  
  document.getElementById('notesGrid').classList.remove('drag-active');
  
  // Сохраняем новую позицию
  if (dragData.draggedId) {
    try {
      await fetch(`/notes/${dragData.draggedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          position: Date.now() // Временная позиция
        })
      });
    } catch (error) {
      console.error('Error saving position:', error);
    }
  }
  
  dragData.draggedId = null;
  dragData.draggedElement = null;
}

function toggleDragMode() {
  currentState.dragEnabled = !currentState.dragEnabled;
  const dragBtn = document.getElementById('dragToggle');
  if (dragBtn) {
    dragBtn.innerHTML = currentState.dragEnabled ? 
      '<i class="fas fa-hand-paper"></i> Отключить перетаскивание' : 
      '<i class="fas fa-hand-rock"></i> Включить перетаскивание';
  }
  
  showNotification(
    currentState.dragEnabled ? 
    'Режим перетаскивания включен' : 
    'Режим перетаскивания выключен',
    'info'
  );
}

// 10. АВТОСОХРАНЕНИЕ
function setupAutoSave() {
  const noteInput = document.getElementById('noteInput');
  if (!noteInput) return;
  
  noteInput.addEventListener('input', debounce(() => {
    const text = noteInput.value.trim();
    if (text) {
      saveDraft();
    }
  }, 2000));
}

function saveDraft() {
  const noteInput = document.getElementById('noteInput');
  const text = noteInput.value.trim();
  
  if (!text) return;
  
  localStorage.setItem('noteDraft', text);
  showNotification('Черновик сохранен', 'info');
}

function loadDraft() {
  const draft = localStorage.getItem('noteDraft');
  if (draft) {
    const noteInput = document.getElementById('noteInput');
    if (noteInput) {
      noteInput.value = draft;
      showNotification('Черновик загружен', 'info');
    }
  }
}

function clearDraft() {
  localStorage.removeItem('noteDraft');
  const noteInput = document.getElementById('noteInput');
  if (noteInput) noteInput.value = '';
  showNotification('Черновик удален', 'info');
}

// ОБНОВЛЕННЫЙ RENDERNOTES С НОВЫМИ ФУНКЦИЯМИ
function renderNotes(notes) {
  const notesGrid = document.getElementById('notesGrid');
  const emptyState = document.getElementById('emptyState');
  
  if (!notesGrid || !emptyState) return;
  
  if (notes.length === 0) {
    notesGrid.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }
  
  emptyState.classList.add('hidden');
  
  notesGrid.innerHTML = notes.map(note => `
    <div class="note-card ${note.pinned ? 'pinned' : ''} ${getPriorityClass(note.priority)} ${note.archived ? 'archived' : ''} ${note.theme !== 'default' ? 'theme-' + note.theme : ''}" 
         data-id="${note.id}" draggable="${currentState.dragEnabled}">
      <div class="note-header">
        <h3 class="note-title">${escapeHtml(truncateText(note.text, 50))}
          ${note.reminder ? `<span class="reminder-badge"><i class="far fa-clock"></i> ${formatReminderDate(note.reminder)}</span>` : ''}
        </h3>
        <div class="note-actions">
          <button class="btn-icon" onclick="togglePin(${note.id})" title="${note.pinned ? 'Открепить' : 'Закрепить'}">
            <i class="${note.pinned ? 'fas fa-thumbtack' : 'fas fa-map-pin'}"></i>
          </button>
          <button class="btn-icon" onclick="cloneNote(${note.id})" title="Копировать">
            <i class="fas fa-copy"></i>
          </button>
          <button class="btn-icon" onclick="editNote(${note.id})" title="Редактировать">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-icon" onclick="confirmDelete(${note.id})" title="Удалить">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
      <div class="note-content markdown-content">
        ${renderMarkdown(note.text)}
      </div>
      <div class="note-footer">
        <div class="note-tags">
          ${note.tags ? note.tags.split(',').map(tag => `
            <span class="note-tag">${escapeHtml(tag.trim())}</span>
          `).join('') : ''}
        </div>
        <div class="note-extra-actions">
          ${note.archived ? 
            `<button class="btn-icon" onclick="unarchiveNote(${note.id})" title="Восстановить">
              <i class="fas fa-box-open"></i>
            </button>` : 
            `<button class="btn-icon" onclick="archiveNote(${note.id})" title="Архивировать">
              <i class="fas fa-archive"></i>
            </button>`
          }
          ${note.reminder ? 
            `<button class="btn-icon" onclick="removeReminder(${note.id})" title="Удалить напоминание">
              <i class="far fa-bell-slash"></i>
            </button>` : 
            `<button class="btn-icon" onclick="setReminder(${note.id})" title="Добавить напоминание">
              <i class="far fa-bell"></i>
            </button>`
          }
          <button class="btn-icon" onclick="changeNoteTheme(${note.id}, 'blue')" title="Голубая тема">
            <i class="fas fa-palette" style="color: #2196f3;"></i>
          </button>
          <button class="btn-icon" onclick="changeNoteTheme(${note.id}, 'green')" title="Зеленая тема">
            <i class="fas fa-palette" style="color: #4caf50;"></i>
          </button>
          <button class="btn-icon" onclick="changeNoteTheme(${note.id}, 'default')" title="Обычная тема">
            <i class="fas fa-palette"></i>
          </button>
        </div>
        <div class="note-date">
          <i class="far fa-clock"></i> ${note.created_at || formatDate(new Date())}
          ${note.clone_count > 0 ? `<span style="margin-left: 8px;"><i class="fas fa-copy"></i> ${note.clone_count}</span>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

function formatReminderDate(reminder) {
  try {
    const date = new Date(reminder);
    return date.toLocaleString('ru-RU', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return reminder;
  }
}

// ОБНОВЛЕННЫЙ ADDNOTE С НОВЫМИ ПОЛЯМИ
async function addNote() {
  const input = document.getElementById('noteInput');
  const prioritySelect = document.getElementById('prioritySelect');
  const templateSelect = document.getElementById('templateSelect');
  const themeSelect = document.getElementById('noteThemeSelect');
  const tags = Array.from(currentState.activeTags);
  
  const text = input.value.trim();
  if (!text) {
    showNotification('Введите текст заметки', 'warning');
    return;
  }

  try {
    const response = await fetch('/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        priority: prioritySelect?.value || 2,
        tags: tags.join(','),
        template: templateSelect?.value || '',
        theme: themeSelect?.value || 'default'
      })
    });
    
    if (!response.ok) throw new Error('Failed to add note');
    
    input.value = '';
    if (templateSelect) templateSelect.value = '';
    clearDraft();
    showNotification('Заметка добавлена', 'success');
    loadNotes();
  } catch (error) {
    console.error('Error adding note:', error);
    showNotification('Ошибка добавления заметки', 'error');
  }
}

// ДОБАВЛЕНИЕ НОВЫХ КНОПОК В ИНТЕРФЕЙС
function addNewButtons() {
  const filterBar = document.querySelector('.filter-bar');
  if (!filterBar) return;
  
  // Кнопка архива
  const archiveBtn = document.createElement('button');
  archiveBtn.className = 'btn-secondary';
  archiveBtn.id = 'archiveToggle';
  archiveBtn.innerHTML = '<i class="fas fa-archive"></i> Показать архив';
  archiveBtn.onclick = toggleArchiveView;
  
  // Кнопка перетаскивания
  const dragBtn = document.createElement('button');
  dragBtn.className = 'btn-secondary';
  dragBtn.id = 'dragToggle';
  dragBtn.innerHTML = '<i class="fas fa-hand-rock"></i> Включить перетаскивание';
  dragBtn.onclick = toggleDragMode;
  
  // Кнопка импорта
  const importBtn = document.createElement('button');
  importBtn.className = 'btn-secondary';
  importBtn.innerHTML = '<i class="fas fa-file-import"></i> Импорт';
  importBtn.onclick = importNotes;
  
  // Кнопка загрузки черновика
  const loadDraftBtn = document.createElement('button');
  loadDraftBtn.className = 'btn-secondary';
  loadDraftBtn.innerHTML = '<i class="fas fa-file-download"></i> Загрузить черновик';
  loadDraftBtn.onclick = loadDraft;
  
  filterBar.appendChild(archiveBtn);
  filterBar.appendChild(dragBtn);
  filterBar.appendChild(importBtn);
  filterBar.appendChild(loadDraftBtn);
}

// ИНИЦИАЛИЗАЦИЯ ВСЕХ ФУНКЦИЙ
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  addNewButtons();
  checkReminders();
});