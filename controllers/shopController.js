// controllers/shopController.js
const db = require('../config/database');

// 1. ดึงข้อมูลสินค้าทั้งหมด (เอาไปแสดงหน้าแรกของร้าน)
exports.getAllProducts = async (req, res) => {
    try {
        const [products] = await db.execute('SELECT * FROM products');
        res.status(200).json(products);
    } catch (error) {
        console.error('Get Products Error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสินค้า' });
    }
};

// 2. ดึงข้อมูลสินค้าแยกตามหมวดหมู่ (เช่น กดแท็บ Gems ให้โชว์แค่เพชร)
exports.getProductsByCategory = async (req, res) => {
    try {
        const { category } = req.params; // รับค่าหมวดหมู่จาก URL
        const [products] = await db.execute('SELECT * FROM products WHERE category = ?', [category]);
        res.status(200).json(products);
    } catch (error) {
        console.error('Get Category Error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสินค้าแยกหมวดหมู่' });
    }
};