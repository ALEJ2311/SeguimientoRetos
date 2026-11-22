# Seguimiento de Retos: web y Android

Aplicación Ionic 9 y Angular 22 que consume la API Django del proyecto. Sigue la guía `Documentacion/04-frontend-paso-a-paso.md`.

## Funciones

- Lista y búsqueda de retos; formulario de creación.
- Seguimiento semanal, guardado automático del porcentaje y bitácora de avances.
- Semáforo: semanas futuras grises, actual azul, cerradas verdes (100 %), amarillas (10-99 %) o rojas (menos de 10 %).
- Alertas por semanas cerradas en rojo y riesgo cuando faltan dos días o menos.
- Un solo código para navegador y app Android mediante Capacitor 8.

## Desarrollo web

Mantén Django ejecutándose desde `backend` con `runserver 0.0.0.0:8000`. En otra terminal, desde esta carpeta:

```powershell
npm.cmd ci
ionic.cmd serve --project=frontend --port=8100
```

Abre `http://localhost:8100`.

## Compilación y pruebas

```powershell
npm.cmd run build
npx.cmd ng test --watch=false
```

Las ocho pruebas de `core/semaforo.spec.ts` verifican fechas, cierre, umbrales y riesgo. Una prueba adicional de `seguimiento.service.spec.ts` simula el cambio de día, verifica el cierre sin recargar datos y evita avisos duplicados. El presupuesto de Angular se adaptó al proyecto Ionic: aviso de paquete inicial a 1 MB y límite a 2 MB. El paquete inicial medido es de aproximadamente 1,19 MB sin comprimir.

## Android

Requiere el SDK de Android, JDK 21 y un emulador iniciado. Desde esta carpeta:

```powershell
npm.cmd run build
npx.cmd cap sync android
npx.cmd cap open android
```

En Android Studio configura el JDK de Gradle en 21 y ejecuta la app en el emulador. Repite build y sync después de cambiar el código web.

`capacitor.config.ts` define el identificador `edu.ejemplo.seguimientoretos`, el directorio compilado y la conexión HTTP para desarrollo local. `core/api.config.ts` selecciona automáticamente `127.0.0.1:8000/api` en la web y `10.0.2.2:8000/api` en Android.

## Flujos RxJS

- F1: recarga compartida de retos y tareas.
- F2: búsqueda con debounce y filtrado combinado.
- F3: reloj que emite al cambiar la fecha local.
- F4: evaluación reactiva de semanas.
- F5: detección y contador de alertas.
- F6: aviso de rojos nuevos con memoria mediante scan.
- F7: guardado del porcentaje con debounce, PATCH y recarga.

Las reglas del semáforo están centralizadas en `core/semaforo.ts`; el calendario se configura en `backend/.env` y el servidor impide editar semanas cerradas.
