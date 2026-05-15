document.addEventListener('DOMContentLoaded', () => {
  const fileListEl = document.getElementById('file-list');
  const logsContainerEl = document.getElementById('logs-container');
  const searchInput = document.getElementById('search-input');
  const levelFilter = document.getElementById('level-filter');
  const refreshBtn = document.getElementById('refresh-btn');
  const clearFileBtn = document.getElementById('clear-file-btn');
  const clearAllBtn = document.getElementById('clear-all-btn');

  let currentFile = null;
  let allLogs = [];

  // Load files on start
  loadFiles();

  async function loadFiles() {
    try {
      const res = await fetch('/api/logs');
      const data = await res.json();
      
      fileListEl.innerHTML = '';
      if (!data.files || data.files.length === 0) {
        fileListEl.innerHTML = '<div style="padding: 1.5rem; color: #94a3b8; font-size: 0.85rem; text-align: center;">No logs found</div>';
        logsContainerEl.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 4rem;">Directory is empty</div>';
        return;
      }

      data.files.forEach(file => {
        const li = document.createElement('li');
        li.className = `file-item ${currentFile === file ? 'active' : ''}`;
        li.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          ${file}
        `;
        li.addEventListener('click', () => {
          document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
          li.classList.add('active');
          loadLogs(file);
        });
        fileListEl.appendChild(li);
      });

      // Load first file if none selected or the currently selected file isn't in the list anymore
      if ((!currentFile || !data.files.includes(currentFile)) && data.files.length > 0) {
        fileListEl.firstChild.click();
      } else if (currentFile) {
        loadLogs(currentFile); // Reload active
      }
    } catch (err) {
      console.error("Failed to load files", err);
    }
  }

  async function loadLogs(filename) {
    currentFile = filename;
    logsContainerEl.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 4rem;">Loading logs...</div>';
    
    try {
      const res = await fetch(`/api/logs/${filename}`);
      const data = await res.json();
      allLogs = data.logs || [];
      renderLogs();
    } catch (err) {
      logsContainerEl.innerHTML = `<div style="color: var(--error); padding: 2rem; text-align: center;">Failed to load: ${err.message}</div>`;
    }
  }

  function renderLogs() {
    const query = searchInput.value.toLowerCase();
    const filterLevel = levelFilter.value;

    const filtered = allLogs.filter(log => {
      // Level check
      if (filterLevel !== 'all' && (log.level || 'unknown') !== filterLevel) return false;
      
      // Search check
      if (query) {
        const fullText = JSON.stringify(log).toLowerCase();
        return fullText.includes(query);
      }
      return true;
    });

    logsContainerEl.innerHTML = '';
    
    if (filtered.length === 0) {
      logsContainerEl.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 4rem;">No matching logs</div>';
      return;
    }

    filtered.forEach(log => {
      const el = document.createElement('div');
      el.className = 'log-entry';
      
      const level = log.level || 'info';
      const levelClass = `level-${level.toLowerCase()}`;
      
      let metaHtml = '';
      if (log.meta && Object.keys(log.meta).length > 0) {
        metaHtml = `<div class="log-meta">${JSON.stringify(log.meta, null, 2)}</div>`;
      } else {
        // Find other unhandled properties to show as meta
        const rest = {...log};
        delete rest.level; delete rest.message; delete rest.timestamp; delete rest.module; delete rest.stack; delete rest.meta;
        if (Object.keys(rest).length > 0) {
           metaHtml = `<div class="log-meta">${JSON.stringify(rest, null, 2)}</div>`;
        }
      }

      const stackHtml = log.stack ? `<div class="log-stack">${log.stack}</div>` : '';
      const moduleHtml = log.module ? `<span class="log-module">[${log.module}]</span>` : '';
      const timeHtml = log.timestamp ? `<span class="log-timestamp">${new Date(log.timestamp).toLocaleString()}</span>` : '';

      el.innerHTML = `
        <div class="log-header">
          <span class="log-level ${levelClass}">${level}</span>
          ${timeHtml}
          ${moduleHtml}
        </div>
        <div class="log-message">${log.message || JSON.stringify(log)}</div>
        ${stackHtml}
        ${metaHtml}
      `;
      logsContainerEl.appendChild(el);
    });
  }

  // Event Listeners
  searchInput.addEventListener('input', renderLogs);
  levelFilter.addEventListener('change', renderLogs);
  
  refreshBtn.addEventListener('click', () => {
    loadFiles();
  });

  clearFileBtn.addEventListener('click', async () => {
    if (!currentFile) return;
    if (confirm(`Are you sure you want to erase ${currentFile}?`)) {
      try {
        await fetch(`/api/logs/${currentFile}`, { method: 'DELETE' });
        loadLogs(currentFile);
      } catch (err) {
        alert("Failed to erase file");
      }
    }
  });

  clearAllBtn.addEventListener('click', async () => {
    if (confirm(`Are you sure you want to erase ALL log files?`)) {
      try {
        await fetch(`/api/logs`, { method: 'DELETE' });
        loadFiles();
      } catch (err) {
        alert("Failed to erase files");
      }
    }
  });
});
