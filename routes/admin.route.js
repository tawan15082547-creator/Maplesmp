// routes/admin.js
const express = require('express');
const router  = express.Router();
const db      = require('../config/database');

// ===== Middleware เช็คสิทธิ์ Admin =====
const requireAdmin = (req, res, next) => {
    if (req.session?.role !== 'admin') {
        return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึง' });
    }
    next();
};

router.use(requireAdmin);

// ===== 1. Stats =====
router.get('/stats', async (req, res) => {
    try {
        const [[today]]   = await db.execute(`SELECT COALESCE(SUM(final_amount),0) AS total FROM orders WHERE status='completed' AND DATE(created_at)=CURDATE()`);
        const [[month]]   = await db.execute(`SELECT COALESCE(SUM(final_amount),0) AS total FROM orders WHERE status='completed' AND YEAR(created_at)=YEAR(NOW()) AND MONTH(created_at)=MONTH(NOW())`);
        const [[users]]   = await db.execute(`SELECT COUNT(*) AS total FROM users`);
        const [[pending]] = await db.execute(`SELECT COUNT(*) AS total FROM orders WHERE status='pending'`);

        res.json({
            today_revenue:  parseFloat(today.total),
            month_revenue:  parseFloat(month.total),
            total_users:    users.total,
            pending_orders: pending.total
        });
    } catch (e) {
        console.error('Stats error:', e);
        res.status(500).json({ error: 'โหลด stats ไม่สำเร็จ' });
    }
});

// ===== 2. Orders (พร้อม coupon_code) =====
router.get('/orders', async (req, res) => {
    try {
        const [orders] = await db.execute(`
            SELECT 
                o.id, 
                o.total_price,
                o.final_amount, 
                o.discount_amount,
                o.coupon_code,
                o.payment_method, 
                o.status, 
                o.created_at,
                u.username,
                p.name AS product_name
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN products p ON oi.product_id = p.id
            ORDER BY o.created_at DESC
        `);
        res.json({ orders });
    } catch (e) {
        console.error('Orders error:', e);
        res.status(500).json({ error: 'โหลด orders ไม่สำเร็จ' });
    }
});

// ===== 3. Top Players =====
router.get('/top-players', async (req, res) => {
    try {
        const [players] = await db.execute(`
            SELECT 
                u.username, 
                u.game_version,
                COALESCE(SUM(o.final_amount), 0) AS total_spent,
                COUNT(o.id) AS order_count
            FROM users u
            LEFT JOIN orders o ON u.id = o.user_id AND o.status = 'completed'
            GROUP BY u.id
            ORDER BY total_spent DESC
            LIMIT 10
        `);
        res.json({ players });
    } catch (e) {
        console.error('Top players error:', e);
        res.status(500).json({ error: 'โหลด top players ไม่สำเร็จ' });
    }
});

// ===== 4. Coupons (พร้อม total_discount) =====
router.get('/coupons', async (req, res) => {
    try {
        const [coupons] = await db.execute(`
            SELECT 
                c.*,
                COALESCE(SUM(o.discount_amount), 0) AS total_discount
            FROM coupons c
            LEFT JOIN orders o ON o.coupon_code = c.code AND o.status = 'completed'
            GROUP BY c.id
            ORDER BY c.created_at DESC
        `);
        res.json({ coupons });
    } catch (e) {
        console.error('Coupons error:', e);
        res.status(500).json({ error: 'โหลดคูปองไม่สำเร็จ' });
    }
});

// ===== 5. Create Coupon =====
router.post('/coupons', async (req, res) => {
    const { code, discount_type, discount_value, max_uses, min_amount, valid_until } = req.body;
    if (!code || !discount_value) return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });

    try {
        await db.execute(
            `INSERT INTO coupons (code, discount_type, discount_value, max_uses, min_amount, valid_until)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [code.toUpperCase(), discount_type, discount_value, max_uses || null, min_amount || 0, valid_until || null]
        );
        res.json({ success: true });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'รหัสคูปองนี้มีอยู่แล้ว' });
        console.error(e);
        res.status(500).json({ error: 'บันทึกไม่สำเร็จ' });
    }
});

// ===== 6. Toggle Coupon Status =====
router.patch('/coupons/:id/toggle', async (req, res) => {
    try {
        await db.execute(`UPDATE coupons SET is_active = NOT is_active WHERE id = ?`, [req.params.id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'เปลี่ยนสถานะไม่สำเร็จ' });
    }
});

module.exports = router;