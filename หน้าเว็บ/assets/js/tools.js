/* ============================================
   tools.js — หน้าต่างเลือกเครื่องมือ

   เว็บนี้มีเครื่องมือให้ลอง 2 ตัว อยู่คนละโฟลเดอร์กับหน้าเว็บหลัก
   ปุ่ม "เริ่มทดลองเลย" จึงไม่พาไปตรงๆ ได้ — ต้องถามก่อนว่าจะไปตัวไหน

   ตรรกะการเปิด/ปิดยกแบบมาจาก lessons.js (หน้าต่างวิดีโอ) ทั้งหมด
   ทั้งการล็อกสกรอลล์ การชดเชยความกว้าง scrollbar และการคืนโฟกัส
   เพื่อให้หน้าต่างสองตัวในเว็บนี้ทำงานเหมือนกันเป๊ะ
   ============================================ */
(function (w) {
  'use strict';

  var IM = w.IM;

  IM.register('tools', function () {

    var modal = document.getElementById('toolModal');
    var opener = document.getElementById('openToolChooser');
    if (!modal || !opener) return;

    var closeBtn = document.getElementById('toolModalClose');
    var lastFocus = null;

    function scrollbarW() { return w.innerWidth - document.documentElement.clientWidth; }

    function openModal() {
      if (!modal.hidden) return;
      lastFocus = document.activeElement;
      modal.hidden = false;
      // บังคับ reflow ก่อนใส่คลาส เพื่อให้ transition ทำงาน
      void modal.offsetWidth;
      modal.classList.add('is-open');

      // ล็อกการเลื่อนหน้า ทั้งฝั่ง native และ smooth scroll ของเราเอง
      var sw = scrollbarW();
      document.documentElement.style.overflow = 'hidden';
      if (sw > 0) document.documentElement.style.paddingRight = sw + 'px';
      IM.scrollLocked = true;

      if (closeBtn) closeBtn.focus();
    }

    function closeModal() {
      if (modal.hidden) return;
      modal.classList.remove('is-open');
      IM.scrollLocked = false;
      document.documentElement.style.overflow = '';
      document.documentElement.style.paddingRight = '';

      setTimeout(function () { modal.hidden = true; }, 260);

      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    /* ปุ่มยังเป็น <a href="topics.html"> อยู่โดยตั้งใจ
       ถ้า JS ไฟล์นี้พังหรือโหลดไม่ทัน คลิกแล้วยังไปหน้าคลังบทเรียนได้ตามเดิม
       ไม่ใช่ปุ่มตายที่กดแล้วไม่เกิดอะไรขึ้น */
    opener.addEventListener('click', function (e) {
      e.preventDefault();
      openModal();
    });

    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    // คลิกนอกแผง (พื้นหลังหรือขอบ) เพื่อปิด — การ์ดข้างในหยุด event ไว้เองไม่ได้
    // เพราะเป็นลิงก์ที่ต้องทำงาน จึงเช็คจาก target ตรงๆ แบบเดียวกับ lessons.js
    modal.addEventListener('click', function (e) {
      if (e.target === modal || e.target.classList.contains('tm-backdrop')) closeModal();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });

    /* กดปุ่มย้อนกลับของเบราว์เซอร์จากเครื่องมือ อาจได้หน้าเดิมคืนจาก bfcache
       ซึ่งคืนสภาพ DOM ทั้งดุ้น — หน้าต่างที่เปิดค้างไว้ตอนคลิกจะโผล่มาอีกครั้ง
       พร้อมสกรอลล์ที่ยังล็อกอยู่ ปิดให้เลยเพื่อให้กลับมาเจอหน้าแรกตามที่ควรเป็น */
    w.addEventListener('pageshow', function (e) {
      if (!e.persisted) return;
      modal.classList.remove('is-open');
      modal.hidden = true;
      IM.scrollLocked = false;
      document.documentElement.style.overflow = '';
      document.documentElement.style.paddingRight = '';
    });
  });

})(window);
