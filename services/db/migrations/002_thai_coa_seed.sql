-- Thai Standard Chart of Accounts (แผนบัญชีมาตรฐานไทย)

-- ASSETS (สินทรัพย์) 1000-1900
INSERT OR IGNORE INTO accounts (id, company_id, account_code, account_name, account_type, sub_type, balance_side, is_active) VALUES
-- Current Assets (สินทรัพย์หมุนเวียน)
('acc_1100', 'company_template', '1100', 'เงินสด', 'Asset', 'Current Asset', 'D', 1),
('acc_1110', 'company_template', '1110', 'เงินฝากธนาคาร', 'Asset', 'Current Asset', 'D', 1),
('acc_1200', 'company_template', '1200', 'ลูกหนี้การค้า', 'Asset', 'Current Asset', 'D', 1),
('acc_1210', 'company_template', '1210', 'ลูกหนี้อื่น', 'Asset', 'Current Asset', 'D', 1),
('acc_1300', 'company_template', '1300', 'สินค้าคงเหลือ', 'Asset', 'Current Asset', 'D', 1),
('acc_1400', 'company_template', '1400', 'ลงทุนระยะสั้น', 'Asset', 'Current Asset', 'D', 1),
('acc_1500', 'company_template', '1500', 'ค่าใช้จ่ายจ่ายล่วงหน้า', 'Asset', 'Current Asset', 'D', 1),

-- Fixed Assets (สินทรัพย์ไม่หมุนเวียน)
('acc_1600', 'company_template', '1600', 'ที่ดิน', 'Asset', 'Fixed Asset', 'D', 1),
('acc_1610', 'company_template', '1610', 'อาคารและสิ่งปลูกสร้าง', 'Asset', 'Fixed Asset', 'D', 1),
('acc_1620', 'company_template', '1620', 'เครื่องจักร', 'Asset', 'Fixed Asset', 'D', 1),
('acc_1630', 'company_template', '1630', 'เฟอร์นิเจอร์และอุปกรณ์สำนักงาน', 'Asset', 'Fixed Asset', 'D', 1),
('acc_1640', 'company_template', '1640', 'ยานพาหนะ', 'Asset', 'Fixed Asset', 'D', 1),
('acc_1650', 'company_template', '1650', 'สิทธิการใช้', 'Asset', 'Fixed Asset', 'D', 1),

-- Accumulated Depreciation (ค่าเสื่อมราคา)
('acc_1710', 'company_template', '1710', 'ค่าเสื่อมราคา-อาคาร', 'Asset', 'Accumulated Depreciation', 'C', 1),
('acc_1720', 'company_template', '1720', 'ค่าเสื่อมราคา-เครื่องจักร', 'Asset', 'Accumulated Depreciation', 'C', 1),
('acc_1730', 'company_template', '1730', 'ค่าเสื่อมราคา-เฟอร์นิเจอร์', 'Asset', 'Accumulated Depreciation', 'C', 1),
('acc_1740', 'company_template', '1740', 'ค่าเสื่อมราคา-ยานพาหนะ', 'Asset', 'Accumulated Depreciation', 'C', 1),

-- Intangible Assets (สินทรัพย์ไม่มีตัวตน)
('acc_1800', 'company_template', '1800', 'โปรแกรมคอมพิวเตอร์', 'Asset', 'Intangible Asset', 'D', 1),
('acc_1810', 'company_template', '1810', 'ค่าความนิยม', 'Asset', 'Intangible Asset', 'D', 1),

-- LIABILITIES (หนี้สิน) 2000-2900
INSERT OR IGNORE INTO accounts (id, company_id, account_code, account_name, account_type, sub_type, balance_side, is_active) VALUES
-- Current Liabilities (หนี้สินหมุนเวียน)
('acc_2100', 'company_template', '2100', 'เจ้าหนี้การค้า', 'Liability', 'Current Liability', 'C', 1),
('acc_2110', 'company_template', '2110', 'เจ้าหนี้อื่น', 'Liability', 'Current Liability', 'C', 1),
('acc_2200', 'company_template', '2200', 'ค่าใช้จ่ายค้างจ่าย', 'Liability', 'Current Liability', 'C', 1),
('acc_2210', 'company_template', '2210', 'ค่าจ้างค้างจ่าย', 'Liability', 'Current Liability', 'C', 1),
('acc_2300', 'company_template', '2300', 'ภาษีหนึ่งหรือสูงสุด', 'Liability', 'Current Liability', 'C', 1),
('acc_2310', 'company_template', '2310', 'ภาษีเงินได้ค้างจ่าย', 'Liability', 'Current Liability', 'C', 1),
('acc_2320', 'company_template', '2320', 'ภาษีมูลค่าเพิ่ม (VAT) ค้างจ่าย', 'Liability', 'Current Liability', 'C', 1),
('acc_2330', 'company_template', '2330', 'ค่าหักประกันสังคมค้างจ่าย', 'Liability', 'Current Liability', 'C', 1),
('acc_2400', 'company_template', '2400', 'เงินกู้ยืมระยะสั้น', 'Liability', 'Current Liability', 'C', 1),
('acc_2500', 'company_template', '2500', 'รายได้รับล่วงหน้า', 'Liability', 'Current Liability', 'C', 1),

-- Long-term Liabilities (หนี้สินระยะยาว)
('acc_2600', 'company_template', '2600', 'เงินกู้ยืมระยะยาว', 'Liability', 'Long-term Liability', 'C', 1),
('acc_2700', 'company_template', '2700', 'หนี้สินผลประโยชน์พนักงาน', 'Liability', 'Long-term Liability', 'C', 1),

-- EQUITY (ทุน) 3000-3900
INSERT OR IGNORE INTO accounts (id, company_id, account_code, account_name, account_type, sub_type, balance_side, is_active) VALUES
('acc_3100', 'company_template', '3100', 'ทุนเรือนหุ่น', 'Equity', 'Equity', 'C', 1),
('acc_3110', 'company_template', '3110', 'ส่วนเกินทุน', 'Equity', 'Equity', 'C', 1),
('acc_3200', 'company_template', '3200', 'กำไรสะสม', 'Equity', 'Equity', 'C', 1),
('acc_3210', 'company_template', '3210', 'กำไรสะสม-ปีก่อน', 'Equity', 'Equity', 'C', 1),
('acc_3220', 'company_template', '3220', 'กำไรสะสม-ปีปัจจุบัน', 'Equity', 'Equity', 'C', 1),
('acc_3300', 'company_template', '3300', 'เงินปันผลจ่าย', 'Equity', 'Equity', 'D', 1),

-- REVENUES (รายได้) 4000-4900
INSERT OR IGNORE INTO accounts (id, company_id, account_code, account_name, account_type, sub_type, balance_side, is_active) VALUES
('acc_4100', 'company_template', '4100', 'รายได้จากการขาย', 'Revenue', 'Operating Revenue', 'C', 1),
('acc_4110', 'company_template', '4110', 'ส่วนลดการขาย', 'Revenue', 'Operating Revenue', 'D', 1),
('acc_4120', 'company_template', '4120', 'ค่าคืนสินค้า', 'Revenue', 'Operating Revenue', 'D', 1),
('acc_4200', 'company_template', '4200', 'รายได้จากการให้บริการ', 'Revenue', 'Operating Revenue', 'C', 1),
('acc_4300', 'company_template', '4300', 'รายได้อื่น', 'Revenue', 'Other Income', 'C', 1),
('acc_4310', 'company_template', '4310', 'รายได้ดอกเบี้ย', 'Revenue', 'Other Income', 'C', 1),
('acc_4320', 'company_template', '4320', 'รายได้เช่า', 'Revenue', 'Other Income', 'C', 1),
('acc_4330', 'company_template', '4330', 'กำไรจากการขายสินทรัพย์', 'Revenue', 'Other Income', 'C', 1),
('acc_4340', 'company_template', '4340', 'กำไรจากอัตราแลกเปลี่ยน', 'Revenue', 'Other Income', 'C', 1),

-- EXPENSES (ค่าใช้จ่าย) 5000-5900
INSERT OR IGNORE INTO accounts (id, company_id, account_code, account_name, account_type, sub_type, balance_side, is_active) VALUES
-- Cost of Sales (ต้นทุนขาย)
('acc_5100', 'company_template', '5100', 'ต้นทุนสินค้าขายเข้า', 'Expense', 'Cost of Sales', 'D', 1),
('acc_5110', 'company_template', '5110', 'ต้นทุนบริการให้บริการ', 'Expense', 'Cost of Sales', 'D', 1),

-- Operating Expenses (ค่าใช้จ่ายในการดำเนินงาน)
('acc_5200', 'company_template', '5200', 'ค่าจ้างบุคลากร', 'Expense', 'Operating Expense', 'D', 1),
('acc_5210', 'company_template', '5210', 'ค่าเบี้ยประกันสังคม', 'Expense', 'Operating Expense', 'D', 1),
('acc_5220', 'company_template', '5220', 'ค่าประกันสุขภาพ', 'Expense', 'Operating Expense', 'D', 1),
('acc_5300', 'company_template', '5300', 'ค่าเช่า', 'Expense', 'Operating Expense', 'D', 1),
('acc_5310', 'company_template', '5310', 'ค่าไฟฟ้า และน้ำประปา', 'Expense', 'Operating Expense', 'D', 1),
('acc_5320', 'company_template', '5320', 'ค่าโทรศัพท์และอินเทอร์เน็ต', 'Expense', 'Operating Expense', 'D', 1),
('acc_5330', 'company_template', '5330', 'ค่าท่องเที่ยวและบันเทิง', 'Expense', 'Operating Expense', 'D', 1),
('acc_5340', 'company_template', '5340', 'ค่าบริหารและการดำเนินการ', 'Expense', 'Operating Expense', 'D', 1),
('acc_5350', 'company_template', '5350', 'ค่าซ่อมและบำรุงรักษา', 'Expense', 'Operating Expense', 'D', 1),
('acc_5360', 'company_template', '5360', 'ค่าเสื่อมราคา', 'Expense', 'Operating Expense', 'D', 1),
('acc_5370', 'company_template', '5370', 'ค่าอื่น ๆ ในการดำเนินงาน', 'Expense', 'Operating Expense', 'D', 1),

-- Other Expenses (ค่าใช้จ่ายอื่น)
('acc_5500', 'company_template', '5500', 'ค่าดอกเบี้ยจ่าย', 'Expense', 'Other Expense', 'D', 1),
('acc_5510', 'company_template', '5510', 'ขาดทุนจากการขายสินทรัพย์', 'Expense', 'Other Expense', 'D', 1),
('acc_5520', 'company_template', '5520', 'ขาดทุนจากอัตราแลกเปลี่ยน', 'Expense', 'Other Expense', 'D', 1),
('acc_5530', 'company_template', '5530', 'ค่าใช้จ่ายอื่น', 'Expense', 'Other Expense', 'D', 1);

-- Tax-related Accounts (บัญชีที่เกี่ยวข้องกับภาษี)
INSERT OR IGNORE INTO accounts (id, company_id, account_code, account_name, account_type, sub_type, balance_side, is_active) VALUES
('acc_2331', 'company_template', '2331', 'ค่าหักประกันสังคม-พนักงาน', 'Liability', 'Current Liability', 'C', 1),
('acc_2332', 'company_template', '2332', 'ค่าหักประกันสังคม-นายจ้าง', 'Liability', 'Current Liability', 'C', 1),
('acc_2340', 'company_template', '2340', 'ค่าหักรายได้', 'Liability', 'Current Liability', 'C', 1),
('acc_5215', 'company_template', '5215', 'ค่าสมทบประกันสังคม-นายจ้าง', 'Expense', 'Operating Expense', 'D', 1);
