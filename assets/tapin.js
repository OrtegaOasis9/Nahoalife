/* Shared "Tap In" community sign-up — one form, one sheet tab (Community), every page.
   Usage on a page:
     <link rel="stylesheet" href="/assets/tapin.css">
     <div data-tapin></div>                      ← where the card goes
     <a href="#community" data-tapin-open>…</a>  ← optional: any link that scrolls down + opens it
     <script src="/assets/tapin.js" defer></script>
   The "Page" column in the sheet gets the full URL, so ?src=<keyword> from a DM link shows up there. */
(function () {
  const SIGNUP_URL = 'https://script.google.com/macros/s/AKfycbxL0BHtb4L_EjXdStrwhvAumnY3luFkCvBDZVB52rPBZU9LP-9K3WIHEGolrW03wFvlRA/exec';
  const mount = document.querySelector('[data-tapin]');
  if (!mount) return;

  mount.outerHTML = `
  <div class="join" id="community" role="region" aria-labelledby="joinTitle">
    <h2 id="joinTitle">join my <span class="serif">community</span></h2>
    <p class="lede">Exclusive content, first word on shows, and new music before anyone else.</p>
    <button class="btn submit toggle" type="button" id="joinToggle" aria-expanded="false" aria-controls="joinForm">Tap in <span class="chev" aria-hidden="true">▾</span></button>
    <form id="joinForm" novalidate hidden>
      <div class="grid">
        <div><label for="j-name">first name</label><input id="j-name" name="first_name" type="text" autocomplete="given-name" maxlength="60"></div>
        <div><label for="j-city">city *</label><input id="j-city" name="city" type="text" autocomplete="address-level2" maxlength="80" required></div>
        <div><label for="j-phone">phone</label><input id="j-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" maxlength="20" placeholder="(555) 555-5555"></div>
        <div><label for="j-email">email</label><input id="j-email" name="email" type="email" autocomplete="email" maxlength="120" placeholder="you@email.com"></div>
        <div class="full"><label for="j-ig">instagram</label><input id="j-ig" name="instagram" type="text" autocomplete="off" autocapitalize="off" maxlength="40" placeholder="@yourhandle"></div>
      </div>
      <div class="hp" aria-hidden="true"><label for="j-web">website</label><input id="j-web" name="website" type="text" tabindex="-1" autocomplete="off"></div>
      <label class="consent"><input type="checkbox" name="consent" value="yes" id="j-consent">
        <span id="j-consent-text">Yes, send me texts and emails from Nahoa Life about new music, shows and exclusive content. Msg frequency varies. Msg &amp; data rates may apply. Reply STOP to opt out anytime.</span></label>
      <button class="btn submit" type="submit">Join →</button>
      <p class="msg" id="joinMsg" role="status" aria-live="polite"></p>
    </form>
  </div>`;

  const card = document.getElementById('community');
  const form = document.getElementById('joinForm'), msg = document.getElementById('joinMsg');
  const tog = document.getElementById('joinToggle');
  function openJoin(scroll) {
    if (form.hidden) { form.hidden = false; tog.setAttribute('aria-expanded', 'true'); }
    if (scroll) setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }

  if (/^#(join|community|tapin)$/.test(location.hash) || new URLSearchParams(location.search).has('join')) {
    openJoin(false); setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250);
  }
  document.querySelectorAll('[data-tapin-open]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); openJoin(true); }));
  tog.addEventListener('click', () => {
    const open = form.hidden; form.hidden = !open; tog.setAttribute('aria-expanded', String(open));
    if (open) document.getElementById('j-name').focus({ preventScroll: true });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = form.elements, say = (t, err) => { msg.textContent = t; msg.className = 'msg' + (err ? ' err' : ''); };
    const phone = f.phone.value.trim(), email = f.email.value.trim(), city = f.city.value.trim();
    if (!city) { say('Add your city.', 1); f.city.focus(); return; }
    if (!phone && !email) { say('Add a phone number or an email.', 1); f.phone.focus(); return; }
    if (phone && phone.replace(/\D/g, '').length < 10) { say('Check your phone number.', 1); f.phone.focus(); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say('Check your email.', 1); f.email.focus(); return; }
    if (!f.consent.checked) { say('Tick the box so we can send you updates.', 1); return; }
    const data = new URLSearchParams({
      first_name: f.first_name.value.trim(), phone, email, city,
      instagram: f.instagram.value.trim().replace(/^@?/, f.instagram.value.trim() ? '@' : ''),
      consent: 'yes', consent_text: document.getElementById('j-consent-text').textContent.trim(),
      website: f.website.value, page: location.href
    });
    const btn = form.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Joining…'; say('');
    try {
      await fetch(SIGNUP_URL, { method: 'POST', mode: 'no-cors', body: data });
      card.innerHTML = '<div class="done"><h2>you’re <span class="serif">in.</span></h2><p>Welcome to the community' + (f.first_name.value.trim() ? ', ' + f.first_name.value.trim().replace(/[<>&]/g, '') : '') + '. Watch for a text or email from Nahoa soon.</p></div>';
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Join →'; say('Something went wrong. Please try again.', 1);
    }
  });
})();
