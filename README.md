# CallAssist prototype

**Digital services, without going digital.** A launch-style product page (`index.html`) leads into a phone-call simulator (`call.html`). You call CallAssist and talk to it in natural English or German. It first lists its three services, then books a Citizens' Office appointment, a GP appointment or a train ticket for you. It checks before acting and hands over to a human adviser, Marina, whenever you ask or get stuck.

## Start it

- **Easiest:** double-click `start.command`. It serves the folder locally and opens Chrome, or Safari if Chrome isn't installed.
- **Manually:** run `python3 -m http.server 8765` in this folder, then open <http://localhost:8765>.
- Opening `index.html` directly as a file also works, but the browser may then ask for the microphone repeatedly or refuse it.

No install, no API keys and no personal data are needed. **Talking to CallAssist needs an internet connection**: Chrome and Edge send the caller's audio to Google's or Microsoft's speech service to turn it into text. Everything else, including tap-to-answer, works offline.

## Which browser

| Browser | Talking to CallAssist | CallAssist's voice |
|---|---|---|
| Chrome | Yes (allow the microphone once) | Yes |
| Safari (Mac) | Yes, but only with **Dictation turned on** (System Settings › Keyboard › Dictation). Without it, Safari refuses to listen and the page says so | Yes |
| Brave | **No.** Brave blocks the speech recognition this demo needs; the page says so and offers tap-to-answer replies | Yes |
| Microsoft Edge (Windows or Mac) | Yes (allow the microphone once); needs internet | Yes, including natural "Online" voices |
| Firefox | No; tap-to-answer replies | Yes |

Test on the presentation laptop beforehand. Voices come from the operating system. On this Mac the pairs are:
- English: the assistant is Daniel (British, male) and Marina is Samantha (female).
- German: the assistant is Reed (male, a little synthetic) and Marina is Anna (female).

Marina should sound like a person, so the prototype always prefers the high-quality voices when a device has them: the "Natural" voices in Microsoft Edge on Windows, and the "Premium" or "Enhanced" voices on a Mac. On a Mac, download them under System Settings › Accessibility › Spoken Content › System voice › Manage voices: **Ava (Premium)** or **Zoe (Premium)** for English, **Anna (Premium)** for German, and **Markus** or **Yannick** for a more natural German assistant. The prototype picks them up automatically, and it always gives the assistant and Marina different voices.

## What the call can do

- **Services, listed at the start:** register a new address or book a GP appointment in **Berlin, Düsseldorf, Munich or Frankfurt**, at real Citizens' Offices and GP practices (addresses checked on their own websites), or book a train from one of those four cities to Germany's big cities using **real ICE numbers and scheduled times** from the published Deutsche Bahn timetable (`trains.js`, typical weekday, Saturday and Sunday in October 2026).
- **Natural answers:** the caller can say everything at once ("I moved to Berlin and need to register, Thursday afternoon"). CallAssist reuses whatever it has already heard and only asks for what's missing.
- **Checks before acting:** CallAssist reads the request back and offers two options. Choosing an option doesn't book it. Booking needs a clear yes, and "no", "wait", "don't book it" or "yes, but in the afternoon" never book.
- **Human adviser:** "Speak to a person", "I don't understand", the **person** button, or two misunderstood replies in a row put the caller on hold and connect them to Marina. Marina already sees everything said so far and uses shorter questions.
- **Honest limits:** cities other than Berlin, unsupported destinations, weekends, banking, passports and similar requests are declined with an explanation. Nothing is ever invented.
- **Safety:** CallAssist states at the start that it never asks for a PIN or password. If the caller says one, the line is removed before it reaches the transcript. Medical emergencies are directed to 112.
- **Confirmation:** a reference number, the details read back, and a sample confirmation letter on request.
- **Controls:** mute, replies (tap-to-answer), speaker, slower speech, speak to a person, repeat, end call. "Larger text" in the top bar enlarges the transcript and replies (also `call.html?text=large`). Switch between EN and DE at any time, or say "Can we speak German?" during the call.

Simulated: the phone number, the free appointment times, the bookings and Marina. Real: the office and practice addresses, and the train numbers and timetable times. The Citizens' Office and GP practice locations are real. Nothing is stored or sent; the call exists only in the open browser tab.

## Files

| File | Purpose |
|---|---|
| `index.html`, `landing.css`, `landing.js` | Product page (English and German) |
| `call.html`, `call.css`, `call.js` | Phone-call simulator: speech in and out, tones, transcript, letter |
| `engine.js` | Conversation logic, with no page code; shared by the simulator and the tests |
| `tests/engine.test.js` | 48 scenario tests: `node --test tests/` |
| `docs/presenter-script.md` | Three-minute demo plus a one-minute handover demo |
| `docs/verification.md` | What was tested and the known limits |
| `docs/screenshots/` | Active call, human assistance, completed appointment, letter, product page |

**Answering:** CallAssist listens automatically after each question; the green bar shows "Your turn". To answer before it finishes speaking, for example during the greeting, tap the bar or press Space. While the microphone works, the reply buttons are folded away under "Show reply buttons"; they open by themselves if voice input isn't available.

Useful address options: `call.html?lang=de` (German), `?mute` (captions only, no sound).
