const db = require('../config/database');
const generatePayload = require('promptpay-qr');
const qrcode = require('qrcode');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

// ตั้งค่ารหัสที่ได้จาก SlipOK 
const SLIPOK_BRANCH_ID = '68837';
const SLIPOK_API_KEY = 'SLIPOKG9GHACC';
const MY_PROMPTPAY = '0942253619'; // เบอร์พร้อมเพย์ของคุณที่ลงทะเบียนไว้กับ SlipOK

// ==========================================
// 1. ฟังก์ชันสร้างบิลชำระเงิน (ของเดิมที่อัปเดตเพิ่ม order_items)
// ==========================================
exports.createOrder = async (req, res) => {
    try {
        const { userId, productId, price } = req.body;
        const orderId = 'WM-' + Date.now(); 

        // บันทึกบิลลงฐานข้อมูลหลัก (สถานะ pending)
        await db.execute(
            'INSERT INTO orders (id, user_id, total_price, payment_method, status) VALUES (?, ?, ?, ?, ?)',
            [orderId, userId, price, 'PromptPay', 'pending']
        );

        // ⚠️ เพิ่มเติม: บันทึกสินค้าลงในตาราง order_items (เพื่อให้รู้ว่าบิลนี้ซื้อสินค้าชิ้นไหน)
        await db.execute(
            'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
            [orderId, productId, price]
        );

        // สร้าง QR Code พร้อมเพย์
        const payload = generatePayload(MY_PROMPTPAY, { amount: parseFloat(price) });
        const qrImage = await qrcode.toDataURL(payload); 

        res.status(201).json({
            message: 'สร้างบิลสำเร็จ! กรุณาชำระเงินและอัปโหลดสลิปเพื่อยืนยัน',
            orderId: orderId,
            qrCodeImage: qrImage,
            price: price
        });

    } catch (error) {
        console.error('Create Order Error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสร้างบิลชำระเงิน' });
    }
};

// ==========================================
// 2. ฟังก์ชันใหม่: ตรวจสอบสลิปและอนุมัติพ้อยท์อัตโนมัติ
// ==========================================
exports.checkSlip = async (req, res) => {
    try {
        const { orderId } = req.body; // รับรหัสบิลจากหน้าเว็บตอนส่งรูปมา

        if (!req.file) {
            return res.status(400).json({ error: 'กรุณาอัปโหลดรูปสลิป' });
        }

        // ดึงข้อมูลบิลจากฐานข้อมูลมาตรวจสอบก่อน
        const [orders] = await db.execute('SELECT * FROM orders WHERE id = ?', [orderId]);
        if (orders.length === 0) {
            fs.unlinkSync(req.file.path); // ลบไฟล์รูปทิ้งทันทีหากหาบิลไม่เจอ
            return res.status(404).json({ error: 'ไม่พบรหัสบิลนี้ในระบบ' });
        }

        const order = orders[0];
        
        // เช็กเผื่อว่าบิลนี้จ่ายสำเร็จไปแล้ว ป้องกันการสแกนซ้ำ
        if (order.status === 'completed') {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'บิลนี้ได้รับการชำระเงินเรียบร้อยแล้ว' });
        }

        // เตรียมไฟล์ส่งให้ SlipOK
        const form = new FormData();
        form.append('files', fs.createReadStream(req.file.path));
        form.append('log', 'true'); // ให้ SlipOK ช่วยเช็กสลิปซ้ำให้

        // ยิง API ไป SlipOK
        const response = await axios.post(
            `https://api.slipok.com/api/line/apikey/${SLIPOK_BRANCH_ID}`, 
            form, 
            {
                headers: {
                    'x-authorization': SLIPOK_API_KEY,
                    ...form.getHeaders()
                }
            }
        );

        // ลบไฟล์รูปชั่วคราวออกจากเซิร์ฟเวอร์เรา
        fs.unlinkSync(req.file.path);

        const slipData = response.data;

        // ตรวจสอบผลลัพธ์จาก SlipOK
        if (slipData.success && slipData.data.success) {
            const amountFromSlip = slipData.data.amount; // ยอดเงินที่โอนจริงในสลิป
            const receiverPresent = slipData.data.receiver; // ข้อมูลผู้รับเงิน

            // 🔍 [ความปลอดภัยขั้นสูง] ตรวจสอบเงื่อนไข 3 ข้อ:
            // 1. ยอดเงินในสลิปตรงกับยอดที่ระบบตั้งไว้ไหม
            if (parseFloat(amountFromSlip) !== parseFloat(order.total_price)) {
                return res.status(400).json({ error: `ยอดเงินในสลิป (${amountFromSlip} บาท) ไม่ตรงกับยอดบิล (${order.total_price} บาท)` });
            }

            // 2. เช็กว่าเงินโอนเข้าเบอร์พร้อมเพย์ของเราจริงไหม (ป้องกันการเอาสลิปโอนให้คนอื่นมาหลอก)
            // หมายเหตุ: SlipOK บางธนาคารอาจจะคืนค่าเป็นบัญชีธนาคารธรรมดา ให้ตรวจสอบค่าที่ส่งกลับมาอีกทีครับ
            if (receiverPresent && receiverPresent.proxy && receiverPresent.proxy.value !== MY_PROMPTPAY) {
                 return res.status(400).json({ error: 'สลิปนี้ไม่ได้โอนเข้าบัญชีของทางเซิร์ฟเวอร์' });
            }

            // 🎉 ผ่านทุกเงื่อนไข -> ทำการอัปเดตสถานะบิลในฐานข้อมูลเป็น completed
            await db.execute('UPDATE orders SET status = ? WHERE id = ?', ['completed', orderId]);

            // 👑 ตรงนี้คือจุดแจกรางวัล/พ้อยท์ให้ผู้เล่นเข้าเกมส์ครับ!
            // ตัวอย่าง: ดึงไอดีผู้เล่นมา แล้วแอดพ้อยท์เพิ่มตามจำนวนเงิน
            // await db.execute('UPDATE users SET points = points + ? WHERE id = ?', [order.total_price, order.user_id]);

            return res.json({ 
                success: true, 
                message: 'ชำระเงินสำเร็จ! ระบบได้ทำการเติมพ้อยท์ให้คุณเรียบร้อยแล้ว' 
            });

        } else {
            return res.status(400).json({ error: 'สลิปไม่ถูกต้อง หรือไม่สามารถอ่านข้อมูลได้' });
        }

    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); // ลบไฟล์หากเกิด error ระหว่างทาง
        
        if (error.response && error.response.data) {
             return res.status(400).json({ error: error.response.data.message });
        }
        console.error('SlipOK System Error:', error.message);
        return res.status(500).json({ error: 'ระบบตรวจสอบสลิปขัดข้อง กรุณาลองใหม่อีกครั้ง' });
    }
};