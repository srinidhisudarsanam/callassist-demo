/* Landing page: language switch and the one hero moment (the example call plays line by line). */
(() => {
  "use strict";
  document.documentElement.classList.add("js");
  const store = {
    get(key) { try { return localStorage.getItem(key); } catch (_) { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch (_) { /* private mode */ } }
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
    whyTitle: "2,1 Millionen Menschen zwischen 16 und 74 Jahren waren in Deutschland noch nie im Internet.",
    whyBody: "Bei den 65- bis 74-Jährigen ist es jede zehnte Person, und Menschen ab 75 werden in der Erhebung gar nicht erfasst. Trotzdem beginnt ein Termin beim Bürgeramt, beim Hausarzt oder eine Bahnfahrkarte immer öfter auf einer Website oder in einer App. CallAssist ist vor allem für ältere Menschen gebaut und funktioniert für alle, die nicht online sind, mit dem Gerät, das alle kennen: dem Telefon.",
    whySource: "Quelle: Statistisches Bundesamt (Destatis), IKT-Erhebung 2025, veröffentlicht am 24. Februar 2026",
    howTitle: "Drei Schritte. Alle am Telefon.",
    s1t: "Anrufen", s1b: "Eine kostenlose Nummer wählen, von jedem Telefon, auch vom Festnetz. CallAssist meldet sich sofort und sagt, wobei es helfen kann.",
    s2t: "Sprechen", s2b: "Sagen Sie in Ihren eigenen Worten, was Sie brauchen, auf Deutsch oder Englisch. CallAssist stellt eine einfache Frage nach der anderen und wiederholt, was es verstanden hat.",
    s3t: "Erledigt", s3b: "Nach Ihrem klaren Ja bucht CallAssist, liest Ihnen die Details vor und schickt auf Wunsch eine Bestätigung per Post.",
    servicesTitle: "Eine Nummer. Drei Anliegen für den Anfang.",
    sv1t: "Neue Adresse anmelden", sv1b: "Ein Termin in einem Berliner Bürgeramt, zum Beispiel im Rathaus Mitte an der Karl-Marx-Allee, mit einem Hinweis, was Sie mitbringen müssen.", sv1q: "„Ich bin umgezogen und muss mich anmelden.“",
    sv2t: "Zum Hausarzt", sv2b: "Ein Termin am Vormittag oder Nachmittag in einer Praxis in Ihrer Nähe. Im Notfall sagt CallAssist Ihnen, dass Sie die 112 anrufen sollen.", sv2q: "„Ich brauche einen Termin bei meinem Hausarzt.“",
    sv3t: "Mit dem Zug fahren", sv3b: "Direkte ICE-Verbindungen ab Berlin Hauptbahnhof nach Hamburg, Hannover, Leipzig, Dresden, Frankfurt, Köln oder München, die Fahrkarte kommt per Post.", sv3q: "„Eine Fahrkarte nach Hamburg, bitte.“",
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
    finalNote: "Am besten in Chrome oder Safari mit Mikrofon. Kein Mikrofon? Dann tippen Sie Ihre Antworten an.",
    footer1: "CallAssist ist ein akademischer Prototyp. Telefonnummer, Termine, Fahrkarten und die Beratung in der Demo sind simuliert; die Standorte der Bürgerämter sind echt."
  };

  // English is the markup itself; remember it so switching back restores it.
  const EN = {};
  document.querySelectorAll("[data-i18n]").forEach((el) => { EN[el.dataset.i18n] = el.textContent; });

  const params = new URLSearchParams(location.search);
  let lang = params.get("lang") || store.get("callassist-lang") || ((navigator.language || "").toLowerCase().startsWith("de") ? "de" : "en");
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
  const lines = [...document.querySelectorAll("#dialogue li")];
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (still) lines.forEach((li) => li.classList.add("shown"));
  else lines.forEach((li, i) => setTimeout(() => li.classList.add("shown"), 350 + i * 850));
})();
