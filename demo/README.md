# Demo interactiva de UPCHub

Demo simulada en `/demo/` (https://upchub.tech/demo/) para que la gente pruebe la interfaz y nos diga si se entiende. Es una propuesta académica de DIBA (EPSEVG · UPC), con datos ficticios y sin carácter oficial.

- Sin servidor ni build: `index.html`, `demo.css`, `demo.js`, `i18n-demo.js` e `icons.svg`.
- **v3 (tras la prueba con usuarios): tres recorridos cortos**. Lo que no está en ellos se ha quitado.
  - **Alumno** (`#alumne`, móvil):
    1. Activa el carnet: empieza «Sense activar», con un anillo NFC y la acción para simular el lector.
    2. Avisa de un problema en 3 toques: categoría (Projector, Endoll, Aire/temperatura, Mobiliari, Altres con texto), gravedad percibida (poc greu / greu / molt greu) y enviar. El número de enchufe y la foto son opcionales; la foto solo aparece en Endoll y Mobiliari.
    3. Ve el seguimiento: Rebuda → En curs → Resolta, tiempo de espera estimado, «Com es calcula?» (gravedad, urgencia y aforo) y «Tornar a avisar», que suma un aviso y recalcula la espera.

    Los avisos de frío o calor no van al técnico: el aula se regula sola si está fuera de los límites de ejemplo (21–25 °C) o se avisa al profesor.
  - **Profesor** (`#professor`, móvil):
    1. Acerca el móvil al lector.
    2. Tablero: selector «Aula 205 · Canviar», cuatro equipos (tocar uno en rojo abre el asistente con ese equipo; con aviso abierto muestra «Tècnic en ~X min») y la temperatura con «Ajustar».
    3. Asistente: chat limpio cada vez, pasos con barra «Pas n de 3», «Ho he fet» o «No funciona» en cada paso y «S'ha resolt?» al final. «Trucar al tècnic ara» está siempre visible.

    Al cambiar de aula, si hay un aviso abierto pregunta «Has resolt el problema?»; por defecto sigue abierto. Cada aula tiene su propio estado. Los avisos de temperatura del alumnado llegan como aviso emergente con «Ajustar», «Ja ho he fet» o «Ignorar».
  - **Técnico** (`#tecnic`, ordenador):
    - cola e historial con pestañas Pendents / Resoltes / Tot y filtro por edificio;
    - ficha con la gravedad percibida, los reavisos, los pasos ya probados con el asistente, el cálculo de la prioridad y el estado del aula (con CO₂);
    - cierre con «Resoldre» e indicando qué se ha hecho.
- **Prioridad**: P = gravedad × urgencia × aforo, cada factor de 1 a 3. La gravedad sale del tipo de equipo y de lo que indica quien avisa; la urgencia, de si hay clase ahora (+1 con reavisos); el aforo, de si afecta a toda el aula o a una persona. La espera estimada es crítico ~15 min, alto ~40 min, normal ~2 h y bajo ~1 día, más 10 min por cada incidencia más urgente en la cola.
- **Nombres**:
  - **Avís**: lo que alguien envía.
  - **Incidència**: la ficha de la cola del técnico.
  - **Notificació**: lo que llega al móvil.
  - **El meu seguiment**: la lista del alumno.
  - **Avís de l'alumnat**: el aviso emergente que ve el profesor.
- **Pendiente de decidir**: el técnico tiene un filtro por edificio (A, B y C son de ejemplo) porque en la prueba se preguntó si habría un servicio técnico por edificio. La demo no lo decide.
- Encuesta en `#enquesta` y página de privacidad y datos en `#dades`. El botón «Comentari» de la cabecera abre un comentario rápido desde cualquier pantalla. Cada tarea termina con una nota de facilidad (1–5) y tiene un botón de pistas.
- El estado compartido entre roles se guarda en `localStorage` con la clave `upchub-demo-state`; con dos pestañas abiertas, los cambios se ven en directo. El reloj de la demo empieza el lunes a las 9:00 y avanza en tiempo real.
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
