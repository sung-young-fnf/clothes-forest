-- ============================================================
-- DBUSER 정책 기반 DB 초기화 스크립트 (NestJS + Prisma)
-- 서비스: closet-room
-- 실행: psql -U postgres -f init-db.sql
--
-- Owner 3단 분리:
--   _adm           = DB + Schema Owner (LOGIN, DBA/파트장급)
--   _object_owner_role = Object Owner (NOLOGIN, DDL+DML)
--   _dml_role      = DML 전용 (NOLOGIN)
--
-- 계정:
--   _oper          = 개발자 (LOGIN, SET ROLE object_owner_role)
--   _ops           = Prisma Migrate (LOGIN, SET ROLE object_owner_role)
--   _svc           = 앱 서비스 (LOGIN, DML 전용)
-- ============================================================

-- 0. Database
-- CREATE DATABASE closet_room_db OWNER closet_room_adm;
-- \c closet_room_db

-- ─── 1. Roles (NOLOGIN) ─────────────────────────────────

CREATE ROLE closet_room_object_owner_role NOLOGIN;
CREATE ROLE closet_room_dml_role NOLOGIN;

-- ─── 2. Login Accounts ──────────────────────────────────

CREATE USER closet_room_adm WITH LOGIN PASSWORD 'CHANGE_ME_ADM';

CREATE USER closet_room_oper WITH LOGIN PASSWORD 'CHANGE_ME_OPER';
GRANT closet_room_object_owner_role TO closet_room_oper;
ALTER USER closet_room_oper SET ROLE closet_room_object_owner_role;

-- Prisma Migrate 도구 계정
CREATE USER closet_room_prisma_ops WITH LOGIN PASSWORD 'CHANGE_ME_OPS';
GRANT closet_room_object_owner_role TO closet_room_prisma_ops;
ALTER USER closet_room_prisma_ops SET ROLE closet_room_object_owner_role;

CREATE USER closet_room_svc WITH LOGIN PASSWORD 'CHANGE_ME_SVC';
GRANT closet_room_dml_role TO closet_room_svc;
ALTER USER closet_room_svc SET ROLE closet_room_dml_role;

-- ─── 3. Database ────────────────────────────────────────

ALTER DATABASE closet_room_db OWNER TO closet_room_adm;

-- ─── 4. Schema ──────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS closet_room AUTHORIZATION closet_room_adm;

-- ─── 5. Schema 권한 ─────────────────────────────────────

GRANT CREATE, USAGE ON SCHEMA closet_room TO closet_room_object_owner_role;
GRANT USAGE ON SCHEMA closet_room TO closet_room_dml_role;

-- ─── 6. Default Privileges ──────────────────────────────

ALTER DEFAULT PRIVILEGES FOR ROLE closet_room_object_owner_role
    IN SCHEMA closet_room
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO closet_room_dml_role;

ALTER DEFAULT PRIVILEGES FOR ROLE closet_room_object_owner_role
    IN SCHEMA closet_room
    GRANT USAGE, SELECT ON SEQUENCES TO closet_room_dml_role;

ALTER DEFAULT PRIVILEGES FOR ROLE closet_room_object_owner_role
    IN SCHEMA closet_room
    GRANT EXECUTE ON FUNCTIONS TO closet_room_dml_role;

-- ─── 7. search_path ─────────────────────────────────────

ALTER USER closet_room_oper SET search_path TO closet_room;
ALTER USER closet_room_prisma_ops SET search_path TO closet_room;
ALTER USER closet_room_svc SET search_path TO closet_room;
