require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const db = require('./config/database'); 

const app = express();

// 1. Middlewares พื้นฐาน
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 2. ตั้งค่าระบบ Session สำหรับจำผู้เล่นที่ล็อกอิน (ใช้ session ปกติ ไม่ผ่าน passport)
app.use(session({
    secret: process.env.SESSION_SECRET || 'maple_super_secret_key_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 } // จำไว้ 1 วัน
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 3. เชื่อมต่อระบบ Routes ต่างๆ
app.use('/api/auth', require('./routes/auth.route')); 
app.use('/api/shop', require('./routes/shop.route'));
app.use('/api/payment', require('./routes/payment.route'));
app.use('/api/admin', require('./routes/admin.route'));
app.use('/api', require('./routes/api'));

// 4. หน้าเพจต่างๆ
app.get('/', (req, res) => {
    res.render('welcome'); 
});

app.get('/home', (req, res) => {
    // 🔓 แก้ไข: ปลดล็อกให้ผู้เข้าชมทั่วไปเข้าหน้านี้ได้เพื่อดูสินค้าในร้านค้า
    // ถ้าล็อกอินแล้วจะส่งข้อมูล user ไป แต่ถ้ายังไม่ได้ล็อกอิน ค่า user จะส่งเป็น null ไปแทน
    res.render('home', { user: req.session.user || null });
});

app.get('/payment', (req, res) => {
    // หน้าแจ้งโอนเงิน/ชำระเงิน ยังคงล็อกไว้ให้เฉพาะคนที่เข้าสู่ระบบแล้วเท่านั้น
    if (!req.session.user) return res.redirect('/');
    res.render('payment', { user: req.session.user });
});

app.get('/admin', (req, res) => {
    res.render('admin');
});

app.get('/admin/dashboard', (req, res) => {
    if (req.session.role !== 'admin') {
        return res.redirect('/');
    }
    res.render('dashboard');
});

app.get('/admin/coupons', (req, res) => {
    if (req.session.role !== 'admin') {
        return res.redirect('/');
    }
    res.render('coupons');
});

// 5. 🛒 API สำหรับดึงข้อมูลสินค้าจริงจาก Database (MySQL)
app.get('/api/products', async (req, res) => {
    const category = req.query.category;
    try {
        const [results] = await db.execute(
            'SELECT id, name, description, category, CAST(price AS UNSIGNED) AS price, price_in_gems, gems_reward, image_url FROM products WHERE category = ?',
            [category]
        );
        res.json(results);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลสินค้า' });
    }
});

// 6. เริ่มเซิร์ฟเวอร์
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Webmine Server รันอยู่บนพอร์ต http://localhost:${PORT}`);
});