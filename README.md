# Backend: Seguimiento de Retos

Backend de la guía `03-backend-paso-a-paso.md`: Django 5.2, Django REST Framework y MySQL 8.4.

## Ubicación y configuración de este equipo

- Carpeta: `C:\xampp\htdocs\SeguimientoRetos\backend`.
- MySQL: `127.0.0.1:3309`, base `seguimiento_retos`, usuario `retos_app`.
- Variables privadas: `.env`, en esta carpeta y fuera de `.venv`.
- Plantilla sin secretos: `.env.example`.
- El repositorio Git existente está en `backend`, por lo que los comandos Git se ejecutan aquí.

## Iniciar el servidor

En una terminal PowerShell:

```powershell
Set-Location C:\xampp\htdocs\SeguimientoRetos\backend
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

Deja esa terminal abierta. Visita:

- API: http://127.0.0.1:8000/api/
- Retos: http://127.0.0.1:8000/api/retos/
- Swagger: http://127.0.0.1:8000/api/docs/
- Administrador: http://127.0.0.1:8000/admin/

El superusuario inicial se llama `admin`. Su contraseña generada está en `.env`, variable `DJANGO_SUPERUSER_PASSWORD`. No incluyas `.env` en capturas, informes ni commits.

## Comprobaciones

En otra terminal, desde esta carpeta:

```powershell
.\.venv\Scripts\python.exe manage.py check --database default
.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run
.\.venv\Scripts\python.exe manage.py showmigrations
.\.venv\Scripts\python.exe manage.py test retos -v 2 --noinput
.\.venv\Scripts\python.exe manage.py spectacular --file NUL --validate --fail-on-warn
```

`permisos_pruebas.sql` contiene el permiso que se concede una sola vez como root para la base temporal `test_seguimiento_retos`.

## Datos de ejemplo

La base contiene el reto «Leer 10 libros», en curso, con un avance de 10 %. Los filtros, búsqueda, ordenación y paginación están disponibles en la API.

## Emulador Android

Cuando esté disponible el SDK y un dispositivo virtual, inicia el servidor con:

```powershell
.\.venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000
```

Desde Chrome dentro del emulador visita `http://10.0.2.2:8000/api/retos/`. En el navegador de la PC usa `127.0.0.1`.
