-- Run this first 
-- Passwrod - Admin1234
INSERT INTO users (email, fname, lname, password) VALUES ('admin.test@bsu.edu.ph','Test','Admin','$2b$10$dVcUhngjrZgYt0IpxL4LbefdSRiLdg/9kgaAfVb719wMTIs5AARMW'); 

-- next
-- 0 producer
-- 1 admin
-- 2 farmer
INSERT INTO user_auth_level (user_id, auth_level) VALUES (1, 1);

-- update password for emergency only
-- Producer123
-- user 3 -> renz
UPDATE users SET password = '$2b$10$vITLKI/8xbakax0z3W3INepTSEQzbz9BhhVH7GH0T/7Pik0gpGkZq' WHERE user_id = 3;


-- new fix producer account
-- emergecny use only
INSERT INTO producers (producer_name, producer_desc)
VALUES ('Nelio Compelio Farm', 'Seed producer, Kabayan, Benguet');
SET @pid = LAST_INSERT_ID();

INSERT INTO users (email, fname, lname, password)
VALUES ('nelio@example.com', 'Nelio', 'Compelio', 'PASTE_HASH_HERE');
SET @uid = LAST_INSERT_ID();

INSERT INTO user_auth_level (user_id, auth_level) VALUES (@uid, 0);  -- 0 = producer
INSERT INTO user_producer_relation (user_id, producer_id) VALUES (@uid, @pid);

-- run this code then copy the code
-- php -r "echo password_hash('Producer123', PASSWORD_BCRYPT);"
-- paste the code inside the sql password hash