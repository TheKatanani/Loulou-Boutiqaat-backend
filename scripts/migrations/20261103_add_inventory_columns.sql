-- ============================================================================
-- LOULOU BOUTIQAAT - INVENTORY & COST ACCOUNTING SCHEMA MIGRATION
-- Non-destructive additive migration for TiDB / MySQL
-- ============================================================================

-- 1. Add physicalStock, reservedStock, unitCost, isArchived to Products
ALTER TABLE `Products`
  ADD COLUMN IF NOT EXISTS `physicalStock` INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `reservedStock` INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `unitCost` DECIMAL(10, 2) NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `isArchived` TINYINT(1) NOT NULL DEFAULT 0;

-- 2. Add costSnapshotted, totalPurchaseCost, hasUnknownCost, deliveredAt, returnedAt, returnReason, archived to Orders
ALTER TABLE `Orders`
  ADD COLUMN IF NOT EXISTS `costSnapshotted` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `totalPurchaseCost` DECIMAL(10, 2) NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `hasUnknownCost` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `deliveredAt` DATETIME NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `returnedAt` DATETIME NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `returnReason` TEXT NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `archived` TINYINT(1) NOT NULL DEFAULT 0;

-- 3. Create StockMovements table if not exists
CREATE TABLE IF NOT EXISTS `StockMovements` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `productId` INT NOT NULL,
  `movementType` ENUM('receipt', 'reservation', 'reservation_release', 'delivery', 'return', 'adjustment', 'opening_balance') NOT NULL,
  `quantity` INT NOT NULL,
  `unitCost` DECIMAL(10, 2) NULL DEFAULT NULL,
  `totalCost` DECIMAL(10, 2) NULL DEFAULT NULL,
  `physicalBefore` INT NOT NULL DEFAULT 0,
  `physicalAfter` INT NOT NULL DEFAULT 0,
  `reservedBefore` INT NOT NULL DEFAULT 0,
  `reservedAfter` INT NOT NULL DEFAULT 0,
  `availableBefore` INT NOT NULL DEFAULT 0,
  `availableAfter` INT NOT NULL DEFAULT 0,
  `unitCostBefore` DECIMAL(10, 2) NULL DEFAULT NULL,
  `unitCostAfter` DECIMAL(10, 2) NULL DEFAULT NULL,
  `orderId` INT NULL DEFAULT NULL,
  `orderCode` VARCHAR(255) NULL DEFAULT NULL,
  `createdByUserId` INT NULL DEFAULT NULL,
  `notes` TEXT NULL DEFAULT NULL,
  `idempotencyKey` VARCHAR(128) NULL DEFAULT NULL,
  `createdAt` DATETIME NOT NULL,
  UNIQUE KEY `uniq_sm_idempotencyKey` (`idempotencyKey`),
  KEY `idx_sm_productId` (`productId`),
  KEY `idx_sm_orderId` (`orderId`),
  CONSTRAINT `fk_sm_product` FOREIGN KEY (`productId`) REFERENCES `Products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_sm_order` FOREIGN KEY (`orderId`) REFERENCES `Orders` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. In case StockMovements was created previously without idempotencyKey
ALTER TABLE `StockMovements`
  ADD COLUMN IF NOT EXISTS `idempotencyKey` VARCHAR(128) NULL;
-- Run scripts/migrateInventory.js to ensure the unique index on older tables.
