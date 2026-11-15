@echo off
rem Lance le backend sous Windows (invite de commandes). PostgreSQL doit tourner (docker compose up -d).
rem Changez JWT_SECRET pour une valeur à vous (32 caractères minimum) ; gardez la même pour "pnpm seed".
set CORS_ORIGINS=http://localhost:5173,http://localhost:4173
set JWT_SECRET=remplacez-moi-par-une-cle-secrete-de-32-caracteres-min
set DATABASE_URL=postgres://smdg:smdg@localhost:5433/smdg
set PORT=3000
pnpm --filter @smdg/server start
