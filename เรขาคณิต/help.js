/* ============================================
   help.js — ปุ่ม "?" มุมจอ และการ์ดบอกวิธีใช้

   กระดานนี้เปิดมาเป็นหน้าจอขาวเปล่า ๆ โดยตั้งใจ ไม่มีแถบเครื่องมือ ไม่มีเมนู
   ทุกอย่างซ่อนอยู่หลังปุ่มลัด — กด 1 สร้างจุด, Ctrl คลิกเชื่อมเส้น, Shift ค้างวัดขนาด
   ซึ่งไม่มีทางเดาถูกถ้าไม่มีใครบอก ไฟล์นี้คือที่ที่เขียนมันไว้

   ไม่แตะ app.js เลย การ์ดนี้สร้างและดูแลตัวเองทั้งหมด
   และไม่พึ่ง core.js/cursor.js เหมือนฝั่งเครื่องคิดเลข เพราะหน้านี้ไม่ได้โหลดไว้
   ============================================ */
(function (w) {
  'use strict';

  /* ---------- เนื้อหาในการ์ด ----------
     เก็บเป็นข้อมูล ไม่ใช่ HTML — เพิ่มบรรทัดใหม่คือเขียนอีกหนึ่งบรรทัด */

  var SECTIONS = [
    {
      title: 'สร้างรูป',
      rows: [
        { k: ['1'], d: 'สร้างจุดใหม่ตรงตำแหน่งเมาส์' },
        { k: ['Ctrl', 'คลิก'], d: 'ที่จุด — เลือกจุดนั้น (ขึ้นวงสีฟ้า)' },
        { k: ['Ctrl', 'คลิก'], d: 'ที่จุดที่สอง — เชื่อมสองจุดเป็นเส้น แล้วเลือกจุดใหม่ต่อทันที' }
      ]
    },
    {
      title: 'ปรับแก้รูป',
      rows: [
        { k: ['ลาก'], d: 'ที่จุด — ย้ายจุดนั้น ไม่ต้องกดปุ่มอะไรค้าง' },
        { k: ['Ctrl', 'ลาก'], d: 'ที่เส้น — ย้ายทั้งเส้นพร้อมจุดปลายทั้งสอง' },
        { k: ['Ctrl', 'ลาก'], d: 'ในพื้นที่รูป — ย้ายทั้งรูปไปทั้งชิ้น' }
      ]
    },
    {
      title: 'วัดขนาด — กด Shift ค้างไว้',
      rows: [
        { k: ['Shift', 'ชี้'], d: 'ที่เส้น — บอกความยาวด้าน' },
        { k: ['Shift', 'ชี้'], d: 'ที่จุด — บอกมุมภายในของทุกรูปที่จุดนั้นอยู่' },
        { k: ['Shift', 'ชี้'], d: 'ในพื้นที่รูป — บอกพื้นที่ของรูปนั้น' }
      ]
    },
    {
      title: 'ลบ',
      rows: [
        { k: ['Delete'], d: 'ลบสิ่งที่เลือกไว้ ถ้าไม่ได้เลือกอะไรจะลบสิ่งที่เมาส์ชี้อยู่' },
        { k: ['Backspace'], d: 'ทำเหมือนกับ Delete ทุกอย่าง' }
      ]
    },
    {
      title: 'กระดานทำให้เองอัตโนมัติ',
      rows: [
        { k: ['—'], d: 'จุดสองจุดที่วางทับกันจะยุบรวมเป็นจุดเดียว' },
        { k: ['—'], d: 'เส้นสองเส้นที่ตัดกันจะเกิดจุดตัดขึ้นให้ตรงรอยตัด' },
        { k: ['—'], d: 'เส้นที่ล้อมกันครบรอบจะกลายเป็นรูปปิดที่วัดพื้นที่ได้' }
      ]
    }
  ];

  /* ---------- ไอคอน ----------
     วาดด้วย SVG ไม่ใช้ฟอนต์ไอคอน จะได้ไม่มีอะไรให้โหลดพลาดตอนเปิดจากไฟล์ */

  var SVG = 'http://www.w3.org/2000/svg';

  function svgNode(name, attrs) {
    var node = document.createElementNS(SVG, name);
    Object.keys(attrs).forEach(function (key) { node.setAttribute(key, attrs[key]); });
    return node;
  }

  function helpIcon() {
    var svg = svgNode('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none' });
    svg.appendChild(svgNode('circle', {
      cx: 12, cy: 12, r: 9, stroke: 'currentColor', 'stroke-width': 1.7
    }));
    svg.appendChild(svgNode('path', {
      d: 'M9.4 9.2a2.7 2.7 0 1 1 3.3 2.9v1.6',
      stroke: 'currentColor', 'stroke-width': 1.7, 'stroke-linecap': 'round'
    }));
    svg.appendChild(svgNode('circle', { cx: 12.7, cy: 16.8, r: 1, fill: 'currentColor' }));
    return svg;
  }

  function closeIcon() {
    var svg = svgNode('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' });
    svg.appendChild(svgNode('path', {
      d: 'M6 6l12 12M18 6L6 18',
      stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round'
    }));
    return svg;
  }

  /* ---------- ประกอบร่าง ---------- */

  var toggle = document.createElement('button');
  toggle.className = 'help-btn';
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'วิธีใช้กระดานเรขาคณิต');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'geoHelp');
  toggle.appendChild(helpIcon());

  var panel = document.createElement('div');
  panel.className = 'help-sheet';
  panel.id = 'geoHelp';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'วิธีใช้กระดานเรขาคณิต');
  panel.tabIndex = -1;
  panel.hidden = true;

  var head = document.createElement('div');
  head.className = 'help-head';
  var heading = document.createElement('h2');
  heading.textContent = 'วิธีใช้กระดาน';
  var shut = document.createElement('button');
  shut.className = 'help-shut';
  shut.type = 'button';
  shut.setAttribute('aria-label', 'ปิด');
  shut.appendChild(closeIcon());
  head.appendChild(heading);
  head.appendChild(shut);
  panel.appendChild(head);

  var intro = document.createElement('p');
  intro.className = 'help-intro';
  intro.textContent = 'กระดานเปล่าที่วาดรูปอะไรก็ได้ ไม่มีรูปสำเร็จรูปให้เลือก';
  panel.appendChild(intro);

  SECTIONS.forEach(function (section) {
    var title = document.createElement('h3');
    title.className = 'help-title';
    title.textContent = section.title;
    panel.appendChild(title);

    var list = document.createElement('dl');
    list.className = 'help-list';
    section.rows.forEach(function (row) {
      var keys = document.createElement('dt');
      row.k.forEach(function (key, i) {
        if (i > 0) keys.appendChild(document.createTextNode('+'));
        var chip = document.createElement('kbd');
        chip.textContent = key;
        keys.appendChild(chip);
      });
      var says = document.createElement('dd');
      says.textContent = row.d;
      list.appendChild(keys);
      list.appendChild(says);
    });
    panel.appendChild(list);
  });

  document.body.appendChild(toggle);
  document.body.appendChild(panel);

  /* ---------- เปิดและปิด ---------- */

  var open = false;

  function show(next) {
    if (next === open) return;
    open = next;
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.classList.toggle('help-btn-on', open);
    if (open) panel.focus();
    else toggle.focus();
  }

  toggle.addEventListener('click', function (e) {
    e.stopPropagation();               // ...ไม่งั้น listener ที่ document ข้างล่างจะปิดกลับทันที
    show(!open);
  });
  shut.addEventListener('click', function () { show(false); });

  // คลิกที่ไหนก็ได้นอกการ์ดคือปิด การ์ดหยุดคลิกของตัวเองไว้ อ่านอยู่จึงไม่โดนปิด
  panel.addEventListener('click', function (e) { e.stopPropagation(); });
  document.addEventListener('click', function () { show(false); });

  /* ---------- กันปุ่มลัดของกระดานทำงานขณะอ่านการ์ด ----------
     app.js ผูก keydown ไว้ที่ window แบบ bubble และปุ่ม 1 สร้างจุดตรงตำแหน่งเมาส์
     ซึ่งตอนนี้คือใต้การ์ดพอดี — เผลอกดทีก็ได้จุดหลงมาโดยไม่เห็น
     capture บนโหนดเดียวกันทำงานก่อน bubble เสมอ จึงหยุดไว้ได้ตั้งแต่ต้นทาง
     หยุดเฉพาะตอนการ์ดเปิดและเฉพาะปุ่มที่กระดานใช้ ปุ่มอื่นปล่อยผ่านตามเดิม */

  function isBoardKey(e) {
    return e.code === 'Digit1' || e.code === 'Numpad1' || e.key === '1' ||
           e.code === 'Delete' || e.code === 'Backspace' ||
           e.key === 'Delete' || e.key === 'Backspace';
  }

  w.addEventListener('keydown', function (e) {
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      show(false);
      return;
    }
    if (isBoardKey(e)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  /* ---------- กางให้เองในครั้งแรก ----------
     หน้าจอขาวที่ไม่บอกอะไรเลยคือปัญหาตั้งต้นของกระดานนี้ ครั้งแรกจึงกางให้อ่านก่อน
     แล้วจำไว้ว่าเคยเห็นแล้ว localStorage อาจถูกบล็อกได้ (เปิดจากไฟล์ตรง ๆ บางเบราว์เซอร์)
     ถ้าอ่านหรือเขียนไม่ได้ก็ยอมให้กางซ้ำ ดีกว่าปล่อยให้หาวิธีใช้ไม่เจอเลย */

  var SEEN = 'geo-help-seen';
  var seen = false;
  try { seen = w.localStorage.getItem(SEEN) === '1'; } catch (err) {}

  if (!seen) {
    show(true);
    try { w.localStorage.setItem(SEEN, '1'); } catch (err) {}
  }

})(window);
