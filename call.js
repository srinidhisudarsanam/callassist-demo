/* CallAssist phone-call simulator.
   Plays the conversation engine (engine.js) as a phone call: speech out, speech in, hold tones,
   live captions, a transcript and a sample confirmation letter. Nothing leaves the browser. */
(() => {
  "use strict";
  const E = window.CallAssistEngine;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const FAST = params.has("fast"); // shortens tones and holds, for automated checks
  const store = {
    get(key) { try { return localStorage.getItem(key); } catch (_) { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch (_) { /* private mode */ } }
  };

  // ---------------------------------------------------------------- interface text

  const UI = {
    en: {
      skip: "Skip to the transcript", back: "CallAssist",
      demoNote: "Demo call. Appointments and tickets are simulated; nothing is really booked.",
      hidePanel: "Hide transcript", showPanel: "Show transcript",
      contactSub: "Free phone line, Monday to Saturday, 8:00 to 20:00",
      actMessage: "message", actCall: "call", actHome: "home", numberLabel: "phone",
      contactHint: "Press the green button and just talk. Allow the microphone when your browser asks.",
      dial: "Call CallAssist", mute: "mute", replies: "replies", speaker: "speaker", slower: "slower", person: "person", repeat: "repeat", hangup: "End call",
      sheetTitle: "What would you say?", done: "Done", typeLabel: "Type what you would say", typePlaceholder: "Or type it…", send: "Send",
      callEnded: "Call ended", callAgain: "Call again", backOverview: "Back to overview",
      transcript: "Live transcript", transcriptEmpty: "The conversation appears here once you call.",
      replyLabel: "Tap what the caller says:", behind: "What CallAssist knows",
      j1: "Understand the errand", j2: "Clarify details", j3: "Check understanding", j4: "Offer two options", j5: "Ask for a clear yes", j6: "Book and confirm",
      behindNote: "Kept only for this call. Nothing is stored or sent.",
      step: (n, label) => `Step ${n} of 6: <b>${label}</b>`, notStarted: "Not connected yet", finished: "Call finished",
      letterSender: "CallAssist, free phone line 0800 225 5277", letterTitle: "Your booking confirmation", letterHello: "Dear Ms Mustermann,",
      letterIntro: "As agreed on the phone, we have booked the following for you:",
      letterHelp: "If anything is unclear, call us free of charge on 0800 225 5277. We will explain everything again, as often as you like.",
      letterBye: "Kind regards,<br />Your CallAssist team", letterFoot: "Sample letter for the demo. Not sent.",
      calling: "calling…", onHold: "on hold", you: "You", assistant: "CallAssist", adviser: "Marina",
      handlerAssistant: "Automated assistant", handlerAdviser: "Marina, human adviser (simulated)",
      turnListening: "Your turn. Just speak.", turnSpeaking: "CallAssist is speaking…", turnAdviserSpeaking: "Marina is speaking…",
      turnTap: "Tap “replies” to answer", turnRetry: "Didn't hear anything. Tap here to talk.", turnMuted: "Microphone muted",
      turnInterrupt: "Tap here or press Space to answer now", showReplies: "Show reply buttons", hideReplies: "Hide",
      voiceDictation: "Safari can only understand speech when Dictation is on: System Settings › Keyboard › Dictation. Turn it on, then reload this page. Until then, tap replies.",
      voiceFile: "The browser won't use the microphone on a page opened as a file. Start the demo with start.command instead. Until then, tap replies.",
      voiceError: (code) => `Voice input stopped unexpectedly (${code}). Tap the green bar to try again, or tap replies.`,
      holdTransferTitle: "Connecting you to Marina", holdTransferSub: "A person from the CallAssist team",
      holdLookup: { address: "Checking the Berlin Citizens' Offices", doctor: "Checking GP practices in Berlin", train: "Checking train times" },
      holdLookupSub: "One moment, please.",
      voiceReady: "Answer when the green bar says “Your turn”. To answer earlier, tap the bar or press Space.",
      voiceBrave: "Brave blocks the speech recognition this demo uses. To talk to CallAssist, open this page in Chrome or Safari. Here, answer by tapping replies.",
      voiceNone: "This browser can't listen. To talk, use Chrome or Safari. Here, answer by tapping replies.",
      voiceDenied: "Microphone access is blocked. Allow it next to the address bar to talk, or tap replies.",
      voiceNetwork: "Speech recognition isn't reachable right now. Answer by tapping replies.",
      voiceNoMic: "No microphone found. Answer by tapping replies.",
      sysStart: "Call connected", sysAdviser: "Marina joined the call", sysEnd: (d) => `Call ended after ${d}`,
      kindAppointment: "Appointment booked", kindTicket: "Ticket booked", viewLetter: "View the confirmation letter",
      bring: {
        address: "Please bring your ID card or passport and the landlord's confirmation that you have moved in (in German: Wohnungsgeberbestätigung).",
        doctor: "Please bring your health insurance card.",
        train: "Your ticket is enclosed. Please carry photo ID when you travel."
      }
    },
    de: {
      skip: "Zum Gesprächsverlauf springen", back: "CallAssist",
      demoNote: "Demo-Anruf. Termine und Fahrkarten sind simuliert; es wird nichts wirklich gebucht.",
      hidePanel: "Verlauf ausblenden", showPanel: "Verlauf einblenden",
      contactSub: "Kostenlose Telefonnummer, Montag bis Samstag, 8 bis 20 Uhr",
      actMessage: "Nachricht", actCall: "Anrufen", actHome: "Privat", numberLabel: "Telefon",
      contactHint: "Drücken Sie den grünen Knopf und sprechen Sie einfach. Erlauben Sie das Mikrofon, wenn der Browser fragt.",
      dial: "CallAssist anrufen", mute: "stumm", replies: "Antworten", speaker: "Lautspr.", slower: "langsamer", person: "Mensch", repeat: "wiederholen", hangup: "Auflegen",
      sheetTitle: "Was würden Sie sagen?", done: "Fertig", typeLabel: "Schreiben Sie, was Sie sagen würden", typePlaceholder: "Oder hier eintippen…", send: "Senden",
      callEnded: "Anruf beendet", callAgain: "Erneut anrufen", backOverview: "Zur Übersicht",
      transcript: "Gesprächsverlauf", transcriptEmpty: "Hier erscheint das Gespräch, sobald Sie anrufen.",
      replyLabel: "Tippen Sie, was die Person sagt:", behind: "Was CallAssist weiß",
      j1: "Anliegen verstehen", j2: "Details klären", j3: "Verständnis prüfen", j4: "Zwei Optionen anbieten", j5: "Klares Ja einholen", j6: "Buchen und bestätigen",
      behindNote: "Nur für diesen Anruf. Es wird nichts gespeichert oder gesendet.",
      step: (n, label) => `Schritt ${n} von 6: <b>${label}</b>`, notStarted: "Noch nicht verbunden", finished: "Anruf beendet",
      letterSender: "CallAssist, kostenlose Telefonnummer 0800 225 5277", letterTitle: "Ihre Buchungsbestätigung", letterHello: "Sehr geehrte Frau Mustermann,",
      letterIntro: "wie am Telefon besprochen, haben wir Folgendes für Sie gebucht:",
      letterHelp: "Wenn etwas unklar ist, rufen Sie uns kostenlos unter 0800 225 5277 an. Wir erklären Ihnen alles noch einmal, so oft Sie möchten.",
      letterBye: "Mit freundlichen Grüßen<br />Ihr CallAssist-Team", letterFoot: "Beispielbrief für die Demo. Nicht versendet.",
      calling: "wird angerufen…", onHold: "in der Warteschleife", you: "Sie", assistant: "CallAssist", adviser: "Marina",
      handlerAssistant: "Automatischer Assistent", handlerAdviser: "Marina, menschliche Beratung (simuliert)",
      turnListening: "Sie sind dran. Sprechen Sie einfach.", turnSpeaking: "CallAssist spricht…", turnAdviserSpeaking: "Marina spricht…",
      turnTap: "Tippen Sie auf „Antworten“", turnRetry: "Nichts gehört. Hier tippen, um zu sprechen.", turnMuted: "Mikrofon stumm",
      turnInterrupt: "Hier tippen oder Leertaste, um jetzt zu antworten", showReplies: "Antwort-Knöpfe zeigen", hideReplies: "Ausblenden",
      voiceDictation: "Safari versteht Sprache nur, wenn das Diktieren eingeschaltet ist: Systemeinstellungen › Tastatur › Diktat. Einschalten und die Seite neu laden. Bis dahin Antworten antippen.",
      voiceFile: "Auf einer als Datei geöffneten Seite nutzt der Browser kein Mikrofon. Starten Sie die Demo mit start.command. Bis dahin Antworten antippen.",
      voiceError: (code) => `Die Spracheingabe wurde unerwartet beendet (${code}). Tippen Sie auf den grünen Balken, um es erneut zu versuchen, oder tippen Sie Antworten.`,
      holdTransferTitle: "Sie werden mit Marina verbunden", holdTransferSub: "Ein Mensch aus dem CallAssist-Team",
      holdLookup: { address: "Berliner Bürgerämter werden geprüft", doctor: "Hausarztpraxen in Berlin werden geprüft", train: "Zugverbindungen werden geprüft" },
      holdLookupSub: "Einen Moment bitte.",
      voiceReady: "Antworten Sie, wenn der grüne Balken „Sie sind dran“ zeigt. Früher antworten: Balken antippen oder Leertaste.",
      voiceBrave: "Brave blockiert die Spracherkennung, die diese Demo nutzt. Um mit CallAssist zu sprechen, öffnen Sie die Seite in Chrome oder Safari. Hier antworten Sie mit den Antwort-Knöpfen.",
      voiceNone: "Dieser Browser kann nicht zuhören. Zum Sprechen Chrome oder Safari nutzen. Hier antworten Sie mit den Antwort-Knöpfen.",
      voiceDenied: "Der Mikrofonzugriff ist blockiert. Erlauben Sie ihn neben der Adresszeile, oder tippen Sie Antworten.",
      voiceNetwork: "Die Spracherkennung ist gerade nicht erreichbar. Antworten Sie mit den Antwort-Knöpfen.",
      voiceNoMic: "Kein Mikrofon gefunden. Antworten Sie mit den Antwort-Knöpfen.",
      sysStart: "Anruf verbunden", sysAdviser: "Marina ist dem Gespräch beigetreten", sysEnd: (d) => `Anruf nach ${d} beendet`,
      kindAppointment: "Termin gebucht", kindTicket: "Fahrkarte gebucht", viewLetter: "Bestätigungsbrief ansehen",
      bring: {
        address: "Bitte bringen Sie Ihren Personalausweis oder Reisepass und die Wohnungsgeberbestätigung mit.",
        doctor: "Bitte bringen Sie Ihre Versichertenkarte mit.",
        train: "Ihre Fahrkarte liegt diesem Brief bei. Bitte führen Sie einen Lichtbildausweis mit."
      }
    }
  };
  const HTML_KEYS = new Set(["letterBye"]);

  // ---------------------------------------------------------------- state

  const initialLang = params.get("lang") || store.get("callassist-lang") || ((navigator.language || "").toLowerCase().startsWith("de") ? "de" : "en");
  let lang = initialLang === "de" ? "de" : "en";
  let call = null;
  let token = 0;
  let speakerOn = !params.has("mute");
  let slow = false;
  let micMuted = false;
  let voice = detectVoiceInput();
  let recognition = null;
  let silentRounds = 0;
  let timerId = null;
  let startedAt = 0;
  let audio = null;
  let holdSound = null;
  let chipsLockedUntil = 0;
  let rushToken = -1; // set when the caller interrupts: the rest of that turn is shown, not spoken
  let repliesOpen = false;
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
  let voices = [];

  const t = () => UI[lang];

  function detectVoiceInput() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (navigator.brave) return { ok: false, reason: "voiceBrave" };
    if (!Recognition) return { ok: false, reason: "voiceNone" };
    return { ok: true, reason: "voiceReady" };
  }

  // ---------------------------------------------------------------- language

  function applyLanguage() {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const value = t()[el.dataset.i18n];
      if (typeof value !== "string") return;
      if (HTML_KEYS.has(el.dataset.i18n)) el.innerHTML = value;
      else el.textContent = value;
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => { el.placeholder = t()[el.dataset.i18nPlaceholder]; });
    document.querySelectorAll(".lang button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
    const hidden = document.body.classList.contains("panel-hidden");
    $("panelToggle").textContent = hidden ? t().showPanel : t().hidePanel;
    ["backLink", "overviewLink"].forEach((id) => { $(id).href = `index.html?lang=${lang}`; });
    $("voiceNote").textContent = t()[voice.reason] || "";
    renderHandler();
    renderFacts();
    renderChips();
    if (call && !call.ended) setTurn($("turn").dataset.state);
    store.set("callassist-lang", lang);
  }

  function chooseLanguage(next) {
    if (next === lang) return;
    if (call && !call.ended && call.stage !== "ringing") {
      run({ type: "lang", lang: next });
    } else {
      lang = next;
      applyLanguage();
    }
  }

  // ---------------------------------------------------------------- sound

  function audioContext() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audio) audio = new Ctx();
    if (audio.state === "suspended") audio.resume();
    return audio;
  }

  function tone(freq, start, duration, volume = 0.05, type = "sine") {
    const ctx = audioContext();
    if (!ctx || !speakerOn) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const at = ctx.currentTime + start;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + 0.03);
    gain.gain.setValueAtTime(volume, at + duration - 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + duration + 0.02);
  }

  // German ringback tone: 425 Hz, one second on.
  function ringback() {
    tone(425, 0, 1, 0.05);
    tone(425, 2.2, 1, 0.05);
  }
  function endTones() {
    [0, 0.25, 0.5].forEach((start) => tone(425, start, 0.16, 0.05));
  }

  function startHoldMusic() {
    stopHoldMusic();
    if (!speakerOn || !audioContext()) return;
    const notes = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880, 698.46];
    let i = 0;
    const play = () => { tone(notes[i % notes.length], 0, 0.42, 0.028, "triangle"); i += 1; };
    play();
    holdSound = setInterval(play, 440);
  }
  function stopHoldMusic() {
    if (holdSound) clearInterval(holdSound);
    holdSound = null;
  }

  // ---------------------------------------------------------------- speech out

  function loadVoices() {
    if ("speechSynthesis" in window) voices = window.speechSynthesis.getVoices();
  }
  // The assistant always speaks with a male voice and Marina with a female one, so the handover is audible.
  // Names cover macOS/iOS, Edge's neural voices, Chrome's Google voices and Windows; "(Premium)"/"(Enhanced)" versions win
  // when installed. Google's voices rank above the older Windows desktop voices (Hazel, Zira, Hedda), which sound robotic.
  const VOICE_PREFS = {
    en: {
      assistant: ["Microsoft Ryan", "Microsoft Thomas", "Microsoft Guy", "Daniel", "Arthur", "Oliver", "Jamie", "Google UK English Male", "Microsoft George", "Microsoft David", "Microsoft Mark", "Alex", "Aaron", "Tom", "Evan", "Reed"],
      adviser: ["Microsoft Sonia", "Microsoft Libby", "Microsoft Maisie", "Microsoft Ava", "Microsoft Emma", "Microsoft Jenny", "Microsoft Aria", "Ava", "Zoe", "Serena", "Kate", "Stephanie", "Allison", "Susan", "Google UK English Female", "Google US English", "Samantha", "Moira", "Karen", "Tessa", "Martha", "Microsoft Hazel", "Microsoft Zira"]
    },
    de: {
      assistant: ["Markus", "Yannick", "Martin", "Viktor", "Microsoft Conrad", "Microsoft Killian", "Microsoft Florian", "Microsoft Stefan", "Reed", "Eddy", "Rocko"],
      adviser: ["Microsoft Seraphina", "Microsoft Katja Online", "Microsoft Amala", "Anna", "Petra", "Helena", "Google Deutsch", "Microsoft Katja", "Microsoft Hedda", "Sandy", "Shelley", "Flo"]
    }
  };
  const NOVELTY = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|wobble|fred|good news|jester|junior|organ|superstar|ralph|trinoids|whisper|zarvox|grandma|grandpa)\b/i;
  const voiceCache = {};

  function findVoice(code, who, avoid) {
    const pool = voices.filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith(code) && !NOVELTY.test(v.name) && v !== avoid);
    // Neural "Natural"/"Online" (Edge) and "Premium"/"Enhanced" (Apple) voices sound human; prefer any of them first.
    // Chrome's Google voices are the same on every computer, so they rank with these too: any laptop with
    // Chrome or Edge then gets the same good voices, and the laptop's own older voices are only a fallback.
    const quality = (v) => (/(premium|enhanced|natural|neural|online|^google)/i.test(v.name) ? 0 : 1);
    const named = (v, name) => v.name.toLowerCase().startsWith(name.toLowerCase());
    for (const pass of [0, 1]) {
      for (const name of VOICE_PREFS[code][who]) {
        const hit = pool.find((v) => named(v, name) && quality(v) <= pass);
        if (hit) return hit;
      }
    }
    const regional = pool.filter((v) => /gb|de-de/i.test(v.lang)).sort((a, b) => quality(a) - quality(b));
    return regional[0] || pool[0] || null;
  }

  function pickVoice(who) {
    const code = call ? call.lang : lang;
    const key = `${code}:${voices.length}`;
    if (!voiceCache[key]) {
      const assistant = findVoice(code, "assistant", null);
      // Marina must never share the assistant's voice.
      const adviser = findVoice(code, "adviser", assistant);
      voiceCache[key] = { assistant, adviser };
    }
    return voiceCache[key][who];
  }

  // Split into sentences so captions follow the voice, without splitting "6. Oktober" or "31. The".
  function sentences(text) {
    return text.split(/(?<=[^\d\s][.!?])\s+/).filter(Boolean);
  }

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const PAUSE_MS = 1200; // silence after the caller's last word that ends their turn

  function utter(part, who) {
    return new Promise((resolve) => {
      const synth = window.speechSynthesis;
      const u = new SpeechSynthesisUtterance(part);
      u.lang = (call ? call.lang : lang) === "de" ? "de-DE" : "en-GB";
      const v = pickVoice(who);
      if (v) u.voice = v;
      // Marina keeps her voice's natural pitch and pace; bending it is what makes a voice sound synthetic.
      // The assistant is set slightly lower, which keeps the two apart even on a device with one voice.
      u.rate = slow ? 0.8 : who === "adviser" ? 1.02 : 0.97;
      u.pitch = who === "adviser" ? 1 : 0.92;
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(guard);
        resolve();
      };
      // Some browsers never fire "end"; never let a missing event stall the call.
      const guard = setTimeout(finish, 2500 + (part.length * 95) / (slow ? 0.78 : 1));
      u.onend = finish;
      u.onerror = finish;
      synth.resume();
      synth.speak(u);
    });
  }

  async function speak(text, who, myToken) {
    const phone = $("phone");
    if (rushToken === myToken) { showCaption(who, text); return; }
    if (!speakerOn || !("speechSynthesis" in window)) {
      // Silent mode: captions still advance sentence by sentence at a comfortable reading pace.
      for (const part of sentences(text)) {
        if (myToken !== token || rushToken === myToken) return;
        showCaption(who, part);
        await wait(FAST ? 15 : Math.min(4000, 700 + part.length * 38));
      }
      return;
    }
    phone.classList.add("is-speaking");
    for (const [i, part] of sentences(text).entries()) {
      if (myToken !== token || rushToken === myToken) break;
      // People breathe between sentences, and never for exactly the same time.
      if (i > 0 && who === "adviser") await wait(220 + Math.random() * 260);
      showCaption(who, part);
      await utter(part, who);
    }
    phone.classList.remove("is-speaking");
  }

  function stopSpeech() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    $("phone").classList.remove("is-speaking");
  }

  // ---------------------------------------------------------------- speech in

  function startListening() {
    if (!call || call.ended || call.stage === "hold") return;
    if (!voice.ok) { setTurn("tap"); return; }
    if (micMuted) { setTurn("muted"); return; }
    stopListening();
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new Recognition();
    recognition = rec;
    rec.lang = call.lang === "de" ? "de-DE" : "en-GB";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    const myToken = token;
    let finalText = "";
    let lastInterim = "";
    let silenceTimer = null;
    let hardStop = null;
    rec.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      lastInterim = interim.trim();
      showCaption("caller", (finalText + " " + interim).trim(), true);
      // Safari often keeps listening after the caller stops talking. End the turn ourselves
      // after a short pause: stop() asks for the final text, finish() is the fallback.
      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        try { rec.stop(); } catch (_) { /* already stopped */ }
        hardStop = setTimeout(finish, 900);
      }, lastInterim ? PAUSE_MS : 500);
    };
    rec.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      const onFile = location.protocol === "file:";
      const reasons = {
        "not-allowed": onFile ? "voiceFile" : isSafari ? "voiceDictation" : "voiceDenied",
        "service-not-allowed": onFile ? "voiceFile" : isSafari ? "voiceDictation" : "voiceDenied",
        network: "voiceNetwork",
        "audio-capture": "voiceNoMic"
      };
      if (reasons[event.error]) {
        voice = { ok: false, reason: reasons[event.error] };
        $("voiceNote").textContent = t()[voice.reason];
        renderChips();
        openSheetIfNeeded();
      } else {
        $("voiceNote").textContent = t().voiceError(event.error || "unknown");
      }
    };
    rec.onend = () => finish();
    function finish() {
      clearTimeout(silenceTimer);
      clearTimeout(hardStop);
      if (recognition !== rec) return;
      recognition = null;
      try { rec.abort(); } catch (_) { /* already stopped */ }
      if (myToken !== token || !call || call.ended) return;
      // Some browsers end without marking the last words final; use what was heard.
      const text = finalText.trim() || lastInterim;
      if (text) {
        silentRounds = 0;
        run({ type: "say", text });
      } else if (voice.ok && !micMuted && silentRounds < 5) {
        silentRounds += 1;
        startListening();
      } else {
        setTurn(voice.ok && !micMuted ? "retry" : "tap");
      }
    }
    try {
      rec.start();
      setTurn("listening");
    } catch (_) {
      setTurn("tap");
    }
  }

  function stopListening() {
    const rec = recognition;
    recognition = null;
    if (rec) { try { rec.abort(); } catch (_) { /* already stopped */ } }
  }

  async function warmUpMicrophone() {
    if (!voice.ok || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch (error) {
      voice = { ok: false, reason: error && error.name === "NotFoundError" ? "voiceNoMic" : location.protocol === "file:" ? "voiceFile" : "voiceDenied" };
      $("voiceNote").textContent = t()[voice.reason];
    }
  }

  // ---------------------------------------------------------------- rendering

  function setScreen(name) {
    $("phone").dataset.screen = name;
    $("contactScreen").hidden = name !== "contact";
    $("callScreen").hidden = name !== "call";
    $("endScreen").hidden = name !== "end";
  }

  function whoName(who) {
    return who === "caller" ? t().you : who === "adviser" ? t().adviser : t().assistant;
  }

  function showCaption(who, text, interim = false) {
    $("captionWho").textContent = whoName(who);
    const el = $("captionText");
    el.textContent = text;
    el.classList.toggle("interim", interim);
    if (who !== "caller") setTurn(who === "adviser" ? "adviserSpeaking" : "speaking");
  }

  function setTurn(state) {
    const el = $("turn");
    el.dataset.state = state === "adviserSpeaking" ? "speaking" : state;
    const canTalk = voice.ok && !micMuted;
    const speaking = state === "speaking" || state === "adviserSpeaking";
    const text = speaking && canTalk ? t().turnInterrupt : { listening: t().turnListening, speaking: t().turnSpeaking, adviserSpeaking: t().turnAdviserSpeaking, tap: t().turnTap, retry: t().turnRetry, muted: t().turnMuted, idle: "" }[state] || "";
    $("turnText").textContent = text;
    el.classList.toggle("clickable", canTalk && (state === "retry" || speaking));
    el.disabled = !el.classList.contains("clickable");
  }

  function addLine(kind, text, extra) {
    $("transcriptEmpty").hidden = true;
    const li = document.createElement("li");
    li.className = `line ${kind}${extra && extra.redacted ? " redacted" : ""}`;
    if (kind !== "system") {
      const who = document.createElement("p");
      who.className = "line-who";
      who.textContent = whoName(kind);
      li.append(who);
    }
    const p = document.createElement("p");
    p.className = "line-text";
    p.textContent = text;
    li.append(p);
    $("transcript").append(li);
    li.scrollIntoView({ block: "end", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  function bookingCard(booking) {
    const bLang = lang;
    const card = E.optionCard(booking, bLang);
    const el = document.createElement("div");
    el.className = "booking";
    el.dataset.ref = booking.ref;
    el.innerHTML = '<div class="booking-top"><p class="booking-kind"></p><p class="booking-ref"></p></div><p class="booking-title"></p><p class="booking-when"></p><p class="booking-detail"></p>';
    el.querySelector(".booking-kind").textContent = booking.service === "train" ? t().kindTicket : t().kindAppointment;
    el.querySelector(".booking-ref").textContent = booking.ref;
    el.querySelector(".booking-title").textContent = card.title;
    el.querySelector(".booking-when").textContent = card.when;
    el.querySelector(".booking-detail").textContent = card.detail;
    if (booking.postal) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "booking-letter";
      button.textContent = t().viewLetter;
      button.addEventListener("click", () => openLetter(booking));
      el.append(button);
    }
    return el;
  }

  function addBookingLine(booking) {
    const existing = $("transcript").querySelector(`[data-booking="${booking.ref}"]`);
    const li = existing || document.createElement("li");
    li.className = "line card";
    li.dataset.booking = booking.ref;
    li.replaceChildren(bookingCard(booking));
    if (!existing) $("transcript").append(li);
    li.scrollIntoView({ block: "end" });
  }

  function renderHandler() {
    const who = call && call.handler === "adviser" ? "adviser" : "assistant";
    $("handlerPill").dataset.who = who;
    $("handlerText").textContent = who === "adviser" ? t().handlerAdviser : t().handlerAssistant;
    $("phone").dataset.who = who;
    $("peerName").textContent = who === "adviser" ? "Marina" : "CallAssist";
    const avatar = $("peerAvatar");
    if (who === "adviser") avatar.textContent = "M";
  }

  function renderFacts() {
    const facts = E.knowledge(call || E.createCall({ lang }));
    const dl = $("facts");
    dl.replaceChildren();
    facts.forEach((row) => {
      const dt = document.createElement("dt");
      dt.textContent = row.label;
      const dd = document.createElement("dd");
      dd.textContent = row.value || "—";
      dl.append(dt, dd);
    });
    const index = call ? E.journeyIndex(call) : -1;
    [...$("journey").children].forEach((li, i) => {
      li.classList.toggle("done", i < index);
      li.classList.toggle("now", i === index);
    });
    const label = $("progressLabel");
    if (index < 0) label.textContent = t().notStarted;
    else if (index > 5 || (call && call.ended)) label.textContent = t().finished;
    else label.innerHTML = t().step(index + 1, t()["j" + (index + 1)]);
  }

  function renderChips() {
    const list = call && !call.ended ? E.suggestions(call) : [];
    const disabled = !call || call.ended || call.stage === "hold";
    document.querySelectorAll("[data-chips]").forEach((box) => {
      box.replaceChildren();
      list.forEach((text) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = text;
        b.disabled = disabled;
        b.addEventListener("click", () => {
          if (Date.now() < chipsLockedUntil) return;
          chipsLockedUntil = Date.now() + 700;
          $("replySheet").hidden = true;
          $("keypadButton").setAttribute("aria-pressed", "false");
          run({ type: "say", text });
        });
        box.append(b);
      });
    });
    document.querySelectorAll("[data-type-form] input, [data-type-form] button").forEach((el) => { el.disabled = disabled; });
    const area = $("replyArea");
    area.hidden = !call || call.ended;
    area.dataset.voice = voice.ok ? "on" : "off";
    area.dataset.collapsed = String(voice.ok && !repliesOpen);
    $("replyToggle").textContent = repliesOpen ? t().hideReplies : t().showReplies;
    $("replyToggle").setAttribute("aria-expanded", String(!voice.ok || repliesOpen));
  }

  function renderControls() {
    const onHold = call && call.stage === "hold";
    $("personButton").disabled = !!onHold || (call && call.handler === "adviser");
    $("repeatButton").disabled = !!onHold;
  }

  function render() {
    renderHandler();
    renderFacts();
    renderChips();
    renderControls();
  }

  function openSheetIfNeeded() {
    if (!voice.ok && matchMedia("(max-width: 900px)").matches) {
      $("replySheet").hidden = false;
      $("keypadButton").setAttribute("aria-pressed", "true");
    }
  }

  function showHold(kind) {
    const service = call.service || "address";
    $("holdTitle").textContent = kind === "transfer" ? t().holdTransferTitle : t().holdLookup[service];
    $("holdSub").textContent = kind === "transfer" ? t().holdTransferSub : t().holdLookupSub;
    $("hold").hidden = false;
    $("callStatus").textContent = t().onHold;
    startHoldMusic();
  }
  function hideHold() {
    $("hold").hidden = true;
    stopHoldMusic();
    if (startedAt) $("callStatus").textContent = formatDuration(Date.now() - startedAt);
  }

  // ---------------------------------------------------------------- the call loop

  async function run(event) {
    if (!call) return;
    const myToken = ++token;
    stopListening();
    stopSpeech();
    const result = E.step(call, event);
    call = result.state;
    render();

    for (const out of result.out) {
      if (myToken !== token) return;
      if (out.type === "caller") {
        addLine("caller", out.text, out);
        showCaption("caller", out.text);
      } else if (out.type === "say") {
        addLine(out.who, out.text);
        await speak(out.text, out.who, myToken);
      } else if (out.type === "handler") {
        addLine("system", t().sysAdviser);
        render();
      } else if (out.type === "lang") {
        lang = out.lang;
        applyLanguage();
      } else if (out.type === "booked" || out.type === "postal") {
        addBookingLine(out.booking);
      } else if (out.type === "hold") {
        showHold(out.kind);
        setTurn("idle");
        await wait(FAST ? 250 : out.ms);
        if (myToken !== token) return;
        hideHold();
        run({ type: "resume" });
        return;
      } else if (out.type === "end") {
        finishCall();
        return;
      }
    }
    if (myToken !== token) return;
    // A short pause so the recogniser doesn't catch the end of CallAssist's own voice.
    if (rushToken !== myToken && speakerOn && !FAST) await wait(300);
    if (myToken !== token) return;
    startListening();
    if (!voice.ok) setTurn("tap");
  }

  function formatDuration(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }

  async function dial() {
    if (call && !call.ended) return;
    token += 1;
    const myToken = token;
    audioContext();
    // Unlock speech inside the click so later lines are allowed to play (Safari).
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const unlock = new SpeechSynthesisUtterance(" ");
      unlock.volume = 0;
      window.speechSynthesis.speak(unlock);
    }
    call = E.createCall({ lang });
    silentRounds = 0;
    $("transcript").replaceChildren();
    $("transcriptEmpty").hidden = false;
    $("captionWho").textContent = "";
    $("captionText").textContent = "";
    $("peerAvatar").innerHTML = $("contactScreen").querySelector(".contact-avatar").innerHTML;
    setScreen("call");
    $("callStatus").textContent = t().calling;
    setTurn("idle");
    render();
    ringback();
    const mic = warmUpMicrophone();
    await wait(FAST ? 150 : 3300);
    await mic;
    if (myToken !== token) return;
    startedAt = Date.now();
    clearInterval(timerId);
    const tick = () => { if (call && call.stage !== "hold") $("callStatus").textContent = formatDuration(Date.now() - startedAt); };
    tick();
    timerId = setInterval(tick, 1000);
    addLine("system", t().sysStart);
    $("voiceNote").textContent = t()[voice.reason] || "";
    openSheetIfNeeded();
    run({ type: "start" });
  }

  function finishCall() {
    token += 1;
    stopListening();
    stopSpeech();
    hideHold();
    clearInterval(timerId);
    endTones();
    const duration = formatDuration(Date.now() - startedAt);
    addLine("system", t().sysEnd(duration));
    $("endDuration").textContent = duration;
    const box = $("endBookings");
    box.replaceChildren(...(call ? call.bookings.map(bookingCard) : []));
    $("replySheet").hidden = true;
    setScreen("end");
    render();
    $("againButton").focus();
  }

  function hangUp() {
    if (!call || call.ended) return;
    if (call.stage === "ringing") {
      call = Object.assign({}, call, { ended: true, stage: "done" });
      startedAt = Date.now();
      finishCall();
      return;
    }
    run({ type: "hangup" });
  }

  // ---------------------------------------------------------------- letter

  function openLetter(booking) {
    const card = E.optionCard(booking, lang);
    $("letterDate").textContent = new Intl.DateTimeFormat(lang === "de" ? "de-DE" : "en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date());
    const box = $("letterBox");
    box.replaceChildren();
    const rows = [[card.title, "big"], [card.when, ""], [card.detail, ""], [`${lang === "de" ? "Referenznummer" : "Reference number"}: ${booking.ref}`, ""]];
    rows.forEach(([text, cls]) => {
      const p = document.createElement("p");
      if (cls) p.className = cls;
      p.textContent = text;
      box.append(p);
    });
    $("letterBring").textContent = t().bring[booking.service];
    $("letter").showModal();
  }

  // ---------------------------------------------------------------- wiring

  $("dialButton").addEventListener("click", dial);
  $("againButton").addEventListener("click", () => { call = null; setScreen("contact"); dial(); });
  $("hangupButton").addEventListener("click", hangUp);
  $("personButton").addEventListener("click", () => run({ type: "person" }));
  $("repeatButton").addEventListener("click", () => run({ type: "repeat" }));
  $("speakerButton").addEventListener("click", () => {
    speakerOn = !speakerOn;
    $("speakerButton").setAttribute("aria-pressed", String(speakerOn));
    if (!speakerOn) { stopSpeech(); stopHoldMusic(); }
  });
  $("slowButton").addEventListener("click", () => {
    slow = !slow;
    $("slowButton").setAttribute("aria-pressed", String(slow));
  });
  $("muteButton").addEventListener("click", () => {
    micMuted = !micMuted;
    $("muteButton").setAttribute("aria-pressed", String(micMuted));
    if (micMuted) { stopListening(); setTurn("muted"); } else if (!$("phone").classList.contains("is-speaking")) startListening();
  });
  $("keypadButton").addEventListener("click", () => {
    const open = $("replySheet").hidden;
    $("replySheet").hidden = !open;
    $("keypadButton").setAttribute("aria-pressed", String(open));
  });
  $("sheetClose").addEventListener("click", () => { $("replySheet").hidden = true; $("keypadButton").setAttribute("aria-pressed", "false"); });
  function talkNow() {
    if (!call || call.ended || !$("turn").classList.contains("clickable")) return;
    silentRounds = 0;
    if ($("phone").classList.contains("is-speaking") || ["speaking"].includes($("turn").dataset.state)) {
      // Interrupt: the rest of this turn goes to the transcript silently, then CallAssist listens.
      rushToken = token;
      stopSpeech();
      return;
    }
    startListening();
  }
  $("turn").addEventListener("click", talkNow);
  document.addEventListener("keydown", (event) => {
    if (event.code !== "Space" || event.repeat) return;
    if (event.target.closest("input, textarea, button, a, summary, dialog")) return;
    event.preventDefault();
    talkNow();
  });
  $("replyToggle").addEventListener("click", () => { repliesOpen = !repliesOpen; renderChips(); });
  document.querySelectorAll("[data-type-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = form.querySelector("input");
      const text = input.value.trim();
      input.value = "";
      if (text) { $("replySheet").hidden = true; run({ type: "say", text }); }
    });
  });
  document.querySelectorAll(".lang button").forEach((b) => b.addEventListener("click", () => chooseLanguage(b.dataset.lang)));
  $("panelToggle").addEventListener("click", () => {
    const hidden = document.body.classList.toggle("panel-hidden");
    $("panelToggle").setAttribute("aria-pressed", String(!hidden));
    $("panelToggle").textContent = hidden ? t().showPanel : t().hidePanel;
    store.set("callassist-panel", hidden ? "hidden" : "shown");
  });
  if (store.get("callassist-panel") === "hidden" || params.get("panel") === "hidden") {
    document.body.classList.add("panel-hidden");
    $("panelToggle").setAttribute("aria-pressed", "false");
  }
  if (!speakerOn) $("speakerButton").setAttribute("aria-pressed", "false");

  const clock = () => { $("clock").textContent = new Intl.DateTimeFormat("de-DE", { hour: "numeric", minute: "2-digit" }).format(new Date()); };
  clock();
  setInterval(clock, 30000);

  loadVoices();
  if ("speechSynthesis" in window) window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
  window.addEventListener("pagehide", () => { stopSpeech(); stopListening(); });

  setScreen("contact");
  applyLanguage();
  if (params.has("autodial")) dial();
})();
