const express = require('express');
const router = express.Router();
const db = require('../config/database');
const bcrypt = require('bcryptjs');

// 🔐 API สำหรับ Login ทั้งแอดมินตายตัว และผู้เล่นจากตาราง authme
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
    }

    // 🌟 1. เงื่อนไขแอดมินแบบตายตัว — ดึงจาก .env
    const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
    const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'changeme123';

    if (username === ADMIN_USER && password === ADMIN_PASS) {
        const adminUser = {
            id: 0,
            username: 'Admin_Maple',
            role: 'admin',
            points: 0
        };

        req.session.user     = adminUser;
        req.session.userId   = 0;
        req.session.username = adminUser.username;
        req.session.role     = 'admin';

        return req.session.save(() => {
            res.json({ success: true, message: 'เข้าสู่ระบบในฐานะผู้ดูแลระบบสำเร็จ', user: adminUser });
        });
    }

    // 🎮 2. ผู้เล่นทั่วไป — อ่านจากตาราง authme (AuthMe plugin)
    try {
        // ดึงข้อมูลจากตาราง authme ของ AuthMe
        const [authRows] = await db.execute(
            'SELECT id, username, realname, password FROM authme WHERE username = ?',
            [username.toLowerCase()] // AuthMe เก็บ username เป็นตัวเล็กทั้งหมด
        );

        if (authRows.length === 0) {
            return res.status(401).json({ success: false, message: 'ไม่พบชื่อผู้ใช้งานนี้ กรุณาสมัครสมาชิกในเกมก่อน' });
        }

        const authPlayer = authRows[0];

        // AuthMe เก็บ password แบบ $2y$ (PHP BCrypt)
        // bcryptjs รองรับได้ แต่ต้องแปลง $2y$ → $2a$ ก่อน
        const hashFixed = authPlayer.password.replace(/^\$2y\$/, '$2a$');
        const isMatch = await bcrypt.compare(password, hashFixed);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'รหัสผ่านไม่ถูกต้อง' });
        }

        // ดึงข้อมูลเพิ่มเติมจากตาราง users (Gems, role ฯลฯ)
        // ถ้ายังไม่มีในตาราง users ให้สร้างอัตโนมัติ
        let [userRows] = await db.execute(
            'SELECT * FROM users WHERE username = ?',
            [authPlayer.realname] // ใช้ realname เพราะเก็บชื่อจริง (case-sensitive)
        );

        if (userRows.length === 0) {
            // สร้าง user ใหม่ในตาราง users อัตโนมัติ
            await db.execute(
                'INSERT INTO users (username, password, game_version, points) VALUES (?, ?, ?, ?)',
                [authPlayer.realname, authPlayer.password, 'Java', 0]
            );
            [userRows] = await db.execute('SELECT * FROM users WHERE username = ?', [authPlayer.realname]);
        }

        const player = userRows[0];

        const sessionUser = {
            id: player.id,
            username: player.username,
            role: player.role || 'user',
            points: player.points || 0
        };

        req.session.user     = sessionUser;
        req.session.userId   = player.id;
        req.session.username = player.username;
        req.session.role     = player.role || 'user';

        return req.session.save(() => {
            res.json({ success: true, message: 'เข้าสู่ระบบสำเร็จ', user: sessionUser });
        });

    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบฐานข้อมูล' });
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

module.exports = router;