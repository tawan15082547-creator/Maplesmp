const express = require('express');
const router = express.Router();
const db = require('../config/database');
const bcrypt = require('bcryptjs'); // ✅ ใช้ bcryptjs ให้ตรงกับที่ติดตั้งไว้

// 🔐 API สำหรับ Login ทั้งแอดมินตายตัว และผู้เล่นในตาราง users
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
    }

    // 🌟 1. เงื่อนไขแอดมินแบบตายตัว — ดึงจาก .env เพื่อความปลอดภัย
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
        req.session.role     = 'admin'; // ✅ ให้ตรงกับ guard ใน server.js (req.session.role)

        return req.session.save(() => {
            res.json({ 
                success: true, 
                message: 'เข้าสู่ระบบในฐานะผู้ดูแลระบบสำเร็จ',
                user: adminUser
            });
        });
    }

    // 🎮 2. เงื่อนไขผู้ใช้งานทั่วไป (ดึงข้อมูลจากตาราง users ในฐานข้อมูล)
    try {
        const [rows] = await db.execute(
            'SELECT * FROM users WHERE username = ?', 
            [username]
        );

        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: 'ไม่พบชื่อผู้ใช้งานนี้ กรุณาสมัครสมาชิกในเกมก่อน' });
        }

        const player = rows[0];

        // ตรวจสอบรหัสผ่านที่เข้ารหัสด้วย Bcrypt
        const isMatch = await bcrypt.compare(password, player.password);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'รหัสผ่านไม่ถูกต้อง' });
        }

        const sessionUser = {
            id: player.id,
            username: player.username,
            role: player.role || 'user',
            points: player.points
        };

        req.session.user     = sessionUser;
        req.session.userId   = player.id;
        req.session.username = player.username;
        req.session.role     = player.role || 'user'; // ✅ ให้ตรงกับ guard ใน server.js

        return req.session.save(() => {
            res.json({ 
                success: true, 
                message: 'เข้าสู่ระบบสำเร็จ',
                user: sessionUser
            });
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