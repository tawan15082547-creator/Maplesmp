require('dotenv').config();
const express = require('express');
const app = express();

// 1. นำเข้า Route ต่างๆ
const shopRoutes = require('./routes/shop.route');
const adminRoutes = require('./routes/admin.route');
const authRoutes = require('./routes/auth.route');
const apiRoutes = require('./routes/api.route');
const paymentRoutes = require('./routes/payment.route');
// ... นำเข้าไฟล์อื่นๆ ในโฟลเดอร์ routes ให้ครบ

// 2. ตั้งค่า Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); // สำหรับดึงไฟล์ CSS/JS/Images
app.set('view engine', 'ejs');

// 3. ใช้งาน Route
app.use('/', shopRoutes); // หน้าหลัก
app.use('/admin', adminRoutes); // หน้าแอดมิน
app.use('/auth', authRoutes); // หน้า login/register
app.use('/api', apiRoutes); // API สำหรับดึงข้อมูลสินค้า/คำสั่งซื้อ
app.use('/payment', paymentRoutes); // หน้า payment
// ... ใช้งาน Route อื่นๆ ให้ครบ

// 4. สั่งให้เซิร์ฟเวอร์รัน
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});