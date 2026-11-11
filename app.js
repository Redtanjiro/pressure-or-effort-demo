(function () {
  "use strict";

  var D = window.BLOB_DATA, DAYS = D.days, TODAY = D.today, NOW = D.now;
  var KEY = "blob-app-v1";
  var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- state ----------
  var S = (function () {
    var s = { onboarded: false, answers: {}, care: {}, sugg: {}, popupSeen: false, look: { color: "honey", bg: "calm" }, anchors: {} };
    try { var raw = localStorage.getItem(KEY); if (raw) { var v = JSON.parse(raw); for (var k in v) if (k in s) s[k] = v[k]; } } catch (e) { /* no storage */ }
    return s;
  })();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }

  // ---------- the user's blob: colour and background ----------
  // [id, name, hue turn, saturation x, lightness +] from the honey gradients
  var COLORS = [["honey", "Honey", 0, 1, 0], ["peach", "Peach", -22, 1, 0], ["rose", "Rose", -62, 0.85, 0.05], ["lilac", "Lilac", -150, 0.55, 0.14], ["sky", "Sky", 158, 0.8, 0.05], ["mint", "Mint", 108, 0.7, 0.02]];
  var BGS = [["calm", "Blush"], ["glow", "Sunset"], ["dusk", "Lavender"], ["sage", "Meadow"], ["sea", "Lagoon"], ["mist", "Mist"]];
  var GRADS = ["bFill", "bBase", "bEdge", "bTop", "bCore", "bRim", "bShadow", "bHalo"];
  function hueShift(hex, deg, sm, la) {
    var n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn, h = 0, sat = 0;
    if (d) {
      sat = d / (1 - Math.abs(2 * l - 1));
      h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    }
    h = ((h * 60 + deg) % 360 + 360) % 360;
    sat = Math.min(1, sat * (sm == null ? 1 : sm)); l = Math.min(0.97, l + (la || 0) * (1 - l) * 2);
    var c = (1 - Math.abs(2 * l - 1)) * sat, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2, rgb;
    rgb = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return "#" + rgb.map(function (v) { return ("0" + Math.round((v + m) * 255).toString(16)).slice(-2); }).join("");
  }
  (function buildColors() {
    var defs = document.querySelector("#blobdefs defs") || document.querySelector("svg defs");
    if (!defs) return;
    COLORS.slice(1).forEach(function (c) {
      GRADS.forEach(function (id) {
        var g = document.getElementById(id); if (!g) return;
        var cl = g.cloneNode(true); cl.id = id + "-" + c[0];
        cl.querySelectorAll("stop").forEach(function (st) { var sc = st.getAttribute("stop-color"); if (sc && sc !== "#fff") st.setAttribute("stop-color", hueShift(sc, c[2], c[3], c[4])); });
        defs.appendChild(cl);
      });
    });
  })();
  function lookColor(c) { c = c || S.look.color; return COLORS.filter(function (x) { return x[0] === c; })[0] || COLORS[0]; }

  // ---------- helpers ----------
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : 0; }
  // flatness is always a whole level, said as a word plus "k of 7"
  var LEVEL_WORDS = ["not flat at all", "barely flat", "a little flat", "halfway flat", "quite flat", "very flat", "completely flat"];
  function level(avg) { return Math.min(7, Math.max(1, Math.round(avg))); }
  function levelWord(avg) { return LEVEL_WORDS[level(avg) - 1]; }
  function levelLabel(avg) { return levelWord(avg) + " · " + level(avg) + " of 7"; }
  function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many || one + "s"); }
  // static illustrations in illo/ (swap the files to restyle them)
  var ACTIVITY_ILLO = { "Exercising": "exercising", "Walking somewhere": "walking-somewhere", "On its feet working": "on-its-feet-working", "Sitting working": "sitting-working", "Sitting relaxing": "sitting-relaxing" };
  function illo(name, size, alt) {
    return '<img class="illo" src="illo/blob-' + name + '.svg" width="' + size + '" height="' + size + '" alt="' + esc(alt || "") + '"' + (alt ? "" : ' aria-hidden="true"') + ">";
  }
  function asDate(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  var WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MO = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function longDate(s) { var d = asDate(s); return WD[d.getDay()] + " " + d.getDate() + " " + MO[d.getMonth()]; }
  function shortDate(s) { var d = asDate(s); return WD[d.getDay()].slice(0, 3) + " " + d.getDate() + " " + MO[d.getMonth()].slice(0, 3); }
  function clock(min) { var h = Math.floor(min / 60) % 24, m = min % 60; return (h % 12 || 12) + ":" + (m < 10 ? "0" : "") + m; }
  function ampm(min) { return clock(min) + " " + (Math.floor(min / 60) % 24 < 12 ? "am" : "pm"); }
  function dayBy(date) { for (var i = 0; i < DAYS.length; i++) if (DAYS[i].date === date) return DAYS[i]; return null; }

  // ---------- moments ----------
  var ACTS = ["Exercising", "Walking somewhere", "On its feet working", "Sitting working", "Sitting relaxing"];
  var VOICE = { "Exercising": "exercising", "Walking somewhere": "walking somewhere", "On its feet working": "on my feet working", "Sitting working": "sitting working", "Sitting relaxing": "sitting relaxing" };
  var MOVING = { "Exercising": true, "Walking somewhere": true, "On its feet working": true };
  function watchGuess(d, r) {
    var lift = r.bpm - d.rhr;
    if (r.steps10 > 250) return r.steps10 > 1000 && lift >= 60 ? "Exercising" : r.mins >= 45 ? "On its feet working" : "Walking somewhere";
    return r.peakMin >= 480 && r.peakMin < 1140 ? "Sitting working" : "Sitting relaxing";
  }
  var ALL = [];
  DAYS.forEach(function (d) {
    d.moments = d.rises.map(function (r) {
      var m = { id: d.date + "|" + r.peakMin, date: d.date, day: d, peakMin: r.peakMin, start: r.start, end: r.end, bpm: r.bpm,
        lift: Math.round(r.bpm - d.rhr), steps10: r.steps10, mins: r.mins, watch: watchGuess(d, r), example: r.answer,
        score: (r.bpm - d.rhr) * Math.sqrt(r.mins) };
      ALL.push(m);
      return m;
    });
  });
  var byId = {}; ALL.forEach(function (m) { byId[m.id] = m; });
  function todayDay() { return dayBy(TODAY); }
  function storiesOf(d) { return d.moments.slice().sort(function (a, b) { return b.score - a.score; }).slice(0, 4); }
  function ans(m) {
    var u = S.answers[m.id];
    if (u) return u;
    if (m.example) return { activity: m.watch, due: m.example.due, onTop: m.example.onTop, flat: m.example.flat, cantRemember: false };
    return null;
  }
  function answered(m) { var a = ans(m); return !!(a && !a.cantRemember && a.flat); }
  function activityOf(m) { var a = ans(m); return (a && a.activity) || m.watch; }
  function isMoving(m) { return !!MOVING[activityOf(m)]; }
  function kind(moving, flat) { return moving ? (flat >= 4 ? "Overload" : "Effort") : (flat >= 4 ? "Pressure" : "Neither"); }

  // ---------- vignettes: one template, fixed factors ----------
  // grid factors: body (still / on the move) x demand (due?) x resources (behind?), the same 8 cells as the practice stories.
  // descriptors: time of day, duration, intensity. Activity only picks the illustration.
  function part(min) { return min < 720 ? 0 : min < 840 ? 1 : min < 1020 ? 2 : 3; }
  function bodyMoving(m) { return m.steps10 > 250; }
  function cellKey(moving, due, behind) { return (moving ? "m" : "s") + (due ? "d" : "n") + (behind ? "b" : "t"); }
  var ANCHORS = D.practice.map(function (p) { return { key: cellKey(p.moving, p.due, p.behind), moving: !!p.moving, due: !!p.due, behind: !!p.behind, seed: p.flat }; })
    .sort(function (a, b) { return a.moving - b.moving || b.due - a.due || b.behind - a.behind; });
  function anchorFlat(key) {
    if (S.anchors[key]) return S.anchors[key];
    var c = ANCHORS.filter(function (x) { return x.key === key; })[0];
    return c ? c.seed : 4;
  }
  function factors(m) {
    var a = ans(m), done = !!(a && !a.cantRemember && a.flat);
    return { time: part(m.peakMin), moving: bodyMoving(m), long: m.mins >= 40, high: m.bpm - m.day.rhr >= 45, cant: !!(a && a.cantRemember),
      due: done ? !!a.due : null, behind: done ? !a.onTop : null, flat: done ? a.flat : null };
  }
  function episode(time, date) {
    if (!date || date === TODAY) return ["This morning", "Around midday", "This afternoon", "This evening"][time];
    var wd = WD[asDate(date).getDay()];
    return "On " + wd + " " + ["morning", "around midday", "afternoon", "evening"][time];
  }
  function bodySentence(f) {
    return "I'd been " + (f.moving ? "on the move" : "sitting still") + " for " + (f.long ? "most of an hour" : "a little while") + " when my heart " + (f.high ? "started racing" : "picked up") + ".";
  }
  function dueS(d) { return d === true ? "Something was due." : d === false ? "Nothing was due." : "Was something due?"; }
  function topS(b) { return b === true ? "I was behind." : b === false ? "I was on top of things." : "Was I on top of things?"; }

  // the blob fills the blanks itself as it learns, from answered moments with the same body and time of day
  function selfGuess(m) {
    var mv = bodyMoving(m), pt = part(m.peakMin);
    var sim = ALL.filter(function (o) { return o.id !== m.id && answered(o) && bodyMoving(o) === mv && part(o.peakMin) === pt && (o.date < m.date || (o.date === m.date && S.answers[o.id])); });
    var n = sim.length, flats = sim.map(function (o) { return ans(o).flat; });
    var maj = function (key) {
      var yes = sim.filter(function (o) { return ans(o)[key] === true; }).length, no = sim.filter(function (o) { return ans(o)[key] === false; }).length;
      return yes && yes >= 2 * no ? true : no && no >= 2 * yes ? false : null;
    };
    var due = n >= 3 ? maj("due") : null, onTop = n >= 3 ? maj("onTop") : null;
    var seed = due != null && onTop != null ? anchorFlat(cellKey(mv, due, !onTop)) : mean(ANCHORS.filter(function (c) { return c.moving === mv; }).map(function (c) { return anchorFlat(c.key); }));
    var flat = level(n ? (mean(flats) * n + seed * 0.5) / (n + 0.5) : seed);
    var spread = n ? Math.max.apply(null, flats) - Math.min.apply(null, flats) : 0;
    var stage = n < 3 ? 1 : n >= 5 && spread <= 2 && due != null && onTop != null ? 3 : 2;
    return { stage: stage, flat: flat, n: n, due: due, onTop: onTop };
  }
  function openAppraisal(g, dr) {
    dr = dr || {};
    if (g.stage === 3 && !dr.open) return (g.due ? "Something was due" : "Nothing was due") + ", and I was " + (g.onTop ? "on top of things" : "behind") + ". I think it left me " + levelWord(g.flat) + ".";
    var d = dr.due != null ? dueS(dr.due) : g.stage >= 2 && g.due != null ? (g.due ? "I think something was due. Was it?" : "I think nothing was due. Am I right?") : dueS(null);
    var t = dr.onTop != null ? topS(!dr.onTop) : g.stage >= 2 && g.onTop != null ? (g.onTop ? "I think I was on top of things. Was I?" : "I think I was behind. Was I?") : topS(null);
    return d + " " + t + (dr.flat ? " It left me " + levelWord(dr.flat) + "." : "");
  }
  // state B (open) for tonight, state C (complete) once answered; pass the Story decision draft to fill blanks as they're answered
  function vignette(m, dr) {
    var f = factors(m), head = episode(f.time, m.date) + ". " + bodySentence(f);
    if (f.cant && !dr) return head + " Neither of us could remember what was going on.";
    if (f.flat && !dr) return head + " " + dueS(f.due) + " " + topS(f.behind) + " It left me " + levelWord(f.flat) + ".";
    return head + " " + openAppraisal(dr ? dr.guess : selfGuess(m), dr);
  }
  // state A: a practice story, one fixed episode so only the grid factors vary
  function anchorVignette(c) { return "This afternoon. " + bodySentence({ moving: c.moving, long: true, high: true }) + " " + dueS(c.due) + " " + topS(c.behind); }
  function anchorLine(m) {
    var f = factors(m); if (!f.flat) return "";
    var diff = f.flat - anchorFlat(cellKey(f.moving, f.due, f.behind));
    return diff >= 2 ? "That was flatter than my practice story about the same thing." : diff <= -2 ? "That was easier than I expected from my practice story." : "";
  }
  function tileFor(m, size) {
    var f = factors(m);
    return '<span class="vtile" style="width:' + size + "px;height:" + size + 'px">' + illo(ACTIVITY_ILLO[activityOf(m)], size - 4) +
      (f.due ? '<img class="badge-c tr" src="illo/badge-due.svg" width="24" height="24" alt="Something was due">' : "") +
      (f.behind != null ? '<img class="badge-c br" src="illo/badge-' + (f.behind ? "behind" : "on-top") + '.svg" width="24" height="24" alt="' + (f.behind ? "Behind" : "On top of things") + '">' : "") + "</span>";
  }

  // ---------- the blob ----------
  var V = [
    "M50 4C78 4 96 24 96 52C96 76 90 86 50 86C10 86 4 76 4 52C4 24 22 4 50 4Z",
    "M52 3C80 5 97 26 96 53C95 77 89 86 50 86C11 86 5 77 4 51C3 25 24 2 52 3Z",
    "M48 5C76 3 95 23 97 51C97 76 91 86 50 86C9 86 3 75 5 53C6 26 20 6 48 5Z"
  ];
  var uid = 0;
  function dims(k) { return { w: 40 + (k - 1) * 7, h: 56 - (k - 1) * 5.8 }; }
  function mapPath(p, x0, y0, W, H) {
    var i = 0;
    return p.replace(/-?\d+(\.\d+)?/g, function (n) { var v = +n; var out = i % 2 === 0 ? x0 + (v - 4) / 92 * W : y0 + (v - 4) / 82 * H; i++; return out.toFixed(2); });
  }
  // opts: f (size), state, pal, stage (px box for sphere), still (no motion), label
  function blob(k, opts) {
    opts = opts || {};
    k = Math.max(1, Math.min(7, k || 1));
    var f = opts.f || 2, dm = dims(k), W = dm.w * f, H = dm.h * f, n = ++uid;
    var state = opts.state || (k >= 4 ? "flat" : "wait");
    var pal = opts.pal || ({ flat: "dusk", breathe: "sage", puff: "sage", work: "glow" }[state] || opts.bg || S.look.bg);
    var col = lookColor(opts.color), sx = col[2] ? "-" + col[0] : "", u = function (id) { return "url(#" + id + sx + ")"; };
    var stageW = opts.box || Math.max(W * 1.7, 56 * f * 1.25), stageH = opts.boxH || stageW;
    var SW = W * 1.6, SH = H * 1.5, x0 = (SW - W) / 2, y0 = SH - H - H * 0.14;
    var fs = (W + H) / 40, eyeY = y0 + H * 0.31 + fs, lid = 1 - (k - 1) * 0.08, drop = (k - 1) * 0.06 * fs;
    var still = opts.still || REDUCED;
    var paths = V.map(function (p) { return mapPath(p, x0, y0, W, H); });
    var anim = still ? "" : '<animate attributeName="d" dur="' + (k >= 5 ? 8.1 : 5.4) + 's" repeatCount="indefinite" calcMode="spline" keyTimes="0;.33;.66;1" keySplines=".45 0 .55 1;.45 0 .55 1;.45 0 .55 1" values="' + paths[0] + ";" + paths[1] + ";" + paths[2] + ";" + paths[0] + '"/>';
    var cx = x0 + W / 2;
    function eye(x) {
      return '<g transform="translate(0 ' + (eyeY * (1 - lid)).toFixed(2) + ') scale(1 ' + lid.toFixed(3) + ')"><g class="b-blink">' +
        '<ellipse cx="' + x.toFixed(2) + '" cy="' + eyeY.toFixed(2) + '" rx="' + (0.75 * fs).toFixed(2) + '" ry="' + fs.toFixed(2) + '" fill="#2d2c2b" fill-opacity=".92"/>' +
        '<ellipse cx="' + (x - 0.2 * fs).toFixed(2) + '" cy="' + (eyeY - 0.4 * fs).toFixed(2) + '" rx="' + (0.32 * fs).toFixed(2) + '" ry="' + (0.32 * fs).toFixed(2) + '" fill="#fff" fill-opacity=".95"/></g></g>';
    }
    var bub = function (c, rx, ry, r) { return '<circle cx="' + (x0 + rx * W).toFixed(1) + '" cy="' + (y0 + ry * H).toFixed(1) + '" r="' + (r * W).toFixed(2) + '" fill="url(#bBub)" stroke="#fff" stroke-opacity=".65" stroke-width=".6"/>'; };
    var ey = eyeY + drop, ex = 1.6 * fs, F = function (v) { return v.toFixed(1); };
    var ACC = {
      // an empty thought bubble: nothing in there yet
      brain: '<g class="a-think"><circle class="a-t1" cx="' + F(cx + W * 0.24) + '" cy="' + F(y0 + H * 0.02) + '" r="' + F(fs * 0.5) + '" fill="#fff" stroke="#d9d3cd" stroke-width="1"/>' +
        '<circle class="a-t2" cx="' + F(cx + W * 0.33) + '" cy="' + F(y0 - H * 0.1) + '" r="' + F(fs * 0.8) + '" fill="#fff" stroke="#d9d3cd" stroke-width="1"/>' +
        '<g class="a-cloud"><path d="M' + F(cx + W * 0.26) + " " + F(y0 - H * 0.2) + "a" + F(fs * 1.6) + " " + F(fs * 1.4) + " 0 0 1 " + F(fs * 2.4) + " " + F(-fs * 1.9) + "a" + F(fs * 1.9) + " " + F(fs * 1.7) + " 0 0 1 " + F(fs * 3.4) + " 0a" + F(fs * 1.6) + " " + F(fs * 1.4) + " 0 0 1 " + F(fs * 1.4) + " " + F(fs * 2.9) + "a" + F(fs * 1.5) + " " + F(fs * 1.3) + " 0 0 1 " + F(-fs * 2.2) + " " + F(fs * 1.9) + "h" + F(-fs * 3.2) + "a" + F(fs * 1.5) + " " + F(fs * 1.3) + " 0 0 1 " + F(-fs * 1.8) + " " + F(-fs * 2.9) + 'z" fill="#fff" stroke="#d9d3cd" stroke-width="1"/>' +
        '<circle class="a-fly" cx="' + F(cx + W * 0.26 + fs * 3.4) + '" cy="' + F(y0 - H * 0.2 - fs * 0.6) + '" r="' + F(fs * 0.22) + '" fill="#cfc7c0"/></g></g>',
      // reading glasses and an open book
      read: '<g fill="none" stroke="#2d2c2b" stroke-width="' + F(fs * 0.28) + '"><circle cx="' + F(cx - ex) + '" cy="' + F(ey) + '" r="' + F(fs * 1.55) + '"/><circle cx="' + F(cx + ex) + '" cy="' + F(ey) + '" r="' + F(fs * 1.55) + '"/>' +
        '<path d="M' + F(cx - ex + fs * 1.55) + " " + F(ey - fs * 0.2) + "q" + F(ex - fs * 1.55) + " " + F(-fs * 0.7) + " " + F(2 * (ex - fs * 1.55)) + ' 0"/></g>' +
        '<g class="a-book"><path d="M' + F(cx) + " " + F(y0 + H * 0.66) + "l" + F(-W * 0.36) + " " + F(-H * 0.07) + "v" + F(H * 0.24) + "l" + F(W * 0.36) + " " + F(H * 0.07) + "l" + F(W * 0.36) + " " + F(-H * 0.07) + "v" + F(-H * 0.24) + 'z" fill="#5f2b89"/>' +
        '<path d="M' + F(cx) + " " + F(y0 + H * 0.64) + "l" + F(-W * 0.33) + " " + F(-H * 0.08) + "v" + F(H * 0.23) + "l" + F(W * 0.33) + " " + F(H * 0.08) + "l" + F(W * 0.33) + " " + F(-H * 0.08) + "v" + F(-H * 0.23) + 'z" fill="#fdfcfc" stroke="#e2ded9" stroke-width=".8"/>' +
        '<path d="M' + F(cx) + " " + F(y0 + H * 0.64) + "v" + F(H * 0.23) + '" stroke="#d9d3cd" stroke-width="1"/>' +
        '<g stroke="#d9d3cd" stroke-width="1">' + [0, 1, 2].map(function (j) { var yy = y0 + H * (0.62 + j * 0.05); return '<path d="M' + F(cx - W * 0.27) + " " + F(yy) + "l" + F(W * 0.22) + " " + F(H * 0.05) + "M" + F(cx + W * 0.05) + " " + F(yy + H * 0.05) + "l" + F(W * 0.22) + " " + F(-H * 0.05) + '"/>'; }).join("") + "</g></g>",
      // not sure: a question mark and a sweat drop
      puzzled: '<text class="a-q" x="' + F(cx + W * 0.2) + '" y="' + F(y0 - H * 0.12) + '" font-family="DM Sans, system-ui, sans-serif" font-weight="700" font-size="' + F(fs * 5.5) + '" fill="#5f2b89">?</text>' +
        '<path class="a-drop" d="M' + F(x0 + W * 0.14) + " " + F(y0 + H * 0.12) + "c" + F(fs * 0.7) + " " + F(fs * 1.2) + " " + F(fs * 1.1) + " " + F(fs * 1.8) + " " + F(fs * 1.1) + " " + F(fs * 2.4) + "a" + F(fs * 1.1) + " " + F(fs * 1.1) + " 0 0 1 " + F(-fs * 2.2) + " 0c0 " + F(-fs * 0.6) + " " + F(fs * 0.4) + " " + F(-fs * 1.2) + " " + F(fs * 1.1) + " " + F(-fs * 2.4) + 'z" fill="#8fd3ff" stroke="#fff" stroke-width=".8"/>',
      // writing it down in a notebook
      write: '<g class="a-note"><rect x="' + F(cx - W * 0.4) + '" y="' + F(y0 + H * 0.6) + '" width="' + F(W * 0.8) + '" height="' + F(H * 0.3) + '" rx="' + F(fs * 0.6) + '" fill="#fdfcfc" stroke="#e2ded9" stroke-width=".8"/>' +
        '<rect x="' + F(cx - W * 0.4) + '" y="' + F(y0 + H * 0.6) + '" width="' + F(W * 0.8) + '" height="' + F(H * 0.045) + '" rx="' + F(fs * 0.3) + '" fill="#0061ef"/>' +
        '<path class="a-ink" pathLength="1" d="M' + F(cx - W * 0.3) + " " + F(y0 + H * 0.73) + "q" + F(W * 0.05) + " " + F(-H * 0.04) + " " + F(W * 0.1) + " 0t" + F(W * 0.1) + " 0t" + F(W * 0.1) + " 0t" + F(W * 0.1) + " 0M" + F(cx - W * 0.3) + " " + F(y0 + H * 0.82) + "q" + F(W * 0.05) + " " + F(-H * 0.04) + " " + F(W * 0.1) + " 0t" + F(W * 0.1) + " 0t" + F(W * 0.1) + ' 0" fill="none" stroke="#2d2c2b" stroke-width="1.4" stroke-linecap="round"/>' +
        '<g class="a-pencil"><g transform="translate(' + F(cx + W * 0.12) + " " + F(y0 + H * 0.74) + ') rotate(-40)"><path d="M0 0l' + F(fs * 0.7) + " " + F(-fs * 0.45) + "h" + F(fs * 6) + "v" + F(fs * 0.9) + "h" + F(-fs * 6) + 'z" fill="#f47d31"/><path d="M0 0l' + F(fs * 0.7) + " " + F(-fs * 0.45) + "v" + F(fs * 0.9) + 'z" fill="#f5d6b8"/><circle cx="' + F(fs * 0.15) + '" cy="0" r="' + F(fs * 0.18) + '" fill="#2d2c2b"/><rect x="' + F(fs * 6.7) + '" y="' + F(-fs * 0.45) + '" width="' + F(fs * 0.9) + '" height="' + F(fs * 0.9) + '" rx="' + F(fs * 0.2) + '" fill="#ffa1cc"/></g></g></g>',
      // a little blush
      blush: '<g class="a-blush"><ellipse cx="' + F(cx - ex - fs * 1.3) + '" cy="' + F(ey + fs * 1.5) + '" rx="' + F(fs * 1.05) + '" ry="' + F(fs * 0.55) + '" fill="#ff7fae" fill-opacity=".5" filter="url(#blur1_5)"/>' +
        '<ellipse cx="' + F(cx + ex + fs * 1.3) + '" cy="' + F(ey + fs * 1.5) + '" rx="' + F(fs * 1.05) + '" ry="' + F(fs * 0.55) + '" fill="#ff7fae" fill-opacity=".5" filter="url(#blur1_5)"/></g>'
    };
    var acc = opts.acc && ACC[opts.acc] ? '<g class="acc acc-' + opts.acc + '">' + ACC[opts.acc] + "</g>" : "";
    var sphereD = stageW * 0.9;
    var svg = '<svg class="bsvg" width="' + SW.toFixed(1) + '" height="' + SH.toFixed(1) + '" viewBox="0 0 ' + SW.toFixed(1) + " " + SH.toFixed(1) + '" style="left:' + ((stageW - SW) / 2).toFixed(1) + 'px;bottom:' + (stageH * 0.16).toFixed(1) + 'px;--rise:' + (-H * 0.35).toFixed(1) + 'px;--look:' + (0.45 * fs).toFixed(2) + 'px;--upv:' + (0.5 * fs).toFixed(2) + 'px" aria-hidden="true">' +
      '<defs><path id="bp' + n + '" d="' + paths[0] + '">' + anim + '</path><clipPath id="bc' + n + '"><use href="#bp' + n + '"/></clipPath></defs>' +
      '<ellipse cx="' + cx + '" cy="' + (y0 + H + H * 0.06).toFixed(1) + '" rx="' + (W * 0.67).toFixed(1) + '" ry="' + (H * 0.11).toFixed(1) + '" fill="' + u("bShadow") + '" filter="url(#blur1_5)"/>' +
      '<g class="b-lean"><g class="b-squash">' +
      '<ellipse class="b-halo" cx="' + cx + '" cy="' + (y0 + H * 0.5).toFixed(1) + '" rx="' + (W * 0.66).toFixed(1) + '" ry="' + (H * 0.62).toFixed(1) + '" fill="' + u("bHalo") + '"/>' +
      '<g clip-path="url(#bc' + n + ')">' +
      '<use href="#bp' + n + '" fill="' + u("bFill") + '"/><use href="#bp' + n + '" fill="' + u("bBase") + '"/><use href="#bp' + n + '" fill="' + u("bTop") + '"/>' +
      '<g class="b-core"><ellipse cx="' + cx + '" cy="' + (y0 + H * 0.68).toFixed(1) + '" rx="' + (W * 0.35).toFixed(1) + '" ry="' + (H * 0.33).toFixed(1) + '" fill="' + u("bCore") + '"/></g>' +
      '<g class="b-bub b1">' + bub(0, 0.7, 0.66, 0.035) + '</g><g class="b-bub b2">' + bub(0, 0.3, 0.76, 0.021) + '</g><g class="b-bub b3">' + bub(0, 0.55, 0.87, 0.014) + "</g>" +
      '<ellipse cx="' + cx + '" cy="' + (y0 + H * 0.965).toFixed(1) + '" rx="' + (W * 0.41).toFixed(1) + '" ry="' + (H * 0.088).toFixed(1) + '" fill="' + u("bRim") + '"/>' +
      '<g class="b-hl"><ellipse cx="' + (x0 + W * 0.37).toFixed(1) + '" cy="' + (y0 + H * 0.22).toFixed(1) + '" rx="' + (W * 0.185).toFixed(1) + '" ry="' + (H * 0.11).toFixed(1) + '" fill="url(#bSpec)" transform="rotate(-18 ' + (x0 + W * 0.37).toFixed(1) + " " + (y0 + H * 0.22).toFixed(1) + ')"/>' +
      '<circle cx="' + (x0 + W * 0.65).toFixed(1) + '" cy="' + (y0 + H * 0.19).toFixed(1) + '" r="' + (W * 0.024).toFixed(2) + '" fill="#fff" fill-opacity=".9"/></g>' +
      '<use href="#bp' + n + '" fill="' + u("bEdge") + '"/></g>' +
      '<use href="#bp' + n + '" fill="none" stroke="' + hueShift("#d68c00", col[2], col[3], col[4]) + '" stroke-opacity=".28" stroke-width="1"/>' +
      '<g transform="translate(0 ' + drop.toFixed(2) + ')"><g class="b-up"><g class="b-look">' + eye(cx - 1.6 * fs) + eye(cx + 1.6 * fs) + "</g></g></g>" +
      acc + "</g></g></svg>";
    return '<div class="bstage st-' + state + (opts.loop ? " loop" : "") + (k >= 5 ? " slow" : "") + (still ? " static" : "") + '" style="width:' + stageW.toFixed(0) + "px;height:" + stageH.toFixed(0) + 'px"' +
      (opts.label ? ' role="img" aria-label="' + esc(opts.label) + '"' : ' aria-hidden="true"') + ">" +
      (opts.noSphere ? "" : '<div class="sphere pal-' + pal + '" style="width:' + sphereD.toFixed(0) + "px;height:" + sphereD.toFixed(0) + "px;left:" + ((stageW - sphereD) / 2).toFixed(0) + "px;top:" + ((stageH - sphereD) / 2).toFixed(0) + 'px"></div>') +
      svg + "</div>";
  }
  function mini(k, label) { return blob(k, { f: 0.62, still: true, noSphere: true, box: 40, boxH: 40, label: label }); }

  // ---------- icons ----------
  var ICON = {
    back: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2d2c2b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    home: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/></svg>',
    stories: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 5h14v10H10l-5 4z"/></svg>',
    learned: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l2.2 5.6L20 9.5l-4.4 3.8L17 19l-5-3-5 3 1.4-5.7L4 9.5l5.8-.9z"/></svg>',
    blob: '<svg width="22" height="22" viewBox="0 0 100 90" fill="none" stroke="currentColor" stroke-width="9"><path d="' + V[0] + '"/></svg>',
    tick: '<svg width="18" height="18" viewBox="0 0 20 20"><circle cx="10" cy="10" r="10" fill="#ffe9a6"/><path d="M6 10.5l2.6 2.5L14 7.5" fill="none" stroke="#2d2c2b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  // ---------- routing ----------
  var app = document.getElementById("app");
  var overlay = null; // { type: "popup" | "after", ... }
  function go(h) { if (location.hash === h) render(); else location.hash = h; }
  function route() {
    var h = (location.hash || "").slice(1);
    if (!S.onboarded && !/^(intro|step[1-6])$/.test(h)) return { name: "intro" };
    if (!h) return { name: "home" };
    var p = h.split("/");
    return { name: p[0], arg: p.slice(1).join("/") };
  }

  function tabbar(active) {
    var tabs = [["home", "Home"], ["stories", "Journal"], ["learned", "Learned"], ["blob", "Blob"]];
    return '<nav class="tabbar" aria-label="Main">' + tabs.map(function (t) {
      return '<a class="tab" href="#' + t[0] + '"' + (t[0] === active ? ' aria-current="page"' : "") + '><span class="ic">' + ICON[t[0]] + "</span>" + t[1] + "</a>";
    }).join("") + "</nav>";
  }

  // ---------- onboarding ----------
  var OB = [
    { kicker: "Hello, meet", h: "BLOB", body: "Blob is well… A blob,<br>blob doesn’t know how to feel because well… its a blob.", btn: "Would you like to help blob?", blob: { k: 1, state: "wait" }, intro: true },
    { h: "Blob feels things,<br>but it doesn’t know<br>how to <em>feel</em> them.", sub: "But you do…", btn: "But you do…", blob: { k: 1, state: "bounce", acc: "brain" }, big: true },
    { h: "Blob can however<br>tell <em>you</em> a story", body: "Each evening, the blob tells you about its biggest moments of the day, written from what it felt: the time, whether it was sitting still or on its feet, how fast its heart was going.", btn: "Next", blob: { k: 1, state: "wait", acc: "read" } },
    { h: "You might be able to<br>help blob understand.", body: "You fill in what was going on for the blob, and how flat it got. Was it pressure, or just effort?", btn: "Next", blob: { k: 5, state: "flat", acc: "puzzled" } },
    { h: "You can teach it to learn", body: "At first it has no idea. After a few days it starts guessing about itself. You just tell it when it’s right or wrong.",
      quote: "“This afternoon. I'd been sitting still for most of an hour when my heart started racing. Something was due, and I was behind. I think it left me quite flat.”", btn: "Next", blob: { k: 1, state: "work", acc: "write" } },
    { h: "It asks for a little care", body: "When it’s flattened, the blob might ask you to breathe slowly with it, or rest. As your heart settles, you’ll see it puff back up.",
      ticks: ["It never gets worse because you were busy. Only your day can flatten it.", "No streaks, no scores. Skip any day you like.", "You can always say “not now”."], btn: "Next", blob: { k: 1, state: "puff", acc: "blush" } },
    { h: "Choose your blob", btn: "Meet my blob", blob: { k: 1, state: "wait" }, choose: true }
  ];
  function viewOnboarding(i) {
    var o = OB[i];
    var head = i === 0 ? '<div class="ob-head"></div>' :
      '<div class="ob-head"><button class="back" data-go="' + (i === 1 ? "#intro" : "#step" + (i - 1)) + '" aria-label="Back">' + ICON.back + '</button><div class="pdots" aria-label="Step ' + i + ' of 6">' +
      [1, 2, 3, 4, 5, 6].map(function (j) { return "<i" + (j === i ? ' class="on"' : "") + "></i>"; }).join("") + "</div><span></span></div>";
    var art = '<div class="ob-blob">' + blob(o.blob.k, { f: 3.3, state: o.blob.state, acc: o.blob.acc, loop: true, box: 330, label: "The blob" }) + "</div>";
    var btn = '<button class="btn" data-act="ob" data-v="' + i + '">' + o.btn + "</button>";
    if (o.choose) return '<div class="screen"><div class="ob ob-center ob-choose">' + head +
      '<div class="ob-blob" id="lookblob">' + blob(1, { f: 3.3, state: "wait", loop: true, box: 330, label: "Your blob, " + lookColor()[1] }) + "</div>" +
      "<h1>" + o.h + "</h1>" + lookPicker() + btn + "</div></div>";
    if (o.intro) return '<div class="screen"><div class="ob ob-intro">' + head +
      '<p class="kicker">' + o.kicker + '</p><h1 class="wordmark">' + o.h + "</h1>" + art +
      '<p class="body">' + o.body + "</p>" + btn + "</div></div>";
    return '<div class="screen"><div class="ob ob-center' + (o.big ? " ob-big" : "") + '">' + head + art + "<h1>" + o.h + "</h1>" +
      (o.sub ? '<p class="sub">' + o.sub + "</p>" : "") +
      (o.body ? '<p class="body">' + o.body + "</p>" : "") +
      (o.quote ? '<p class="quote">' + o.quote + "</p>" : "") +
      (o.ticks ? '<ul class="ticks">' + o.ticks.map(function (t) { return "<li>" + ICON.tick + "<span>" + t + "</span></li>"; }).join("") + "</ul>" : "") +
      btn + "</div></div>";
  }

  function lookPicker() {
    var col = '<p class="pick-h">Colour</p><div class="swatches" role="radiogroup" aria-label="Colour">' + COLORS.map(function (c) {
      return '<button class="sw' + (S.look.color === c[0] ? " on" : "") + '" role="radio" aria-checked="' + (S.look.color === c[0]) + '" data-act="look" data-k="color" data-v="' + c[0] + '" aria-label="' + c[1] + '">' +
        '<span class="sw-dot" style="background:radial-gradient(circle at 36% 30%,' + hueShift("#fff4be", c[2], c[3], c[4]) + "," + hueShift("#ffd832", c[2], c[3], c[4]) + " 45%," + hueShift("#f09e00", c[2], c[3], c[4]) + ')"></span><span>' + c[1] + "</span></button>";
    }).join("") + "</div>";
    var bg = '<p class="pick-h">Background</p><div class="swatches" role="radiogroup" aria-label="Background">' + BGS.map(function (b) {
      return '<button class="sw' + (S.look.bg === b[0] ? " on" : "") + '" role="radio" aria-checked="' + (S.look.bg === b[0]) + '" data-act="look" data-k="bg" data-v="' + b[0] + '" aria-label="' + b[1] + '">' +
        '<span class="sw-dot pal-' + b[0] + '"></span><span>' + b[1] + "</span></button>";
    }).join("") + "</div>";
    return '<div class="picker">' + col + bg + "</div>";
  }

  // ---------- home ----------
  function todayLevel() {
    var t = todayDay(), flats = t.moments.filter(answered).map(function (m) { return careAfter(m); });
    return flats.length ? Math.max(1, Math.round(mean(flats))) : 2;
  }
  function careAfter(m) { var c = S.care[m.id], a = ans(m); return c && c.settled ? Math.max(1, a.flat - 2) : a.flat; }
  var LEVEL_LINE = { 1: "Round and bouncing today.", 2: "Mostly bouncing along today.", 3: "A little squashed today.", 4: "Halfway flattened today.", 5: "Quite flat today.", 6: "Very flat today.", 7: "Completely flattened today." };
  function homeChart(d) {
    var W = 320, H = 150, L = 6, R = 6, T = 14, B = 22, from = 360, to = 1080;
    var vals = d.series.filter(function (p) { return p[0] >= from && p[0] <= NOW; }).map(function (p) { return p[1]; });
    var lo = Math.min(d.rhr - 8, Math.min.apply(null, vals) - 4), hi = Math.max(d.rhr + 40, Math.max.apply(null, vals) + 6);
    var x = function (m) { return L + (m - from) / (to - from) * (W - L - R); };
    var y = function (b) { return T + (1 - (b - lo) / (hi - lo)) * (H - T - B); };
    var g = "";
    d.moments.forEach(function (m) {
      var mv = isMoving(m), c = mv ? "#f47d31" : "#5f2b89";
      g += '<rect x="' + x(m.start).toFixed(1) + '" y="' + T + '" width="' + Math.max(4, x(m.end) - x(m.start)).toFixed(1) + '" height="' + (H - T - B) + '" rx="6" fill="' + c + '" fill-opacity=".1"/>';
    });
    d.series.forEach(function (p) {
      if (p[0] < from || p[0] > NOW || !p[2]) return;
      var h = Math.min(p[2], 600) / 600 * 22;
      g += '<rect x="' + (x(p[0]) - 1.2).toFixed(1) + '" y="' + (H - B - h).toFixed(1) + '" width="2.4" height="' + h.toFixed(1) + '" rx="1" fill="#2d2c2b" fill-opacity=".12"/>';
    });
    var th = d.rhr + 25;
    g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(th).toFixed(1) + '" y2="' + y(th).toFixed(1) + '" stroke="#5c5853" stroke-width="1" stroke-dasharray="4 4" stroke-opacity=".6"/>' +
      '<text x="' + (W - R) + '" y="' + (y(th) - 4).toFixed(1) + '" text-anchor="end">rest + 25</text>';
    var pts = d.series.filter(function (p) { return p[0] >= from && p[0] <= NOW; });
    g += '<path d="' + pts.map(function (p, i) { return (i ? "L" : "M") + x(p[0]).toFixed(1) + " " + y(p[1]).toFixed(1); }).join("") + '" fill="none" stroke="#2d2c2b" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
    d.moments.forEach(function (m) {
      g += '<circle cx="' + x(m.peakMin).toFixed(1) + '" cy="' + y(m.bpm).toFixed(1) + '" r="5" fill="' + (isMoving(m) ? "#f47d31" : "#5f2b89") + '" stroke="#fdfcfc" stroke-width="2"/>';
    });
    g += '<line x1="' + x(NOW).toFixed(1) + '" x2="' + x(NOW).toFixed(1) + '" y1="' + (T - 6) + '" y2="' + (H - B) + '" stroke="#2d2c2b" stroke-width="1"/>' +
      '<text x="' + (x(NOW) - 4).toFixed(1) + '" y="' + (T - 2) + '" text-anchor="end" style="font-weight:700;fill:#2d2c2b">Now</text>';
    [[360, "6am"], [540, "9am"], [720, "12pm"], [900, "3pm"], [1080, "6pm"]].forEach(function (t, i) {
      g += '<text x="' + x(t[0]).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + (i === 0 ? "start" : i === 4 ? "end" : "middle") + '">' + t[1] + "</text>";
    });
    return '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Its heart rate from 6am to now, with ' + d.moments.length + ' moments when it rose">' + g + "</svg>";
  }
  function viewHome() {
    var d = todayDay(), lv = todayLevel(), n = d.moments.length;
    var h = '<div class="screen with-tabs"><p class="date">' + longDate(TODAY) + '</p><h1 class="title">The blob\'s day</h1>' +
      '<section class="card blobcard">' + blob(lv, { f: 1.9, box: 160, label: "The blob, " + levelLabel(lv) }) +
      '<div><p class="caption" style="font-weight:500">How flat it is</p><p class="flat-n">' + lv + ' <span>of 7</span></p><p class="small" style="margin:8px 0 12px"><b>' + cap(levelWord(lv)) + "</b>. " + LEVEL_LINE[lv] + "</p>" +
      '<span class="chip"><i class="dot" style="background:#5f2b89"></i>' + n + " moment" + (n === 1 ? "" : "s") + " today</span></div></section>" +
      '<section class="card"><div class="chart-head"><h2 class="section">Its heartbeat today</h2><div class="legend"><span><i class="dot" style="background:#f47d31"></i>Moving</span><span><i class="dot" style="background:#5f2b89"></i>Still</span></div></div>' + homeChart(d) + "</section>" +
      '<div class="stats"><div class="stat"><b>' + Math.round(d.rhr) + '</b><span>resting bpm</span></div><div class="stat"><b>' + d.steps.toLocaleString("en-AU") + '</b><span>steps</span></div><div class="stat"><b>' + n + "</b><span>moments</span></div></div>";
    if (d.nRises > 4) h += '<p class="small" style="margin-top:10px">The blob will ask you about the biggest 4 tonight.</p>';
    return h + "</div>" + tabbar("home");
  }

  // ---------- popup ----------
  function nextStory(d) { return storiesOf(d || todayDay()).filter(function (m) { return !ans(m); })[0]; }
  function viewPopup(m) {
    return '<div class="backdrop" data-act="close"></div><div class="sheet" role="dialog" aria-label="The blob has a story"><div class="grab"></div>' +
      '<div class="illo-hero">' + illo("heart-racing", 120) + "</div>" +
      '<p class="meta">' + ampm(m.peakMin) + " · " + (bodyMoving(m) ? "On the move" : "Sitting still") + "</p><h2>The blob has a story</h2>" +
      '<p class="vig">' + esc(vignette(m)) + "</p>" +
      '<div class="chips"><span class="chip">+' + m.lift + ' bpm</span><span class="chip">' + m.steps10 + " steps</span>" + (m.day.context ? '<span class="chip">' + esc(m.day.context) + "</span>" : "") + "</div>" +
      '<button class="btn" data-go="#story/' + m.id + '">Help it understand</button><button class="textbtn" data-act="close">Not now</button></div>';
  }

  // ---------- story decision ----------
  var draft = {};
  function draftFor(m) {
    if (draft.id !== m.id) {
      var a = S.answers[m.id] || ans(m), g = selfGuess(m);
      draft = { id: m.id, activity: (a && a.activity) || m.watch, due: a ? a.due : null, onTop: a ? a.onTop : null,
        flat: a && a.flat ? a.flat : null, guess: g, open: !!(a && a.flat) };
    }
    return draft;
  }
  function viewStory(id) {
    var m = byId[id];
    if (!m) return viewHome();
    var d = m.day, list = storiesOf(d), i = list.indexOf(m), dr = draftFor(m), g = dr.guess;
    var lv = dr.flat || (g.stage >= 2 ? g.flat : 4);
    var opt = function (key, v, label, icon) { return '<button class="opt' + (icon ? " with-illo" : "") + '" role="radio" aria-checked="' + (dr[key] === v) + '" data-act="d" data-k="' + key + '" data-v="' + esc(JSON.stringify(v)) + '">' + (icon ? illo(icon, 30) : "") + label + "</button>"; };
    var h = '<div class="screen"><div class="dhead"><button class="back" data-act="storyback" aria-label="Not now">' + ICON.back + "</button>" +
      '<div class="pdots">' + list.map(function (_, j) { return "<i" + (j === i ? ' class="on"' : "") + "></i>"; }).join("") + '</div><span class="count">' + (i + 1) + " of " + list.length + "</span></div>" +
      '<div style="display:flex;justify-content:center" id="dblob">' + blob(lv, { f: 2.2, pal: "dusk", box: 300, boxH: 260, label: "The blob, " + levelLabel(lv) }) + "</div>" +
      '<div class="storycard"><p class="vig">' + esc(vignette(m, dr)) + '</p><div class="chips" style="margin-top:14px"><span class="chip">' + ampm(m.peakMin) + '</span><span class="chip">+' + m.lift + ' bpm</span><span class="chip">' + m.steps10 + " steps</span>" +
        (d.context ? '<span class="chip">' + esc(d.context) + "</span>" : "") + "</div></div>" +
      '<div class="q"><h3>What was I doing?</h3><p class="help">My watch thinks I was ' + VOICE[m.watch] + '.</p><div class="opts" role="radiogroup" aria-label="What was I doing?">' +
      ACTS.map(function (a) { return opt("activity", a, a, ACTIVITY_ILLO[a]); }).join("") + "</div></div>";
    if (g.stage === 3 && !dr.open) {
      // stage 3: the blob says what it thinks; confirm it or open the questions
      return h + '<div class="actions"><button class="btn" data-act="confirm">That\'s right</button><button class="textbtn" data-act="notthis">Not this time</button></div></div>';
    }
    h += '<div class="q"><div class="q-illo">' + illo("something-due", 56) + '<h3>Was something due for me?</h3></div><div class="toggles" role="radiogroup" aria-label="Was something due for me?">' + opt("due", true, "Yes") + opt("due", false, "No") + "</div></div>" +
      '<div class="q"><h3>Was I on top of things?</h3><div class="toggles" role="radiogroup" aria-label="Was I on top of things?">' + opt("onTop", true, "Yes") + opt("onTop", false, "Not really") + "</div></div>" +
      '<div class="q"><h3>How flat did I get?</h3><div class="flats" role="radiogroup" aria-label="How flat did I get?">' +
      [1, 2, 3, 4, 5, 6, 7].map(function (k) { return '<button class="ftile" role="radio" aria-checked="' + (dr.flat === k) + '" aria-label="' + cap(levelLabel(k)) + '" data-act="d" data-k="flat" data-v="' + k + '">' + mini(k) + "<span>" + k + "</span></button>"; }).join("") +
      '</div><div class="fends"><span>Not flat at all</span><span>Completely flat</span></div></div>' +
      '<div class="actions"><button class="btn" data-act="savestory"' + (dr.flat ? "" : " disabled style=\"opacity:.45\"") + '>Save this story</button><button class="textbtn" data-act="cant">I can\'t remember</button></div></div>';
    return h;
  }

  function reflection(m, a, g, confirmed) {
    if (a.activity !== m.watch) return "Oh, I was " + VOICE[a.activity] + ", not " + VOICE[m.watch] + ". I'll remember that.";
    if (confirmed) return "I knew it.";
    if (g.stage < 2) return "";
    var fixes = [];
    if (g.due != null && a.due !== g.due) fixes.push(a.due ? "something was due" : "nothing was due");
    if (g.onTop != null && a.onTop !== g.onTop) fixes.push(a.onTop ? "I was on top of things" : "I was behind");
    if (g.stage === 3 && Math.abs(a.flat - g.flat) >= 2) fixes.push("it left me " + levelWord(a.flat));
    return fixes.length ? "Oh, so " + fixes.join(", and ") + ". I'll remember that." : "";
  }
  var CARE_ASK = { Pressure: "I think I need to breathe.", Overload: "Can we slow down first?", Effort: "I just need to rest.", Neither: "I'm fine, actually. Not every rise is stress." };
  function viewAfter(o) {
    var m = byId[o.id], a = ans(m), k = kind(!!MOVING[a.activity], a.flat);
    var CARE_ILLO = { Pressure: "breathing", Overload: "breathing", Effort: "water-and-rest" };
    var showBlob = o.reflect ? '<div class="illo-hero">' + illo("learning", 120) + "</div>" :
      CARE_ILLO[k] ? '<div class="illo-hero">' + illo(CARE_ILLO[k], 120) + "</div>" : blob(a.flat, { f: 1.6, box: 170, boxH: 150 });
    var h = '<div class="backdrop"></div><div class="sheet" role="dialog" aria-label="The blob"><div class="grab"></div><div style="display:flex;justify-content:center">' + showBlob + "</div>";
    if (o.reflect) h += '<p class="vig" style="font-weight:500">' + esc(o.reflect) + "</p>";
    h += '<h2 style="margin-top:14px">' + CARE_ASK[k] + "</h2><div style=\"height:16px\"></div>";
    if (k === "Neither") h += '<button class="btn" data-act="afternext">' + (o.last ? "Back to its day" : "Next story") + "</button>";
    else h += '<button class="btn" data-go="#care/' + m.id + '">' + (k === "Effort" ? "Okay, let's rest" : k === "Overload" ? "Let's slow down" : "Breathe with me") + '</button><button class="textbtn" data-act="afternext">Not now</button>';
    return h + "</div>";
  }

  // ---------- care ----------
  var careRun = null;
  function viewCare(id) {
    var m = byId[id], k = m ? kind(!!MOVING[ans(m).activity], ans(m).flat) : "Pressure", lv = m ? ans(m).flat : 4;
    var title = k === "Effort" ? "Rest with me" : "Breathe with me";
    var sub = k === "Effort" ? "Have some water, stretch, or sit for a minute. No need to soothe anything." : k === "Overload" ? "Let's just pause for a moment first." : "In for 4, out for 6. Follow my shape.";
    return '<div class="screen"><div class="care"><div class="dhead"><button class="back" data-act="careexit" aria-label="Not now">' + ICON.back + "</button><span></span><span></span></div>" +
      '<div class="ob-blob" id="careblob">' + blob(lv, { f: 2.4, state: k === "Effort" ? "wait" : "breathe", pal: "sage", box: 300 }) + "</div>" +
      "<h1>" + title + '</h1><p class="small" style="margin-top:8px">' + sub + '</p><p class="cue" id="cue" aria-live="polite" style="margin-top:20px"></p>' +
      '<p class="bpm" id="bpm"></p><button class="btn" data-act="caredone" id="caredone">I\'m done</button><button class="textbtn" data-act="careexit">Not now</button></div></div>';
  }
  function startCare(id) {
    stopCare();
    var m = byId[id], k = m ? kind(!!MOVING[ans(m).activity], ans(m).flat) : "Pressure", rest = m ? m.day.rhr : todayDay().rhr;
    var start = m ? m.bpm - 6 : rest + 22, t0 = Date.now(), total = k === "Effort" ? 30000 : 60000, pause = k === "Overload" ? 5000 : 0;
    var cue = document.getElementById("cue"), bpm = document.getElementById("bpm");
    careRun = { id: id, k: k, start: start, rest: rest, t0: t0, total: total + pause, timer: setInterval(tick, 250), settled: false };
    function tick() {
      var t = Date.now() - t0, frac = Math.min(1, Math.max(0, t - pause) / total);
      var now = Math.round(rest + 4 + (start - rest - 4) * Math.exp(-3 * frac));
      careRun.bpmNow = now;
      if (bpm) bpm.innerHTML = "My heart <b>" + now + "</b> bpm · resting " + Math.round(rest);
      if (cue) {
        if (k === "Effort") cue.textContent = "Resting…";
        else if (t < pause) cue.textContent = "Pause…";
        else cue.textContent = ((t - pause) % 10000) < 4000 ? "Breathe in" : "Breathe out";
      }
      if (t >= careRun.total) finishCare(true);
    }
    if (k !== "Effort" && pause) {
      // the pacer starts after the pause
      var cb = document.querySelector("#careblob .bstage");
      if (cb) { cb.classList.remove("st-breathe"); cb.classList.add("st-wait"); setTimeout(function () { if (cb) { cb.classList.remove("st-wait"); cb.classList.add("st-breathe"); } }, pause); }
    }
    tick();
  }
  function stopCare() { if (careRun) clearInterval(careRun.timer); }
  function finishCare(auto) {
    if (!careRun) return;
    stopCare();
    var r = careRun, settled = r.bpmNow - r.rest <= 10;
    careRun = null;
    var m = byId[r.id];
    if (m) { S.care[r.id] = { kind: r.k, type: r.k === "Effort" ? "rest" : "breathe", from: r.start, to: r.bpmNow, settled: settled }; save(); }
    var lv = m ? ans(m).flat : 4;
    var host = document.getElementById("careblob");
    if (host) host.innerHTML = settled ? blob(1, { f: 2.4, state: "puff", box: 300 }) : blob(lv, { f: 2.4, state: lv >= 4 ? "flat" : "wait", pal: "sage", box: 300 });
    var cue = document.getElementById("cue"), btn = document.getElementById("caredone");
    if (cue) cue.textContent = settled ? "I feel rounder already." : "That's okay, I'm still a bit flat.";
    if (btn) { btn.textContent = m ? (nextStory(m.day) ? "Next story" : "Back to its day") : "Done"; btn.setAttribute("data-act", "careexit"); }
    var nn = document.querySelector(".care .textbtn"); if (nn) nn.hidden = true;
  }

  // ---------- journal ----------
  var openGroups = {};
  function vcard(m) {
    var a = ans(m), f = factors(m), line = anchorLine(m);
    return '<li><button class="vcard" data-go="#story/' + m.id + '">' + tileFor(m, 60) + '<span class="grow"><span class="vmeta">' + ampm(m.peakMin) + " · " + esc(activityOf(m)) + '</span><span class="vtext">' + esc(vignette(m)) + "</span>" +
      (line ? '<span class="vline">' + esc(line) + "</span>" : "") + (!a ? '<span class="helpme">Help me with this one</span>' : "") + "</span>" +
      (f.flat ? '<span class="vblob" aria-hidden="true">' + blob(f.flat, { f: 0.8, still: true, noSphere: true, box: 52, boxH: 52 }) + "</span>" : "") + "</button></li>";
  }
  // 3 or more answered moments with identical factors within 3 hours say the same thing, so they become one card
  function groupsOf(list) {
    var by = {}, out = [], used = {};
    list.forEach(function (m) { var f = factors(m); if (!f.flat) return; var k = [f.moving, f.due, f.behind, f.high].join(); (by[k] = by[k] || []).push(m); });
    Object.keys(by).forEach(function (k) { var g = by[k]; if (g.length >= 3 && g[g.length - 1].peakMin - g[0].peakMin <= 180) { out.push(g); g.forEach(function (m) { used[m.id] = true; }); } });
    return { groups: out, used: used };
  }
  function groupCard(g) {
    var f = factors(g[0]), longs = g.filter(function (m) { return factors(m).long; }).length, flats = g.map(function (m) { return factors(m).flat; });
    var same = flats.every(function (x) { return x === flats[0]; }), id = g[0].id, open = openGroups[id];
    var text = episode(f.time, g[0].date) + ", I was " + (f.moving ? "on the move" : "sitting still") + " for " + (longs * 2 >= g.length ? "most of an hour" : "a little while") + ", again and again: " +
      g.length + " times my heart " + (f.high ? "started racing" : "picked up") + ". " + dueS(f.due) + " " + topS(f.behind) + (same ? " It left me " + levelWord(flats[0]) + " each time." : " It left me between " + levelWord(Math.min.apply(null, flats)) + " and " + levelWord(Math.max.apply(null, flats)) + ".");
    return '<li class="vgroup"><div class="vcard">' + tileFor(g[0], 60) + '<span class="grow"><span class="vmeta">' + ampm(g[0].peakMin) + "–" + ampm(g[g.length - 1].peakMin) + '</span><span class="vtext">' + esc(text) + "</span>" +
      '<button class="seeall" data-act="grp" data-k="' + id + '" aria-expanded="' + !!open + '">' + (open ? "Hide them" : "See all " + g.length) + "</button></span>" +
      '<span class="vblob" aria-hidden="true">' + blob(level(mean(flats)), { f: 0.8, still: true, noSphere: true, box: 52, boxH: 52 }) + "</span></div>" +
      (open ? '<ul class="rows sub">' + g.map(vcard).join("") + "</ul>" : "") + "</li>";
  }
  function viewStories() {
    var h = '<div class="screen with-tabs"><p class="date">Its stories</p><h1 class="title">Journal</h1>';
    DAYS.slice().reverse().forEach(function (d) {
      var list = storiesOf(d).sort(function (a, b) { return a.peakMin - b.peakMin; });
      if (!list.length) return;
      var gr = groupsOf(list), shown = {};
      h += '<div class="group"><h2>' + (d.date === TODAY ? "Tonight" : shortDate(d.date)) + "</h2>" + (d.context ? '<span class="chip ctx">' + esc(d.context) + "</span>" : "") + '<ul class="rows">' +
        list.map(function (m) {
          if (!gr.used[m.id]) return vcard(m);
          var g = gr.groups.filter(function (x) { return x.indexOf(m) >= 0; })[0];
          if (shown[g[0].id]) return ""; shown[g[0].id] = true; return groupCard(g);
        }).join("") + "</ul></div>";
    });
    return h + "</div>" + tabbar("stories");
  }

  // ---------- practice stories (the anchors) ----------
  function viewPractice() {
    var h = '<div class="screen"><div class="dhead"><button class="back" data-go="#learned" aria-label="Back">' + ICON.back + '</button><span></span><span></span></div>' +
      '<h1 class="title" style="margin-top:8px">My practice stories</h1><p class="lede">The same made-up afternoon, eight ways. How flat each one leaves me helps me read my real days.</p>';
    ANCHORS.forEach(function (c) {
      var v = anchorFlat(c.key);
      h += '<section class="card anchor"><div class="anc-top"><span class="vtile" style="width:60px;height:60px">' + illo(c.moving ? "walking-somewhere" : "sitting-working", 56) +
        (c.due ? '<img class="badge-c tr" src="illo/badge-due.svg" width="24" height="24" alt="Something was due">' : "") +
        '<img class="badge-c br" src="illo/badge-' + (c.behind ? "behind" : "on-top") + '.svg" width="24" height="24" alt="' + (c.behind ? "Behind" : "On top of things") + '"></span>' +
        '<p class="vtext">' + esc(anchorVignette(c)) + '</p></div><p class="aq">How flat did I get? <b>' + cap(levelLabel(v)) + '</b></p><div class="flats" role="radiogroup" aria-label="How flat did I get?">' +
        [1, 2, 3, 4, 5, 6, 7].map(function (k) { return '<button class="ftile" role="radio" aria-checked="' + (v === k) + '" aria-label="' + cap(levelLabel(k)) + '" data-act="anchor" data-k="' + c.key + '" data-v="' + k + '">' + mini(k) + "<span>" + k + "</span></button>"; }).join("") +
        "</div></section>";
    });
    return h + '<div style="height:32px"></div></div>';
  }

  // ---------- learned tab ----------
  function wholeOf(d) {
    var f = d.moments.filter(answered).map(function (m) { return ans(m).flat; });
    return d.whole != null ? d.whole : f.length ? Math.round(mean(f)) : null;
  }
  // each pattern states its finding, flips with the data, and shows the evidence it rests on
  function patterns() {
    var nDays = DAYS.filter(function (d) { return wholeOf(d) != null; }).length;
    var conf = function (ok, small) { return nDays < 6 || !ok ? "Needs more days" : small ? "Not sure yet" : "Starting to see it"; };
    var P = [];

    var still = [], moving = [];
    ALL.forEach(function (m) { if (answered(m)) (bodyMoving(m) ? moving : still).push(ans(m).flat); });
    var aS = mean(still), aM = mean(moving), d1 = aS - aM, c1 = conf(still.length && moving.length, Math.abs(d1) < 1);
    var tS = { illo: "sitting-working", label: "Sitting still", sub: cap(levelLabel(aS)) }, tM = { illo: "walking-somewhere", label: "Moving", sub: cap(levelLabel(aM)) };
    P.push(c1 !== "Starting to see it" ? { id: "still", conf: c1, icon: "sitting-working",
      title: "I can't tell yet whether sitting still or moving flattens me more",
      body: c1 === "Needs more days" ? "I need stories from a few more days, with some still moments and some moving ones." : "So far, sitting still and moving leave me about as flat as each other. I'll keep watching." } :
      d1 > 0 ? { id: "still", conf: c1, title: "Sitting still flattens me more than moving", tiles: [tS, tM],
        body: "When my heart raced while I was sitting still, I got about " + levelWord(aS) + ". When it raced while I was moving, I was " + levelWord(aM) + ".",
        evidence: "Based on " + plural(still.length, "still moment") + " and " + plural(moving.length, "moving one") + ".",
        so: "Before a long sit at the desk, let's move for 10 minutes first." } :
      { id: "still", conf: c1, title: "Moving flattens me more than sitting still", tiles: [tM, tS],
        body: "When my heart raced while I was moving, I got about " + levelWord(aM) + ". When it raced while I was sitting still, I was " + levelWord(aS) + ".",
        evidence: "Based on " + plural(moving.length, "moving moment") + " and " + plural(still.length, "still one") + ".",
        so: "After a big burst of moving, let's give myself a proper rest." });

    var busy = [], quiet = [];
    DAYS.forEach(function (d) { var w = wholeOf(d); if (w != null) (d.steps >= 10000 ? busy : quiet).push(w); });
    var aB = mean(busy), aQ = mean(quiet), d2 = aQ - aB, c2 = conf(busy.length && quiet.length, Math.abs(d2) < 0.8);
    var tB = { illo: "busy-day", label: "10,000+ steps", sub: cap(levelLabel(aB)) }, tQ = { illo: "quiet-day", label: "Quieter days", sub: cap(levelLabel(aQ)) };
    P.push(c2 !== "Starting to see it" ? { id: "steps", conf: c2, icon: "quiet-day",
      title: "I can't tell yet whether busy days change how flat I end up",
      body: c2 === "Needs more days" ? "I need a few more days, some busy and some quiet, before I can tell." : "Busy days and quieter days have left me about as flat as each other so far. I'll keep watching." } :
      d2 > 0 ? { id: "steps", conf: c2, title: "Busy days leave me less flat", tiles: [tB, tQ],
        body: "On days with lots of steps I ended up " + levelWord(aB) + ". On quieter days I was closer to " + levelWord(aQ) + ".",
        evidence: "Based on " + plural(busy.length + quiet.length, "day") + ".", so: "On quiet days, let's get a walk in before the evening." } :
      { id: "steps", conf: c2, title: "Busy days leave me flatter", tiles: [tB, tQ],
        body: "On days with lots of steps I ended up " + levelWord(aB) + ". On quieter days I was only " + levelWord(aQ) + ".",
        evidence: "Based on " + plural(busy.length + quiet.length, "day") + ".", so: "On big step days, let's keep the evening light." });

    var aH = [], aL = [];
    for (var i = 0; i < DAYS.length - 1; i++) { var w = wholeOf(DAYS[i]); if (w != null) (w >= 4 ? aH : aL).push(DAYS[i + 1].rhr); }
    var d3 = mean(aH) - mean(aL), beats = Math.round(Math.abs(d3)), c3 = conf(aH.length && aL.length, Math.abs(d3) < 1.5);
    var diffWords = beats === 0 ? "about the same as after light days" : "only about " + plural(beats, "beat") + " " + (d3 > 0 ? "higher" : "lower");
    P.push(c3 !== "Starting to see it" ? { id: "rhr", conf: c3, icon: "sleeping",
      title: "Heavy days don't seem to change my resting heartbeat",
      body: c3 === "Needs more days" ? "I need a few more heavy and light days before I can tell if they change my resting heartbeat the next morning." :
        "After heavy days my resting heartbeat was " + diffWords + ". That's small enough to be normal ups and downs, so I'll keep watching." } :
      { id: "rhr", conf: c3, title: d3 > 0 ? "Heavy days raise my resting heartbeat the next day" : "My resting heartbeat is lower after heavy days",
        tiles: [{ illo: "something-due", label: "After heavy days", sub: "About " + Math.round(mean(aH)) + " bpm resting" }, { illo: "sleeping", label: "After light days", sub: "About " + Math.round(mean(aL)) + " bpm resting" }],
        body: "The morning after a heavy day, my resting heartbeat was about " + plural(beats, "beat") + " " + (d3 > 0 ? "higher" : "lower") + " than after a light one.",
        evidence: "Based on " + plural(aH.length, "heavy day") + " and " + plural(aL.length, "lighter one") + ".",
        so: d3 > 0 ? "After a heavy day, let's wind down early and start the next one gently." : "Heavy days don't seem to tire my heart out, so let's not worry about one." });
    return P;
  }
  function meter(k) {
    var g = "";
    for (var j = 1; j <= 7; j++) g += '<circle cx="' + (4 + (j - 1) * 11) + '" cy="4" r="3.6" fill="' + (j <= k ? "#2d2c2b" : "#e2ded9") + '"/>';
    return '<svg class="meter" width="78" height="8" viewBox="0 0 78 8" aria-hidden="true">' + g + "</svg>";
  }
  function viewLearned() {
    var h = '<div class="screen with-tabs learned"><h1 class="title" style="margin-top:44px">Learned</h1><p class="lede">Everything I\'ve worked out from the stories you\'ve helped me with.</p>';
    var groups = ACTS.map(function (a) {
      var f = ALL.filter(function (m) { return answered(m) && activityOf(m) === a; }).map(function (m) { return ans(m).flat; });
      return { a: a, n: f.length, avg: mean(f) };
    }).filter(function (g) { return g.n >= 1; });
    h += '<section class="card"><h2 class="ltitle">What I know about myself</h2><p class="lsub">How flat I usually get doing each thing, from 1 (not flat) to 7 (completely flat).</p>' +
      (groups.length ? '<ul class="acts">' + groups.map(function (g) {
        return '<li><span class="tile t64">' + illo(ACTIVITY_ILLO[g.a], 60) + '</span><span class="grow"><b>' + g.a + '</b><span class="smoke">Usually ' + levelLabel(g.avg) + '</span>' +
          '<span class="mline">' + meter(level(g.avg)) + '<span class="cnt">' + plural(g.n, "moment") + "</span></span></span></li>";
      }).join("") + "</ul>" : '<p class="small" style="margin-top:12px">Help me with a few stories and I\'ll start to know.</p>') + "</section>";
    h += '<section class="card"><h2 class="ltitle">Patterns I\'m noticing</h2><p class="lsub">The more stories you help me with, the surer I get.</p>' + patterns().map(function (p) {
      var v = S.sugg[p.id], yes = p.conf === "Starting to see it";
      var out = '<div class="pat"><span class="pill' + (yes ? " yes" : "") + '">' + p.conf + "</span>";
      if (!p.tiles) return out + '<div class="pat-unsure">' + '<span class="tile t64">' + illo(p.icon, 60) + "</span><h3>" + p.title + "</h3></div>" +
        '<p class="pbody">' + esc(p.body) + '</p><p class="pbody" style="margin-top:8px">No suggestion yet.</p></div>';
      return out + "<h3>" + p.title + '</h3><div class="ptiles">' + p.tiles.map(function (t) {
        return '<div class="ptile">' + illo(t.illo, 88) + "<b>" + t.label + "</b><span>" + t.sub + "</span></div>";
      }).join("") + '</div><p class="pbody">' + esc(p.body) + '</p><p class="evid">' + esc(p.evidence) + '</p><p class="so"><b>So:</b> ' + esc(p.so) + "</p>" +
        '<div class="pbtns" role="group" aria-label="' + esc(p.so) + '"><button class="pbtn" aria-pressed="' + (v === "try") + '" data-act="sugg" data-k="' + p.id + '" data-v="try">Let\'s try it</button>' +
        '<button class="pbtn" aria-pressed="' + (v === "no") + '" data-act="sugg" data-k="' + p.id + '" data-v="no">Not for us</button></div></div>';
    }).join("") + "</section>";
    var cmp = ANCHORS.map(function (c) {
      var real = ALL.filter(function (m) { var f = factors(m); return f.flat && cellKey(f.moving, f.due, f.behind) === c.key; }).map(function (m) { return ans(m).flat; });
      if (real.length < 2) return "";
      var diff = mean(real) - anchorFlat(c.key), when = "When I'm " + (c.moving ? "on the move" : "sitting still") + ", " + (c.due ? "something's due" : "nothing's due") + " and I'm " + (c.behind ? "behind" : "on top of things");
      return diff >= 2 ? when + ", real days hit me harder than I guessed." : diff <= -2 ? when + ", real days are easier than I guessed." : "";
    }).filter(Boolean);
    h += '<section class="card"><h2 class="ltitle">Compared with my practice stories</h2><p class="lsub">Eight made-up afternoons I rated, so I can read my real days on the same scale.</p>' +
      (cmp.length ? cmp.map(function (l) { return '<p class="pbody">' + esc(l) + "</p>"; }).join("") : '<p class="pbody">So far my real days have felt about how my practice stories said they would.</p>') +
      '<div style="height:14px"></div><button class="btn ghost-btn" data-go="#practice">See my practice stories</button></section>';
    var helped = {};
    Object.keys(S.care).forEach(function (id) { var c = S.care[id]; (helped[c.kind] = helped[c.kind] || { n: 0, ok: 0, type: c.type }).n++; if (c.settled) helped[c.kind].ok++; });
    var lines = Object.keys(helped).map(function (k) {
      var x = helped[k], what = x.type === "rest" ? "A rest" : "Slow breathing";
      return x.ok ? what + " puffs me back up after " + k.toLowerCase() + "." : what + " hasn't puffed me back up after " + k.toLowerCase() + " yet.";
    });
    h += '<section class="card"><h2 class="ltitle">What helps me</h2>' + (lines.length ? lines.map(function (l) { return '<p style="margin-top:10px">' + esc(l) + "</p>"; }).join("") :
      '<p class="lsub">When I ask for a little care, I\'ll remember what helped.</p>') + "</section>";
    return h + "</div>" + tabbar("learned");
  }

  // ---------- blob tab ----------
  function viewBlobTab() {
    var lv = todayLevel(), mine = ALL.filter(answered);
    var kinds = { Pressure: [], Overload: [], Effort: [], Neither: [] };
    mine.forEach(function (m) { kinds[kind(isMoving(m), ans(m).flat)].push(m); });
    var h = '<div class="screen with-tabs"><p class="date">About the blob</p><h1 class="title">The blob</h1>' +
      '<div style="display:flex;justify-content:center;margin-top:8px">' + blob(lv, { f: 2.4, box: 280, label: "The blob" }) + "</div>" +
      '<section class="card"><h2 class="section">My feelings so far</h2><p class="small" style="margin-top:4px">Every moment you helped me with, at how flat I got.</p>';
    Object.keys(kinds).forEach(function (k) {
      var list = kinds[k];
      h += '<div class="kindrow" style="margin-top:12px"><b>' + k + '</b><span class="smoke">' + list.length + "</span></div>" +
        (list.length ? '<div class="collection">' + list.slice(-10).map(function (m) { return '<button data-go="#story/' + m.id + '" aria-label="' + esc(shortDate(m.date) + ", " + ampm(m.peakMin) + ", " + levelLabel(ans(m).flat)) + '">' + mini(ans(m).flat) + "</button>"; }).join("") + "</div>" : "");
    });
    h += '</section><section class="card"><h2 class="section">My blob</h2><p class="small" style="margin-top:4px">Change its colour and background any time.</p>' + lookPicker() + '</section>' +
      '<section class="card"><h2 class="section">Breathe with me</h2><p class="small" style="margin-top:4px">A minute of slow breathing, any time.</p><div style="height:14px"></div><button class="btn" data-go="#care/free">Breathe with me</button></section>';
    return h + "</div>" + tabbar("blob");
  }

  // ---------- render ----------
  function render() {
    stopCare();
    var r = route(), html;
    if (r.name === "intro") html = viewOnboarding(0);
    else if (/^step[1-6]$/.test(r.name)) html = viewOnboarding(+r.name.slice(4));
    else if (r.name === "story") html = viewStory(r.arg);
    else if (r.name === "care") html = viewCare(r.arg);
    else if (r.name === "stories") html = viewStories();
    else if (r.name === "practice") html = viewPractice();
    else if (r.name === "learned") html = viewLearned();
    else if (r.name === "blob") html = viewBlobTab();
    else html = viewHome();
    if (overlay && overlay.type === "popup") html += viewPopup(byId[overlay.id]);
    if (overlay && overlay.type === "after") html += viewAfter(overlay);
    app.innerHTML = html;
    if (obDir) { var ob = app.querySelector(".ob"); if (ob) ob.classList.add("in-" + obDir); obDir = ""; }
    if (r.name === "care") startCare(r.arg);
    if (r.name === "home" && S.onboarded && !S.popupSeen && !overlay) {
      var n = nextStory();
      if (n) { S.popupSeen = true; save(); setTimeout(function () { if (route().name === "home") { overlay = { type: "popup", id: n.id }; render(); } }, 900); }
    }
  }
  function rerenderKeepScroll() {
    var sc = app.querySelector(".screen"), top = sc ? sc.scrollTop : 0;
    render();
    sc = app.querySelector(".screen"); if (sc) sc.scrollTop = top;
  }

  function afterSave(m) {
    var list = storiesOf(m.day), i = list.indexOf(m);
    var next = list.slice(i + 1).filter(function (x) { return !ans(x); })[0] || list.filter(function (x) { return !ans(x); })[0];
    return next;
  }

  app.addEventListener("click", function (ev) {
    var el = ev.target.closest("[data-go],[data-act]");
    if (!el) return;
    var go_ = el.getAttribute("data-go");
    if (go_) { overlay = null; draft = {}; go(go_); return; }
    var act = el.getAttribute("data-act"), v = el.getAttribute("data-v"), k = el.getAttribute("data-k");
    var r = route();
    if (act === "ob") {
      var i = +v;
      if (i === 6) { S.onboarded = true; save(); go("#home"); } else go("#step" + (i + 1));
    } else if (act === "look") {
      S.look[k] = v; save();
      var sc0 = app.querySelector(".screen"), top0 = sc0 ? sc0.scrollTop : 0;
      render(); sc0 = app.querySelector(".screen"); if (sc0) sc0.scrollTop = top0;
    } else if (act === "read") {
      var n = nextStory(); if (n) { overlay = { type: "popup", id: n.id }; render(); }
    } else if (act === "close") { overlay = null; render(); }
    else if (act === "d") {
      draft[k] = JSON.parse(v);
      if (k === "flat") { var host = document.getElementById("dblob"); if (host) host.innerHTML = blob(draft.flat, { f: 2.2, pal: "dusk", box: 300, boxH: 260, label: "The blob, " + levelLabel(draft.flat) }); }
      var sc = app.querySelector(".screen"), top = sc.scrollTop, blobHtml = document.getElementById("dblob").innerHTML;
      app.innerHTML = viewStory(r.arg);
      document.getElementById("dblob").innerHTML = blobHtml;
      app.querySelector(".screen").scrollTop = top;
    } else if (act === "savestory" || act === "cant") {
      var m = byId[r.arg], dr = draftFor(m), g = dr.guess;
      if (act === "savestory" && !dr.flat) return;
      S.answers[m.id] = act === "cant"
        ? { activity: dr.activity, fitbitGuess: m.watch, corrected: dr.activity !== m.watch, due: null, onTop: null, flat: null, cantRemember: true }
        : { activity: dr.activity, fitbitGuess: m.watch, corrected: dr.activity !== m.watch, due: dr.due, onTop: dr.onTop, flat: dr.flat, cantRemember: false };
      save(); draft = {};
      if (act === "cant") { var nx = afterSave(m); go(nx ? "#story/" + nx.id : "#home"); return; }
      overlay = { type: "after", id: m.id, reflect: reflection(m, S.answers[m.id], g), last: !afterSave(m) };
      render();
    } else if (act === "confirm") {
      var mc = byId[r.arg], dc = draftFor(mc), gc = dc.guess;
      S.answers[mc.id] = { activity: dc.activity, fitbitGuess: mc.watch, corrected: dc.activity !== mc.watch, due: gc.due, onTop: gc.onTop, flat: gc.flat, cantRemember: false, confirmed: true };
      save(); draft = {};
      overlay = { type: "after", id: mc.id, reflect: reflection(mc, S.answers[mc.id], gc, dc.activity === mc.watch), last: !afterSave(mc) };
      render();
    } else if (act === "notthis") {
      var dn = draftFor(byId[r.arg]); dn.open = true; dn.due = dn.guess.due; dn.onTop = dn.guess.onTop; rerenderKeepScroll();
    } else if (act === "grp") { openGroups[k] = !openGroups[k]; rerenderKeepScroll(); }
    else if (act === "anchor") { S.anchors[k] = +v; save(); rerenderKeepScroll(); }
    else if (act === "afternext") {
      var mm = byId[overlay.id]; overlay = null;
      var nx2 = afterSave(mm); go(nx2 ? "#story/" + nx2.id : "#home");
    } else if (act === "storyback") { draft = {}; go("#home"); }
    else if (act === "caredone") finishCare(false);
    else if (act === "careexit") {
      var id = r.arg, m3 = byId[id]; stopCare(); careRun = null;
      var nx3 = m3 && afterSave(m3);
      go(nx3 ? "#story/" + nx3.id : id === "free" ? "#blob" : "#home");
    } else if (act === "sugg") { S.sugg[k] = S.sugg[k] === v ? null : v; save(); rerenderKeepScroll(); }
  });
  // swipe through the intro: left for next, right for back (touch, or a mouse drag on a laptop)
  var swipe = null, obDir = "";
  function obIndex() { var n = route().name; return n === "intro" ? 0 : /^step[1-6]$/.test(n) ? +n.slice(4) : -1; }
  app.addEventListener("pointerdown", function (e) {
    if (obIndex() < 0 || e.target.closest("button")) return;
    swipe = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener("pointerup", function (e) {
    if (!swipe) return;
    var dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    var i = obIndex();
    if (dx < 0) { obDir = "next"; if (i === 6) { S.onboarded = true; save(); go("#home"); } else go("#step" + (i + 1)); }
    else if (i > 0) { obDir = "prev"; go(i === 1 ? "#intro" : "#step" + (i - 1)); }
  });
  window.addEventListener("pointercancel", function () { swipe = null; });

  // tap the blob and it jumps
  app.addEventListener("pointerdown", function (e) {
    var st = e.target.closest(".bstage"); if (!st || st.classList.contains("static")) return;
    var svg = st.querySelector(".bsvg"); if (!svg) return;
    svg.classList.remove("jump"); void svg.getBoundingClientRect(); svg.classList.add("jump");
  });
  app.addEventListener("animationend", function (e) { if (e.animationName === "jump") e.target.classList.remove("jump"); });

  window.addEventListener("hashchange", function () { overlay = null; render(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && overlay && overlay.type === "popup") { overlay = null; render(); } });

  // expose for testing in the console
  window.__blob = { S: S, selfGuess: selfGuess, vignette: vignette, byId: byId, ALL: ALL };
  render();
})();
