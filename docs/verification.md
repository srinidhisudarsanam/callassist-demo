# Verification summary (26 September 2026)

## Automated: `node --test tests/` (48 of 48 pass)

| Check | Result |
|---|---|
| Greeting says the assistant is automated, gives the PIN promise and lists all three services | Pass |
| Successful booking: details checked, two matching options, one booking only after an explicit yes | Pass |
| Details given up front are reused, not asked again | Pass |
| "Can you help me register…" does not transfer to the adviser | Pass |
| Correction at review replaces the old detail and triggers a fresh review | Pass |
| "No", "No, not that one", "Don't book it", "Wait, stop", "I'm not sure", "maybe", "Hmm" never book | Pass |
| German "Nein", "Nicht buchen", "Nein, lieber nicht", "Ja, aber lieber nachmittags" never book | Pass |
| "Yes, but in the afternoon" clears the selection and looks again | Pass |
| "Yes, I understand. Book it." books; it is not treated as confusion | Pass |
| Repeated yes events create exactly one booking | Pass |
| Handoff via "I don't understand" or a person request at all 7 active stages keeps progress and changes the speaker | Pass |
| The adviser still requires a clear yes | Pass |
| One unrecognised reply is rephrased; a second hands over to the adviser | Pass |
| Unsupported city, destination, weekend, banking and passport requests: honest answer, no availability invented | Pass |
| A PIN is removed before it reaches the transcript, followed by the safety message | Pass |
| Postal letter and phone-only both complete; a second errand in the same call works | Pass |
| Train and doctor flows, 112 emergency redirect, German flow, language switch mid-call, hang-up | Pass |

## In the browser (headless Brave 1.95, driven by script)

- Complete English call from dialling to the end screen, including the handover to Marina at the final check and the confirmation letter: no script errors.
- German train call: "Ja, aber lieber nachmittags" books nothing and offers new afternoon trains. Hanging up and calling again starts a clean call.
- Product page and call page at 390 px phone width: no sideways scrolling.
- Light and dark mode both checked in screenshots.
- Voice path, using a simulated recogniser: interrupting the greeting with the bar, three spoken answers in a row, and a sentence that ends without a "final" mark (a Safari behaviour) is still accepted. Reply buttons stay folded while the microphone works.

## Known limits

- **Speech recognition** works in Chrome and Safari only. Brave (blocked by Brave) and Firefox (not supported) fall back to tap-to-answer replies, and the page says so. Live microphone input could not be tested automatically; try it on the presentation laptop.
- **Voices** depend on the device. On this Mac the German assistant voice (Reed) sounds synthetic; installing Markus or Yannick fixes that.
- Understanding is rule-based: it covers many everyday phrasings in English and German, but it is not a general AI. Unusual wording gets one rephrased question, then the adviser.
- Appointment and train times are simulated for next week (Berlin time). The Citizens' Office addresses are real.
