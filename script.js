/* ============================================================
   JOAN WARREN — BUYER PROFILE · script.js
============================================================ */

(function () {
  'use strict';

  /* ── State ──────────────────────────────────────────────── */
  let currentStep = 1;
  const TOTAL_STEPS = 5;

  // TODO: Paste your Google Apps Script Web App URL here:
  const GOOGLE_APP_SCRIPT_URL = "https://formsubmit.co/ajax/jwarren@residentialproperties.com";

  /* ── Validators ─────────────────────────────────────────── */
  const VALIDATORS = {
    email: {
      re:  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/,
      msg: 'Please enter a valid email address (e.g. jane@example.com).'
    },
    phone: {
      // Accepts (555) 555-5555 · 555-555-5555 · 5555555555 · +1 555 555 5555 etc.
      re:  /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{7,14}$/,
      msg: 'Please enter a valid US phone number (e.g. 555-555-5555).'
    },
    address: {
      re:     /\d/,      // must contain at least one digit (street number)
      minLen: 10,
      msg:    'Please enter a full street address including number and city (e.g. 123 Main St, Milwaukee, WI).'
    }
  };

  /* ── DOM refs ───────────────────────────────────────────── */
  const form           = document.getElementById('buyer-form');
  const nextBtn        = document.getElementById('next-btn');
  const prevBtn        = document.getElementById('prev-btn');
  const submitBtn      = document.getElementById('submit-btn');
  const progressFill   = document.getElementById('progress-fill');
  const successState   = document.getElementById('success-state');
  const summaryCard    = document.getElementById('summary-card');
  const summaryContent = document.getElementById('summary-content');
  const formNav        = document.getElementById('form-nav');

  /* ─────────────────────────────────────────────────────────
     ADDRESS AUTOCOMPLETE (OpenStreetMap Nominatim — free, no key)
  ───────────────────────────────────────────────────────── */
  (function initAddressAutocomplete() {
    const input    = document.getElementById('current-address');
    const dropdown = document.getElementById('address-dropdown');
    if (!input || !dropdown) return;

    let debounceTimer  = null;
    let activeIndex    = -1;
    let currentResults = [];

    function openDropdown() {
      dropdown.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }
    function closeDropdown() {
      dropdown.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      activeIndex = -1;
    }

    function setActive(idx) {
      const items = dropdown.querySelectorAll('.autocomplete-item');
      items.forEach((el, i) => {
        el.classList.toggle('autocomplete-item--active', i === idx);
        el.setAttribute('aria-selected', i === idx);
      });
      activeIndex = idx;
    }

    function renderResults(results) {
      dropdown.innerHTML = '';
      currentResults = results;

      if (!results.length) {
        closeDropdown();
        return;
      }

      results.forEach((r, i) => {
        const parts       = r.display_name.split(', ');
        const mainLine    = parts.slice(0, 2).join(', ');
        const subLine     = parts.slice(2).join(', ');

        const item = document.createElement('div');
        item.className   = 'autocomplete-item';
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', 'false');
        item.setAttribute('tabindex', '-1');
        item.innerHTML = `
          <span class="autocomplete-item__icon">📍</span>
          <div>
            <div class="autocomplete-item__main">${mainLine}</div>
            ${subLine ? `<div class="autocomplete-item__sub">${subLine}</div>` : ''}
          </div>
        `;

        item.addEventListener('mousedown', (e) => {
          // mousedown fires before blur — prevent input losing focus before we fill it
          e.preventDefault();
          selectResult(r);
        });

        dropdown.appendChild(item);
      });

      openDropdown();
    }

    function selectResult(r) {
      // Build a clean US-style address string
      const a    = r.address || {};
      const num  = a.house_number || '';
      const road = a.road || a.pedestrian || '';
      const city = a.city || a.town || a.village || a.hamlet || '';
      const state= a.state || '';
      const zip  = a.postcode || '';

      let filled = r.display_name;
      if (num && road) {
        filled = [
          `${num} ${road}`,
          city,
          state,
          zip
        ].filter(Boolean).join(', ');
      }

      input.value = filled;
      closeDropdown();
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    }

    async function fetchSuggestions(query) {
      dropdown.innerHTML = `
        <div class="autocomplete-loading">
          <div class="autocomplete-spinner"></div>
          Looking up addresses…
        </div>`;
      openDropdown();

      try {
        const url = `https://nominatim.openstreetmap.org/search?` +
          new URLSearchParams({
            q:              query,
            format:         'json',
            limit:          '6',
            countrycodes:   'us',
            addressdetails: '1',
            featuretype:    'house'
          });

        const res  = await fetch(url, {
          headers: { 'Accept-Language': 'en-US,en;q=0.9' }
        });
        const data = await res.json();
        renderResults(data);
      } catch {
        closeDropdown();
      }
    }

    // Keyboard navigation inside dropdown
    input.addEventListener('keydown', (e) => {
      if (dropdown.hidden) return;
      const items = dropdown.querySelectorAll('.autocomplete-item');
      if (!items.length) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive(Math.min(activeIndex + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive(Math.max(activeIndex - 1, 0));
      } else if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        selectResult(currentResults[activeIndex]);
      } else if (e.key === 'Escape') {
        closeDropdown();
      }
    });

    input.addEventListener('input', () => {
      const q = input.value.trim();
      clearTimeout(debounceTimer);
      if (q.length < 4) { closeDropdown(); return; }
      debounceTimer = setTimeout(() => fetchSuggestions(q), 320);
    });

    // Close when focus leaves the whole autocomplete widget
    input.addEventListener('blur', () => {
      setTimeout(closeDropdown, 150); // small delay so mousedown can fire first
    });

    // Reopen on re-focus if text exists
    input.addEventListener('focus', () => {
      if (currentResults.length && input.value.trim().length >= 4) {
        renderResults(currentResults);
      }
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.autocomplete-wrap')) closeDropdown();
    });
  })();

  /* ─────────────────────────────────────────────────────────
     BUTTON GATING
  ───────────────────────────────────────────────────────── */
  function setActionEnabled(enabled) {
    // Operates on whichever action button is currently visible
    const btn = currentStep === TOTAL_STEPS ? submitBtn : nextBtn;
    btn.disabled = !enabled;
    btn.classList.toggle('btn--disabled', !enabled);
    btn.setAttribute('aria-disabled', String(!enabled));
  }

  function isStepComplete(step) {
    const stepEl = document.getElementById('step-' + step);
    if (!stepEl) return false;

    const val      = (id) => (document.getElementById(id)?.value ?? '').trim();
    const radio    = (name) => !!stepEl.querySelector(`input[name="${name}"]:checked`);
    const anyCheck = (name) => stepEl.querySelectorAll(`input[name="${name}"]:checked`).length > 0;

    switch (step) {
      case 1:
        return (
          val('first-name') !== '' &&
          val('last-name')  !== '' &&
          VALIDATORS.email.re.test(val('email')) &&
          VALIDATORS.phone.re.test(val('phone')) &&
          radio('preferredContact') &&
          radio('timeline')
        );
      case 2: {
        const addr = val('current-address');
        return (
          addr.length >= VALIDATORS.address.minLen &&
          VALIDATORS.address.re.test(addr) &&
          radio('rentOrOwn')
        );
      }
      case 3: {
        const countyChecked = stepEl.querySelectorAll('input[name="location"]:checked').length > 0;
        return (
          anyCheck('homeType') &&
          (countyChecked || val('location-other') !== '') &&
          radio('bedrooms') &&
          radio('bathrooms')
        );
      }
      case 4:
        return (
          Number(document.getElementById('price-range')?.value) > 0 &&
          Number(document.getElementById('monthly-budget')?.value) > 0 &&
          radio('preApproved')
        );
      case 5: {
        const heard = radio('heardAbout');
        const other = document.getElementById('hear-other');
        if (other && other.checked) {
          return val('hear-other-text') !== '';
        }
        return heard;
      }
      default:
        return true;
    }
  }

  function refreshButton() {
    setActionEnabled(isStepComplete(currentStep));
  }

  /* ─────────────────────────────────────────────────────────
     PROGRESS BAR
  ───────────────────────────────────────────────────────── */
  function updateProgress(step) {
    progressFill.style.width = Math.round((step / TOTAL_STEPS) * 100) + '%';
    document.querySelectorAll('.step-item').forEach((el) => {
      const s = parseInt(el.dataset.step, 10);
      el.classList.remove('step-item--active', 'step-item--done');
      el.removeAttribute('aria-current');
      const circle = el.querySelector('.step-circle');
      if (s === step) {
        el.classList.add('step-item--active');
        el.setAttribute('aria-current', 'step');
        circle.textContent = s;
      } else if (s < step) {
        el.classList.add('step-item--done');
        circle.textContent = '✓';
      } else {
        circle.textContent = s;
      }
    });
  }

  /* ─────────────────────────────────────────────────────────
     STEP NAVIGATION
  ───────────────────────────────────────────────────────── */
  function goToStep(step) {
    document.getElementById('step-' + currentStep).hidden = true;
    document.getElementById('step-' + step).hidden        = false;
    currentStep = step;

    updateProgress(step);

    // Button visibility: Continue on 1-4, Submit on 5 only
    prevBtn.hidden   = step === 1;
    nextBtn.hidden   = step === TOTAL_STEPS;
    submitBtn.hidden = step !== TOTAL_STEPS;

    if (step === TOTAL_STEPS) buildSummary();

    refreshButton();
    document.getElementById('form-section')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ─────────────────────────────────────────────────────────
     FULL STEP VALIDATION  (on Next / Submit click)
  ───────────────────────────────────────────────────────── */
  function setError(inputEl, errEl, msg) {
    if (inputEl) inputEl.classList.add('error');
    if (errEl)   errEl.textContent = msg;
  }

  function clearError(inputEl, errEl) {
    if (inputEl) inputEl.classList.remove('error');
    if (errEl)   errEl.textContent = '';
  }

  function validateStep(step) {
    const stepEl     = document.getElementById('step-' + step);
    let valid        = true;
    let firstErrEl   = null;

    const fail = (inputEl, errId, msg) => {
      const errEl = errId
        ? document.getElementById(errId)
        : inputEl?.closest('.field-group')?.querySelector('.field-error');
      setError(inputEl, errEl, msg);
      if (!firstErrEl) firstErrEl = errEl || inputEl;
      valid = false;
    };

    const requireText  = (id, msg) => {
      const el = document.getElementById(id);
      if (!el || !el.value.trim()) fail(el, null, msg);
    };
    const requireRadio = (name, errId, msg) => {
      if (!stepEl.querySelector(`input[name="${name}"]:checked`)) fail(null, errId, msg);
    };
    const requireCheck = (name, errId, msg) => {
      if (!stepEl.querySelectorAll(`input[name="${name}"]:checked`).length) fail(null, errId, msg);
    };

    switch (step) {
      case 1: {
        requireText('first-name', 'First name is required.');
        requireText('last-name',  'Last name is required.');

        const emailEl  = document.getElementById('email');
        const emailErr = emailEl?.closest('.field-group')?.querySelector('.field-error');
        if (!emailEl?.value.trim())                               fail(emailEl, null, 'Email address is required.');
        else if (!VALIDATORS.email.re.test(emailEl.value.trim())) fail(emailEl, null, VALIDATORS.email.msg);
        else clearError(emailEl, emailErr);

        const phoneEl  = document.getElementById('phone');
        const phoneErr = phoneEl?.closest('.field-group')?.querySelector('.field-error');
        if (!phoneEl?.value.trim())                               fail(phoneEl, null, 'Phone number is required.');
        else if (!VALIDATORS.phone.re.test(phoneEl.value.trim())) fail(phoneEl, null, VALIDATORS.phone.msg);
        else clearError(phoneEl, phoneErr);

        requireRadio('preferredContact', 'contact-method-error', 'Please choose a preferred contact method.');
        requireRadio('timeline',         'timeline-error',        'Please select your purchase timeline.');
        break;
      }
      case 2: {
        const addrEl  = document.getElementById('current-address');
        const addrErr = addrEl?.closest('.field-group')?.querySelector('.field-error');
        const addrVal = addrEl?.value.trim() ?? '';
        if (!addrVal)                                                                              fail(addrEl, null, 'Current address is required.');
        else if (addrVal.length < VALIDATORS.address.minLen || !VALIDATORS.address.re.test(addrVal)) fail(addrEl, null, VALIDATORS.address.msg);
        else clearError(addrEl, addrErr);
        requireRadio('rentOrOwn', 'rent-own-error', 'Please select whether you rent or own.');
        break;
      }
      case 3: {
        requireCheck('homeType', 'home-type-error', 'Please select at least one home type.');
        const countyChecked = stepEl.querySelectorAll('input[name="location"]:checked').length > 0;
        const otherLoc      = document.getElementById('location-other')?.value.trim();
        if (!countyChecked && !otherLoc) fail(null, 'location-error', 'Please select at least one county or enter a specific area.');
        requireRadio('bedrooms',  'bedrooms-error',  'Please select a minimum number of bedrooms.');
        requireRadio('bathrooms', 'bathrooms-error', 'Please select a minimum number of bathrooms.');
        break;
      }
      case 4: {
        const priceEl  = document.getElementById('price-range');
        const priceErr = priceEl?.closest('.field-group')?.querySelector('.field-error');
        if (!priceEl?.value || Number(priceEl.value) <= 0) fail(priceEl, null, 'Please enter a valid price (numbers only, e.g. 450000).');
        else clearError(priceEl, priceErr);

        const budgetEl  = document.getElementById('monthly-budget');
        const budgetErr = budgetEl?.closest('.field-group')?.querySelector('.field-error');
        if (!budgetEl?.value || Number(budgetEl.value) <= 0) fail(budgetEl, null, 'Please enter a valid monthly budget (numbers only, e.g. 2200).');
        else clearError(budgetEl, budgetErr);

        requireRadio('preApproved', 'preapproved-error', 'Please indicate whether you are pre-approved.');
        break;
      }
      case 5: {
        requireRadio('heardAbout', 'heard-about-error', 'Please tell us how you heard about us.');
        const otherRadio = document.getElementById('hear-other');
        if (otherRadio?.checked && !document.getElementById('hear-other-text')?.value.trim()) {
          fail(null, 'heard-about-error', 'Please specify how you heard about us.');
        }
        break;
      }
    }

    if (firstErrEl) firstErrEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return valid;
  }

  /* ─────────────────────────────────────────────────────────
     CONDITIONAL FIELDS
  ───────────────────────────────────────────────────────── */
  function setupConditionals() {
    document.querySelectorAll('input[name="preApproved"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        document.getElementById('lender-group').hidden      = radio.value !== 'Yes';
        document.getElementById('need-lender-group').hidden = radio.value !== 'No';
        refreshButton();
      });
    });

    const hearOtherRadio = document.getElementById('hear-other');
    const hearOtherText  = document.getElementById('hear-other-text');
    if (hearOtherRadio && hearOtherText) {
      hearOtherRadio.addEventListener('change', () => {
        if (hearOtherRadio.checked) hearOtherText.focus();
      });
      hearOtherText.addEventListener('click', () => {
        hearOtherRadio.checked = true;
        refreshButton();
      });
    }
  }

  /* ─────────────────────────────────────────────────────────
     SUMMARY CARD (step 5 review)
  ───────────────────────────────────────────────────────── */
  function getVal(name, multi = false) {
    if (multi) {
      return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`))
        .map(c => c.value).join(', ') || '—';
    }
    const el = document.querySelector(`input[name="${name}"]:checked`) ||
               document.querySelector(`[name="${name}"]`);
    return el?.value || '—';
  }

  function buildSummary() {
    const v = (id) => document.getElementById(id)?.value || '—';
    const items = [
      { key: 'Name',            val: [v('first-name'), v('last-name')].filter(s => s !== '—').join(' ') || '—' },
      { key: 'Email',           val: v('email') },
      { key: 'Phone',           val: v('phone') },
      { key: 'Contact Pref.',   val: getVal('preferredContact') },
      { key: 'Timeline',        val: getVal('timeline') },
      { key: 'Current Address', val: v('current-address') },
      { key: 'Rent / Own',      val: getVal('rentOrOwn') },
      { key: 'Home Type(s)',    val: getVal('homeType', true) },
      { key: 'Location(s)',     val: [getVal('location', true), v('location-other')].filter(s => s && s !== '—').join(', ') || '—' },
      { key: 'Bedrooms',        val: getVal('bedrooms') },
      { key: 'Bathrooms',       val: getVal('bathrooms') },
      { key: 'Home Style(s)',   val: getVal('homeStyle', true) || '—' },
      { key: 'Price Range',     val: v('price-range') },
      { key: 'Monthly Budget',  val: v('monthly-budget') },
      { key: 'Pre-Approved',    val: getVal('preApproved') },
    ];

    summaryContent.innerHTML = items.map(i => `
      <div class="summary-item">
        <div class="summary-item__key">${i.key}</div>
        <div class="summary-item__val">${i.val}</div>
      </div>`).join('');

    summaryCard.hidden = false;
  }

  /* ─────────────────────────────────────────────────────────
     FORM SUBMIT
  ───────────────────────────────────────────────────────── */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateStep(5)) return;

    // Collect all data into a clean object
    const payload = {};
    for (const [k, v] of new FormData(form).entries()) {
      payload[k] = payload[k] ? [].concat(payload[k], v).join(', ') : v;
    }
    
    // Custom handling for checkboxes/arrays that FormData handles oddly
    payload.homeType = getVal('homeType', true);
    payload.location = getVal('location', true);

    // Disable button and show loading state
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = 'Submitting...';
    submitBtn.disabled = true;
    submitBtn.classList.add('btn--disabled');

    try {
      if (GOOGLE_APP_SCRIPT_URL) {
        // We use text/plain to avoid CORS preflight issues with Google Apps Script
        await fetch(GOOGLE_APP_SCRIPT_URL, {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });
      } else {
        console.warn('No GOOGLE_APP_SCRIPT_URL provided. Simulating submission.');
        await new Promise(r => setTimeout(r, 1200));
        console.log('Buyer Profile Submitted (Local Simulation):', payload);
      }

      form.hidden    = true;
      formNav.hidden = true;
      successState.hidden = false;
      successState.scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch (err) {
      console.error('Error submitting form:', err);
      alert('There was a problem submitting your form. Please try again or contact Joan directly.');
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
      submitBtn.classList.remove('btn--disabled');
    }
  });

  /* ─────────────────────────────────────────────────────────
     NEXT / PREV BUTTONS
  ───────────────────────────────────────────────────────── */
  nextBtn.addEventListener('click', () => {
    if (!validateStep(currentStep)) return;
    if (currentStep < TOTAL_STEPS) goToStep(currentStep + 1);
  });

  prevBtn.addEventListener('click', () => {
    if (currentStep > 1) goToStep(currentStep - 1);
  });

  /* ─────────────────────────────────────────────────────────
     REAL-TIME EVENTS
  ───────────────────────────────────────────────────────── */
  form.addEventListener('input',  () => refreshButton());
  form.addEventListener('change', () => refreshButton());

  // Clear inline error on the field being corrected
  form.addEventListener('input', (e) => {
    const t = e.target;
    t.classList.remove('error');
    const err = t.closest('.field-group')?.querySelector('.field-error');
    if (err) err.textContent = '';
  });

  // Blur-time format validation for specific fields
  ['email', 'phone', 'current-address'].forEach((id) => {
    document.getElementById(id)?.addEventListener('blur', function () {
      const val    = this.value.trim();
      const errEl  = this.closest('.field-group')?.querySelector('.field-error');
      clearError(this, errEl);
      if (!val) return;
      if (id === 'email'           && !VALIDATORS.email.re.test(val))   setError(this, errEl, VALIDATORS.email.msg);
      if (id === 'phone'           && !VALIDATORS.phone.re.test(val))   setError(this, errEl, VALIDATORS.phone.msg);
      if (id === 'current-address' && (val.length < VALIDATORS.address.minLen || !VALIDATORS.address.re.test(val)))
        setError(this, errEl, VALIDATORS.address.msg);
      refreshButton();
    });
  });

  /* ─────────────────────────────────────────────────────────
     START BUTTON
  ───────────────────────────────────────────────────────── */
  document.getElementById('start-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('form-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ─────────────────────────────────────────────────────────
     INIT
  ───────────────────────────────────────────────────────── */
  setupConditionals();
  updateProgress(1);

  // Ensure correct initial button visibility
  nextBtn.hidden   = false;   // step 1 — show Continue
  submitBtn.hidden = true;    // step 1 — hide Submit
  prevBtn.hidden   = true;    // step 1 — hide Back

  refreshButton(); // Start disabled until step 1 is complete

})();
