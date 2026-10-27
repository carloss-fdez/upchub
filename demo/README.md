# Demo interactiva de UPCHub

Demo simulada en `/demo/` (https://upchub.tech/demo/) para que la gente pruebe la interfaz y nos diga si se entiende. Es una propuesta académica de DIBA (EPSEVG · UPC), con datos ficticios y sin carácter oficial.

- Sin servidor ni build: `index.html`, `demo.css`, `demo.js`, `i18n-demo.js` e `icons.svg`.
- Tres roles con su tarea:
  - **Alumno** (`#alumne`): app del campus con pestañas Aula, Horario y Avisos. Solo puede avisar de enchufes, clima, luz y mobiliario; los equipos audiovisuales los gestiona el profesor. Recibe notificaciones push simuladas.
  - **Profesor** (`#professor`): pantalla del aula o móvil del profesor, con un interruptor en el panel izquierdo. Incluye:
    - inicio de sesión NFC;
    - panel con equipos que se pueden tocar, climatización ajustable y avisos del alumnado;
    - ayuda de la IA con pasos que se marcan;
    - aviso al técnico;
    - **cambio de aula con notificación push** al alumnado.
  - **Técnico** (`#tecnic`): incluye:
    - cola por prioridad con filtros;
    - ficha con «Empezar a atenderla» y cierre indicando qué se ha hecho;
    - **historial del día** con todo lo que ha pasado y ha cambiado, filtrable por aula y tipo.
- Encuesta en `#enquesta` y página de privacidad y datos en `#dades`. El botón «Comentari» de la cabecera abre un comentario rápido desde cualquier pantalla.
- El estado compartido entre roles (cola, equipos, clima, aula actual, historial y notificaciones) se guarda en `localStorage` con la clave `upchub-demo-state`. Con dos pestañas abiertas, los cambios se ven en directo. El reloj de la demo empieza el lunes a las 9:00 y avanza en tiempo real.
- El botón «Reiniciar» vuelve a los datos de ejemplo. No borra el registro de uso ni el consentimiento.

## Registro de interacciones y comentarios

Al entrar se pide consentimiento con un aviso que no bloquea la demo («D'acord» / «No, gràcies»). Solo si se acepta, se registra de forma anónima:

| Tipo | Qué guarda |
|---|---|
| `vista`, `pantalla` | rol abierto y pantalla mostrada |
| `clic`, `tria` | control pulsado o elegido (id y texto del botón, nunca lo escrito en campos de texto) |
| `tasca` | rol, tiempo, pasos y si se acertó (p. ej. si el técnico abrió primero la más urgente) |
| `error` | errores de validación (enviar sin elegir tipo, etc.) |
| `full`, `idioma`, `comentari`, `enquesta`, `inici` | detalle lateral abierto, cambio de idioma, envíos y tamaño de pantalla |

Cada evento lleva un identificador aleatorio de sesión (`sessionStorage`), la hora, el idioma y si es móvil u ordenador. No hay cookies ni analítica de terceros.

Los datos siempre se guardan también en el navegador. Se pueden descargar en JSON desde `#dades` («Descarregar»), lo que sirve, por ejemplo, para recoger lo que se haya hecho en el portátil del equipo durante una presentación.

### Recogerlos en un Google Sheet

1. Crea un Google Sheet con la cuenta del equipo.
2. Ve a «Extensiones → Apps Script» y pega `demo/backend/apps-script.gs`.
3. Pulsa «Implementar → Nueva implementación → Aplicación web», con «Ejecutar como: yo» y «Acceso: cualquier persona». Copia la URL que termina en `/exec`.
4. Ponla en `ENDPOINT`, al principio de `demo/demo.js`, y sube el `?v=` de `demo.js` en `demo/index.html`.

El script crea solo las hojas `esdeveniments`, `enquesta`, `comentaris` y un `resum` con indicadores: sesiones, tareas acabadas por rol, errores, respuestas, claridad media, comentarios y pantallas más vistas.

Las encuestas y los comentarios se envían cuando la persona pulsa «Enviar», aunque no haya aceptado el registro de uso: enviarlos ya es una acción explícita.

## Idiomas

El HTML está en catalán. Castellano e inglés se traducen en `i18n-demo.js`, con el texto catalán como clave, igual que en la web. Si cambias un texto en `index.html` o en `demo.js`, actualiza su clave en los dos diccionarios.
