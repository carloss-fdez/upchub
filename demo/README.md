# Demo interactiva de UPCHub

Demo simulada en `/demo/` (https://upchub.tech/demo/) para que la gente pruebe la interfaz y nos diga si se entiende. Propuesta académica de DIBA (EPSEVG · UPC), con datos ficticios y sin carácter oficial.

- Sin servidor ni build: `index.html`, `demo.css`, `demo.js`, `i18n-demo.js` e `icons.svg`.
- Tres roles con su tarea: alumno (`#alumne`), profesor (`#professor`) y técnico (`#tecnic`). La encuesta está en `#enquesta`.
- El estado compartido entre roles (cola de incidencias, equipos del aula 205 y métricas) se guarda en `localStorage` con la clave `upchub-demo-state`. Si el navegador lo bloquea, la demo funciona igual en memoria mientras la pestaña siga abierta. Con dos pestañas abiertas, los cambios se ven en directo.
- El botón «Reiniciar» de la cabecera vuelve a los datos de ejemplo.

## Idiomas

El HTML está en catalán. Castellano e inglés se traducen en `i18n-demo.js`, con el texto catalán como clave, igual que en la web. Si cambias un texto en `index.html` o en `demo.js`, actualiza su clave en los dos diccionarios.

## Medición

Al terminar cada tarea se guardan solo en el navegador el tiempo, el número de pasos (clics y toques dentro de la simulación) y, en el técnico, si la primera incidencia abierta era la más urgente. No se guarda ningún dato personal.

## Conectar la encuesta con un formulario externo

Mientras `FORM.url` (al principio de `demo.js`) esté vacía, no se envía nada y las respuestas se quedan en el navegador. Para recogerlas con Google Forms:

1. Crea un formulario anónimo (sin recopilar correos ni pedir inicio de sesión) con seis preguntas de respuesta corta: entendido, claridad, qué cambiarías, tareas, idioma y dispositivo.
2. En el menú ⋮ elige «Obtener enlace prerrellenado», escribe algo en cada pregunta y copia el enlace. Cada campo aparece como `entry.123456789=...`.
3. En `demo.js` pon en `FORM.url` la dirección del formulario cambiando `/viewform` por `/formResponse`, y copia cada `entry.XXXX` en `FORM.fields`:

```js
var FORM={
  url:'https://docs.google.com/forms/d/e/ID_DEL_FORMULARIO/formResponse',
  fields:{understood:'entry.111',clarity:'entry.222',change:'entry.333',tasks:'entry.444',lang:'entry.555',device:'entry.666'}
};
```

4. Sube el `?v=` de `demo.js` en `index.html` para evitar la caché.

Valores que se envían, solo si la persona pulsa «Enviar respuestas»:

| Campo | Ejemplo |
|---|---|
| `understood` | `si`, `en-part`, `no` |
| `clarity` | `1`–`5` |
| `change` | texto libre, como máximo 500 caracteres (opcional) |
| `tasks` | `alumne:34s,6p;professor:-;tecnic:12s,2p,primera-ok` |
| `lang` | `ca`, `es`, `en` |
| `device` | `mobil` u `ordinador` |

El envío usa `fetch` sin cookies (`credentials: 'omit'`) y sin referrer. La demo no usa cookies ni analítica.
