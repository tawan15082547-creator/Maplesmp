// routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// เมื่อมีการส่งข้อมูลแบบ POST มาที่ /api/auth/register ให้ไปเรียกฟังก์ชัน register
router.post('/register', authController.register);

// เมื่อมีการส่งข้อมูลแบบ POST มาที่ /api/auth/login ให้ไปเรียกฟังก์ชัน login
router.post('/login', authController.login);

// ระบบออกจากระบบ (Logout)
router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'ออกจากระบบสำเร็จ' });
});

module.exports = router;