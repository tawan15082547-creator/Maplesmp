-- เพิ่ม wallet_balance column ให้กับ users table (ถ้ายังไม่มี)
ALTER TABLE `users` ADD COLUMN `wallet_balance` decimal(10,2) DEFAULT 0.00 COMMENT 'ยอดเงินใน Wallet' AFTER `points`;

-- เพิ่มตาราง coupons สำหรับเก็บข้อมูลคูปองส่วนลด
CREATE TABLE `coupons` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL UNIQUE,
  `discount_type` enum('percentage','fixed') NOT NULL DEFAULT 'percentage',
  `discount_value` decimal(10,2) NOT NULL,
  `max_uses` int(11) DEFAULT NULL,
  `current_uses` int(11) DEFAULT 0,
  `min_amount` decimal(10,2) DEFAULT 0,
  `valid_from` datetime DEFAULT CURRENT_TIMESTAMP,
  `valid_until` datetime DEFAULT NULL,
  `is_active` boolean DEFAULT 1,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `is_active` (`is_active`),
  KEY `valid_until` (`valid_until`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- เพิ่ม payment_method column ใน orders table (ถ้ายังไม่มี)
ALTER TABLE `orders` 
  MODIFY `payment_method` enum('PromptPay','TrueMoney') NOT NULL DEFAULT 'PromptPay',
  ADD COLUMN `payment_account` varchar(50) DEFAULT NULL COMMENT 'โทรศัพท์สำหรับ TrueMoney หรือ ID สำหรับ PromptPay',
  ADD COLUMN `coupon_code` varchar(50) DEFAULT NULL,
  ADD COLUMN `discount_amount` decimal(10,2) DEFAULT 0,
  ADD COLUMN `final_amount` decimal(10,2) NOT NULL;

-- ตัวอย่าง coupon data
INSERT INTO `coupons` (`code`, `discount_type`, `discount_value`, `max_uses`, `min_amount`, `valid_until`, `is_active`) VALUES
('WELCOME10', 'percentage', 10, 100, 0, '2026-12-31 23:59:59', 1),
('SAVE50', 'fixed', 50, 50, 100, '2026-12-31 23:59:59', 1),
('SUMMER20', 'percentage', 20, 200, 200, '2026-12-31 23:59:59', 1);
