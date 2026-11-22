# Seguimiento de Retos

Aplicación web y Android para registrar retos, realizar seguimiento de las semanas 7 a 15, guardar porcentajes y registrar avances. Incluye semáforo de cumplimiento, alertas de semanas cerradas y validaciones en la API. La funcionalidad propia Plan de recuperación permite definir un objetivo y acciones para una semana incumplida, continuarlas desde web o Android y conservar el resultado original de la semana.

El backend utiliza Django REST Framework y MySQL; el frontend utiliza Ionic y Angular, con Capacitor para Android.

- [Preparación del backend](backend/README.md)
- [Preparación de web y Android](frontend/README.md)
- [Informe, capturas y registros de pruebas](Documentacion/Entrega/README.md)
- [Plan de recuperación y archivos modificados](Documentacion/Entrega/README_RECUPERACION.md)

La configuración privada se define localmente en `backend/.env`, a partir de `.env.example`. Las credenciales, los entornos virtuales, las dependencias y las compilaciones se excluyen del repositorio.
