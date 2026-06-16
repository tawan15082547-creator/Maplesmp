require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const db = require('./config/database'); 

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static('public'));

// ตั้งค่าระบบ Session สำหรับจำผู้เล่นที่ล็อกอิน
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 } // จำไว้ 1 วัน
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// เชื่อมต่อระบบ Routes ต่างๆ
app.use('/api/auth', require('./routes/auth.route')); 
app.use('/api/shop', require('./routes/shop.route'));
app.use('/api/payment', require('./routes/payment.route'));
app.use('/api/admin', require('./routes/admin.route')); // ✅ admin routes ใหม่


// =================================================================
// 🛒 API สำหรับดึงข้อมูลสินค้าจริงจาก Database (MySQL)
// =================================================================
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
// =================================================================

// หน้าเพจหลัก
app.get('/', (req, res) => {
    res.render('welcome'); // สั่งให้ไปดึงไฟล์ views/welcome.ejs มาแสดง
});

app.get('/home', (req, res) => {
    res.render('home');
});

// หน้าชำระเงิน (แยกออกมาเป็นหน้าใหม่)
app.get('/payment', (req, res) => {
    res.render('payment');
});

app.get('/admin', (req, res) => {
    res.render('admin');
});

app.get('/admin/dashboard', (req, res) => {
    console.log('session role:', req.session.role); // เพิ่มบรรทัดนี้
    if (req.session.role !== 'admin') {
        return res.redirect('/');
    }
    res.render('dashboard');
});

app.get('/admin/coupons', (req, res) => {
    if (req.session.role !== 'admin') return res.redirect('/');
    res.render('coupons');
});

// เริ่มเซิร์ฟเวอร์
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Webmine Server รันอยู่บนพอร์ต http://localhost:${PORT}`);
});