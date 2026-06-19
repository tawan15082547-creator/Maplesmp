// =================================================================
// 💳 CHECKOUT, COUPON, SLIP UPLOAD & POLLING PROCESS
// =================================================================
let currentDiscount = 0;

// ขั้นที่ 1: เปลี่ยนจากตะกร้าสินค้าไปหน้าตารางสรุปบิล (Checkout Modal)
document.getElementById('checkoutBtn').onclick = () => {
    if (cart.length === 0) return alert('กรุณาเลือกซื้อสินค้าลงตะกร้าก่อนครับ');
    if (!currentUser) return alert('กรุณาเข้าสู่ระบบก่อนทำการสั่งซื้อครับ');

    document.getElementById('cartModal').style.display = 'none';
    document.getElementById('checkoutModal').style.display = 'flex';
    renderCheckoutSummary();
};

function renderCheckoutSummary() {
    const list = document.getElementById('checkoutItems');
    list.innerHTML = '';
    let total = 0;

    cart.forEach(item => {
        total += (item.price * item.quantity);
        list.innerHTML += `<p style="color:#ccc; margin-bottom:6px;">📦 ${item.name} (x${item.quantity}) - ${(item.price * item.quantity).toLocaleString()} THB</p>`;
    });

    currentDiscount = 0; // เคลียร์คูปองเก่า
    const discountRow   = document.getElementById('discountRow');
    const couponDetails = document.getElementById('couponDetails');
    if (discountRow)   discountRow.style.display   = 'none';
    if (couponDetails) couponDetails.style.display = 'none';

    calculateFinalPrice(total);
}

// ===== ฟังก์ชันคำนวณราคาสุทธิหลังหักส่วนลด =====
function calculateFinalPrice(baseTotal) {
    const finalTotal = Math.max(0, Math.round((baseTotal - currentDiscount) * 100) / 100);
    document.getElementById('summaryTotal').innerText = baseTotal.toLocaleString();
    document.getElementById('summaryFinal').innerText = finalTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ===== ระบบคูปองส่วนลด =====
const applyCouponBtn = document.getElementById('applyCouponBtn');
if (applyCouponBtn) {
    applyCouponBtn.onclick = async () => {
        const codeInput = document.getElementById('couponCodeInput');
        const code = codeInput?.value?.trim();
        if (!code) return alert('กรุณากรอกรหัสคูปอง');

        let total = 0;
        cart.forEach(item => { total += (item.price * item.quantity); });

        try {
            const res  = await fetch('/api/payment/apply-coupon', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, amount: total })
            });
            const data = await res.json();

            if (res.ok && data.success) {
                currentDiscount = data.discount;
                const couponDetails = document.getElementById('couponDetails');
                const discountRow   = document.getElementById('discountRow');
                if (couponDetails) {
                    couponDetails.style.display = 'block';
                    couponDetails.innerText = `✅ ใช้คูปอง ${data.coupon_code} สำเร็จ! ลด ${data.discount.toLocaleString()} บาท`;
                }
                if (discountRow) discountRow.style.display = 'flex';
                calculateFinalPrice(total);
            } else {
                alert(data.error || 'คูปองไม่ถูกต้อง');
            }
        } catch (err) {
            console.error('Apply coupon error:', err);
            alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
        }
    };
}

// ขั้นที่ 2: กดดำเนินการ -> ไปหน้ายืนยัน
document.getElementById('proceedBtn').onclick = () => {
    document.getElementById('checkoutModal').style.display = 'none';
    document.getElementById('confirmationModal').style.display = 'flex';
    document.getElementById('confirmPlayerName').innerText = currentUser.username;
};

document.getElementById('backBtn').onclick = () => {
    document.getElementById('confirmationModal').style.display = 'none';
    document.getElementById('checkoutModal').style.display = 'flex';
};

// ขั้นที่ 3: ยืนยันแล้ว -> บันทึกข้อมูลลง sessionStorage แล้ว redirect ไปหน้าชำระเงินใหม่
document.getElementById('confirmPaymentBtn').onclick = () => {
    document.getElementById('confirmationModal').style.display = 'none';

    const method      = document.querySelector('input[name="paymentMethod"]:checked').value;
    const finalAmount = parseFloat(document.getElementById('summaryFinal').innerText.replace(/,/g, '')) || 0;

    // บันทึกข้อมูลที่จำเป็นลง sessionStorage เพื่อส่งต่อหน้า payment
    sessionStorage.setItem('pendingPayment', JSON.stringify({
        method:    method,
        amount:    finalAmount,
        items:     cart,
        dateTime:  new Date().toLocaleString('th-TH')
    }));

    // redirect ไปหน้าชำระเงินใหม่
    window.location.href = '/payment';
};

// --- โหลดประวัติลงตารางแสดงผลเฉพาะบิลสถานะชำระสำเร็จ ---
async function fetchWalletHistory() {
    const list = document.getElementById('historyList');
    if (!list || !currentUser) return;

    list.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#aaa;">กำลังโหลดข้อมูล...</td></tr>';

    try {
        const response = await fetch(`/api/payment/wallet/history?userId=${currentUser.id}`);
        const data = await response.json();

        if (response.ok && data.orders && data.orders.length > 0) {
            list.innerHTML = '';
            data.orders.forEach(order => {
                list.innerHTML += `
                    <tr>
                        <td>#${order.id}</td>
                        <td>${order.product_name || 'แพ็กเกจ Gems'}</td>
                        <td style="color:#00ff00;">${parseFloat(order.total_price).toLocaleString()} THB</td>
                        <td>${new Date(order.created_at).toLocaleString('th-TH')}</td>
                    </tr>
                `;
            });
        } else {
            list.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#aaa;">ไม่มีประวัติการเติมเงินที่สำเร็จเสร็จสิ้น</td></tr>';
        }
    } catch (e) {
        console.error('History fetch error:', e);
        list.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:red;">ไม่สามารถเรียกประวัติได้</td></tr>';
    }
}