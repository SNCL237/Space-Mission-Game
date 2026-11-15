-- 10 schémas, un par domaine. Aucune clé étrangère inter-schémas (T9-05).
CREATE SCHEMA IF NOT EXISTS ide; -- identite
CREATE SCHEMA IF NOT EXISTS cat; -- catalogue
CREATE SCHEMA IF NOT EXISTS sce; -- scenarios
CREATE SCHEMA IF NOT EXISTS con; -- conception
CREATE SCHEMA IF NOT EXISTS sim; -- simulation
CREATE SCHEMA IF NOT EXISTS eva; -- evaluation
CREATE SCHEMA IF NOT EXISTS cam; -- campagne
CREATE SCHEMA IF NOT EXISTS equ; -- equipe (V2)
CREATE SCHEMA IF NOT EXISTS ped; -- pedagogie
CREATE SCHEMA IF NOT EXISTS cla; -- classement (V3)
