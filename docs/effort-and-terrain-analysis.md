# Efforts and terrain

Updated 29 October 2026. The activity summary uses a shared timeline for detected efforts, climbs and recorded laps. Selecting a section highlights the same elapsed sample interval on the chart and recorded GPS route. A focused chart retains context around the section; explicit map fitting preserves GPS gaps. Compact and expanded profiles share the current data revision and controls.

## Automatic sections

Running defaults to recorded speed, shown as pace. Cycling prefers power, then heart rate. Cycling with speed alone is labelled **Fast sections**, including copied messages: downhill speed is not a measure of exertion. Users can choose another available detection source.

| Source | Target smoothing | Minimum section |
| --- | ---: | ---: |
| Running/walking/hiking speed | 6 seconds | 20 seconds |
| Cycling/other speed | 10 seconds | 30 seconds |
| Power | 15 seconds | 30 seconds |
| Heart rate | 15 seconds | 60 seconds |

Smoothing rounds up to whole samples; minimum section duration is at least three samples. Automatic sections require samples no more than 10 seconds apart. The cutoff and lower release threshold follow the recording's signal contrast. Lower/upper session levels handle typical repeats; sustained extrema handle rare surges, mostly-work recordings and sustained zero recovery. Minimum contrast rejects steady recordings and minor noise. This estimates recorded signal sections, not training intent, physiological capacity or prescribed zones.

Missing primary samples, primary zeros and distance resets break sections. Heart-rate detection also checks recorded stops because HR recovery can lag. Positive stationary cycling power is retained for indoor trainers. Brief positive dips can remain within an otherwise sustained section. Boundaries use original sample times, rather than trailing smoothing times.

## Climbs

Both activity profiles and cycling analyses use the same detector. Climbs need recorded elevation and cumulative distance, with samples no more than 15 seconds apart.

| Sport | Minimum time | Net gain | Moving distance | Gradient requirement |
| --- | ---: | ---: | ---: | ---: |
| Running/walking/hiking | 30 seconds | 5 m | 60 m | 0.5% |
| Cycling · whole climb | 60 seconds | 20 m | 150 m | 1% |
| Cycling · steep sections | 30 seconds | 10 m | 100 m | Local cutoff · 3% default |

Short-bin and neighbouring median smoothing suppress isolated elevation spikes. Valley-to-peak detection tolerates small dips relative to the accumulated rise, plus brief moving flats. Stationary distance, gaps, resets, implausible elevation jumps and substantial descents separate sections. Shallow sustained road climbs can qualify. Gain is the smoothed net rise between detected boundaries, not an invented total ascent or a climb category.

Running includes sustained small hills, which can add up to meaningful ascent without any one rise reaching ten metres. Leading flats are trimmed to the last valley-level sample so a brief elevation step cannot borrow the flat's duration and qualify as a climb. The time, distance, source-quality and noise checks still apply; cycling thresholds are unchanged. A no-climbs result names the actual thresholds used. Total workout ascent can differ from the sum of detected net rises.

Cycling profiles default to **Steep sections**, trimming gentle approaches and tails and splitting sections at flats using the local smoothed gradient over roughly 50 m. The cutoff can be 2%, 3%, 4%, 5%, 6% or 8%; **Whole climb** retains the valley-to-peak view. Climb bounds and the steep-mode cutoff are available directly in the compact Summary card. The cycling Climbs tab remains available at zero detections so the settings can still be adjusted. Empty climb comparisons stay hidden; recorded-lap statistics remain accessible even when none of the laps can be aligned. Mode and cutoff are remembered on the device. Changing them clears the selected section and recomputes chart/map bounds, duration, distance, power, HR, gain, average gradient and copied text. The displayed section-average gradient is distinct from the local detection cutoff. These cycling controls do not change the running defaults or recorded laps. The data API defaults to whole climbs for callers that supply no options.

## Display and comparison

Cards show output or climb gain/gradient alongside duration. Users can order sections by time, duration, output or climb gain, move between sections, focus the timeline, compare all sections and fit the selected route. Detection requirements and chart scales stay behind a disclosure.

The activity summary keeps the route and analysis together: a compact pinned map on phones, and adjacent map/profile columns on larger screens. Selecting a compact card updates the map and chart without moving the scroll position. Small section cards, one-row climb controls and a shorter chart leave room for both terrain and output; expanded map/profile views keep their full controls and larger charts. Map pinning ends with the analysis section so later workout metrics remain readable.

Selecting an effort, climb or lap automatically centers its recorded GPS bounds, one zoom level wider than the explicit **Fit section** action (twice the surrounding span). Manual pan, zoom and whole-route reset remain in place through unrelated chart/control updates. Choosing another section or deliberately tapping the same section again restores contextual framing. Missing or stationary GPS cannot trigger a fit. Expanded maps start with the selected section's contextual view and retain independent navigation.

Lap cards and comparison rows select the same chart and map interval. When a watch appends timed laps without distance after the sampled activity, the complete distance-bearing prefix can still be selected if its distance covers the sensor stream and its timers account for active time. The unmatched laps retain their recorded metrics in the full table, marked **No route**. Missing middle laps, unexplained time, distance resets and merged gaps cannot be reconciled this way. Distance boundaries remain approximate at the sensor sample resolution.

Segment averages weight partial boundary samples by their overlap. Power and speed zeroes remain recorded values; nonpositive HR, cadence and step length are missing. Distance requires complete monotonic cumulative evidence or complete recorded speed integration; gaps and resets are not bridged. Recorded lap duration, distance and valid means retain precedence, including copied lap durations. Normalized power remains an estimate with its existing complete-data requirements.

## Verification

Run `npm run test:efforts` and `npm run typecheck`. Regression fixtures cover majority-work and rare intervals, original boundaries, short recovery, zeros and pauses, missing/coarse streams, shallow and rolling climbs, stationary drift, spikes, resets, long streams, shared climb outputs, weighted averages, recorded-lap precedence, GPS fitting and sharing labels. Fixtures are synthetic; no private activity data is committed.

Browser QA covers running and cycling at phone and desktop widths, card/table navigation, timeline focusing and tapping, available detection sources, compact/expanded state, live same-session enrichment and route fitting. These checks do not establish detection accuracy against a labelled athlete dataset.
