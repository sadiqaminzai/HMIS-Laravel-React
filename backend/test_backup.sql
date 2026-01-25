-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: backend
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `appointments`
--

DROP TABLE IF EXISTS `appointments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `appointments` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `hospital_id` bigint(20) unsigned NOT NULL,
  `patient_id` bigint(20) unsigned DEFAULT NULL,
  `doctor_id` bigint(20) unsigned NOT NULL,
  `appointment_number` varchar(255) NOT NULL,
  `patient_name` varchar(255) NOT NULL,
  `patient_age` int(10) unsigned DEFAULT NULL,
  `patient_gender` varchar(20) DEFAULT NULL,
  `appointment_date` date NOT NULL,
  `appointment_time` varchar(20) NOT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `status` enum('scheduled','completed','cancelled','no_show') NOT NULL DEFAULT 'scheduled',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `appointments_appointment_number_unique` (`appointment_number`),
  KEY `appointments_hospital_id_foreign` (`hospital_id`),
  KEY `appointments_patient_id_foreign` (`patient_id`),
  KEY `appointments_doctor_id_foreign` (`doctor_id`),
  CONSTRAINT `appointments_doctor_id_foreign` FOREIGN KEY (`doctor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `appointments_hospital_id_foreign` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE CASCADE,
  CONSTRAINT `appointments_patient_id_foreign` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `appointments`
--

LOCK TABLES `appointments` WRITE;
/*!40000 ALTER TABLE `appointments` DISABLE KEYS */;
/*!40000 ALTER TABLE `appointments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `backup_settings`
--

DROP TABLE IF EXISTS `backup_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `backup_settings` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `enabled` tinyint(1) NOT NULL DEFAULT 1,
  `time` varchar(5) NOT NULL DEFAULT '02:00',
  `retention` int(10) unsigned NOT NULL DEFAULT 30,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `backup_settings`
--

LOCK TABLES `backup_settings` WRITE;
/*!40000 ALTER TABLE `backup_settings` DISABLE KEYS */;
INSERT INTO `backup_settings` VALUES (1,1,'02:00',30,'2026-01-23 13:59:09','2026-01-23 13:59:09');
/*!40000 ALTER TABLE `backup_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cache`
--

DROP TABLE IF EXISTS `cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cache` (
  `key` varchar(255) NOT NULL,
  `value` mediumtext NOT NULL,
  `expiration` int(11) NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cache`
--

LOCK TABLES `cache` WRITE;
/*!40000 ALTER TABLE `cache` DISABLE KEYS */;
/*!40000 ALTER TABLE `cache` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cache_locks`
--

DROP TABLE IF EXISTS `cache_locks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cache_locks` (
  `key` varchar(255) NOT NULL,
  `owner` varchar(255) NOT NULL,
  `expiration` int(11) NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cache_locks`
--

LOCK TABLES `cache_locks` WRITE;
/*!40000 ALTER TABLE `cache_locks` DISABLE KEYS */;
/*!40000 ALTER TABLE `cache_locks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `contact_messages`
--

DROP TABLE IF EXISTS `contact_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `contact_messages` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(255) DEFAULT NULL,
  `subject` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `status` enum('unread','read','responded') NOT NULL DEFAULT 'unread',
  `hospital_id` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `contact_messages_hospital_id_foreign` (`hospital_id`),
  CONSTRAINT `contact_messages_hospital_id_foreign` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `contact_messages`
--

LOCK TABLES `contact_messages` WRITE;
/*!40000 ALTER TABLE `contact_messages` DISABLE KEYS */;
/*!40000 ALTER TABLE `contact_messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `doctors`
--

DROP TABLE IF EXISTS `doctors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `doctors` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `hospital_id` bigint(20) unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(255) DEFAULT NULL,
  `specialization` varchar(255) NOT NULL,
  `registration_number` varchar(255) DEFAULT NULL,
  `consultation_fee` decimal(10,2) NOT NULL DEFAULT 0.00,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `availability_schedule` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`availability_schedule`)),
  `image_path` varchar(255) DEFAULT NULL,
  `signature_path` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `doctors_hospital_id_status_index` (`hospital_id`,`status`),
  CONSTRAINT `doctors_hospital_id_foreign` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `doctors`
--

LOCK TABLES `doctors` WRITE;
/*!40000 ALTER TABLE `doctors` DISABLE KEYS */;
INSERT INTO `doctors` VALUES (1,2,'Dr. Aisha Rahman','aisha.rahman@citycarehospital.com','+1-202-555-0191','Cardiology','CC-DR-1001',150.00,'active',NULL,NULL,NULL,'2026-01-23 13:58:43','2026-01-23 13:58:43',NULL),(2,3,'Dr. Omar Siddiq','omar.siddiq@greenvalleymedical.com','+1-202-555-0132','Pediatrics','GV-DR-2002',120.00,'active',NULL,NULL,NULL,'2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(3,4,'Dr. Lina Patel','lina.patel@sunrisecommunity.com','+1-202-555-0166','Family Medicine','SC-DR-3003',100.00,'active',NULL,NULL,NULL,'2026-01-23 13:58:44','2026-01-23 13:58:44',NULL);
/*!40000 ALTER TABLE `doctors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `failed_jobs`
--

DROP TABLE IF EXISTS `failed_jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `failed_jobs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) NOT NULL,
  `connection` text NOT NULL,
  `queue` text NOT NULL,
  `payload` longtext NOT NULL,
  `exception` longtext NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `failed_jobs`
--

LOCK TABLES `failed_jobs` WRITE;
/*!40000 ALTER TABLE `failed_jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `failed_jobs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `hospital_settings`
--

DROP TABLE IF EXISTS `hospital_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `hospital_settings` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `hospital_id` bigint(20) unsigned NOT NULL,
  `default_doctor_id` bigint(20) unsigned DEFAULT NULL,
  `default_to_walk_in` tinyint(1) NOT NULL DEFAULT 0,
  `auto_generate_patient_ids` tinyint(1) NOT NULL DEFAULT 1,
  `patient_id_prefix` varchar(10) NOT NULL DEFAULT 'P',
  `patient_id_start` int(10) unsigned NOT NULL DEFAULT 1,
  `patient_id_digits` tinyint(3) unsigned NOT NULL DEFAULT 5,
  `print_show_batch_column` tinyint(1) NOT NULL DEFAULT 1,
  `print_show_expiry_date_column` tinyint(1) NOT NULL DEFAULT 1,
  `print_show_bonus_column` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `hospital_settings_hospital_id_unique` (`hospital_id`),
  KEY `hospital_settings_default_doctor_id_foreign` (`default_doctor_id`),
  CONSTRAINT `hospital_settings_default_doctor_id_foreign` FOREIGN KEY (`default_doctor_id`) REFERENCES `doctors` (`id`) ON DELETE SET NULL,
  CONSTRAINT `hospital_settings_hospital_id_foreign` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `hospital_settings`
--

LOCK TABLES `hospital_settings` WRITE;
/*!40000 ALTER TABLE `hospital_settings` DISABLE KEYS */;
/*!40000 ALTER TABLE `hospital_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `hospitals`
--

DROP TABLE IF EXISTS `hospitals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `hospitals` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `slug` varchar(255) NOT NULL,
  `code` varchar(64) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(255) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `license` varchar(255) DEFAULT NULL,
  `license_issue_date` date DEFAULT NULL,
  `license_expiry_date` date DEFAULT NULL,
  `logo_path` varchar(255) DEFAULT NULL,
  `settings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`settings`)),
  `subscription_status` enum('active','inactive','past_due') NOT NULL DEFAULT 'active',
  `status` enum('active','suspended') NOT NULL DEFAULT 'active',
  `brand_color` varchar(32) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `hospitals_slug_unique` (`slug`),
  UNIQUE KEY `hospitals_code_unique` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `hospitals`
--

LOCK TABLES `hospitals` WRITE;
/*!40000 ALTER TABLE `hospitals` DISABLE KEYS */;
INSERT INTO `hospitals` VALUES (1,'Demo Hospital','demo-hospital',NULL,'info@demo-hospital.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'active','active',NULL,'2026-01-23 13:58:42','2026-01-23 13:58:42',NULL),(2,'City Care Hospital','city-care-hospital',NULL,'info@citycarehospital.com','+1-202-555-0101','123 Main Street, Springfield',NULL,NULL,NULL,NULL,NULL,'active','active',NULL,'2026-01-23 13:58:43','2026-01-23 13:58:43',NULL),(3,'Green Valley Medical Center','green-valley-medical',NULL,'contact@greenvalleymedical.com','+1-202-555-0145','456 Oak Avenue, Rivertown',NULL,NULL,NULL,NULL,NULL,'active','active',NULL,'2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(4,'Sunrise Community Hospital','sunrise-community-hospital',NULL,'hello@sunrisecommunity.com','+1-202-555-0177','789 Pine Road, Lakeside',NULL,NULL,NULL,NULL,NULL,'active','active',NULL,'2026-01-23 13:58:44','2026-01-23 13:58:44',NULL);
/*!40000 ALTER TABLE `hospitals` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `job_batches`
--

DROP TABLE IF EXISTS `job_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `job_batches` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `total_jobs` int(11) NOT NULL,
  `pending_jobs` int(11) NOT NULL,
  `failed_jobs` int(11) NOT NULL,
  `failed_job_ids` longtext NOT NULL,
  `options` mediumtext DEFAULT NULL,
  `cancelled_at` int(11) DEFAULT NULL,
  `created_at` int(11) NOT NULL,
  `finished_at` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `job_batches`
--

LOCK TABLES `job_batches` WRITE;
/*!40000 ALTER TABLE `job_batches` DISABLE KEYS */;
/*!40000 ALTER TABLE `job_batches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `jobs`
--

DROP TABLE IF EXISTS `jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `jobs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `queue` varchar(255) NOT NULL,
  `payload` longtext NOT NULL,
  `attempts` tinyint(3) unsigned NOT NULL,
  `reserved_at` int(10) unsigned DEFAULT NULL,
  `available_at` int(10) unsigned NOT NULL,
  `created_at` int(10) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `jobs_queue_index` (`queue`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `jobs`
--

LOCK TABLES `jobs` WRITE;
/*!40000 ALTER TABLE `jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `jobs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lab_order_items`
--

DROP TABLE IF EXISTS `lab_order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `lab_order_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `lab_order_id` bigint(20) unsigned NOT NULL,
  `test_template_id` bigint(20) unsigned NOT NULL,
  `test_code` varchar(100) NOT NULL,
  `test_name` varchar(255) NOT NULL,
  `test_type` varchar(100) NOT NULL,
  `sample_type` varchar(100) NOT NULL,
  `price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `status` enum('pending','processing','completed') NOT NULL DEFAULT 'pending',
  `started_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `completed_by` varchar(191) DEFAULT NULL,
  `remarks` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `lab_order_items_test_template_id_foreign` (`test_template_id`),
  KEY `lab_order_items_lab_order_id_status_index` (`lab_order_id`,`status`),
  CONSTRAINT `lab_order_items_lab_order_id_foreign` FOREIGN KEY (`lab_order_id`) REFERENCES `lab_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `lab_order_items_test_template_id_foreign` FOREIGN KEY (`test_template_id`) REFERENCES `test_templates` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lab_order_items`
--

LOCK TABLES `lab_order_items` WRITE;
/*!40000 ALTER TABLE `lab_order_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `lab_order_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lab_order_results`
--

DROP TABLE IF EXISTS `lab_order_results`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `lab_order_results` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `lab_order_item_id` bigint(20) unsigned NOT NULL,
  `parameter_id` bigint(20) unsigned DEFAULT NULL,
  `parameter_name` varchar(255) NOT NULL,
  `unit` varchar(50) DEFAULT NULL,
  `normal_range` varchar(255) DEFAULT NULL,
  `result_value` varchar(255) DEFAULT NULL,
  `result_status` enum('normal','low','high','critical') DEFAULT NULL,
  `remarks` text DEFAULT NULL,
  `entered_by` varchar(191) DEFAULT NULL,
  `entered_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `lab_order_results_lab_order_item_id_foreign` (`lab_order_item_id`),
  KEY `lab_order_results_parameter_id_foreign` (`parameter_id`),
  CONSTRAINT `lab_order_results_lab_order_item_id_foreign` FOREIGN KEY (`lab_order_item_id`) REFERENCES `lab_order_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `lab_order_results_parameter_id_foreign` FOREIGN KEY (`parameter_id`) REFERENCES `test_template_parameters` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lab_order_results`
--

LOCK TABLES `lab_order_results` WRITE;
/*!40000 ALTER TABLE `lab_order_results` DISABLE KEYS */;
/*!40000 ALTER TABLE `lab_order_results` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lab_orders`
--

DROP TABLE IF EXISTS `lab_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `lab_orders` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `hospital_id` bigint(20) unsigned NOT NULL,
  `order_number` varchar(50) NOT NULL,
  `patient_id` bigint(20) unsigned DEFAULT NULL,
  `walk_in_patient_id` bigint(20) unsigned DEFAULT NULL,
  `is_walk_in` tinyint(1) NOT NULL DEFAULT 0,
  `patient_name` varchar(255) NOT NULL,
  `patient_age` tinyint(3) unsigned NOT NULL,
  `patient_gender` enum('male','female','other') NOT NULL,
  `doctor_id` bigint(20) unsigned NOT NULL,
  `doctor_name` varchar(255) NOT NULL,
  `total_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `paid_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `payment_status` enum('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',
  `payment_method` varchar(50) DEFAULT NULL,
  `paid_at` timestamp NULL DEFAULT NULL,
  `paid_by` varchar(191) DEFAULT NULL,
  `receipt_number` varchar(50) DEFAULT NULL,
  `status` enum('pending','sample_collected','processing','completed','cancelled') NOT NULL DEFAULT 'pending',
  `priority` enum('normal','urgent','stat') NOT NULL DEFAULT 'normal',
  `clinical_notes` text DEFAULT NULL,
  `assigned_to` bigint(20) unsigned DEFAULT NULL,
  `assigned_to_name` varchar(191) DEFAULT NULL,
  `sample_collected_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `remarks` text DEFAULT NULL,
  `created_by` varchar(191) DEFAULT NULL,
  `updated_by` varchar(191) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `lab_orders_order_number_unique` (`order_number`),
  KEY `lab_orders_patient_id_foreign` (`patient_id`),
  KEY `lab_orders_hospital_id_status_index` (`hospital_id`,`status`),
  KEY `lab_orders_hospital_id_payment_status_index` (`hospital_id`,`payment_status`),
  KEY `lab_orders_hospital_id_created_at_index` (`hospital_id`,`created_at`),
  KEY `lab_orders_doctor_id_foreign` (`doctor_id`),
  CONSTRAINT `lab_orders_doctor_id_foreign` FOREIGN KEY (`doctor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `lab_orders_hospital_id_foreign` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE CASCADE,
  CONSTRAINT `lab_orders_patient_id_foreign` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lab_orders`
--

LOCK TABLES `lab_orders` WRITE;
/*!40000 ALTER TABLE `lab_orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `lab_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `manufacturers`
--

DROP TABLE IF EXISTS `manufacturers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `manufacturers` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `hospital_id` bigint(20) unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `license_number` varchar(255) NOT NULL,
  `country` varchar(255) DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `manufacturers_hospital_id_license_number_unique` (`hospital_id`,`license_number`),
  KEY `manufacturers_hospital_id_status_index` (`hospital_id`,`status`),
  CONSTRAINT `manufacturers_hospital_id_foreign` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `manufacturers`
--

LOCK TABLES `manufacturers` WRITE;
/*!40000 ALTER TABLE `manufacturers` DISABLE KEYS */;
INSERT INTO `manufacturers` VALUES (1,1,'Acme Pharma','ACM-1-001','USA','active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(2,1,'HealWell Labs','HWL-1-002','India','active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(3,1,'NovaMed','NVM-1-003','Germany','active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(4,2,'Acme Pharma','ACM-2-001','USA','active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(5,2,'HealWell Labs','HWL-2-002','India','active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(6,2,'NovaMed','NVM-2-003','Germany','active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(7,3,'Acme Pharma','ACM-3-001','USA','active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(8,3,'HealWell Labs','HWL-3-002','India','active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(9,3,'NovaMed','NVM-3-003','Germany','active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(10,4,'Acme Pharma','ACM-4-001','USA','active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(11,4,'HealWell Labs','HWL-4-002','India','active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(12,4,'NovaMed','NVM-4-003','Germany','active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL);
/*!40000 ALTER TABLE `manufacturers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `medicine_types`
--

DROP TABLE IF EXISTS `medicine_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `medicine_types` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `hospital_id` bigint(20) unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `medicine_types_hospital_id_name_unique` (`hospital_id`,`name`),
  KEY `medicine_types_hospital_id_status_index` (`hospital_id`,`status`),
  CONSTRAINT `medicine_types_hospital_id_foreign` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `medicine_types`
--

LOCK TABLES `medicine_types` WRITE;
/*!40000 ALTER TABLE `medicine_types` DISABLE KEYS */;
INSERT INTO `medicine_types` VALUES (1,1,'Tablet','Oral solid dosage form','active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(2,1,'Capsule','Gelatin capsule form','active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(3,1,'Syrup','Liquid oral formulation','active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(4,1,'Injection','Injectable medication','active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(5,2,'Tablet','Oral solid dosage form','active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(6,2,'Capsule','Gelatin capsule form','active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(7,2,'Syrup','Liquid oral formulation','active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(8,2,'Injection','Injectable medication','active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(9,3,'Tablet','Oral solid dosage form','active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(10,3,'Capsule','Gelatin capsule form','active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(11,3,'Syrup','Liquid oral formulation','active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(12,3,'Injection','Injectable medication','active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(13,4,'Tablet','Oral solid dosage form','active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(14,4,'Capsule','Gelatin capsule form','active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(15,4,'Syrup','Liquid oral formulation','active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(16,4,'Injection','Injectable medication','active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL);
/*!40000 ALTER TABLE `medicine_types` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `medicines`
--

DROP TABLE IF EXISTS `medicines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `medicines` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `hospital_id` bigint(20) unsigned NOT NULL,
  `manufacturer_id` bigint(20) unsigned NOT NULL,
  `medicine_type_id` bigint(20) unsigned NOT NULL,
  `brand_name` varchar(255) NOT NULL,
  `generic_name` varchar(255) DEFAULT NULL,
  `strength` varchar(255) DEFAULT NULL,
  `stock` int(10) unsigned NOT NULL DEFAULT 0,
  `cost_price` decimal(15,2) NOT NULL DEFAULT 0.00,
  `sale_price` decimal(15,2) NOT NULL DEFAULT 0.00,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `medicines_manufacturer_id_foreign` (`manufacturer_id`),
  KEY `medicines_medicine_type_id_foreign` (`medicine_type_id`),
  KEY `medicines_hospital_id_status_index` (`hospital_id`,`status`),
  KEY `medicines_hospital_id_brand_name_index` (`hospital_id`,`brand_name`),
  CONSTRAINT `medicines_hospital_id_foreign` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE CASCADE,
  CONSTRAINT `medicines_manufacturer_id_foreign` FOREIGN KEY (`manufacturer_id`) REFERENCES `manufacturers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `medicines_medicine_type_id_foreign` FOREIGN KEY (`medicine_type_id`) REFERENCES `medicine_types` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `medicines`
--

LOCK TABLES `medicines` WRITE;
/*!40000 ALTER TABLE `medicines` DISABLE KEYS */;
INSERT INTO `medicines` VALUES (1,1,1,2,'Paracetamol','Acetaminophen','500mg',84,0.08,0.15,'active','2026-01-23 13:58:44','2026-01-23 13:58:45',NULL),(2,1,1,2,'Amoxicillin','Amoxicillin','500mg',0,0.12,0.25,'active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(3,1,1,2,'Ibuprofen','Ibuprofen','400mg',0,0.10,0.20,'active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(4,1,1,2,'Omeprazole','Omeprazole','20mg',0,0.18,0.35,'active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(5,1,1,2,'Cetirizine','Cetirizine','10mg',0,0.06,0.12,'active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(6,2,4,6,'Paracetamol','Acetaminophen','500mg',0,0.08,0.15,'active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(7,2,4,6,'Amoxicillin','Amoxicillin','500mg',0,0.12,0.25,'active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(8,2,4,6,'Ibuprofen','Ibuprofen','400mg',0,0.10,0.20,'active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(9,2,4,6,'Omeprazole','Omeprazole','20mg',0,0.18,0.35,'active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(10,2,4,6,'Cetirizine','Cetirizine','10mg',0,0.06,0.12,'active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(11,3,7,10,'Paracetamol','Acetaminophen','500mg',0,0.08,0.15,'active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(12,3,7,10,'Amoxicillin','Amoxicillin','500mg',0,0.12,0.25,'active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(13,3,7,10,'Ibuprofen','Ibuprofen','400mg',0,0.10,0.20,'active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(14,3,7,10,'Omeprazole','Omeprazole','20mg',0,0.18,0.35,'active','2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(15,3,7,10,'Cetirizine','Cetirizine','10mg',0,0.06,0.12,'active','2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(16,4,10,14,'Paracetamol','Acetaminophen','500mg',0,0.08,0.15,'active','2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(17,4,10,14,'Amoxicillin','Amoxicillin','500mg',0,0.12,0.25,'active','2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(18,4,10,14,'Ibuprofen','Ibuprofen','400mg',0,0.10,0.20,'active','2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(19,4,10,14,'Omeprazole','Omeprazole','20mg',0,0.18,0.35,'active','2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(20,4,10,14,'Cetirizine','Cetirizine','10mg',0,0.06,0.12,'active','2026-01-23 13:58:45','2026-01-23 13:58:45',NULL);
/*!40000 ALTER TABLE `medicines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `migrations`
--

DROP TABLE IF EXISTS `migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `migrations` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `migration` varchar(255) NOT NULL,
  `batch` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=51 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `migrations`
--

LOCK TABLES `migrations` WRITE;
/*!40000 ALTER TABLE `migrations` DISABLE KEYS */;
INSERT INTO `migrations` VALUES (1,'0001_01_01_000000_create_users_table',1),(2,'0001_01_01_000001_create_cache_table',1),(3,'0001_01_01_000002_create_jobs_table',1),(4,'2026_01_10_000000_create_hospitals_table',1),(5,'2026_01_10_000001_create_test_templates_table',1),(6,'2026_01_10_000100_create_hospitals_table',1),(7,'2026_01_10_000200_alter_hospitals_add_details',1),(8,'2026_01_10_000200_update_users_for_multitenancy',1),(9,'2026_01_10_000300_create_doctors_table',1),(10,'2026_01_10_000300_create_personal_access_tokens_table',1),(11,'2026_01_10_000400_create_patients_table',1),(12,'2026_01_10_000500_create_hospital_settings_table',1),(13,'2026_01_10_000600_add_doctor_id_to_users_table',1),(14,'2026_01_10_000700_create_appointments_table',1),(15,'2026_01_10_010000_create_roles_table',1),(16,'2026_01_10_010100_create_permissions_table',1),(17,'2026_01_10_010200_create_permission_role_table',1),(18,'2026_01_10_010300_create_contact_messages_table',1),(19,'2026_01_10_010400_create_manufacturers_table',1),(20,'2026_01_10_010500_create_medicine_types_table',1),(21,'2026_01_10_010600_create_medicines_table',1),(22,'2026_01_10_030000_create_prescriptions_table',1),(23,'2026_01_10_030100_create_prescription_items_table',1),(24,'2026_01_10_060000_create_walk_in_patients_table',1),(25,'2026_01_10_060100_update_prescriptions_for_walkins',1),(26,'2026_01_10_070000_create_lab_orders_table',1),(27,'2026_01_12_000001_add_hospital_id_to_roles_table',1),(28,'2026_01_12_000002_update_users_roles_for_dynamic_rbac',1),(29,'2026_01_13_000500_drop_referred_doctor_id_from_patients_table',1),(30,'2026_01_14_000100_add_doctor_fields_to_users_table',1),(31,'2026_01_14_000200_move_doctor_references_from_doctors_to_users',1),(32,'2026_01_17_000001_update_patients_unique_per_hospital',1),(33,'2026_01_17_000002_update_appointments_doctor_fk_to_users',1),(34,'2026_01_17_000003_update_lab_orders_doctor_fk_to_users',1),(35,'2026_01_17_000020_add_spatie_permissions_tables',1),(36,'2026_01_17_000021_make_spatie_team_columns_nullable',1),(37,'2026_01_17_000022_fix_role_has_permissions_schema',1),(38,'2026_01_17_000023_drop_is_doctor_from_users_table',1),(39,'2026_01_17_000024_make_doctor_status_nullable',1),(40,'2026_01_18_000001_add_stock_and_prices_to_medicines_table',1),(41,'2026_01_18_000002_create_pharmacy_tables',1),(42,'2026_01_18_000003_update_transactions_type_enum',1),(43,'2026_01_20_000001_add_parties_to_transactions_table',1),(44,'2026_01_20_000002_expand_transactions_trx_type_enum',1),(45,'2026_01_22_000600_add_print_column_settings_to_hospital_settings_table',1),(46,'2026_01_23_000010_add_batch_metadata_to_stocks_table',1),(47,'2026_01_23_000020_create_stock_movements_table',1),(48,'2026_01_23_000030_create_stock_reconciliations_table',1),(49,'2026_01_23_000050_add_party_names_to_transactions_table',1),(50,'2026_01_23_000060_create_backup_settings_table',1);
/*!40000 ALTER TABLE `migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `model_has_permissions`
--

DROP TABLE IF EXISTS `model_has_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `model_has_permissions` (
  `permission_id` bigint(20) unsigned NOT NULL,
  `model_type` varchar(255) NOT NULL,
  `model_id` bigint(20) unsigned NOT NULL,
  `hospital_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`permission_id`,`model_id`,`model_type`,`hospital_id`),
  KEY `model_has_permissions_model_id_model_type_index` (`model_id`,`model_type`),
  KEY `model_has_permissions_permission_id_index` (`permission_id`),
  KEY `model_has_permissions_hospital_id_index` (`hospital_id`),
  CONSTRAINT `model_has_permissions_permission_id_foreign` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `model_has_permissions`
--

LOCK TABLES `model_has_permissions` WRITE;
/*!40000 ALTER TABLE `model_has_permissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `model_has_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `model_has_roles`
--

DROP TABLE IF EXISTS `model_has_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `model_has_roles` (
  `role_id` bigint(20) unsigned NOT NULL,
  `model_type` varchar(255) NOT NULL,
  `model_id` bigint(20) unsigned NOT NULL,
  `hospital_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`role_id`,`model_id`,`model_type`,`hospital_id`),
  KEY `model_has_roles_model_id_model_type_index` (`model_id`,`model_type`),
  KEY `model_has_roles_role_id_index` (`role_id`),
  KEY `model_has_roles_hospital_id_index` (`hospital_id`),
  CONSTRAINT `model_has_roles_role_id_foreign` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `model_has_roles`
--

LOCK TABLES `model_has_roles` WRITE;
/*!40000 ALTER TABLE `model_has_roles` DISABLE KEYS */;
INSERT INTO `model_has_roles` VALUES (1,'App\\Models\\User',2,1),(2,'App\\Models\\User',3,1),(3,'App\\Models\\User',4,1),(4,'App\\Models\\User',5,1),(5,'App\\Models\\User',6,1);
/*!40000 ALTER TABLE `model_has_roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `password_reset_tokens`
--

DROP TABLE IF EXISTS `password_reset_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `password_reset_tokens` (
  `email` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `password_reset_tokens`
--

LOCK TABLES `password_reset_tokens` WRITE;
/*!40000 ALTER TABLE `password_reset_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `password_reset_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `patients`
--

DROP TABLE IF EXISTS `patients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `patients` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `hospital_id` bigint(20) unsigned NOT NULL,
  `patient_id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `age` smallint(5) unsigned DEFAULT NULL,
  `gender` enum('male','female','other') NOT NULL DEFAULT 'other',
  `phone` varchar(255) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `image_path` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `patients_hospital_id_patient_id_unique` (`hospital_id`,`patient_id`),
  UNIQUE KEY `patients_hospital_patient_unique` (`hospital_id`,`patient_id`),
  KEY `patients_hospital_id_patient_id_index` (`hospital_id`,`patient_id`),
  CONSTRAINT `patients_hospital_id_foreign` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `patients`
--

LOCK TABLES `patients` WRITE;
/*!40000 ALTER TABLE `patients` DISABLE KEYS */;
INSERT INTO `patients` VALUES (1,1,'P0001','Patient 1',21,'male','07000001','Demo Street 1','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(2,1,'P0002','Patient 2',22,'female','07000002','Demo Street 2','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(3,1,'P0003','Patient 3',23,'male','07000003','Demo Street 3','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(4,1,'P0004','Patient 4',24,'female','07000004','Demo Street 4','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(5,1,'P0005','Patient 5',25,'male','07000005','Demo Street 5','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(6,1,'P0006','Patient 6',26,'female','07000006','Demo Street 6','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(7,1,'P0007','Patient 7',27,'male','07000007','Demo Street 7','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(8,1,'P0008','Patient 8',28,'female','07000008','Demo Street 8','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(9,1,'P0009','Patient 9',29,'male','07000009','Demo Street 9','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(10,1,'P0010','Patient 10',30,'female','07000010','Demo Street 10','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(11,2,'P0001','Patient 1',21,'male','07000001','Demo Street 1','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(12,2,'P0002','Patient 2',22,'female','07000002','Demo Street 2','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(13,2,'P0003','Patient 3',23,'male','07000003','Demo Street 3','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(14,2,'P0004','Patient 4',24,'female','07000004','Demo Street 4','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(15,2,'P0005','Patient 5',25,'male','07000005','Demo Street 5','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(16,2,'P0006','Patient 6',26,'female','07000006','Demo Street 6','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(17,2,'P0007','Patient 7',27,'male','07000007','Demo Street 7','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(18,2,'P0008','Patient 8',28,'female','07000008','Demo Street 8','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(19,2,'P0009','Patient 9',29,'male','07000009','Demo Street 9','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(20,2,'P0010','Patient 10',30,'female','07000010','Demo Street 10','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(21,3,'P0001','Patient 1',21,'male','07000001','Demo Street 1','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(22,3,'P0002','Patient 2',22,'female','07000002','Demo Street 2','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(23,3,'P0003','Patient 3',23,'male','07000003','Demo Street 3','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(24,3,'P0004','Patient 4',24,'female','07000004','Demo Street 4','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(25,3,'P0005','Patient 5',25,'male','07000005','Demo Street 5','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(26,3,'P0006','Patient 6',26,'female','07000006','Demo Street 6','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(27,3,'P0007','Patient 7',27,'male','07000007','Demo Street 7','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(28,3,'P0008','Patient 8',28,'female','07000008','Demo Street 8','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(29,3,'P0009','Patient 9',29,'male','07000009','Demo Street 9','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(30,3,'P0010','Patient 10',30,'female','07000010','Demo Street 10','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(31,4,'P0001','Patient 1',21,'male','07000001','Demo Street 1','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(32,4,'P0002','Patient 2',22,'female','07000002','Demo Street 2','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(33,4,'P0003','Patient 3',23,'male','07000003','Demo Street 3','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(34,4,'P0004','Patient 4',24,'female','07000004','Demo Street 4','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(35,4,'P0005','Patient 5',25,'male','07000005','Demo Street 5','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(36,4,'P0006','Patient 6',26,'female','07000006','Demo Street 6','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(37,4,'P0007','Patient 7',27,'male','07000007','Demo Street 7','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(38,4,'P0008','Patient 8',28,'female','07000008','Demo Street 8','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(39,4,'P0009','Patient 9',29,'male','07000009','Demo Street 9','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL),(40,4,'P0010','Patient 10',30,'female','07000010','Demo Street 10','active',NULL,'2026-01-23 13:58:45','2026-01-23 13:58:45',NULL);
/*!40000 ALTER TABLE `patients` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `permission_role`
--

DROP TABLE IF EXISTS `permission_role`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `permission_role` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `role_id` bigint(20) unsigned NOT NULL,
  `permission_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `permission_role_role_id_permission_id_unique` (`role_id`,`permission_id`),
  KEY `permission_role_permission_id_foreign` (`permission_id`),
  CONSTRAINT `permission_role_permission_id_foreign` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `permission_role_role_id_foreign` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permission_role`
--

LOCK TABLES `permission_role` WRITE;
/*!40000 ALTER TABLE `permission_role` DISABLE KEYS */;
/*!40000 ALTER TABLE `permission_role` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `permissions`
--

DROP TABLE IF EXISTS `permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `permissions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `guard_name` varchar(255) NOT NULL DEFAULT 'web',
  `display_name` varchar(255) NOT NULL,
  `category` varchar(255) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `is_system` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `permissions_name_unique` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=52 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permissions`
--

LOCK TABLES `permissions` WRITE;
/*!40000 ALTER TABLE `permissions` DISABLE KEYS */;
INSERT INTO `permissions` VALUES (1,'manage_roles','web','Manage Roles','RBAC',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(2,'view_roles','web','View Roles','RBAC',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(3,'manage_permissions','web','Manage Permissions','RBAC',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(4,'view_permissions','web','View Permissions','RBAC',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(5,'view_dashboard','web','View Dashboard','Navigation',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(6,'view_reception_menu','web','View Reception Menu','Navigation',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(7,'view_laboratory_menu','web','View Laboratory Menu','Navigation',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(8,'view_pharmacy_menu','web','View Pharmacy Menu','Navigation',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(9,'view_prescriptions_menu','web','View Prescriptions Menu','Navigation',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(10,'manage_hospitals','web','Manage Hospitals','Hospitals',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(11,'view_hospitals','web','View Hospitals','Hospitals',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(12,'manage_users','web','Manage Users','User Management',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(13,'view_users','web','View Users','User Management',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(14,'manage_doctors','web','Manage Doctors','User Management',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(15,'manage_patients','web','Manage Patients','Patient Management',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(16,'register_patients','web','Register Patients','Patient Management',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(17,'view_patients','web','View Patients','Patient Management',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(18,'view_doctors','web','View Doctors','User Management',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(19,'view_appointments','web','View Appointments','Appointments',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(20,'update_appointment_status','web','Update Appointment Status','Appointments',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(21,'create_prescription','web','Create Prescription','Prescription',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(22,'view_prescriptions','web','View Prescriptions','Prescription',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(23,'manage_prescriptions','web','Manage Prescriptions','Prescription',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(24,'manage_medicines','web','Manage Medicines','Pharmacy',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(25,'view_medicines','web','View Medicines','Pharmacy',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(26,'dispense_medicines','web','Dispense Medicines','Pharmacy',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(27,'manage_manufacturers','web','Manage Manufacturers','Pharmacy',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(28,'view_manufacturers','web','View Manufacturers','Pharmacy',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(29,'manage_medicine_types','web','Manage Medicine Types','Pharmacy',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(30,'view_medicine_types','web','View Medicine Types','Pharmacy',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(31,'manage_suppliers','web','Manage Suppliers','Pharmacy',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(32,'view_suppliers','web','View Suppliers','Pharmacy',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(33,'manage_transactions','web','Manage Transactions','Pharmacy',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(34,'view_transactions','web','View Transactions','Pharmacy',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(35,'manage_stocks','web','Manage Stocks','Pharmacy',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(36,'view_stocks','web','View Stocks','Pharmacy',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(37,'view_reports','web','View Reports','Reports',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(38,'manage_reports','web','Manage Reports','Reports',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(39,'schedule_appointments','web','Schedule Appointments','Appointments',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(40,'manage_appointments','web','Manage Appointments','Appointments',NULL,'active',1,'2026-01-23 13:58:41','2026-01-23 13:58:41'),(41,'view_test_templates','web','View Test Templates','Laboratory',NULL,'active',1,'2026-01-23 13:58:42','2026-01-23 13:58:42'),(42,'manage_test_templates','web','Manage Test Templates','Laboratory',NULL,'active',1,'2026-01-23 13:58:42','2026-01-23 13:58:42'),(43,'view_lab_orders','web','View Lab Orders','Laboratory',NULL,'active',1,'2026-01-23 13:58:42','2026-01-23 13:58:42'),(44,'manage_lab_orders','web','Manage Lab Orders','Laboratory',NULL,'active',1,'2026-01-23 13:58:42','2026-01-23 13:58:42'),(45,'update_lab_order_status','web','Update Lab Order Status','Laboratory',NULL,'active',1,'2026-01-23 13:58:42','2026-01-23 13:58:42'),(46,'enter_lab_results','web','Enter Lab Results','Laboratory',NULL,'active',1,'2026-01-23 13:58:42','2026-01-23 13:58:42'),(47,'manage_lab_payments','web','Manage Lab Payments','Laboratory',NULL,'active',1,'2026-01-23 13:58:42','2026-01-23 13:58:42'),(48,'view_contact_messages','web','View Contact Messages','Support',NULL,'active',1,'2026-01-23 13:58:42','2026-01-23 13:58:42'),(49,'manage_contact_messages','web','Manage Contact Messages','Support',NULL,'active',1,'2026-01-23 13:58:42','2026-01-23 13:58:42'),(50,'view_hospital_settings','web','View Hospital Settings','Settings',NULL,'active',1,'2026-01-23 13:58:42','2026-01-23 13:58:42'),(51,'manage_hospital_settings','web','Manage Hospital Settings','Settings',NULL,'active',1,'2026-01-23 13:58:42','2026-01-23 13:58:42');
/*!40000 ALTER TABLE `permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `personal_access_tokens`
--

DROP TABLE IF EXISTS `personal_access_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `personal_access_tokens` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tokenable_type` varchar(255) NOT NULL,
  `tokenable_id` bigint(20) unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `token` varchar(64) NOT NULL,
  `abilities` text DEFAULT NULL,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `personal_access_tokens`
--

LOCK TABLES `personal_access_tokens` WRITE;
/*!40000 ALTER TABLE `personal_access_tokens` DISABLE KEYS */;
INSERT INTO `personal_access_tokens` VALUES (2,'App\\Models\\User',1,'auth_token','90c1ed416c4c6672960da7d5541172ff2448e5b8783bff3557fe0f440f2f6a27','[\"super_admin\",\"manage_roles\",\"view_roles\",\"manage_permissions\",\"view_permissions\",\"view_dashboard\",\"view_reception_menu\",\"view_laboratory_menu\",\"view_pharmacy_menu\",\"view_prescriptions_menu\",\"manage_hospitals\",\"view_hospitals\",\"manage_users\",\"view_users\",\"manage_doctors\",\"manage_patients\",\"register_patients\",\"view_patients\",\"view_doctors\",\"view_appointments\",\"update_appointment_status\",\"create_prescription\",\"view_prescriptions\",\"manage_prescriptions\",\"manage_medicines\",\"view_medicines\",\"dispense_medicines\",\"manage_manufacturers\",\"view_manufacturers\",\"manage_medicine_types\",\"view_medicine_types\",\"manage_suppliers\",\"view_suppliers\",\"manage_transactions\",\"view_transactions\",\"manage_stocks\",\"view_stocks\",\"view_reports\",\"manage_reports\",\"schedule_appointments\",\"manage_appointments\",\"view_test_templates\",\"manage_test_templates\",\"view_lab_orders\",\"manage_lab_orders\",\"update_lab_order_status\",\"enter_lab_results\",\"manage_lab_payments\",\"view_contact_messages\",\"manage_contact_messages\",\"view_hospital_settings\",\"manage_hospital_settings\"]','2026-01-23 14:19:42',NULL,'2026-01-23 14:19:08','2026-01-23 14:19:42');
/*!40000 ALTER TABLE `personal_access_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `prescription_items`
--

DROP TABLE IF EXISTS `prescription_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `prescription_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `prescription_id` bigint(20) unsigned NOT NULL,
  `medicine_id` bigint(20) unsigned DEFAULT NULL,
  `medicine_name` varchar(255) NOT NULL,
  `strength` varchar(255) DEFAULT NULL,
  `dose` varchar(255) DEFAULT NULL,
  `duration` varchar(255) DEFAULT NULL,
  `instruction` varchar(255) DEFAULT NULL,
  `quantity` int(10) unsigned NOT NULL DEFAULT 0,
  `type` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `prescription_items_prescription_id_foreign` (`prescription_id`),
  KEY `prescription_items_medicine_id_foreign` (`medicine_id`),
  CONSTRAINT `prescription_items_medicine_id_foreign` FOREIGN KEY (`medicine_id`) REFERENCES `medicines` (`id`) ON DELETE SET NULL,
  CONSTRAINT `prescription_items_prescription_id_foreign` FOREIGN KEY (`prescription_id`) REFERENCES `prescriptions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `prescription_items`
--

LOCK TABLES `prescription_items` WRITE;
/*!40000 ALTER TABLE `prescription_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `prescription_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `prescriptions`
--

DROP TABLE IF EXISTS `prescriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `prescriptions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `hospital_id` bigint(20) unsigned NOT NULL,
  `patient_id` bigint(20) unsigned DEFAULT NULL,
  `walk_in_patient_id` bigint(20) unsigned DEFAULT NULL,
  `is_walk_in` tinyint(1) NOT NULL DEFAULT 0,
  `doctor_id` bigint(20) unsigned NOT NULL,
  `patient_name` varchar(255) NOT NULL,
  `patient_age` int(10) unsigned NOT NULL DEFAULT 0,
  `patient_gender` varchar(20) DEFAULT NULL,
  `doctor_name` varchar(255) NOT NULL,
  `prescription_number` varchar(255) NOT NULL,
  `diagnosis` text DEFAULT NULL,
  `advice` text DEFAULT NULL,
  `status` enum('active','cancelled') NOT NULL DEFAULT 'active',
  `created_by` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `prescriptions_prescription_number_unique` (`prescription_number`),
  KEY `prescriptions_patient_id_foreign` (`patient_id`),
  KEY `prescriptions_doctor_id_foreign` (`doctor_id`),
  KEY `prescriptions_hospital_id_doctor_id_index` (`hospital_id`,`doctor_id`),
  KEY `prescriptions_hospital_id_patient_id_index` (`hospital_id`,`patient_id`),
  KEY `prescriptions_walk_in_patient_id_foreign` (`walk_in_patient_id`),
  KEY `prescriptions_hospital_id_is_walk_in_index` (`hospital_id`,`is_walk_in`),
  CONSTRAINT `prescriptions_doctor_id_foreign` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`) ON DELETE CASCADE,
  CONSTRAINT `prescriptions_hospital_id_foreign` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE CASCADE,
  CONSTRAINT `prescriptions_patient_id_foreign` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `prescriptions_walk_in_patient_id_foreign` FOREIGN KEY (`walk_in_patient_id`) REFERENCES `walk_in_patients` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `prescriptions`
--

LOCK TABLES `prescriptions` WRITE;
/*!40000 ALTER TABLE `prescriptions` DISABLE KEYS */;
/*!40000 ALTER TABLE `prescriptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_has_permissions`
--

DROP TABLE IF EXISTS `role_has_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `role_has_permissions` (
  `permission_id` bigint(20) unsigned NOT NULL,
  `role_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`permission_id`,`role_id`),
  KEY `role_has_permissions_role_id_index` (`role_id`),
  KEY `role_has_permissions_permission_id_index` (`permission_id`),
  CONSTRAINT `role_has_permissions_permission_id_foreign` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `role_has_permissions_role_id_foreign` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_has_permissions`
--

LOCK TABLES `role_has_permissions` WRITE;
/*!40000 ALTER TABLE `role_has_permissions` DISABLE KEYS */;
INSERT INTO `role_has_permissions` VALUES (1,1),(2,1),(3,1),(4,1),(5,1),(5,2),(5,3),(5,4),(5,5),(6,1),(6,2),(6,3),(7,1),(7,2),(7,5),(8,1),(8,4),(9,1),(9,2),(9,3),(9,4),(12,1),(13,1),(14,1),(15,1),(16,1),(16,3),(17,1),(17,2),(17,3),(18,1),(18,2),(18,3),(19,1),(19,2),(19,3),(20,1),(20,3),(21,1),(21,2),(22,1),(22,2),(22,3),(22,4),(23,1),(24,1),(24,4),(25,1),(25,2),(25,4),(26,1),(26,4),(27,1),(28,1),(28,4),(29,1),(30,1),(30,4),(31,1),(31,4),(32,1),(32,4),(33,1),(33,4),(34,1),(34,4),(35,1),(35,4),(36,1),(36,4),(37,1),(38,1),(39,1),(39,3),(40,1),(41,1),(41,2),(41,5),(42,1),(43,1),(43,2),(43,5),(44,1),(44,5),(45,1),(45,5),(46,1),(46,5),(47,1),(47,5),(50,1),(51,1);
/*!40000 ALTER TABLE `role_has_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `roles` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `hospital_id` bigint(20) unsigned DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `guard_name` varchar(255) NOT NULL DEFAULT 'web',
  `display_name` varchar(255) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `is_system` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `roles_hospital_id_name_unique` (`hospital_id`,`name`),
  CONSTRAINT `roles_hospital_id_foreign` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,1,'admin','web','Admin','System role','active',1,'2026-01-23 13:58:42','2026-01-23 13:58:42'),(2,1,'doctor','web','Doctor','System role','active',1,'2026-01-23 13:58:42','2026-01-23 13:58:42'),(3,1,'receptionist','web','Receptionist','System role','active',1,'2026-01-23 13:58:42','2026-01-23 13:58:42'),(4,1,'pharmacist','web','Pharmacist','System role','active',1,'2026-01-23 13:58:42','2026-01-23 13:58:42'),(5,1,'lab_technician','web','Lab Technician','System role','active',1,'2026-01-23 13:58:42','2026-01-23 13:58:42');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sessions` (
  `id` varchar(255) NOT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `payload` longtext NOT NULL,
  `last_activity` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sessions_user_id_index` (`user_id`),
  KEY `sessions_last_activity_index` (`last_activity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sessions`
--

LOCK TABLES `sessions` WRITE;
/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
INSERT INTO `sessions` VALUES ('LJmck1piMNzdEsrpfE6TEUwPEw7nJC8P7D5jNoW2',NULL,'127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36','YTozOntzOjY6Il90b2tlbiI7czo0MDoiTncxNFFhM3UxcHF5WDhPTUVLQzF2UFR4bDNyMmNsTjdjdng1QkJRViI7czo5OiJfcHJldmlvdXMiO2E6Mjp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly8xMjcuMC4wLjE6ODAwMCI7czo1OiJyb3V0ZSI7Tjt9czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1769177834);
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_movements`
--

DROP TABLE IF EXISTS `stock_movements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `stock_movements` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `hospital_id` bigint(20) unsigned NOT NULL,
  `medicine_id` bigint(20) unsigned NOT NULL,
  `trx_id` bigint(20) unsigned DEFAULT NULL,
  `trx_type` varchar(20) DEFAULT NULL,
  `batch_no` varchar(255) DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `qty_change` int(11) NOT NULL DEFAULT 0,
  `bonus_change` int(11) NOT NULL DEFAULT 0,
  `unit_price` decimal(15,2) NOT NULL DEFAULT 0.00,
  `balance_qty` int(10) unsigned NOT NULL DEFAULT 0,
  `balance_bonus` int(10) unsigned NOT NULL DEFAULT 0,
  `actor` varchar(255) DEFAULT NULL,
  `is_reversal` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `stock_movements_medicine_id_foreign` (`medicine_id`),
  KEY `stock_movements_hospital_id_medicine_id_index` (`hospital_id`,`medicine_id`),
  KEY `stock_movements_trx_id_index` (`trx_id`),
  CONSTRAINT `stock_movements_hospital_id_foreign` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE CASCADE,
  CONSTRAINT `stock_movements_medicine_id_foreign` FOREIGN KEY (`medicine_id`) REFERENCES `medicines` (`id`) ON DELETE CASCADE,
  CONSTRAINT `stock_movements_trx_id_foreign` FOREIGN KEY (`trx_id`) REFERENCES `transactions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_movements`
--

LOCK TABLES `stock_movements` WRITE;
/*!40000 ALTER TABLE `stock_movements` DISABLE KEYS */;
INSERT INTO `stock_movements` VALUES (1,1,1,1,'purchase','B-001','2027-01-23',100,10,0.08,100,10,'Seeder',0,'2026-01-23 13:58:45','2026-01-23 13:58:45'),(2,1,1,2,'sales','B-001','2027-01-23',-20,-2,0.15,80,8,'Seeder',0,'2026-01-23 13:58:45','2026-01-23 13:58:45'),(3,1,1,3,'purchase_return','B-001','2027-01-23',-5,-1,0.08,75,7,'Seeder',0,'2026-01-23 13:58:45','2026-01-23 13:58:45'),(4,1,1,4,'sales_return','B-001','2027-01-23',2,0,0.15,77,7,'Seeder',0,'2026-01-23 13:58:45','2026-01-23 13:58:45');
/*!40000 ALTER TABLE `stock_movements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_reconciliations`
--

DROP TABLE IF EXISTS `stock_reconciliations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `stock_reconciliations` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `hospital_id` bigint(20) unsigned NOT NULL,
  `medicine_id` bigint(20) unsigned NOT NULL,
  `batch_no` varchar(255) DEFAULT NULL,
  `reconciliation_date` date NOT NULL,
  `physical_qty` int(10) unsigned NOT NULL DEFAULT 0,
  `physical_bonus` int(10) unsigned NOT NULL DEFAULT 0,
  `created_by` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `stock_reconcile_unique` (`hospital_id`,`medicine_id`,`batch_no`,`reconciliation_date`),
  KEY `stock_reconciliations_medicine_id_foreign` (`medicine_id`),
  KEY `stock_reconciliations_hospital_id_reconciliation_date_index` (`hospital_id`,`reconciliation_date`),
  CONSTRAINT `stock_reconciliations_hospital_id_foreign` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE CASCADE,
  CONSTRAINT `stock_reconciliations_medicine_id_foreign` FOREIGN KEY (`medicine_id`) REFERENCES `medicines` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_reconciliations`
--

LOCK TABLES `stock_reconciliations` WRITE;
/*!40000 ALTER TABLE `stock_reconciliations` DISABLE KEYS */;
/*!40000 ALTER TABLE `stock_reconciliations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stocks`
--

DROP TABLE IF EXISTS `stocks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `stocks` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `hospital_id` bigint(20) unsigned NOT NULL,
  `medicine_id` bigint(20) unsigned NOT NULL,
  `batch_no` varchar(255) DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `stock_qty` int(10) unsigned NOT NULL DEFAULT 0,
  `bonus_qty` int(10) unsigned NOT NULL DEFAULT 0,
  `purchase_price` decimal(15,2) NOT NULL DEFAULT 0.00,
  `sale_price` decimal(15,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `stocks_hospital_id_medicine_id_batch_no_unique` (`hospital_id`,`medicine_id`,`batch_no`),
  KEY `stocks_medicine_id_foreign` (`medicine_id`),
  KEY `stocks_hospital_id_medicine_id_index` (`hospital_id`,`medicine_id`),
  CONSTRAINT `stocks_hospital_id_foreign` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE CASCADE,
  CONSTRAINT `stocks_medicine_id_foreign` FOREIGN KEY (`medicine_id`) REFERENCES `medicines` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stocks`
--

LOCK TABLES `stocks` WRITE;
/*!40000 ALTER TABLE `stocks` DISABLE KEYS */;
INSERT INTO `stocks` VALUES (1,1,1,'B-001','2027-01-23',77,7,0.08,0.15,'2026-01-23 13:58:45','2026-01-23 13:58:45');
/*!40000 ALTER TABLE `stocks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `suppliers`
--

DROP TABLE IF EXISTS `suppliers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `suppliers` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `hospital_id` bigint(20) unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `contact_info` text DEFAULT NULL,
  `address` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `suppliers_hospital_id_name_index` (`hospital_id`,`name`),
  CONSTRAINT `suppliers_hospital_id_foreign` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `suppliers`
--

LOCK TABLES `suppliers` WRITE;
/*!40000 ALTER TABLE `suppliers` DISABLE KEYS */;
INSERT INTO `suppliers` VALUES (1,1,'Global Med Supplies','+93 700 111 111','Kabul','2026-01-23 13:58:45','2026-01-23 13:58:45'),(2,1,'HealthCare Distributors','+93 700 222 222','Herat','2026-01-23 13:58:45','2026-01-23 13:58:45'),(3,1,'Pharma Wholesale','+93 700 333 333','Kandahar','2026-01-23 13:58:45','2026-01-23 13:58:45'),(4,2,'Global Med Supplies','+93 700 111 111','Kabul','2026-01-23 13:58:45','2026-01-23 13:58:45'),(5,2,'HealthCare Distributors','+93 700 222 222','Herat','2026-01-23 13:58:45','2026-01-23 13:58:45'),(6,2,'Pharma Wholesale','+93 700 333 333','Kandahar','2026-01-23 13:58:45','2026-01-23 13:58:45'),(7,3,'Global Med Supplies','+93 700 111 111','Kabul','2026-01-23 13:58:45','2026-01-23 13:58:45'),(8,3,'HealthCare Distributors','+93 700 222 222','Herat','2026-01-23 13:58:45','2026-01-23 13:58:45'),(9,3,'Pharma Wholesale','+93 700 333 333','Kandahar','2026-01-23 13:58:45','2026-01-23 13:58:45'),(10,4,'Global Med Supplies','+93 700 111 111','Kabul','2026-01-23 13:58:45','2026-01-23 13:58:45'),(11,4,'HealthCare Distributors','+93 700 222 222','Herat','2026-01-23 13:58:45','2026-01-23 13:58:45'),(12,4,'Pharma Wholesale','+93 700 333 333','Kandahar','2026-01-23 13:58:45','2026-01-23 13:58:45');
/*!40000 ALTER TABLE `suppliers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_template_parameters`
--

DROP TABLE IF EXISTS `test_template_parameters`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `test_template_parameters` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `test_template_id` bigint(20) unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `unit` varchar(50) DEFAULT NULL,
  `normal_range` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `sort_order` int(10) unsigned NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `test_template_parameters_test_template_id_sort_order_index` (`test_template_id`,`sort_order`),
  CONSTRAINT `test_template_parameters_test_template_id_foreign` FOREIGN KEY (`test_template_id`) REFERENCES `test_templates` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `test_template_parameters`
--

LOCK TABLES `test_template_parameters` WRITE;
/*!40000 ALTER TABLE `test_template_parameters` DISABLE KEYS */;
/*!40000 ALTER TABLE `test_template_parameters` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_templates`
--

DROP TABLE IF EXISTS `test_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `test_templates` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `hospital_id` bigint(20) unsigned NOT NULL,
  `test_code` varchar(100) NOT NULL,
  `test_name` varchar(255) NOT NULL,
  `test_type` varchar(100) NOT NULL,
  `category` varchar(100) NOT NULL DEFAULT 'Routine',
  `description` text DEFAULT NULL,
  `sample_type` varchar(100) NOT NULL,
  `price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `duration` varchar(100) DEFAULT NULL,
  `instructions` text DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_by` varchar(191) DEFAULT NULL,
  `updated_by` varchar(191) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `test_templates_hospital_id_test_code_unique` (`hospital_id`,`test_code`),
  CONSTRAINT `test_templates_hospital_id_foreign` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `test_templates`
--

LOCK TABLES `test_templates` WRITE;
/*!40000 ALTER TABLE `test_templates` DISABLE KEYS */;
/*!40000 ALTER TABLE `test_templates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `transaction_details`
--

DROP TABLE IF EXISTS `transaction_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `transaction_details` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `trx_id` bigint(20) unsigned NOT NULL,
  `medicine_id` bigint(20) unsigned NOT NULL,
  `batch_no` varchar(255) DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `qtty` int(10) unsigned NOT NULL,
  `bonus` int(10) unsigned NOT NULL DEFAULT 0,
  `price` decimal(15,2) NOT NULL DEFAULT 0.00,
  `discount` decimal(5,2) NOT NULL DEFAULT 0.00,
  `tax` decimal(5,2) NOT NULL DEFAULT 0.00,
  `amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `transaction_details_medicine_id_foreign` (`medicine_id`),
  KEY `transaction_details_trx_id_medicine_id_index` (`trx_id`,`medicine_id`),
  CONSTRAINT `transaction_details_medicine_id_foreign` FOREIGN KEY (`medicine_id`) REFERENCES `medicines` (`id`) ON DELETE CASCADE,
  CONSTRAINT `transaction_details_trx_id_foreign` FOREIGN KEY (`trx_id`) REFERENCES `transactions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `transaction_details`
--

LOCK TABLES `transaction_details` WRITE;
/*!40000 ALTER TABLE `transaction_details` DISABLE KEYS */;
INSERT INTO `transaction_details` VALUES (1,1,1,'B-001','2027-01-23',100,10,0.08,0.00,0.00,8.00),(2,2,1,'B-001','2027-01-23',20,2,0.15,0.00,0.00,3.00),(3,3,1,'B-001','2027-01-23',5,1,0.08,0.00,0.00,0.40),(4,4,1,'B-001','2027-01-23',2,0,0.15,0.00,0.00,0.30);
/*!40000 ALTER TABLE `transaction_details` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `transactions`
--

DROP TABLE IF EXISTS `transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `transactions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `hospital_id` bigint(20) unsigned NOT NULL,
  `trx_type` enum('purchase','sales','purchase_return','sales_return') NOT NULL,
  `grand_total` decimal(15,2) NOT NULL DEFAULT 0.00,
  `total_discount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `total_tax` decimal(15,2) NOT NULL DEFAULT 0.00,
  `paid_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `due_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `created_by` varchar(255) DEFAULT NULL,
  `updated_by` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `supplier_id` bigint(20) unsigned DEFAULT NULL,
  `supplier_name` varchar(255) DEFAULT NULL,
  `patient_id` bigint(20) unsigned DEFAULT NULL,
  `patient_name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `transactions_hospital_id_trx_type_index` (`hospital_id`,`trx_type`),
  KEY `transactions_supplier_id_foreign` (`supplier_id`),
  KEY `transactions_patient_id_foreign` (`patient_id`),
  CONSTRAINT `transactions_hospital_id_foreign` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE CASCADE,
  CONSTRAINT `transactions_patient_id_foreign` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE SET NULL,
  CONSTRAINT `transactions_supplier_id_foreign` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `transactions`
--

LOCK TABLES `transactions` WRITE;
/*!40000 ALTER TABLE `transactions` DISABLE KEYS */;
INSERT INTO `transactions` VALUES (1,1,'purchase',8.00,0.00,0.00,8.00,0.00,'Seeder','Seeder','2026-01-23 13:58:45','2026-01-23 13:58:45',1,'Global Med Supplies',NULL,NULL),(2,1,'sales',3.00,0.00,0.00,3.00,0.00,'Seeder','Seeder','2026-01-23 13:58:45','2026-01-23 13:58:45',NULL,NULL,1,'Patient 1'),(3,1,'purchase_return',0.40,0.00,0.00,0.40,0.00,'Seeder','Seeder','2026-01-23 13:58:45','2026-01-23 13:58:45',1,'Global Med Supplies',NULL,NULL),(4,1,'sales_return',0.30,0.00,0.00,0.30,0.00,'Seeder','Seeder','2026-01-23 13:58:45','2026-01-23 13:58:45',NULL,NULL,1,'Patient 1');
/*!40000 ALTER TABLE `transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `hospital_id` bigint(20) unsigned DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(255) DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(64) NOT NULL,
  `role_id` bigint(20) unsigned DEFAULT NULL,
  `doctor_id` bigint(20) unsigned DEFAULT NULL,
  `specialization` varchar(255) DEFAULT NULL,
  `registration_number` varchar(255) DEFAULT NULL,
  `consultation_fee` decimal(10,2) NOT NULL DEFAULT 0.00,
  `doctor_status` enum('active','inactive') DEFAULT 'active',
  `availability_schedule` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`availability_schedule`)),
  `image_path` varchar(255) DEFAULT NULL,
  `signature_path` varchar(255) DEFAULT NULL,
  `avatar_path` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `last_login_at` timestamp NULL DEFAULT NULL,
  `remember_token` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`),
  KEY `users_hospital_id_role_index` (`hospital_id`,`role`),
  KEY `users_doctor_id_index` (`doctor_id`),
  KEY `users_role_id_foreign` (`role_id`),
  KEY `users_hospital_id_role_id_index` (`hospital_id`,`role_id`),
  CONSTRAINT `users_doctor_id_foreign` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`) ON DELETE SET NULL,
  CONSTRAINT `users_hospital_id_foreign` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE CASCADE,
  CONSTRAINT `users_role_id_foreign` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,NULL,'Super Admin','superadmin@shifaascript.com',NULL,'$2y$12$wOTKeJRV629GToxz./rBGO8RTtiyckXEHJSnxTdurSVu3/H.qwrQ2','super_admin',NULL,NULL,NULL,NULL,0.00,'active',NULL,NULL,NULL,NULL,1,'2026-01-23 14:19:08',NULL,'2026-01-23 13:58:42','2026-01-23 14:19:08',NULL),(2,1,'Admin User','admin@hospital.com',NULL,'$2y$12$Se2cuE2Nb/nGkJ0GtIXLs.XUrMHPqVCJFhDgu5wO5NUEcLhCVgYBm','admin',1,NULL,NULL,NULL,0.00,'active',NULL,NULL,NULL,NULL,1,NULL,NULL,'2026-01-23 13:58:42','2026-01-23 13:58:42',NULL),(3,1,'Dr. Sarah Johnson','sarah.johnson@hospital.com',NULL,'$2y$12$3s3J0NCHzgDX4fxhRs6ZWeWRTTl.PjSjTGQlWjjHFAXW92.2drSwa','doctor',2,NULL,NULL,NULL,0.00,'active',NULL,NULL,NULL,NULL,1,NULL,NULL,'2026-01-23 13:58:43','2026-01-23 13:58:43',NULL),(4,1,'Reception Desk','receptionist@hospital.com',NULL,'$2y$12$N5wS.dap2Umxj49AGa59Eu6mvRak2w62ZzBBPnh5u8i0bB3US7Bx2','receptionist',3,NULL,NULL,NULL,0.00,'active',NULL,NULL,NULL,NULL,1,NULL,NULL,'2026-01-23 13:58:43','2026-01-23 13:58:43',NULL),(5,1,'Pharmacy User','pharmacist@hospital.com',NULL,'$2y$12$3NMgTNd0V6I2Clfn/av0/.CX2r8Uffo/fwVjn/TEZ5dxhPSM7gffC','pharmacist',4,NULL,NULL,NULL,0.00,'active',NULL,NULL,NULL,NULL,1,NULL,NULL,'2026-01-23 13:58:43','2026-01-23 13:58:43',NULL),(6,1,'Lab Tech','labtech@hospital.com',NULL,'$2y$12$w00YAaBjYnHeyQtz3efmAeESqjvS1yhvH3R3ol6jZMNTmAvC.oMfm','lab_technician',5,NULL,NULL,NULL,0.00,'active',NULL,NULL,NULL,NULL,1,NULL,NULL,'2026-01-23 13:58:43','2026-01-23 13:58:43',NULL),(7,2,'Dr. Aisha Rahman','aisha.rahman@citycarehospital.com','+1-202-555-0191','$2y$12$m659/dcTonKl9bEZ7RtiUedVY1tT5GNKAAubqBJFFwBWcctn0S.ym','doctor',NULL,1,'Cardiology','CC-DR-1001',150.00,'active',NULL,NULL,NULL,NULL,1,NULL,NULL,'2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(8,3,'Dr. Omar Siddiq','omar.siddiq@greenvalleymedical.com','+1-202-555-0132','$2y$12$LsTn.Rr5O5pXKarBuzemwe87A69d/cx4x1RT/trd5qO.NizfkGbLK','doctor',NULL,2,'Pediatrics','GV-DR-2002',120.00,'active',NULL,NULL,NULL,NULL,1,NULL,NULL,'2026-01-23 13:58:44','2026-01-23 13:58:44',NULL),(9,4,'Dr. Lina Patel','lina.patel@sunrisecommunity.com','+1-202-555-0166','$2y$12$wKR2W2QFIq8ul9dSGiracOlLd1GxCCh/HJAV1Jy/FME5eOx0xGNkS','doctor',NULL,3,'Family Medicine','SC-DR-3003',100.00,'active',NULL,NULL,NULL,NULL,1,NULL,NULL,'2026-01-23 13:58:44','2026-01-23 13:58:44',NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `walk_in_patients`
--

DROP TABLE IF EXISTS `walk_in_patients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `walk_in_patients` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `hospital_id` bigint(20) unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `age` int(10) unsigned NOT NULL DEFAULT 0,
  `gender` varchar(20) DEFAULT NULL,
  `created_by` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `walk_in_patients_hospital_id_name_index` (`hospital_id`,`name`),
  CONSTRAINT `walk_in_patients_hospital_id_foreign` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `walk_in_patients`
--

LOCK TABLES `walk_in_patients` WRITE;
/*!40000 ALTER TABLE `walk_in_patients` DISABLE KEYS */;
/*!40000 ALTER TABLE `walk_in_patients` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-01-23 18:50:51
