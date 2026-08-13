(function () {
  'use strict';

  var canvas = document.getElementById('c');
  var ctx = canvas.getContext('2d');

  // ---------- ข้อมูล ----------
  var points = [];          // { id, x, y }
  var edges  = [];          // { id, a, b }   a,b = point id
  var faces  = [];          // [ [pid, pid, ...], ... ]  รูปปิด คำนวณใหม่ทุกครั้งที่กราฟเปลี่ยน
  var nextPointId = 1, nextEdgeId = 1;

  var selection = { type: null, id: null };   // 'point' | 'edge' | 'face'
  var hover     = { type: null, id: null };
  var drag      = null;                       // { ids: [pid...], lastX, lastY }
  var mouse     = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  var shiftHeld = false;

  var HIT_POINT = 10, HIT_EDGE = 6, POINT_R = 4, SELECT_R = 8;
  var MERGE_DIST = POINT_R * 2;               // ใกล้กว่านี้ถือว่าจุดทับกัน ให้ยุบเป็นจุดเดียว
  var BLUE = '#1a73e8', BLUE_FILL = 'rgba(26, 115, 232, 0.16)';

  // ---------- ตัวช่วย ----------
  function pt(id) {
    for (var i = 0; i < points.length; i++) if (points[i].id === id) return points[i];
    return null;
  }

  function edgeById(id) {
    for (var i = 0; i < edges.length; i++) if (edges[i].id === id) return edges[i];
    return null;
  }

  function edgeBetween(a, b) {
    for (var i = 0; i < edges.length; i++) {
      var e = edges[i];
      if ((e.a === a && e.b === b) || (e.a === b && e.b === a)) return e;
    }
    return null;
  }

  // รหัสประจำรูปร่าง: ใช้เซ็ตของจุด เพื่อให้คงเดิมแม้ faces ถูกสร้างใหม่ทุกเฟรม
  function faceKey(f) {
    return f.slice().sort(function (a, b) { return a - b; }).join(',');
  }

  function faceByKey(k) {
    for (var i = 0; i < faces.length; i++) if (faceKey(faces[i]) === k) return faces[i];
    return null;
  }

  function signedArea(poly) {
    var s = 0;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      s += poly[j].x * poly[i].y - poly[i].x * poly[j].y;
    }
    return s / 2;
  }

  function distToSeg(x, y, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    var l2 = dx * dx + dy * dy;
    var t = l2 === 0 ? 0 : ((x - ax) * dx + (y - ay) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
  }

  function pointInPoly(x, y, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  // ---------- หัวใจ: หารูปปิดจากกราฟ (planar face traversal) ----------
  // เดินตาม half-edge: จาก u->v ตัวถัดไปคือ v->w โดย w คือเพื่อนบ้านของ v ที่อยู่ก่อนหน้า u
  // ในลำดับเชิงมุม  ผลลัพธ์: รูปปิดภายในมีพื้นที่ (shoelace) เป็นบวก ส่วนหน้านอก/กิ่งที่ไม่ปิดเป็นลบ
  function rebuildFaces() {
    faces = [];
    if (edges.length === 0) return;

    var P = Object.create(null), adj = Object.create(null), i, j;
    for (i = 0; i < points.length; i++) { P[points[i].id] = points[i]; adj[points[i].id] = []; }
    for (i = 0; i < edges.length; i++) {
      var e = edges[i];
      if (!adj[e.a] || !adj[e.b]) continue;
      adj[e.a].push(e.b);
      adj[e.b].push(e.a);
    }

    // เรียงเพื่อนบ้านของแต่ละจุดตามมุม
    Object.keys(adj).forEach(function (key) {
      var o = P[key];
      adj[key].sort(function (m, n) {
        var A = P[m], B = P[n];
        return Math.atan2(A.y - o.y, A.x - o.x) - Math.atan2(B.y - o.y, B.x - o.x);
      });
    });

    var visited = Object.create(null);
    var starts = [];
    for (i = 0; i < edges.length; i++) { starts.push([edges[i].a, edges[i].b], [edges[i].b, edges[i].a]); }

    for (i = 0; i < starts.length; i++) {
      if (visited[starts[i][0] + '>' + starts[i][1]]) continue;

      var cycle = [], cu = starts[i][0], cv = starts[i][1], guard = 0;
      while (true) {
        var k = cu + '>' + cv;
        if (visited[k]) break;
        visited[k] = true;
        cycle.push(cu);
        var nb = adj[cv];
        var idx = nb.indexOf(cu);
        var w = nb[(idx - 1 + nb.length) % nb.length];
        cu = cv; cv = w;
        if (++guard > 20000) break;
      }

      if (cycle.length >= 3) {
        var poly = [];
        for (j = 0; j < cycle.length; j++) poly.push(P[cycle[j]]);
        if (signedArea(poly) > 0.5) faces.push(cycle);   // เก็บเฉพาะรูปปิดจริง
      }
    }
  }

  function connect(a, b) {
    if (a === b) return null;
    if (edgeBetween(a, b)) return null;                    // กันด้านซ้ำ
    var e = { id: nextEdgeId++, a: a, b: b };
    edges.push(e);
    return e;
  }

  function addEdge(a, b) {
    connect(a, b);
    settle();
  }

  // เรียกหลังทุกการเปลี่ยนแปลงรูปทรง: รวมจุดที่ทับกัน -> หาจุดตัด -> หารูปปิด -> ตรวจว่าสิ่งที่เลือกยังอยู่
  function settle() {
    mergeOverlapping();
    splitIntersections();
    mergeOverlapping();     // จุดตัดที่งอกมาชิดจุดเดิมก็ยุบรวมด้วย
    rebuildFaces();
    if (selection.type === 'point' && !pt(selection.id)) selection = { type: null, id: null };
    else if (selection.type === 'edge' && !edgeById(selection.id)) selection = { type: null, id: null };
    else if (selection.type === 'face' && !faceByKey(selection.id)) selection = { type: null, id: null };
  }

  // ---------- รวมจุดที่ทับกัน ----------
  // ย้ายด้านทุกเส้นของ dropId ไปห้อยกับ keepId แล้วทิ้ง dropId
  function absorbPoint(keepId, dropId) {
    var i, j;
    for (i = edges.length - 1; i >= 0; i--) {
      var e = edges[i];
      if (e.a === dropId) e.a = keepId;
      if (e.b === dropId) e.b = keepId;
      if (e.a === e.b) edges.splice(i, 1);                 // ด้านที่กลายเป็นวนหาตัวเอง
    }
    for (i = edges.length - 1; i >= 0; i--) {              // ด้านซ้ำที่เกิดจากการรวม
      for (j = 0; j < i; j++) {
        if ((edges[i].a === edges[j].a && edges[i].b === edges[j].b) ||
            (edges[i].a === edges[j].b && edges[i].b === edges[j].a)) { edges.splice(i, 1); break; }
      }
    }
    for (i = points.length - 1; i >= 0; i--) {
      if (points[i].id === dropId) points.splice(i, 1);
    }
    if (selection.type === 'point' && selection.id === dropId) selection.id = keepId;
    if (drag) {
      for (i = 0; i < drag.ids.length; i++) if (drag.ids[i] === dropId) drag.ids[i] = keepId;
    }
  }

  function mergeOverlapping() {
    var guard = 0;
    while (guard++ < 500) {
      var keepId = null, dropId = null;
      for (var i = 0; i < points.length && dropId === null; i++) {
        for (var j = i + 1; j < points.length; j++) {
          if (Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) <= MERGE_DIST) {
            keepId = points[i].id;      // จุดที่เกิดก่อนอยู่ต่อ อีกจุดยุบเข้ามา
            dropId = points[j].id;
            break;
          }
        }
      }
      if (dropId === null) return;
      absorbPoint(keepId, dropId);
    }
  }

  // ---------- ลบ ----------
  function removeEdge(e) {
    var i = edges.indexOf(e);
    if (i !== -1) edges.splice(i, 1);
  }

  function removePoint(id) {
    for (var i = edges.length - 1; i >= 0; i--) {
      if (edges[i].a === id || edges[i].b === id) edges.splice(i, 1);   // ด้านที่ต่อกับจุดนี้หายตาม
    }
    for (var j = points.length - 1; j >= 0; j--) {
      if (points[j].id === id) points.splice(j, 1);
    }
  }

  function degree(id) {
    var n = 0;
    for (var i = 0; i < edges.length; i++) if (edges[i].a === id || edges[i].b === id) n++;
    return n;
  }

  function deleteTarget(target) {
    if (!target || !target.type) return false;
    var i;
    if (target.type === 'point') {
      removePoint(target.id);
    } else if (target.type === 'edge') {
      var e = edgeById(target.id);
      if (!e) return false;
      removeEdge(e);
    } else if (target.type === 'face') {
      var f = faceByKey(target.id);
      if (!f) return false;
      for (i = 0; i < f.length; i++) {
        var fe = edgeBetween(f[i], f[(i + 1) % f.length]);
        if (fe) removeEdge(fe);
      }
      for (i = 0; i < f.length; i++) {                  // เก็บกวาดจุดที่ไม่เหลือด้านแล้ว
        if (degree(f[i]) === 0) removePoint(f[i]);
      }
    } else {
      return false;
    }
    return true;
  }

  // ---------- จุดตัดของเส้น ----------
  // คืนจุดตัดเฉพาะตอนที่ตัดกันจริงกลางเส้น ถ้าแค่ปลายชนกันถือว่าไม่ตัด
  function segIntersect(p1, p2, p3, p4) {
    if (!p1 || !p2 || !p3 || !p4) return null;
    var d1x = p2.x - p1.x, d1y = p2.y - p1.y;
    var d2x = p4.x - p3.x, d2y = p4.y - p3.y;
    var den = d1x * d2y - d1y * d2x;
    if (Math.abs(den) < 1e-12) return null;              // ขนานกันหรือทับกันสนิท
    var t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / den;
    var u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / den;
    if (t <= 0 || t >= 1 || u <= 0 || u >= 1) return null;
    var X = { x: p1.x + t * d1x, y: p1.y + t * d1y };
    var ends = [p1, p2, p3, p4];
    for (var i = 0; i < 4; i++) {
      if (Math.hypot(ends[i].x - X.x, ends[i].y - X.y) < 1) return null;   // ชิดปลายเกินไป = แค่แตะ
    }
    return X;
  }

  function splitAt(e1, e2, X) {
    var P = null;
    for (var i = 0; i < points.length; i++) {            // มีจุดตรงนั้นอยู่แล้วก็ใช้จุดเดิม
      if (Math.hypot(points[i].x - X.x, points[i].y - X.y) < 1) { P = points[i]; break; }
    }
    if (!P) { P = { id: nextPointId++, x: X.x, y: X.y }; points.push(P); }

    var a1 = e1.a, b1 = e1.b, a2 = e2.a, b2 = e2.b;
    removeEdge(e1); removeEdge(e2);
    connect(a1, P.id); connect(P.id, b1);
    connect(a2, P.id); connect(P.id, b2);
  }

  function splitIntersections() {
    var guard = 0;
    while (guard++ < 500) {
      var hitPair = null;
      for (var i = 0; i < edges.length && !hitPair; i++) {
        for (var j = i + 1; j < edges.length; j++) {
          var e1 = edges[i], e2 = edges[j];
          if (e1.a === e2.a || e1.a === e2.b || e1.b === e2.a || e1.b === e2.b) continue;  // มีจุดร่วมกันอยู่แล้ว
          var X = segIntersect(pt(e1.a), pt(e1.b), pt(e2.a), pt(e2.b));
          if (X) { hitPair = { e1: e1, e2: e2, X: X }; break; }
        }
      }
      if (!hitPair) return;
      splitAt(hitPair.e1, hitPair.e2, hitPair.X);
    }
  }

  // ---------- หาว่าเมาส์ชี้อะไรอยู่: จุด -> ด้าน -> พื้นที่ในรูป ----------
  function hitTest(x, y) {
    var i;
    for (i = points.length - 1; i >= 0; i--) {
      if (Math.hypot(x - points[i].x, y - points[i].y) <= HIT_POINT) {
        return { type: 'point', id: points[i].id };
      }
    }
    for (i = edges.length - 1; i >= 0; i--) {
      var a = pt(edges[i].a), b = pt(edges[i].b);
      if (!a || !b) continue;
      if (distToSeg(x, y, a.x, a.y, b.x, b.y) <= HIT_EDGE) {
        return { type: 'edge', id: edges[i].id };
      }
    }
    var best = null, bestArea = Infinity;
    for (i = 0; i < faces.length; i++) {
      var poly = faces[i].map(pt);
      if (poly.indexOf(null) !== -1) continue;
      if (pointInPoly(x, y, poly)) {
        var ar = Math.abs(signedArea(poly));
        if (ar < bestArea) { bestArea = ar; best = faceKey(faces[i]); }   // รูปเล็กสุดที่ครอบอยู่
      }
    }
    return best ? { type: 'face', id: best } : { type: null, id: null };
  }

  // ---------- มุมที่จุดหนึ่ง ----------
  // คืนค่ามุมภายในของทุกรูปร่างที่จุดนั้นเป็นสมาชิก
  function anglesAt(pid) {
    var v = pt(pid), out = [], i, j;
    if (!v) return out;

    for (i = 0; i < faces.length; i++) {
      var f = faces[i];
      var at = f.indexOf(pid);
      if (at === -1) continue;
      var prev = pt(f[(at - 1 + f.length) % f.length]);
      var next = pt(f[(at + 1) % f.length]);
      if (!prev || !next) continue;
      var ang = angleBetween(prev, v, next);
      if (ang === null) continue;
      // รูปปิดถูกจัดทิศให้พื้นที่เป็นบวกเสมอ -> cross ติดลบแปลว่ามุมกลับ (> 180°)
      var cross = (v.x - prev.x) * (next.y - v.y) - (v.y - prev.y) * (next.x - v.x);
      if (cross < 0) ang = 2 * Math.PI - ang;
      out.push({ prev: prev, next: next, ang: ang });
    }

    if (out.length === 0) {
      // ไม่อยู่ในรูปปิดใดเลย แต่ถ้ามีด้านพอดี 2 ด้าน ก็แสดงมุมระหว่างสองด้านนั้น
      var nb = [];
      for (j = 0; j < edges.length; j++) {
        if (edges[j].a === pid) nb.push(pt(edges[j].b));
        else if (edges[j].b === pid) nb.push(pt(edges[j].a));
      }
      if (nb.length === 2 && nb[0] && nb[1]) {
        var a2 = angleBetween(nb[0], v, nb[1]);
        if (a2 !== null) out.push({ prev: nb[0], next: nb[1], ang: a2 });
      }
    }
    return out;
  }

  function angleBetween(prev, v, next) {
    var u1x = prev.x - v.x, u1y = prev.y - v.y;
    var u2x = next.x - v.x, u2y = next.y - v.y;
    var l1 = Math.hypot(u1x, u1y), l2 = Math.hypot(u2x, u2y);
    if (l1 === 0 || l2 === 0) return null;
    var c = (u1x * u2x + u1y * u2y) / (l1 * l2);
    return Math.acos(Math.max(-1, Math.min(1, c)));
  }

  // ---------- วาด ----------
  function resize() {
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // รวบรวมว่าจุด/ด้านไหนต้องเป็นสีฟ้า ตามสิ่งที่ถูกเลือกอยู่
  function selectedParts() {
    var v = Object.create(null), e = Object.create(null), i;
    if (selection.type === 'point') {
      v[selection.id] = true;
    } else if (selection.type === 'edge') {
      var se = edgeById(selection.id);
      if (se) { e[se.id] = true; v[se.a] = true; v[se.b] = true; }
    } else if (selection.type === 'face') {
      var f = faceByKey(selection.id);
      if (f) for (i = 0; i < f.length; i++) {
        v[f[i]] = true;
        var fe = edgeBetween(f[i], f[(i + 1) % f.length]);
        if (fe) e[fe.id] = true;
      }
    }
    return { verts: v, edges: e };
  }

  function draw() {
    hover = drag ? hover : hitTest(mouse.x, mouse.y);

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    var sel = selectedParts();
    var i, j;

    // รูปร่าง: ฟ้าอ่อนตอนถูกเลือก / เทาอ่อนตอนชี้เฉย ๆ
    for (i = 0; i < faces.length; i++) {
      var k = faceKey(faces[i]);
      var isSel = (selection.type === 'face' && selection.id === k);
      var isHov = (hover.type === 'face' && hover.id === k);
      if (!isSel && !isHov) continue;
      var poly = faces[i].map(pt);
      if (poly.indexOf(null) !== -1) continue;
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (j = 1; j < poly.length; j++) ctx.lineTo(poly[j].x, poly[j].y);
      ctx.closePath();
      ctx.fillStyle = isSel ? BLUE_FILL : '#f0f0f0';
      ctx.fill();
    }

    // ด้าน
    for (i = 0; i < edges.length; i++) {
      var a = pt(edges[i].a), b = pt(edges[i].b);
      if (!a || !b) continue;
      var eOn = !!sel.edges[edges[i].id];
      ctx.strokeStyle = eOn ? BLUE : '#000';
      ctx.lineWidth = eOn ? 2.5 : 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // จุด
    for (i = 0; i < points.length; i++) {
      var p = points[i];
      var pOn = !!sel.verts[p.id];
      ctx.beginPath();
      ctx.arc(p.x, p.y, POINT_R, 0, Math.PI * 2);
      ctx.fillStyle = pOn ? BLUE : '#000';
      ctx.fill();
      if (selection.type === 'point' && selection.id === p.id) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, SELECT_R, 0, Math.PI * 2);
        ctx.strokeStyle = BLUE;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    if (shiftHeld) drawMeasure();

    requestAnimationFrame(draw);
  }

  function drawMeasure() {
    ctx.fillStyle = '#000';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (hover.type === 'edge') {
      var e = edgeById(hover.id);
      if (!e) return;
      var a = pt(e.a), b = pt(e.b);
      if (!a || !b) return;
      var len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len === 0) return;
      var nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;   // ตั้งฉากกับด้าน
      ctx.fillText(len.toFixed(1), (a.x + b.x) / 2 + nx * 12, (a.y + b.y) / 2 + ny * 12);

    } else if (hover.type === 'point') {
      var v = pt(hover.id);
      if (!v) return;
      var list = anglesAt(hover.id);
      for (var i = 0; i < list.length; i++) drawAngle(v, list[i], 22 + i * 13);

    } else if (hover.type === 'face') {
      var f = faceByKey(hover.id);
      if (!f) return;
      var poly = f.map(pt);
      if (poly.indexOf(null) !== -1) return;
      var c = polyCentroid(poly);
      ctx.fillText(Math.abs(signedArea(poly)).toFixed(1), c.x, c.y);
    }
  }

  // จุดศูนย์ถ่วงของรูปหลายเหลี่ยม ใช้วางป้ายพื้นที่
  function polyCentroid(poly) {
    var a = 0, cx = 0, cy = 0;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var f = poly[j].x * poly[i].y - poly[i].x * poly[j].y;
      a += f;
      cx += (poly[j].x + poly[i].x) * f;
      cy += (poly[j].y + poly[i].y) * f;
    }
    if (Math.abs(a) < 1e-9) return poly[0];
    return { x: cx / (3 * a), y: cy / (3 * a) };
  }

  function drawAngle(v, item, r) {
    var a1 = Math.atan2(item.prev.y - v.y, item.prev.x - v.x);
    var a2 = Math.atan2(item.next.y - v.y, item.next.x - v.x);
    var d = a1 - a2;
    while (d < 0) d += 2 * Math.PI;
    while (d >= 2 * Math.PI) d -= 2 * Math.PI;

    // เลือกทิศกวาดที่กว้างเท่ากับมุมที่คำนวณได้ (อีกทิศคือ 360° ลบออก)
    var start, sweep;
    if (Math.abs(d - item.ang) < 1e-6) { start = a2; sweep = d; }
    else { start = a1; sweep = 2 * Math.PI - d; }

    ctx.beginPath();
    ctx.arc(v.x, v.y, r, start, start + sweep, false);
    ctx.stroke();

    var mid = start + sweep / 2;
    ctx.fillText(
      (item.ang * 180 / Math.PI).toFixed(1) + '°',
      v.x + Math.cos(mid) * (r + 14),
      v.y + Math.sin(mid) * (r + 14)
    );
  }

  // ---------- การโต้ตอบ ----------
  function startDrag(ids, x, y) {
    drag = { ids: ids, lastX: x, lastY: y };
  }

  function localPos(e) {
    var rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  canvas.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    e.preventDefault();
    window.focus();                                                 // กันกรณีคีย์บอร์ดยังไม่โฟกัสมาที่หน้านี้
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}   // ลากต่อได้แม้เมาส์ออกนอกกรอบ

    var m = localPos(e);
    mouse.x = m.x; mouse.y = m.y;
    shiftHeld = e.shiftKey;

    var hit = hitTest(m.x, m.y);

    if (e.ctrlKey) {
      if (hit.type === 'point') {
        if (selection.type === 'point' && selection.id !== hit.id) {
          addEdge(selection.id, hit.id);            // เชื่อมด้าน
          selection = { type: 'point', id: hit.id }; // แล้วเลือกจุดใหม่ต่อทันที
        } else if (selection.type === 'point' && selection.id === hit.id) {
          selection = { type: null, id: null };
        } else {
          selection = { type: 'point', id: hit.id };
        }
        startDrag([hit.id], m.x, m.y);              // กด Ctrl ค้างแล้วลากจุดได้ด้วย
      } else if (hit.type === 'edge') {
        selection = { type: 'edge', id: hit.id };
        var ed = edgeById(hit.id);
        if (ed) startDrag([ed.a, ed.b], m.x, m.y);
      } else if (hit.type === 'face') {
        selection = { type: 'face', id: hit.id };
        var f = faceByKey(hit.id);
        if (f) startDrag(f.slice(), m.x, m.y);
      } else {
        selection = { type: null, id: null };
      }
    } else if (hit.type === 'point') {
      startDrag([hit.id], m.x, m.y);
    }

    hover = hit;
  });

  canvas.addEventListener('pointermove', function (e) {
    var m = localPos(e);
    mouse.x = m.x; mouse.y = m.y;
    shiftHeld = e.shiftKey;

    if (drag) {
      var dx = m.x - drag.lastX, dy = m.y - drag.lastY;
      drag.lastX = m.x; drag.lastY = m.y;
      for (var i = 0; i < drag.ids.length; i++) {
        var p = pt(drag.ids[i]);
        if (p) { p.x += dx; p.y += dy; }
      }
      rebuildFaces();
    }
  });

  function endDrag(e) {
    if (e && e.pointerId !== undefined) {
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    if (drag) {          // ลากเสร็จแล้วค่อยหาจุดตัด จะได้ไม่งอกจุดรัว ๆ ระหว่างลาก
      drag = null;
      settle();
    }
  }

  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  window.addEventListener('pointerup', endDrag);

  // เช็คปุ่มจากตำแหน่งจริงบนแป้น (e.code) เป็นหลัก เพราะถ้าสลับเป็นแป้นภาษาไทย
  // ปุ่ม 1 จะส่ง e.key มาเป็น 'ๅ' ไม่ใช่ '1' แล้วจะกดไม่ติด
  function isCreateKey(e) {
    return e.code === 'Digit1' || e.code === 'Numpad1' || e.key === '1';
  }

  function isDeleteKey(e) {
    return e.code === 'Delete' || e.code === 'Backspace' ||
           e.key === 'Delete'  || e.key === 'Backspace';
  }

  window.addEventListener('keydown', function (e) {
    shiftHeld = e.shiftKey;

    if (isCreateKey(e)) {
      e.preventDefault();
      points.push({ id: nextPointId++, x: mouse.x, y: mouse.y });
      settle();                                  // สร้างทับจุดเดิมก็ยุบรวมให้เลย
      return;
    }

    if (isDeleteKey(e)) {
      e.preventDefault();
      // ลบสิ่งที่เลือกอยู่ ถ้าไม่ได้เลือกอะไรก็ลบสิ่งที่เมาส์ชี้อยู่
      var target = selection.type ? selection : hitTest(mouse.x, mouse.y);
      if (deleteTarget(target)) {
        selection = { type: null, id: null };
        drag = null;
        rebuildFaces();
      }
    }
  });

  window.addEventListener('keyup', function (e) { shiftHeld = e.shiftKey; });
  window.addEventListener('blur', function () { shiftHeld = false; drag = null; });
  window.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('resize', resize);

  resize();
  window.focus();
  draw();
})();
