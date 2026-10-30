# Research notes

Findings from web searches (October 2026). Verify before relying on them; many sources are forum posts.

## Walmart cart hand-off
- No confirmed Walmart "add to cart" URL or consumer cart API. A vendor says Walmart has
  [no official API for buying on a user's behalf](https://www.zinc.com/blog/walmart-api) (vendor has a commercial interest; not checked on Walmart's own portal).
- Current approach stays: copy list, share, per-item Walmart search links.
- Idea to test later: Claude driving a logged-in browser on a computer, with Kevin reviewing and paying.

## Open smartwatch options (for a "MyLife watch")
| | Bangle.js 2 | PineTime | Pebble (Rebble/Core Devices) |
|---|---|---|---|
| Software | JavaScript apps (Espruino), open source | C++ firmware (InfiniTime), hard to add apps | Open firmware and SDK |
| Rough price | $100-130 | $27-35 | $199-225 (unconfirmed) |

- Bangle.js 2 talks to Android through [Gadgetbridge](https://gadgetbridge.org/gadgets/wearables/banglejs/); sending custom data needs our own code.
- [Notes comparing the watches](https://notes.nicolasdeville.com/interests/programmable-smartwatch/).

## Health sensing on DIY watches (important)
- **Heart rate:** Bangle.js 2 has an optical sensor (VC31B); users report accuracy problems at times. No published accuracy data.
  PineTime's sensor (HRS3300) uses community-written algorithms. Neither is a medical device.
  See the [Espruino heart rate algorithm thread](https://github.com/orgs/espruino/discussions/7232).
- **SpO2:** not supported in the official Bangle.js 2 firmware (the sensor's SpO2 function needs a binary blob that is not included).
  PineTime's stock sensor is not an SpO2 sensor. A valid pulse oximeter should meet about 4% error (ISO 80601-2-61); wrist devices often miss that.
- **Blood pressure:** cuffless watch BP is not reliable yet. The
  [2022 smartwatch BP study](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9309348/) found insufficient accuracy, and the
  [Cedars-Sinai overview](https://webflow-prod.cedars-sinai.org/stories-and-insights/healthy-living/can-a-smartwatch-really-detect-hypertension)
  notes Apple's FDA-cleared feature is a hypertension *notification*, not a BP reading.
- **Irregular rhythm / AFib:** needs a validated algorithm (and for ECG, hardware). A DIY watch has neither. Do not build or present this as a medical alert.
- Apple Watch requires an iPhone, so it is not an option with Android.

## Recommended design
- Source of truth for BP and SpO2 stays a validated device (upper-arm cuff, fingertip oximeter).
- MyLife logs those readings (typed or voice now; Bluetooth/Health Connect later), plus watch heart rate and alarms.
- Android [Health Connect](https://developer.android.com/health-and-fitness/health-connect/data-types) has record types for blood pressure, heart rate and oxygen saturation,
  but only a native Android app can read or write them (not the web app). Gadgetbridge can sync heart rate and SpO2 to it
  ([docs](https://gadgetbridge.org/basics/integrations/health-connect/)).

## Buying a Bangle.js 2 (checked Oct 2026; confirm price, stock and shipping at checkout)
- Official shop: https://shop.espruino.com/banglejs2 (listed about GBP 99.60 incl. tax; US shipping and duties not confirmed).
- Adafruit (US): https://www.adafruit.com/product/5427 (listed $149.95; stock not confirmed).
- Pimoroni lists it as retired; The Pi Hut ships it within the UK only (lithium battery rules).
- No Bangle.js 3 announced; Espruino's developer said no new Bangle is planned soon, so Bangle.js 2 is the current model.

## Voice on the watch
- Bangle.js 2 has no speaker (alerts are vibration, and any beep is very quiet) and appears to have no microphone
  ([forum thread](https://forum.espruino.com/conversations/367097); not an official spec). The case cannot be opened to add one.
- Voice input therefore stays on the phone (mic buttons in the MyLife web app use Chrome's speech recognition).

## Mainstream programmable watches (researched Oct 2026; verify specs and prices on maker sites, many sources are listicles)
- **Wear OS (Google Pixel Watch 3/4, Samsung Galaxy Watch 7/8, Galaxy Watch FE ~ $149):** real apps in Kotlin/Android Studio; full-color AMOLED.
  Heart rate is readable via the Health Services API ([guide](https://developer.android.com/health-and-fitness/fitness/basic-app/integrate-wear-os)); SpO2, microphone and standalone behavior NOT confirmed in research.
  [Wareable Android watch roundup](https://www.wareable.com/smartwatches/best-android-watch).
- **Samsung:** ECG and irregular rhythm notifications are FDA-cleared. Blood pressure launched in the US on 2026-03-31 but Samsung says it is a wellness feature, not FDA-cleared,
  and needs upper-arm-cuff calibration every 28 days ([Samsung](https://news.samsung.com/us/samsung-blood-pressure-monitoring-feature-available),
  [Android Headlines](https://www.androidheadlines.com/2026/04/samsung-galaxy-watch-blood-pressure-tool-arrives-in-us-without-fda-approval.html)).
  TO VERIFY: Samsung Health Monitor (ECG/BP) may require a Samsung phone.
- **Amazfit / Zepp OS:** JavaScript mini apps, has BloodOxygen and HeartRate sensor modules, background services ([docs](https://docs.zepp.com/docs/guides/framework/device/intro/)). Not clinically validated. Prices not checked.
- **Garmin Connect IQ:** Monkey C; heart rate live, SpO2 via SensorHistory on supported devices ([forum](https://forums.garmin.com/developer/connect-iq/f/discussion/225090/connectiq-oxygen-spo2-level-reading)).
- **Withings ScanWatch 2:** FDA-cleared ECG (AFib detection) and SpO2, Android and Health Connect compatible, about $350-370; not programmable
  ([Withings](https://www.withings.com/us/en/scanwatch-2/38b/shop)).
- Note: measurements from maker apps (ECG, irregular rhythm) probably cannot be read by our app directly; plan to read what Health Connect exposes. Unverified.
- Correction to earlier note: Samsung now offers cuff-calibrated BP in the US, but it is wellness-only and not FDA-cleared; keep the upper-arm cuff as the source of truth.
