const mysql = require('mysql2');

// 1. สร้าง Pool โดยเก็บไว้ในตัวแปร pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000,
    ssl: { rejectUnauthorized: false }
});

// 2. log ค่าที่ใช้เชื่อมต่อ
console.log('🔌 DB Config:', {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    database: process.env.DB_NAME
});

// 3. สร้าง db เป็นเวอร์ชั่น promise โดยใช้ pool
const db = pool.promise();

// 4. ทดสอบเชื่อมต่อ (เปลี่ยนจาก pool เป็น db ในบางกรณี หรือใช้ pool เดิมก็ได้)
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ เชื่อมต่อ Database ล้มเหลว:', err.message);
    } else {
        console.log('✅ เชื่อมต่อฐานข้อมูล SQL สำเร็จ!');
        connection.release();
    }
});

module.exports = db;