// =================================================================
// 👑 RANK PURCHASE USING POINTS SYSTEM
// =================================================================

async function buyRank(rankId, rankName, rankPriceGems) {
    if (!currentUser) {
        alert('กรุณาเข้าสู่ระบบก่อนทำการสั่งซื้อยศครับ');
        return;
    }

    // 1. ตรวจสอบจำนวนเพชรเบื้องต้นที่หน้าบ้านก่อนเพื่อลดภาระเซิร์ฟเวอร์
    if (currentUser.points < rankPriceGems) {
        alert(`❌ เพชรของคุณไม่เพียงพอในการซื้อยศ ${rankName}\n(ต้องการ ${rankPriceGems.toLocaleString()} Gems แต่คุณมี ${currentUser.points.toLocaleString()} Gems)`);
        return;
    }

    // 2. ขอกล่องยืนยันการตัดสินใจของผู้ใช้เพื่อความปลอดภัยขั้นสุทธิ
    const confirmBuy = confirm(`คุณต้องการใช้จำนวนเพชร 💎 ${rankPriceGems.toLocaleString()} Gems เพื่อยืนยันการเปิดรับสิทธิ์ยศ "${rankName}" ใช่หรือไม่?`);
    if (!confirmBuy) return;

    try {
        // 3. ยิงข้อมูลไปหา API หลังบ้านเพื่อประมวลผลความถูกต้องใน Database จริง
        const response = await fetch('/api/ranks/buy-rank', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser.id,
                rankId: rankId
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            alert(`🎉 ${data.message || `ซื้อยศ ${rankName} สำเร็จเรียบร้อยแล้ว!`}`);

            // 4. บันทึกยอดเพชรล่าสุดลงเครื่องและรีเฟรชหน้าเว็บเพื่อเปลี่ยนการ์ดสีสิทธิประโยชน์ยศผู้ใช้
            currentUser.points = data.new_balance;
            sessionStorage.setItem('userSession', JSON.stringify(currentUser)); // ✅
            
            // โหลดหน้าจอใหม่เพื่อให้สิทธิ์ยศของตัวละครที่ระบบจำเพิ่งอัปเดตแสดงผลอย่างถูกต้อง
            location.reload();
        } else {
            alert(`❌ ไม่สามารถซื้อยศได้เนื่องจาก: ${data.error || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ'}`);
        }
    } catch (error) {
        console.error('Error on rank buying process:', error);
        alert('ระบบเชื่อมต่อฐานข้อมูลยศขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้งในภายหลังครับ');
    }
}