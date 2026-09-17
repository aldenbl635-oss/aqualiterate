-- PostgreSQL / PostGIS initialization
-- Run automatically by docker-entrypoint-initdb.d

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
