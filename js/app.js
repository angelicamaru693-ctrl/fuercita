import { createStore, DEMO } from "./store.js";
import { DAYS, dayByKey, exerciseByKey, nextDayKey } from "./routine.js";

const app = document.getElementById("app");
const DRAFT_KEY = "fuercita-draft";
let store;
let workouts = [];
let sets = [];
let measurements = [];

// ---------- utilidades ----------

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmt = (n) => Number(n).toLocaleString("es", { maximumFractionDigits: 2 });
const num = (s) => {
  const n = parseFloat(String(s ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const day = (iso) => new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short" });
const dateOnly = (s) => new Date(`${s}T12:00:00`);
const restText = (s) => (s >= 60 ? `${fmt(s / 60)} min` : `${s} s`);
const unitOf = (ex) => (ex.unit === "s" ? "seg" : "reps");

function render(html, keepScroll = false) {
  const y = window.scrollY;
  app.innerHTML = html;
  window.scrollTo({ top: keepScroll ? y : 0 });
}

function toast(message, kind = "info") {
  const el = document.createElement("div");
  el.className = `toast toast-${kind}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

function hearts() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (let i = 0; i < 8; i++) {
    const h = document.createElement("span");
    h.className = "float-heart";
    h.textContent = ["💪", "✨", "🌸", "💕"][i % 4];
    h.style.left = `${35 + Math.random() * 30}%`;
    h.style.animationDelay = `${i * 60}ms`;
    document.body.appendChild(h);
    setTimeout(() => h.remove(), 1600);
  }
}

function loading(message) {
  render(`
    <div class="loading">
      <div class="loader"><span>💪</span><span>✨</span><span>🌸</span></div>
      <p>${esc(message)}</p>
    </div>`);
}

const header = (back = false) => `
  <header class="topbar">
    ${back ? `<button class="icon-btn" data-go="home" aria-label="Volver">←</button>` : `<span class="spacer"></span>`}
    <h1 class="logo" data-go="home">Fuercita <span>💪</span></h1>
    ${DEMO ? `<span class="spacer"></span>` : `<button class="icon-btn" id="logout" aria-label="Cerrar sesión" title="Cerrar sesión">⎋</button>`}
  </header>
  ${DEMO ? `<div class="demo-banner">Modo demo: todo se guarda solo en este navegador.</div>` : ""}`;

function bindCommon() {
  app.querySelectorAll("[data-go=home]").forEach((el) => el.addEventListener("click", showHome));
  app.querySelector("#logout")?.addEventListener("click", async () => {
    if (!confirm("¿Cerrar sesión?")) return;
    await store.signOut();
    showLogin();
  });
}

async function refresh() {
  [workouts, sets] = await Promise.all([store.listWorkouts(), store.listSets()]);
}

// ---------- historial ----------

const workoutById = () => new Map(workouts.map((w) => [w.id, w]));

// Sesiones pasadas de un ejercicio (y variante, si se indica), de la más antigua a la más reciente.
function history(exKey, variant = null) {
  const byId = workoutById();
  const groups = new Map();
  for (const s of sets) {
    if (s.exercise_key !== exKey || (variant && s.variant !== variant)) continue;
    const w = byId.get(s.workout_id);
    if (!w) continue;
    if (!groups.has(w.id)) groups.set(w.id, { workout: w, sets: [] });
    groups.get(w.id).sets.push(s);
  }
  const list = [...groups.values()];
  list.forEach((g) => g.sets.sort((a, b) => a.set_no - b.set_no));
  return list.sort((a, b) => a.workout.finished_at.localeCompare(b.workout.finished_at));
}

const lastVariant = (exKey) => history(exKey).at(-1)?.sets[0]?.variant ?? null;

const setText = (s, ex) => (Number(s.weight_kg) > 0 ? `${fmt(s.weight_kg)} kg × ${s.reps}` : `${s.reps} ${unitOf(ex)}`);

// Mejor serie: más peso; a igual peso, más repeticiones.
const better = (a, b) => (Number(a.weight_kg) !== Number(b.weight_kg)
  ? Number(a.weight_kg) > Number(b.weight_kg) : a.reps > b.reps);
const bestOf = (list) => list.reduce((best, s) => (!best || better(s, best) ? s : best), null);

function hint(ex, last) {
  if (!last) {
    return { cls: "", text: `Primera vez: elige un peso con el que llegues a ${ex.max} ${unitOf(ex)} sintiendo que te quedan 1–3 más.` };
  }
  const done = last.sets.length >= ex.sets && last.sets.every((s) => s.reps >= ex.max);
  if (done) return { cls: "good", text: "🎉 La última vez llegaste al tope en todas las series: hoy sube un poquito el peso." };
  return { cls: "", text: "Meta de hoy: igualar la última vez y sumar al menos 1 repetición en alguna serie." };
}

// ---------- login ----------

function showLogin() {
  render(`
    <div class="login">
      <h1 class="logo big">Fuercita <span>💪</span></h1>
      <p class="tagline">Tu rutina, tus pesos y tu progreso, siempre a mano ✨</p>
      <form class="card" id="auth">
        <label>Correo<input type="email" name="email" required autocomplete="email"></label>
        <label>Contraseña<input type="password" name="password" required autocomplete="current-password"></label>
        <button class="btn primary" type="submit">Entrar</button>
        <p class="muted center">Es la misma cuenta que usas en Repasito 🌸</p>
      </form>
    </div>`);
  app.querySelector("#auth").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      await store.signIn(f.get("email"), f.get("password"));
      await enter();
    } catch (err) {
      toast(err.message, "error");
      btn.disabled = false;
    }
  });
}

async function enter() {
  if (!(await store.getUser())) return showLogin();
  loading("Cargando tus entrenamientos…");
  try {
    await refresh();
  } catch (err) {
    render(`${header()}<main><div class="card"><h3>No pude cargar tus datos 😕</h3>
      <p class="muted">${esc(err.message)}</p>
      <p class="muted">Si es la primera vez, revisa que ejecutaste <code>supabase/schema.sql</code> en Supabase.</p>
      <button class="btn primary wide" id="retry">Reintentar</button></div></main>`);
    bindCommon();
    app.querySelector("#retry").addEventListener("click", enter);
    return;
  }
  showHome();
}

// ---------- inicio ----------

const loadDraft = () => JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null");
const saveDraft = (d) => localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
const clearDraft = () => localStorage.removeItem(DRAFT_KEY);

function stats() {
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const since = (d) => workouts.filter((w) => new Date(w.finished_at) >= d).length;
  return { week: since(monday), month: since(monthStart), total: workouts.length, sets: sets.length };
}

function lastDone(dayKey) {
  const w = workouts.filter((x) => x.day_key === dayKey).at(-1);
  if (!w) return "aún sin hacer";
  const days = Math.floor((Date.now() - new Date(w.finished_at)) / 86_400_000);
  return days === 0 ? "último: hoy" : days === 1 ? "último: ayer" : `último: hace ${days} días`;
}

function showHome() {
  const draft = loadDraft();
  const next = dayByKey(nextDayKey(workouts.at(-1)?.day_key));
  const st = stats();
  const recent = workouts.slice(-5).reverse();
  const countSets = (wid) => sets.filter((s) => s.workout_id === wid).length;

  render(`
    ${header()}
    <main>
      ${draft ? `
        <section class="card hero">
          <p class="chip">A medias</p>
          <h2>${dayByKey(draft.day_key).emoji} ${esc(dayByKey(draft.day_key).name)}</h2>
          <p>Empezaste este entrenamiento el ${day(draft.started_at)}. Puedes seguir donde lo dejaste.</p>
          <button class="btn primary wide" id="resume">Continuar</button>
          <button class="link danger center" id="discard">Descartar</button>
        </section>` : `
        <section class="card hero">
          <p class="chip">Hoy te toca</p>
          <h2>${next.emoji} ${esc(next.name)}</h2>
          <p>${next.exercises.length} ejercicios · unos 50 minutos. ¿Sin ganas? Con los 3 primeros ya cuenta 💖</p>
          <button class="btn primary wide" data-start="${next.key}">Empezar</button>
        </section>`}

      <section class="stats">
        <div><strong>${st.week}</strong><span>esta semana</span></div>
        <div><strong>${st.month}</strong><span>este mes</span></div>
        <div><strong>${st.total}</strong><span>entrenos en total</span></div>
        <div><strong>${st.sets}</strong><span>series</span></div>
      </section>

      <section class="card">
        <h3>O elige otro día</h3>
        <ul class="topic-list">
          ${DAYS.map((d, i) => `
            <li class="topic-row">
              <button class="topic-main" data-start="${d.key}">
                <span class="topic-emoji">${d.emoji}</span>
                <span><strong>Día ${i + 1} · ${esc(d.name)}</strong><small>${lastDone(d.key)}</small></span>
              </button>
            </li>`).join("")}
        </ul>
      </section>

      <div class="two-btns">
        <button class="btn soft" id="progress">📈 Mi progreso</button>
        <button class="btn soft" id="measures">📏 Medidas</button>
      </div>

      ${recent.length ? `
        <section class="card">
          <h3>Últimos entrenamientos</h3>
          <ul class="topic-list">
            ${recent.map((w) => `
              <li class="topic-row">
                <button class="topic-main" data-workout="${w.id}">
                  <span class="topic-emoji">${dayByKey(w.day_key)?.emoji ?? "💪"}</span>
                  <span><strong>${esc(dayByKey(w.day_key)?.name ?? w.day_key)}</strong>
                  <small>${day(w.finished_at)} · ${countSets(w.id)} series</small></span>
                </button>
              </li>`).join("")}
          </ul>
        </section>` : ""}
    </main>`);
  bindCommon();
  app.querySelector("#resume")?.addEventListener("click", showWorkout);
  app.querySelector("#discard")?.addEventListener("click", () => {
    if (!confirm("¿Descartar el entrenamiento a medias? Lo que anotaste se perderá.")) return;
    clearDraft();
    showHome();
  });
  app.querySelectorAll("[data-start]").forEach((b) => b.addEventListener("click", () => startWorkout(b.dataset.start)));
  app.querySelectorAll("[data-workout]").forEach((b) => b.addEventListener("click", () => showWorkoutDetail(b.dataset.workout)));
  app.querySelector("#progress").addEventListener("click", showProgress);
  app.querySelector("#measures").addEventListener("click", showMeasurements);
}

// ---------- entrenamiento ----------

function startWorkout(dayKey) {
  const existing = loadDraft();
  if (existing && !confirm("Tienes un entrenamiento a medias. ¿Descartarlo y empezar este?")) return;
  const d = dayByKey(dayKey);
  const ex = {};
  for (const e of d.exercises) {
    const v = lastVariant(e.key);
    ex[e.key] = {
      variant: e.alts.includes(v) ? v : e.alts[0],
      sets: Array.from({ length: e.sets }, () => ({ w: "", r: "", done: false })),
    };
  }
  saveDraft({ id: crypto.randomUUID(), day_key: dayKey, started_at: new Date().toISOString(), ex });
  showWorkout();
}

function exerciseCard(e, i, state) {
  const last = history(e.key, state.variant).at(-1);
  const h = hint(e, last);
  const ph = (n) => last?.sets[n] ?? last?.sets.at(-1);
  const supersetNext = e.superset && dayByKey(loadDraft().day_key).exercises[i + 1]?.superset === e.superset;
  return `
    <section class="card ex-card ${state.sets.length && state.sets.every((s) => s.done) ? "ex-done" : ""}">
      <div class="ex-head">
        <span class="num">${i + 1}</span>
        <div>
          <h3>${esc(e.name)}</h3>
          <p class="target">${e.sets} × ${e.min}–${e.max} ${unitOf(e)}${e.perSide ? " por lado" : ""} · descanso ${restText(e.rest)}${supersetNext ? " (después del siguiente)" : ""}</p>
        </div>
      </div>
      <label class="variant">¿Máquina ocupada? Cambia la variante
        <select data-variant="${e.key}">
          ${e.alts.map((a) => `<option ${a === state.variant ? "selected" : ""}>${esc(a)}</option>`).join("")}
        </select>
      </label>
      ${e.note ? `<p class="tip small-tip">${esc(e.note)}</p>` : ""}
      <p class="last">${last ? `Última vez (${day(last.workout.finished_at)}): ${last.sets.map((s) => setText(s, e)).join(" · ")}` : "Sin registros con esta variante todavía."}</p>
      <p class="hint ${h.cls}">${h.text}</p>
      <div class="set-grid">
        <span class="set-label">Serie</span><span class="set-label">kg</span><span class="set-label">${unitOf(e)}</span><span></span>
        ${state.sets.map((s, n) => `
          <span class="set-no">${n + 1}</span>
          <input class="${s.done ? "is-done" : ""}" inputmode="decimal" aria-label="Peso serie ${n + 1}"
            data-ex="${e.key}" data-n="${n}" data-f="w" value="${esc(s.w)}" placeholder="${ph(n) ? fmt(ph(n).weight_kg) : "kg"}">
          <input class="${s.done ? "is-done" : ""}" inputmode="numeric" aria-label="${unitOf(e)} serie ${n + 1}"
            data-ex="${e.key}" data-n="${n}" data-f="r" value="${esc(s.r)}" placeholder="${ph(n) ? ph(n).reps : `${e.min}–${e.max}`}">
          <button class="check ${s.done ? "on" : ""}" data-check="${e.key}" data-n="${n}" aria-label="Marcar serie ${n + 1}">✓</button>
        `).join("")}
      </div>
      <div class="row">
        <button class="link" data-remove="${e.key}" ${state.sets.length ? "" : "disabled"}>− quitar serie</button>
        <button class="link" data-add="${e.key}">+ añadir serie</button>
      </div>
    </section>`;
}

function showWorkout(keepScroll = false) {
  const draft = loadDraft();
  if (!draft) return showHome();
  const d = dayByKey(draft.day_key);
  const all = Object.values(draft.ex).flatMap((x) => x.sets);
  const done = all.filter((s) => s.done).length;

  render(`
    ${header(true)}
    <main>
      <section class="card hero">
        <p class="chip">Día ${DAYS.indexOf(d) + 1}</p>
        <h2>${d.emoji} ${esc(d.name)}</h2>
        <p>Termina cada serie sintiendo que podrías hacer 1–3 repeticiones más. Toca ✓ al acabar cada serie.</p>
        <div class="progress" aria-hidden="true"><div style="width:${all.length ? (done / all.length) * 100 : 0}%"></div></div>
        <p class="counter">${done} de ${all.length} series</p>
      </section>
      ${d.exercises.map((e, i) => exerciseCard(e, i, draft.ex[e.key])).join("")}
      <button class="btn primary wide" id="finish">Terminar entrenamiento 💪</button>
      <button class="link danger center" id="discard">Descartar entrenamiento</button>
    </main>`, keepScroll);
  bindCommon();

  const update = (fn) => {
    const dr = loadDraft();
    fn(dr);
    saveDraft(dr);
  };

  app.querySelectorAll("input[data-ex]").forEach((inp) => inp.addEventListener("input", () => {
    update((dr) => { dr.ex[inp.dataset.ex].sets[inp.dataset.n][inp.dataset.f] = inp.value.trim(); });
  }));
  app.querySelectorAll("[data-variant]").forEach((sel) => sel.addEventListener("change", () => {
    update((dr) => { dr.ex[sel.dataset.variant].variant = sel.value; });
    showWorkout(true);
  }));
  app.querySelectorAll("[data-add]").forEach((b) => b.addEventListener("click", () => {
    update((dr) => { dr.ex[b.dataset.add].sets.push({ w: "", r: "", done: false }); });
    showWorkout(true);
  }));
  app.querySelectorAll("[data-remove]").forEach((b) => b.addEventListener("click", () => {
    update((dr) => { dr.ex[b.dataset.remove].sets.pop(); });
    showWorkout(true);
  }));
  app.querySelectorAll("[data-check]").forEach((b) => b.addEventListener("click", () => {
    const key = b.dataset.check;
    const n = Number(b.dataset.n);
    const e = exerciseByKey(key);
    const dr = loadDraft();
    const s = dr.ex[key].sets[n];
    if (s.done) {
      s.done = false;
    } else {
      // Si dejaste la casilla vacía, se usa lo de la última vez (el texto gris).
      const wIn = app.querySelector(`input[data-ex="${key}"][data-n="${n}"][data-f="w"]`);
      const rIn = app.querySelector(`input[data-ex="${key}"][data-n="${n}"][data-f="r"]`);
      const w = s.w || (num(wIn.placeholder) !== null ? wIn.placeholder : "");
      const r = s.r || (/^\d+$/.test(rIn.placeholder) ? rIn.placeholder : "");
      if (!(num(r) > 0)) {
        toast(`Escribe cuántas ${unitOf(e) === "seg" ? "segundos" : "repeticiones"} hiciste.`, "error");
        rIn.focus();
        return;
      }
      if (w && num(w) === null) {
        toast("El peso tiene que ser un número (por ejemplo 22,5).", "error");
        wIn.focus();
        return;
      }
      Object.assign(s, { w, r, done: true });
      const nextInSuperset = e.superset && dayByKey(dr.day_key).exercises.find((x, i, arr) =>
        arr[i - 1]?.key === key && x.superset === e.superset);
      startRest(nextInSuperset ? 0 : e.rest, nextInSuperset ? `Ahora: ${nextInSuperset.name}` : null);
    }
    saveDraft(dr);
    showWorkout(true);
  }));
  app.querySelector("#finish").addEventListener("click", finishWorkout);
  app.querySelector("#discard").addEventListener("click", () => {
    if (!confirm("¿Descartar este entrenamiento? Lo que anotaste se perderá.")) return;
    clearDraft();
    stopRest();
    showHome();
  });
}

async function finishWorkout() {
  const draft = loadDraft();
  const d = dayByKey(draft.day_key);
  const rows = [];
  for (const e of d.exercises) {
    const st = draft.ex[e.key];
    st.sets.filter((s) => s.done).forEach((s, i) => rows.push({
      id: crypto.randomUUID(), workout_id: draft.id, exercise_key: e.key, variant: st.variant,
      set_no: i + 1, weight_kg: num(s.w) ?? 0, reps: Math.round(num(s.r)),
    }));
  }
  if (!rows.length) {
    if (confirm("No marcaste ninguna serie con ✓. ¿Descartar el entrenamiento?")) {
      clearDraft();
      showHome();
    }
    return;
  }
  const unchecked = Object.values(draft.ex).flatMap((x) => x.sets).filter((s) => !s.done && (s.w || s.r)).length;
  if (unchecked && !confirm(`Hay ${unchecked} serie(s) con datos pero sin ✓; no se guardarán. ¿Terminar igual?`)) return;

  // Récords: comparar con lo anterior antes de guardar.
  const records = [];
  const seen = new Set();
  for (const r of rows) {
    const id = `${r.exercise_key}|${r.variant}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const prev = bestOf(history(r.exercise_key, r.variant).flatMap((g) => g.sets));
    const now = bestOf(rows.filter((x) => x.exercise_key === r.exercise_key && x.variant === r.variant));
    if (prev && better(now, prev)) records.push({ ex: exerciseByKey(r.exercise_key), variant: r.variant, set: now });
  }

  const workout = { id: draft.id, day_key: draft.day_key, started_at: draft.started_at, finished_at: new Date().toISOString() };
  const btn = app.querySelector("#finish");
  btn.disabled = true;
  btn.textContent = "Guardando…";
  try {
    await store.saveWorkout(workout, rows);
  } catch (err) {
    toast(`No se pudo guardar (${err.message}). Tus datos siguen aquí: revisa la conexión y vuelve a tocar «Terminar».`, "error");
    btn.disabled = false;
    btn.textContent = "Terminar entrenamiento 💪";
    return;
  }
  clearDraft();
  stopRest();
  await refresh().catch(() => {});
  const minutes = Math.round((new Date(workout.finished_at) - new Date(workout.started_at)) / 60_000);
  hearts();
  render(`
    ${header()}
    <main>
      <section class="card result">
        <div class="score">💪</div>
        <p class="big-msg">¡Entrenamiento guardado!</p>
        <p class="muted">${rows.length} series · ${new Set(rows.map((r) => r.exercise_key)).size} ejercicios${minutes < 300 ? ` · ${minutes} min` : ""}</p>
        ${records.length ? `
          <h3 class="section-title">🏆 Nuevos récords</h3>
          <ul class="mistakes">${records.map((r) => `<li><strong>${esc(r.ex.name)}</strong><small>${esc(r.variant)} · ${setText(r.set, r.ex)}</small></li>`).join("")}</ul>` : `
          <p class="next-review">Cada sesión que haces suma, aunque hoy no haya récord 🌸</p>`}
      </section>
      <button class="btn primary wide" data-go="home">Volver al inicio</button>
    </main>`);
  bindCommon();
}

function showWorkoutDetail(id) {
  const w = workouts.find((x) => x.id === id);
  const d = dayByKey(w.day_key);
  const ws = sets.filter((s) => s.workout_id === id);
  const keys = [...new Set(ws.map((s) => s.exercise_key))];
  render(`
    ${header(true)}
    <main>
      <section class="card">
        <p class="chip">${day(w.finished_at)}</p>
        <h2>${d?.emoji ?? "💪"} ${esc(d?.name ?? w.day_key)}</h2>
        <ul class="mistakes">
          ${keys.map((k) => {
            const e = exerciseByKey(k) ?? { name: k };
            const list = ws.filter((s) => s.exercise_key === k).sort((a, b) => a.set_no - b.set_no);
            return `<li><strong>${esc(e.name)}</strong><small>${esc(list[0].variant)}</small><span>${list.map((s) => setText(s, e)).join(" · ")}</span></li>`;
          }).join("")}
        </ul>
      </section>
      <button class="link danger center" id="del">Borrar este entrenamiento</button>
    </main>`);
  bindCommon();
  app.querySelector("#del").addEventListener("click", async () => {
    if (!confirm("¿Borrar este entrenamiento y todas sus series?")) return;
    try {
      await store.deleteWorkout(id);
      await refresh();
      showHome();
    } catch (err) {
      toast(err.message, "error");
    }
  });
}

// ---------- temporizador de descanso ----------

let rest = null;

function startRest(seconds, message) {
  stopRest();
  if (!seconds) {
    if (message) toast(`${message} (superserie, sin descanso) 💨`);
    return;
  }
  const bar = document.createElement("div");
  bar.className = "rest-bar";
  bar.innerHTML = `<span class="rest-time"></span>
    <button class="btn small soft" data-plus>+30 s</button>
    <button class="btn small soft" data-skip>Saltar</button>`;
  document.body.appendChild(bar);
  rest = { endsAt: Date.now() + seconds * 1000, bar, timer: null };
  bar.querySelector("[data-plus]").addEventListener("click", () => { rest.endsAt += 30_000; tick(); });
  bar.querySelector("[data-skip]").addEventListener("click", stopRest);
  tick();
  rest.timer = setInterval(tick, 250);
}

function tick() {
  if (!rest) return;
  const left = Math.ceil((rest.endsAt - Date.now()) / 1000);
  const label = rest.bar.querySelector(".rest-time");
  if (left > 0) {
    label.textContent = `Descanso ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
    return;
  }
  clearInterval(rest.timer);
  label.textContent = "¡A por la siguiente serie! 💪";
  rest.bar.classList.add("rest-done");
  navigator.vibrate?.([200, 100, 200]);
  const bar = rest.bar;
  setTimeout(() => { if (rest?.bar === bar) stopRest(); }, 5000);
}

function stopRest() {
  if (!rest) return;
  clearInterval(rest.timer);
  rest.bar.remove();
  rest = null;
}

// ---------- progreso ----------

function showProgress() {
  const withData = DAYS.map((d) => ({
    d,
    list: d.exercises.map((e) => ({ e, n: history(e.key).length })).filter((x) => x.n),
  })).filter((g) => g.list.length);

  render(`
    ${header(true)}
    <main>
      <section class="card hero">
        <h2>📈 Mi progreso</h2>
        <p>Elige un ejercicio para ver cómo han ido subiendo tus pesos.</p>
      </section>
      ${withData.length ? withData.map(({ d, list }) => `
        <section class="card">
          <h3>${d.emoji} ${esc(d.name)}</h3>
          <ul class="topic-list">
            ${list.map(({ e, n }) => {
              const best = bestOf(history(e.key).flatMap((g) => g.sets));
              return `<li class="topic-row"><button class="topic-main" data-ex="${e.key}">
                <span><strong>${esc(e.name)}</strong><small>${n} ${n === 1 ? "sesión" : "sesiones"} · mejor: ${setText(best, e)}</small></span>
              </button></li>`;
            }).join("")}
          </ul>
        </section>`).join("") : `
        <section class="card"><p class="muted center">Cuando guardes tu primer entrenamiento, aquí verás tu progreso 🌱</p></section>`}
    </main>`);
  bindCommon();
  app.querySelectorAll("[data-ex]").forEach((b) => b.addEventListener("click", () => showExercise(b.dataset.ex)));
}

function showExercise(key, variant = null) {
  const e = exerciseByKey(key);
  const all = history(key);
  const variants = [...new Set(all.flatMap((g) => g.sets.map((s) => s.variant)))];
  variant ??= lastVariant(key);
  const list = history(key, variant);
  const byWeight = list.some((g) => g.sets.some((s) => Number(s.weight_kg) > 0));
  const points = list.map((g) => {
    const b = bestOf(g.sets);
    return { value: byWeight ? Number(b.weight_kg) : b.reps, label: `${day(g.workout.finished_at)}: ${setText(b, e)}` };
  });
  const first = bestOf(list[0].sets);
  const top = bestOf(list.flatMap((g) => g.sets));
  const diff = byWeight ? Number(top.weight_kg) - Number(first.weight_kg) : top.reps - first.reps;

  render(`
    ${header(true)}
    <main>
      <section class="card">
        <h2 class="ex-title">${esc(e.name)}</h2>
        ${variants.length > 1 ? `<div class="chips">${variants.map((v) =>
          `<button class="chip-btn ${v === variant ? "on" : ""}" data-v="${esc(v)}">${esc(v)}</button>`).join("")}</div>` : `<p class="chip">${esc(variant)}</p>`}
        <div class="stats three">
          <div><strong>${setText(first, e)}</strong><span>al empezar</span></div>
          <div><strong>${setText(top, e)}</strong><span>tu mejor serie</span></div>
          <div><strong>${diff > 0 ? "+" : ""}${fmt(diff)} ${byWeight ? "kg" : unitOf(e)}</strong><span>de diferencia</span></div>
        </div>
        <h3 class="section-title">${byWeight ? "Peso de tu mejor serie (kg)" : `Mejor serie (${unitOf(e)})`}</h3>
        ${points.length > 1 ? chart(points) : `<p class="muted">Con dos sesiones o más verás aquí la gráfica.</p>`}
      </section>
      <section class="card">
        <h3>Historial</h3>
        <ul class="mistakes">
          ${[...list].reverse().map((g) => `<li><strong>${day(g.workout.finished_at)}</strong><span>${g.sets.map((s) => setText(s, e)).join(" · ")}</span></li>`).join("")}
        </ul>
      </section>
    </main>`);
  bindCommon();
  app.querySelectorAll("[data-v]").forEach((b) => b.addEventListener("click", () => showExercise(key, b.dataset.v)));
  bindChart();
}

// Gráfica de línea simple (una sola serie): toca un punto para ver el valor.
function chart(points) {
  const W = 340, H = 190, L = 34, R = 14, T = 30, B = 22;
  const vals = points.map((p) => p.value);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi) { lo -= 1; hi += 1; }
  const padV = (hi - lo) * 0.1;
  lo = Math.max(0, lo - padV); hi += padV;
  const x = (i) => L + (i * (W - L - R)) / (points.length - 1);
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const ticks = [lo, (lo + hi) / 2, hi];
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const last = points.length - 1;
  return `
    <div class="chart" data-labels='${esc(JSON.stringify(points.map((p) => p.label)))}'>
      <p class="chart-tip" aria-live="polite">Toca un punto para ver el detalle</p>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Progreso por sesión">
        ${ticks.map((t) => `
          <line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" class="grid"/>
          <text x="${L - 6}" y="${y(t) + 4}" text-anchor="end" class="axis">${fmt(Math.round(t * 2) / 2)}</text>`).join("")}
        <text x="${L}" y="${H - 4}" class="axis">${esc(points[0].label.split(":")[0])}</text>
        <text x="${W - R}" y="${H - 4}" text-anchor="end" class="axis">${esc(points[last].label.split(":")[0])}</text>
        <path d="${path}" class="line"/>
        ${points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.value)}" r="4" class="dot" data-dot="${i}"/>`).join("")}
        <text x="${x(last)}" y="${y(points[last].value) - 10}" text-anchor="end" class="value">${fmt(points[last].value)}</text>
        ${points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.value)}" r="16" class="hit" data-hit="${i}"/>`).join("")}
      </svg>
    </div>`;
}

function bindChart() {
  const box = app.querySelector(".chart");
  if (!box) return;
  const labels = JSON.parse(box.dataset.labels);
  const tip = box.querySelector(".chart-tip");
  const show = (i) => {
    tip.textContent = labels[i];
    box.querySelectorAll(".dot").forEach((d) => d.classList.toggle("active", d.dataset.dot === String(i)));
  };
  box.querySelectorAll("[data-hit]").forEach((c) => {
    c.addEventListener("click", () => show(c.dataset.hit));
    c.addEventListener("mouseenter", () => show(c.dataset.hit));
  });
}

// ---------- medidas ----------

async function showMeasurements() {
  loading("Cargando medidas…");
  try {
    measurements = await store.listMeasurements();
  } catch (err) {
    toast(err.message, "error");
    return showHome();
  }
  const first = measurements[0];
  const delta = (m, f, unit) => {
    if (m[f] == null) return "";
    const base = measurements.find((x) => x[f] != null);
    const d = base && base !== m ? m[f] - base[f] : null;
    return `<span>${fmt(m[f])} ${unit}${d ? ` <small>(${d > 0 ? "+" : ""}${fmt(d)})</small>` : ""}</span>`;
  };
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const lastDate = measurements.at(-1)?.measured_on;
  const daysSince = lastDate ? Math.floor((dateOnly(iso) - dateOnly(lastDate)) / 86_400_000) : null;

  render(`
    ${header(true)}
    <main>
      <section class="card hero">
        <h2>📏 Medidas</h2>
        <p>Mídete cada 4 semanas, en ayunas y a la misma hora. Con la recomposición, la cinta métrica y las fotos
          cuentan más que la báscula.${daysSince == null ? "" : daysSince === 0 ? " Última medición: hoy." : ` Última medición: hace ${daysSince} días.`}</p>
      </section>
      <form class="card" id="m-form">
        <h3>Nueva medición</h3>
        <label>Fecha<input type="date" name="measured_on" value="${iso}" required></label>
        <div class="three-inputs">
          <label>Peso (kg)<input name="weight_kg" inputmode="decimal"></label>
          <label>Cintura (cm)<input name="waist_cm" inputmode="decimal"></label>
          <label>Cadera (cm)<input name="hips_cm" inputmode="decimal"></label>
        </div>
        <label>Notas<input name="notes" placeholder="Opcional: cómo te sientes, fotos tomadas…"></label>
        <button class="btn primary wide" type="submit">Guardar</button>
      </form>
      ${measurements.length ? `
        <section class="card">
          <h3>Historial</h3>
          <p class="muted">Entre paréntesis: la diferencia con tu primera medición${first ? ` (${dateOnly(first.measured_on).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })})` : ""}.</p>
          <ul class="mistakes">
            ${[...measurements].reverse().map((m) => `
              <li>
                <div class="row tight"><strong>${dateOnly(m.measured_on).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })}</strong>
                <button class="link danger" data-del="${m.id}">borrar</button></div>
                <div class="measure-line">${delta(m, "weight_kg", "kg")}${delta(m, "waist_cm", "cm cintura")}${delta(m, "hips_cm", "cm cadera")}</div>
                ${m.notes ? `<small>${esc(m.notes)}</small>` : ""}
              </li>`).join("")}
          </ul>
        </section>` : ""}
    </main>`);
  bindCommon();
  app.querySelector("#m-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const row = { measured_on: f.get("measured_on"), notes: f.get("notes").trim() };
    for (const k of ["weight_kg", "waist_cm", "hips_cm"]) {
      const raw = f.get(k).trim();
      if (raw && num(raw) === null) return toast("Usa solo números (por ejemplo 68,5).", "error");
      row[k] = raw ? num(raw) : null;
    }
    if (row.weight_kg == null && row.waist_cm == null && row.hips_cm == null) return toast("Escribe al menos una medida.", "error");
    try {
      await store.addMeasurement(row);
      hearts();
      showMeasurements();
    } catch (err) {
      toast(err.message, "error");
    }
  });
  app.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => {
    if (!confirm("¿Borrar esta medición?")) return;
    try {
      await store.deleteMeasurement(b.dataset.del);
      showMeasurements();
    } catch (err) {
      toast(err.message, "error");
    }
  }));
}

// ---------- arranque ----------

(async () => {
  loading("Un momento…");
  try {
    store = await createStore();
  } catch {
    render(`<div class="loading"><p>No pude conectar. Revisa tu conexión y recarga la página.</p></div>`);
    return;
  }
  await enter();
})();
