CREATE TABLE IF NOT EXISTS `user_profiles` (
  `user_id`   int NOT NULL,
  `phone`     varchar(64) NOT NULL DEFAULT '',
  `location`  varchar(256) NOT NULL DEFAULT '',
  PRIMARY KEY (`user_id`),
  CONSTRAINT `user_profiles_ibfk_1` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;