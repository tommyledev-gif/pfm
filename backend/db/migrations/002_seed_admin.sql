-- Seed the first admin user. Password must be changed immediately after first login.
-- Run manually against the target environment; never as part of an automated
-- migration run in production (the placeholder hash below must be replaced).
INSERT INTO users (email, password_hash, status, role)
VALUES (
    'admin@pfm.local',
    '$2a$12$REPLACE_WITH_REAL_BCRYPT_HASH_BEFORE_RUNNING',
    'active',
    'admin'
);
