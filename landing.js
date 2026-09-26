/* Landing page: language switch and the one hero moment (the example call plays line by line). */
(() => {
  "use strict";
  document.documentElement.classList.add("js");
  const store = {
    // Session only: every new visit starts in English.
    get(key) { try { return sessionStorage.getItem(key); } catch (_) { return null; } },
    set(key, value) { try { sessionStorage.setItem(key, value); } catch (_) { /* private mode */ } }
  };

  const DE = {
    skip: "Zum Inhalt springen",
    navHow: "So funktioniert’s", navServices: "Dienste", navTrust: "Vertrauen", navEcosystem: "Partner", navCta: "Jetzt anrufen",
    you: "Sie:",
    h1: "„Ich bin umgezogen und muss meine neue Adresse anmelden.“",
    h2: "„Gern. Welcher Tag nächste Woche passt Ihnen?“",
    h3: "„Dienstagvormittag.“",
    h4: "„Dienstag, 9:40 Uhr, Rathaus Mitte. Soll ich buchen?“",
    h5: "„Ja, bitte.“",
    h6: "„Erledigt. Ihr Brief ist unterwegs.“",
    heroTitle: "Digitale Dienste, ohne digital sein zu müssen.",
    heroSub: "Eine kostenlose Nummer anrufen und sagen, was Sie brauchen. CallAssist bucht es für Sie und bestätigt per Telefon oder Brief. Keine App, keine Website, kein Passwort. Gemacht für ältere Menschen und für alle, die das Internet nicht nutzen.",
    heroCta: "Jetzt anrufen", heroLink: "So funktioniert’s",
    whyTitle: "Termine sind online gegangen. Millionen Menschen nicht.",
    stat1n: "2,1 Millionen", stat1l: "Menschen zwischen 16 und 74 Jahren waren in Deutschland noch nie im Internet.",
    stat2n: "1 von 10", stat2l: "der 65- bis 74-Jährigen ist offline. Menschen ab 75 werden gar nicht erfasst.",
    whyBody: "Ein Termin beim Bürgeramt, beim Hausarzt oder eine Bahnfahrkarte beginnt immer öfter auf einer Website oder in einer App. CallAssist ist vor allem für ältere Menschen gebaut und funktioniert für alle, die nicht online sind, mit dem Gerät, das alle kennen: dem Telefon.",
    whySource: "Quelle: Statistisches Bundesamt (Destatis), IKT-Erhebung 2025, veröffentlicht am 24. Februar 2026",
    howTitle: "Drei Schritte. Alle am Telefon.",
    s1t: "Anrufen", s1b: "Eine kostenlose Nummer wählen, von jedem Telefon, auch vom Festnetz. CallAssist meldet sich sofort und sagt, wobei es helfen kann.",
    s2t: "Sprechen", s2b: "Sagen Sie in Ihren eigenen Worten, was Sie brauchen, auf Deutsch oder Englisch. CallAssist stellt eine einfache Frage nach der anderen und wiederholt, was es verstanden hat.",
    s3t: "Erledigt", s3b: "Nach Ihrem klaren Ja bucht CallAssist, liest Ihnen die Details vor und schickt auf Wunsch eine Bestätigung per Post.",
    servicesTitle: "Eine Nummer. Drei Anliegen für den Anfang.",
    ss1Status: "wird angerufen…", ss2Ask: "Welcher Tag nächste Woche passt Ihnen?", ss2Reply: "Dienstagvormittag, bitte.",
    ss3Title: "Gebucht", ss3When: "Dienstag, 9:40 Uhr", ss3Where: "Bürgeramt Rathaus Mitte", ss3Letter: "Bestätigungsbrief ist unterwegs",
    sv1t: "Neue Adresse anmelden", sv1b: "Ein Termin beim Bürgeramt in Berlin, Düsseldorf, München oder Frankfurt, mit einem Hinweis, was Sie mitbringen müssen.", sv1q: "„Ich bin umgezogen und muss mich anmelden.“",
    sv2t: "Zum Hausarzt", sv2b: "Ein Termin am Vormittag oder Nachmittag in einer Hausarztpraxis, zum Beispiel im MVZ Medicover am Hausvogteiplatz in Mitte. Im Notfall sagt CallAssist Ihnen, dass Sie die 112 anrufen sollen.", sv2q: "„Ich brauche einen Termin bei meinem Hausarzt.“",
    sv3t: "Mit dem Zug fahren", sv3b: "Echte ICE-Verbindungen ab Berlin, Düsseldorf, München und Frankfurt in Deutschlands große Städte, die Fahrkarte kommt per Post.", sv3q: "„Eine Fahrkarte von Düsseldorf nach München, bitte.“",
    humanTitle: "Ein Mensch, wann immer Sie möchten.",
    humanBody: "Sagen Sie jederzeit „Ich möchte mit jemandem sprechen“ oder „Das verstehe ich nicht“. Marina aus dem CallAssist-Team übernimmt das Gespräch, weiß schon, was Sie gesagt haben, und erledigt das Anliegen mit Ihnen.",
    hv1: "„Entschuldigung, das verstehe ich nicht.“",
    hv2: "„Das ist überhaupt kein Problem. Ich verbinde Sie mit Marina aus unserem Team.“",
    hv3: "„Hallo, hier ist Marina. Ich sehe, Sie möchten Ihre neue Adresse anmelden. Wir machen das jetzt gemeinsam.“",
    trustTitle: "Nichts passiert ohne Ihr Ja.",
    trustLead: "Telefonbetrug trifft oft ältere Menschen. CallAssist ist so gebaut, dass Anrufende immer wissen, mit wem sie sprechen und was als Nächstes passiert.",
    p1t: "Keine PIN. Kein Passwort.", p1b: "Das sagt CallAssist zu Beginn jedes Anrufs, und es ignoriert solche Angaben, wenn jemand sie vorliest.",
    p2t: "Erst prüfen, dann handeln.", p2b: "Jede Buchung wird vollständig vorgelesen und braucht ein klares Ja. „Nein“, „Moment“ oder „nicht den“ bucht nie etwas.",
    p3t: "Langsam, und so oft Sie möchten.", p3b: "Bitten Sie um eine Wiederholung oder langsameres Sprechen. CallAssist nutzt Alltagssprache, eine Frage nach der anderen.",
    p4t: "Immer schriftlich.", p4b: "Jede Buchung hat eine Referenznummer und auf Wunsch einen Bestätigungsbrief per Post.",
    ecoTitle: "Das schafft kein Unternehmen allein.",
    ecoLead: "CallAssist funktioniert nur, wenn drei Arten von Partnern mitmachen. Gemeinsam machen sie den Anruf lohnenswert.",
    e1t: "Dienstleister", e1b: "Bürgerämter, Hausarztpraxen und Bahnunternehmen lassen CallAssist im Auftrag der Anrufenden buchen.",
    e2t: "Wohlfahrtsverbände und Hausärzte", e2b: "Sie wissen, wer Hilfe braucht, und geben die Nummer an Menschen weiter, die ihnen vertrauen.",
    e3t: "Städte und Krankenkassen", e3b: "Sie zahlen pro angemeldeter Person, weil barrierefreie Dienste ihnen Zeit und verpasste Termine sparen.",
    nodeBody: "Sprachassistent, mit einem Menschen, der jederzeit übernimmt",
    callerName: "Die anrufende Person", callerBody: "Anliegen erledigt. Kostenlos, ohne Smartphone.",
    finalTitle: "Hören Sie selbst.",
    finalBody: "Rufen Sie CallAssist direkt hier im Browser an. Sprechen Sie Deutsch oder Englisch, wie am Telefon.",
    finalCta: "Anruf starten",
    finalNote: "Am besten in Chrome oder Edge mit Mikrofon. Kein Mikrofon? Dann tippen Sie Ihre Antworten an.",
    footer1: "CallAssist ist ein akademischer Prototyp. Telefonnummer, Termine, Fahrkarten und die Beratung in der Demo sind simuliert; die Standorte der Bürgerämter und Hausarztpraxen sind echt."
  };

  // English is the markup itself; remember it so switching back restores it.
  const EN = {};
  document.querySelectorAll("[data-i18n]").forEach((el) => { EN[el.dataset.i18n] = el.textContent; });

  const params = new URLSearchParams(location.search);
  let lang = params.get("lang") || store.get("callassist-lang") || "en";
  if (lang !== "de") lang = "en";

  function apply() {
    const dict = lang === "de" ? DE : EN;
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const value = dict[el.dataset.i18n];
      if (value) el.textContent = value;
    });
    document.querySelectorAll("[data-call-link]").forEach((a) => { a.href = `call.html?lang=${lang}`; });
    document.querySelectorAll(".lang button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
    store.set("callassist-lang", lang);
  }
  document.querySelectorAll(".lang button").forEach((b) => b.addEventListener("click", () => { lang = b.dataset.lang; apply(); }));
  apply();

  // The hero call plays once, line by line, at roughly the pace of a real exchange.
  // The phone beside it shows the same call: timer, voice wave and live captions.
  const lines = [...document.querySelectorAll("#dialogue li")];
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hpWho = document.getElementById("hpWho");
  const hpText = document.getElementById("hpText");
  const hpTime = document.getElementById("hpTime");
  const phone = document.querySelector(".hero-phone");
  const caption = (li) => {
    const you = li.classList.contains("caller");
    hpWho.textContent = you ? (lang === "de" ? "Sie" : "You") : "CallAssist";
    hpText.textContent = li.querySelector("span:last-child").textContent.replace(/^[“„"]|[”“"]$/g, "");
    phone.classList.toggle("caller-speaking", you);
  };
  if (still) {
    lines.forEach((li) => li.classList.add("shown"));
    caption(lines[lines.length - 1]);
    hpTime.textContent = "00:42";
  } else {
    lines.forEach((li, i) => setTimeout(() => { li.classList.add("shown"); caption(li); }, 350 + i * 850));
    const start = Date.now() - 36000; // the call has been going for a little while
    const tick = () => { const s = Math.floor((Date.now() - start) / 1000); hpTime.textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
    tick();
    setInterval(tick, 1000);
    setTimeout(() => phone.classList.add("settled"), 350 + lines.length * 850);
  }
  // Keep the phone caption in the chosen language.
  document.querySelectorAll(".lang button").forEach((b) => b.addEventListener("click", () => {
    const shown = lines.filter((li) => li.classList.contains("shown"));
    if (shown.length) caption(shown[shown.length - 1]);
  }));

  // ---------------------------------------------------------------- depth and motion
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const nav = document.querySelector(".nav");
  const heroPhone = document.getElementById("heroPhone");
  const track = document.getElementById("storyTrack");
  const sticky = document.getElementById("storySticky");
  const storyPhone = document.getElementById("storyPhone");

  // The hero phone rises into place once, then floats and follows the pointer.
  if (!calm && heroPhone) {
    heroPhone.classList.add("entering");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      heroPhone.classList.remove("entering");
      setTimeout(() => heroPhone.classList.add("floating"), 1300);
    }));
    const hero = document.querySelector(".hero");
    if (matchMedia("(pointer: fine)").matches) {
      hero.addEventListener("pointermove", (e) => {
        const r = hero.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        heroPhone.style.setProperty("--ry", `${-16 + x * 22}deg`);
        heroPhone.style.setProperty("--rx", `${6 - y * 12}deg`);
        heroPhone.style.setProperty("--sheen", String(x * 60));
      });
      hero.addEventListener("pointerleave", () => { heroPhone.style.removeProperty("--ry"); heroPhone.style.removeProperty("--rx"); heroPhone.style.removeProperty("--sheen"); });
    }
  }

  // Scroll: the pinned story turns the phone and moves through its three screens.
  function onScroll() {
    nav.classList.toggle("scrolled", scrollY > 8);
    if (!track || getComputedStyle(sticky).position !== "sticky") return;
    const r = track.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, -r.top / (r.height - innerHeight)));
    storyPhone.style.setProperty("--p", calm ? "0.5" : p.toFixed(3));
    storyPhone.style.setProperty("--sheen", String((p - 0.5) * 80));
    sticky.dataset.step = p < 0.34 ? "1" : p < 0.67 ? "2" : "3";
  }
  addEventListener("scroll", () => requestAnimationFrame(onScroll), { passive: true });
  addEventListener("resize", onScroll);
  onScroll();

  // Headlines and content sharpen into view, siblings slightly staggered.
  const reveal = document.querySelectorAll(".section-title, .statement, .why-body, .stat, .service-list li, .human-body, .promises li, .partners li, .node, .trust-lead, .eco-lead, .final-body, .call-cta");
  reveal.forEach((el) => {
    el.classList.add("reveal");
    const siblings = [...el.parentElement.children].filter((c) => c.classList.contains("reveal"));
    el.style.setProperty("--delay", `${Math.min(siblings.indexOf(el), 4) * 0.09}s`);
  });

  // Statistics count up to their real value.
  function countUp(el) {
    const text = el.textContent;
    const m = /(\d+)([.,](\d+))?/.exec(text);
    if (!m || calm) return;
    const target = parseFloat(m[0].replace(",", "."));
    const decimals = m[3] ? m[3].length : 0;
    const sep = m[2] ? m[2][0] : ".";
    const start = performance.now();
    let written = text;
    const frame = (now) => {
      // A language switch rewrote the stat mid-count: leave its new text alone.
      if (el.textContent !== written) return;
      const k = Math.min(1, (now - start) / 1400);
      const v = (target * (1 - Math.pow(1 - k, 3))).toFixed(decimals).replace(".", sep);
      written = k < 1 ? text.slice(0, m.index) + v + text.slice(m.index + m[0].length) : text;
      el.textContent = written;
      if (k < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  // The handover plays like a real chat: caller, CallAssist, Marina typing, Marina.
  function playHandover(box) {
    const [caller, ca, typing, marina] = box.querySelectorAll(".bubble");
    const steps = [[caller, 0], [ca, 900], [typing, 1900], [marina, 3100]];
    steps.forEach(([el, t]) => setTimeout(() => {
      if (el === marina) typing.classList.add("gone");
      el.classList.add("in");
    }, calm ? 0 : t));
  }

  const seen = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.classList.add("in");
      if (el.classList.contains("stat")) countUp(el.querySelector(".stat-n"));
      if (el.classList.contains("handover")) playHandover(el);
      seen.unobserve(el);
    });
  }, { threshold: 0.25, rootMargin: "0px 0px -8% 0px" });
  reveal.forEach((el) => seen.observe(el));
  document.querySelectorAll(".handover, .flow").forEach((el) => seen.observe(el));
  document.querySelectorAll(".flow .arrow").forEach((a, i) => a.style.setProperty("--delay", `${0.3 + i * 0.35}s`));
})();
