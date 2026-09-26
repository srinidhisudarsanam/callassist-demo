// Run with: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../engine.js");

const NOW = Date.parse("2026-09-26T08:00:00Z"); // a Saturday morning in Berlin

function call(lang = "en") {
  let state = E.createCall({ lang, now: NOW });
  const log = [];
  const send = (event) => {
    const r = E.step(state, event);
    state = r.state;
    log.push(...r.out);
    // Holds resolve immediately in tests.
    if (r.out.some((o) => o.type === "hold")) send({ type: "resume" });
    return r.out;
  };
  const say = (text) => send({ type: "say", text });
  send({ type: "start" });
  return { say, send, get state() { return state; }, log, lastSaid: () => log.filter((o) => o.type === "say").map((o) => o.text).slice(-1)[0] || "" };
}

function toOptions(c, service = "I've moved and need to register my new address") {
  c.say(service);
  if (c.state.stage === "city") c.say("Berlin");
  if (c.state.stage === "destination") c.say("To Hamburg");
  if (c.state.stage === "origin") c.say("From Berlin");
  c.say("Tuesday morning, please");
  c.say("Yes, that's right");
  assert.equal(c.state.stage, "options");
}

const bookings = (c) => c.log.filter((o) => o.type === "booked");

test("greeting identifies an automated assistant, the PIN promise and all three services", () => {
  const c = call();
  const greeting = c.log[0].text;
  assert.match(greeting, /automated assistant/);
  assert.match(greeting, /never ask for your PIN/);
  assert.match(greeting, /new address/);
  assert.match(greeting, /GP/);
  assert.match(greeting, /train ticket/);
  assert.equal(c.state.stage, "service");
});

test("successful booking: details checked, two options, one booking only after an explicit yes", () => {
  const c = call();
  toOptions(c);
  assert.equal(c.state.options.length, 2);
  assert.ok(c.state.options.every((o) => o.weekday === 2 && o.time < "12:00"));
  c.say("The first one, please");
  assert.equal(c.state.stage, "confirm");
  assert.equal(bookings(c).length, 0, "choosing an option must not book it");
  c.say("Yes, please book it");
  assert.equal(bookings(c).length, 1);
  assert.equal(c.state.stage, "notify");
  assert.match(c.state.booking.ref, /^CA-\d{6}$/);
});

test("details given up front are reused instead of asked again", () => {
  const c = call();
  c.say("I moved to Berlin and need to register my address, ideally Thursday afternoon");
  assert.equal(c.state.stage, "review");
  assert.equal(c.state.city, "berlin");
  assert.equal(c.state.day, 4);
  assert.equal(c.state.tod, "afternoon");
});

test("asking for help with an errand does not trigger the adviser", () => {
  const c = call();
  c.say("Can you help me register my new address?");
  assert.equal(c.state.handler, "assistant");
  assert.equal(c.state.stage, "city");
});

test("correction at review replaces the old detail and asks for a fresh review", () => {
  const c = call();
  c.say("I've moved and need to register my new address");
  c.say("Berlin");
  c.say("Tuesday morning, please");
  c.say("No, I'd rather go in the afternoon");
  assert.equal(c.state.stage, "review");
  assert.equal(c.state.tod, "afternoon");
  assert.match(c.lastSaid(), /afternoon/);
});

test("changing the preference at the final check clears the selection and books nothing", () => {
  const c = call();
  toOptions(c);
  c.say("The first one");
  c.say("Yes, but in the afternoon");
  assert.equal(bookings(c).length, 0);
  assert.equal(c.state.stage, "options");
  assert.equal(c.state.selection, null);
  assert.ok(c.state.options.every((o) => o.time > "12:00"));
});

for (const reply of ["No", "No, not that one", "Don't book it", "Wait, stop", "I'm not sure", "Hmm", "maybe"]) {
  test(`"${reply}" at the final check cannot create a booking`, () => {
    const c = call();
    toOptions(c);
    c.say("The second one");
    c.say(reply);
    assert.equal(bookings(c).length, 0);
  });
}

for (const reply of ["Nein", "Nicht buchen", "Nein, lieber nicht", "Ja, aber lieber nachmittags"]) {
  test(`German "${reply}" at the final check cannot create a booking`, () => {
    const c = call("de");
    toOptions(c, "Ich bin umgezogen und muss meine neue Adresse anmelden");
    c.say("Den zweiten");
    c.say(reply);
    assert.equal(bookings(c).length, 0);
  });
}

test('"Yes, I understand" at the final check books rather than transferring', () => {
  const c = call();
  toOptions(c);
  c.say("The first one");
  c.say("Yes, I understand. Book it.");
  assert.equal(bookings(c).length, 1);
  assert.equal(c.state.handler, "assistant");
});

test("repeated confirm events cannot create duplicate bookings", () => {
  const c = call();
  toOptions(c);
  c.say("The first one");
  c.say("Yes");
  c.say("Yes");
  c.say("Yes");
  assert.equal(bookings(c).length, 1);
});

const stagesToTry = {
  service: () => {},
  city: (c) => c.say("I've moved and need to register my new address"),
  pref: (c) => { c.say("I've moved and need to register my new address"); c.say("Berlin"); },
  review: (c) => { c.say("I've moved and need to register my new address"); c.say("Berlin"); c.say("Tuesday morning"); },
  options: (c) => toOptions(c),
  confirm: (c) => { toOptions(c); c.say("The second one"); },
  notify: (c) => { toOptions(c); c.say("The second one"); c.say("Yes"); }
};
for (const [stage, reach] of Object.entries(stagesToTry)) {
  for (const trigger of ["I don't understand", "Can I speak to a person?"]) {
    test(`handoff at ${stage} via "${trigger}" preserves progress`, () => {
      const c = call();
      reach(c);
      assert.equal(c.state.stage, stage);
      const before = { service: c.state.service, city: c.state.city, tod: c.state.tod, selection: c.state.selection, booking: c.state.booking };
      c.say(trigger);
      assert.equal(c.state.handler, "adviser");
      assert.equal(c.state.stage, stage);
      assert.deepEqual({ service: c.state.service, city: c.state.city, tod: c.state.tod, selection: c.state.selection, booking: c.state.booking }, before);
      assert.ok(c.log.some((o) => o.type === "handler" && o.handler === "adviser"));
    });
  }
}

test("the adviser still needs an explicit yes before booking", () => {
  const c = call();
  toOptions(c);
  c.say("The first one");
  c.send({ type: "person" });
  assert.equal(c.state.handler, "adviser");
  assert.equal(c.state.stage, "confirm");
  c.say("hmm");
  assert.equal(bookings(c).length, 0);
  c.say("Yes");
  assert.equal(bookings(c).length, 1);
});

test("one unrecognised reply is rephrased; a second hands over to the adviser", () => {
  const c = call();
  c.say("blue elephant");
  assert.equal(c.state.handler, "assistant");
  assert.match(c.lastSaid(), /new address/);
  c.say("purple giraffe");
  assert.equal(c.state.handler, "adviser");
});

test("unsupported city is explained honestly and never produces availability", () => {
  const c = call();
  c.say("I've moved and need to register my new address");
  c.say("I've moved to Hamburg");
  assert.equal(c.state.stage, "city");
  assert.equal(c.state.options.length, 0);
  assert.match(c.lastSaid(), /doesn't work in Hamburg/);
  assert.match(c.lastSaid(), /Düsseldorf, Munich and Frankfurt/);
  c.say("No");
  assert.equal(c.state.handler, "adviser");
  c.say("No");
  assert.equal(c.state.stage, "more");
  assert.equal(bookings(c).length, 0);
});

test("unsupported service and banking are declined with the list of real services", () => {
  const c = call();
  c.say("I need a new passport");
  assert.match(c.lastSaid(), /can't help with that yet/);
  c.say("Can you do my online banking?");
  assert.match(c.lastSaid(), /doesn't do banking/);
  assert.equal(bookings(c).length, 0);
});

test("weekend requests for offices are refused", () => {
  const c = call();
  c.say("I've moved and need to register my new address");
  c.say("Berlin");
  c.say("Saturday morning");
  assert.equal(c.state.stage, "pref");
  assert.match(c.lastSaid(), /closed at the weekend/);
});

test("credentials are removed before reaching the transcript", () => {
  const c = call();
  c.say("my PIN is 4711");
  const callerLines = c.log.filter((o) => o.type === "caller");
  assert.equal(callerLines.length, 1);
  assert.ok(!callerLines[0].text.includes("4711"));
  assert.ok(callerLines[0].redacted);
  assert.match(c.log.filter((o) => o.type === "say").slice(-2)[0].text, /never ask/);
});

test("postal yes and phone-only both complete the call", () => {
  for (const [reply, postal] of [["Yes, please send a letter", true], ["No, the phone is enough", false]]) {
    const c = call();
    toOptions(c);
    c.say("The first one");
    c.say("Yes");
    c.say(reply);
    assert.equal(c.state.booking.postal, postal);
    assert.equal(c.state.stage, "more");
    c.say("No, that's all. Thank you!");
    assert.equal(c.state.ended, true);
  }
});

test("train flow: destination, options with arrival times, booking", () => {
  const c = call();
  c.say("I'd like a train ticket to Hamburg");
  assert.equal(c.state.destination, "hamburg");
  assert.equal(c.state.stage, "origin");
  c.say("From Berlin");
  assert.equal(c.state.stage, "pref");
  c.say("Friday afternoon");
  c.say("Yes");
  assert.equal(c.state.options.length, 2);
  assert.ok(c.state.options.every((o) => o.arrival && o.weekday === 5 && /^(ICE|IC|EC)/.test(o.train)));
  const second = c.state.options[1].time;
  c.say(`The ${second} one`);
  assert.equal(c.state.selection.time, second);
  c.say("Yes");
  assert.equal(bookings(c).length, 1);
});

test("train to an unsupported destination is refused", () => {
  const c = call();
  c.say("I want to take the train to Rostock");
  assert.equal(c.state.stage, "destination");
  assert.match(c.lastSaid(), /can't book trains to Rostock/);
});

test("doctor flow mentions 112 and an emergency is redirected", () => {
  const c = call();
  c.say("I need an appointment with my doctor");
  assert.ok(c.log.some((o) => o.type === "say" && /112/.test(o.text)));
  c.say("Actually I have chest pain");
  assert.match(c.lastSaid(), /call 112/);
});

test("German flow from greeting to booking", () => {
  const c = call("de");
  assert.match(c.log[0].text, /Bürgeramt/);
  c.say("Ich bin umgezogen und muss meine neue Adresse anmelden");
  c.say("In Berlin");
  c.say("Am Dienstag vormittags, bitte");
  c.say("Ja, das stimmt");
  assert.equal(c.state.stage, "options");
  assert.match(c.lastSaid(), /Bürgeramt Rathaus Mitte/);
  c.say("Den ersten, bitte");
  c.say("Ja, bitte buchen");
  assert.equal(bookings(c).length, 1);
  c.say("Ja, bitte per Post");
  assert.equal(c.state.booking.postal, true);
});

test("the caller can switch language mid-call", () => {
  const c = call("en");
  c.say("Can we speak German please?");
  assert.equal(c.state.lang, "de");
  assert.match(c.lastSaid(), /Adresse/);
});

test("a second errand in the same call keeps the first booking", () => {
  const c = call();
  toOptions(c);
  c.say("The first one");
  c.say("Yes");
  c.say("No, the phone is enough");
  c.say("Yes, I also need a doctor's appointment");
  assert.equal(c.state.service, "doctor");
  assert.equal(c.state.bookings.length, 1);
});

test("hanging up ends the call and ignores later input", () => {
  const c = call();
  c.send({ type: "hangup" });
  c.say("I've moved");
  assert.equal(c.state.ended, true);
  assert.equal(c.state.service, null);
});

test("options fall in the next calendar week (Berlin time)", () => {
  const c = call();
  toOptions(c);
  assert.equal(c.state.options[0].date, "2026-09-29");
});

test('"Yes, can you give me the address?" before the options: promise the address, then look up', () => {
  const c = call("de");
  c.say("Ich brauche einen Termin bei meinem Hausarzt");
  c.say("In Berlin");
  c.say("Vormittags");
  c.say("Ja, können Sie mir die Adresse geben?");
  assert.ok(c.log.some((o) => o.type === "say" && /genaue Adresse nenne ich Ihnen gleich/.test(o.text)));
  assert.equal(c.state.stage, "options");
});

test("asking where the office is during the options gives the real addresses", () => {
  const c = call();
  toOptions(c);
  c.say("Where are they?");
  assert.match(c.lastSaid(), /Which would you like|Which one/);
  assert.ok(c.log.some((o) => o.type === "say" && /Karl-Marx-Allee 31/.test(o.text) && /John-F.-Kennedy-Platz 1/.test(o.text)));
  assert.equal(c.state.stage, "options");
});

for (const q of ["Yes, but what's the address?", "Ja, wo ist das denn?", "Yes, what do I need to bring?", "Yes, how much does it cost?", "Yes, how long will it take?"]) {
  test(`a question at the final check never books: "${q}"`, () => {
    const c = call(/Ja,/.test(q) ? "de" : "en");
    toOptions(c, /Ja,/.test(q) ? "Ich bin umgezogen und muss meine neue Adresse anmelden" : undefined);
    c.say(/Ja,/.test(q) ? "Den ersten" : "The first one");
    c.say(q);
    assert.equal(bookings(c).length, 0);
    assert.equal(c.state.stage, "confirm");
  });
}

test("answers about documents and cost use the real requirements", () => {
  const c = call();
  toOptions(c);
  c.say("What do I need to bring?");
  assert.ok(c.log.some((o) => o.type === "say" && /ID card or passport/.test(o.text)));
  c.say("Does it cost anything?");
  assert.ok(c.log.some((o) => o.type === "say" && /free of charge/.test(o.text)));
});

test('"Can you book it?" at the final check still books', () => {
  const c = call();
  toOptions(c);
  c.say("The first one");
  c.say("Yes, can you book it?");
  assert.equal(bookings(c).length, 1);
});

test('"Can you also register my address?" after a booking starts that errand', () => {
  const c = call();
  c.say("I need an appointment with my doctor");
  c.say("Berlin");
  c.say("Tuesday morning");
  c.say("Yes");
  c.say("The first one");
  c.say("Yes");
  c.say("No, the phone is enough");
  c.say("Can you also register my new address?");
  assert.equal(c.state.service, "address");
});

test("GP options use the real practice addresses", () => {
  const c = call();
  toOptions(c, "I need an appointment with my doctor");
  assert.match(c.lastSaid(), /Hausvogteiplatz 3/);
  assert.match(c.lastSaid(), /Bozener Straße 13/);
  c.say("Where is the second one?");
  c.say("The one at Medicover");
  assert.equal(c.state.selection.place, 0);
  c.say("Where is it?");
  assert.ok(c.log.some((o) => o.type === "say" && /Hausvogteiplatz 3–4, 10117 Berlin/.test(o.text)));
});

const E_TRAINS = E.constants.TRAINS;

test("address registration works in Düsseldorf, Munich and Frankfurt at the real offices", () => {
  for (const [city, street] of [["Düsseldorf", "Willi-Becker-Allee 7"], ["Munich", "Ruppertstraße 19"], ["Frankfurt", "Zeil 3"]]) {
    const c = call();
    c.say("I've moved and need to register my new address");
    c.say(city);
    c.say("Tuesday morning");
    c.say("Yes");
    assert.equal(c.state.stage, "options");
    assert.match(c.lastSaid(), new RegExp(street));
    c.say("Where is it?");
    assert.ok(c.log.some((o) => o.type === "say" && /^Both are at/.test(o.text)));
  }
});

test("GP appointments in the new cities use the verified practices", () => {
  for (const [city, street] of [["Düsseldorf", "Schadowstraße 71"], ["Munich", "Baldestraße 21"], ["Frankfurt", "Stiftstraße 14"]]) {
    const c = call();
    c.say(`I need an appointment with my doctor in ${city}`);
    c.say("Monday afternoon");
    c.say("Yes");
    assert.match(c.lastSaid(), new RegExp(street));
  }
});

test("the caller can say origin and destination in one sentence; options are real timetable trains", () => {
  const c = call();
  c.say("I'd like a train ticket from Düsseldorf to Munich");
  assert.equal(c.state.origin, "dusseldorf");
  assert.equal(c.state.destination, "munich");
  c.say("Wednesday morning");
  c.say("Yes");
  const real = E_TRAINS.dusseldorf.munich.weekday.morning;
  assert.equal(c.state.options[0].train, real[0].train);
  assert.equal(c.state.options[0].time, real[0].dep);
  assert.match(c.lastSaid(), new RegExp(real[0].train.replace(" ", " ")));
  const no = real[1].train.split(" ")[1];
  c.say(`The ICE ${no}, please`);
  assert.equal(c.state.selection.train, real[1].train);
});

test("German: Fahrkarte von München nach Berlin", () => {
  const c = call("de");
  c.say("Ich möchte eine Fahrkarte von München nach Berlin");
  assert.equal(c.state.origin, "munich");
  assert.equal(c.state.destination, "berlin");
  c.say("Am Samstag nachmittags");
  c.say("Ja");
  assert.equal(c.state.options[0].train, E_TRAINS.munich.berlin.saturday.afternoon[0].train);
  assert.match(c.lastSaid(), /ab München Hauptbahnhof/);
});

test("trains from an unsupported city and to the same city are refused honestly", () => {
  const c = call();
  c.say("A train from Hamburg to Munich please");
  assert.equal(c.state.stage, "origin");
  assert.match(c.lastSaid(), /can't book trains from Hamburg yet/);
  c.say("From Munich");
  assert.equal(c.state.stage, "destination");
  assert.match(c.lastSaid(), /same city/);
});
