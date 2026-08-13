/* ============================================
   lessons.js — คลังบทเรียน (หน้า topics.html)

   อ่านข้อมูลจาก window.LESSON_DATA (assets/js/data-lessons.js)
   ทำหน้าที่ กรอง / ค้นหา / วาดการ์ด / เปิดวิดีโอ

   ถ้าบทเรียนไหนยังไม่มีวิดีโอ จะขึ้นป้าย "เร็วๆ นี้"
   หน้าเว็บยังทำงานครบ ไม่พัง
   ============================================ */
(function (w) {
  'use strict';

  var IM = w.IM;

  IM.register('lessons', function () {

    var DATA = w.LESSON_DATA;
    var grid = document.getElementById('lessonGrid');
    if (!DATA || !grid) return;

    var catBar = document.getElementById('catFilter');
    var searchInput = document.getElementById('lessonSearch');
    var countEl = document.getElementById('lessonCount');
    var emptyEl = document.getElementById('lessonEmpty');

    var state = { cat: 'all', q: '' };

    var catById = {};
    DATA.categories.forEach(function (c) { catById[c.id] = c; });

    /* ---------------------------------------------
       1. ภาพปกอัตโนมัติ
       วาดเส้นโค้งคณิตศาสตร์ตามสีประจำหมวด
       ใช้ภาษาภาพชุดเดียวกับหน้าแรก ไม่ต้องเตรียมไฟล์ภาพ
       --------------------------------------------- */

    function autoPoster(lesson) {
      var accent = (catById[lesson.cat] || {}).accent || '#88f4c5';
      var seed = lesson.ep + lesson.id.length;
      var d = '';

      /* เส้นต่างกันตามหมวด ให้แยกออกจากกันได้ตั้งแต่มองผ่านๆ
           เรขาคณิต = เส้นหักมุม (รูปทรง)
           สมการ    = เส้นโค้งนุ่ม (กราฟฟังก์ชัน) — ใช้เป็นค่าตั้งต้นด้วย
         ถ้าเพิ่มหมวดใหม่ในอนาคต ให้มาเพิ่มเงื่อนไขตรงนี้ */
      for (var x = 0; x <= 320; x += 8) {
        var t = x / 320;
        var y = (lesson.cat === 'geometry')
          ? 132 - Math.abs(((t * 4 + seed * .3) % 2) - 1) * 62
          : 90 + Math.sin(t * Math.PI * 2 + seed) * 34;
        d += (x === 0 ? 'M' : 'L') + x + ',' + y.toFixed(1) + ' ';
      }

      return '<svg viewBox="0 0 320 168" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
        '<defs>' +
          '<linearGradient id="g' + lesson.id + '" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0%" stop-color="' + accent + '" stop-opacity=".22"/>' +
            '<stop offset="100%" stop-color="' + accent + '" stop-opacity=".04"/>' +
          '</linearGradient>' +
        '</defs>' +
        '<rect width="320" height="168" fill="url(#g' + lesson.id + ')"/>' +
        '<path d="' + d + '" fill="none" stroke="' + accent + '" stroke-width="2.4" ' +
          'stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>' +
        '</svg>';
    }

    /* ---------------------------------------------
       2. วาดการ์ด
       --------------------------------------------- */

    function hasVideo(l) { return !!(l.video || l.youtube); }

    function esc(s) {
      return String(s).replace(/[&<>"]/g, function (c) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
      });
    }

    function cardHTML(l) {
      var cat = catById[l.cat] || {};
      var ready = hasVideo(l);

      var thumb = l.poster
        ? '<img src="' + esc(l.poster) + '" alt="" loading="lazy">'
        : autoPoster(l);

      return '' +
      '<div class="tilt-scene reveal">' +
        '<article class="lesson-card tilt' + (ready ? '' : ' is-soon') + '" ' +
                 'data-cursor="card" data-id="' + esc(l.id) + '" ' +
                 'tabindex="0" role="button" ' +
                 'aria-label="' + esc(l.title) + (ready ? '' : ' (ยังไม่มีวิดีโอ)') + '">' +
          '<div class="lesson-thumb">' +
            thumb +
            '<span class="lesson-ep">EP ' + (l.ep < 10 ? '0' : '') + l.ep + '</span>' +
            (ready
              ? '<span class="lesson-dur">' + esc(l.duration || '') + '</span>' +
                '<span class="lesson-play" aria-hidden="true">' +
                  '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
                '</span>'
              : '<span class="lesson-soon">เร็วๆ นี้</span>') +
          '</div>' +
          '<div class="lesson-body">' +
            '<div class="lesson-meta">' +
              '<span class="lesson-cat" style="color:' + (cat.accent || '#fff') + '">' + esc(cat.tag || '') + '</span>' +
            '</div>' +
            '<h3>' + esc(l.title) + '</h3>' +
            '<p>' + esc(l.desc) + '</p>' +
          '</div>' +
        '</article>' +
      '</div>';
    }

    /* ---------------------------------------------
       3. กรอง + ค้นหา
       --------------------------------------------- */

    function visible() {
      var q = state.q.trim().toLowerCase();
      return DATA.lessons.filter(function (l) {
        if (state.cat !== 'all' && l.cat !== state.cat) return false;
        if (q) {
          var hay = (l.title + ' ' + l.desc + ' ' + (catById[l.cat] || {}).name).toLowerCase();
          if (hay.indexOf(q) === -1) return false;
        }
        return true;
      });
    }

    function render() {
      var list = visible();
      grid.innerHTML = list.map(cardHTML).join('');

      if (countEl) {
        var total = DATA.lessons.length;
        var ready = list.filter(hasVideo).length;
        countEl.textContent = list.length === total
          ? 'ทั้งหมด ' + total + ' บทเรียน · มีวิดีโอแล้ว ' + ready
          : 'พบ ' + list.length + ' จาก ' + total + ' บทเรียน · มีวิดีโอแล้ว ' + ready;
      }
      if (emptyEl) emptyEl.hidden = list.length > 0;

      // การ์ดถูกสร้างใหม่ทุกครั้ง จึงต้องบอกให้ระบบโมชั่นรู้จักของใหม่
      if (IM.refreshReveal) IM.refreshReveal();
      IM.invalidateLayout();
    }

    /* ---------------------------------------------
       4. ปุ่มกรอง
       --------------------------------------------- */

    function buildFilters() {
      if (catBar) {
        catBar.innerHTML =
          '<button class="chip is-on" data-v="all">ทั้งหมด</button>' +
          DATA.categories.map(function (c) {
            return '<button class="chip" data-v="' + c.id + '">' + esc(c.name) + '</button>';
          }).join('');
      }
    }

    function wireBar(bar, key) {
      if (!bar) return;
      bar.addEventListener('click', function (e) {
        var b = e.target.closest('.chip');
        if (!b) return;
        bar.querySelectorAll('.chip').forEach(function (x) { x.classList.remove('is-on'); });
        b.classList.add('is-on');
        state[key] = b.dataset.v;
        render();
      });
    }

    buildFilters();
    wireBar(catBar, 'cat');

    if (searchInput) {
      var t = 0;
      searchInput.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(function () { state.q = searchInput.value; render(); }, 160);
      });
    }

    /* เปิดหน้ามาพร้อมหมวดที่เลือกไว้จากหน้าแรก
       รองรับสองรูปแบบ:
           topics.html#equation      ← ใช้แบบนี้เป็นหลัก
           topics.html?cat=equation

       ทำไมต้องรองรับ hash ด้วย: บางบริบทของ file:// จะตัด query string ทิ้ง
       (เจอจริงตอนทดสอบ location.search กลายเป็นค่าว่าง) ส่วน hash ไม่หาย */
    function applyCatFromURL() {
      var fromHash = (w.location.hash || '').replace('#', '');
      var fromQuery = new URLSearchParams(w.location.search).get('cat');
      var wantCat = catById[fromHash] ? fromHash : (catById[fromQuery] ? fromQuery : null);
      if (!wantCat) return false;

      state.cat = wantCat;
      if (catBar) {
        catBar.querySelectorAll('.chip').forEach(function (x) {
          x.classList.toggle('is-on', x.dataset.v === wantCat);
        });
      }
      return true;
    }

    applyCatFromURL();
    render();

    // กดปุ่มย้อนกลับ/เดินหน้าแล้วตัวกรองต้องตามไปด้วย
    w.addEventListener('hashchange', function () {
      if (applyCatFromURL()) render();
    });

    /* ---------------------------------------------
       5. หน้าต่างเล่นวิดีโอ
       --------------------------------------------- */

    var modal = document.getElementById('videoModal');
    var stage = document.getElementById('videoStage');
    var mTitle = document.getElementById('videoTitle');
    var mDesc = document.getElementById('videoDesc');
    var mMeta = document.getElementById('videoMeta');
    var closeBtn = document.getElementById('videoClose');
    var lastFocus = null;

    function scrollbarW() { return w.innerWidth - document.documentElement.clientWidth; }

    function openModal(l) {
      if (!modal || !hasVideo(l)) return;
      var cat = catById[l.cat] || {};

      if (l.youtube) {
        stage.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + esc(l.youtube) +
          '?autoplay=1&rel=0" title="' + esc(l.title) + '" frameborder="0" ' +
          'allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
      } else {
        stage.innerHTML = '<video src="' + esc(l.video) + '" controls autoplay playsinline' +
          (l.poster ? ' poster="' + esc(l.poster) + '"' : '') + '></video>';
      }

      mTitle.textContent = l.title;
      mDesc.textContent = l.desc;
      mMeta.textContent = 'EP ' + (l.ep < 10 ? '0' : '') + l.ep + ' · ' + (cat.name || '') +
                          (l.duration ? ' · ' + l.duration : '');

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
      if (!modal || modal.hidden) return;
      modal.classList.remove('is-open');
      IM.scrollLocked = false;
      document.documentElement.style.overflow = '';
      document.documentElement.style.paddingRight = '';

      // ต้องล้าง iframe/video ทิ้ง ไม่งั้นเสียงจะเล่นต่อหลังปิด
      setTimeout(function () {
        stage.innerHTML = '';
        modal.hidden = true;
      }, 260);

      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    function findLesson(id) {
      for (var i = 0; i < DATA.lessons.length; i++) {
        if (DATA.lessons[i].id === id) return DATA.lessons[i];
      }
      return null;
    }

    grid.addEventListener('click', function (e) {
      var card = e.target.closest('.lesson-card');
      if (!card) return;
      var l = findLesson(card.dataset.id);
      if (l) openModal(l);
    });

    // ใช้คีย์บอร์ดเปิดได้ด้วย (การ์ดมี tabindex + role=button)
    grid.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var card = e.target.closest('.lesson-card');
      if (!card) return;
      e.preventDefault();
      var l = findLesson(card.dataset.id);
      if (l) openModal(l);
    });

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal || e.target.classList.contains('vm-backdrop')) closeModal();
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });
  });

})(window);
