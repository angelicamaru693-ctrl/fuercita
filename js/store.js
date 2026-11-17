// Acceso a datos. Usa Supabase (mismo proyecto y cuenta que Repasito); con ?demo en la URL, guarda solo en este navegador.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const configured = !SUPABASE_URL.includes("TU-PROYECTO") && !SUPABASE_ANON_KEY.includes("TU-ANON");
export const DEMO = !configured || new URLSearchParams(location.search).has("demo");

// ---------- Supabase ----------

async function supabaseStore() {
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const check = ({ data, error }) => {
    if (error) throw new Error(error.message);
    return data;
  };

  // Supabase devuelve como máximo 1000 filas por consulta: se piden por páginas.
  async function all(table, order) {
    const out = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const rows = check(await sb.from(table).select("*").order(order, { ascending: true }).order("id")
        .range(from, from + PAGE - 1));
      out.push(...rows);
      if (rows.length < PAGE) return out;
    }
  }

  return {
    async getUser() {
      const { data } = await sb.auth.getSession();
      return data.session?.user ?? null;
    },
    async signIn(email, password) {
      check(await sb.auth.signInWithPassword({ email, password }));
    },
    async signOut() {
      await sb.auth.signOut();
    },
    async listWorkouts() { return all("gym_workouts", "finished_at"); },
    async listSets() { return all("gym_sets", "created_at"); },
    async saveWorkout(workout, sets) {
      // upsert: si se corta la conexión a mitad, reintentar no duplica nada.
      check(await sb.from("gym_workouts").upsert(workout));
      if (sets.length) check(await sb.from("gym_sets").upsert(sets));
    },
    async deleteWorkout(id) {
      check(await sb.from("gym_workouts").delete().eq("id", id));
    },
    async listMeasurements() { return all("gym_measurements", "measured_on"); },
    async addMeasurement(row) { check(await sb.from("gym_measurements").insert(row)); },
    async deleteMeasurement(id) { check(await sb.from("gym_measurements").delete().eq("id", id)); },
  };
}

// ---------- Demo (localStorage) ----------

function demoStore() {
  const KEY = "fuercita-demo";
  const load = () => JSON.parse(localStorage.getItem(KEY) ?? '{"workouts":[],"sets":[],"measurements":[]}');
  const save = (db) => localStorage.setItem(KEY, JSON.stringify(db));
  const upsert = (list, rows) => {
    for (const r of rows) {
      const i = list.findIndex((x) => x.id === r.id);
      if (i >= 0) list[i] = r; else list.push(r);
    }
  };

  return {
    async getUser() { return { id: "demo", email: "demo@fuercita" }; },
    async signIn() {},
    async signOut() { localStorage.removeItem(KEY); location.reload(); },
    async listWorkouts() { return load().workouts; },
    async listSets() { return load().sets; },
    async saveWorkout(workout, sets) {
      const db = load();
      upsert(db.workouts, [workout]);
      upsert(db.sets, sets.map((s) => ({ created_at: workout.finished_at, ...s })));
      save(db);
    },
    async deleteWorkout(id) {
      const db = load();
      db.workouts = db.workouts.filter((w) => w.id !== id);
      db.sets = db.sets.filter((s) => s.workout_id !== id);
      save(db);
    },
    async listMeasurements() {
      return load().measurements.sort((a, b) => a.measured_on.localeCompare(b.measured_on));
    },
    async addMeasurement(row) {
      const db = load();
      db.measurements.push({ id: crypto.randomUUID(), notes: "", ...row });
      save(db);
    },
    async deleteMeasurement(id) {
      const db = load();
      db.measurements = db.measurements.filter((m) => m.id !== id);
      save(db);
    },
  };
}

export async function createStore() {
  return DEMO ? demoStore() : await supabaseStore();
}
