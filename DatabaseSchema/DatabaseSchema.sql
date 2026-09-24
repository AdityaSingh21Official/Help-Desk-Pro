-- MySQL dump 10.13  Distrib 8.0.44, for Win64 (x86_64)
--
-- Host: localhost    Database: helpdeskpro
-- ------------------------------------------------------
-- Server version	8.0.44

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `admin`
--

DROP TABLE IF EXISTS `admin`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin` (
  `AID` int NOT NULL,
  `AName` varchar(100) NOT NULL,
  `AEmail` varchar(100) NOT NULL,
  `Apassword` varchar(200) NOT NULL,
  PRIMARY KEY (`AID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `agent`
--

DROP TABLE IF EXISTS `agent`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `agent` (
  `AGID` int NOT NULL,
  `AGName` varchar(100) DEFAULT NULL,
  `AGEmail` varchar(100) NOT NULL,
  `AGPassword` varchar(200) NOT NULL,
  `AGLevel` int NOT NULL,
  `IsActive` tinyint(1) NOT NULL,
  `AID` int NOT NULL,
  PRIMARY KEY (`AGID`),
  KEY `AID` (`AID`),
  CONSTRAINT `agent_ibfk_1` FOREIGN KEY (`AID`) REFERENCES `admin` (`AID`),
  CONSTRAINT `AGLevel_limit` CHECK ((`AGLevel` in (2,3,4)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `api_key`
--

DROP TABLE IF EXISTS `api_key`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_key` (
  `ApiKeyID` int NOT NULL,
  `ApiKeyHash` varchar(200) NOT NULL,
  `ApiPrefix` varchar(25) NOT NULL,
  `ApiTier` varchar(5) DEFAULT NULL,
  `IsRevoked` tinyint(1) NOT NULL,
  `Expiry` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `OrgId` int DEFAULT NULL,
  `AID` int NOT NULL,
  PRIMARY KEY (`ApiKeyID`),
  KEY `OrgId` (`OrgId`),
  KEY `AID` (`AID`),
  CONSTRAINT `api_key_ibfk_1` FOREIGN KEY (`OrgId`) REFERENCES `org` (`OrgID`),
  CONSTRAINT `api_key_ibfk_2` FOREIGN KEY (`AID`) REFERENCES `admin` (`AID`),
  CONSTRAINT `ApiTier_Check` CHECK ((`ApiTier` in (_cp850'free',_cp850'pro')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `customer`
--

DROP TABLE IF EXISTS `customer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer` (
  `CID` int NOT NULL,
  `CName` varchar(100) DEFAULT NULL,
  `CEmail` varchar(100) NOT NULL,
  `CPassword` varchar(200) NOT NULL,
  `OrgID` int DEFAULT NULL,
  PRIMARY KEY (`CID`),
  KEY `OrgID` (`OrgID`),
  CONSTRAINT `customer_ibfk_1` FOREIGN KEY (`OrgID`) REFERENCES `org` (`OrgID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `org`
--

DROP TABLE IF EXISTS `org`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `org` (
  `OrgID` int NOT NULL,
  `OrgName` varchar(100) NOT NULL,
  PRIMARY KEY (`OrgID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `rate_limit_bucket`
--

DROP TABLE IF EXISTS `rate_limit_bucket`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rate_limit_bucket` (
  `ApiKeyId` int NOT NULL,
  `TokensRemaining` int NOT NULL,
  `LastRefilAt` datetime NOT NULL,
  PRIMARY KEY (`ApiKeyId`),
  CONSTRAINT `rate_limit_bucket_ibfk_1` FOREIGN KEY (`ApiKeyId`) REFERENCES `api_key` (`ApiKeyID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `refresh_token`
--

DROP TABLE IF EXISTS `refresh_token`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `refresh_token` (
  `RefreshTokenID` int NOT NULL,
  `tokenhash` varchar(200) DEFAULT NULL,
  `expiresAt` datetime DEFAULT NULL,
  `revokedAt` datetime DEFAULT NULL,
  `aid` int DEFAULT NULL,
  `agid` int DEFAULT NULL,
  `cid` int DEFAULT NULL,
  PRIMARY KEY (`RefreshTokenID`),
  UNIQUE KEY `tokenhash` (`tokenhash`),
  KEY `aid` (`aid`),
  KEY `agid` (`agid`),
  KEY `cid` (`cid`),
  CONSTRAINT `refresh_token_ibfk_1` FOREIGN KEY (`aid`) REFERENCES `admin` (`AID`),
  CONSTRAINT `refresh_token_ibfk_2` FOREIGN KEY (`agid`) REFERENCES `agent` (`AGID`),
  CONSTRAINT `refresh_token_ibfk_3` FOREIGN KEY (`cid`) REFERENCES `customer` (`CID`),
  CONSTRAINT `check_one_owner_refresh` CHECK ((((`Aid` is not null) and (`agid` is null) and (`cid` is null)) or ((`Aid` is null) and (`AGID` is not null) and (`cid` is null)) or ((`Aid` is null) and (`AGID` is null) and (`cid` is not null))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ticket`
--

DROP TABLE IF EXISTS `ticket`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ticket` (
  `TID` int NOT NULL,
  `TTitle` varchar(100) NOT NULL,
  `TBody` varchar(2000) DEFAULT NULL,
  `Tpriority` varchar(10) NOT NULL,
  `Tstatus` varchar(15) NOT NULL,
  `TcreationTime` datetime NOT NULL,
  `TresolveTime` datetime DEFAULT NULL,
  `BreachDueAt` datetime NOT NULL,
  `IdempotencyKey` varchar(100) DEFAULT NULL,
  `CID` int NOT NULL,
  `AGID` int DEFAULT NULL,
  `ApiKeyId` int DEFAULT NULL,
  PRIMARY KEY (`TID`),
  KEY `CID` (`CID`),
  KEY `AGID` (`AGID`),
  KEY `ApiKeyId` (`ApiKeyId`),
  CONSTRAINT `ticket_ibfk_1` FOREIGN KEY (`CID`) REFERENCES `customer` (`CID`),
  CONSTRAINT `ticket_ibfk_2` FOREIGN KEY (`AGID`) REFERENCES `agent` (`AGID`),
  CONSTRAINT `ticket_ibfk_3` FOREIGN KEY (`ApiKeyId`) REFERENCES `api_key` (`ApiKeyID`),
  CONSTRAINT `Tpriority_check` CHECK ((`Tpriority` in (_cp850'low',_cp850'medium',_cp850'high',_cp850'critical'))),
  CONSTRAINT `Tstatus_check` CHECK ((`Tstatus` in (_cp850'open',_cp850'in_progress',_cp850'resolved',_cp850'closed')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ticket_comment`
--

DROP TABLE IF EXISTS `ticket_comment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ticket_comment` (
  `CommentId` int NOT NULL,
  `TID` int DEFAULT NULL,
  `Body` varchar(1500) DEFAULT NULL,
  `IsInternal` tinyint(1) NOT NULL,
  `CreatedAt` datetime DEFAULT NULL,
  `AGID` int DEFAULT NULL,
  `CID` int DEFAULT NULL,
  PRIMARY KEY (`CommentId`),
  KEY `TID` (`TID`),
  KEY `AGID` (`AGID`),
  KEY `CID` (`CID`),
  CONSTRAINT `ticket_comment_ibfk_1` FOREIGN KEY (`TID`) REFERENCES `ticket` (`TID`),
  CONSTRAINT `ticket_comment_ibfk_2` FOREIGN KEY (`AGID`) REFERENCES `agent` (`AGID`),
  CONSTRAINT `ticket_comment_ibfk_3` FOREIGN KEY (`CID`) REFERENCES `customer` (`CID`),
  CONSTRAINT `check_one_owner` CHECK ((((`AGID` is not null) and (`cid` is null)) or ((`AGID` is null) and (`cid` is not null))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ticket_history`
--

DROP TABLE IF EXISTS `ticket_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ticket_history` (
  `HistoryId` int NOT NULL,
  `TID` int NOT NULL,
  `OldStatus` varchar(15) NOT NULL,
  `NewStatus` varchar(15) NOT NULL,
  `changedAt` datetime DEFAULT (now()),
  `AGID` int DEFAULT NULL,
  `AID` int DEFAULT NULL,
  PRIMARY KEY (`HistoryId`),
  KEY `TID` (`TID`),
  KEY `AGID` (`AGID`),
  KEY `AID` (`AID`),
  CONSTRAINT `ticket_history_ibfk_1` FOREIGN KEY (`TID`) REFERENCES `ticket` (`TID`),
  CONSTRAINT `ticket_history_ibfk_2` FOREIGN KEY (`AGID`) REFERENCES `agent` (`AGID`),
  CONSTRAINT `ticket_history_ibfk_3` FOREIGN KEY (`AID`) REFERENCES `admin` (`AID`),
  CONSTRAINT `status_check` CHECK (((`OldStatus` in (_cp850'open',_cp850'in_progress',_cp850'resolved',_cp850'closed')) and (`newStatus` in (_cp850'open',_cp850'in_progress',_cp850'resolved',_cp850'closed'))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-24 18:33:02
