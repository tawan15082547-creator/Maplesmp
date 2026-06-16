// =================================================================
// 🛒 CART MANAGEMENT SYSTEM
// =================================================================
const cartBtn = document.getElementById('cartBtn');
const cartModal = document.getElementById('cartModal');

// เปิดตะกร้าสินค้า
cartBtn.onclick = () => {
    cartModal.style.display = 'flex';
    updateCartUI();
};

function addToCart(id, name, price, diamonds = 0) {
    // 1. ตรวจสอบการล็อกอิน: หากยังไม่ล็อกอิน ให้แจ้งเตือนและเด้งหน้าล็อกอินขึ้นมา
    if (!currentUser) {
        alert('⚠️ กรุณาเข้าสู่ระบบก่อนเลือกซื้อสินค้าครับ');
        document.getElementById('authModal').style.display = 'flex';
        return; // หยุดการทำงาน ไม่ให้หยิบใส่ตะกร้า
    }

    const existing = cart.find(item => item.id === id);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ id, name, price, diamonds, quantity: 1 });
    }
    updateCartUI();
    
    // เอฟเฟกต์สะกิดตะกร้าบอกว่าสินค้าเข้าแล้ว
    const badge = document.getElementById('cartBadge');
    badge.style.transform = 'scale(1.4)';
    setTimeout(() => badge.style.transform = 'scale(1)', 200);
}

function updateCartUI() {
    const list = document.getElementById('cartItemsList');
    const badge = document.getElementById('cartBadge');
    const totalPriceText = document.getElementById('cartTotalPrice');

    // อัปเดตตัวเลข Badge บนตะกร้า
    const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
    badge.innerText = totalQty;

    // กรณีไม่มีสินค้าในตะกร้า
    if (cart.length === 0) {
        list.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 4rem; opacity: 0.5; margin-bottom: 15px;">🛒</div>
                <p style="color: #888; font-size: 1.1rem; margin: 0;">ยังไม่มีสินค้าในตะกร้าของคุณ</p>
                <p style="color: #555; font-size: 0.9rem; margin-top: 5px;">เลือกดูสินค้าที่น่าสนใจและหยิบใส่ตะกร้าได้เลย!</p>
            </div>`;
        totalPriceText.innerText = '0';
        return;
    }

    list.innerHTML = '';
    let totalCash = 0;

    // 2. ปรับปรุงหน้าตาสินค้าในตะกร้าให้ดูสวยงาม (พรีเมียม / Dark Theme)
    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        totalCash += itemTotal;
        
        const row = document.createElement('div');
        // ตกแต่งการ์ดสินค้าในตะกร้า
        row.style = `
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            margin-bottom: 12px; 
            padding: 15px; 
            background: rgba(255, 255, 255, 0.05); 
            border-radius: 12px; 
            border-left: 4px solid #ffaa00;
            transition: all 0.3s ease;
        `;

        row.innerHTML = `
            <div style="color: #fff; font-size: 1rem;">
                ${item.name}
            </div>
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                <span style="color: #00ff88; font-weight: bold; font-size: 1.1rem;">${itemTotal.toLocaleString()} THB</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button class="qty-btn" onclick="changeQty(${index}, -1)">-</button>
                    <span style="..."> ${item.quantity} </span>
                    <button class="qty-btn" onclick="changeQty(${index}, +1)">+</button>
                </div>
            </div>`;
                list.appendChild(row);
            });

    // อัปเดตราคารวม
    totalPriceText.innerText = totalCash.toLocaleString();
}

function changeQty(index, delta) {
    cart[index].quantity += delta;
    if (cart[index].quantity <= 0) {
        cart.splice(index, 1); // ลบออกเมื่อจำนวนเป็น 0
    }
    updateCartUI();
}