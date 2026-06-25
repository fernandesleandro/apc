/**
 * Utilitários compartilhados do painel administrativo AP Construções
 */
(function (global) {
  'use strict';

  const FA_ICONS = [
    { value: 'fa-building', label: 'Edifício' },
    { value: 'fa-tools', label: 'Ferramentas' },
    { value: 'fa-book-open', label: 'Manual' },
    { value: 'fa-file-contract', label: 'Contrato' },
    { value: 'fa-file-invoice-dollar', label: 'Boleto' },
    { value: 'fa-hard-hat', label: 'Obra' },
    { value: 'fa-route', label: 'Rota' },
    { value: 'fa-hospital-symbol', label: 'Saúde' },
    { value: 'fa-graduation-cap', label: 'Educação' },
    { value: 'fa-store', label: 'Comércio' },
    { value: 'fa-car', label: 'Carro' },
    { value: 'fa-shield-alt', label: 'Segurança' },
    { value: 'fa-dumbbell', label: 'Academia' },
    { value: 'fa-swimmer', label: 'Piscina' },
    { value: 'fa-users', label: 'Pessoas' },
    { value: 'fa-phone-alt', label: 'Telefone' },
    { value: 'fa-envelope', label: 'E-mail' },
    { value: 'fa-map-marker-alt', label: 'Local' },
    { value: 'fa-pencil-ruler', label: 'Projeto' },
    { value: 'fa-check', label: 'Check' }
  ];

  function slugify(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }

  function createDirtyTracker(root) {
    let dirty = false;
    const listeners = [];

    function setDirty(value) {
      dirty = Boolean(value);
      listeners.forEach((fn) => fn(dirty));
    }

    function markDirty() {
      setDirty(true);
    }

    function markClean() {
      setDirty(false);
    }

    if (root) {
      root.addEventListener('input', markDirty, true);
      root.addEventListener('change', markDirty, true);
    }

    function onDirtyChange(fn) {
      listeners.push(fn);
      fn(dirty);
    }

    function confirmLeave(message) {
      if (!dirty) return true;
      return global.confirm(message || 'Há alterações não salvas. Deseja sair mesmo assim?');
    }

    global.addEventListener('beforeunload', (e) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    });

    return { markDirty, markClean, isDirty: () => dirty, onDirtyChange, confirmLeave };
  }

  function initTabPersistence(tabSelector, contentPrefix, options) {
    const opts = options || {};
    const hashKey = opts.hashKey || 'tab';

    function activateTab(tabName, pushState) {
      const tabBtn = document.querySelector(`${tabSelector}[data-tab="${tabName}"], ${tabSelector}[data-section="${tabName}"]`);
      if (!tabBtn) return;
      tabBtn.click();
      if (pushState !== false) {
        const url = new URL(global.location.href);
        if (opts.useQuery) {
          url.searchParams.set('tab', tabName);
          url.hash = '';
        } else {
          url.hash = tabName;
        }
        global.history.replaceState({}, '', url);
      }
    }

    const initial = opts.useQuery
      ? new URLSearchParams(global.location.search).get('tab')
      : global.location.hash.replace('#', '');
    if (initial) activateTab(initial, false);

    document.querySelectorAll(tabSelector).forEach((btn) => {
      btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-tab') || btn.getAttribute('data-section');
        if (!name) return;
        const url = new URL(global.location.href);
        if (opts.useQuery) {
          url.searchParams.set('tab', name);
          url.hash = '';
        } else {
          url.hash = name;
        }
        global.history.replaceState({}, '', url);
      });
    });

    return { activateTab };
  }

  function initStickySaveBar(config) {
    const bar = document.createElement('div');
    bar.className = 'admin-sticky-bar';
    bar.innerHTML = `
      <div class="admin-sticky-bar__status" id="adminDirtyStatus">
        <span class="dirty-dot" aria-hidden="true"></span>
        <span id="adminDirtyText">Nenhuma alteração pendente</span>
        ${config.checklistHtml || ''}
      </div>
      <div class="admin-sticky-bar__actions">
        ${config.discardBtn ? '<button type="button" class="btn-secondary" id="adminDiscardBtn"><i class="fas fa-undo"></i> Descartar</button>' : ''}
        <button type="button" class="btn-primary" id="adminSaveAllBtn"><i class="fas fa-save"></i> Salvar tudo</button>
      </div>
    `;
    document.body.appendChild(bar);
    document.body.classList.add('has-admin-sticky-bar');

    const statusEl = bar.querySelector('#adminDirtyStatus');
    const textEl = bar.querySelector('#adminDirtyText');

    if (config.tracker) {
      config.tracker.onDirtyChange((dirty) => {
        statusEl.classList.toggle('is-dirty', dirty);
        textEl.textContent = dirty ? 'Alterações não salvas' : 'Nenhuma alteração pendente';
      });
    }

    bar.querySelector('#adminSaveAllBtn').addEventListener('click', async () => {
      const btn = bar.querySelector('#adminSaveAllBtn');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
      try {
        await config.onSaveAll();
        if (config.tracker) config.tracker.markClean();
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Salvar tudo';
      }
    });

    if (config.discardBtn) {
      bar.querySelector('#adminDiscardBtn').addEventListener('click', () => {
        if (config.tracker && !config.tracker.confirmLeave('Descartar todas as alterações não salvas?')) return;
        global.location.reload();
      });
    }

    return bar;
  }

  function bindCtrlSave(handler) {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handler();
      }
      if (e.key === 'Escape') {
        const modal = document.querySelector('.admin-modal.is-open');
        if (modal) modal.classList.remove('is-open');
      }
    });
  }

  function renderIconGrid(container, selectedIcon, onSelect) {
    if (!container) return;
    container.innerHTML = '';
    container.className = 'admin-icon-grid';
    FA_ICONS.forEach((icon) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.title = icon.label;
      btn.className = selectedIcon === icon.value ? 'is-selected' : '';
      btn.innerHTML = `<i class="fas ${icon.value}"></i><span>${icon.label}</span>`;
      btn.addEventListener('click', () => {
        container.querySelectorAll('button').forEach((b) => b.classList.remove('is-selected'));
        btn.classList.add('is-selected');
        onSelect(icon.value);
      });
      container.appendChild(btn);
    });
  }

  function bindCharCounter(textarea, maxLen) {
    if (!textarea) return;
    const counter = document.createElement('div');
    counter.className = 'char-counter';
    textarea.parentNode.appendChild(counter);
    const update = () => {
      const len = textarea.value.length;
      counter.textContent = `${len}${maxLen ? ` / ${maxLen}` : ''} caracteres`;
      counter.classList.toggle('is-warn', maxLen && len > maxLen * 0.9 && len <= maxLen);
      counter.classList.toggle('is-over', maxLen && len > maxLen);
    };
    textarea.addEventListener('input', update);
    update();
  }

  function filterTableRows(searchInput, tableBody, dataAttrs) {
    if (!searchInput || !tableBody) return;
    const attrs = dataAttrs || ['data-search'];
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase().trim();
      tableBody.querySelectorAll('tr[data-searchable]').forEach((row) => {
        const hay = attrs.map((a) => row.getAttribute(a) || '').join(' ').toLowerCase();
        row.style.display = !q || hay.includes(q) ? '' : 'none';
      });
    });
  }

  function setupGalleryReorder(container, onReorder) {
    if (!container) return;
    let dragEl = null;

    container.addEventListener('dragstart', (e) => {
      const item = e.target.closest('.gallery-item[draggable="true"]');
      if (!item) return;
      dragEl = item;
      item.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    container.addEventListener('dragend', () => {
      if (dragEl) dragEl.classList.remove('is-dragging');
      dragEl = null;
      const order = [...container.querySelectorAll('.gallery-item')].map((el) => parseInt(el.dataset.index, 10));
      if (onReorder) onReorder(order);
    });

    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      const after = getDragAfterElement(container, e.clientY);
      const dragging = container.querySelector('.is-dragging');
      if (!dragging) return;
      if (after == null) {
        container.appendChild(dragging);
      } else {
        container.insertBefore(dragging, after);
      }
    });
  }

  function getDragAfterElement(container, y) {
    const elements = [...container.querySelectorAll('.gallery-item:not(.is-dragging)')];
    return elements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  function openEditImageModal(image, onSave) {
    if (typeof Swal === 'undefined') {
      const alt = global.prompt('Descrição (alt):', image.alt || '');
      if (alt === null) return;
      const title = global.prompt('Título (opcional):', image.title || '');
      onSave({ alt: alt.trim(), title: (title || '').trim() });
      return;
    }
    Swal.fire({
      title: 'Editar imagem',
      html: `
        <label style="display:block;text-align:left;margin-bottom:8px;font-weight:600;">Descrição (alt) *</label>
        <input id="swal-alt" class="swal2-input" value="${(image.alt || '').replace(/"/g, '&quot;')}" style="width:100%;margin:0 0 12px;">
        <label style="display:block;text-align:left;margin-bottom:8px;font-weight:600;">Título</label>
        <input id="swal-title" class="swal2-input" value="${(image.title || '').replace(/"/g, '&quot;')}" style="width:100%;margin:0;">
      `,
      showCancelButton: true,
      confirmButtonText: 'Salvar',
      preConfirm: () => {
        const alt = document.getElementById('swal-alt').value.trim();
        if (!alt) {
          Swal.showValidationMessage('Descrição é obrigatória');
          return false;
        }
        return {
          alt,
          title: document.getElementById('swal-title').value.trim()
        };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) onSave(result.value);
    });
  }

  function renderChecklist(container, items) {
    if (!container) return;
    container.innerHTML = items.map((item) =>
      `<span class="admin-checklist__item ${item.done ? 'is-done' : 'is-pending'}" title="${item.label}">${item.done ? '✓' : '○'} ${item.short || item.label}</span>`
    ).join('');
  }

  global.AdminUX = {
    slugify,
    FA_ICONS,
    createDirtyTracker,
    initTabPersistence,
    initStickySaveBar,
    bindCtrlSave,
    renderIconGrid,
    bindCharCounter,
    filterTableRows,
    setupGalleryReorder,
    openEditImageModal,
    renderChecklist
  };
})(window);
