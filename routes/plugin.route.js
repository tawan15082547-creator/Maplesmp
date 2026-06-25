// routes/plugin.route.js
// =================================================================
// 🎮 API สำหรับเชื่อมต่อกับ Minecraft Plugin (Paper/Spigot)
// ใช้ REST API — ปลั๊กอินยิง HTTP request มาที่เว็บ
// =================================================================
const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const bcrypt  = require('bcryptjs');

// =================================================================
// 🔐 Middleware: ตรวจสอบ x-plugin-key ทุก request
// =================================================================
const requirePluginKey = (req, res, next) => {
    const key = req.headers['x-plugin-key'];
    if (!key || key !== process.env.PLUGIN_SECRET_KEY) {
        return res.status(403).json({ success: false, error: 'Unauthorized: invalid or missing x-plugin-key' });
    }
    next();
};

router.use(requirePluginKey);

// =================================================================
// 1. สมัครสมาชิกจากในเกม
//    POST /api/plugin/register
// =================================================================
router.post('/register', async (req, res) => {
    const { username, password, game_version } = req.body;

    if (!username || !password || !game_version) {
        return res.status(400).json({ success: false, error: 'กรุณาส่ง username, password, game_version ให้ครบ' });
    }

    try {
        const [existing] = await db.execute('SELECT id FROM users WHERE username = ?', [username]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, error: 'ชื่อผู้เล่นนี้ถูกใช้งานแล้ว' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await db.execute(
            'INSERT INTO users (username, password, game_version, points) VALUES (?, ?, ?, ?)',
            [username, hashedPassword, game_version, 0]
        );

        return res.status(201).json({
            success: true,
            message: 'สมัครสมาชิกสำเร็จ',
            user: { id: result.insertId, username, points: 0 }
        });
    } catch (err) {
        console.error('Plugin Register Error:', err);
        return res.status(500).json({ success: false, error: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    }
});

// =================================================================
// 2. ดึงข้อมูลผู้เล่น
//    GET /api/plugin/player/:username
// =================================================================
router.get('/player/:username', async (req, res) => {
    const { username } = req.params;

    try {
        const [rows] = await db.execute(
            `SELECT id, username, points, game_version, donor_rank, total_donated, created_at 
             FROM users WHERE username = ?`,
            [username]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'ไม่พบผู้เล่นนี้ในระบบ' });
        }

        const player = rows[0];
        return res.json({
            success: true,
            player: {
                id: player.id,
                username: player.username,
                points: player.points,
                game_version: player.game_version,
                donor_rank: player.donor_rank,
                total_donated: parseFloat(player.total_donated),
                created_at: player.created_at
            }
        });
    } catch (err) {
        console.error('Plugin Get Player Error:', err);
        return res.status(500).json({ success: false, error: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    }
});

// =================================================================
// 3. อัปเดต Gems ผู้เล่น (บวก/ลบ)
//    POST /api/plugin/player/:username/gems
// =================================================================
router.post('/player/:username/gems', async (req, res) => {
    const { username } = req.params;
    const { action, amount, reason } = req.body;

    if (!action || !['add', 'deduct'].includes(action)) {
        return res.status(400).json({ success: false, error: 'action ต้องเป็น "add" หรือ "deduct"' });
    }
    if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, error: 'amount ต้องมากกว่า 0' });
    }

    try {
        const [rows] = await db.execute('SELECT id, points FROM users WHERE username = ?', [username]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'ไม่พบผู้เล่นนี้ในระบบ' });
        }

        const player = rows[0];

        if (action === 'deduct' && player.points < amount) {
            return res.status(400).json({ success: false, error: 'Gems ไม่เพียงพอ' });
        }

        const newBalance = action === 'add'
            ? player.points + parseInt(amount)
            : player.points - parseInt(amount);

        await db.execute('UPDATE users SET points = ? WHERE id = ?', [newBalance, player.id]);

        console.log(`💎 [Plugin] ${action === 'add' ? '+' : '-'}${amount} Gems → ${username} (เหตุผล: ${reason || 'ไม่ระบุ'}) | คงเหลือ: ${newBalance}`);

        return res.json({
            success: true,
            username,
            action,
            amount: parseInt(amount),
            new_balance: newBalance
        });
    } catch (err) {
        console.error('Plugin Update Gems Error:', err);
        return res.status(500).json({ success: false, error: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    }
});

// =================================================================
// 4. ดึง Command Logs ที่รอรัน (Polling)
//    GET /api/plugin/commands/pending
// =================================================================
router.get('/commands/pending', async (req, res) => {
    try {
        const [commands] = await db.execute(
            `SELECT id, order_id, username, command, created_at 
             FROM command_logs 
             WHERE status = 'pending' 
             ORDER BY created_at ASC 
             LIMIT 50`
        );

        return res.json({ success: true, commands });
    } catch (err) {
        console.error('Plugin Get Pending Commands Error:', err);
        return res.status(500).json({ success: false, error: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    }
});

// =================================================================
// 5. อัปเดตสถานะ Command Log
//    POST /api/plugin/commands/:id/status
// =================================================================
router.post('/commands/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status, error_msg } = req.body;

    if (!status || !['success', 'failed'].includes(status)) {
        return res.status(400).json({ success: false, error: 'status ต้องเป็น "success" หรือ "failed"' });
    }

    try {
        if (status === 'success') {
            await db.execute(
                `UPDATE command_logs SET status = 'success', executed_at = NOW() WHERE id = ?`,
                [id]
            );
        } else {
            // กรณี failed: เพิ่ม attempts และบันทึก error
            await db.execute(
                `UPDATE command_logs 
                 SET status = 'failed', attempts = attempts + 1, error_msg = ? 
                 WHERE id = ?`,
                [error_msg || 'Unknown error', id]
            );
        }

        return res.json({ success: true });
    } catch (err) {
        console.error('Plugin Update Command Status Error:', err);
        return res.status(500).json({ success: false, error: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    }
});

// =================================================================
// 6. ดึงยศของผู้เล่น (สำหรับ sync rank ในเกม)
//    GET /api/plugin/player/:username/rank
// =================================================================
router.get('/player/:username/rank', async (req, res) => {
    const { username } = req.params;

    try {
        const [rows] = await db.execute(
            'SELECT donor_rank FROM users WHERE username = ?',
            [username]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'ไม่พบผู้เล่นนี้ในระบบ' });
        }

        const donorRank = rows[0].donor_rank || 'Member';

        // ดึง mc_command ของยศนี้จากตาราง products (ถ้ามี mapping)
        const [productRows] = await db.execute(
            `SELECT mc_command FROM products WHERE category = 'Ranks' AND name LIKE ? LIMIT 1`,
            [`%${donorRank}%`]
        );

        const lpCommand = productRows.length > 0
            ? productRows[0].mc_command.replace('{username}', username)
            : null;

        return res.json({
            success: true,
            username,
            donor_rank: donorRank,
            lp_command: lpCommand
        });
    } catch (err) {
        console.error('Plugin Get Rank Error:', err);
        return res.status(500).json({ success: false, error: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    }
});

module.exports = router;