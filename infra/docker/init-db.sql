-- Initialize Physical-Financial Risk Platform Database

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS twins;
CREATE SCHEMA IF NOT EXISTS provenance;

-- Grant permissions
GRANT ALL ON SCHEMA core TO pfrp_user;
GRANT ALL ON SCHEMA twins TO pfrp_user;
GRANT ALL ON SCHEMA provenance TO pfrp_user;

-- Log
DO $$
BEGIN
    RAISE NOTICE 'Physical-Financial Risk Platform database initialized successfully';
END $$;
