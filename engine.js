/* CallAssist conversation engine.
   Pure logic with no DOM access: call.js renders it, tests/engine.test.js exercises it in Node.
   Every step takes the current call state and one event, and returns a new state plus a list of
   outputs ("say", "caller", "hold", "booked", "postal", "handler", "lang", "end") for the UI to play. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CallAssistEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const TRANSFER_MS = 3400;
  const LOOKUP_MS = 2600;

  // ---------------------------------------------------------------- reference data

  const CITIES = {
    berlin: { en: "Berlin", de: "Berlin", words: ["berlin"] },
    hamburg: { en: "Hamburg", de: "Hamburg", words: ["hamburg"], mins: 104 },
    hanover: { en: "Hanover", de: "Hannover", words: ["hanover", "hannover"], mins: 99 },
    leipzig: { en: "Leipzig", de: "Leipzig", words: ["leipzig"], mins: 76 },
    dresden: { en: "Dresden", de: "Dresden", words: ["dresden"], mins: 118 },
    frankfurt: { en: "Frankfurt", de: "Frankfurt", words: ["frankfurt"], mins: 238 },
    cologne: { en: "Cologne", de: "Köln", words: ["cologne", "köln", "koeln", "koln"], mins: 262 },
    munich: { en: "Munich", de: "München", words: ["munich", "münchen", "muenchen", "munchen"], mins: 241 },
    stuttgart: { en: "Stuttgart", de: "Stuttgart", words: ["stuttgart"] },
    dusseldorf: { en: "Düsseldorf", de: "Düsseldorf", words: ["düsseldorf", "dusseldorf", "duesseldorf"] },
    bremen: { en: "Bremen", de: "Bremen", words: ["bremen"] },
    potsdam: { en: "Potsdam", de: "Potsdam", words: ["potsdam"] },
    nuremberg: { en: "Nuremberg", de: "Nürnberg", words: ["nuremberg", "nürnberg", "nuernberg"] },
    bonn: { en: "Bonn", de: "Bonn", words: ["bonn"] },
    dortmund: { en: "Dortmund", de: "Dortmund", words: ["dortmund"] },
    rostock: { en: "Rostock", de: "Rostock", words: ["rostock"] },
    kiel: { en: "Kiel", de: "Kiel", words: ["kiel"] }
  };

  // Real Berlin Citizens' Office locations; the appointments offered at them are simulated.
  const PLACES = {
    address: [
      {
        key: "mitte",
        spoken: { en: "at the Citizens' Office in Mitte Town Hall, Karl-Marx-Allee 31", de: "im Bürgeramt Rathaus Mitte, Karl-Marx-Allee 31" },
        name: { en: "Citizens' Office, Mitte Town Hall", de: "Bürgeramt Rathaus Mitte" },
        street: "Karl-Marx-Allee 31, 10178 Berlin"
      },
      {
        key: "schoeneberg",
        spoken: { en: "at the Citizens' Office in Schöneberg Town Hall, John-F.-Kennedy-Platz 1", de: "im Bürgeramt Rathaus Schöneberg, John-F.-Kennedy-Platz 1" },
        name: { en: "Citizens' Office, Schöneberg Town Hall", de: "Bürgeramt Rathaus Schöneberg" },
        street: "John-F.-Kennedy-Platz 1, 10825 Berlin"
      }
    ],
    doctor: [
      {
        key: "mitte",
        spoken: { en: "at a GP practice in Berlin-Mitte", de: "in einer Hausarztpraxis in Berlin-Mitte" },
        name: { en: "GP practice, Berlin-Mitte", de: "Hausarztpraxis, Berlin-Mitte" },
        street: "Berlin-Mitte"
      },
      {
        key: "schoeneberg",
        spoken: { en: "at a GP practice in Berlin-Schöneberg", de: "in einer Hausarztpraxis in Berlin-Schöneberg" },
        name: { en: "GP practice, Berlin-Schöneberg", de: "Hausarztpraxis, Berlin-Schöneberg" },
        street: "Berlin-Schöneberg"
      }
    ]
  };

  const TIMES = {
    address: { morning: ["09:40", "11:20"], afternoon: ["14:10", "15:30"] },
    doctor: { morning: ["08:45", "10:30"], afternoon: ["14:30", "16:15"] },
    train: { morning: ["07:36", "09:36"], afternoon: ["13:36", "15:36"] }
  };

  const WEEKDAYS = {
    en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    de: ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]
  };

  // ---------------------------------------------------------------- language understanding

  const escape = (word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Whole-word matcher that also works for umlauts; a trailing * allows any word ending.
  function words(list) {
    const body = list.map((w) => (w.endsWith("*") ? escape(w.slice(0, -1)) + "\\p{L}*" : escape(w))).join("|");
    return new RegExp(`(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{L}\\p{N}])`, "u");
  }
  const find = (re, text) => {
    const m = re.exec(text);
    return m ? m.index : -1;
  };

  const LEX = {
    address: words(["moved", "move", "moving", "new address", "address", "register*", "registration", "relocat*", "umgezogen", "umzug", "umziehen", "ziehe um", "adresse", "anmeld*", "ummeld*", "wohnsitz", "bürgeramt", "buergeramt", "citizens office", "citizens' office", "citizen's office", "meldebescheinigung"]),
    doctor: words(["doctor", "doctors", "doctor's", "gp", "physician", "check-up", "checkup", "check up", "prescription", "medical", "sick", "unwell", "arzt", "ärztin", "hausarzt*", "hausärzt*", "arzttermin", "praxis", "rezept", "krank", "untersuchung", "doktor"]),
    train: words(["train", "trains", "rail", "railway", "ticket", "tickets", "journey", "travel*", "trip", "ice", "deutsche bahn", "zug", "züge", "zugfahrt", "zugfahrkarte", "bahn", "bahnfahrt", "bahnfahrkarte", "fahrkarte*", "reise", "reisen", "fahren", "fahrt", "verreisen"]),
    yes: words(["yes", "yeah", "yep", "yup", "correct", "right", "that's right", "thats right", "sure", "alright", "all right", "ok", "okay", "fine", "perfect", "great", "good", "go ahead", "please do", "book it", "do it", "confirm", "confirmed", "sounds good", "absolutely", "of course", "exactly", "ja", "jawohl", "jo", "genau", "richtig", "stimmt", "gerne", "gern", "passt", "einverstanden", "buchen", "bestätigen", "klar", "natürlich", "prima", "gut", "in ordnung"]),
    no: words(["no", "nope", "nah", "not", "don't", "dont", "do not", "never", "wrong", "incorrect", "cancel", "stop", "wait", "hold on", "isn't", "isnt", "wasn't", "nein", "nee", "nö", "nicht", "kein", "keine", "keinen", "falsch", "stopp", "halt", "warten", "warte", "abbrechen"]),
    unsure: /not sure|nicht sicher|weiß (ich )?nicht so recht|maybe|vielleicht|perhaps/u,
    change: words(["change", "different", "another", "other", "instead", "rather", "actually", "switch", "ändern", "änderung", "anders", "andere*", "lieber", "stattdessen"]),
    first: words(["first", "1st", "number one", "option one", "earlier", "earliest", "former", "erste", "ersten", "erster", "erstes", "erstens", "eins", "nummer eins", "option eins", "früher", "frühere*"]),
    second: words(["second", "2nd", "two", "number two", "option two", "later", "latter", "last", "zweite", "zweiten", "zweiter", "zweites", "zweitens", "zwei", "nummer zwei", "option zwei", "später", "spätere*", "letzte*"]),
    morning: words(["morning", "mornings", "a.m.", "early", "vormittag*", "morgens", "früh", "am morgen", "frühmorgens"]),
    afternoon: words(["afternoon", "afternoons", "p.m.", "pm", "after lunch", "later in the day", "evening", "nachmittag*", "mittags", "abends", "nach dem mittagessen"]),
    anyTime: words(["any time", "anytime", "doesn't matter", "doesnt matter", "does not matter", "don't mind", "dont mind", "whenever", "either", "flexible", "egal", "jederzeit", "flexibel", "beides"]),
    person: words(["person", "human", "someone", "somebody", "real person", "adviser", "advisor", "agent", "operator", "representative", "mensch", "menschen", "mitarbeiter*", "berater*", "jemand*", "echte person", "echten person", "marina"]),
    confused: /(don'?t|do not|didn'?t|did not|can'?t|cannot|can not) (really )?(understand|follow|get it)|confus|i'?m lost|too fast|too complicated|what do you mean|versteh\p{L}* (das |ich |es |sie )?(nicht|nichts|kein wort)|nicht verstanden|verwirrt|zu schnell|zu kompliziert|was meinen sie/u,
    repeat: words(["repeat", "say that again", "say it again", "again please", "pardon", "sorry what", "what was that", "come again", "one more time", "wie bitte", "wiederhol*", "nochmal", "noch einmal", "noch mal"]),
    emergency: words(["emergency", "chest pain", "chest pains", "heart attack", "can't breathe", "cant breathe", "cannot breathe", "stroke", "bleeding", "unconscious", "ambulance", "notfall", "notarzt", "brustschmerz*", "herzinfarkt", "keine luft", "schlaganfall", "bewusstlos", "krankenwagen", "112"]),
    credential: words(["pin", "pin code", "pin number", "password", "passwords", "passwort", "passcode", "kennwort", "geheimzahl", "tan", "iban", "security code", "cvv", "card number", "kartennummer", "kontonummer", "account number", "zugangsdaten", "login details"]),
    banking: words(["bank", "banking", "online banking", "transfer money", "money transfer", "pay a bill", "überweis*", "konto", "sparkasse", "geld"]),
    notYet: words(["passport", "id card", "identity card", "personalausweis", "ausweis", "reisepass", "pension", "rente", "tax", "taxes", "steuer*", "parcel", "package", "paket", "insurance", "versicherung*", "driving licence", "driver's license", "führerschein"]),
    bye: words(["bye", "goodbye", "good bye", "tschüss", "tschüs", "ciao", "auf wiederhören", "auf wiedersehen"]),
    done: words(["that's all", "thats all", "that is all", "nothing else", "no thanks", "no thank you", "das war's", "das wars", "das war alles", "nichts mehr", "sonst nichts", "nein danke"]),
    postal: words(["post", "by post", "letter", "mail", "brief", "per post", "postal", "zuschicken", "schicken", "send"]),
    phone: words(["phone", "telephone", "phone only", "telefon*", "telefonisch", "abholen", "collect", "pick up"]),
    fieldDay: words(["day", "date", "tag", "datum", "wochentag"]),
    fieldTime: words(["time", "time of day", "uhrzeit", "tageszeit", "zeit"]),
    fieldCity: words(["city", "town", "stadt", "ort"]),
    fieldDestination: words(["destination", "where", "ziel", "reiseziel", "wohin"]),
    placeMitte: words(["mitte", "karl-marx-allee", "alexanderplatz"]),
    placeSchoeneberg: words(["schöneberg", "schoeneberg", "schoneberg", "kennedy", "john-f.-kennedy-platz"])
  };
  const DAY_LEX = [
    words(["monday*", "montag*"]), words(["tuesday*", "dienstag*"]), words(["wednesday*", "mittwoch*"]),
    words(["thursday*", "donnerstag*"]), words(["friday*", "freitag*"]), words(["saturday*", "samstag*", "sonnabend*"]), words(["sunday*", "sonntag*"])
  ];
  const CITY_LEX = Object.entries(CITIES).map(([key, city]) => [key, words(city.words)]);
  const TO_WORDS = new Set(["to", "nach", "in", "into", "im", "towards"]);
  const FROM_WORDS = new Set(["from", "von", "aus", "ab"]);

  function normalise(text) {
    return " " + String(text).toLowerCase().replace(/[’‘`´]/g, "'").replace(/[^\p{L}\p{N}':.\s-]/gu, " ").replace(/\s+/g, " ").trim() + " ";
  }

  function parse(raw) {
    const t = normalise(raw);
    const f = { text: t.trim() };

    const serviceHits = ["address", "doctor", "train"].map((key) => [key, find(LEX[key], t)]).filter(([, i]) => i >= 0).sort((a, b) => a[1] - b[1]);
    f.service = serviceHits.length ? serviceHits[0][0] : null;

    // Cities, preferring the one after "to"/"nach" and avoiding the one after "from"/"aus".
    const cityHits = [];
    for (const [key, re] of CITY_LEX) {
      const g = new RegExp(re.source, "gu");
      let m;
      while ((m = g.exec(t))) {
        const before = t.slice(0, m.index).trim().split(" ").pop();
        cityHits.push({ key, index: m.index, to: TO_WORDS.has(before), from: FROM_WORDS.has(before) });
      }
    }
    cityHits.sort((a, b) => a.index - b.index);
    const preferred = cityHits.find((c) => c.to) || cityHits.find((c) => !c.from) || cityHits[0];
    f.city = preferred ? preferred.key : null;
    const nonBerlin = cityHits.filter((c) => c.key !== "berlin");
    const dest = nonBerlin.find((c) => c.to) || nonBerlin.find((c) => !c.from) || nonBerlin[0];
    f.dest = dest ? dest.key : null;
    f.onlyBerlin = cityHits.length > 0 && !nonBerlin.length;

    f.unsure = LEX.unsure.test(t);
    f.no = LEX.no.test(t) || LEX.done.test(t);
    f.yes = LEX.yes.test(t) && !f.unsure;
    f.change = LEX.change.test(t);

    const morning = LEX.morning.test(t), afternoon = LEX.afternoon.test(t);
    f.tod = morning && !afternoon ? "morning" : afternoon && !morning ? "afternoon" : LEX.anyTime.test(t) ? "any" : null;
    const dayIndex = DAY_LEX.findIndex((re) => re.test(t));
    f.day = dayIndex >= 0 ? dayIndex + 1 : null;

    const first = LEX.first.test(t) || /(?<![\d:.])1(?![\d:.])/.test(t);
    const second = LEX.second.test(t) || /(?<![\d:.])2(?![\d:.])/.test(t);
    f.option = first && !second ? 0 : second && !first ? 1 : null;
    const time = /(?<!\d)(\d{1,2})[:.](\d{2})(?!\d)/.exec(t);
    f.time = time ? `${time[1].padStart(2, "0")}:${time[2]}` : null;
    f.place = LEX.placeMitte.test(t) ? "mitte" : LEX.placeSchoeneberg.test(t) ? "schoeneberg" : null;

    f.person = LEX.person.test(t);
    f.confused = LEX.confused.test(t);
    f.repeat = LEX.repeat.test(t);
    f.emergency = LEX.emergency.test(t);
    f.credential = LEX.credential.test(t);
    f.banking = LEX.banking.test(t);
    f.notYet = LEX.notYet.test(t);
    f.bye = LEX.bye.test(t);
    f.done = LEX.done.test(t);
    f.postal = LEX.postal.test(t);
    f.phone = LEX.phone.test(t);
    f.fields = {
      day: LEX.fieldDay.test(t), time: LEX.fieldTime.test(t), city: LEX.fieldCity.test(t), destination: LEX.fieldDestination.test(t)
    };

    const bare = t.trim();
    if (/(speak|talk|continue|switch|change|go on)\b.{0,24}\b(german|deutsch)|auf deutsch|in german|deutsch bitte|kann ich deutsch/u.test(bare) || /^(german|deutsch)$/.test(bare)) f.lang = "de";
    else if (/(speak|talk|continue|switch|sprechen|reden|wechseln)\b.{0,24}\b(english|englisch)|auf englisch|in english|englisch bitte/u.test(bare) || /^(english|englisch)$/.test(bare)) f.lang = "en";
    else f.lang = null;
    return f;
  }

  // ---------------------------------------------------------------- dates and options

  function berlinParts(now) {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(new Date(now));
    const get = (type) => Number(parts.find((p) => p.type === type).value);
    return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") % 24 };
  }
  function nextMonday(now) {
    const p = berlinParts(now);
    const date = new Date(Date.UTC(p.year, p.month - 1, p.day));
    date.setUTCDate(date.getUTCDate() + ((8 - date.getUTCDay()) % 7 || 7));
    return date;
  }
  const iso = (date) => date.toISOString().slice(0, 10);
  function addMinutes(time, minutes) {
    const [h, m] = time.split(":").map(Number);
    const total = h * 60 + m + minutes;
    return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  function buildOptions(s) {
    const monday = nextMonday(s.now);
    const times = TIMES[s.service];
    let specs;
    if (s.day) {
      const tod = s.tod === "morning" || s.tod === "afternoon" ? s.tod : null;
      specs = tod
        ? [{ day: s.day, time: times[tod][0] }, { day: s.day, time: times[tod][1] }]
        : [{ day: s.day, time: times.morning[0] }, { day: s.day, time: times.afternoon[1] }];
    } else {
      const firstTod = s.tod === "afternoon" ? "afternoon" : "morning";
      const secondTod = s.tod === "any" ? "afternoon" : firstTod;
      specs = [{ day: 2, time: times[firstTod][0] }, { day: 4, time: times[secondTod][1] }];
    }
    return specs.map((spec, index) => {
      const date = new Date(monday);
      date.setUTCDate(date.getUTCDate() + spec.day - 1);
      const option = { index, service: s.service, date: iso(date), weekday: spec.day, time: spec.time };
      if (s.service === "train") {
        option.destination = s.destination;
        option.arrival = addMinutes(spec.time, CITIES[s.destination].mins);
      } else {
        option.place = index;
      }
      return option;
    });
  }

  function formatDate(isoDate, lang) {
    const [y, m, d] = isoDate.split("-").map(Number);
    return new Intl.DateTimeFormat(lang === "de" ? "de-DE" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
  }
  function formatTime(time, lang) {
    const [h, m] = time.split(":");
    return lang === "de" ? `${Number(h)}:${m} Uhr` : `${Number(h)}:${m}`;
  }
  const cityName = (key, lang) => (key ? CITIES[key][lang] : "");

  function describeOption(o, lang) {
    const date = formatDate(o.date, lang);
    if (o.service === "train") {
      const dest = cityName(o.destination, lang);
      return lang === "de"
        ? `${date}: der ICE ab Berlin Hauptbahnhof um ${formatTime(o.time, lang)}, Ankunft in ${dest} um ${formatTime(o.arrival, lang)}, ohne Umsteigen`
        : `${date}: the ICE leaving Berlin Central Station at ${formatTime(o.time, lang)}, arriving in ${dest} at ${formatTime(o.arrival, lang)}, with no changes`;
    }
    const place = PLACES[o.service][o.place];
    return lang === "de" ? `${date} um ${formatTime(o.time, lang)} ${place.spoken.de}` : `${date} at ${formatTime(o.time, lang)}, ${place.spoken.en}`;
  }
  function shortOption(o, lang) {
    const date = formatDate(o.date, lang);
    if (o.service === "train") return `${date}, ${formatTime(o.time, lang)} → ${cityName(o.destination, lang)}`;
    return `${date}, ${formatTime(o.time, lang)}, ${PLACES[o.service][o.place].name[lang]}`;
  }
  // Structured version for the appointment card and letter.
  function optionCard(o, lang) {
    const date = formatDate(o.date, lang);
    if (o.service === "train") {
      const dest = cityName(o.destination, lang);
      return {
        title: lang === "de" ? `Berlin Hbf → ${dest} Hbf` : `Berlin Central Station → ${dest}`,
        when: `${date}`,
        detail: lang === "de" ? `ICE, ab ${formatTime(o.time, lang)}, an ${formatTime(o.arrival, lang)}, ohne Umsteigen` : `ICE, departs ${formatTime(o.time, lang)}, arrives ${formatTime(o.arrival, lang)}, direct`
      };
    }
    const place = PLACES[o.service][o.place];
    return { title: place.name[lang], when: `${date}, ${formatTime(o.time, lang)}`, detail: place.street };
  }

  function makeReference(s) {
    let x = (Math.floor(s.now / 1000) + s.bookings.length * 7919) % 2147483647;
    x = (x * 48271) % 2147483647;
    return `CA-${String(100000 + (x % 900000))}`;
  }
  const spellReference = (ref) => ref.replace("CA-", "C A ").split("").join(" ").replace(/\s+/g, " ").trim();

  // ---------------------------------------------------------------- what CallAssist says

  function hello(s) {
    const hour = berlinParts(s.now).hour;
    if (s.lang === "de") return hour < 11 ? "Guten Morgen" : hour < 18 ? "Guten Tag" : "Guten Abend";
    return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  }

  function whenPhrase(s) {
    const tod = s.tod === "morning" || s.tod === "afternoon" ? s.tod : null;
    if (s.lang === "de") {
      const todDe = tod === "morning" ? "vormittags" : "nachmittags";
      if (s.day) return `am nächsten ${WEEKDAYS.de[s.day - 1]}${tod ? " " + todDe : ""}`;
      if (tod) return `nächste Woche ${todDe}`;
      return "irgendwann nächste Woche";
    }
    if (s.day) return `next ${WEEKDAYS.en[s.day - 1]}${tod ? " in the " + tod : ""}`;
    if (tod) return `next week, in the ${tod}`;
    return "at any time next week";
  }

  function whatPhrase(s) {
    const dest = cityName(s.destination, s.lang);
    if (s.lang === "de") {
      return { address: "einen Termin in einem Berliner Bürgeramt, um Ihre neue Adresse anzumelden", doctor: "einen Termin in einer Hausarztpraxis in Berlin", train: `eine Fahrkarte von Berlin nach ${dest}` }[s.service];
    }
    return { address: "an appointment at a Berlin Citizens' Office to register your new address", doctor: "an appointment at a GP practice in Berlin", train: `a train ticket from Berlin to ${dest}` }[s.service];
  }

  function adviserContext(s) {
    const de = s.lang === "de";
    let text = {
      address: de ? "Sie möchten Ihre neue Adresse anmelden" : "you'd like to register your new address",
      doctor: de ? "Sie möchten einen Termin in einer Hausarztpraxis" : "you'd like a GP appointment",
      train: de ? "Sie möchten eine Fahrkarte" : "you'd like a train ticket"
    }[s.service];
    if (s.service === "train" && s.destination) text += (de ? " nach " : " to ") + cityName(s.destination, s.lang);
    if (s.service !== "train" && s.city) text += de ? " in Berlin" : " in Berlin";
    if (s.day || s.tod) text += ", " + whenPhrase(s);
    if (s.selection) text += de ? `, und Sie haben ${shortOption(s.selection, "de")} gewählt` : `, and you've picked ${shortOption(s.selection, "en")}`;
    return text;
  }

  const TEXT = {
    en: {
      greeting: (s) => `${hello(s)}, this is CallAssist. I'm an automated assistant, and you can speak to a real person at any time. Just so you know: I will never ask for your PIN or any password. Today I can help you with three things: registering a new address at the Citizens' Office, booking an appointment with a GP, or booking a train ticket. What would you like to do?`,
      askService: "I can help you register a new address, book a GP appointment, or book a train ticket. Which would you like?",
      askServiceShort: "Shall we do a new address, a doctor's appointment, or a train ticket?",
      askServiceMore: "Of course. I can help with a new address, a GP appointment, or a train ticket. What would you like?",
      ack_address: "Of course. I'll help you register your new address.",
      ack_doctor: "Of course. I'll book you an appointment at a GP practice. If it's an emergency, please hang up and call 112.",
      ack_train: "Of course. I'll book a train ticket for you.",
      askCity: (s) => (s.service === "doctor" ? "Which city should the practice be in?" : "Which city do you live in now?"),
      askCityShort: "Which city?",
      askDestination: "Where would you like to travel to? The train would leave from Berlin Central Station.",
      askDestinationShort: "Where to?",
      askPref: (s) => (s.service === "train" ? "Which day next week would you like to travel, and would you rather leave in the morning or the afternoon?" : "Which day next week would suit you, and do you prefer the morning or the afternoon?"),
      askPrefShort: "Which day, and morning or afternoon?",
      review: (s) => `Let me check I have this right. You'd like ${whatPhrase(s)}, ${whenPhrase(s)}. Is that correct?`,
      reviewShort: (s) => `So: ${whatPhrase(s)}, ${whenPhrase(s)}. Is that right?`,
      askChange: (s) => `Of course. What should I change: the day, the time of day, or ${s.service === "train" ? "where you're going" : "the city"}?`,
      askChangeShort: "What should I change?",
      updated: "Thank you, I've changed that.",
      checking: (s) => ({
        address: "Thank you. I'm checking free appointments at the Berlin Citizens' Offices now. One moment, please.",
        doctor: "Thank you. I'm checking free appointments at GP practices in Berlin now. One moment, please.",
        train: `Thank you. I'm checking trains from Berlin to ${cityName(s.destination, "en")} now. One moment, please.`
      })[s.service],
      lookAgain: "No problem, I'll look again.",
      options: (s) => `I've found two options. The first: ${describeOption(s.options[0], "en")}. The second: ${describeOption(s.options[1], "en")}. Which would you like?`,
      optionsShort: (s) => `Two options. First: ${shortOption(s.options[0], "en")}. Second: ${shortOption(s.options[1], "en")}. Which one?`,
      noneSuit: "No problem. What should I change so it suits you better: the day or the time of day?",
      confirm: (s) => `Before I book anything: ${describeOption(s.selection, "en")}. Shall I book this ${s.service === "train" ? "ticket" : "appointment"} for you? Please say yes or no.`,
      confirmShort: (s) => `${shortOption(s.selection, "en")}. Shall I book it? Yes or no?`,
      needClearYes: "For your protection, I only book when you give me a clear yes. Shall I book it, yes or no?",
      nothingBooked: "No problem, nothing has been booked.",
      booked: (s) => `Done. Your ${s.service === "train" ? "ticket" : "appointment"} is booked: ${describeOption(s.booking, "en")}. Your reference number is ${spellReference(s.booking.ref)}.`,
      askPostal: (s) => (s.service === "train" ? "Shall I send the ticket to your home by post?" : "Would you also like a confirmation letter by post?"),
      postalYes: (s) => `I'll send the ${s.service === "train" ? "ticket" : "letter"} to the address registered with CallAssist. It usually arrives within two working days. Here are the details once more: ${describeOption(s.booking, "en")}.`,
      postalNo: (s) => (s.service === "train"
        ? `Alright. You can pick up your ticket at the travel centre in Berlin Central Station; just give them your reference number, ${spellReference(s.booking.ref)}. Here are the details once more: ${describeOption(s.booking, "en")}.`
        : `Alright, no letter. Here are the details once more: ${describeOption(s.booking, "en")}. Your reference number is ${spellReference(s.booking.ref)}. Call again any time and I'll repeat them.`),
      askPostalAgain: "Would you like it by post, or is the phone enough?",
      askMore: "Is there anything else I can do for you?",
      closing: "Thank you for calling CallAssist. Take care, and goodbye!",
      closingEarly: "Alright. Nothing has been booked. Thank you for calling CallAssist. Goodbye!",
      transfer: "Of course. I'm connecting you to Marina from our team. She can see everything you've told me, so you won't need to repeat anything. Please hold.",
      transferConfused: "That's completely fine. I'm connecting you to Marina from our team; she's a real person. She can see everything you've told me, so you won't need to repeat anything. Please hold.",
      adviserHello: (s) => (s.service ? `Hello, this is Marina from the CallAssist team. I can see ${adviserContext(s)}. Let's finish this together, one step at a time.` : "Hello, this is Marina from the CallAssist team. How can I help you today?"),
      alreadyAdviser: "You're already speaking with me, Marina, a real person. Take all the time you need.",
      slowDown: "No problem at all. Let's take it slowly.",
      didntCatch: "Sorry, I didn't quite catch that.",
      credential: "Please don't tell me any PIN, password or bank details. CallAssist will never ask for them, and I haven't kept what you just said. I only need details about your errand.",
      redacted: "[Removed: sensitive information]",
      emergency: "If this is a medical emergency, please hang up now and call 112. If it isn't urgent, I'm happy to book you a GP appointment.",
      banking: "I'm sorry, CallAssist doesn't do banking, and I will never ask for your bank details. I can help with a new address, a GP appointment, or a train ticket.",
      notYet: "I'm sorry, I can't help with that yet. Today I can help with a new address, a GP appointment, or a train ticket.",
      cityUnsupported: (city) => `I'm sorry, CallAssist only works in Berlin so far, so I can't book anything in ${city} yet. Is your appointment in Berlin? If not, I can connect you to an adviser.`,
      cityUnsupportedAdviser: (city) => `I'm sorry, we only cover Berlin so far. I've noted that you asked about ${city}. Is Berlin all right for you, or shall we leave it for today?`,
      cityDeclined: "I understand. Then I'm afraid I can't book this today, but I've passed your request on to our team.",
      destUnsupported: (city) => `I'm sorry, I can't book trains to ${city} yet. I can book direct trains from Berlin to Hamburg, Hanover, Leipzig, Dresden, Frankfurt, Cologne or Munich. Where would you like to go?`,
      fromBerlin: "The train leaves from Berlin. Where would you like to go?",
      weekend: (s) => (s.service === "doctor" ? "GP practices are closed at the weekend. Which weekday would suit you?" : "The Citizens' Offices are closed at the weekend. Which weekday would suit you?"),
      langSwitched: "Of course, let's continue in English."
    },
    de: {
      greeting: (s) => `${hello(s)}, hier ist CallAssist. Ich bin ein automatischer Assistent, und Sie können jederzeit mit einem Menschen sprechen. Vorab: Ich frage Sie niemals nach Ihrer PIN oder einem Passwort. Ich kann Ihnen heute bei drei Dingen helfen: eine neue Adresse beim Bürgeramt anmelden, einen Termin in einer Hausarztpraxis vereinbaren oder eine Bahnfahrkarte buchen. Was möchten Sie tun?`,
      askService: "Ich kann eine neue Adresse anmelden, einen Hausarzttermin vereinbaren oder eine Bahnfahrkarte buchen. Was möchten Sie?",
      askServiceShort: "Worum geht es: neue Adresse, Arzttermin oder Bahnfahrkarte?",
      askServiceMore: "Gern. Ich kann eine neue Adresse anmelden, einen Hausarzttermin vereinbaren oder eine Bahnfahrkarte buchen. Was darf es sein?",
      ack_address: "Gern, ich helfe Ihnen bei der Anmeldung Ihrer neuen Adresse.",
      ack_doctor: "Gern, ich vereinbare einen Termin in einer Hausarztpraxis für Sie. Im Notfall legen Sie bitte auf und rufen die 112 an.",
      ack_train: "Gern, ich buche eine Bahnfahrkarte für Sie.",
      askCity: (s) => (s.service === "doctor" ? "In welcher Stadt soll die Praxis sein?" : "In welcher Stadt wohnen Sie jetzt?"),
      askCityShort: "Welche Stadt?",
      askDestination: "Wohin möchten Sie fahren? Der Zug fährt ab Berlin Hauptbahnhof.",
      askDestinationShort: "Wohin soll es gehen?",
      askPref: (s) => (s.service === "train" ? "An welchem Tag nächste Woche möchten Sie fahren, und lieber vormittags oder nachmittags?" : "Welcher Tag in der nächsten Woche passt Ihnen, und ist Ihnen der Vormittag oder der Nachmittag lieber?"),
      askPrefShort: "Welcher Tag, und lieber vormittags oder nachmittags?",
      review: (s) => `Ich fasse kurz zusammen: Sie möchten ${whatPhrase(s)}, ${whenPhrase(s)}. Stimmt das?`,
      reviewShort: (s) => `Also: ${whatPhrase(s)}, ${whenPhrase(s)}. Richtig?`,
      askChange: (s) => `Natürlich. Was soll ich ändern: den Tag, die Tageszeit oder ${s.service === "train" ? "das Reiseziel" : "die Stadt"}?`,
      askChangeShort: "Was soll ich ändern?",
      updated: "Danke, das habe ich geändert.",
      checking: (s) => ({
        address: "Danke. Ich prüfe jetzt freie Termine bei den Berliner Bürgerämtern. Einen Moment bitte.",
        doctor: "Danke. Ich prüfe jetzt freie Termine bei Hausarztpraxen in Berlin. Einen Moment bitte.",
        train: `Danke. Ich suche jetzt Verbindungen von Berlin nach ${cityName(s.destination, "de")}. Einen Moment bitte.`
      })[s.service],
      lookAgain: "Kein Problem, ich schaue noch einmal nach.",
      options: (s) => `Ich habe zwei Möglichkeiten gefunden. Erstens: ${describeOption(s.options[0], "de")}. Zweitens: ${describeOption(s.options[1], "de")}. Welche möchten Sie?`,
      optionsShort: (s) => `Zwei Möglichkeiten. Erstens: ${shortOption(s.options[0], "de")}. Zweitens: ${shortOption(s.options[1], "de")}. Welche?`,
      noneSuit: "Kein Problem. Was soll ich ändern, damit es besser passt: den Tag oder die Tageszeit?",
      confirm: (s) => `Bevor ich etwas buche: ${describeOption(s.selection, "de")}. Soll ich ${s.service === "train" ? "diese Fahrkarte" : "diesen Termin"} für Sie buchen? Bitte sagen Sie ja oder nein.`,
      confirmShort: (s) => `${shortOption(s.selection, "de")}. Soll ich buchen? Ja oder nein?`,
      needClearYes: "Zu Ihrer Sicherheit buche ich nur nach einem klaren Ja. Soll ich buchen, ja oder nein?",
      nothingBooked: "Kein Problem, es wurde nichts gebucht.",
      booked: (s) => `Erledigt. ${s.service === "train" ? "Ihre Fahrkarte" : "Ihr Termin"} ist gebucht: ${describeOption(s.booking, "de")}. Ihre Referenznummer lautet ${spellReference(s.booking.ref)}.`,
      askPostal: (s) => (s.service === "train" ? "Soll ich Ihnen die Fahrkarte per Post nach Hause schicken?" : "Möchten Sie zusätzlich eine Bestätigung per Post?"),
      postalYes: (s) => `Ich schicke ${s.service === "train" ? "die Fahrkarte" : "den Brief"} an die Adresse, die bei CallAssist hinterlegt ist. Das dauert normalerweise zwei Werktage. Hier noch einmal die Details: ${describeOption(s.booking, "de")}.`,
      postalNo: (s) => (s.service === "train"
        ? `In Ordnung. Sie können die Fahrkarte im Reisezentrum am Berliner Hauptbahnhof abholen; nennen Sie dort einfach Ihre Referenznummer, ${spellReference(s.booking.ref)}. Hier noch einmal die Details: ${describeOption(s.booking, "de")}.`
        : `In Ordnung, dann ohne Brief. Hier noch einmal die Details: ${describeOption(s.booking, "de")}. Ihre Referenznummer ist ${spellReference(s.booking.ref)}. Rufen Sie jederzeit wieder an, dann wiederhole ich alles.`),
      askPostalAgain: "Möchten Sie es per Post, oder reicht Ihnen das Telefon?",
      askMore: "Kann ich sonst noch etwas für Sie tun?",
      closing: "Vielen Dank für Ihren Anruf bei CallAssist. Alles Gute und auf Wiederhören!",
      closingEarly: "In Ordnung. Es wurde nichts gebucht. Vielen Dank für Ihren Anruf bei CallAssist. Auf Wiederhören!",
      transfer: "Natürlich. Ich verbinde Sie mit Marina aus unserem Team. Sie sieht alles, was Sie mir gesagt haben, Sie müssen also nichts wiederholen. Bitte bleiben Sie dran.",
      transferConfused: "Das ist überhaupt kein Problem. Ich verbinde Sie mit Marina aus unserem Team, einem echten Menschen. Sie sieht alles, was Sie mir gesagt haben, Sie müssen also nichts wiederholen. Bitte bleiben Sie dran.",
      adviserHello: (s) => (s.service ? `Hallo, hier ist Marina vom CallAssist-Team. Ich sehe, ${adviserContext(s)}. Wir machen das jetzt gemeinsam, Schritt für Schritt.` : "Hallo, hier ist Marina vom CallAssist-Team. Wie kann ich Ihnen helfen?"),
      alreadyAdviser: "Sie sprechen bereits mit mir, Marina, einem echten Menschen. Lassen Sie sich ruhig Zeit.",
      slowDown: "Überhaupt kein Problem. Wir machen das ganz in Ruhe.",
      didntCatch: "Entschuldigung, das habe ich nicht ganz verstanden.",
      credential: "Bitte nennen Sie mir keine PIN, kein Passwort und keine Bankdaten. CallAssist fragt niemals danach, und ich habe das eben Gesagte nicht gespeichert. Ich brauche nur Angaben zu Ihrem Anliegen.",
      redacted: "[Entfernt: vertrauliche Angaben]",
      emergency: "Wenn es ein medizinischer Notfall ist, legen Sie bitte jetzt auf und rufen Sie die 112 an. Wenn es nicht dringend ist, vereinbare ich gern einen Hausarzttermin für Sie.",
      banking: "Das tut mir leid, CallAssist erledigt keine Bankgeschäfte, und ich frage Sie niemals nach Ihren Bankdaten. Ich kann eine neue Adresse anmelden, einen Hausarzttermin vereinbaren oder eine Bahnfahrkarte buchen.",
      notYet: "Das tut mir leid, dabei kann ich noch nicht helfen. Heute kann ich eine neue Adresse anmelden, einen Hausarzttermin vereinbaren oder eine Bahnfahrkarte buchen.",
      cityUnsupported: (city) => `Das tut mir leid, CallAssist gibt es bisher nur in Berlin, deshalb kann ich in ${city} noch nichts buchen. Ist Ihr Termin in Berlin? Sonst verbinde ich Sie gern mit unserer Beratung.`,
      cityUnsupportedAdviser: (city) => `Das tut mir leid, wir sind bisher nur in Berlin tätig. Ich habe notiert, dass Sie nach ${city} gefragt haben. Passt Berlin für Sie, oder lassen wir es für heute?`,
      cityDeclined: "Ich verstehe. Dann kann ich das heute leider nicht buchen, aber ich habe Ihre Anfrage an unser Team weitergegeben.",
      destUnsupported: (city) => `Das tut mir leid, Fahrten nach ${city} kann ich noch nicht buchen. Ich buche direkte Züge von Berlin nach Hamburg, Hannover, Leipzig, Dresden, Frankfurt, Köln oder München. Wohin möchten Sie?`,
      fromBerlin: "Der Zug fährt ab Berlin. Wohin möchten Sie fahren?",
      weekend: (s) => (s.service === "doctor" ? "Hausarztpraxen haben am Wochenende geschlossen. Welcher Wochentag passt Ihnen?" : "Die Bürgerämter haben am Wochenende geschlossen. Welcher Wochentag passt Ihnen?"),
      langSwitched: "Gern, wir sprechen ab jetzt Deutsch."
    }
  };

  function T(s, key, arg) {
    const entry = TEXT[s.lang][key];
    return typeof entry === "function" ? entry(arg === undefined ? s : arg) : entry;
  }

  // Suggested caller replies for the presenter, per stage.
  const SUGGESTIONS = {
    en: {
      service: ["I've moved and need to register my new address", "I need an appointment with my doctor", "I'd like a train ticket to Hamburg"],
      city: ["Berlin", "I live in Munich"],
      destination: ["To Hamburg, please", "To Munich"],
      pref: ["Tuesday morning, please", "Any afternoon is fine"],
      review: ["Yes, that's right", "No, I'd rather go in the afternoon"],
      change: ["The afternoon would be better", "Thursday instead"],
      options: ["The first one, please", "The second one", "Could you repeat that?"],
      confirm: ["Yes, please book it", "No, not that one", "Yes, but in the afternoon"],
      notify: ["Yes, please send a letter", "No, the phone is enough"],
      more: ["No, that's all. Thank you!", "Yes, I also need a doctor's appointment"],
      confused: "I don't understand"
    },
    de: {
      service: ["Ich bin umgezogen und muss meine neue Adresse anmelden", "Ich brauche einen Termin bei meinem Hausarzt", "Ich möchte eine Fahrkarte nach Hamburg"],
      city: ["In Berlin", "Ich wohne in München"],
      destination: ["Nach Hamburg, bitte", "Nach München"],
      pref: ["Am Dienstag vormittags, bitte", "Nachmittags, der Tag ist egal"],
      review: ["Ja, das stimmt", "Nein, lieber nachmittags"],
      change: ["Lieber nachmittags", "Lieber am Donnerstag"],
      options: ["Den ersten, bitte", "Den zweiten", "Können Sie das wiederholen?"],
      confirm: ["Ja, bitte buchen", "Nein, lieber nicht", "Ja, aber lieber nachmittags"],
      notify: ["Ja, bitte per Post", "Nein, telefonisch reicht"],
      more: ["Nein, das war's. Danke!", "Ja, ich brauche noch einen Arzttermin"],
      confused: "Das verstehe ich nicht"
    }
  };

  function suggestions(s) {
    const list = SUGGESTIONS[s.lang][s.stage];
    if (!list) return [];
    return s.handler === "assistant" ? list.concat(SUGGESTIONS[s.lang].confused) : list.slice();
  }

  // ---------------------------------------------------------------- state machine

  function createCall(options) {
    const opts = options || {};
    return {
      lang: opts.lang === "de" ? "de" : "en",
      now: opts.now || Date.now(),
      handler: "assistant",
      stage: "ringing",
      resume: null,
      service: null, city: null, destination: null, tod: null, day: null,
      options: [], selection: null, booking: null, bookings: [],
      misses: 0, lastPrompt: "", ended: false
    };
  }

  const speaker = (s) => (s.handler === "adviser" ? "adviser" : "assistant");
  const short = (s) => s.handler === "adviser";

  function promptFor(s) {
    switch (s.stage) {
      case "service": return short(s) ? T(s, "askServiceShort") : T(s, "askService");
      case "city": return short(s) ? T(s, "askCityShort") : T(s, "askCity");
      case "destination": return short(s) ? T(s, "askDestinationShort") : T(s, "askDestination");
      case "pref": return short(s) ? T(s, "askPrefShort") : T(s, "askPref");
      case "review": return short(s) ? T(s, "reviewShort") : T(s, "review");
      case "change": return short(s) ? T(s, "askChangeShort") : T(s, "askChange");
      case "options": return short(s) ? T(s, "optionsShort") : T(s, "options");
      case "confirm": return short(s) ? T(s, "confirmShort") : T(s, "confirm");
      case "notify": return T(s, "askPostal");
      case "more": return T(s, "askMore");
      default: return "";
    }
  }

  function say(ctx, text) {
    if (text) ctx.out.push({ type: "say", who: speaker(ctx.s), text });
  }

  function advance(ctx) {
    const s = ctx.s;
    if (!s.service) s.stage = "service";
    else if (s.service === "train" ? !s.destination : !s.city) s.stage = s.service === "train" ? "destination" : "city";
    else if (!s.tod && !s.day) s.stage = "pref";
    else s.stage = "review";
    say(ctx, promptFor(s));
  }

  // Take any usable details from the caller's words, wherever in the call they come up.
  function absorb(ctx, f) {
    const s = ctx.s;
    let changed = false;
    const issues = [];
    if (s.service && s.service !== "train" && f.city) {
      if (f.city === "berlin") {
        if (s.city !== "berlin") { s.city = "berlin"; changed = true; }
      } else issues.push({ kind: "city", city: f.city });
    }
    if (s.service === "train") {
      if (f.dest) {
        if (CITIES[f.dest].mins) {
          if (s.destination !== f.dest) { s.destination = f.dest; changed = true; }
        } else issues.push({ kind: "dest", city: f.dest });
      } else if (f.onlyBerlin && s.stage === "destination") issues.push({ kind: "fromBerlin" });
    }
    if (f.day) {
      if (f.day > 5 && s.service && s.service !== "train") issues.push({ kind: "weekend" });
      else if (s.day !== f.day) { s.day = f.day; changed = true; }
    }
    if (f.tod && s.tod !== f.tod) { s.tod = f.tod; changed = true; }
    if (changed) { s.options = []; s.selection = null; }
    return { changed, issues };
  }

  // Explain a detail CallAssist cannot use, honestly, and move to the question that fixes it.
  function raiseIssue(ctx, result) {
    const s = ctx.s;
    const issue = result.issues[0];
    if (!issue) return false;
    s.options = [];
    s.selection = null;
    if (issue.kind === "city") {
      s.city = null;
      s.stage = "city";
      s.cityIssue = issue.city;
      say(ctx, short(s) ? T(s, "cityUnsupportedAdviser", cityName(issue.city, s.lang)) : T(s, "cityUnsupported", cityName(issue.city, s.lang)));
    } else if (issue.kind === "dest") {
      s.destination = null;
      s.stage = "destination";
      say(ctx, T(s, "destUnsupported", cityName(issue.city, s.lang)));
    } else if (issue.kind === "fromBerlin") {
      s.stage = "destination";
      say(ctx, T(s, "fromBerlin"));
    } else if (issue.kind === "weekend") {
      s.day = null;
      s.stage = "pref";
      say(ctx, T(s, "weekend"));
    }
    return true;
  }

  function startService(ctx, f) {
    const s = ctx.s;
    s.service = f.service;
    say(ctx, T(s, "ack_" + f.service));
    if (!raiseIssue(ctx, absorb(ctx, f))) advance(ctx);
  }

  function resetErrand(s) {
    Object.assign(s, { service: null, city: null, destination: null, tod: null, day: null, options: [], selection: null, booking: null, cityIssue: null });
  }

  function pickOption(s, f) {
    if (s.options.length !== 2) return null;
    if (f.option !== null) return f.no && !f.yes ? 1 - f.option : f.option;
    if (f.time) {
      const hit = s.options.find((o) => o.time === f.time);
      if (hit) return hit.index;
    }
    if (f.place && s.service !== "train") {
      const hit = s.options.find((o) => PLACES[s.service][o.place].key === f.place);
      if (hit) return hit.index;
    }
    if (f.day && s.options[0].weekday !== s.options[1].weekday) {
      const hit = s.options.find((o) => o.weekday === f.day);
      if (hit) return hit.index;
    }
    return null;
  }

  function lookup(ctx) {
    const s = ctx.s;
    say(ctx, T(s, "checking"));
    s.resume = { kind: "lookup", stage: "options" };
    s.stage = "hold";
    ctx.out.push({ type: "hold", kind: "lookup", ms: LOOKUP_MS });
  }

  function handoff(ctx, confused) {
    const s = ctx.s;
    if (s.handler === "adviser") {
      say(ctx, T(s, "alreadyAdviser"));
      say(ctx, promptFor(s));
      return;
    }
    say(ctx, T(s, confused ? "transferConfused" : "transfer"));
    s.resume = { kind: "transfer", stage: s.stage };
    s.stage = "hold";
    ctx.out.push({ type: "hold", kind: "transfer", ms: TRANSFER_MS });
  }

  function resume(ctx) {
    const s = ctx.s;
    if (s.stage !== "hold" || !s.resume) return;
    const r = s.resume;
    s.resume = null;
    s.misses = 0;
    if (r.kind === "transfer") {
      s.stage = r.stage;
      s.handler = "adviser";
      ctx.out.push({ type: "handler", handler: "adviser" });
      say(ctx, T(s, "adviserHello"));
      if (s.stage === "options" && s.options.length !== 2) s.options = buildOptions(s);
      say(ctx, promptFor(s));
    } else {
      s.options = buildOptions(s);
      s.stage = "options";
      say(ctx, promptFor(s));
    }
  }

  function book(ctx) {
    const s = ctx.s;
    const booking = Object.assign({}, s.selection, { ref: makeReference(s), postal: null, lang: s.lang });
    s.booking = booking;
    s.bookings.push(booking);
    s.stage = "notify";
    ctx.out.push({ type: "booked", booking });
    say(ctx, T(s, "booked"));
    say(ctx, T(s, "askPostal"));
  }

  function close(ctx, early) {
    const s = ctx.s;
    say(ctx, T(s, early ? "closingEarly" : "closing"));
    s.stage = "done";
    s.ended = true;
    ctx.out.push({ type: "end", reason: early ? "caller-left" : "complete" });
  }

  function switchLanguage(ctx, lang) {
    const s = ctx.s;
    if (s.lang === lang) return;
    s.lang = lang;
    ctx.out.push({ type: "lang", lang });
    say(ctx, T(s, "langSwitched"));
    if (s.stage !== "hold") say(ctx, promptFor(s));
  }

  const STAGES = {
    service(ctx, f) {
      if (f.service) { startService(ctx, f); return true; }
      if (f.banking) { say(ctx, T(ctx.s, "banking")); return true; }
      if (f.notYet) { say(ctx, T(ctx.s, "notYet")); return true; }
      return false;
    },
    city(ctx, f) {
      const s = ctx.s;
      const result = absorb(ctx, f);
      if (raiseIssue(ctx, result)) return true;
      if (s.city) { s.cityIssue = null; advance(ctx); return true; }
      if (s.cityIssue && f.yes && !f.no) { s.city = "berlin"; s.cityIssue = null; advance(ctx); return true; }
      if (s.cityIssue && f.no) {
        if (s.handler === "assistant") { handoff(ctx, false); return true; }
        say(ctx, T(s, "cityDeclined"));
        resetErrand(s);
        s.stage = "more";
        say(ctx, T(s, "askMore"));
        return true;
      }
      return false;
    },
    destination(ctx, f) {
      const s = ctx.s;
      if (raiseIssue(ctx, absorb(ctx, f))) return true;
      if (s.destination) { advance(ctx); return true; }
      return false;
    },
    pref(ctx, f) {
      const s = ctx.s;
      if (raiseIssue(ctx, absorb(ctx, f))) return true;
      if (s.tod || s.day) { advance(ctx); return true; }
      return false;
    },
    review(ctx, f) {
      const s = ctx.s;
      const result = absorb(ctx, f);
      if (raiseIssue(ctx, result)) return true;
      if (result.changed) { say(ctx, T(s, "updated")); say(ctx, promptFor(s)); return true; }
      if (f.no || f.change) { s.stage = "change"; say(ctx, promptFor(s)); return true; }
      if (f.yes) { lookup(ctx); return true; }
      return false;
    },
    change(ctx, f) {
      const s = ctx.s;
      if (f.service && f.service !== s.service) { resetErrand(s); startService(ctx, f); return true; }
      const result = absorb(ctx, f);
      if (raiseIssue(ctx, result)) return true;
      if (result.changed) { s.stage = "review"; say(ctx, T(s, "updated")); say(ctx, promptFor(s)); return true; }
      // The caller named what to change but not the new value: ask for it.
      if (f.fields.city && s.service !== "train") { s.city = null; advance(ctx); return true; }
      if (f.fields.destination && s.service === "train") { s.destination = null; advance(ctx); return true; }
      if (f.fields.day || f.fields.time) { s.day = null; s.tod = null; advance(ctx); return true; }
      if (f.yes && !f.no) { s.stage = "review"; lookup(ctx); return true; }
      return false;
    },
    options(ctx, f) {
      const s = ctx.s;
      const pick = pickOption(s, f);
      if (pick !== null) { s.selection = s.options[pick]; s.stage = "confirm"; say(ctx, promptFor(s)); return true; }
      const result = absorb(ctx, f);
      if (raiseIssue(ctx, result)) return true;
      if (result.changed) { say(ctx, T(s, "lookAgain")); lookup(ctx); return true; }
      if (f.no || f.change) { s.stage = "change"; say(ctx, T(s, "noneSuit")); return true; }
      return false;
    },
    confirm(ctx, f) {
      const s = ctx.s;
      // Corrections and refusals are checked before anything that sounds like a yes.
      const result = absorb(ctx, f);
      if (raiseIssue(ctx, result)) { say(ctx, T(s, "nothingBooked")); return true; }
      if (result.changed) { say(ctx, T(s, "nothingBooked")); lookup(ctx); return true; }
      const pick = pickOption(s, f);
      if (pick !== null && pick !== s.selection.index && !f.no) { s.selection = s.options[pick]; say(ctx, promptFor(s)); return true; }
      if (f.no || f.change) {
        s.selection = null;
        s.stage = "options";
        say(ctx, T(s, "nothingBooked"));
        say(ctx, promptFor(s));
        return true;
      }
      if (f.yes) { book(ctx); return true; }
      return false;
    },
    notify(ctx, f) {
      const s = ctx.s;
      let postal = null;
      if (f.phone && !f.postal) postal = false;
      else if (f.no) postal = false;
      else if (f.postal || f.yes) postal = true;
      if (postal === null) return false;
      s.booking.postal = postal;
      ctx.out.push({ type: "postal", booking: s.booking });
      say(ctx, T(s, postal ? "postalYes" : "postalNo"));
      s.stage = "more";
      say(ctx, T(s, "askMore"));
      return true;
    },
    more(ctx, f) {
      const s = ctx.s;
      if (f.service) { resetErrand(s); startService(ctx, f); return true; }
      if (f.no || f.bye || f.done) { close(ctx, false); return true; }
      if (f.yes) { resetErrand(s); s.stage = "service"; say(ctx, T(s, "askServiceMore")); return true; }
      return false;
    }
  };

  function missed(ctx) {
    const s = ctx.s;
    s.misses += 1;
    if (s.misses >= 2 && s.handler === "assistant") { handoff(ctx, true); return; }
    if (s.stage === "confirm") { say(ctx, T(s, "needClearYes")); return; }
    if (s.stage === "notify") { say(ctx, T(s, "askPostalAgain")); return; }
    say(ctx, T(s, "didntCatch"));
    say(ctx, promptFor(s));
  }

  function hear(ctx, raw) {
    const s = ctx.s;
    const text = String(raw || "").trim();
    if (!text || ["ringing", "hold", "done"].includes(s.stage)) return;
    const f = parse(text);

    // Credentials never reach the transcript.
    if (f.credential) {
      ctx.out.push({ type: "caller", text: T(s, "redacted"), redacted: true });
      say(ctx, T(s, "credential"));
      say(ctx, promptFor(s));
      return;
    }
    ctx.out.push({ type: "caller", text });

    if (f.emergency) { say(ctx, T(s, "emergency")); return; }
    if (f.lang && f.lang !== s.lang) { switchLanguage(ctx, f.lang); return; }
    if (f.person) { handoff(ctx, false); return; }
    if (f.confused) {
      if (s.handler === "assistant") { handoff(ctx, true); return; }
      s.misses = 0;
      say(ctx, T(s, "slowDown"));
      say(ctx, promptFor(s));
      return;
    }
    if (f.repeat && !f.service) {
      say(ctx, s.lastPrompt || promptFor(s));
      return;
    }
    if (f.bye && !["notify", "more"].includes(s.stage)) { close(ctx, true); return; }

    const handled = STAGES[s.stage] ? STAGES[s.stage](ctx, f) : false;
    if (handled) s.misses = 0;
    else missed(ctx);
  }

  function step(previous, event) {
    const s = typeof structuredClone === "function" ? structuredClone(previous) : JSON.parse(JSON.stringify(previous));
    const ctx = { s, out: [] };
    if (s.ended) return { state: s, out: [] };
    switch (event && event.type) {
      case "start":
        if (s.stage === "ringing") { s.stage = "service"; say(ctx, T(s, "greeting")); }
        break;
      case "say":
        hear(ctx, event.text);
        break;
      case "person":
        if (!["ringing", "hold", "done"].includes(s.stage)) handoff(ctx, false);
        break;
      case "repeat":
        if (!["ringing", "hold", "done"].includes(s.stage)) say(ctx, s.lastPrompt || promptFor(s));
        break;
      case "lang":
        if (event.lang === "en" || event.lang === "de") switchLanguage(ctx, event.lang);
        break;
      case "resume":
        resume(ctx);
        break;
      case "hangup":
        s.ended = true;
        s.stage = "done";
        ctx.out.push({ type: "end", reason: "hangup" });
        break;
      default:
        break;
    }
    const spoken = ctx.out.filter((o) => o.type === "say").map((o) => o.text);
    if (spoken.length) s.lastPrompt = spoken.join(" ");
    return { state: s, out: ctx.out };
  }

  // ---------------------------------------------------------------- presenter helpers

  function journeyIndex(s) {
    const stage = s.stage === "hold" && s.resume ? s.resume.stage : s.stage;
    return { ringing: -1, service: 0, city: 1, destination: 1, pref: 1, review: 2, change: 2, options: 3, confirm: 4, notify: 5, more: 5, done: 6 }[stage] ?? 0;
  }

  function knowledge(s) {
    const de = s.lang === "de";
    const serviceName = s.service ? { address: de ? "Neue Adresse anmelden" : "Register a new address", doctor: de ? "Hausarzttermin" : "GP appointment", train: de ? "Bahnfahrkarte" : "Train ticket" }[s.service] : null;
    const place = s.service === "train" ? (s.destination ? `Berlin → ${cityName(s.destination, s.lang)}` : null) : s.city ? "Berlin" : null;
    const when = s.day || s.tod ? whenPhrase(s) : null;
    return [
      { key: "service", label: de ? "Anliegen" : "Errand", value: serviceName },
      { key: "place", label: s.service === "train" ? (de ? "Strecke" : "Route") : de ? "Stadt" : "City", value: place },
      { key: "when", label: de ? "Wunschzeit" : "Preferred time", value: when },
      { key: "choice", label: de ? "Auswahl" : "Chosen option", value: s.selection ? shortOption(s.selection, s.lang) : s.booking ? shortOption(s.booking, s.lang) : null },
      { key: "ref", label: de ? "Referenz" : "Reference", value: s.booking ? s.booking.ref : null }
    ];
  }

  return {
    createCall, step, parse, suggestions, journeyIndex, knowledge, describeOption, shortOption, optionCard, formatDate,
    constants: { TRANSFER_MS, LOOKUP_MS, CITIES, PLACES }
  };
});
