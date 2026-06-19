const express = require('express');
const router = express.Router();
const db = require('../config/database');
const qrcode = require('qrcode');
const axios = require('axios'); 
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
const generatePayload = require('promptpay-qr'); // ย้ายมาไว้ด้านบน

const upload = multer({ dest: 'uploads/' });

const SLIPOK_BRANCH_ID = '68837';
const SLIPOK_API_KEY = 'SLIPOKG9GHACC';
const MY_PROMPTPAY = '0942253619';

// =================================================================
// ===== 1. Generate QR Code =====
// =================================================================
router.post('/generate-qr', async (req, res) => {
    const { userId, amount, items, method, paymentAccount } = req.body;
    
    if (!userId || !amount || !items) {
        return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง' });
    }

    try {
        const targetDiamonds = items.reduce((sum, item) => sum + ((item.gems_reward || item.diamonds || 0) * (item.quantity || 1)), 0);
        const orderId = 'WM-' + Date.now();

        await db.execute(
            `INSERT INTO orders (id, user_id, total_price, gems_amount, payment_method, payment_account, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [orderId, userId, amount, targetDiamonds, method, paymentAccount, 'pending']
        );

        for (const item of items) {
            await db.execute('INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
                [orderId, item.id, item.quantity, item.price]);
        }

        const promptpayRawData = generatePayload(MY_PROMPTPAY, { amount: parseFloat(amount) });
        qrcode.toDataURL(promptpayRawData, (err, url) => {
            if (err) return res.status(500).json({ error: 'QR Generation Error' });
            res.json({ success: true, orderId, QrCode: url });
        });
    } catch (error) {
        res.status(500).json({ error: 'Database Error' });
    }
});

// =================================================================
// ===== 2. Wallet History (แก้ไขให้ดึงจาก req.session.user.id) =====
// =================================================================
router.get('/wallet/history', async (req, res) => {
    // แก้ไขจาก req.session.userId เป็น req.session.user.id ตามโครงสร้าง Login ใหม่
    const userId = req.session?.user?.id; 
    
    if (!userId) {
        return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
    }

    try {
        const [orders] = await db.execute(
            `SELECT id, total_price, gems_amount, payment_method, status, created_at 
             FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
            [userId]
        );
        res.json({ orders });
    } catch (error) {
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงประวัติ' });
    }
});

// =================================================================
// ===== 3. Get Wallet History (ดึงประวัติการสั่งซื้อของผู้เล่น) =====
// =================================================================
router.get('/wallet/history', async (req, res) => {
    const userId = req.query.userId || req.session?.userId;
    
    if (!userId) {
        return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
    }

    try {
        // 🌟 [แก้ไข SQL] เพิ่มเงื่อนไข AND o.status = 'completed' เพื่อดึงเฉพาะรายการที่จ่ายเงินแล้ว
        const [orders] = await db.execute(
            `SELECT 
                o.id,
                u.username as buyer_name,
                p.name as product_name,
                oi.quantity,
                o.total_price,
                o.gems_amount, 
                o.payment_method,
                o.status,
                o.created_at
             FROM orders o
             JOIN users u ON o.user_id = u.id
             LEFT JOIN order_items oi ON o.id = oi.order_id
             LEFT JOIN products p ON oi.product_id = p.id
             WHERE o.user_id = ? AND o.status = 'completed' 
             ORDER BY o.created_at DESC 
             LIMIT 50`,
            [userId]
        );

        res.json({ orders });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการโหลดประวัติ' });
    }
});

// =================================================================
// ===== 4. Check Slip (ฟังก์ชัน AI สแกนสลิปผ่าน SlipOK และแปลงเป็นเพชรทันที) =====
// =================================================================
router.post('/check-slip', upload.single('slipImage'), async (req, res) => {
    const { orderId } = req.body; 

    try {
        if (!req.file) {
            return res.status(400).json({ error: 'กรุณาอัปโหลดรูปสลิป' });
        }

        if (!orderId) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'ไม่พบรหัสบิลชำระเงินที่ต้องการตรวจสอบ' });
        }

        const [orders] = await db.execute('SELECT * FROM orders WHERE id = ?', [orderId]);
        if (orders.length === 0) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(404).json({ error: 'ไม่พบรหัสบิลชำระเงินนี้ในระบบเซิร์ฟเวอร์' });
        }

        const order = orders[0];

        if (order.status === 'completed') {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'บิลชำระเงินนี้ได้รับการตรวจสอบและเติมยอดเงินเสร็จไปแล้ว' });
        }

        // เตรียมข้อมูลส่งรูปภาพไฟล์ดิบไปตรวจที่ระบบกลาง SlipOK API
        const form = new FormData();
        form.append('files', fs.createReadStream(req.file.path));
        form.append('log', 'true'); 

        console.log('📤 ส่งสลิปไป SlipOK | orderId:', orderId, '| file:', req.file?.path);

        const response = await axios.post(
            
            `https://api.slipok.com/api/line/apikey/${SLIPOK_BRANCH_ID}`, 
            form, 
            {
                headers: {
                    'x-authorization': SLIPOK_API_KEY,
                    ...form.getHeaders()
                }
            }
        );

        // ทำลายไฟล์ขยะชั่วคราวในโฟลเดอร์ uploads ทันทีหลังได้รับผลลัพธ์
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        const slipData = response.data;
        console.log('🔍 FULL SlipOK:', JSON.stringify(slipData.data, null, 2));

        if (slipData.success && slipData.data.success) {
            const paidAmount = parseFloat(slipData.data.amount); 
            const senderName = slipData.data.sender.displayName; 
            const receiverData = slipData.data.receiver; 

            // 4.1 ตรวจสอบความถูกต้องของยอดเงินโอน
            if (paidAmount !== parseFloat(order.final_amount)) {
                return res.status(400).json({ error: `ยอดเงินในสลิป (${paidAmount} บาท) ไม่ตรงกับยอดที่บิลระบุไว้ (${order.final_amount} บาท)` });
            }

            let isCorrectReceiver = false;

            // 🌟 รองรับทั้งชื่อภาษาไทยและอังกฤษ
            const MY_NAMES = ['Patcharapon', 'พัชรพล']; // ✏️ เพิ่ม/แก้ชื่อได้เลย

            if (receiverData) {
                if (receiverData.displayName && (
                    MY_NAMES.some(name => receiverData.displayName.includes(name)) ||
                    receiverData.displayName.includes('0942253619')
                )) {
                    isCorrectReceiver = true;
                }

                const cleanMyPromptPay = MY_PROMPTPAY.replace(/[^0-9]/g, '');
                if (!isCorrectReceiver && receiverData.proxy && receiverData.proxy.value) {
                    const cleanTarget = receiverData.proxy.value.replace(/[^0-9]/g, '');
                    if (cleanTarget.includes(cleanMyPromptPay) || cleanMyPromptPay.includes(cleanTarget)) {
                        isCorrectReceiver = true;
                    }
                }
                
                if (!isCorrectReceiver && receiverData.account && receiverData.account.value) {
                    const cleanAccount = receiverData.account.value.replace(/[^0-9]/g, '');
                    if (cleanAccount.includes(cleanMyPromptPay)) {
                        isCorrectReceiver = true;
                    }
                }
            }

            if (!isCorrectReceiver) {
                return res.status(400).json({ error: 'สลิปนี้ไม่ได้โอนเงินเข้าบัญชีพร้อมเพย์ของร้านค้าหลักเซิร์ฟเวอร์' });
            }

            // =================================================================
            // 4.3 อัปเดตข้อมูลบันทึกลง MySQL -> 💎 ดึงยอดเพชรจากแพ็กเกจที่ผู้เล่นเลือก!
            // =================================================================
            const gemsToAdd = parseInt(order.gems_amount) || 0;

            // เปลี่ยนสถานะออเดอร์ในตาราง orders เป็น completed
            await db.execute('UPDATE orders SET status = "completed" WHERE id = ?', [orderId]);

            // 🔥 บวก Gems ให้ผู้เล่น (ถ้า gems > 0)
            if (gemsToAdd > 0) {
                await db.execute('UPDATE users SET points = points + ? WHERE id = ?', [gemsToAdd, order.user_id]);
            }

            // =================================================================
            // 4.4 เขียน command_logs เพื่อให้ปลั๊กอิน Minecraft รับไปรันในเกม
            // =================================================================
            const [buyer] = await db.execute('SELECT username FROM users WHERE id = ?', [order.user_id]);
            const username = buyer[0]?.username || '';

            // ดึงสินค้าทุกรายการใน order นี้
            const [orderItems] = await db.execute(
                `SELECT oi.product_id, oi.quantity, p.mc_command, p.name
                 FROM order_items oi
                 JOIN products p ON oi.product_id = p.id
                 WHERE oi.order_id = ?`,
                [orderId]
            );

            for (const item of orderItems) {
                if (!item.mc_command) continue;

                // แทนที่ {username} ด้วยชื่อผู้เล่นจริง
                const command = item.mc_command.replace(/{username}/g, username);

                await db.execute(
                    `INSERT INTO command_logs (order_id, product_id, username, command, status)
                     VALUES (?, ?, ?, ?, 'pending')`,
                    [orderId, item.product_id, username, command]
                );

                console.log(`📝 [command_logs] เพิ่มคำสั่ง: ${command} สำหรับ ${username}`);
            }

            // =================================================================
            // 4.4 คิวรีดึงข้อมูลจำนวนเพชรล่าสุดของผู้เล่นส่งกลับคืนหน้าบ้าน
            // =================================================================
            const [updatedUser] = await db.execute('SELECT points FROM users WHERE id = ?', [order.user_id]);
            const currentPoints = updatedUser[0]?.points || 0;

            console.log(`💎 [SlipOK Success] ลูกค้าโอน ${paidAmount} บาท -> เติมแพ็กเกจสำเร็จ! แจก ${gemsToAdd} เพชร ให้ User ID: ${order.user_id} (เพชรรวมปัจจุบัน: ${currentPoints})`);

            return res.json({ 
                success: true, 
                message: `ตรวจสอบผ่านฉลุย! ได้รับเพชรจำนวน ${gemsToAdd} Gems เข้าตัวละครเรียบร้อย`,
                new_balance: currentPoints 
            });
        } else {
            return res.status(400).json({ error: 'ระบบไม่สามารถอ่านข้อมูลบนสลิปได้ หรือเป็นภาพสลิปปลอม/ใช้งานซ้ำ' });
        }

    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        console.error('❌ SlipOK Error message:', error.message);
        console.error('❌ SlipOK Error response:', JSON.stringify(error.response?.data, null, 2));
        console.error('❌ SlipOK Error status:', error.response?.status);

        if (error.response && error.response.data) {
             return res.status(400).json({ error: error.response.data.message || JSON.stringify(error.response.data) });
        }
        
        console.error('SlipOK System Error:', error.message);
        return res.status(500).json({ error: 'ระบบตรวจสอบสลิปขัดข้องชั่วคราว กรุณาติดต่อแอดมินพร้อมรูปสลิป' });
    }
});

// =================================================================
// ===== 5. Apply Coupon (ตรวจสอบและคำนวณส่วนลดคูปอง) =====
// =================================================================
router.post('/apply-coupon', async (req, res) => {
    const { code, amount } = req.body;

    if (!code || !amount) {
        return res.status(400).json({ error: 'กรุณากรอกรหัสคูปองและยอดรวม' });
    }

    try {
        const [coupons] = await db.execute(
            `SELECT * FROM coupons 
             WHERE code = ? AND is_active = 1 
             AND (valid_until IS NULL OR valid_until > NOW())
             AND (max_uses IS NULL OR current_uses < max_uses)
             AND min_amount <= ?`,
            [code.toUpperCase(), parseFloat(amount)]
        );

        if (coupons.length === 0) {
            return res.status(404).json({ error: 'คูปองไม่ถูกต้อง หมดอายุ หรือถูกใช้ครบแล้ว' });
        }

        const coupon = coupons[0];
        let discount = 0;

        if (coupon.discount_type === 'percentage') {
            discount = parseFloat(amount) * parseFloat(coupon.discount_value) / 100;
        } else {
            discount = parseFloat(coupon.discount_value);
        }

        // ไม่ให้ส่วนลดเกินยอดรวม
        discount = Math.min(discount, parseFloat(amount));

        res.json({
            success: true,
            discount: Math.round(discount * 100) / 100,
            coupon_code: coupon.code,
            discount_type: coupon.discount_type,
            discount_value: parseFloat(coupon.discount_value)
        });

    } catch (error) {
        console.error('Apply Coupon Error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการตรวจสอบคูปอง' });
    }
});

module.exports = router;