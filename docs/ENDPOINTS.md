# Endpoints consumidos

Este documento describe el contrato que el frontend usa actualmente. No se inspecciono ni se llamo a los backends; los ejemplos de respuesta se toman de los fixtures de Vitest, no son respuestas capturadas en ejecucion. Los callers hacen Axios directamente desde los componentes; `SessionService` centraliza la sesion, pero no envia HTTP. No se encontro configuracion de ambiente ni un servicio HTTP separado para estos endpoints.

## 1. Login

### 1. Quien lo llama

`LoginComponent.login()` envia la solicitud con Axios. En un exito con token, delega el guardado de token, usuario y preferencias a `SessionService.saveSession()` y navega a `/dashboard`.

### 2. Que envia

| Elemento | Valor |
| --- | --- |
| Metodo y URL | `POST http://localhost:8080/auth/login` |
| Headers de aplicacion | Ninguno se pasa explicitamente a Axios en esta llamada. Los headers de transporte efectivos no se fijan en el componente. |
| `username` | Texto ingresado. Se comprueba que no sea vacio tras `trim()`, pero se envia el valor original. |
| `password` | Texto ingresado. Se comprueba que no sea vacio tras `trim()`, pero se envia el valor original. |
| `client` | Literal `angular-workshop`. |
| Timeout | 5000 ms, configurado en Axios. |

Ejemplo del cuerpo usado por la prueba de flujo:

```json
{
	"username": "student",
	"password": "Workshop123!",
	"client": "angular-workshop"
}
```

### 3. Que espera recibir en exito

El frontend no comprueba un codigo numerico exacto. Si Axios resuelve la promesa, examina `response.data.token`; Axios con su configuracion predeterminada resuelve respuestas 2xx. `LoginResponse` tipa `token` como opcional y `user` como requerido, pero no hay validacion de esquema en runtime.

| Campo de `response.data` | Uso en el frontend |
| --- | --- |
| `token` | Debe ser truthy para guardar sesion y navegar. Se conserva solo en memoria de `SessionService`; no se escribe en almacenamiento persistente. |
| `user` | Se serializa en `workshop_user`. El dashboard consume `username`; la plantilla muestra `displayName || username`. Ambos campos estan declarados opcionales y como `unknown` en el modelo. |

Ejemplo de forma tomado del mock de Vitest (el valor del token es de prueba):

```json
{
	"token": "session-token",
	"user": {
		"username": "student",
		"displayName": "Student"
	}
}
```

El componente no consume ni valida otros campos de la respuesta.

### 4. Errores y reaccion de la UI

| Situacion | Reaccion del frontend |
| --- | --- |
| Usuario o contrasena vacios tras `trim()` | No envia HTTP. Muestra el mensaje de validacion correspondiente. Si ambos faltan, valida primero el usuario. |
| Respuesta resuelta sin `token` truthy | Muestra `El backend respondió sin token.`; no guarda sesion ni navega. |
| Respuesta HTTP rechazada, error de red o timeout Axios de 5000 ms | `getErrorMessage()` usa primero `error.response.data.message`, luego `error.message` y finalmente `Error desconocido`. La UI forma `No se pudo autenticar a <username>.` seguido por ese texto. `finally` pone `busy` en `false`. |
| Token truthy pero invalido | El login no puede comprobar su validez. Lo guarda y navega; el rechazo de la consulta de tareas se maneja en el endpoint siguiente. |
| `user` ausente o con forma distinta | No hay validacion runtime antes de guardar. Para `user: null`, se guarda `null` como JSON; al leerlo, `SessionService` lo convierte a `{}` y el dashboard consulta tareas con `owner=`. El esquema real del backend sigue siendo pregunta abierta. |

Durante la solicitud, `busy` deshabilita el boton. El error completo tambien se envia a `console.error`.

### 5. Notas de seguridad y preguntas abiertas

`SessionService` mantiene el token solo en memoria y elimina de `localStorage` cualquier `workshop_token` persistido por una version anterior. El usuario y `workshop_preferences` permanecen en `localStorage`. El token sigue siendo accesible a JavaScript del mismo origen mientras la aplicacion esta activa; no se mueve a cookies ni se valida su firma. Tras recargar, no hay token en memoria y el dashboard navega a `/login` sin consultar tareas. La respuesta de error y el nombre de usuario se concatenan en un mensaje que la plantilla muestra con `[innerHTML]`; Angular aplica su sanitizacion predeterminada, pero el binding dinamico sigue presente y no debe describirse como eliminado. No se verifico el contrato completo del backend.

Preguntas abiertas: codigo de exito exacto del backend, headers efectivos en la red, esquema completo de `user` y estructura de todas las respuestas de error.

## 2. Consulta de tareas

### 1. Quien lo llama

`DashboardComponent.ngOnInit()` envia la consulta con Axios despues de leer token y usuario desde `SessionService`. La transformacion y el estado de la vista siguen en el componente.

### 2. Que envia

| Elemento | Valor |
| --- | --- |
| Metodo y URL | `GET http://localhost:8000/api/tasks?owner=<username>` |
| Query `owner` | `String(user.username || '')`, concatenado directamente; no se codifica explicitamente como URL component. |
| Header `Authorization` | `Bearer <token>` obtenido de `SessionService.getToken()`. |
| Body | No se pasa body a `axios.get()`. |
| Timeout | La llamada no especifica timeout. Si existe una configuracion global de Axios ajena al codigo inspeccionado, no esta documentada aqui. |

Ejemplo tomado del mock de flujo:

```http
GET /api/tasks?owner=student HTTP/1.1
Host: localhost:8000
Authorization: Bearer session-token
```

### 3. Que espera recibir en exito

El componente usa `response.data` como `Task[]`; no inspecciona un codigo numerico concreto. Una respuesta resuelta por Axios (2xx con configuracion predeterminada) pasa a la vista.

| Campo por tarea | Tipo declarado y uso |
| --- | --- |
| `status` | `string`; se excluyen tareas cuyo valor sea exactamente `ARCHIVED` y se presenta una etiqueta de estado. |
| `priority` | `string` opcional; se usa para ordenar y para formar `label`. |
| `owner` | `string` opcional; se usa para formar `label`. |
| `title` | `string`; se muestra como titulo. |
| `description` | `string`; se muestra como descripcion. |
| `label` | Campo agregado localmente por el frontend; no es requerido en la respuesta. |

Ejemplo de `response.data` tomado del fixture de Vitest:

```json
[
	{
		"status": "TODO",
		"priority": "HIGH",
		"owner": "student",
		"title": "Visible task",
		"description": "Details"
	},
	{
		"status": "ARCHIVED",
		"priority": "LOW",
		"owner": "student",
		"title": "Archived task",
		"description": "Old"
	}
]
```

La UI excluye `ARCHIVED`, agrega `label` con prioridad y owner en mayusculas, y conserva el comparador actual `a.priority > b.priority ? -1 : 1`. No se afirma un orden de negocio distinto. En exito, `loading` pasa a `false`; si no hay tareas visibles se muestra el estado vacio.

### 4. Errores y reaccion de la UI

| Situacion | Reaccion del frontend |
| --- | --- |
| No hay token en memoria, incluso tras recargar | Navega a `/login` y retorna sin hacer GET. |
| Token invalido o error HTTP (por ejemplo, respuesta no 2xx) | Axios rechaza; el componente usa `error.response.data.detail`, despues `error.message` y finalmente `No se pudo cargar el dashboard`. Muestra el texto en la vista, pone `loading` en `false` y conserva la sesion: no limpia token ni redirige automaticamente. El status que usa el backend para token invalido no esta confirmado. |
| Error de red o timeout impuesto externamente | Si Axios rechaza, se sigue el mismo `catch`; esta llamada no configura su propio timeout. Si la promesa queda pendiente, el componente mantiene el estado `loading`. |
| Usuario persistido como JSON `null` | `SessionService.getUser()` lo convierte a `{}`; con token presente el dashboard envia el GET con `owner=`. |
| `response.data` es `null` o un item causa una excepcion al procesarse | La excepcion ocurre dentro del `try`; se muestra su `message` o el fallback y `loading` termina. |
| Respuesta con forma distinta pero sin excepcion, por ejemplo objeto sin `length` | No se valida `Array.isArray`. El bucle no agrega tareas visibles y la vista puede terminar en el estado vacio aunque `response.data` no sea una lista. |
| JSON invalido en `workshop_user` | `SessionService.getUser()` parsea antes del `try` de la consulta; `ngOnInit()` rechaza, no envia GET y el componente no convierte ese error a su mensaje normal de carga. |

### 5. Notas de seguridad y preguntas abiertas

El token Bearer se lee de la memoria de `SessionService`; no se valida localmente ni se limpia cuando el backend rechaza la consulta. Usuario y preferencias siguen en `localStorage`. La plantilla del dashboard interpola `error` como texto, no usa `[innerHTML]`. Logout no llama a un endpoint, limpia el token en memoria y el usuario persistido, conserva preferencias y navega a `/login`.

Preguntas abiertas: codigo y esquema exactos para token invalido, timeout efectivo del cliente o proxy, si `owner` admite caracteres que requieran codificacion, y esquema garantizado para `response.data`.

## Referencias

Frontend consultado: [LoginComponent](../src/app/login/login.component.ts), [DashboardComponent](../src/app/dashboard/dashboard.component.ts), [SessionService](../src/app/services/session.service.ts), [modelos de autenticacion](../src/app/models/auth.ts), [modelo de tareas](../src/app/models/task.ts), [mapeo de errores](../src/app/utils/error-message.ts), [plantilla de login](../src/app/login/login.component.html) y [fixture del flujo](../src/app/auth-flow.spec.ts). La disponibilidad de los backends, CORS y respuestas reales no se comprobaron.