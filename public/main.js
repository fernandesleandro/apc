(function () {
  function initMobileNav() {
    const toggleBtn = document.querySelector('.menu-toggle');
    const navMenu = document.querySelector('.nav-menu');
    if (!toggleBtn || !navMenu) return;

    toggleBtn.addEventListener('click', function () {
      const isOpen = navMenu.classList.toggle('active');
      toggleBtn.classList.toggle('active');
      toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    document.querySelectorAll('.nav-dropdown-item, .nav-link:not(.nav-dropdown-toggle)').forEach(function (link) {
      link.addEventListener('click', function () {
        toggleBtn.classList.remove('active');
        navMenu.classList.remove('active');
        toggleBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  function initNavDropdown() {
    function closeAllDropdowns(except) {
      document.querySelectorAll('.nav-dropdown.is-open').forEach(function (dropdown) {
        if (except && dropdown === except) return;
        dropdown.classList.remove('is-open');
        const toggle = dropdown.querySelector('.nav-dropdown-toggle');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      });
    }

    document.querySelectorAll('.nav-dropdown').forEach(function (dropdown) {
      const toggle = dropdown.querySelector('.nav-dropdown-toggle');
      if (!toggle) return;

      toggle.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        const willOpen = !dropdown.classList.contains('is-open');
        closeAllDropdowns(willOpen ? dropdown : null);
        dropdown.classList.toggle('is-open', willOpen);
        toggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      });
    });

    document.addEventListener('click', function (event) {
      if (event.target.closest('.nav-dropdown')) return;
      closeAllDropdowns();
    });
  }

  function initProjectAnchors() {
    const nav = document.querySelector('.project-section-nav');
    if (!nav) return;

    const links = nav.querySelectorAll('a[href^="#"]');
    links.forEach(function (link) {
      link.addEventListener('click', function (e) {
        const id = link.getAttribute('href').slice(1);
        const target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        links.forEach(function (l) { l.classList.remove('active'); });
        link.classList.add('active');
      });
    });
  }

  function initContactForm() {
    const form = document.getElementById('contactForm');
    if (!form) return;

    const feedback = document.getElementById('contactFeedback');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      if (feedback) {
        feedback.className = 'form-feedback';
        feedback.textContent = 'Enviando...';
      }

      const payload = {
        name: form.nome.value.trim(),
        email: form.email.value.trim(),
        phone: form.telefone.value.trim(),
        address: form.endereco ? form.endereco.value.trim() : '',
        message: form.mensagem.value.trim(),
        projectInterest: form.interesse ? form.interesse.value.trim() : '',
        website: form.website ? form.website.value : ''
      };

      try {
        const res = await fetch('/api/contato', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (feedback) {
          feedback.className = 'form-feedback ' + (data.success ? 'success' : 'error');
          feedback.textContent = data.message || (data.success ? 'Mensagem enviada!' : 'Erro ao enviar.');
        }
        if (data.success) form.reset();
      } catch (err) {
        if (feedback) {
          feedback.className = 'form-feedback error';
          feedback.textContent = 'Falha na conexão. Use WhatsApp ou telefone.';
        }
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  function initProjectsFilter() {
    document.querySelectorAll('.projects-section').forEach(function (section) {
      const filters = section.querySelector('.projects-filters');
      const grid = section.querySelector('.projects-grid');
      if (!filters || !grid) return;

      const categorySelect = filters.querySelector('[data-filter-category]');
      const statusSelect = filters.querySelector('[data-filter-status]');
      const clearBtn = filters.querySelector('[data-filter-clear]');
      const emptyMsg = section.querySelector('[data-projects-filter-empty]');
      const cards = grid.querySelectorAll('.project-card');
      if (!categorySelect || !cards.length) return;

      function applyFilters() {
        const category = categorySelect.value;
        const lockedStatus = !statusSelect && section.dataset.initialStatus ? section.dataset.initialStatus : '';
        const status = statusSelect ? statusSelect.value : lockedStatus;
        let visibleCount = 0;

        cards.forEach(function (card) {
          const matchesCategory = !category || card.dataset.category === category;
          const matchesStatus = !status || card.dataset.status === status;
          const visible = matchesCategory && matchesStatus;
          card.classList.toggle('is-filtered-out', !visible);
          if (visible) visibleCount += 1;
        });

        const hasActiveFilter = Boolean(category || (statusSelect && status));
        if (clearBtn) clearBtn.hidden = !hasActiveFilter;
        if (emptyMsg) emptyMsg.hidden = visibleCount > 0;
      }

      if (statusSelect) {
        statusSelect.addEventListener('change', applyFilters);
      }

      categorySelect.addEventListener('change', applyFilters);

      if (clearBtn) {
        clearBtn.addEventListener('click', function () {
          categorySelect.value = '';
          if (statusSelect) statusSelect.value = '';
          applyFilters();
        });
      }

      if (section.dataset.initialStatus && statusSelect) {
        statusSelect.value = section.dataset.initialStatus;
      }
      applyFilters();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initMobileNav();
    initNavDropdown();
    initProjectAnchors();
    initContactForm();
    initProjectsFilter();
  });
})();
