/* CallAssist conversation engine.
   Pure logic with no DOM access: call.js renders it, tests/engine.test.js exercises it in Node.
   Every step takes the current call state and one event, and returns a new state plus a list of
   outputs ("say", "caller", "hold", "booked", "postal", "handler", "lang", "end") for the UI to play. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CallAssistEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const TRANSFER_MS = 3400;
  const LOOKUP_MS = 2600;

  // ---------------------------------------------------------------- reference data

  const CITIES = {
    berlin: { en: "Berlin", de: "Berlin", words: ["berlin"], station: { en: "Berlin Central Station", de: "Berlin Hauptbahnhof" } },
    dusseldorf: { en: "Düsseldorf", de: "Düsseldorf", words: ["düsseldorf", "dusseldorf", "duesseldorf"], station: { en: "Düsseldorf Central Station", de: "Düsseldorf Hauptbahnhof" } },
    munich: { en: "Munich", de: "München", words: ["munich", "münchen", "muenchen", "munchen"], station: { en: "Munich Central Station", de: "München Hauptbahnhof" } },
    frankfurt: { en: "Frankfurt", de: "Frankfurt", words: ["frankfurt"], station: { en: "Frankfurt Central Station", de: "Frankfurt Hauptbahnhof" } },
    hamburg: { en: "Hamburg", de: "Hamburg", words: ["hamburg"], station: { en: "Hamburg Central Station", de: "Hamburg Hauptbahnhof" } },
    hanover: { en: "Hanover", de: "Hannover", words: ["hanover", "hannover"], station: { en: "Hanover Central Station", de: "Hannover Hauptbahnhof" } },
    leipzig: { en: "Leipzig", de: "Leipzig", words: ["leipzig"], station: { en: "Leipzig Central Station", de: "Leipzig Hauptbahnhof" } },
    dresden: { en: "Dresden", de: "Dresden", words: ["dresden"], station: { en: "Dresden Central Station", de: "Dresden Hauptbahnhof" } },
    cologne: { en: "Cologne", de: "Köln", words: ["cologne", "köln", "koeln", "koln"], station: { en: "Cologne Central Station", de: "Köln Hauptbahnhof" } },
    stuttgart: { en: "Stuttgart", de: "Stuttgart", words: ["stuttgart"], station: { en: "Stuttgart Central Station", de: "Stuttgart Hauptbahnhof" } },
    bremen: { en: "Bremen", de: "Bremen", words: ["bremen"] },
    potsdam: { en: "Potsdam", de: "Potsdam", words: ["potsdam"] },
    nuremberg: { en: "Nuremberg", de: "Nürnberg", words: ["nuremberg", "nürnberg", "nuernberg"] },
    bonn: { en: "Bonn", de: "Bonn", words: ["bonn"] },
    dortmund: { en: "Dortmund", de: "Dortmund", words: ["dortmund"] },
    rostock: { en: "Rostock", de: "Rostock", words: ["rostock"] },
    kiel: { en: "Kiel", de: "Kiel", words: ["kiel"] }
  };
  // CallAssist books Citizens' Office and GP appointments in these cities, and trains leaving from them.
  const SERVICE_CITIES = ["berlin", "dusseldorf", "munich", "frankfurt"];
  const listCities = (lang) => (lang === "de" ? "Berlin, Düsseldorf, München und Frankfurt" : "Berlin, Düsseldorf, Munich and Frankfurt");
  const listStations = (lang) => (lang === "de" ? "Berlin, Hamburg, Hannover, Leipzig, Dresden, Düsseldorf, Köln, Frankfurt, Stuttgart und München" : "Berlin, Hamburg, Hanover, Leipzig, Dresden, Düsseldorf, Cologne, Frankfurt, Stuttgart and Munich");

  // Real Citizens' Offices and GP practices (checked on the cities' and practices' own websites, September 2026).
  // Only the free appointment times offered at them are simulated.
  const PLACES = {
    address: {
      berlin: [
        { words: ["mitte", "karl-marx-allee", "alexanderplatz"], spoken: { en: "at the Citizens' Office in Mitte Town Hall, Karl-Marx-Allee 31", de: "im Bürgeramt Rathaus Mitte, Karl-Marx-Allee 31" }, name: { en: "Citizens' Office, Mitte Town Hall", de: "Bürgeramt Rathaus Mitte" }, street: "Karl-Marx-Allee 31, 10178 Berlin" },
        { words: ["schöneberg", "schoeneberg", "schoneberg", "kennedy", "john-f.-kennedy-platz"], spoken: { en: "at the Citizens' Office in Schöneberg Town Hall, John-F.-Kennedy-Platz 1", de: "im Bürgeramt Rathaus Schöneberg, John-F.-Kennedy-Platz 1" }, name: { en: "Citizens' Office, Schöneberg Town Hall", de: "Bürgeramt Rathaus Schöneberg" }, street: "John-F.-Kennedy-Platz 1, 10825 Berlin" }
      ],
      dusseldorf: [
        { words: ["willi-becker-allee", "dienstleistungszentrum", "service centre"], spoken: { en: "at the Citizens' Office in the city service centre, Willi-Becker-Allee 7", de: "im Bürgerbüro im Dienstleistungszentrum, Willi-Becker-Allee 7" }, name: { en: "Citizens' Office, city service centre", de: "Bürgerbüro im Dienstleistungszentrum" }, street: "Willi-Becker-Allee 7, 40227 Düsseldorf" }
      ],
      munich: [
        { words: ["ruppertstraße", "ruppertstrasse"], spoken: { en: "at the Citizens' Office on Ruppertstraße 19", de: "im Bürgerbüro Ruppertstraße 19" }, name: { en: "Citizens' Office Ruppertstraße", de: "Bürgerbüro Ruppertstraße" }, street: "Ruppertstraße 19, 80337 München" }
      ],
      frankfurt: [
        { words: ["zeil", "zentrales"], spoken: { en: "at the central Citizens' Office, Zeil 3", de: "im Zentralen Bürgeramt, Zeil 3" }, name: { en: "Central Citizens' Office", de: "Zentrales Bürgeramt" }, street: "Zeil 3, 60313 Frankfurt am Main" }
      ]
    },
    doctor: {
      berlin: [
        { words: ["mitte", "medicover", "hausvogteiplatz"], spoken: { en: "at the Medicover medical centre in Berlin-Mitte, Hausvogteiplatz 3", de: "im MVZ Medicover Berlin-Mitte, Hausvogteiplatz 3" }, name: { en: "Medicover medical centre, Berlin-Mitte", de: "MVZ Medicover Berlin-Mitte" }, street: "Hausvogteiplatz 3–4, 10117 Berlin" },
        { words: ["schöneberg", "schoeneberg", "schoneberg", "meraneum", "bozener"], spoken: { en: "at the meraneum GP practice in Schöneberg, Bozener Straße 13", de: "in der Hausarztpraxis MVZ meraneum in Schöneberg, Bozener Straße 13" }, name: { en: "meraneum GP practice, Schöneberg", de: "MVZ meraneum, Schöneberg" }, street: "Bozener Straße 13/14, 10825 Berlin" }
      ],
      dusseldorf: [
        { words: ["schadowstraße", "schadowstrasse", "hausarztzentrum"], spoken: { en: "at the GP centre in Düsseldorf city centre, Schadowstraße 71", de: "im Hausarztzentrum Düsseldorf-Stadtmitte, Schadowstraße 71" }, name: { en: "GP centre, Düsseldorf city centre", de: "Hausarztzentrum Düsseldorf-Stadtmitte" }, street: "Schadowstraße 71, 40212 Düsseldorf" }
      ],
      munich: [
        { words: ["baldestraße", "baldestrasse", "baldeplatz"], spoken: { en: "at the Hausarztpraxis München GP practice, Baldestraße 21", de: "in der Hausarztpraxis München, Baldestraße 21" }, name: { en: "Hausarztpraxis München (GP practice), Baldeplatz", de: "Hausarztpraxis München, Baldeplatz" }, street: "Baldestraße 21, 80469 München" }
      ],
      frankfurt: [
        { words: ["medicus", "stiftstraße", "stiftstrasse"], spoken: { en: "at the Medicus medical centre, Stiftstraße 14", de: "im MEDICUS MVZ Frankfurt, Stiftstraße 14" }, name: { en: "Medicus medical centre, Frankfurt", de: "MEDICUS MVZ Frankfurt" }, street: "Stiftstraße 14, 60313 Frankfurt am Main" }
      ]
    }
  };
  const placeOf = (o) => PLACES[o.service][o.city][o.place];

  // Real long-distance connections (train numbers and scheduled times) for a typical weekday, Saturday and Sunday,
  // taken from the published timetable; see trains.js.
  const TRAINS = (typeof module === "object" && module.exports && typeof require === "function") ? require("./trains.js") : ((root && root.CALLASSIST_TRAINS) || {});

  const TIMES = {
    address: { morning: ["09:40", "11:20"], afternoon: ["14:10", "15:30"] },
    doctor: { morning: ["08:45", "10:30"], afternoon: ["14:30", "16:15"] }
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
    // Questions the caller may ask along the way; CallAssist answers before carrying on.
    asking: /^\s*(can|could|would|will|what|where|when|how|why|which|is|are|do|does|kann|können|könnten|würden|was|wo|wann|wie|warum|welche\p{L}*|ist|sind|gibt)\b|können sie|könnten sie|can you|could you|tell me|give me|sagen sie mir|geben sie mir|nennen sie mir|i'?d like to know|ich möchte wissen/u,
    askWhere: words(["address", "addresses", "where", "located", "location", "adresse", "adressen", "anschrift", "wo", "straße", "strasse", "platform", "gleis"]),
    askBring: words(["bring", "take with me", "documents", "papers", "need to have", "mitbringen", "mitnehmen", "unterlagen", "dokumente", "papiere"]),
    askCost: words(["cost", "costs", "how much", "price", "fee", "pay", "free of charge", "kostet", "kosten", "preis", "gebühr", "gebühren", "bezahlen", "zahlen", "kostenlos"]),
    bookCommand: words(["book", "book it", "go ahead", "confirm", "reserve", "buchen", "bestätigen", "reservieren", "machen sie"]),
    done: words(["that's all", "thats all", "that is all", "nothing else", "no thanks", "no thank you", "das war's", "das wars", "das war alles", "nichts mehr", "sonst nichts", "nein danke"]),
    postal: words(["post", "by post", "letter", "mail", "brief", "per post", "postal", "zuschicken", "schicken", "send"]),
    phone: words(["phone", "telephone", "phone only", "telefon*", "telefonisch", "abholen", "collect", "pick up"]),
    fieldDay: words(["day", "date", "tag", "datum", "wochentag"]),
    fieldTime: words(["time", "time of day", "uhrzeit", "tageszeit", "zeit"]),
    fieldCity: words(["city", "town", "stadt", "ort"]),
    fieldDestination: words(["destination", "where", "ziel", "reiseziel", "wohin"]),
    fieldOrigin: words(["from", "leaving", "departure", "starting", "abfahrt", "abfahrtsort", "start", "von wo"]),
    noop: /$^/
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
    const fromHit = cityHits.find((c) => c.from);
    const toHit = cityHits.find((c) => c.to);
    const plain = cityHits.filter((c) => !c.from && !c.to);
    f.from = fromHit ? fromHit.key : null;
    f.to = toHit ? toHit.key : null;
    f.plainCities = plain.map((c) => c.key);
    // For an office or a practice, the city someone moved *to* (or simply named) counts.
    f.city = (toHit || plain[0] || fromHit || {}).key || null;

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

    f.person = LEX.person.test(t);
    f.confused = LEX.confused.test(t);
    f.repeat = LEX.repeat.test(t);
    f.emergency = LEX.emergency.test(t);
    f.credential = LEX.credential.test(t);
    f.banking = LEX.banking.test(t);
    f.notYet = LEX.notYet.test(t);
    f.bye = LEX.bye.test(t);
    f.question = /\?/.test(String(raw)) || LEX.asking.test(t);
    f.ask = f.question ? (LEX.askWhere.test(t) ? "where" : LEX.askBring.test(t) ? "bring" : LEX.askCost.test(t) ? "cost" : null) : null;
    f.bookCommand = LEX.bookCommand.test(t);
    f.done = LEX.done.test(t);
    f.postal = LEX.postal.test(t);
    f.phone = LEX.phone.test(t);
    f.fields = {
      day: LEX.fieldDay.test(t), time: LEX.fieldTime.test(t), city: LEX.fieldCity.test(t), destination: LEX.fieldDestination.test(t), origin: LEX.fieldOrigin.test(t)
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

  const dayType = (d) => (d <= 5 ? "weekday" : d === 6 ? "saturday" : "sunday");
  function dateOfWeekday(s, day) {
    const date = nextMonday(s.now);
    date.setUTCDate(date.getUTCDate() + day - 1);
    return iso(date);
  }

  function buildTrainOptions(s) {
    const day = s.day || 2;
    const table = ((TRAINS[s.origin] || {})[s.destination] || {})[dayType(day)] || {};
    const morning = table.morning || [], afternoon = table.afternoon || [];
    let picks;
    if (s.tod === "morning") picks = morning.concat(afternoon);
    else if (s.tod === "afternoon") picks = afternoon.concat(morning);
    else picks = [morning[0], afternoon[0]].filter(Boolean).concat(morning.slice(1), afternoon.slice(1));
    return picks.slice(0, 2).map((p, index) => ({
      index, service: "train", date: dateOfWeekday(s, day), weekday: day, time: p.dep, arrival: p.arr, arrDays: p.days || 0,
      train: p.train, change: p.change || null, train2: p.train2 || null, origin: s.origin, destination: s.destination
    }));
  }

  function buildOptions(s) {
    if (s.service === "train") return buildTrainOptions(s);
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
      return { index, service: s.service, date: iso(date), weekday: spec.day, time: spec.time, city: s.city, place: index % PLACES[s.service][s.city].length };
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
  const stationOf = (key, lang) => (key && CITIES[key].station ? CITIES[key].station[lang] : cityName(key, lang));
  // Timetable station names ("Frankfurt(Main)Hbf", "Hannover Hbf") read naturally aloud.
  function stationName(raw, lang) {
    let name = String(raw || "").replace("(Main)", " ").replace("(M)", "").replace(/\s+/g, " ").trim();
    if (/Flughafen/.test(name)) return lang === "de" ? "Frankfurt Flughafen" : "Frankfurt Airport";
    if (/ ?Hbf$/.test(name)) name = name.replace(/ ?Hbf$/, lang === "de" ? " Hauptbahnhof" : " Central Station");
    if (lang === "en") name = name.replace("Köln", "Cologne").replace("München", "Munich").replace("Hannover", "Hanover").replace("Nürnberg", "Nuremberg");
    return name;
  }
  const trainNo = (name) => String(name || "").replace(/\s+/g, " ");

  function describeOption(o, lang) {
    const date = formatDate(o.date, lang);
    if (o.service === "train") {
      const dest = cityName(o.destination, lang);
      const next = o.arrDays ? (lang === "de" ? " am nächsten Tag" : " the next day") : "";
      const change = o.change
        ? (lang === "de" ? `, mit einem Umstieg in ${stationName(o.change, "de")} in den ${trainNo(o.train2)}` : `, with one change in ${stationName(o.change, "en")} to the ${trainNo(o.train2)}`)
        : (lang === "de" ? ", ohne Umsteigen" : ", direct");
      return lang === "de"
        ? `${date}: der ${trainNo(o.train)} ab ${stationOf(o.origin, "de")} um ${formatTime(o.time, lang)}, Ankunft in ${dest} um ${formatTime(o.arrival, lang)}${next}${change}`
        : `${date}: the ${trainNo(o.train)} from ${stationOf(o.origin, "en")} at ${formatTime(o.time, lang)}, arriving in ${dest} at ${formatTime(o.arrival, lang)}${next}${change}`;
    }
    const place = placeOf(o);
    return lang === "de" ? `${date} um ${formatTime(o.time, lang)} ${place.spoken.de}` : `${date} at ${formatTime(o.time, lang)}, ${place.spoken.en}`;
  }
  function shortOption(o, lang) {
    const date = formatDate(o.date, lang);
    if (o.service === "train") {
      return lang === "de"
        ? `${date}, der ${trainNo(o.train)} um ${formatTime(o.time, lang)} nach ${cityName(o.destination, lang)}`
        : `${date}, the ${trainNo(o.train)} at ${formatTime(o.time, lang)} to ${cityName(o.destination, lang)}`;
    }
    return `${date}, ${formatTime(o.time, lang)}, ${placeOf(o).name[lang]}`;
  }
  // Structured version for the appointment card and letter.
  function optionCard(o, lang) {
    const date = formatDate(o.date, lang);
    if (o.service === "train") {
      const route = o.change ? (lang === "de" ? `Umstieg in ${stationName(o.change, "de")} (${trainNo(o.train2)})` : `change at ${stationName(o.change, "en")} (${trainNo(o.train2)})`) : (lang === "de" ? "ohne Umsteigen" : "direct");
      return {
        title: `${stationOf(o.origin, lang)} → ${stationOf(o.destination, lang)}`,
        when: `${date}`,
        detail: lang === "de" ? `${trainNo(o.train)}, ab ${formatTime(o.time, lang)}, an ${formatTime(o.arrival, lang)}, ${route}` : `${trainNo(o.train)}, departs ${formatTime(o.time, lang)}, arrives ${formatTime(o.arrival, lang)}, ${route}`
      };
    }
    const place = placeOf(o);
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
    const dest = cityName(s.destination, s.lang), origin = cityName(s.origin, s.lang), city = cityName(s.city, s.lang);
    if (s.lang === "de") {
      return { address: `einen Termin im Bürgeramt in ${city}, um Ihre neue Adresse anzumelden`, doctor: `einen Termin in einer Hausarztpraxis in ${city}`, train: `eine Fahrkarte von ${origin} nach ${dest}` }[s.service];
    }
    return { address: `an appointment at the Citizens' Office in ${city} to register your new address`, doctor: `an appointment at a GP practice in ${city}`, train: `a train ticket from ${origin} to ${dest}` }[s.service];
  }

  function adviserContext(s) {
    const de = s.lang === "de";
    let text = {
      address: de ? "Sie möchten Ihre neue Adresse anmelden" : "you'd like to register your new address",
      doctor: de ? "Sie möchten einen Termin in einer Hausarztpraxis" : "you'd like a GP appointment",
      train: de ? "Sie möchten eine Fahrkarte" : "you'd like a train ticket"
    }[s.service];
    if (s.service === "train" && s.origin) text += (de ? " ab " : " from ") + cityName(s.origin, s.lang);
    if (s.service === "train" && s.destination) text += (de ? " nach " : " to ") + cityName(s.destination, s.lang);
    if (s.service !== "train" && s.city) text += " in " + cityName(s.city, s.lang);
    if (s.day || s.tod) text += ", " + whenPhrase(s);
    if (s.selection) text += de ? `, und Sie haben ${shortOption(s.selection, "de")} gewählt` : `, and you've picked ${shortOption(s.selection, "en")}`;
    return text;
  }

  const TEXT = {
    en: {
      greeting: (s) => `${hello(s)}, this is CallAssist. I'm an automated assistant, and you can speak to a real person at any time. Just so you know: I will never ask for your PIN or any password. Today I can help you with three things: registering a new address at the Citizens' Office, booking an appointment with a GP, or booking a train ticket. What would you like to do?`,
      askService: "I can help you register a new address, book a GP appointment, or book a train ticket. Which would you like?",
      askServiceShort: "So, what can I do for you? A new address, a doctor's appointment, or a train ticket?",
      askServiceMore: "Of course. I can help with a new address, a GP appointment, or a train ticket. What would you like?",
      ack_address: "Of course. I'll help you register your new address.",
      ack_doctor: "Of course. I'll book you an appointment at a GP practice. If it's an emergency, please hang up and call 112.",
      ack_train: "Of course. I'll book a train ticket for you.",
      askCity: (s) => (s.service === "doctor" ? "Which city should the practice be in?" : "Which city have you moved to?"),
      askCityShort: "And which city are you in?",
      askDestination: "Where would you like to travel to?",
      askOrigin: "And where will you be leaving from? I can book trains from Berlin, Düsseldorf, Munich and Frankfurt.",
      askOriginShort: "And where are you leaving from?",
      askDestinationShort: "And where are you off to?",
      askPref: (s) => (s.service === "train" ? "Which day next week would you like to travel, and would you rather leave in the morning or the afternoon?" : "Which day next week would suit you, and do you prefer the morning or the afternoon?"),
      askPrefShort: "Which day would suit you? And is morning or afternoon better?",
      review: (s) => `Let me check I have this right. You'd like ${whatPhrase(s)}, ${whenPhrase(s)}. Is that correct?`,
      reviewShort: (s) => `Just so I've got it right: ${whatPhrase(s)}, ${whenPhrase(s)}. Is that right?`,
      askChange: (s) => `Of course. What should I change: the day, the time of day, or ${s.service === "train" ? "where you're going" : "the city"}?`,
      askChangeShort: "No problem. What would you like to change?",
      updated: "Thank you, I've changed that.",
      checking: (s) => ({
        address: `Thank you. I'm checking free appointments at the Citizens' Office in ${cityName(s.city, "en")} now. One moment, please.`,
        doctor: `Thank you. I'm checking free appointments at GP practices in ${cityName(s.city, "en")} now. One moment, please.`,
        train: `Thank you. I'm checking trains from ${cityName(s.origin, "en")} to ${cityName(s.destination, "en")} now. One moment, please.`
      })[s.service],
      lookAgain: "No problem, I'll look again.",
      checkingShort: (s) => (s.service === "train" ? "Let me just look up the trains for you. Bear with me a second." : "Let me just see what's free. Bear with me a second."),
      bookedShort: (s) => `That's all booked for you: ${describeOption(s.booking, "en")}. Your reference number is ${spellReference(s.booking.ref)}.`,
      options: (s) => `I've found two options. The first: ${describeOption(s.options[0], "en")}. The second: ${describeOption(s.options[1], "en")}. Which would you like?`,
      optionsShort: (s) => `I've got two for you. The first is ${shortOption(s.options[0], "en")}. Or there's ${shortOption(s.options[1], "en")}. Which one sounds better?`,
      noneSuit: "No problem. What should I change so it suits you better: the day or the time of day?",
      confirm: (s) => `Before I book anything: ${describeOption(s.selection, "en")}. Shall I book this ${s.service === "train" ? "ticket" : "appointment"} for you? Please say yes or no.`,
      confirmShort: (s) => `So that's ${shortOption(s.selection, "en")}. Shall I go ahead and book that for you?`,
      needClearYes: "For your protection, I only book when you give me a clear yes. Shall I book it, yes or no?",
      nothingBooked: "No problem, nothing has been booked.",
      booked: (s) => `Done. Your ${s.service === "train" ? "ticket" : "appointment"} is booked: ${describeOption(s.booking, "en")}. Your reference number is ${spellReference(s.booking.ref)}.`,
      askPostal: (s) => (s.service === "train" ? "Shall I send the ticket to your home by post?" : "Would you also like a confirmation letter by post?"),
      postalYes: (s) => `I'll send the ${s.service === "train" ? "ticket" : "letter"} to the address registered with CallAssist. It usually arrives within two working days. Here are the details once more: ${describeOption(s.booking, "en")}.`,
      postalNo: (s) => (s.service === "train"
        ? `Alright. You can pick up your ticket at the travel centre in ${stationOf(s.booking.origin, "en")}; just give them your reference number, ${spellReference(s.booking.ref)}. Here are the details once more: ${describeOption(s.booking, "en")}.`
        : `Alright, no letter. Here are the details once more: ${describeOption(s.booking, "en")}. Your reference number is ${spellReference(s.booking.ref)}. Call again any time and I'll repeat them.`),
      askPostalAgain: "Would you like it by post, or is the phone enough?",
      askMore: "Is there anything else I can do for you?",
      closing: "Thank you for calling CallAssist. Take care, and goodbye!",
      closingEarly: "Alright. Nothing has been booked. Thank you for calling CallAssist. Goodbye!",
      transfer: "Of course. I'm connecting you to Marina from our team. She can see everything you've told me, so you won't need to repeat anything. Please hold.",
      transferConfused: "That's completely fine. I'm connecting you to Marina from our team; she's a real person. She can see everything you've told me, so you won't need to repeat anything. Please hold.",
      adviserHello: (s) => (s.service ? `Hi, this is Marina from CallAssist. Don't worry, I've got everything you told us so far. So, ${adviserContext(s)}. We'll sort this out together.` : "Hi, this is Marina from CallAssist. How can I help you today?"),
      alreadyAdviser: "It's me, Marina. You're talking to a real person now, so take all the time you need.",
      slowDown: "That's absolutely fine, there's no rush at all.",
      didntCatch: "Sorry, I didn't quite catch that.",
      credential: "Please don't tell me any PIN, password or bank details. CallAssist will never ask for them, and I haven't kept what you just said. I only need details about your errand.",
      redacted: "[Removed: sensitive information]",
      emergency: "If this is a medical emergency, please hang up now and call 112. If it isn't urgent, I'm happy to book you a GP appointment.",
      banking: "I'm sorry, CallAssist doesn't do banking, and I will never ask for your bank details. I can help with a new address, a GP appointment, or a train ticket.",
      notYet: "I'm sorry, I can't help with that yet. Today I can help with a new address, a GP appointment, or a train ticket.",
      cityUnsupported: (city) => `I'm sorry, CallAssist doesn't work in ${city} yet. At the moment I can book in ${listCities("en")}. Is it one of those? If not, I can connect you to an adviser.`,
      cityUnsupportedAdviser: (city) => `I'm sorry, we're only in ${listCities("en")} so far. I've noted that you asked about ${city}. Would one of those work, or shall we leave it for today?`,
      cityDeclined: "I understand. Then I'm afraid I can't book this today, but I've passed your request on to our team.",
      destUnsupported: (city) => `I'm sorry, I can't book trains to ${city} yet. I can book trains to ${listStations("en")}. Where would you like to go?`,
      originUnsupported: (city) => `I'm sorry, I can't book trains from ${city} yet, only from ${listCities("en")}. Which of those are you leaving from?`,
      sameCity: "That would be the same city twice. Where would you like to go?",
      noTrains: "I'm sorry, I couldn't find a suitable train for that. Would another day or time of day work?",
      weekend: (s) => (s.service === "doctor" ? "GP practices are closed at the weekend. Which weekday would suit you?" : "The Citizens' Offices are closed at the weekend. Which weekday would suit you?"),
      langSwitched: "Of course, let's continue in English.",
      whereLater: "I'll give you the exact address when I read out the options in a moment.",
      whereOptions: (s) => {
        if (s.service === "train") return `Your train leaves from ${stationOf(s.origin, "en")}. The platform is printed on your ticket.`;
        const [a, b] = s.options.map(placeOf);
        return a === b ? `Both are at ${a.name.en}, ${a.street}.` : `The first is at ${a.name.en}, ${a.street}. The second is at ${b.name.en}, ${b.street}.`;
      },
      whereChosen: (o) => (o.service === "train"
        ? `Your train leaves from ${stationOf(o.origin, "en")}. The platform is printed on your ticket.`
        : `It's at ${placeOf(o).name.en}, ${placeOf(o).street}.`),
      bring: (s) => ({ address: "Please bring your ID card or passport, and the confirmation from your landlord that you've moved in.", doctor: "Just bring your health insurance card.", train: "Just bring your ticket and a photo ID." })[s.service],
      cost: (s) => ({ address: "Registering your address is free of charge, and CallAssist is free for you too.", doctor: "The appointment is covered by your health insurance, and CallAssist is free for you.", train: "CallAssist is free for you. The fare is on the invoice that comes with your ticket." })[s.service],
      questionFirst: "Before I book anything, I want to make sure: shall I book it now, yes or no?"
    },
    de: {
      greeting: (s) => `${hello(s)}, hier ist CallAssist. Ich bin ein automatischer Assistent, und Sie können jederzeit mit einem Menschen sprechen. Vorab: Ich frage Sie niemals nach Ihrer PIN oder einem Passwort. Ich kann Ihnen heute bei drei Dingen helfen: eine neue Adresse beim Bürgeramt anmelden, einen Termin in einer Hausarztpraxis vereinbaren oder eine Bahnfahrkarte buchen. Was möchten Sie tun?`,
      askService: "Ich kann eine neue Adresse anmelden, einen Hausarzttermin vereinbaren oder eine Bahnfahrkarte buchen. Was möchten Sie?",
      askServiceShort: "Was kann ich für Sie tun? Eine neue Adresse, ein Arzttermin oder eine Bahnfahrkarte?",
      askServiceMore: "Gern. Ich kann eine neue Adresse anmelden, einen Hausarzttermin vereinbaren oder eine Bahnfahrkarte buchen. Was darf es sein?",
      ack_address: "Gern, ich helfe Ihnen bei der Anmeldung Ihrer neuen Adresse.",
      ack_doctor: "Gern, ich vereinbare einen Termin in einer Hausarztpraxis für Sie. Im Notfall legen Sie bitte auf und rufen die 112 an.",
      ack_train: "Gern, ich buche eine Bahnfahrkarte für Sie.",
      askCity: (s) => (s.service === "doctor" ? "In welcher Stadt soll die Praxis sein?" : "In welche Stadt sind Sie gezogen?"),
      askCityShort: "Und in welcher Stadt sind Sie?",
      askDestination: "Wohin möchten Sie fahren?",
      askOrigin: "Und von wo fahren Sie los? Ich buche Züge ab Berlin, Düsseldorf, München und Frankfurt.",
      askOriginShort: "Und von wo fahren Sie los?",
      askDestinationShort: "Und wohin soll's gehen?",
      askPref: (s) => (s.service === "train" ? "An welchem Tag nächste Woche möchten Sie fahren, und lieber vormittags oder nachmittags?" : "Welcher Tag in der nächsten Woche passt Ihnen, und ist Ihnen der Vormittag oder der Nachmittag lieber?"),
      askPrefShort: "Welcher Tag passt Ihnen denn? Und lieber vormittags oder nachmittags?",
      review: (s) => `Ich fasse kurz zusammen: Sie möchten ${whatPhrase(s)}, ${whenPhrase(s)}. Stimmt das?`,
      reviewShort: (s) => `Nur damit ich alles richtig habe: ${whatPhrase(s)}, ${whenPhrase(s)}. Stimmt das so?`,
      askChange: (s) => `Natürlich. Was soll ich ändern: den Tag, die Tageszeit oder ${s.service === "train" ? "das Reiseziel" : "die Stadt"}?`,
      askChangeShort: "Kein Problem. Was möchten Sie ändern?",
      updated: "Danke, das habe ich geändert.",
      checking: (s) => ({
        address: `Danke. Ich prüfe jetzt freie Termine beim Bürgeramt in ${cityName(s.city, "de")}. Einen Moment bitte.`,
        doctor: `Danke. Ich prüfe jetzt freie Termine bei Hausarztpraxen in ${cityName(s.city, "de")}. Einen Moment bitte.`,
        train: `Danke. Ich suche jetzt Verbindungen von ${cityName(s.origin, "de")} nach ${cityName(s.destination, "de")}. Einen Moment bitte.`
      })[s.service],
      lookAgain: "Kein Problem, ich schaue noch einmal nach.",
      checkingShort: (s) => (s.service === "train" ? "Ich schaue mal kurz nach den Zügen. Einen kleinen Moment." : "Ich schaue mal kurz, was frei ist. Einen kleinen Moment."),
      bookedShort: (s) => `So, das ist gebucht: ${describeOption(s.booking, "de")}. Ihre Referenznummer ist ${spellReference(s.booking.ref)}.`,
      options: (s) => `Ich habe zwei Möglichkeiten gefunden. Erstens: ${describeOption(s.options[0], "de")}. Zweitens: ${describeOption(s.options[1], "de")}. Welche möchten Sie?`,
      optionsShort: (s) => `Ich hätte zwei Möglichkeiten für Sie. Einmal ${shortOption(s.options[0], "de")}. Oder ${shortOption(s.options[1], "de")}. Was passt Ihnen besser?`,
      noneSuit: "Kein Problem. Was soll ich ändern, damit es besser passt: den Tag oder die Tageszeit?",
      confirm: (s) => `Bevor ich etwas buche: ${describeOption(s.selection, "de")}. Soll ich ${s.service === "train" ? "diese Fahrkarte" : "diesen Termin"} für Sie buchen? Bitte sagen Sie ja oder nein.`,
      confirmShort: (s) => `Das wäre dann ${shortOption(s.selection, "de")}. Soll ich das für Sie buchen?`,
      needClearYes: "Zu Ihrer Sicherheit buche ich nur nach einem klaren Ja. Soll ich buchen, ja oder nein?",
      nothingBooked: "Kein Problem, es wurde nichts gebucht.",
      booked: (s) => `Erledigt. ${s.service === "train" ? "Ihre Fahrkarte" : "Ihr Termin"} ist gebucht: ${describeOption(s.booking, "de")}. Ihre Referenznummer lautet ${spellReference(s.booking.ref)}.`,
      askPostal: (s) => (s.service === "train" ? "Soll ich Ihnen die Fahrkarte per Post nach Hause schicken?" : "Möchten Sie zusätzlich eine Bestätigung per Post?"),
      postalYes: (s) => `Ich schicke ${s.service === "train" ? "die Fahrkarte" : "den Brief"} an die Adresse, die bei CallAssist hinterlegt ist. Das dauert normalerweise zwei Werktage. Hier noch einmal die Details: ${describeOption(s.booking, "de")}.`,
      postalNo: (s) => (s.service === "train"
        ? `In Ordnung. Sie können die Fahrkarte im Reisezentrum im ${stationOf(s.booking.origin, "de")} abholen; nennen Sie dort einfach Ihre Referenznummer, ${spellReference(s.booking.ref)}. Hier noch einmal die Details: ${describeOption(s.booking, "de")}.`
        : `In Ordnung, dann ohne Brief. Hier noch einmal die Details: ${describeOption(s.booking, "de")}. Ihre Referenznummer ist ${spellReference(s.booking.ref)}. Rufen Sie jederzeit wieder an, dann wiederhole ich alles.`),
      askPostalAgain: "Möchten Sie es per Post, oder reicht Ihnen das Telefon?",
      askMore: "Kann ich sonst noch etwas für Sie tun?",
      closing: "Vielen Dank für Ihren Anruf bei CallAssist. Alles Gute und auf Wiederhören!",
      closingEarly: "In Ordnung. Es wurde nichts gebucht. Vielen Dank für Ihren Anruf bei CallAssist. Auf Wiederhören!",
      transfer: "Natürlich. Ich verbinde Sie mit Marina aus unserem Team. Sie sieht alles, was Sie mir gesagt haben, Sie müssen also nichts wiederholen. Bitte bleiben Sie dran.",
      transferConfused: "Das ist überhaupt kein Problem. Ich verbinde Sie mit Marina aus unserem Team, einem echten Menschen. Sie sieht alles, was Sie mir gesagt haben, Sie müssen also nichts wiederholen. Bitte bleiben Sie dran.",
      adviserHello: (s) => (s.service ? `Hallo, hier ist Marina von CallAssist. Keine Sorge, ich habe alles, was Sie bisher gesagt haben. Also, ${adviserContext(s)}. Das kriegen wir zusammen hin.` : "Hallo, hier ist Marina von CallAssist. Was kann ich für Sie tun?"),
      alreadyAdviser: "Ich bin's, Marina. Sie sprechen jetzt mit einem echten Menschen, lassen Sie sich also ruhig Zeit.",
      slowDown: "Das ist überhaupt kein Problem, wir haben keine Eile.",
      didntCatch: "Entschuldigung, das habe ich nicht ganz verstanden.",
      credential: "Bitte nennen Sie mir keine PIN, kein Passwort und keine Bankdaten. CallAssist fragt niemals danach, und ich habe das eben Gesagte nicht gespeichert. Ich brauche nur Angaben zu Ihrem Anliegen.",
      redacted: "[Entfernt: vertrauliche Angaben]",
      emergency: "Wenn es ein medizinischer Notfall ist, legen Sie bitte jetzt auf und rufen Sie die 112 an. Wenn es nicht dringend ist, vereinbare ich gern einen Hausarzttermin für Sie.",
      banking: "Das tut mir leid, CallAssist erledigt keine Bankgeschäfte, und ich frage Sie niemals nach Ihren Bankdaten. Ich kann eine neue Adresse anmelden, einen Hausarzttermin vereinbaren oder eine Bahnfahrkarte buchen.",
      notYet: "Das tut mir leid, dabei kann ich noch nicht helfen. Heute kann ich eine neue Adresse anmelden, einen Hausarzttermin vereinbaren oder eine Bahnfahrkarte buchen.",
      cityUnsupported: (city) => `Das tut mir leid, in ${city} gibt es CallAssist noch nicht. Im Moment buche ich in ${listCities("de")}. Ist es eine dieser Städte? Sonst verbinde ich Sie gern mit unserer Beratung.`,
      cityUnsupportedAdviser: (city) => `Das tut mir leid, wir sind bisher nur in ${listCities("de")}. Ich habe notiert, dass Sie nach ${city} gefragt haben. Passt eine dieser Städte, oder lassen wir es für heute?`,
      cityDeclined: "Ich verstehe. Dann kann ich das heute leider nicht buchen, aber ich habe Ihre Anfrage an unser Team weitergegeben.",
      destUnsupported: (city) => `Das tut mir leid, Fahrten nach ${city} kann ich noch nicht buchen. Ich buche Züge nach ${listStations("de")}. Wohin möchten Sie?`,
      originUnsupported: (city) => `Das tut mir leid, ab ${city} kann ich noch keine Züge buchen, nur ab ${listCities("de")}. Von welcher dieser Städte fahren Sie los?`,
      sameCity: "Das wäre zweimal dieselbe Stadt. Wohin möchten Sie fahren?",
      noTrains: "Das tut mir leid, dafür habe ich keine passende Verbindung gefunden. Passt ein anderer Tag oder eine andere Tageszeit?",
      weekend: (s) => (s.service === "doctor" ? "Hausarztpraxen haben am Wochenende geschlossen. Welcher Wochentag passt Ihnen?" : "Die Bürgerämter haben am Wochenende geschlossen. Welcher Wochentag passt Ihnen?"),
      langSwitched: "Gern, wir sprechen ab jetzt Deutsch.",
      whereLater: "Die genaue Adresse nenne ich Ihnen gleich, wenn ich die Möglichkeiten vorlese.",
      whereOptions: (s) => {
        if (s.service === "train") return `Ihr Zug fährt ab ${stationOf(s.origin, "de")}. Das Gleis steht auf Ihrer Fahrkarte.`;
        const [a, b] = s.options.map(placeOf);
        const at = s.service === "doctor" ? "in der Praxis" : "im";
        return a === b ? `Beide Termine sind ${at} ${a.name.de}, ${a.street}.` : `Der erste Termin ist ${at} ${a.name.de}, ${a.street}. Der zweite ${at} ${b.name.de}, ${b.street}.`;
      },
      whereChosen: (o) => (o.service === "train"
        ? `Ihr Zug fährt ab ${stationOf(o.origin, "de")}. Das Gleis steht auf Ihrer Fahrkarte.`
        : `Das ist ${o.service === "doctor" ? "in der Praxis" : "im"} ${placeOf(o).name.de}, ${placeOf(o).street}.`),
      bring: (s) => ({ address: "Bitte bringen Sie Ihren Personalausweis oder Reisepass mit und die Wohnungsgeberbestätigung von Ihrem Vermieter.", doctor: "Bringen Sie einfach Ihre Versichertenkarte mit.", train: "Bringen Sie einfach Ihre Fahrkarte und einen Lichtbildausweis mit." })[s.service],
      cost: (s) => ({ address: "Die Anmeldung ist kostenlos, und CallAssist ist für Sie auch kostenlos.", doctor: "Der Termin wird von Ihrer Krankenkasse übernommen, und CallAssist ist für Sie kostenlos.", train: "CallAssist ist für Sie kostenlos. Den Fahrpreis finden Sie auf der Rechnung, die mit der Fahrkarte kommt." })[s.service],
      questionFirst: "Bevor ich etwas buche, möchte ich sichergehen: Soll ich jetzt buchen, ja oder nein?"
    }
  };

  function T(s, key, arg) {
    const entry = TEXT[s.lang][key];
    return typeof entry === "function" ? entry(arg === undefined ? s : arg) : entry;
  }

  // Suggested caller replies for the presenter, per stage.
  const SUGGESTIONS = {
    en: {
      service: ["I've moved and need to register my new address", "I need an appointment with my doctor", "I'd like a train ticket from Düsseldorf to Munich"],
      city: ["Düsseldorf", "Berlin", "I've moved to Hamburg"],
      destination: ["To Munich, please", "To Hamburg"],
      origin: ["From Düsseldorf", "From Berlin"],
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
      service: ["Ich bin umgezogen und muss meine neue Adresse anmelden", "Ich brauche einen Termin bei meinem Hausarzt", "Ich möchte eine Fahrkarte von Düsseldorf nach München"],
      city: ["Düsseldorf", "Berlin", "Ich bin nach Hamburg gezogen"],
      destination: ["Nach München, bitte", "Nach Hamburg"],
      origin: ["Ab Düsseldorf", "Ab Berlin"],
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
      service: null, city: null, origin: null, destination: null, tod: null, day: null,
      options: [], selection: null, booking: null, bookings: [],
      misses: 0, lastPrompt: "", ended: false
    };
  }

  const speaker = (s) => (s.handler === "adviser" ? "adviser" : "assistant");

  // Marina acknowledges what she heard before moving on, the way a person on the phone does.
  const ACKS = { en: ["Okay.", "Alright.", "Got it.", "Perfect.", "Lovely."], de: ["Okay.", "Gut.", "Alles klar.", "Prima.", "Wunderbar."] };
  function acknowledge(ctx, fromIndex) {
    const s = ctx.s;
    if (s.handler !== "adviser") return;
    const first = ctx.out.slice(fromIndex).find((o) => o.type === "say");
    if (!first || ACKS[s.lang].some((a) => first.text.startsWith(a.slice(0, -1)))) return;
    first.text = `${ACKS[s.lang][(s.acks || 0) % ACKS[s.lang].length]} ${first.text}`;
    s.acks = (s.acks || 0) + 1;
  }
  const short = (s) => s.handler === "adviser";

  function promptFor(s) {
    switch (s.stage) {
      case "service": return short(s) ? T(s, "askServiceShort") : T(s, "askService");
      case "city": return short(s) ? T(s, "askCityShort") : T(s, "askCity");
      case "destination": return short(s) ? T(s, "askDestinationShort") : T(s, "askDestination");
      case "origin": return short(s) ? T(s, "askOriginShort") : T(s, "askOrigin");
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
    else if (s.service === "train" && !s.destination) s.stage = "destination";
    else if (s.service === "train" && !s.origin) s.stage = "origin";
    else if (s.service !== "train" && !s.city) s.stage = "city";
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
      if (SERVICE_CITIES.includes(f.city)) {
        if (s.city !== f.city) { s.city = f.city; changed = true; }
      } else issues.push({ kind: "city", city: f.city });
    }
    if (s.service === "train") {
      // "from Düsseldorf to Munich", "to Munich", or a bare city name answering the current question.
      let origin = f.from, dest = f.to;
      const plain = f.plainCities.slice();
      if (!origin && !dest && plain.length >= 2) { origin = plain[0]; dest = plain[1]; }
      else if (plain.length) {
        const c = plain[0];
        if (!origin && (s.stage === "origin" || (dest && !s.origin))) origin = c;
        else if (!dest) dest = c;
      }
      if (origin) {
        if (SERVICE_CITIES.includes(origin)) {
          if (s.origin !== origin) { s.origin = origin; changed = true; }
          if (!dest && s.destination === origin) issues.push({ kind: "sameCity" });
        } else issues.push({ kind: "origin", city: origin });
      }
      if (dest) {
        if (dest === (s.origin || origin)) issues.push({ kind: "sameCity" });
        else if (CITIES[dest].station) { if (s.destination !== dest) { s.destination = dest; changed = true; } }
        else issues.push({ kind: "dest", city: dest });
      }
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
    } else if (issue.kind === "origin") {
      s.origin = null;
      s.stage = "origin";
      say(ctx, T(s, "originUnsupported", cityName(issue.city, s.lang)));
    } else if (issue.kind === "sameCity") {
      s.destination = null;
      s.stage = "destination";
      say(ctx, T(s, "sameCity"));
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
    Object.assign(s, { service: null, city: null, origin: null, destination: null, tod: null, day: null, options: [], selection: null, booking: null, cityIssue: null });
  }

  function pickOption(s, f) {
    if (s.options.length !== 2) return null;
    if (f.option !== null) return f.no && !f.yes ? 1 - f.option : f.option;
    if (f.time) {
      const hit = s.options.find((o) => o.time === f.time);
      if (hit) return hit.index;
    }
    if (s.service !== "train" && placeOf(s.options[0]) !== placeOf(s.options[1])) {
      const hit = s.options.find((o) => placeOf(o).words.some((w) => f.text.includes(w)));
      if (hit) return hit.index;
    }
    if (s.service === "train") {
      const hit = s.options.find((o) => { const n = String(o.train).replace(/\D/g, ""); return n && new RegExp(`(?<!\\d)${n}(?!\\d)`).test(f.text); });
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
    say(ctx, T(s, short(s) ? "checkingShort" : "checking"));
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
      if (s.options.length < 2) {
        s.options = [];
        s.day = null;
        s.tod = null;
        s.stage = "pref";
        say(ctx, T(s, "noTrains"));
        return;
      }
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
    say(ctx, T(s, short(s) ? "bookedShort" : "booked"));
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
    origin(ctx, f) {
      const s = ctx.s;
      if (raiseIssue(ctx, absorb(ctx, f))) return true;
      if (s.origin) { advance(ctx); return true; }
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
      if (f.fields.origin && s.service === "train") { s.origin = null; advance(ctx); return true; }
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

  function answerQuestion(ctx, f) {
    const s = ctx.s;
    s.misses = 0;
    const chosen = s.booking && ["notify", "more"].includes(s.stage) ? s.booking : s.selection;
    if (f.ask === "where") {
      if (chosen) say(ctx, TEXT[s.lang].whereChosen(chosen));
      else if (s.options.length || s.service === "train") say(ctx, T(s, "whereOptions"));
      else say(ctx, T(s, "whereLater"));
    } else {
      say(ctx, T(s, f.ask));
    }
    // A plain yes alongside the question still confirms the summary, but never a booking.
    if (s.stage === "review" && f.yes && !f.no) { lookup(ctx); return; }
    say(ctx, promptFor(s));
  }

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
    const newErrand = f.service && f.service !== s.service && ["more", "change"].includes(s.stage);
    if (f.ask && s.service && !newErrand && ["city", "destination", "pref", "review", "change", "options", "confirm", "notify", "more"].includes(s.stage)) {
      answerQuestion(ctx, f);
      return;
    }
    // "Yes, but how long does it take?" is not permission to book.
    if (s.stage === "confirm" && f.question && f.yes && !f.no && !f.bookCommand) {
      say(ctx, T(s, "questionFirst"));
      return;
    }

    const before = ctx.out.length;
    const handled = STAGES[s.stage] ? STAGES[s.stage](ctx, f) : false;
    if (handled) { s.misses = 0; acknowledge(ctx, before); }
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
    return { ringing: -1, service: 0, city: 1, destination: 1, origin: 1, pref: 1, review: 2, change: 2, options: 3, confirm: 4, notify: 5, more: 5, done: 6 }[stage] ?? 0;
  }

  function knowledge(s) {
    const de = s.lang === "de";
    const serviceName = s.service ? { address: de ? "Neue Adresse anmelden" : "Register a new address", doctor: de ? "Hausarzttermin" : "GP appointment", train: de ? "Bahnfahrkarte" : "Train ticket" }[s.service] : null;
    const place = s.service === "train"
      ? (s.origin || s.destination ? `${cityName(s.origin, s.lang) || "?"} → ${cityName(s.destination, s.lang) || "?"}` : null)
      : s.city ? cityName(s.city, s.lang) : null;
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
    constants: { TRANSFER_MS, LOOKUP_MS, CITIES, PLACES, SERVICE_CITIES, TRAINS }
  };
});
