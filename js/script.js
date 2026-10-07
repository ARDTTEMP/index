/* ==========================================================================
   ARDTTEMP — Script global (vanilla JS, sans dépendance)
   Utilisé par toutes les pages FR et EN.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', function () {

  /* ------------------------------------------------------------------
     0. Dictionnaire i18n minimal pour les messages générés en JS
        (le contenu des pages reste traduit directement dans le HTML)
     ------------------------------------------------------------------ */
  var lang = document.documentElement.lang === 'en' ? 'en' : 'fr';

  var dict = {
    fr: {
      required: 'Ce champ est obligatoire.',
      invalidEmail: 'Veuillez saisir une adresse e-mail valide.',
      invalidPhone: 'Veuillez saisir un numéro de téléphone valide.',
      formSuccess: 'Merci ! Votre message a bien été envoyé. Nous reviendrons vers vous rapidement.',
      donateSuccess: 'Merci pour votre générosité ! Votre demande a été enregistrée. Notre équipe vous contactera pour les modalités de paiement.',
      joinSuccess: 'Merci pour votre demande d\'adhésion ! Notre équipe vous contactera sous peu.',
      newsletterSuccess: 'Merci, votre demande d’inscription à la newsletter a été reçue.',
      menuOpen: 'Ouvrir le menu',
      menuClose: 'Fermer le menu'
    },
    en: {
      required: 'This field is required.',
      invalidEmail: 'Please enter a valid email address.',
      invalidPhone: 'Please enter a valid phone number.',
      formSuccess: 'Thank you! Your message has been sent. We will get back to you shortly.',
      donateSuccess: 'Thank you for your generosity! Your request has been recorded. Our team will contact you about payment arrangements.',
      joinSuccess: 'Thank you for your membership request! Our team will contact you soon.',
      newsletterSuccess: 'Thank you, your newsletter request has been received.',
      menuOpen: 'Open menu',
      menuClose: 'Close menu'
    }
  };
  var t = dict[lang];

  /* ------------------------------------------------------------------
     1. Menu mobile (burger)
     ------------------------------------------------------------------ */
  var navToggle = document.querySelector('.nav-toggle');
  var navWrap = document.querySelector('.nav-wrap');

  if (navToggle && navWrap) {
    navToggle.addEventListener('click', function () {
      var isOpen = navWrap.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      navToggle.setAttribute('aria-label', isOpen ? t.menuClose : t.menuOpen);
    });

    // Ferme le menu si on clique sur un lien (navigation mobile)
    navWrap.querySelectorAll('.main-nav a').forEach(function (link) {
      link.addEventListener('click', function () {
        navWrap.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.setAttribute('aria-label', t.menuOpen);
      });
    });
  }

  /* ------------------------------------------------------------------
     2. Mise en évidence du lien de navigation actif
     ------------------------------------------------------------------ */
  var currentFile = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.main-nav a').forEach(function (link) {
    var linkFile = link.getAttribute('href').split('/').pop();
    if (linkFile === currentFile) {
      link.setAttribute('aria-current', 'page');
    }
  });

  /* ------------------------------------------------------------------
     3. Révélation des éléments au scroll (respecte prefers-reduced-motion
        car les transitions CSS sont déjà neutralisées dans ce cas)
     ------------------------------------------------------------------ */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    revealEls.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ------------------------------------------------------------------
     4. Compteurs animés (statistiques d'impact)
     ------------------------------------------------------------------ */
  var counters = document.querySelectorAll('[data-counter]');
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function animateCounter(el) {
    var target = parseInt(el.getAttribute('data-counter'), 10) || 0;
    var suffix = el.getAttribute('data-suffix') || '';

    if (prefersReducedMotion) {
      el.textContent = target.toLocaleString('fr-FR') + suffix;
      return;
    }

    var duration = 1400;
    var start = null;

    function step(timestamp) {
      if (!start) start = timestamp;
      var progress = Math.min((timestamp - start) / duration, 1);
      var value = Math.floor(progress * target);
      el.textContent = value.toLocaleString('fr-FR') + suffix;
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        el.textContent = target.toLocaleString('fr-FR') + suffix;
      }
    }
    window.requestAnimationFrame(step);
  }

  if ('IntersectionObserver' in window && counters.length) {
    var counterObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });

    counters.forEach(function (el) { counterObserver.observe(el); });
  } else {
    counters.forEach(animateCounter);
  }

  /* ------------------------------------------------------------------
     5. Bouton "Retour en haut"
     ------------------------------------------------------------------ */
  var backToTop = document.querySelector('.back-to-top');
  if (backToTop) {
    window.addEventListener('scroll', function () {
      backToTop.classList.toggle('is-visible', window.scrollY > 500);
    });
  }

  /* ------------------------------------------------------------------
     6. FAQ accordéon (réutilisable sur plusieurs pages)
     ------------------------------------------------------------------ */
  document.querySelectorAll('.faq-item').forEach(function (item) {
    var trigger = item.querySelector('.faq-question');
    var panel = item.querySelector('.faq-answer');
    if (!trigger || !panel) return;

    trigger.addEventListener('click', function () {
      var isOpen = item.classList.toggle('is-open');
      trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      panel.style.maxHeight = isOpen ? panel.scrollHeight + 'px' : null;
    });
  });

  /* ------------------------------------------------------------------
     7. Sélecteur rapide de montant (page Don)
     ------------------------------------------------------------------ */
  var amountOptions = document.querySelectorAll('.amount-option');
  var customAmountInput = document.getElementById('custom-amount');

  amountOptions.forEach(function (option) {
    option.addEventListener('click', function () {
      amountOptions.forEach(function (o) { o.classList.remove('is-selected'); });
      option.classList.add('is-selected');
      if (customAmountInput) {
        customAmountInput.value = option.getAttribute('data-amount');
      }
    });
  });

  if (customAmountInput) {
    customAmountInput.addEventListener('input', function () {
      amountOptions.forEach(function (o) { o.classList.remove('is-selected'); });
    });
  }

  // Only acknowledge a submission after the receiving service accepts it.
  function validateField(field) {
    var valid = field.checkValidity();
    var wrapper = field.closest('.form-field');
    if (wrapper) wrapper.classList.toggle('is-invalid', !valid);
    field.setAttribute('aria-invalid', valid ? 'false' : 'true');
    return valid;
  }
  document.querySelectorAll('form[data-validate]').forEach(function (form) {
    var fields = form.querySelectorAll('input, textarea, select');
    var busy = false;
    fields.forEach(function (field) {
      field.addEventListener('blur', function () { validateField(field); });
    });
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (busy) return;
      var firstInvalid;
      fields.forEach(function (field) {
        if (!validateField(field) && !firstInvalid) firstInvalid = field;
      });
      if (firstInvalid) { firstInvalid.focus(); firstInvalid.reportValidity(); return; }
      var box = form.parentElement.querySelector('.form-success');
      if (!box) {
        box = document.createElement('p'); box.className = 'form-success';
        form.appendChild(box);
      }
      var button = form.querySelector('[type="submit"]');
      busy = true;
      form.setAttribute('aria-busy', 'true');
      if (button) button.disabled = true;
      box.classList.remove('is-visible');
      try {
        await window.ARDTTEMPForms.submit(form, lang);
        box.textContent = t[form.getAttribute('data-success-message')] || t.formSuccess;
        box.setAttribute('role', 'status');
        box.classList.remove('is-error');
        form.reset();
      } catch (error) {
        box.textContent = lang === 'en'
          ? 'Your request was not confirmed. Please try again or contact projets@ardttemp.org. Your entries have been kept.'
          : 'Votre envoi n’a pas été confirmé. Réessayez ou contactez projets@ardttemp.org. Vos informations ont été conservées.';
        box.setAttribute('role', 'alert');
        box.classList.add('is-error');
      } finally {
        busy = false;
        form.removeAttribute('aria-busy');
        if (button) button.disabled = false;
        box.classList.add('is-visible');
      }
    });
  });

  /* ------------------------------------------------------------------
     9. Année courante automatique dans le pied de page
     ------------------------------------------------------------------ */
  var yearEl = document.getElementById('current-year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

});
