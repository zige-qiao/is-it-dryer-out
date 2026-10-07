# Using Is it dryer out

[Open the app](https://zige-qiao.github.io/is-it-dryer-out/) · [Back to README](../README.md)

## Indoor readings and settings

Indoor readings opens on each full page load by default. Enter temperature and relative humidity using the rulers, arrow keys or numeric fields. Manual changes save immediately; **Done** closes the sheet. Use **Edit** on the Indoor card to reopen it.

The footer Settings sheet has three expanded groups. **Indoor readings** contains **Open Indoor readings on launch** (on by default), then **Show Indoor summary** (off). **Input buttons** contains **Show camera button** (on by default) and **Show voice button** (off); voice still requires browser support. Valid saved choices are preserved. **Camera** contains **Use still photos** (off), then **Auto flash** (on). Choices save immediately in this browser. Hiding entry buttons does not interrupt an open flow or remove Retake. The optional summary shows temperature, humidity, reading age, Edit and a microphone button where supported.

Open the ventilation summary below the chart to set minimum indoor temperature, target humidity, room size and window opening. Choose a room preset or enter custom dimensions; custom airflow is also available. These settings save immediately.

Sheets can be closed with Escape, a tap outside, or their existing Done actions. Below 640px, drag down from the handle or header to dismiss; header close buttons appear on larger screens. Focus returns to the opener without a highlight unless its keyboard focus indicator was visible when the sheet opened. The supporting **Why this recommendation?**, **Glossary**, **How estimates work** and **Weather data** sections explain the current result and terminology.

## Location and weather

Select the location name to search for a town or UK postcode, choose a recent place, or select **Use current location**. Postcodes accept either case, with or without spaces; outward codes such as `M1`, `M33` and `SW1A` also work.

On first use, the app requests device location. Later visits use the saved location. If permission is unavailable, it uses the last stored location or Sale, Greater Manchester as the initial fallback.

Use the refresh icon beside the checked time, or pull down from the page top on a touch device, to update outdoor weather. Pulls starting on buttons, links, form controls, the chart or rulers are ignored. **Refresh page** in the footer reloads the app and follows the launch preference.

## Reading the result

The recommendation compares indoor and outdoor moisture at the same reference temperature, accounting for uncertainty in the readings. **Why this recommendation?** explains whether outdoor air is drier and what drives the current result. When the difference is too small to be sure, it says so without presenting a numerical error calculation. **How estimates work** explains the main limitations and encourages fresh indoor readings during ventilation.

The cards show each reading's actual absolute humidity (AH) in grams per cubic metre; their colours reflect the shared-temperature comparison, so the colour need not follow the order of those two displayed numbers when the air temperatures differ. The **Let in** value estimates outdoor relative humidity after that air warms to the current indoor temperature.

The outlook starts at 48 hours and can switch to 24 hours. The curve shows actual outdoor AH against the actual indoor reference, and the bars show estimated air changes per hour (ACH). Along the curve, coral means reliably wetter, amber means within the uncertainty margin, and white means reliably drier after comparing air at the indoor temperature. Both ranges use the same 48-hour scales. Tap, drag or hover to inspect values; keyboard users can use arrow keys and Home/End.

## How opening times are estimated

Room volume, opening setup, forecast wind and the indoor–outdoor temperature difference determine estimated airflow. The app then simulates moisture and temperature minute by minute. Between hourly forecast points, humidity is derived from interpolated dew point.

The estimate stops when the humidity target is reached, the room would cool below its minimum, simulated room air reaches 100% humidity, or outdoor air stops being reliably drier. A room already below its minimum can still benefit from opening if the incoming air is warmer and reliably drier; the estimate stops if that room starts cooling again while still below its minimum. When both an estimated outcome time and a reliably drier period are shown, follow the earlier limit.

Useful drying can produce **OPEN WINDOWS** even when the target cannot be reached. The benefit check compares moisture before and after ventilation at the original indoor temperature and pressure. It requires at least a one-percentage-point reduction in this reference RH and a moisture reduction exceeding the existing uncertainty margin. This prevents cooling from hiding moisture removal and warming from being mistaken for drying. Reaching the target still uses the actual predicted RH during ventilation and the existing moisture-margin check. Small or uncertain reductions produce **OPEN IF NEEDED**; harmful conditions produce **KEEP CLOSED**. At temperature and saturation limits, the benefit check uses the last permitted state, before the limit is breached.

Cooling can keep the humidity reading high even while ventilation removes moisture. The reading may fall as the room warms again, provided moisture is not added or released back into the air. The reference-temperature comparison is not a prediction of when heating will restore the room temperature.

For **KEEP CLOSED**, **Why this recommendation?** adds the next suitable time to open windows for drying when one is found, explicitly assuming the indoor readings stay the same. The app checks each future minute up to 48 hours ahead, regardless of the chart's selected range, and applies the same ventilation settings and drying/temperature rules. Each candidate simulation uses at most three hours and stops at the end of available forecast coverage; it does not extend the last weather reading. The time is shown in the location's time zone, with tomorrow or the weekday when needed. Take fresh indoor readings before opening then. No future-time sentence is shown when no qualifying window is found or weather is unavailable.

If a room starts below its minimum, warmer outdoor air may allow a useful ventilation period. If that air subsequently starts cooling the room while it remains below its minimum, the verdict uses the existing useful-drying duration instead of claiming a time to reach the minimum temperature.

These are planning estimates, not measurements. Actual airflow depends on the building, window geometry, doors, wind and pressure differences. Forecast recommendations assume the current indoor readings remain unchanged until each displayed start time.

The model mixes moisture in the room's air and allows for a slower temperature response, but does not simulate moisture stored in walls, furniture or fabrics. Those materials can release moisture while the air dries and make humidity rise again after the windows close. Ongoing moisture from people, cooking, showers and drying clothes is not included. Active heating is not simulated either, so actual room temperature can behave differently from the estimate.

Higher humidity makes condensation more likely on cold windows and walls. The app checks whether room air reaches 100% humidity, but does not predict condensation on those colder surfaces. Condensation can form below 100% room humidity if a surface is cold enough; the app does not estimate surface temperatures.

The moisture comparison uses fixed uncertainty allowances: ±0.3°C and ±2 percentage points of indoor humidity, and ±0.5°C and ±3 percentage points of outdoor humidity. These are assumptions, not a guarantee of your sensor's or forecast's accuracy. The same allowances apply to every forecast hour; they do not increase further into the forecast. The humidity allowance means, for example, 60% ±2 points is 58–62%, not a 2% change in the reading. These allowances help identify unclear moisture differences; they do not cover every source of error in opening times.

Take fresh temperature and humidity readings during ventilation, and close the windows sooner if the room gets too cold. A reading after closing can also show whether humidity has risen again.

## Ventilation timer

On iPhone/iPad, tap a duration in either verdict line to open the timer sheet. Adjust the whole minutes with the ruler, arrow keys or numeric field (1-180 minutes), then choose **Start iPhone timer**. Timer adjustments are temporary and do not change your saved indoor readings or ventilation settings.

Before the first use, open the help popup beside the timer title and choose **Install Shortcut** to [add Ventilation Timer](https://www.icloud.com/shortcuts/d16fde94799a414bb11a3a40c484f080). Add it once and keep its name unchanged; the app passes a different duration each time. Starting a timer closes the sheet before switching to Shortcuts, which starts Apple's Clock timer. There is no automatic return to the originating browser or Home Screen app. If you cancel the handoff, the sheet stays closed.

The two verdict times can mean different things. A period of reliably drier outdoor air is not a recommendation to keep the windows open for that entire period. A capped estimate of more than three hours opens a 180-minute recheck reminder. Other platforms retain plain duration text.

Clock owns the alarm and cancellation after the handoff. The web app shows no countdown and cannot confirm that the timer started; check Clock after the first handoff and choose an audible timer sound rather than Stop Playing. The user confirmed the handoff from Safari and the Home Screen web app, and an alarm in airplane mode. See [timer development](timer-development.md) for test evidence and remaining gaps.

## Camera readings

In Indoor readings, tap the camera icon to take a new photo. The question-mark button beside **Take a photo** contains framing, sharpness and reflection guidance. Keep the monitor display visible, including the smaller temperature decimal. Recognition selects the current top readings and ignores the low and high records. The flash control is available while the camera is live if the device supports it. There is no album picker. The camera briefly waits for startup framing to settle before enabling capture; its notifications appear top-centre inside the preview. Choose **1×, 3× or 5×** in the bottom-centred preview pill; 1× uses the starting rear camera, while 3× and 5× select an explicitly identified telephoto camera when available. Switching between 3× and 5× adjusts that camera without reopening it. The latest selection wins during rapid taps; capture waits for the selected framing. The preview image blurs during switching; buttons and status remain sharp. This is a presentation effect and never changes captured or analysed pixels. Buttons start at 1× each time you retake and support keyboard activation. These multipliers describe camera selection and framing, not a guaranteed optical ratio. Camera zoom is used where available, otherwise a digital crop enlarges existing detail. The saved photo matches the 4:3 live preview, and capture waits until changed framing has rendered. Digital zoom cannot recover missing detail.

Choose **Take photo** to capture a fresh frame from the live camera by default, with **Capturing…** feedback. Turn on **Use still photos** in Settings for an actual still photo, with **Hold still — taking photo…** feedback. Both use the settled preview framing and then show **Reading numbers…**. Auto flash defaults on and chooses lighting after sustained low light. Frame mode keeps torch where supported; brighter still-photo flash requires still-photo mode. Manual flash overrides Auto for the session. Continuous torch switches off before a still photo. Both modes temporarily disable zoom, torch and duplicate shots. Failure offers retry or manual entry without silently changing capture mode. Browser support and the still photo field of view depend on the device. Then compare the recognised values with their straightened, contrast-normalised image crops. The large photo stays original. The question-mark button beside **Check readings** explains box editing and value correction; tap it or focus it with the keyboard to open help. Escape closes help before the sheet. Tap a value to correct it. Detected boxes include the numbers, decimal and complete °C/% unit. Drag a box to move it or a corner to resize it; release to read that region automatically. Draw directly on empty photo space to add a box. Its unit identifies the reading; if the unit is unreadable, choose the reading when asked or discard the box. A box containing both units needs tightening. Arrow keys move a focused box; Shift resizes and Alt makes smaller adjustments. Enter or Space on the photo creates a keyboard-editable box. A blank photo shows no detected boxes or invented values. The camera-icon **Retake** pill at the bottom-right cancels recognition, clears the image and drafts, and returns to capture at 1× using the saved capture preference. It remains available when the camera entry button is hidden. Recognition stops after at most ten seconds, keeping any validated reading and leaving unresolved fields empty. Temperature can be identified beside validated humidity on the same display even when °C is unreadable, but it still needs clear integer digits, a decimal and a fractional digit. Visible °F is rejected without conversion. If one reading cannot be recognised, that field stays empty. Small units, faint or clipped segments, reflections and conflicting processing results can leave a legible-looking reading unresolved. Try a closer, sharper photo or type the values.

The status box above the values uses blue for processing/information, green for valid values ready to review, amber when readings need attention, and red for recognition failure. Icons and wording explain each state. Green does not mean the values have been saved. **Confirm readings** saves both values and updates the recommendation. Values must be 10–45°C (at most one decimal place) and 10–90% RH (whole numbers). Before confirmation, results are drafts: Back, dismissal or leaving the app discards them. The temporary **From photo** label clears after a manual or voice update and is not retained after reload. **Done** closes the Indoor sheet.

LCD detection, unit identification and segment reading run locally in a worker, with an 800-pixel maximum analysis dimension. Photo geometry is checked before decoding to handle sideways, upside-down and supported diagonal views without motion-sensor permission. Supported shear and screen perspective correction improve angled images; display-local dark-foreground and adaptive contrast reduce uneven lighting; median grayscale evidence tolerates thin reflected streaks while uncertain segments stay blank. The smaller crops show the same corrected pixels used for recognition. Full fraction cells are checked against the original grayscale image. Obscured segments, conflicting orientations or conflicting readings remain unresolved. Scanning works offline after the app shell is cached; fresh outdoor weather still needs a connection. Photos are not saved or uploaded. Recognition targets Celsius/percent segmented displays; other displays may require manual entry.

Camera access needs HTTPS or localhost. If permission is blocked, allow Camera for this website in your browser settings and retry; check device permissions if necessary. Camera-unavailable and recognition failures offer a retry or **Enter manually**. The camera stops after capture and on dismissal or backgrounding. Scanning does not change the accepted foreground microphone-retention behaviour described below.

## Voice input

In supported browsers, choose the microphone icon in Indoor readings or the optional summary. Say, for example, “21 degrees, 55 percent” or “21 and 55”. Review the recognised changes and select **Apply**, or return **Back to manual**.

On iPhone, the app retains the microphone stream after a voice attempt while it remains in the foreground, including after Stop, Apply or closing the sheet. The microphone indicator may remain on, although transcription and waveform animation end separately. Leaving or backgrounding the app releases capture; reliable restarting after release remains unresolved.

The waveform meter does not save or upload an audio file. Browser speech recognition may use an external service. See the [voice investigation](voice/VOICE-INVESTIGATION.md) for device evidence and diagnostic instructions.

## Data and offline use

Indoor readings, ventilation settings, display preferences and saved locations are stored in your browser. Outdoor weather and forecast data come from Open-Meteo, with forecast times shown in the location's time zone. When device location is used, coordinates are sent to BigDataCloud to obtain a nearby locality name.

The app interface is cached for offline loading. Fresh outdoor weather and location lookup still need a connection.

Auto flash is on by default in Settings. It turns on preview lighting after sustained low light and requests flash for the still photo; manual flash control overrides it for the current camera session. Camera help links directly to this setting. Hold still while the photo is being taken. Preview messages sit alongside the flash button.

At 3× or above, the app selects an explicitly identified telephoto camera when available; below 3× it returns to the starting rear camera. Digital cropping supplies zoom beyond supported camera zoom. The multiplier is approximate and the phone may manage its physical lenses internally.
