# Rutinas

App web instalable (PWA) para que un entrenador lleve las rutinas de sus alumnos y anote el peso de cada serie desde el celular.

- **Alumnos**, cada uno con sus **rutinas** (una activa, las anteriores quedan guardadas), cada rutina con **días** y cada día con **ejercicios** (series, repeticiones, descanso, indicaciones).
- **Pegar rutina**: se pega el texto tal como se manda por WhatsApp ("Día 1", un ejercicio por renglón) y la app arma días y ejercicios. También se puede copiar una rutina de otro alumno o cargarla a mano.
- **Anotar**: en cada día, un casillero de kilos por serie. Muestra lo de la vez anterior y el récord, avisa cuando hay récord nuevo y se guarda solo.
- **Varios alumnos a la vez**: cada alumno que se abre queda "en sala". Arriba de la pantalla de anotar hay un botón por alumno (con cuántos ejercicios lleva completos) para pasar de uno a otro con un toque, y cada uno vuelve a la altura donde estaba. "+ Alumno" suma a otro y va directo al día que le toca. En Inicio aparecen en "Entrenando ahora". Salen con "terminó por hoy" o solos después de 3 horas sin anotar.
- **Progreso**: por ejercicio, el peso máximo de cada sesión en un gráfico y la lista de sesiones. Sigue sumando entre rutinas si el ejercicio se llama igual.
- **Sin internet**: una vez abierta, funciona offline (service worker).

## Dónde quedan los datos

En el teléfono (IndexedDB del navegador). No hay servidor ni cuentas. Por eso existe **Ajustes → Copia de seguridad**: genera un `.json` que se puede mandar a WhatsApp, Drive o mail, y **Restaurar** lo vuelve a cargar (en el mismo teléfono o en otro). La pantalla principal recuerda hacer la copia si pasaron más de 7 días.

En iPhone la app instalada (Agregar a inicio) guarda los datos aparte de Safari: conviene instalarla antes de cargar datos.

## Desarrollo

Requiere Node 20 o más nuevo.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests del lector de rutinas
npm run build      # genera dist/
npm run preview    # sirve dist/ para probar la PWA
```

Íconos: se generan desde `public/logo.svg` con `npx pwa-assets-generator` (config en `pwa-assets.config.ts`).

## Publicar

Publicada en GitHub Pages: cada push a `main` corre los tests, compila y publica (`.github/workflows/publicar.yml`).

`dist/` es un sitio estático. Sirve cualquier hosting con **HTTPS** (requisito para instalarla y para que funcione offline): GitHub Pages, Netlify, Cloudflare Pages o una carpeta de nginx. Las rutas usan `#/...` y `base: './'`, así que no hace falta configurar reescrituras y puede ir en una subcarpeta.

Stack: React 19 + TypeScript + Vite + Tailwind 4, Dexie (IndexedDB), vite-plugin-pwa.
