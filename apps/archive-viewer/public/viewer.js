'use strict';
const $ = id => document.getElementById(id);
const number = value => Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
const words = value => String(value ?? 'Not recorded').replaceAll('-', ' ').replaceAll('_', ' ');
const node = (tag, text, className) => { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; if (className) element.className = className; return element; };
let session, view, observer = 'asset', tick = 0, fullMap = false, selected = null, bounds, requestId = 0, controller, playing = false, playTimer, sliderTimer;
const canvas = $('map');
const context = canvas.getContext('2d');
function time(value) { const seconds = value * (session?.tick_ms ?? 100) / 1000; return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${(seconds % 60).toFixed(1).padStart(4, '0')}`; }
function evidence(value) { const details = node('details'); details.append(node('summary', 'View recorded evidence')); details.addEventListener('toggle', () => { if (details.open && details.childElementCount === 1) details.append(node('pre', JSON.stringify(value, null, 2))); }); return details; }
function empty(container, text) { container.replaceChildren(node('p', text, 'empty')); }
function pause() { playing = false; clearTimeout(playTimer); clearTimeout(sliderTimer); $('play').replaceChildren(node('span', '▶ Play')); $('play').setAttribute('aria-label', 'Play event steps'); }
function fail(error) {
  pause();
  if (view) { tick = view.tick; observer = view.observer; $('timeline').value = String(tick); $('time').textContent = time(tick); $('tick').textContent = `Tick ${number(tick)}`; render(); }
  $('error').hidden = false; $('error').textContent = `Unable to display the requested archive view. ${error.message}${view ? ` Still showing ${view.observer === 'asset' ? 'rover' : 'mission control'} knowledge at tick ${number(view.tick)}.` : ''}`;
  $('verification').textContent = 'View request failed'; $('verification').className = 'badge failed'; $('workspace').setAttribute('aria-busy', 'false');
}
async function json(url, signal) { const response = await fetch(url, { signal, cache: 'no-store' }); const data = await response.json(); if (!response.ok || data.error) throw new Error(data.error || `Request failed (${response.status})`); return data; }
async function load(at = tick, requestedObserver = observer) {
  const requestedTick = Math.max(0, Math.min(session.max_tick, Math.round(Number(at) || 0)));
  const id = ++requestId; controller?.abort(); controller = new AbortController();
  $('workspace').setAttribute('aria-busy', 'true'); $('timeline').value = String(requestedTick); $('tick').textContent = `${view ? `Showing tick ${number(view.tick)} · ` : ''}loading ${requestedObserver === 'asset' ? 'rover' : 'mission'} tick ${number(requestedTick)}…`;
  try {
    const next = await json(`/api/view?tick=${requestedTick}&observer=${requestedObserver}`, controller.signal);
    if (id !== requestId) return;
    view = next; tick = next.tick; observer = next.observer; $('error').hidden = true; $('workspace').setAttribute('aria-busy', 'false'); $('timeline').value = String(tick); $('time').textContent = time(tick); $('tick').textContent = `Tick ${number(tick)}`;
    $('verification').textContent = '✓ Verified complete archive'; $('verification').className = 'badge verified';
    render();
    if (playing) { if (view.next_tick !== null && view.next_tick > tick) playTimer = setTimeout(() => load(view.next_tick), 1100); else pause(); }
  } catch (error) { if (error.name !== 'AbortError' && id === requestId) fail(error); }
}
function render() {
  $('asset').setAttribute('aria-pressed', String(observer === 'asset')); $('mission').setAttribute('aria-pressed', String(observer === 'mission'));
  $('map-title').textContent = observer === 'asset' ? 'Rover view' : 'Mission control view';
  $('perspective-note').textContent = observer === 'asset' ? 'Onboard knowledge at this time. Evidence can reach mission control later.' : 'Only evidence received by mission control at this time.';
  $('state').textContent = words(view.state);
  $('state-note').textContent = observer === 'asset' ? 'Latest recorded onboard state visible at this time.' : 'Latest state reported to mission control; the rover may already have moved on.';
  const budget = view.budget;
  $('duration').textContent = budget ? time(budget.duration_ticks) : '—'; $('travel').textContent = budget ? `${number(budget.traverse_mm / 1000)} m` : '—';
  $('energy').textContent = budget ? `${number(budget.energy_units)} units` : '—'; $('bytes').textContent = budget ? `${number(budget.tier2_bytes / 1000)} kB` : '—';
  $('coverage').textContent = `${number(view.counts.known)} known · ${number(view.counts.sensed)} sensed · ${number(view.counts.obstacles)} obstacles`;
  $('cell-row').max = String(view.grid.rows - 1); $('cell-column').max = String(view.grid.columns - 1);
  $('next').disabled = view.next_tick === null; $('previous').disabled = view.previous_tick === null;
  renderDecisions(); renderObservations(); renderEvents(); draw(); if (selected) inspect(selected.row, selected.column);
  $('announcement').textContent = `${observer === 'asset' ? 'Rover' : 'Mission control'}, ${time(tick)}, ${words(view.state)}. ${view.observations.length} visible observations.`;
}
function renderDecisions() {
  const target = $('decisions'); target.replaceChildren();
  const decisions = view.events.filter(event => ['contestation-opened', 'alternative-accepted'].includes(event.event_type));
  if (!decisions.length) return empty(target, 'No decision changes visible yet. Advance time to follow the record.');
  for (const event of decisions.slice().reverse()) {
    const payload = event.payload; const card = node('article', undefined, 'decision');
    card.append(node('span', `Occurred ${time(event.occurred_tick)}${event.received_tick != null ? ` · received ${time(event.received_tick)}` : ''}`, 'time-label'));
    if (event.event_type === 'alternative-accepted') {
      const offer = view.events.find(item => item.event_type === 'contestation-opened' && item.payload.contestation_id === payload.contestation_id);
      const alternative = offer?.payload.alternatives?.find(item => item.alternative_id === payload.alternative_id);
      card.append(node('h3', 'An offered alternative was accepted'), node('p', alternative ? `The team selected ${words(alternative.kind)}${alternative.proposed_cell ? ` at cell ${alternative.proposed_cell.row}, ${alternative.proposed_cell.column}` : ''}.` : 'The recorded selection is available in the evidence below.'));
    } else {
      card.append(node('h3', payload.level === 0 ? 'Stop first. Respond locally.' : payload.level === 2 ? 'Pause and offer another way.' : 'The rover raised a concern.'));
      card.append(node('p', payload.level === 0 ? `The ${words(payload.hazard_class)} hazard left ${number(payload.time_to_harm_ticks)} ticks to harm. The communication round trip is ${number(payload.round_trip_ticks)} ticks.` : `A ${words(payload.hazard_class)} concern triggered ${words(payload.disposition)}. The science objective can be pursued through the offered alternatives.`));
      if (payload.alternatives?.length) { const list = node('ul'); for (const alternative of payload.alternatives) { const delta = alternative.budget_delta; list.append(node('li', `${words(alternative.kind)}${alternative.proposed_cell ? ` at cell ${alternative.proposed_cell.row}, ${alternative.proposed_cell.column}` : ''}${delta ? ` · ${delta.energy_units >= 0 ? '+' : ''}${number(delta.energy_units)} energy units` : ''}`)); } card.append(list); }
    }
    card.append(evidence(payload)); target.append(card);
  }
}
function renderObservations() {
  const target = $('observations'); target.replaceChildren();
  const routine = item => !item.measurements?.length && ['local-sweep', 'obstacle-range'].includes(item.observation_type);
  const recent = ['local-sweep', 'obstacle-range'].flatMap(type => view.observations.filter(item => item.observation_type === type && routine(item)).slice(-3));
  const shown = view.observations.filter(item => !routine(item) || recent.includes(item));
  $('observation-count').textContent = `${shown.length} / ${view.observations.length}`;
  if (!view.observations.length) return empty(target, 'No observations available to this observer yet.');
  target.append(node('p', 'Measurements and science, plus the latest three routine sweeps and range checks of each type. Counts show displayed / total visible.', 'fine'));
  for (const observation of shown.slice().reverse()) {
    const card = node('article', undefined, 'observation');
    card.append(node('span', `Observed ${time(observation.observed_tick)}${observation.received_tick != null ? ` · received ${time(observation.received_tick)}` : ''}`, 'time-label'), node('h3', words(observation.observation_type)));
    if (observation.measurements?.length) { const list = node('dl', undefined, 'measurements'); for (const measurement of observation.measurements) list.append(node('dt', words(measurement.name)), node('dd', `${String(measurement.value)} ${measurement.unit === 'boolean' || measurement.unit === 'class' ? '' : measurement.unit}`)); card.append(list); }
    else card.append(node('p', `${number(observation.footprint_cells?.length ?? 0)} cells in the sensor footprint.`, 'fine'));
    card.append(evidence(observation)); target.append(card);
  }
}
const labels = { 'run-started': 'Archive begins', 'directive-submitted': 'Team sends a directive', 'directive-cleared': 'Directive cleared', 'contestation-opened': 'Rover raises a concern', 'alternative-accepted': 'Team accepts an alternative', 'plan-proposed': 'A route is planned', 'observation-recorded': 'Observation recorded', 'endpoint-state-changed': 'Rover changes state', 'run-completed': 'Run completed' };
function eventTick(event) { return observer === 'mission' ? (event.received_tick ?? event.occurred_tick) : event.occurred_tick; }
function renderEvents() {
  const target = $('events'); target.replaceChildren();
  const significant = new Set(['run-started', 'run-completed', 'directive-submitted', 'directive-cleared', 'contestation-opened', 'alternative-accepted', 'plan-proposed', 'endpoint-state-changed']);
  const routine = view.events.filter(event => !significant.has(event.event_type)).slice(-5);
  const shown = view.events.filter(event => significant.has(event.event_type) || routine.includes(event));
  $('event-count').textContent = `${shown.length} / ${view.events.length}`;
  if (!view.events.length) return empty(target, 'No events visible at this time.');
  target.append(node('p', 'Decisions, plans and state changes, plus five recent routine updates. Move back in time to inspect earlier routine records.', 'fine'));
  for (const event of shown.slice().reverse()) {
    const row = node('article', undefined, 'event'); const jump = node('button', time(eventTick(event))); jump.title = `Go to tick ${eventTick(event)}`; jump.addEventListener('click', () => { pause(); load(eventTick(event)); });
    const body = node('div'); body.append(node('h3', labels[event.event_type] ?? words(event.event_type)));
    if (event.payload?.reason_code) body.append(node('p', `${words(event.payload.from)} → ${words(event.payload.to)} · ${words(event.payload.reason_code)}`));
    body.append(evidence(event)); row.append(jump, body); target.append(row);
  }
}
function draw() {
  if (!view) return;
  const { rows, columns } = view.grid; const rect = canvas.getBoundingClientRect(); const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * ratio)); canvas.height = Math.max(1, Math.round(rect.height * ratio)); context.setTransform(ratio, 0, 0, ratio, 0, 0);
  let minRow = 0, maxRow = rows - 1, minColumn = 0, maxColumn = columns - 1;
  if (!fullMap) { const points = [view.start, ...view.targets.map(target => target.cell), ...(view.plan?.route ?? [])].filter(Boolean); if (points.length) { minRow = Math.max(0, Math.min(...points.map(point => point.row)) - 12); maxRow = Math.min(rows - 1, Math.max(...points.map(point => point.row)) + 12); minColumn = Math.max(0, Math.min(...points.map(point => point.column)) - 12); maxColumn = Math.min(columns - 1, Math.max(...points.map(point => point.column)) + 12); } }
  const cell = Math.min(rect.width / (maxColumn - minColumn + 1), rect.height / (maxRow - minRow + 1)); const x = (rect.width - cell * (maxColumn - minColumn + 1)) / 2, y = (rect.height - cell * (maxRow - minRow + 1)) / 2;
  bounds = { minRow, maxRow, minColumn, maxColumn, cell, x, y }; context.fillStyle = '#111714'; context.fillRect(0, 0, rect.width, rect.height);
  let low = Infinity, high = -Infinity;
  for (const item of view.cells) if (item.known && Number.isFinite(item.elevation_mm)) { low = Math.min(low, item.elevation_mm); high = Math.max(high, item.elevation_mm); }
  for (let row = minRow; row <= maxRow; row++) for (let column = minColumn; column <= maxColumn; column++) {
    const item = view.cells[row * columns + column]; const left = x + (column - minColumn) * cell, top = y + (row - minRow) * cell;
    const fraction = item.known ? (item.elevation_mm - low) / (high - low || 1) : 0;
    context.fillStyle = !item.known ? '#111714' : item.obstacle ? '#ed9279' : `rgb(${Math.round(62 + fraction * 118)},${Math.round(70 + fraction * 83)},${Math.round(54 + fraction * 55)})`; context.fillRect(left, top, cell + .3, cell + .3);
    if (item.geofence) { context.fillStyle = '#aa80b18c'; context.fillRect(left, top, cell + .3, cell + .3); }
    if (item.sensed) { context.strokeStyle = '#b3d5b17a'; context.lineWidth = .65; context.strokeRect(left + .3, top + .3, Math.max(0, cell - .6), Math.max(0, cell - .6)); }
  }
  const point = position => [x + (position.column - minColumn + .5) * cell, y + (position.row - minRow + .5) * cell];
  if (view.plan?.route?.length) { context.beginPath(); view.plan.route.forEach((position, index) => { const [px, py] = point(position); if (index) context.lineTo(px, py); else context.moveTo(px, py); }); context.setLineDash([6, 5]); context.lineWidth = 2; context.strokeStyle = '#ffe2a5'; context.stroke(); context.setLineDash([]); }
  for (const marker of [{ cell: view.start, label: 'START', start: true }, ...view.targets.map((target, index) => ({ cell: target.cell, label: `TARGET ${index + 1}` }))]) {
    if (!marker.cell) continue; const [px, py] = point(marker.cell); context.strokeStyle = '#fff4da'; context.fillStyle = '#222a24'; context.lineWidth = 2; context.beginPath(); if (marker.start) context.arc(px, py, 5, 0, Math.PI * 2); else { context.moveTo(px, py - 6); context.lineTo(px + 6, py); context.lineTo(px, py + 6); context.lineTo(px - 6, py); context.closePath(); } context.fill(); context.stroke(); context.font = '9px system-ui'; context.fillStyle = '#fff4da'; context.shadowColor = '#000'; context.shadowBlur = 4; context.fillText(marker.label, px + 9, py - 8); context.shadowBlur = 0;
  }
  if (selected && selected.row >= minRow && selected.row <= maxRow && selected.column >= minColumn && selected.column <= maxColumn) { const [px, py] = point(selected); context.strokeStyle = '#fff'; context.lineWidth = 2; context.strokeRect(px - cell / 2, py - cell / 2, cell, cell); }
  $('map-scale').textContent = `${maxColumn - minColumn + 1} × ${maxRow - minRow + 1} cells · ${number(view.grid.cell_size_mm / 1000)} m/cell`;
  $('elevation-range').textContent = Number.isFinite(low) ? `Known elevation ${number(low / 1000)}–${number(high / 1000)} m` : 'No known elevation';
}
function inspect(row, column) { if (!view || !Number.isInteger(row) || !Number.isInteger(column) || row < 0 || column < 0 || row >= view.grid.rows || column >= view.grid.columns) { $('cell-value').textContent = 'Enter a valid row and column within this map.'; return; } selected = { row, column }; $('cell-row').value = String(row); $('cell-column').value = String(column); $('cell-coordinate').textContent = `· ${row}, ${column}`; const item = view.cells[row * view.grid.columns + column]; $('cell-value').textContent = item.known ? `Elevation ${number(item.elevation_mm / 1000)} m · ${item.obstacle ? 'Obstacle known' : 'No known obstacle'} · ${item.sensed ? 'Sensed' : 'Initial knowledge'} · Uncertainty ${number(item.uncertainty_mm)} mm · ${item.geofence ? 'Inside geofence' : 'Outside geofence'}` : `Unknown terrain · ${item.geofence ? 'Inside geofence' : 'Outside geofence'}`; draw(); }
canvas.addEventListener('click', event => { if (!bounds) return; const rect = canvas.getBoundingClientRect(); const column = Math.floor((event.clientX - rect.left - bounds.x) / bounds.cell) + bounds.minColumn, row = Math.floor((event.clientY - rect.top - bounds.y) / bounds.cell) + bounds.minRow; if (column < bounds.minColumn || column > bounds.maxColumn || row < bounds.minRow || row > bounds.maxRow) return; document.querySelector('.cell-details').open = true; inspect(row, column); });
$('cell-form').addEventListener('submit', event => { event.preventDefault(); inspect(Number($('cell-row').value), Number($('cell-column').value)); });
for (const name of ['asset', 'mission']) $(name).addEventListener('click', () => { if (!session) return; pause(); load(tick, name); });
for (const [id, value] of [['full-map', true], ['mission-area', false]]) $(id).addEventListener('click', () => { fullMap = value; $('full-map').setAttribute('aria-pressed', String(value)); $('mission-area').setAttribute('aria-pressed', String(!value)); draw(); });
$('timeline').addEventListener('input', event => { pause(); const value = event.target.value; controller?.abort(); ++requestId; $('workspace').setAttribute('aria-busy', 'true'); sliderTimer = setTimeout(() => load(value), 160); });
$('next').addEventListener('click', () => { if (view?.next_tick != null) { pause(); load(view.next_tick); } });
$('previous').addEventListener('click', () => { if (view?.previous_tick != null) { pause(); load(view.previous_tick); } });
$('end').addEventListener('click', () => { if (session) { pause(); load(session.max_tick); } });
$('play').addEventListener('click', () => { if (!view) return; if (playing) return pause(); playing = true; $('play').textContent = 'Ⅱ Pause'; $('play').setAttribute('aria-label', 'Pause event steps'); load(tick >= session.max_tick ? 0 : tick); });
new ResizeObserver(draw).observe(canvas.parentElement);
async function initialize() {
  try { session = await json('/api/session'); $('archive-name').textContent = session.archive_name; $('fixture-name').textContent = session.fixture_id; $('timeline').max = String(session.max_tick); $('timeline').disabled = false;
    for (const chapter of session.chapters) { const button = node('button', chapter.label); button.addEventListener('click', () => { pause(); load(chapter.tick); }); $('chapters').append(button); }
    for (const [label, value] of [['Run', session.run_id], ['Fixture', session.fixture_id], ['Chain head', session.chain_head], ['Archive status', session.status]]) $('identity').append(node('dt', label), node('dd', value));
    for (const limit of session.limits) $('limits').append(node('li', limit)); await load(0);
  } catch (error) { fail(error); }
}
initialize();
