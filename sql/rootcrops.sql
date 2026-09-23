-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Aug 27, 2026 at 11:12 AM
-- Server version: 8.4.3
-- PHP Version: 8.3.33

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `rootcrops`
--

-- --------------------------------------------------------

--
-- Table structure for table `producers`
--

CREATE TABLE `producers` (
  `producer_id` int NOT NULL,
  `producer_name` varchar(256) COLLATE utf8mb4_general_ci NOT NULL,
  `producer_desc` varchar(256) COLLATE utf8mb4_general_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `producers`
--

INSERT INTO `producers` (`producer_id`, `producer_name`, `producer_desc`) VALUES
(1, 'NPRCRTC', 'Northern Philippines Root Crops Research and Training Center');

-- --------------------------------------------------------

--
-- Table structure for table `producer_crop_stocks`
--

CREATE TABLE `producer_crop_stocks` (
  `producer_crop_stock_id` int NOT NULL,
  `crop_variety_id` int NOT NULL,
  `producer_id` int NOT NULL,
  `unit_id` int NOT NULL,
  `stock_amount` int NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `is_public` tinyint(1) NOT NULL,
  `last_update_date` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `producer_crop_stocks`
--

INSERT INTO `producer_crop_stocks` (`producer_crop_stock_id`, `crop_variety_id`, `producer_id`, `unit_id`, `stock_amount`, `unit_price`, `is_public`, `last_update_date`) VALUES
(1, 2, 1, 1, 34, 7.50, 1, '2026-08-26 17:37:57');

-- --------------------------------------------------------

--
-- Table structure for table `producer_stock_logs`
--

CREATE TABLE `producer_stock_logs` (
  `log_id` int NOT NULL,
  `user_id` int NOT NULL,
  `user_email` varchar(256) NOT NULL,
  `update_done_by_fname` varchar(256) NOT NULL,
  `update_done_by_lname` varchar(256) NOT NULL,
  `producer_id` int NOT NULL,
  `producer_name` varchar(256) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `crop` varchar(256) NOT NULL,
  `crop_variety` varchar(256) NOT NULL,
  `unit_used` varchar(256) NOT NULL,
  `old_unit_price` decimal(10,2) NOT NULL,
  `current_unit_price` decimal(10,2) NOT NULL,
  `quantity_action_type` varchar(256) NOT NULL,
  `old_stock_quantity` int NOT NULL,
  `current_stock_quantity` int NOT NULL,
  `old_status` varchar(256) NOT NULL,
  `current_status` varchar(256) NOT NULL,
  `reason_for_change` varchar(256) NOT NULL,
  `update_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `producer_stock_logs`
--

INSERT INTO `producer_stock_logs` (`log_id`, `user_id`, `user_email`, `update_done_by_fname`, `update_done_by_lname`, `producer_id`, `producer_name`, `crop`, `crop_variety`, `unit_used`, `old_unit_price`, `current_unit_price`, `quantity_action_type`, `old_stock_quantity`, `current_stock_quantity`, `old_status`, `current_status`, `reason_for_change`, `update_date`) VALUES
(1, 3, 'rheinzmarcelo@gmail.com', 'rheinz', 'marcelo', 1, 'NPRCRTC', 'Potato', 'Granola', 'Mini Tubers - Pea Size', 5.00, 5.00, 'Exact', 10, 15, 'Public', 'Public', 'FINAL NA HAHAHA', '2026-08-27 01:16:28'),
(2, 3, 'rheinzmarcelo@gmail.com', 'rheinz', 'marcelo', 1, 'NPRCRTC', 'Potato', 'Granola', 'Mini Tubers - Pea Size', 5.00, 5.40, 'Added', 15, 19, 'Public', 'Public', '', '2026-08-27 01:37:35'),
(3, 3, 'rheinzmarcelo@gmail.com', 'rheinz', 'marcelo', 1, 'NPRCRTC', 'Potato', 'Granola', 'Mini Tubers - Pea Size', 5.40, 7.50, 'Added', 19, 34, 'Public', 'Public', 'WABAWAB LUB LUB', '2026-08-27 01:37:57');

-- --------------------------------------------------------

--
-- Table structure for table `rootcrops`
--

CREATE TABLE `rootcrops` (
  `crop_id` int NOT NULL,
  `crop_name` varchar(256) COLLATE utf8mb4_general_ci NOT NULL,
  `crop_description` varchar(256) COLLATE utf8mb4_general_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `rootcrops`
--

INSERT INTO `rootcrops` (`crop_id`, `crop_name`, `crop_description`) VALUES
(1, 'Potato', 'Potatoe');

-- --------------------------------------------------------

--
-- Table structure for table `rootcrop_units`
--

CREATE TABLE `rootcrop_units` (
  `unit_id` int NOT NULL,
  `crop_id` int NOT NULL,
  `unit_size` varchar(256) COLLATE utf8mb4_general_ci NOT NULL,
  `unit_abbreviated` varchar(256) COLLATE utf8mb4_general_ci NOT NULL,
  `unit_unabbreviated` varchar(256) COLLATE utf8mb4_general_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `rootcrop_units`
--

INSERT INTO `rootcrop_units` (`unit_id`, `crop_id`, `unit_size`, `unit_abbreviated`, `unit_unabbreviated`) VALUES
(1, 1, 'Pea', 'Pc', 'Mini Tubers - Pea Size'),
(2, 1, 'Marble', 'Pc', 'Mini Tubers - Marble Size'),
(3, 1, 'Small', 'Pc', 'Mini Tubers - Small Size'),
(4, 1, 'Plantlet', 'Plantlet', 'Tissue Culture Plantlet'),
(5, 1, 'Cutting', 'Rooted Cutting', 'Rooted Cuttings');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `user_id` int NOT NULL,
  `email` varchar(256) COLLATE utf8mb4_general_ci NOT NULL,
  `fname` varchar(256) COLLATE utf8mb4_general_ci NOT NULL,
  `lname` varchar(256) COLLATE utf8mb4_general_ci NOT NULL,
  `password` varchar(256) COLLATE utf8mb4_general_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`user_id`, `email`, `fname`, `lname`, `password`) VALUES
(3, 'rheinzmarcelo@gmail.com', 'rheinz', 'marcelo', '$2y$10$w5PuXatyHRqyEckvD26x7uDePjVX4QJkRpHXSN5w8HxhTv0d7MOru');

-- --------------------------------------------------------

--
-- Table structure for table `user_auth_level`
--

CREATE TABLE `user_auth_level` (
  `user_id` int NOT NULL,
  `auth_level` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `user_auth_level`
--

INSERT INTO `user_auth_level` (`user_id`, `auth_level`) VALUES
(3, 0);

-- --------------------------------------------------------

--
-- Table structure for table `user_producer_relation`
--

CREATE TABLE `user_producer_relation` (
  `user_id` int NOT NULL,
  `producer_id` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `user_producer_relation`
--

INSERT INTO `user_producer_relation` (`user_id`, `producer_id`) VALUES
(3, 1);

-- --------------------------------------------------------

--
-- Table structure for table `varieties`
--

CREATE TABLE `varieties` (
  `variety_id` int NOT NULL,
  `crop_id` int NOT NULL,
  `variety_name` varchar(256) COLLATE utf8mb4_general_ci NOT NULL,
  `variety_desc` varchar(256) COLLATE utf8mb4_general_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `varieties`
--

INSERT INTO `varieties` (`variety_id`, `crop_id`, `variety_name`, `variety_desc`) VALUES
(2, 1, 'Granola', 'qwe'),
(3, 1, 'Igorota', 'Igorotaa');

-- --------------------------------------------------------

--
-- Table structure for table `varieties_alt_names`
--

CREATE TABLE `varieties_alt_names` (
  `alt_name_id` int NOT NULL,
  `variety_id` int NOT NULL,
  `alt_name` varchar(256) COLLATE utf8mb4_general_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `varieties_alt_names`
--

INSERT INTO `varieties_alt_names` (`alt_name_id`, `variety_id`, `alt_name`) VALUES
(1, 3, 'LBR'),
(2, 3, 'P03');

-- --------------------------------------------------------

--
-- Table structure for table `variety_generations`
--

CREATE TABLE `variety_generations` (
  `variety_id` int NOT NULL,
  `variety_generation_id` int NOT NULL,
  `generation_classification` int NOT NULL,
  `generation_desc` varchar(256) COLLATE utf8mb4_general_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `producers`
--
ALTER TABLE `producers`
  ADD PRIMARY KEY (`producer_id`),
  ADD KEY `producer_id` (`producer_id`);

--
-- Indexes for table `producer_crop_stocks`
--
ALTER TABLE `producer_crop_stocks`
  ADD PRIMARY KEY (`producer_crop_stock_id`),
  ADD KEY `crop_variety_id` (`crop_variety_id`,`producer_id`,`unit_id`),
  ADD KEY `unit_id` (`unit_id`),
  ADD KEY `producer_id` (`producer_id`);

--
-- Indexes for table `producer_stock_logs`
--
ALTER TABLE `producer_stock_logs`
  ADD PRIMARY KEY (`log_id`);

--
-- Indexes for table `rootcrops`
--
ALTER TABLE `rootcrops`
  ADD PRIMARY KEY (`crop_id`),
  ADD KEY `crop_id` (`crop_id`);

--
-- Indexes for table `rootcrop_units`
--
ALTER TABLE `rootcrop_units`
  ADD PRIMARY KEY (`unit_id`),
  ADD KEY `unit_id` (`unit_id`,`crop_id`),
  ADD KEY `crop_id` (`crop_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `user_auth_level`
--
ALTER TABLE `user_auth_level`
  ADD PRIMARY KEY (`user_id`,`auth_level`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `user_producer_relation`
--
ALTER TABLE `user_producer_relation`
  ADD PRIMARY KEY (`user_id`,`producer_id`),
  ADD KEY `user_id` (`user_id`,`producer_id`),
  ADD KEY `producer_id` (`producer_id`);

--
-- Indexes for table `varieties`
--
ALTER TABLE `varieties`
  ADD PRIMARY KEY (`variety_id`),
  ADD KEY `variety_id` (`variety_id`,`crop_id`),
  ADD KEY `crop_id` (`crop_id`);

--
-- Indexes for table `varieties_alt_names`
--
ALTER TABLE `varieties_alt_names`
  ADD PRIMARY KEY (`alt_name_id`),
  ADD KEY `variety_id` (`variety_id`);

--
-- Indexes for table `variety_generations`
--
ALTER TABLE `variety_generations`
  ADD PRIMARY KEY (`variety_generation_id`),
  ADD KEY `variety_id` (`variety_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `producers`
--
ALTER TABLE `producers`
  MODIFY `producer_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `producer_crop_stocks`
--
ALTER TABLE `producer_crop_stocks`
  MODIFY `producer_crop_stock_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `producer_stock_logs`
--
ALTER TABLE `producer_stock_logs`
  MODIFY `log_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `rootcrops`
--
ALTER TABLE `rootcrops`
  MODIFY `crop_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `rootcrop_units`
--
ALTER TABLE `rootcrop_units`
  MODIFY `unit_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `user_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `varieties`
--
ALTER TABLE `varieties`
  MODIFY `variety_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `varieties_alt_names`
--
ALTER TABLE `varieties_alt_names`
  MODIFY `alt_name_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `variety_generations`
--
ALTER TABLE `variety_generations`
  MODIFY `variety_generation_id` int NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `producer_crop_stocks`
--
ALTER TABLE `producer_crop_stocks`
  ADD CONSTRAINT `producer_crop_stocks_ibfk_1` FOREIGN KEY (`unit_id`) REFERENCES `rootcrop_units` (`unit_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `producer_crop_stocks_ibfk_2` FOREIGN KEY (`producer_id`) REFERENCES `producers` (`producer_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `producer_crop_stocks_ibfk_3` FOREIGN KEY (`crop_variety_id`) REFERENCES `varieties` (`variety_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `rootcrop_units`
--
ALTER TABLE `rootcrop_units`
  ADD CONSTRAINT `rootcrop_units_ibfk_1` FOREIGN KEY (`crop_id`) REFERENCES `rootcrops` (`crop_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `user_auth_level`
--
ALTER TABLE `user_auth_level`
  ADD CONSTRAINT `user_auth_level_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `user_producer_relation`
--
ALTER TABLE `user_producer_relation`
  ADD CONSTRAINT `user_producer_relation_ibfk_2` FOREIGN KEY (`producer_id`) REFERENCES `producers` (`producer_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `user_producer_relation_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `varieties`
--
ALTER TABLE `varieties`
  ADD CONSTRAINT `varieties_ibfk_1` FOREIGN KEY (`crop_id`) REFERENCES `rootcrops` (`crop_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `varieties_alt_names`
--
ALTER TABLE `varieties_alt_names`
  ADD CONSTRAINT `varieties_alt_names_ibfk_1` FOREIGN KEY (`variety_id`) REFERENCES `varieties` (`variety_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `variety_generations`
--
ALTER TABLE `variety_generations`
  ADD CONSTRAINT `variety_generations_ibfk_1` FOREIGN KEY (`variety_id`) REFERENCES `varieties` (`variety_id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
