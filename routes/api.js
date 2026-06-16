const express = require('express');
const router = express.Router();
const db = require('../config/database');
const generatePayload = require('promptpay-qr');
const qrcode = require('qrcode');

// ===== 1. Generate QR Code & Create Order =====
router.post('/payment/generate-qr', async (req, res) => {
    const { userId, amount, items, method } = req.body; // ✅ รับ method จาก frontend
    const promptpayNumber = '0942253619'; // เบอร์พร้อมเพย์ของคุณที่ลงทะเบียนไว้กับ SlipOK

    if (!items || items.length === 0) {
        return res.status(400).json({ error: 'ไม่มีสินค้าในตะกร้า' });
    }

    // ✅ ตรวจสอบ method ที่รับมาให้ถูกต้อง
    const paymentMethod = (method === 'TrueMoney') ? 'TrueMoney' : 'PromptPay';

    try {
        const targetAmount = parseFloat(amount);
        const orderId = 'WM-' + Date.now();

        // บันทึกออเดอร์ลงฐานข้อมูล (status: pending)
        await db.execute(
            'INSERT INTO orders (id, user_id, total_price, payment_method, status, final_amount) VALUES (?, ?, ?, ?, ?, ?)',
            [orderId, userId, targetAmount, paymentMethod, 'pending', targetAmount]
        );

        // บันทึกรายการสินค้า พร้อม unit_price snapshot
        for (const item of items) {
            await db.execute(
                'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
                [orderId, item.id, item.quantity, item.price]
            );
        }

        // สร้าง QR Code
        const payload = generatePayload(promptpayNumber, { amount: targetAmount });
        const options = { type: 'image/png', color: { dark: '#000000', light: '#ffffff' } };

        qrcode.toDataURL(payload, options, (err, url) => {
            if (err) {
                return res.status(500).json({ error: 'ไม่สามารถสร้าง QR Code ได้' });
            }

            res.json({
                success: true,
                message: 'สร้างบิลตะกร้าสินค้าสำเร็จ',
                orderId: orderId,
                qrcode: url  // ✅ แก้จาก QrCode → qrcode ให้ตรงกับ frontend
            });
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
    }
});

// ===== 2. Check Payment Status =====
router.get('/payment/check-status/:orderId', async (req, res) => {
    const { orderId } = req.params;

    try {
        const [orders] = await db.execute('SELECT * FROM orders WHERE id = ?', [orderId]);

        if (orders.length === 0) {
            return res.status(404).json({ error: 'ไม่พบออเดอร์' });
        }

        const order = orders[0];
        
        // ถ้าชำระสำเร็จ → อัปเดต wallet + order status
        if (order.status === 'completed') {
            const [user] = await db.execute('SELECT wallet_balance FROM users WHERE id = ?', [order.user_id]);
            res.json({
                status: 'completed',
                new_balance: user[0]?.wallet_balance || 0
            });
        } else {
            res.json({ status: order.status });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
    }
});

// ===== 3. Get Wallet History (เฉพาะ login user เท่านั้น) =====
router.get('/payment/wallet/history', async (req, res) => {
    // ตรวจสอบว่า session มี userId ไหม (ต้อง middleware auth)
    const userId = req.session?.userId;
    
    if (!userId) {
        return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
    }

    try {
        const [orders] = await db.execute(
            `SELECT id, total_price, payment_method, status, created_at 
             FROM orders 
             WHERE user_id = ? 
             ORDER BY created_at DESC 
             LIMIT 50`,
            [userId]
        );

        res.json({ orders });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
    }
});

module.exports = router;