const thumb = document.getElementById('sliderThumb');
const bg = document.getElementById('sliderBg');
const container = document.getElementById('sliderContainer');

let isDragging = false;
let startX = 0;
const padding = 5; // ระยะขอบ 5px
// แนะนำให้คำนวณ maxDrag ด้านใน Event หรือใช้ฟังก์ชันเช็คเพื่อความแม่นยำกรณีหน้าจอเปลี่ยนขนาด (Responsive)
let maxDrag = container.offsetWidth - thumb.offsetWidth - padding; 

// ฟังก์ชันอัปเดตขนาดกรณีหน้าจอเปลี่ยนไซส์
window.addEventListener('resize', () => {
    maxDrag = container.offsetWidth - thumb.offsetWidth - padding;
});

// --- ฟังก์ชันเริ่มต้นการลาก (Start) ---
function startDrag(clientX) {
    isDragging = true;
    startX = clientX - thumb.offsetLeft;
    thumb.style.transition = 'none'; // ปิดแอนิเมชันตอนลากเพื่อให้ติดมือ
    bg.style.transition = 'none';
}

// --- ฟังก์ชันระหว่างการลาก (Move) ---
function moveDrag(clientX) {
    if (!isDragging) return;
    
    let currentX = clientX - startX;
    
    // ล็อคไม่ให้ลากหลุดกรอบซ้าย-ขวา
    if (currentX < padding) currentX = padding;
    if (currentX > maxDrag) currentX = maxDrag;
    
    // ขยับปุ่มและยืดพื้นหลังสีแดง
    thumb.style.left = currentX + 'px';
    bg.style.width = (currentX + thumb.offsetWidth / 2) + 'px';

    // ถ้าลากถึงจุดสิ้นสุด (ปลดล็อคสำเร็จ)
    if (currentX >= maxDrag) {
        isDragging = false;
        // ส่งไปยังหน้าหลักของร้านค้า
        window.location.href = '/home'; 
    }
}

// --- ฟังก์ชันเมื่อปล่อยการลาก (End) ---
function endDrag() {
    if (!isDragging) return;
    isDragging = false;
    
    // ถ้าปล่อยก่อนถึงเส้นชัย ให้เด้งกลับไปที่เดิม
    thumb.style.transition = 'left 0.3s ease';
    bg.style.transition = 'width 0.3s ease';
    thumb.style.left = padding + 'px';
    bg.style.width = '0px';
}

// ==========================================
// 💻 EVENT LISTENERS สำหรับคอมพิวเตอร์ (Mouse)
// ==========================================
thumb.addEventListener('mousedown', (e) => startDrag(e.clientX));
document.addEventListener('mousemove', (e) => moveDrag(e.clientX));
document.addEventListener('mouseup', endDrag);

// ==========================================
// 📱 EVENT LISTENERS สำหรับมือถือ (Touch)
// ==========================================
thumb.addEventListener('touchstart', (e) => {
    // e.touches[0] คือตำแหน่งของนิ้วแรกที่แตะหน้าจอ
    startDrag(e.touches[0].clientX);
}, { passive: true });

document.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    // e.preventDefault(); // เปิดบรรทัดนี้หากต้องการบล็อกไม่ให้หน้าจอเว็บเลื่อนขึ้นลงขณะกำลังลากปุ่ม
    moveDrag(e.touches[0].clientX);
}, { passive: false });

document.addEventListener('touchend', endDrag);