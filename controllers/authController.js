// controllers/authController.js
const db = require('../config/database');
const bcrypt = require('bcryptjs');

// 1. ระบบสมัครสมาชิก
exports.register = async (req, res) => {
    try {
        const { username, password, game_version } = req.body; // รับค่าจากหน้าเว็บ

        // เช็คว่ามีชื่อผู้เล่นนี้ในระบบหรือยัง
        const [existingUsers] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
        if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'ชื่อผู้เล่นนี้ถูกใช้งานแล้ว!' });
        }

        // เข้ารหัสผ่านให้ปลอดภัย
        const hashedPassword = await bcrypt.hash(password, 10);

        // บันทึกข้อมูลลงฐานข้อมูล (กำหนดพ้อยท์เริ่มต้นเป็น 0)
        await db.execute(
            'INSERT INTO users (username, password, game_version, points) VALUES (?, ?, ?, ?)',
            [username, hashedPassword, game_version, 0]
        );

        res.status(201).json({ message: 'สมัครสมาชิกสำเร็จ!' });
    } catch (error) {
        console.error('Register Error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    }
};

// 2. ระบบเข้าสู่ระบบ
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // ค้นหาผู้เล่นในฐานข้อมูล
        const [users] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
        if (users.length === 0) {
            return res.status(401).json({ error: 'ชื่อผู้เล่นหรือรหัสผ่านไม่ถูกต้อง!' });
        }

        const user = users[0];

        // เทียบรหัสผ่านที่พิมพ์มา กับรหัสที่เข้ารหัสไว้ใน DB
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'ชื่อผู้เล่นหรือรหัสผ่านไม่ถูกต้อง!' });
        }

        // เซ็ต Session เพื่อจดจำว่าคนนี้ล็อกอินแล้ว
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.gameVersion = user.game_version;
        req.session.role = user.role; // 🔐 เซฟ role ลง session

        res.status(200).json({ message: 'เข้าสู่ระบบสำเร็จ!', user: { id: user.id, username: user.username, points: user.points, wallet_balance: user.wallet_balance || 0, rank: user.donor_rank, role: user.role } }); // ✅ ส่ง role กลับไปด้วย
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    }
};