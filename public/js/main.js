// =================================================================
// 🌐 GLOBAL STATE & CORE SYSTEM
// =================================================================
let currentUser = null; 
let cart = [];          
let activeCategory = 'Gems';

document.addEventListener('DOMContentLoaded', () => {
    // [ปรับปรุง] ตรวจสอบสิทธิ์และดึงข้อมูล Session เก่า (กรณีผู้เล่นกดรีเฟรชหน้าจอ หรือ F5)
    const savedSession = sessionStorage.getItem('userSession');
    if (savedSession) {
        currentUser = JSON.parse(savedSession);
        updateUserUI(); // อัปเดตชื่อผู้เล่นและจำนวนพอยต์บน Navbar ทันที
    }

    initAuth();
    initTabs();
    initModals();
    loadProducts(activeCategory); // โหลดหมวดหมู่แรกเริ่มทันที
    updateShopHeader(activeCategory);
});

// --- ระบบสลับแท็บหมวดหมู่สินค้า ---
function initTabs() {
    const tabs = document.querySelectorAll('.category-tabs .tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const category = tab.getAttribute('data-category');
            
            // ถ้ากดแท็บประวัติ ให้เปิดประวัติการเติมเงินตรงๆ
            if (category === 'History') {
                if (!currentUser) {
                    alert('⚠️ กรุณาเข้าสู่ระบบก่อนดูประวัติการเติมเงินครับ');
                    document.getElementById('authModal').style.display = 'flex';
                    return;
                }
                document.getElementById('historyModal').style.display = 'flex';
                if (typeof fetchWalletHistory === 'function') {
                    fetchWalletHistory();
                }
                updateShopHeader('History');
                return;
            }

            // ถ้ากดแท็บสะสม ให้แสดง milestone section
            if (category === 'Milestone') {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const grid = document.getElementById('productsGrid');
                const ms = document.getElementById('milestoneSection');
                if (grid) grid.style.display = 'none';
                if (ms) { ms.style.display = 'block'; renderMilestones(); }
                updateShopHeader('Milestone');
                return;
            }

            // ซ่อน milestone section ถ้ากดแท็บอื่น
            const ms = document.getElementById('milestoneSection');
            const grid = document.getElementById('productsGrid');
            if (ms) ms.style.display = 'none';
            if (grid) grid.style.display = '';

            // สลับคลาส active ของปุ่มแท็บ
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            activeCategory = category;
            loadProducts(category);
            updateShopHeader(category); 
        });
    });
}

// --- ข้อมูลราคาเดิม (ปลอม) และโบนัส Gems แต่ละแพ็ก สำหรับการตลาด ---
// key = gems_reward จริง, value = { fakePrice, bonusGems }
const CATEGORY_LABELS = {
    'Gems':      'ร้านค้า Gems',
    'Ranks':     'ร้านค้า ยศ',
    'Items':     'ร้านค้า ไอเทม',
    'Milestone': 'รางวัลสะสม',
    'History':   'ประวัติการเติมเงิน',
};

const GEMS_MARKETING = {
    200:   { fakePrice: 21,   bonusGems: 0 },
    500:   { fakePrice: 55,   bonusGems: 0 },
    1000:  { fakePrice: 109,  bonusGems: 0 },
    2000:  { fakePrice: 219,  bonusGems: 0 },
    3090:  { fakePrice: 329,  bonusGems: 90 },   // +3%
    5250:  { fakePrice: 549,  bonusGems: 250 },  // +5%
    10800: { fakePrice: 1099, bonusGems: 800 },  // +8%
    22400: { fakePrice: 2199, bonusGems: 2400 }, // +12%
    34500: { fakePrice: 3299, bonusGems: 4500 }, // +15%
};

const CATEGORY_SUBTITLES = {
    'Gems':      'เลือกซื้อ Gems',
    'Ranks':     '/ranks ในเกมเพื่อดูสิทธิพิเศษ',
    'Items':     'อาวุธและไอเทมสุดโหดเพื่อเอาชีวิตรอด',
    'Milestone': 'สะสมยอดเติมเพื่อรับรางวัลพิเศษ',
    'History':   'ประวัติการเติมเงินของคุณ',
};

function updateShopHeader(category) {
    const h1  = document.querySelector('.shop-header h1');
    const sub = document.getElementById('shopSubtitle');
    if (h1)  h1.innerText  = CATEGORY_LABELS[category]    || 'ร้านค้าไอเทม';
    if (sub) sub.innerText = CATEGORY_SUBTITLES[category] || '';
}

// --- ดึงข้อมูลสินค้าจาก API หลังบ้านมาเรนเดอร์ลง Grid ---
async function loadProducts(category) {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    
    grid.innerHTML = '<div class="loading">กำลังโหลดข้อมูลสินค้า...</div>';

    try {
        const response = await fetch(`/api/products?category=${category}`);
        const products = await response.json();

        if (!products || products.length === 0) {
            grid.innerHTML = `<div style="color: #999; text-align: center; padding: 40px 0; width:100%;">ไม่มีสินค้าในหมวดหมู่นี้ขณะนี้</div>`;
            return;
        }

        grid.innerHTML = ''; // ล้างสถานะ Loading
        products.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card'; 

            // ===== RANK CARD แบบใหม่ =====
            if (category === 'Ranks') {
                const RANK_CONFIG = {
                    'VIP':    { color: '#0066ff', glow: 'rgba(0,102,255,0.4)',  icon: '⚔️',  sub: 'WARRIOR ACCESS'  },
                    'VVIP':   { color: '#00aaff', glow: 'rgba(0,170,255,0.4)', icon: '🛡️',  sub: 'ELITE ACCESS'    },
                    'SUPER':  { color: '#00ccff', glow: 'rgba(0,204,255,0.4)', icon: '💫',  sub: 'SUPREME ACCESS'  },
                    'HERO':   { color: '#aa44ff', glow: 'rgba(170,68,255,0.4)',icon: '🦸',  sub: 'HERO ACCESS'     },
                    'LEGEND': { color: '#ff8800', glow: 'rgba(255,136,0,0.4)', icon: '🏆',  sub: 'LEGEND ACCESS'   },
                    'GOD':    { color: '#ffcc00', glow: 'rgba(255,204,0,0.4)', icon: '👑',  sub: 'GOD ACCESS'      },
                };
                const cfg = RANK_CONFIG[product.name] || { color: '#0066ff', glow: 'rgba(0,102,255,0.3)', icon: '👑', sub: 'EXCLUSIVE ACCESS' };

                const imgHtml = product.image_url
                    ? `<img src="${product.image_url}" alt="${product.name}" style="width:100%; height:100%; object-fit:cover;">`
                    : '';

                card.className = 'rank-card';
                card.style.setProperty('--rank-color', cfg.color);
                card.style.setProperty('--rank-glow', cfg.glow);
                card.innerHTML = `
                    <div class="rank-img-area">${imgHtml}</div>
                    <div class="rank-card-bottom">
                        <div class="rank-title-wrap">
                            <span class="rank-icon">${cfg.icon}</span>
                            <div>
                                <div class="rank-name">${product.name}</div>
                                <div class="rank-sub">${cfg.sub}</div>
                            </div>
                        </div>
                        <div class="rank-price-wrap">
                            <span class="rank-price" style="color:${cfg.color};">฿${product.price.toLocaleString()}</span>
                        </div>
                        <button class="rank-buy-btn" style="background:${cfg.color}; box-shadow: 0 0 16px ${cfg.glow};"
                            onclick="addToCart(${product.id}, '${product.name}', ${product.price}, 0)">
                            🛒 ซื้อยศนี้
                        </button>
                    </div>
                    <div class="rank-corner rank-corner-tl" style="border-color:${cfg.color};"></div>
                    <div class="rank-corner rank-corner-tr" style="border-color:${cfg.color};"></div>
                    <div class="rank-corner rank-corner-bl" style="border-color:${cfg.color};"></div>
                    <div class="rank-corner rank-corner-br" style="border-color:${cfg.color};"></div>
                `;
            } else {
                // สินค้าทั่วไป (Gems, Items)
                let actionButton = `<button class="buy-btn" onclick="addToCart(${product.id}, '${product.name}', ${product.price}, ${product.gems_reward || 0})">🛒 ใส่ตะกร้า</button>`;

                const localImg = `/images/products/${product.id}.png`;
                const imgSrc = product.image_url || localImg;
                const imageHtml = `<div class="product-img-wrap">
                    <img src="${imgSrc}" alt="${product.name}" class="product-img"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="product-image-placeholder" style="display:none;">${category === 'Items' ? '⚔️' : '💎'}</div>
                </div>`;

                let priceSectionHtml = '';
                let bonusBadgeHtml = '';

                if (category === 'Gems') {
                    const mkt = GEMS_MARKETING[product.gems_reward] || null;
                    const baseGems = product.gems_reward - (mkt ? mkt.bonusGems : 0);
                    if (mkt && mkt.fakePrice > product.price) {
                        priceSectionHtml = `
                            <p class="price-original"><s>${mkt.fakePrice.toLocaleString()} ฿</s></p>
                            <p class="price price-sale">${product.price.toLocaleString()} ฿</p>
                        `;
                    } else {
                        priceSectionHtml = `<p class="price">${product.price.toLocaleString()} THB</p>`;
                    }
                    card.innerHTML = `${imageHtml}<h3>${priceSectionHtml}</h3>${actionButton}`;
                } else {
                    card.innerHTML = `
                        ${imageHtml}
                        <p class="price">${product.price.toLocaleString()} THB</p>
                        ${actionButton}
                    `;
                }
            }

            grid.appendChild(card);
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        grid.innerHTML = '<div style="color: red; text-align: center; padding: 40px 0; width:100%;">เกิดข้อผิดพลาดในการโหลดข้อมูลสินค้า</div>';
    }
}

// --- จัดการปุ่ม เปิด/ปิด Modals ทั่วไป ---
function initModals() {
    const setupClose = (btnId, modalId) => {
        const btn = document.getElementById(btnId);
        const modal = document.getElementById(modalId);
        if (btn && modal) {
            btn.onclick = () => modal.style.display = 'none';
        }
    };

    setupClose('closeCartModal', 'cartModal');
    setupClose('closeModal', 'authModal');
    setupClose('closePaymentModal', 'paymentModal');
    setupClose('closeCheckoutModal', 'checkoutModal');
    setupClose('closeConfirmationModal', 'confirmationModal');
    setupClose('closeHistoryModal', 'historyModal');

    // ปุ่มกลับหน้าหลักจากหน้าชำระเงินบิลใหญ่
    const backFromPaymentBtn = document.getElementById('backFromPaymentBtn');
    if (backFromPaymentBtn) {
        backFromPaymentBtn.onclick = () => {
            const paymentPage = document.getElementById('paymentPage');
            if (paymentPage) paymentPage.style.display = 'none';
            if (window.paymentIntervalId) clearInterval(window.paymentIntervalId);
        };
    }
}

// --- จัดการระบบล็อกอิน / สมัครสมาชิก ---
function initAuth() {
    const loginBtn = document.getElementById('loginBtn');
    const authModal = document.getElementById('authModal');
    
    if (!loginBtn || !authModal) return;

    // คลิกปุ่มหลักบน Navbar
    loginBtn.addEventListener('click', () => {
        if (!currentUser) {
            authModal.style.display = 'flex';
        } else {
            // [แก้ไข] ระบบ Log out ย้ายไปบันทึกและลบข้อมูลที่ sessionStorage แทน
            if (confirm('คุณต้องการออกจากระบบใช่หรือไม่?')) {
                currentUser = null;
                sessionStorage.removeItem('userSession');
                location.reload();
            }
        }
    });

    // สลับหน้าฟอร์มภายใน Modal — ลบระบบสมัครออกแล้ว ใช้แค่ login

    // ส่งฟอร์มเข้าสู่ระบบ
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();

            const username = document.getElementById('loginUsername')?.value?.trim();
            const password = document.getElementById('loginPassword')?.value;
            const errMsg   = document.getElementById('loginError');

            if (!username || !password) {
                if (errMsg) errMsg.innerText = 'กรุณากรอกชื่อผู้เล่นและรหัสผ่าน';
                return;
            }

            try {
                const res  = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();

                if (!res.ok) {
                    if (errMsg) errMsg.innerText = data.error || 'ชื่อผู้เล่นหรือรหัสผ่านไม่ถูกต้อง';
                    return;
                }

                // ✅ เก็บข้อมูลจริงจาก API (id, username, points, role)
                currentUser = {
                    id:       data.user.id,
                    username: data.user.username,
                    points:   data.user.points,
                    role:     data.user.role
                };
                sessionStorage.setItem('userSession', JSON.stringify(currentUser));

                // 🔐 ถ้าเป็น admin ให้ redirect ไป dashboard ทันที
                if (data.user.role === 'admin') {
                    window.location.href = '/admin/dashboard';
                    return;
                }

                updateUserUI();
                authModal.style.display = 'none';
                if (errMsg) errMsg.innerText = '';

            } catch (err) {
                console.error('Login error:', err);
                if (errMsg) errMsg.innerText = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้';
            }
        };
    }
}

function updateUserUI() {
    const loginBtn = document.getElementById('loginBtn');
    if (currentUser && loginBtn) {
        const pts = currentUser.points || 0;
        loginBtn.innerHTML = `👤 ${currentUser.username} | 💎 <span id="navGems">${pts.toLocaleString()}</span>`;
    }

    // 🔐 แสดงปุ่ม Admin Dashboard เฉพาะ admin เท่านั้น
    const adminBtn     = document.getElementById('adminDashboardBtn');
    const adminDivider = document.getElementById('adminDivider');
    if (adminBtn && currentUser && currentUser.role === 'admin') {
        adminBtn.style.display     = 'flex';
        if (adminDivider) adminDivider.style.display = 'block';
    }
}

// --- ฟังก์ชันดึงประวัติการเติมเงิน ---
async function fetchWalletHistory() {
    const historyList = document.getElementById('historyList'); // สมมติว่าใน HTML มีตาราง ID นี้
    if (!historyList) return;

    historyList.innerHTML = '<tr><td colspan="4" style="text-align:center;">กำลังโหลดข้อมูล...</td></tr>';

    try {
        // [สำคัญ] เรียก API ที่เราคุยกันก่อนหน้านี้
        const res = await fetch('/api/payment/wallet/history');
        const data = await res.json();

        if (!res.ok) {
            historyList.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">${data.error || 'โหลดประวัติไม่สำเร็จ'}</td></tr>`;
            return;
        }

        if (data.orders.length === 0) {
            historyList.innerHTML = '<tr><td colspan="4" style="text-align:center;">ยังไม่มีประวัติการเติมเงิน</td></tr>';
            return;
        }

        // เรนเดอร์ข้อมูลลงในตาราง
        historyList.innerHTML = '';
        data.orders.forEach(order => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${order.id}</td>
                <td>${order.total_price.toLocaleString()} ฿</td>
                <td>${order.status === 'completed' ? '<span style="color:green;">สำเร็จ</span>' : order.status}</td>
                <td>${new Date(order.created_at).toLocaleString('th-TH')}</td>
            `;
            historyList.appendChild(row);
        });

    } catch (err) {
        console.error('History fetch error:', err);
        historyList.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">เกิดข้อผิดพลาดในการเชื่อมต่อ</td></tr>';
    }
}