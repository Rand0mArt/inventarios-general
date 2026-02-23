# Inventarios General

Aplicación web estática de inventarios con estilo glass y sincronización realtime opcional con Supabase.

## Arquitectura de datos (importante)

No se crea una base de datos por inventario.  
La práctica correcta es:

- 1 proyecto Supabase
- 1 base de datos PostgreSQL
- Muchas filas/tablas dentro de esa base

En esta versión, cada usuario/dispositivo guarda su estado en la tabla `public.inventarios_general_states` usando `owner_key`.

## Configurar Supabase

1. Usa uno de tus proyectos Supabase existentes (no necesitas crear otro).
2. En SQL Editor de ese proyecto, ejecuta `supabase/schema.sql`.
3. Copia `config.example.js` a `config.js`.
4. Rellena:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `OWNER_KEY` (misma clave en todos tus dispositivos para compartir/sincronizar inventarios)
5. Abre la app y verifica sincronización.

## Despliegue en GitHub Pages

1. Crea un repositorio en GitHub.
2. Conecta remoto y sube:
```bash
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```
3. En GitHub:
   - `Settings` -> `Pages`
   - Source: `GitHub Actions`
4. Cada push a `main` desplegará automáticamente.

Tu app quedará en:

`https://TU_USUARIO.github.io/TU_REPO/`

## Nota de seguridad

Las políticas RLS de `supabase/schema.sql` están abiertas para acelerar esta versión.
Antes de producción, conviene migrar a autenticación real (Auth de Supabase) y políticas por usuario.
