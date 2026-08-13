/* ============================================
   reveal.js — เผยเนื้อหาตอน scroll + หั่นข้อความแบบปลอดภัยกับภาษาไทย + counters

   *** เรื่องภาษาไทยที่ต้องระวังที่สุด ***
   ห้ามหั่นทีละตัวอักษรด้วย split('') หรือ [...str] เด็ดขาด
   เพราะสระบน/ล่างและวรรณยุกต์ไทยเป็น combining marks
   ถ้าห่อทีละ code point ด้วย <span display:inline-block>
   สระและวรรณยุกต์จะหลุดออกจากพยัญชนะทันที เช่น "ที่" จะกลายเป็น "ท" "ี" "่"
   และภาษาไทยไม่มีช่องว่างระหว่างคำ จึงหั่นด้วย space ก็ไม่ได้

   วิธีที่ใช้: Intl.Segmenter('th', {granularity:'word'}) หั่นทีละ "คำ"
   การ shaping ภายในคำจึงไม่ถูกทำลาย
   ============================================ */
(function (w) {
  'use strict';

  var IM = w.IM;

  IM.register('reveal', function () {

    var hasIO = 'IntersectionObserver' in w;
    var hasSeg = !!(w.Intl && Intl.Segmenter);

    /* ---------------------------------------------
       1. TEXT SPLIT
       --------------------------------------------- */

    var segmenter = null;
    if (hasSeg) {
      try { segmenter = new Intl.Segmenter('th', { granularity: 'word' }); }
      catch (e) { segmenter = null; }
    }

    function words(text) {
      if (!segmenter) return null;
      return Array.from(segmenter.segment(text), function (s) { return s.segment; });
    }

    // สร้าง .split-line จากข้อความหนึ่งท่อน
    function buildLine(text, startIndex, target) {
      var parts = words(text);
      if (!parts) return -1;

      var n = startIndex;
      for (var i = 0; i < parts.length; i++) {
        var piece = parts[i];

        // ช่องว่างปล่อยเป็น text node ธรรมดา เพื่อให้ตัดบรรทัดได้ตามปกติ
        if (!piece.trim()) {
          target.appendChild(document.createTextNode(piece));
          continue;
        }

        var span = document.createElement('span');
        span.className = 'split-word';
        span.textContent = piece;
        span.setAttribute('aria-hidden', 'true');
        span.style.transitionDelay = Math.min(n * 42, 700) + 'ms';
        target.appendChild(span);
        n++;
      }
      return n;
    }

    function splitElement(host) {
      var label = host.textContent.replace(/\s+/g, ' ').trim();
      var kids = [].slice.call(host.childNodes);
      var frag = document.createDocumentFragment();
      var index = 0;
      var ok = true;

      for (var i = 0; i < kids.length; i++) {
        var node = kids[i];

        if (node.nodeType === 3) {                   // text node
          if (!node.nodeValue.trim()) continue;
          var line = document.createElement('span');
          line.className = 'split-line';
          var r = buildLine(node.nodeValue, index, line);
          if (r < 0) { ok = false; break; }
          index = r;
          frag.appendChild(line);

        } else if (node.nodeType === 1) {            // element เช่น <span class="accent">
          var el = node.cloneNode(false);
          el.classList.add('split-line');
          var r2 = buildLine(node.textContent, index, el);
          if (r2 < 0) { ok = false; break; }
          index = r2;
          frag.appendChild(el);
        }
      }

      if (!ok || !index) return false;

      host.textContent = '';
      host.appendChild(frag);
      host.classList.add('split');
      // screen reader อ่านประโยคเต็มจาก aria-label ส่วน span ทุกตัวถูกซ่อนไว้
      host.setAttribute('aria-label', label);
      return true;
    }

    var splitHosts = [].slice.call(document.querySelectorAll('[data-split]'));

    if (segmenter && IM.motionOK) {
      splitHosts.forEach(function (host) {
        // ถ้าหั่นไม่สำเร็จ ให้ถอยไปใช้ .reveal ธรรมดา ดีกว่าปล่อยข้อความหาย
        if (!splitElement(host)) host.classList.add('reveal');
      });
    } else {
      // ไม่มี Intl.Segmenter หรือผู้ใช้ปิดโมชั่น → fade ทั้งบล็อก ไม่หั่น
      splitHosts.forEach(function (host) { host.classList.add('reveal'); });
    }

    /* ---------------------------------------------
       2. REVEAL OBSERVER
       --------------------------------------------- */

    var targets = [].slice.call(document.querySelectorAll('.reveal, .split'));

    if (!hasIO || !IM.motionOK) {
      targets.forEach(function (el) { el.classList.add('is-visible'); });
      // หน้าที่วาดการ์ดใหม่ระหว่างทาง (คลังบทเรียน) ต้องเรียกอันนี้หลังวาดเสร็จ
      IM.refreshReveal = function () {
        document.querySelectorAll('.reveal, .split').forEach(function (el) {
          el.classList.add('is-visible');
        });
      };
    } else {
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          en.target.classList.add('is-visible');
          obs.unobserve(en.target);
        });
      }, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });

      targets.forEach(function (el) { el.dataset.revObserved = '1'; obs.observe(el); });

      /* การ์ดที่ถูกสร้างใหม่หลังหน้าโหลดแล้ว (เช่น ตอนกรองคลังบทเรียน)
         IntersectionObserver ไม่รู้จักเอง ต้องบอกให้ observe เพิ่ม
         ใช้ dataset กันการ observe ซ้ำตัวเดิม */
      IM.refreshReveal = function () {
        document.querySelectorAll('.reveal, .split').forEach(function (el) {
          if (el.dataset.revObserved) return;
          el.dataset.revObserved = '1';
          obs.observe(el);
        });
      };

      // .reveal เริ่มด้วย translateY(28px) พอ transition จบตำแหน่งจริงจะเลื่อนขึ้น
      // ต้องบอกให้โมดูลที่ cache ตำแหน่งไว้ (tilt / magnetic / parallax) วัดใหม่
      // ไม่งั้น hover จะเพี้ยนจากที่ตาเห็นราว 28px
      document.addEventListener('transitionend', function (e) {
        if (e.propertyName === 'transform' && e.target.classList.contains('is-visible')) {
          IM.invalidateLayout();
        }
      }, { passive: true });
    }

    // ถ้าผู้ใช้เปลี่ยนใจกลางคัน ต้องไม่มีอะไรค้างอยู่ในสถานะซ่อน
    IM.onMotionPrefChange(function (ok) {
      if (!ok) targets.forEach(function (el) { el.classList.add('is-visible'); });
    });

    /* ---------------------------------------------
       3. COUNTERS — ยกมาจากของเดิม เปลี่ยนให้วิ่งบน ticker กลาง
       --------------------------------------------- */

    var counters = [].slice.call(document.querySelectorAll('[data-count]'));
    var running = [];

    function startCount(el) {
      var target = +el.dataset.count;
      var suffix = el.dataset.suffix || '';

      if (!IM.motionOK) {
        el.textContent = target + suffix;
        return;
      }

      var job = { el: el, target: target, suffix: suffix, t: 0, dur: 1.2 };
      running.push(job);
      if (running.length === 1) IM.ticker.add(tickCount);
    }

    function tickCount(dt) {
      for (var i = running.length - 1; i >= 0; i--) {
        var j = running[i];
        j.t += dt;

        var p = IM.clamp(j.t / j.dur, 0, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        j.el.textContent = Math.round(eased * j.target) + j.suffix;

        if (p >= 1) running.splice(i, 1);
      }
      if (!running.length) IM.ticker.remove(tickCount);
    }

    if (!hasIO) {
      counters.forEach(startCount);
    } else {
      var countObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          countObs.unobserve(en.target);
          startCount(en.target);
        });
      }, { threshold: 0.6 });
      counters.forEach(function (c) { countObs.observe(c); });
    }
  });

})(window);
