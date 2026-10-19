# Plan de correccion: H-01, H-04 y H-06

## Seleccion y alcance

Se seleccionan tres hallazgos pendientes de mayor severidad, priorizando evidencia concreta: H-01 (alta), H-04 (media, uso dinamico de HTML confirmado) y H-06 (media, tipado incompleto y cambio de comportamiento con JSON `null`). H-02 y H-03 tienen severidad media provisional, pero dependen de una auditoria de dependencias no disponible y no se afirma que exista un CVE aplicable.

La autorizacion previamente registrada cubre H-04 y H-06, pero excluia H-01. Este documento propone un alcance para H-01; no amplia aquella aprobacion ni autoriza implementacion. No se modifica codigo en esta etapa.

Contrato a preservar: `POST /auth/login` con `username`, `password`, `client: 'angular-workshop'` y timeout de 5000 ms; `GET /api/tasks?owner=<username>` con `Authorization: Bearer <token>`; logout sin llamada HTTP. Las respuestas y errores del servidor no se amplian ni se inventan. Referencia: [docs/ENDPOINTS.md](docs/ENDPOINTS.md). Las convenciones aplicables son tipado sin `any`, interpolacion textual, errores publicos seguros, responsabilidades separadas y ausencia de valores magicos: [docs/GOOD_PRACTICES.md](docs/GOOD_PRACTICES.md).

## Item: Token persistido en localStorage (H-01)

**Item de HALLAZGOS.md.** H-01, severidad alta, estado Pendiente. [SessionService](src/app/services/session.service.ts) persiste `workshop_token` en `localStorage`; ese almacenamiento es accesible a JavaScript del mismo origen.

**Problema.** Un script que se ejecute en el origen puede leer un token persistente y reutilizarlo. El frontend actual no ofrece una alternativa de cookie HttpOnly ni un contrato de renovacion con el servidor.

**Cambio propuesto.** Mantener el token solo en memoria en `SessionService`; seguir guardando el usuario y las preferencias de acuerdo con su comportamiento actual. Tras recargar la aplicacion, al no haber token en memoria, el dashboard debe volver al login y no enviar el GET de tareas. Logout borra el token en memoria y conserva las preferencias. Las URLs, cuerpos, headers Bearer y respuestas HTTP no cambian. Esto reduce la persistencia del token, pero no impide que JavaScript activo del mismo origen lea el token durante la sesion. Si el producto exige conservar autenticacion tras recarga, una cookie HttpOnly requiere soporte y coordinacion del backend; no se simulara desde el cliente ni se incluira en este cambio.

**Archivos propuestos.** `src/app/services/session.service.ts` y su prueba; pruebas de flujo en `src/app/auth-flow.spec.ts`; `src/app/dashboard/dashboard.component.ts` solo si necesita manejar el token ausente tras recarga; `docs/ENDPOINTS.md` para reflejar el nuevo ciclo de sesion. No modificar el contrato de los endpoints.

**Prueba de caracterizacion antes de tocar produccion.** Sobre el codigo actual, comprobar que `saveSession()` escribe `workshop_token`, que una nueva instancia puede recuperarlo desde el almacenamiento, que el GET usa el Bearer esperado y que logout elimina token/usuario pero conserva preferencias. Despues de implementar el cambio, conservar las aserciones HTTP y agregar la caracterizacion de recarga: una nueva instancia no recupera token, no consulta tareas y navega a `/login`. Reportar expresamente el cambio de persistencia y su riesgo residual; no declarar que el token deja de ser accesible a JavaScript.

## Item: Mensaje dinamico construido como HTML (H-04)

**Item de HALLAZGOS.md.** H-04, severidad media, estado Pendiente. El login concatena el nombre de usuario y detalles de error en un string que la plantilla enlaza mediante `[innerHTML]` ([login.component.ts](src/app/login/login.component.ts), [login.component.html](src/app/login/login.component.html)). Angular aplica sanitizacion al binding; no se afirma un bypass ni XSS ejecutable.

**Problema.** Datos del usuario y del backend llegan a un contexto HTML. Ademas, mensajes arbitrarios del backend se exponen en la UI y `console.error(error)` puede registrar el objeto Axios completo, cuya configuracion puede incluir el cuerpo de autenticacion.

**Cambio propuesto.** Reemplazar `[innerHTML]` por interpolacion de texto y mantener cualquier formato como marcado fijo de plantilla. Presentar mensajes publicos constantes por contexto (validacion/login/carga de tareas), sin mostrar `response.data.message`, `detail` ni `error.message` arbitrarios. Evitar registrar objetos de error completos; no registrar credenciales ni token. Conservar el contrato HTTP, la secuencia de navegacion y la recuperacion de `busy`/`loading`. No usar `bypassSecurityTrustHtml`.

**Archivos propuestos.** `src/app/login/login.component.html`, `src/app/login/login.component.ts`, `src/app/dashboard/dashboard.component.ts`, `src/app/utils/error-message.ts` y sus pruebas. La plantilla del dashboard solo se modificaria si la prueba requiere ajustar accesibilidad del mensaje; preferir agregar `aria-live` al texto de estado. Si la prueba de plantilla no puede correr en el entorno Node actual, primero demostrar esa limitacion; `jsdom` y el lockfile solo se agregarian con justificacion, version compatible verificada y auditoria, sin migrar Vitest.

**Prueba de caracterizacion antes de tocar produccion.** Con una prueba DOM, comprobar el estado actual de un usuario que contiene marcado benigno y un error que contiene detalle interno: registrar que el binding actual crea/renderiza el contenido permitido por Angular Sanitizer, sin payloads de explotacion. Luego escribir la prueba de correccion: el usuario se presenta como texto, no se crean nodos a partir de datos dinamicos y el detalle interno no aparece; los mensajes publicos de login/tareas se anuncian como texto. Mantener pruebas de error de red, timeout y token rechazado para verificar `busy`/`loading`.

## Item: Uso de any y cambio de comportamiento con usuario null (H-06)

**Item de HALLAZGOS.md.** H-06, severidad media, estado Pendiente. Los `any` explicitos ya fueron reemplazados en parte, pero [SessionService.getUser()](src/app/services/session.service.ts) convierte JSON `null` en `{}`. Con token presente, esto puede producir un GET de tareas con `owner=` en vez de detener el flujo ante el usuario nulo.

**Problema.** El estrechamiento de tipos no debe ocultar errores ni cambiar silenciosamente el comportamiento de datos persistidos malformados. En particular, el tipo actual `UserProfile` no representa `null`, aunque el almacenamiento JSON puede contenerlo.

**Cambio propuesto.** Mantener los modelos tipados y `unknown` en limites deserializados, sin `any` ni aserciones dobles. Representar explicitamente el resultado nulo de la lectura de usuario y tratarlo antes de construir la URL: no enviar la consulta con `owner=` cuando no existe un usuario valido. Mantener las respuestas visibles y los estados de carga; no limpiar la sesion ni redirigir sin una decision documentada. No ampliar validaciones de tareas ni cambiar el comparador, filtros o campos HTTP.

**Archivos propuestos.** `src/app/models/auth.ts`, `src/app/services/session.service.ts`, `src/app/dashboard/dashboard.component.ts`, `src/app/auth-flow.spec.ts` y `src/app/services/session.service.spec.ts`. Actualizar `HALLAZGOS.md` solo cuando las pruebas y la compilacion verifiquen la correccion.

**Prueba de caracterizacion antes de tocar produccion.** Agregar y ejecutar primero una prueba con token presente y `workshop_user` guardado como JSON `null`, que compruebe el comportamiento de la version base (sin GET a tareas y con el error/estado de carga resultante, no una consulta con owner vacio). Caracterizar por separado JSON sintacticamente invalido, usuario objeto valido, token ausente y respuesta de tareas valida. La prueba no debe afirmar como correcto el GET con `owner=` observado en la implementacion intermedia. Despues del cambio, repetirla y comprobar que el request valido conserva URL y Bearer exactos.