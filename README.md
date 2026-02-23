# Inventarios General

Aplicación web estática de inventarios con estilo glass y sincronización realtime opcional con Supabase.

## Arquitectura de datos (importante)

No se crea una base de datos por inventario.  
La práctica correcta es:

- 1 proyecto Supabase
- 1 base de datos PostgreSQL
- Muchas filas/tablas dentro de esa base

En esta versión, cada usuario/dispositivo guarda su estado en la tabla `public.app_states` usando `owner_key`.

## Configurar Supabase

1. Crea un proyecto en Supabase.
2. En SQL Editor, ejecuta `supabase/schema.sql`.
3. Copia `config.example.js` a `config.js`.
4. Rellena:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
5. Abre la app y verifica sincronización.

## Despliegue en GitHub Pages

1. Inicializa git:
```bash
git init
git add .
git commit -m "v1 + supabase realtime setup"
```
2. Crea un repositorio en GitHub.
3. Conecta remoto y sube:
```bash
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```
4. En GitHub:
   - `Settings` -> `Pages`
   - Source: `Deploy from a branch`
   - Branch: `main` / root

Tu app quedará en:

`https://TU_USUARIO.github.io/TU_REPO/`

## Nota de seguridad

Las políticas RLS de `supabase/schema.sql` están abiertas para acelerar esta versión.
Antes de producción, conviene migrar a autenticación real (Auth de Supabase) y políticas por usuario.
