// La rutina. Para cambiar ejercicios, series o alternativas, edita este archivo.
// key: identificador fijo (no lo cambies si ya tienes datos guardados; el historial se guarda con él).
// alts: la primera es la principal; las demás son las variantes para cuando la máquina está ocupada.
// unit: "reps" (repeticiones) o "s" (segundos). rest: descanso en segundos.

export const DAYS = [
  {
    key: "d1",
    name: "Glúteo",
    emoji: "🍑",
    exercises: [
      { key: "hip_thrust", name: "Hip thrust", sets: 4, min: 8, max: 12, rest: 120,
        alts: ["Máquina de hip thrust", "Barra en banco", "Mancuerna en banco", "Smith"] },
      { key: "rdl", name: "Peso muerto rumano", sets: 3, min: 8, max: 12, rest: 120,
        alts: ["Mancuernas", "Barra", "Pull-through en polea"],
        note: "Cadera hacia atrás, espalda recta, baja hasta sentir el femoral." },
      { key: "bulgarian", name: "Sentadilla búlgara", sets: 3, min: 8, max: 12, rest: 90, perSide: true,
        alts: ["Búlgara con mancuernas", "Zancada hacia atrás", "Step-up a banco"] },
      { key: "abductor", name: "Abductores", sets: 3, min: 15, max: 20, rest: 60,
        alts: ["Máquina", "Banda en rodillas (sentada)", "Polea con tobillera"] },
      { key: "glute_kick", name: "Patada de glúteo", sets: 3, min: 12, max: 15, rest: 60, perSide: true,
        alts: ["Polea con tobillera", "Máquina de patada", "Banda en cuadrupedia"] },
    ],
  },
  {
    key: "d2",
    name: "Torso A · espalda",
    emoji: "🦋",
    exercises: [
      { key: "pulldown", name: "Pull down", sets: 3, min: 8, max: 12, rest: 120,
        alts: ["Máquina / polea", "Jalón a un brazo en polea", "Dominadas asistidas"] },
      { key: "incline_press", name: "Press de pecho inclinado 45°", sets: 3, min: 8, max: 12, rest: 120,
        alts: ["Mancuernas", "Máquina", "Flexiones inclinadas"] },
      { key: "row", name: "Remo", sets: 3, min: 10, max: 12, rest: 90,
        alts: ["Máquina", "Polea sentada", "Mancuerna a un brazo en banco"] },
      { key: "lateral", name: "Elevaciones laterales", sets: 3, min: 12, max: 20, rest: 60,
        alts: ["Mancuernas", "Polea", "Máquina"] },
      { key: "face_pull", name: "Face pull", sets: 3, min: 12, max: 15, rest: 30, superset: "A",
        alts: ["Polea con cuerda", "Pájaros con mancuernas", "Banda"],
        note: "Superserie con el siguiente: haz una serie de cada uno y luego descansa." },
      { key: "triceps", name: "Extensión de tríceps", sets: 3, min: 12, max: 15, rest: 75, superset: "A",
        alts: ["Polea", "Mancuerna sobre la cabeza", "Fondos en banco"] },
    ],
  },
  {
    key: "d3",
    name: "Pierna · cuádriceps y femoral",
    emoji: "🌷",
    exercises: [
      { key: "leg_press", name: "Prensa 45°", sets: 4, min: 8, max: 12, rest: 120,
        alts: ["Prensa 45°", "Sentadilla goblet", "Sentadilla en Smith", "Hack squat"] },
      { key: "leg_curl", name: "Curl femoral", sets: 3, min: 10, max: 12, rest: 90,
        alts: ["Máquina sentada", "Máquina tumbada", "Curl con fitball"] },
      { key: "lunges", name: "Zancadas caminando", sets: 3, min: 10, max: 12, rest: 90, perSide: true,
        alts: ["Con mancuernas", "Búlgara", "Step-up a banco"] },
      { key: "leg_ext", name: "Extensión de cuádriceps", sets: 3, min: 12, max: 15, rest: 60,
        alts: ["Máquina", "Spanish squat con banda"] },
      { key: "adductor", name: "Aductores", sets: 2, min: 12, max: 15, rest: 60,
        alts: ["Máquina", "Sentadilla sumo con mancuerna"] },
      { key: "wall_sit", name: "Sentadilla en la pared (opcional)", sets: 2, min: 30, max: 45, unit: "s", rest: 60,
        alts: ["Sin peso", "Con disco en las piernas"] },
    ],
  },
  {
    key: "d4",
    name: "Torso B + glúteo",
    emoji: "✨",
    exercises: [
      { key: "row_db", name: "Remo con mancuerna a un brazo", sets: 3, min: 8, max: 12, rest: 90, perSide: true,
        alts: ["Mancuerna en banco", "Máquina", "Polea sentada"] },
      { key: "incline_press_b", name: "Press inclinado", sets: 3, min: 8, max: 12, rest: 120,
        alts: ["Máquina", "Mancuernas", "Flexiones"] },
      { key: "pullover", name: "Pull over", sets: 3, min: 12, max: 15, rest: 60,
        alts: ["Polea", "Mancuerna en banco"] },
      { key: "lateral_b", name: "Elevaciones laterales", sets: 3, min: 12, max: 20, rest: 60,
        alts: ["Polea", "Mancuernas", "Máquina"] },
      { key: "glute_bridge", name: "Hip thrust / puente de glúteo", sets: 3, min: 12, max: 15, rest: 90,
        alts: ["Máquina de hip thrust", "Barra en banco", "Puente a una pierna en el suelo"] },
      { key: "triceps_b", name: "Extensión de tríceps", sets: 2, min: 12, max: 15, rest: 60,
        alts: ["Polea", "Mancuerna sobre la cabeza", "Fondos en banco"] },
    ],
  },
];

export const dayByKey = (k) => DAYS.find((d) => d.key === k);

export function exerciseByKey(k) {
  for (const d of DAYS) {
    const e = d.exercises.find((x) => x.key === k);
    if (e) return e;
  }
  return null;
}

export function nextDayKey(lastKey) {
  const i = DAYS.findIndex((d) => d.key === lastKey);
  return DAYS[(i + 1) % DAYS.length].key;
}
