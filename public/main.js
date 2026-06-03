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

    document.querySelectorAll('.nav-link').forEach(function (link) {
      link.addEventListener('click', function () {
        toggleBtn.classList.remove('active');
        navMenu.classList.remove('active');
        toggleBtn.setAttribute('aria-expanded', 'false');
      });
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

  document.addEventListener('DOMContentLoaded', function () {
    initMobileNav();
    initProjectAnchors();
    initContactForm();
  });
})();
