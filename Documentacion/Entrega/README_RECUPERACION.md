# Funcionalidad propia Plan de recuperación

Se incorporó un plan de recuperación para organizar acciones después de incumplir una semana. El plan tiene un objetivo, una fecha límite y entre 1 y 12 acciones. Su progreso se calcula a partir de las acciones realizadas y se conserva en MySQL para consultarlo desde la web y Android.

## Propósito y diferencia con la guía

La guía muestra semanas en rojo y alertas. Esta función añade un proceso para actuar sobre ese incumplimiento: definir un objetivo, completar acciones y consultar un resultado independiente del seguimiento original.

Una semana cerrada al 5 % conserva ese porcentaje y su estado rojo. Completar el 100 % del plan significa realizar sus acciones; no cambia el porcentaje histórico de la semana ni desbloquea su edición.

## Uso

1. Abrir el detalle de un reto que tenga una semana cerrada en rojo.
2. Pulsar **Crear plan de recuperación** en esa semana.
3. Escribir el objetivo, seleccionar la fecha límite y completar las acciones.
4. Guardar el plan y marcar las acciones conforme se realizan.
5. Abrir la misma semana en Android para consultar y continuar el plan. El botón **Actualizar** consulta el último estado guardado por cualquiera de las dos interfaces.

Al volver al detalle de la semana, el botón cambia a **Ver plan de recuperación**.

## Reglas

- Solo se admite un plan por semana, y únicamente si ya cerró con menos del 10 %.
- El objetivo y las acciones son obligatorios. No se admiten acciones repetidas ni una fecha límite anterior al día de creación.
- Las casillas se pueden marcar y desmarcar. El servidor registra o elimina la fecha de realización según corresponda.
- El progreso representa la cantidad de acciones realizadas respecto al total: con tres acciones, los resultados son 0 %, 33 %, 67 % y 100 %.
- El servidor determina el estado: **Pendiente**, **En recuperación**, **Vencido** o **Completado**.
- Un plan vencido todavía permite completar acciones. Al terminarlas, su estado pasa a Completado y conserva las fechas registradas de realización.
- Si falla el guardado, la interfaz conserva el formulario o revierte la casilla para evitar mostrar un progreso que no se almacenó.

## Estructura y archivos modificados

Se mantiene la organización del proyecto existente.

| Ubicación | Responsabilidad |
|---|---|
| `backend/retos/models.py` | Modelos PlanRecuperacion y AccionRecuperacion, y cálculo del estado y progreso. |
| `backend/retos/migrations/0003_planrecuperacion_accionrecuperacion.py` | Creación de las tablas y relación de un plan por semana. |
| `backend/retos/serializers.py` | Validaciones, creación atómica y guardado de las acciones. |
| `backend/retos/filtros.py` | Consulta de planes por reto o tarea. |
| `backend/retos/views.py` y `backend/retos/urls.py` | API de recuperación y actualización de acciones dentro de su plan. |
| `backend/retos/tests_recuperacion.py` | Nueve pruebas de integración de la función. |
| `frontend/src/app/core/modelos.ts` | Tipos del plan, las acciones y sus estados. |
| `frontend/src/app/core/retos-api.service.ts` | Solicitudes HTTP de recuperación. |
| `frontend/src/app/paginas/recuperacion.page.ts` | Formulario, progreso, estados y lista de acciones. |
| `frontend/src/app/paginas/recuperacion.page.spec.ts` | Tres pruebas sobre guardado, errores y conservación de los datos de la interfaz. |
| `frontend/src/app/paginas/reto-detalle.page.ts` | Acceso al plan desde una semana en rojo. |
| `frontend/src/app/app.routes.ts` | Ruta `recuperaciones/:tareaId`. |

Android utiliza la misma pantalla compilada mediante Capacitor. No se creó una segunda implementación de la interfaz ni se reorganizaron las carpetas.

## API

- `GET /api/recuperaciones/` — consulta de planes; admite los filtros `tarea` y `reto`.
- `POST /api/recuperaciones/` — creación con tarea, objetivo, fecha límite y acciones.
- `GET /api/recuperaciones/{id}/` — estado persistido de un plan.
- `PATCH /api/recuperaciones/{id}/acciones/{accion_id}/` — cambia `completada` y devuelve el plan actualizado.

Los estados, el progreso y las fechas de realización se calculan o registran en el servidor. Una acción de otro plan no puede modificarse mediante la ruta de un plan distinto. Las rutas existentes de semanas mantienen el rechazo HTTP 400 al intentar editar una semana cerrada.

## Pruebas y compilación

Desde `backend`:

```powershell
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py test retos -v 2
```

Se aprobaron 14 pruebas: las cinco originales y nueve de recuperación. Las nuevas comprueban elegibilidad, fechas, acciones inválidas, duplicados, progreso persistente, marcas de tiempo, vencimiento, aislamiento entre planes y conservación del bloqueo original.

Desde `frontend`:

```powershell
npx.cmd ng test --watch=false
npm.cmd run build
npx.cmd cap sync android
```

Se aprobaron 12 pruebas en total. La compilación web termina correctamente con la advertencia de tamaño del paquete inicial de aproximadamente 1,21 MB. Después de sincronizar, el proyecto Android se compila con JDK 21 y se instala en el emulador.

## Evidencia de funcionamiento en web y Android

Se creó el plan desde la web para la semana 7 del reto **Lectura por recuperar**, cerrada al 5 %. Se marcó la primera acción en la web (33 %), la segunda en Android (67 %) y la tercera en la web (100 %). Al pulsar **Actualizar**, ambas interfaces mostraron el mismo resultado guardado en MySQL.

- [Creación del plan](capturas/06-web-crear-plan.png)
- [Primera acción en la web al 33 %](capturas/06-web-plan-33.png)
- [El mismo 33 % en Android](capturas/06-android-plan-33.png)
- [Segunda acción en Android al 67 %](capturas/06-android-plan-67.png)
- [El 67 % consultado desde la web](capturas/06-web-plan-67.png)
- [Plan completado en la web](capturas/06-web-plan-completado.png)
- [Plan completado en Android](capturas/06-android-plan-completado.png)
- [Semana original cerrada al 5 %](capturas/06-semana-original-bloqueada.png)
- [Verificación persistida y rechazo HTTP 400](06-verificacion-recuperacion.json)

La comprobación final se realizó con APIClient de Django contra la base MySQL del proyecto. Se verificó el plan completado, las tres acciones realizadas y el rechazo HTTP 400 al intentar cambiar la semana cerrada. Los porcentajes de los retos previos se conservaron: web 50 %, Android 70 % y el reto de semáforo 0 %.

Las capturas Android se obtuvieron mediante la cámara del emulador y no incluyen el puntero del escritorio. La hora de realización se muestra según la zona horaria de cada dispositivo; el instante almacenado es el mismo.
