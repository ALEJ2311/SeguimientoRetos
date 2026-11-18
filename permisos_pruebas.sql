-- Ejecutar una sola vez como root en MySQL 8.4, puerto 3309.
-- Permite que Django cree y borre exclusivamente su base temporal de pruebas.
GRANT ALL PRIVILEGES ON `test_seguimiento_retos`.* TO 'retos_app'@'127.0.0.1';
SHOW GRANTS FOR 'retos_app'@'127.0.0.1';
