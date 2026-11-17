# Fuercita 💪

Web app para el gym: eliges el día de la rutina, anotas peso y repeticiones de cada serie,
cambias de variante si la máquina está ocupada y ves tu progreso y tus medidas.
Usa **el mismo proyecto de Supabase y la misma cuenta que Repasito**.

- **Probar sin configurar nada:** `python3 -m http.server 8000` en esta carpeta y abre
  <http://localhost:8000/?demo> (los datos se guardan solo en ese navegador).

## Cómo funciona

- **Hoy te toca:** los días van en orden (1 → 2 → 3 → 4 → 1…), no por fecha. Si faltas un día, sigues con el que tocaba.
- **Durante el entrenamiento:** escribe kg y repeticiones y toca ✓. Si dejas una casilla vacía, se usa lo que
  hiciste la última vez (el número gris). Al marcar una serie arranca el **temporizador de descanso**.
- **Máquina ocupada:** cambia la variante en el desplegable. Cada variante guarda su propio historial.
- **Pistas:** si la última vez llegaste al tope de repeticiones en todas las series, la app te avisa que subas el peso.
- Lo que anotas se guarda en el celular mientras entrenas (aunque cierres la app) y se sube a Supabase al
  tocar **Terminar**. Si no hay conexión, no se pierde nada: vuelve a tocar «Terminar» cuando tengas señal.
- **Cambiar la rutina:** edita `js/routine.js` (ejercicios, series, repeticiones, descanso, variantes).
  No cambies el `key` de un ejercicio que ya tiene datos.

## Configuración (una vez, ~10 min)

1. **Tablas:** Supabase (el proyecto de Repasito) → *SQL Editor* → *New query* → pega todo
   `supabase/schema.sql` → *Run*. Solo crea tablas nuevas (`gym_…`); no toca nada de Repasito.
2. `js/config.js` ya tiene las mismas claves que Repasito. No hay que cambiar nada.
3. **Publicarla:** en GitHub crea un repositorio nuevo (p. ej. `fuercita`) y sube el contenido de esta carpeta
   (*Add file → Upload files*). Luego *Settings → Pages → Deploy from a branch → `main` / `(root)`*.
   En 1–2 minutos estará en `https://TU-USUARIO.github.io/fuercita/`.
4. En el celular ábrela, entra con tu correo y contraseña de Repasito y usa
   **Compartir → Agregar a pantalla de inicio**.

## Archivos
- `index.html`, `styles.css`, `js/` – la web (sin compilación; se publica tal cual).
- `js/routine.js` – la rutina. `js/store.js` – datos (Supabase o demo). `js/app.js` – pantallas.
- `supabase/schema.sql` – tablas y seguridad (cada usuaria solo ve sus propios datos).
