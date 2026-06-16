// config/database.js
const mysql = require('mysql2');

// ดึงค่าคอนฟิกมาจากไฟล์ .env ที่เราตั้งไว้
const pool = mysql.createPool({
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000,
    ssl: { rejectUnauthorized: false } // Hostinger บางแพลนต้องการ SSL
});

// log ค่าที่ใช้เชื่อมต่อ (ไม่แสดง password)
console.log('🔌 DB Config:', {
    host:     process.env.DB_HOST,
    port:     process.env.DB_PORT,
    user:     process.env.DB_USER,
    database: process.env.DB_NAME
});

// แปลงให้เป็นระบบ Promise เพื่อให้เขียนโค้ดง่ายขึ้น (Async/Await)
const db = pool.promise();

// ทดสอบเชื่อมต่อฐานข้อมูลเมื่อเปิดเว็บ
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ เชื่อมต่อ Database ล้มเหลว:', err.message);
    } else {
        console.log('✅ เชื่อมต่อฐานข้อมูล SQL (maple_db) สำเร็จ!');
        connection.release();
    }
});

module.exports = db;