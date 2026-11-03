(function () {
  "use strict";

  var DATA = window.POE_DATA;
  var DAYS = DATA.days;
  var KEY = "poe-live-v1";
  var ROUTES = ["welcome", "setup", "today", "review", "stories", "headspace", "blob"];

  // ---------- state ----------
  var S = load();
  function blank() {
    return { done: false, step: 0, story: 0, tryLevel: 4, day: DAYS[DAYS.length - 1].date, mi: 0,
      stories: {}, fb: {}, m: {}, whole: {}, guess: {}, match: {}, sugg: {} };
  }
  function load() {
    var s = blank();
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        for (var k in saved) if (k in s) s[k] = saved[k];
      }
    } catch (e) { /* storage blocked: run without it */ }
    if (!dayBy(s.day)) s.day = DAYS[DAYS.length - 1].date;
    return s;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
  }

  // ---------- effective answers (user answer over example answer) ----------
  function dayBy(date) { for (var i = 0; i < DAYS.length; i++) if (DAYS[i].date === date) return DAYS[i]; return null; }
  function mKey(d, i) { return d.date + "#" + i; }
  function ans(d, i) {
    var r = d.rises[i], u = S.m[mKey(d, i)] || {};
    return {
      due: "due" in u ? u.due : r.answer.due,
      onTop: "onTop" in u ? u.onTop : r.answer.onTop,
      pressure: "pressure" in u ? u.pressure : r.answer.pressure,
      cant: "cant" in u ? u.cant : r.cantRemember,
      act: u.act
    };
  }
  function whole(d) { return S.whole[d.date] != null ? S.whole[d.date] : d.whole; }
  function guess(d) { return S.guess[d.date] != null ? S.guess[d.date] : d.guess; }
  function match(d) { return S.match[d.date] != null ? S.match[d.date] : d.match; }
  function story(i) {
    var s = DATA.stories[i], u = S.stories[i] || {};
    return { due: s.due, behind: s.behind, moving: s.moving,
      blob: u.blob != null ? u.blob : s.blob, you: u.you != null ? u.you : s.you };
  }
  function kind(moving, p) {
    if (moving) return p >= 4 ? "Overload" : "Effort";
    return p >= 4 ? "Pressure" : "Neither";
  }
  var KIND_COLOR = { Overload: "var(--pink)", Effort: "var(--orange)", Pressure: "var(--plum)", Neither: "var(--line)" };
  function usable(d) {
    var out = [];
    d.rises.forEach(function (r, i) {
      var a = ans(d, i);
      if (!a.cant && a.pressure != null) out.push({ r: r, a: a, i: i });
    });
    return out;
  }

  // ---------- helpers ----------
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : 0; }
  function f1(x) { return (Math.round(x * 10) / 10).toFixed(1); }
  function signed(x) { var v = Math.round(x * 10) / 10; return (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1); }
  function asDate(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  var WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MO = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function longDate(s) { var d = asDate(s); return WD[d.getDay()] + " " + d.getDate() + " " + MO[d.getMonth()]; }
  function shortDate(s) { var d = asDate(s); return d.getDate() + " " + MO[d.getMonth()].slice(0, 3); }
  function fmtTime(min) {
    min = ((min % 1440) + 1440) % 1440;
    var h = Math.floor(min / 60), m = min % 60, ap = h < 12 ? "am" : "pm", hh = h % 12 || 12;
    return hh + (m ? ":" + (m < 10 ? "0" : "") + m : "") + ap;
  }
  function duration(mins) {
    if (mins >= 90) { var h = Math.round(mins / 30) / 2; return "about " + h + " hours"; }
    return mins + " minutes";
  }

  // ---------- blob + scale ----------
  var BLOB_PATH = "M50 4C78 4 96 24 96 52C96 76 90 86 50 86C10 86 4 76 4 52C4 24 22 4 50 4Z";
  function dims(k, f) { k = k || 1; return { w: (40 + (k - 1) * 7) * f, h: (56 - (k - 1) * 5.8) * f }; }
  function blob(k, f, label) {
    var d = dims(k, f);
    return '<svg class="blob-anim" width="' + d.w.toFixed(1) + '" height="' + d.h.toFixed(1) + '" viewBox="0 0 100 90" preserveAspectRatio="none"' +
      (label ? ' role="img" aria-label="' + esc(label) + '"' : ' aria-hidden="true"') + '><path class="blob-shape" d="' + BLOB_PATH + '"/></svg>';
  }
  function scale(key, value, f, label) {
    f = f || 1;
    var h = '<div class="scale-wrap"><div class="scale" role="radiogroup" aria-label="' + esc(label) + '" data-key="' + key + '">';
    for (var k = 1; k <= 7; k++) {
      var on = value === k;
      h += '<button type="button" class="scale-opt" role="radio" aria-checked="' + on + '" tabindex="' + (on || (value == null && k === 1) ? 0 : -1) +
        '" aria-label="' + k + ' of 7" data-act="set" data-key="' + key + '" data-v="' + k + '" data-fid="' + key + ':' + k + '">' +
        blob(k, f) + "<span>" + k + "</span></button>";
    }
    return h + '</div><div class="scale-ends" aria-hidden="true"><span>1 · Not flat at all</span><span>7 · Completely flattened</span></div></div>';
  }
  function yesNo(key, value, label) {
    return '<div class="pills" role="radiogroup" aria-label="' + esc(label) + '">' +
      [[true, "Yes"], [false, "No"]].map(function (o) {
        return '<button type="button" class="pill" role="radio" aria-checked="' + (value === o[0]) + '" data-act="set" data-key="' + key +
          '" data-v="' + (o[0] ? 1 : 0) + '" data-fid="' + key + ':' + o[0] + '">' + o[1] + "</button>";
      }).join("") + "</div>";
  }

  // ---------- badges ----------
  var BADGE = {
    due: '<svg class="badge" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="20" fill="#f47d31"/><path d="M13 10h10l5 5v15H13z" fill="#fff"/><path d="M23 10v5h5" fill="none" stroke="#f47d31" stroke-width="1.5"/><path d="M16 20h9M16 24h9" stroke="#f47d31" stroke-width="1.8" stroke-linecap="round"/></svg>',
    behind: '<svg class="badge" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="20" fill="#5f2b89"/><circle cx="20" cy="20" r="10" fill="none" stroke="#fff" stroke-width="2.4"/><path d="M20 14v6l4 3" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    moving: '<svg class="badge" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="20" fill="#00a4ff"/><ellipse cx="15" cy="17" rx="3.6" ry="6" fill="#fff" transform="rotate(-12 15 17)"/><ellipse cx="25" cy="23" rx="3.6" ry="6" fill="#fff" transform="rotate(12 25 23)"/><circle cx="14" cy="26.5" r="2.2" fill="#fff"/><circle cx="26" cy="32" r="2.2" fill="#fff"/></svg>'
  };

  // ---------- scenes ----------
  function sceneBlob(k, cx, baseY, f) {
    var d = dims(k, f);
    return '<svg x="' + (cx - d.w / 2).toFixed(1) + '" y="' + (baseY - d.h).toFixed(1) + '" width="' + d.w.toFixed(1) + '" height="' + d.h.toFixed(1) +
      '" viewBox="0 0 100 90" preserveAspectRatio="none"><path d="' + BLOB_PATH + '" fill="#ffce00"/></svg>';
  }
  function deskScene(k, label) {
    return '<div class="scene"><svg viewBox="0 0 400 240" role="img" aria-label="' + esc(label || "The blob at its desk at night") + '">' +
      '<rect x="236" y="26" width="128" height="100" rx="10" fill="#281466"/>' +
      '<path d="M300 26v100M236 76h128" stroke="#0061ef" stroke-width="5"/>' +
      '<circle cx="336" cy="50" r="13" fill="#ffce00"/>' +
      sceneBlob(k, 186, 196, 2.3) +
      '<rect x="40" y="170" width="320" height="16" rx="6" fill="#fff"/>' +
      '<rect x="62" y="186" width="12" height="54" fill="#fff"/><rect x="326" y="186" width="12" height="54" fill="#fff"/>' +
      '<path d="M150 170l8-40h70l8 40z" fill="#2d2c2b"/><rect x="138" y="166" width="110" height="5" rx="2" fill="#44423f"/>' +
      '<path d="M84 170v-44l22-22" fill="none" stroke="#2d2c2b" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M96 96l30 6-12 22z" fill="#f47d31"/><rect x="70" y="166" width="28" height="6" rx="3" fill="#2d2c2b"/>' +
      "</svg></div>";
  }
  function trayScene(k, label) {
    var bd = dims(k, 2.5), tx = 150 + bd.w / 2 - 26, ty = 216 - bd.h * 0.62;
    return '<div class="scene"><svg viewBox="0 0 400 240" role="img" aria-label="' + esc(label || "The blob on its feet, carrying a tray") + '">' +
      '<rect x="0" y="214" width="400" height="26" fill="#0052cc"/>' +
      sceneBlob(k, 150, 216, 2.5) +
      '<circle cx="330" cy="62" r="26" fill="#f47d31"/>' +
      '<g transform="translate(' + (tx - 206).toFixed(1) + " " + (ty - 120).toFixed(1) + ')">' +
      '<rect x="206" y="120" width="150" height="10" rx="5" fill="#fff"/>' +
      '<ellipse cx="244" cy="114" rx="26" ry="7" fill="#fff" stroke="#e2ded9" stroke-width="2"/>' +
      '<ellipse cx="300" cy="114" rx="22" ry="6" fill="#fff" stroke="#e2ded9" stroke-width="2"/>' +
      '<path d="M330 82h16l-3 38h-10z" fill="#ffa1cc"/></g>' +
      "</svg></div>";
  }
  function scene(moving, k, label) { return moving ? trayScene(k, label) : deskScene(k, label); }

  // ---------- heart-rate chart ----------
  function hrChart(d, from, to, opts) {
    opts = opts || {};
    var W = opts.w || 1000, H = opts.h || 300, L = 36, R = 12, T = 22, B = 30;
    var x = function (m) { return L + (m - from) / (to - from) * (W - L - R); };
    var y = function (b) { return T + (1 - (Math.max(40, Math.min(180, b)) - 40) / 140) * (H - T - B); };
    var pts = d.series.filter(function (p) { return p[0] >= from - 5 && p[0] <= to; });
    var g = "";
    [64, 100, 140].forEach(function (b) {
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(b) + '" y2="' + y(b) + '" stroke="var(--line)"/>' +
        '<text x="' + (L - 6) + '" y="' + (y(b) + 4) + '" text-anchor="end">' + b + "</text>";
    });
    g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(d.rhr) + '" y2="' + y(d.rhr) + '" stroke="var(--plum)" stroke-width="1.5" stroke-dasharray="5 5"/>';
    // steps
    var bh = (H - T - B) * 0.22, bw = Math.max(1.5, (W - L - R) / ((to - from) / 5) * 0.6);
    pts.forEach(function (p) {
      if (!p[2]) return;
      var hgt = Math.min(p[2], 700) / 700 * bh;
      g += '<rect x="' + (x(p[0]) - bw / 2).toFixed(1) + '" y="' + (H - B - hgt).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + hgt.toFixed(1) + '" fill="var(--sky)" opacity="' + (p[3] ? 0.35 : 0.8) + '" rx="1"/>';
    });
    // line, split into real and filled runs
    var runs = [], cur = null;
    pts.forEach(function (p, i) {
      if (p[1] == null) { cur = null; return; }
      if (!cur || cur.f !== p[3]) {
        var prev = cur && cur.pts[cur.pts.length - 1];
        cur = { f: p[3], pts: prev ? [prev] : [] };
        runs.push(cur);
      }
      cur.pts.push(p);
    });
    runs.forEach(function (run) {
      var dd = run.pts.map(function (p, i) { return (i ? "L" : "M") + x(p[0]).toFixed(1) + " " + y(p[1]).toFixed(1); }).join("");
      g += run.f
        ? '<path d="' + dd + '" fill="none" stroke="var(--muted)" stroke-width="1.6" stroke-dasharray="4 4" opacity="0.55"/>'
        : '<path d="' + dd + '" fill="none" stroke="var(--ink)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>';
    });
    // moments
    var lastX = -1e9, flip = false;
    d.rises.forEach(function (r, i) {
      if (r.peakMin < from || r.peakMin > to) return;
      var cx = x(r.peakMin), cy = y(r.bpm), c = r.moving ? "var(--orange)" : "var(--plum)";
      var sel = opts.sel === i;
      flip = cx - lastX < 60 ? !flip : false;
      lastX = cx;
      var ly = flip ? cy + 26 : cy - 14;
      g += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (sel ? 9 : 7) + '" fill="' + c + '" stroke="var(--card)" stroke-width="3"/>' +
        '<text x="' + cx + '" y="' + ly + '" text-anchor="middle" style="fill:var(--ink);font-weight:700;paint-order:stroke;stroke:var(--card);stroke-width:4px">' + fmtTime(r.peakMin) + "</text>";
    });
    // ticks
    var ticks = opts.ticks || [0, 360, 720, 1080, 1440];
    ticks.forEach(function (m) {
      var lab = m === 720 ? "noon" : fmtTime(m);
      g += '<text x="' + x(m) + '" y="' + (H - 8) + '" text-anchor="middle">' + lab + "</text>";
    });
    return '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(opts.label) + '">' + g + "</svg>";
  }
  function legend() {
    return '<div class="legend"><span><i class="lg-bar"></i>Steps</span>' +
      '<span><i class="sw" style="background:var(--orange)"></i>Heart raced while moving</span>' +
      '<span><i class="sw" style="background:var(--plum)"></i>Heart raced while still</span>' +
      '<span><i class="lg-dash"></i>Missing from the export, filled from a usual day</span></div>';
  }

  // ---------- learning ----------
  function links() {
    var still = [], moving = [];
    DAYS.forEach(function (d) { usable(d).forEach(function (u) { (u.r.moving ? moving : still).push(u.a.pressure); }); });
    var l1 = { diff: mean(still) - mean(moving), n: still.length + moving.length, thr: 1,
      name: "Sitting still vs moving",
      text: "When its heart raced while it sat still, you said it felt " + f1(mean(still)) + "/7. When it raced while moving, " + f1(mean(moving)) + "/7." };

    var hi = [], lo = [], xs = [], ys = [];
    DAYS.forEach(function (d) {
      var w = whole(d); if (w == null) return;
      (d.steps >= 10000 ? hi : lo).push(w); xs.push(d.steps); ys.push(w);
    });
    var l2 = { diff: mean(lo) - mean(hi), n: hi.length + lo.length, thr: 0.8, r: pearson(xs, ys),
      name: "Steps and the whole day",
      text: "On days with 10,000+ steps, the blob ended up " + f1(mean(hi)) + "/7. On quieter days, " + f1(mean(lo)) + "/7." };

    var heavy = DAYS.filter(function (d) { return whole(d) >= 4; });
    var dd = mean(heavy.map(function (d) { return whole(d) - guess(d); }));
    var all = mean(DAYS.map(function (d) { return Math.abs(whole(d) - guess(d)); }));
    var l3 = { diff: dd, n: heavy.length * 2, thr: 1, name: "Your guesses for it",
      text: "On heavier days, your morning guess for the blob was " + f1(dd) + " points too low. Across all days, " + f1(all) + " off." };

    var aH = [], aL = [];
    for (var i = 0; i < DAYS.length - 1; i++) {
      var w = whole(DAYS[i]);
      if (w >= 4) aH.push(DAYS[i + 1].rhr); else if (w <= 2) aL.push(DAYS[i + 1].rhr);
    }
    var l4 = { diff: mean(aH) - mean(aL), n: aH.length + aL.length, thr: 1.5, name: "Its resting heartbeat the next day",
      text: "After heavy days, the blob's resting heartbeat was " + f1(mean(aH)) + " bpm. After light days, " + f1(mean(aL)) + " bpm." };
    if (!aH.length || !aL.length) l4.n = 0;

    var titles = [
      "Before a long sit at the desk tonight, let's move for 10 minutes first.",
      "On days when something's due, let's fit in a walk, not just desk time.",
      "Busy days catch us both out. When something's due, let's keep the evening light.",
      "After a heavy day, let's start the next one gently. Your heart is still catching up."
    ];
    return [l1, l2, l3, l4].map(function (l, i) {
      l.id = "s" + (i + 1); l.title = titles[i];
      l.chip = l.n < 6 ? "Needs more days" : Math.abs(l.diff) < l.thr ? "Not sure yet" : "Starting to see it";
      l.ok = l.chip === "Starting to see it" && l.diff > 0;
      return l;
    });
  }
  function pearson(xs, ys) {
    var mx = mean(xs), my = mean(ys), a = 0, b = 0, c = 0;
    for (var i = 0; i < xs.length; i++) { a += (xs[i] - mx) * (ys[i] - my); b += Math.pow(xs[i] - mx, 2); c += Math.pow(ys[i] - my, 2); }
    return b && c ? a / Math.sqrt(b * c) : 0;
  }
  function suggestions() { return links().filter(function (l) { return l.ok; }); }

  function effects() {
    var st = DATA.stories.map(function (_, i) { return story(i); });
    function eff(f) {
      return mean(st.filter(function (s) { return s[f]; }).map(function (s) { return s.blob; })) -
        mean(st.filter(function (s) { return !s[f]; }).map(function (s) { return s.blob; }));
    }
    return { due: eff("due"), behind: eff("behind"), moving: eff("moving"),
      gap: mean(st.map(function (s) { return s.blob - s.you; })) };
  }

  // ---------- views ----------
  function viewWelcome() {
    return '<div class="wrap"><div class="two">' +
      '<div><h1>This blob shares your heartbeat. It doesn\'t know what it feels.</h1>' +
      '<p style="font-size:19px">Whenever your heart races, the blob\'s does too. It can\'t tell worry from a long shift. You can. Help it understand, and over time it will learn how your body and your headspace connect, and find small ways to look after you both.</p>' +
      '<div class="btns" style="margin:24px 0 20px"><button class="btn primary" data-act="setup" data-v="0" data-fid="w1" data-tour="w-start">Meet the blob</button>' +
      '<a class="btn ghost" href="#headspace">See its two weeks with Neel</a></div>' +
      '<p class="small">' + (DATA.synthetic ? "Shown with made-up heart rate and steps from 19 October to 1 November, and example answers." : "Shown with Neel\'s real Fitbit Air heart rate and steps from 19 October to 1 November, and example answers.") + "</p></div>" +
      '<div class="panel" style="min-height:440px" data-tour="w-blob"><div>' + blob(1, 3.6, "The blob, round and waiting") + "<p>No face. It's waiting for you to help it feel.</p></div></div>" +
      "</div></div>";
  }

  function progress(step) {
    var p = step === 2 ? (2 + S.story / 8) / 4 : (step + 1) / 4;
    if (step === 3) p = 1;
    return '<div class="progress" role="progressbar" aria-label="Setup progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(p * 100) + '"><span style="width:' + (p * 100) + '%"></span></div>';
  }
  function factorRow(icon, title, sub) {
    return '<div class="factor">' + BADGE[icon] + "<div><b>" + title + "</b>" + (sub ? '<span class="small">' + sub + "</span>" : "") + "</div></div>";
  }

  function viewSetup() {
    var step = S.step;
    if (step === 3) return '<div class="wrap">' + progress(3) + "</div>" + viewBlob(true);
    var h = '<div class="wrap">' + progress(step);
    if (step === 0) {
      h += '<div class="two"><div class="panel"><div>' + blob(1, 3, "The blob") + "<p>No face. No feelings. Yet.</p></div></div>" +
        '<div><h1>Meet the blob.</h1><p style="font-size:18px">The blob doesn\'t know how to feel. It\'s a blob.</p><h2>Will you help it?</h2>' +
        '<div class="card" style="margin:20px 0"><h3>First, a few stories from the blob\'s life</h3>' +
        factorRow("due", "Sometimes something is due", "An assessment, an exam, a deadline") +
        factorRow("behind", "Sometimes it's on top of things, sometimes it's behind", "Whether it has time and help") +
        factorRow("moving", "Sometimes it sits still, sometimes it's on its feet", "Later, your Fitbit tells it which") +
        '</div><div class="btns"><button class="btn primary" data-act="setup" data-v="1" data-fid="s0">Help the blob</button><span class="small">8 short stories · about 3 minutes</span></div></div></div>';
    } else if (step === 1) {
      h += '<div class="head" style="max-width:720px"><h1>When the blob feels pressure, it flattens.</h1>' +
        "<p>It has no face to look worried with. The more pressure it feels, the flatter it gets. This is how you'll show the blob what it's feeling.</p></div>" +
        '<div class="card" style="max-width:860px" data-tour="s-scale">' + scale("try", S.tryLevel, 1.6, "Try the flattening scale") + "</div>" +
        '<div class="btns" style="margin-top:24px"><button class="btn ghost" data-act="setup" data-v="0">Back</button>' +
        '<button class="btn primary" data-act="setup" data-v="2" data-fid="s1">Read the first story</button></div>';
    } else {
      var i = S.story, s = story(i), last = i === 7;
      h += '<div class="two" style="align-items:start"><div>' +
        '<p class="small">Story ' + (i + 1) + " of 8</p>" + scene(s.moving, s.blob) +
        '<div class="story-card" data-tour="s-story">' +
        factorRow("due", s.due ? "The blob has an assessment due tomorrow." : "The blob has nothing due this week.") +
        factorRow("moving", s.moving ? "It has been on its feet for hours." : "It has been sitting at a desk for hours.") +
        factorRow("behind", s.behind ? "It's behind, and no one can help." : "It's on top of things.") +
        "</div></div><div>" +
        '<div class="card" data-tour="s-rate"><h2>How much pressure does the blob feel?</h2>' + scale("sb:" + i, s.blob, 1, "How much pressure does the blob feel?") +
        '<h3 style="margin-top:28px">And how much would you feel, in its place?</h3>' + scale("sy:" + i, s.you, 0.8, "And how much would you feel, in its place?") + "</div>" +
        '<div class="btns" style="margin-top:20px"><button class="btn ghost" data-act="story" data-v="-1">Back</button>' +
        '<button class="btn primary" data-act="story" data-v="1" data-fid="sn">' + (last ? "See what the blob learned" : "Next story") + "</button></div>" +
        "</div></div>";
    }
    return h + "</div>";
  }

  function verdict(w) { return w >= 5 ? "A heavy day for the blob" : w >= 3 ? "A mixed day for the blob" : "A light day for the blob"; }
  function kindChips(d) {
    var c = { Overload: 0, Effort: 0, Pressure: 0, Neither: 0 };
    usable(d).forEach(function (u) { c[kind(u.r.moving, u.a.pressure)]++; });
    var out = Object.keys(c).filter(function (k) { return c[k]; }).map(function (k) {
      return '<span class="chip"><i class="sw" style="background:' + KIND_COLOR[k] + '"></i>' + c[k] + " " + k + "</span>";
    });
    return out.length ? '<div class="chips" style="margin-bottom:16px">' + out.join("") + "</div>" : "";
  }

  function viewToday() {
    var d = dayBy(S.day), w = whole(d), n = d.rises.length;
    var sug = suggestions().filter(function (l) { return S.sugg[l.id] !== "no"; })[0];
    var h = '<div class="wrap"><div class="head"><h1>' + longDate(d.date) + '</h1><p>The blob\'s calendar: ' + esc(d.context) + "</p></div>" +
      '<div class="grid"><div class="col">' +
      '<section class="card" data-tour="t-chart"><h2>' + verdict(w) + "</h2>" + kindChips(d) +
      hrChart(d, 0, 1440, { label: "The blob's heart rate across " + longDate(d.date) + ", with steps and " + n + " moments when it raced" }) + legend() + "</section>" +
      '<section class="card" data-tour="t-guess"><h2>This morning</h2><p>You guessed how much the day ahead would flatten the blob.</p>' +
      scale("guess:" + d.date, guess(d), 1, "This morning's guess") + "</section></div>" +
      '<div class="col"><section class="card" data-tour="t-stats"><div class="stats">' +
      '<div class="stat"><b>' + Math.round(d.rhr) + "</b><span>Its resting heartbeat (bpm)</span></div>" +
      '<div class="stat"><b>' + d.steps.toLocaleString("en-AU") + "</b><span>Steps</span></div>" +
      '<div class="stat"><b>' + d.nRises + "</b><span>Times its heart raced (25+ bpm over resting)</span></div>" +
      '<div class="stat"><b>' + w + "/7</b><span>How flat the day left it</span></div></div></section>";
    if (sug) {
      h += '<section class="card yellow"><h3>The blob has an idea</h3><p style="font-size:18px;font-weight:500">' + esc(sug.title) + "</p>" +
        "<details><summary>Why the blob thinks this</summary><p>" + esc(sug.text) + "</p></details></section>";
    }
    h += '<section class="card dark" data-tour="t-mark"><h3>Something just happened?</h3><p>Tap once. The blob will ask you about it tonight.</p>' +
      '<button class="btn light" data-act="mark">Mark this moment</button></section>' +
      '<section class="card"><h3>Tonight with the blob</h3><p>' + n + " moment" + (n === 1 ? "" : "s") + " to talk through · about 2 minutes</p>" +
      '<a class="btn primary" href="#review">Talk them through</a></section>' +
      "</div></div></div>";
    return h;
  }

  function momentStory(d, r) {
    return "At " + fmtTime(r.peakMin) + " the blob's heart raced to " + r.bpm + " bpm, " + Math.round(r.bpm - d.rhr) + " above its resting beat. " +
      "In the 10 minutes before, it had taken " + r.steps10 + " steps, so it " + (r.moving ? "was on the move" : "had barely moved") + ". " +
      "It lasted " + duration(r.mins) + ", and the blob didn't know what it was feeling.";
  }

  function dayMap(d) {
    var S0 = 300, P = 30, Z = S0 - P * 2;
    var xs = function (v) { return P + v * Z; }, ys = function (v) { return P + (1 - v) * Z; };
    var mx = 250 / 800, my = 0.5;
    var g = '<rect x="' + P + '" y="' + P + '" width="' + (mx * Z) + '" height="' + (my * Z) + '" fill="var(--plum-soft)"/>' +
      '<rect x="' + xs(mx) + '" y="' + P + '" width="' + ((1 - mx) * Z) + '" height="' + (my * Z) + '" fill="var(--pink-soft)"/>' +
      '<rect x="' + xs(mx) + '" y="' + ys(my) + '" width="' + ((1 - mx) * Z) + '" height="' + (my * Z) + '" fill="var(--orange-soft)"/>' +
      '<rect x="' + P + '" y="' + ys(my) + '" width="' + (mx * Z) + '" height="' + (my * Z) + '" fill="var(--bg)"/>' +
      '<text x="' + (P + 6) + '" y="' + (P + 16) + '" style="fill:var(--ink);font-weight:700">Pressure</text>' +
      '<text x="' + (S0 - P - 6) + '" y="' + (P + 16) + '" text-anchor="end" style="fill:var(--ink);font-weight:700">Overload</text>' +
      '<text x="' + (S0 - P - 6) + '" y="' + (S0 - P - 8) + '" text-anchor="end" style="fill:var(--ink);font-weight:700">Effort</text>' +
      '<text x="' + (P + 6) + '" y="' + (S0 - P - 8) + '" style="fill:var(--ink);font-weight:700">Neither</text>' +
      '<text x="' + (S0 / 2) + '" y="' + (S0 - 8) + '" text-anchor="middle">How much it was moving →</text>' +
      '<text x="12" y="' + (S0 / 2) + '" text-anchor="middle" transform="rotate(-90 12 ' + (S0 / 2) + ')">How much pressure it felt →</text>';
    usable(d).forEach(function (u) {
      var cx = xs(Math.min(1, u.r.steps10 / 800)), cy = ys((u.a.pressure - 1) / 6);
      g += '<circle cx="' + cx + '" cy="' + cy + '" r="7" fill="' + (u.r.moving ? "var(--orange)" : "var(--plum)") + '" stroke="var(--card)" stroke-width="2.5"/>' +
        '<text x="' + cx + '" y="' + (cy - 11) + '" text-anchor="middle" style="fill:var(--ink)">' + fmtTime(u.r.peakMin) + "</text>";
    });
    return '<svg class="chart" viewBox="0 0 ' + S0 + " " + S0 + '" role="img" aria-label="Day map of ' + shortDate(d.date) + ': each moment placed by how much the blob was moving and how much pressure it felt">' + g + "</svg>";
  }

  function viewReview() {
    var d = dayBy(S.day), n = d.rises.length;
    var h = '<div class="wrap"><div class="head"><h1>Tonight with the blob</h1><p>' + longDate(d.date) + " · " + n + " moment" + (n === 1 ? "" : "s") + " when its heart raced</p></div>";
    var g = guess(d), w = whole(d), right = "";
    right += '<section class="card yellow"><h3>And how did the whole day leave the blob?</h3>' + scale("whole:" + d.date, w, 0.75, "And how did the whole day leave the blob?") + "</section>";
    var cmp = w > g ? "Heavier for the blob than you guessed." : w < g ? "Lighter for the blob than you guessed." : "About what you guessed for the blob.";
    var mt = match(d), mLab = { 1: "Not at all", 5: "Exactly" };
    right += '<section class="card" data-tour="r-map"><h3>The blob\'s ' + shortDate(d.date) + "</h3>" + (n ? dayMap(d) : "") +
      '<div class="cmp"><div>' + blob(g, 1, "Your guess " + g + " of 7") + "<br>Your guess " + g + "/7</div><div>" + blob(w, 1, "How it went " + w + " of 7") + "<br>How it went " + w + "/7</div></div>" +
      '<p style="text-align:center;font-weight:500">' + cmp + "</p>" +
      '<p style="margin-top:20px;font-weight:700">Next morning: does this feel right to you?</p>' +
      '<div class="pills" role="radiogroup" aria-label="Next morning: does this feel right to you?">' +
      [1, 2, 3, 4, 5].map(function (k) {
        return '<button type="button" class="pill" role="radio" aria-checked="' + (mt === k) + '" data-act="set" data-key="match:' + d.date + '" data-v="' + k + '" data-fid="match:' + k + '">' + k + (mLab[k] ? " · " + mLab[k] : "") + "</button>";
      }).join("") + "</div></section>";

    if (!n) {
      return h + '<div class="grid"><div class="col"><section class="card" style="text-align:center;padding:48px 28px">' +
        '<div style="display:flex;justify-content:center;margin-bottom:20px">' + blob(1, 2.2, "The blob, round and calm") + "</div>" +
        "<h2>A calm day for the blob</h2><p>Its heart stayed close to resting all day. Nothing to talk through tonight.</p></section></div>" +
        '<div class="col">' + right + "</div></div></div>";
    }
    var i = Math.min(S.mi, n - 1), r = d.rises[i], a = ans(d, i), k = mKey(d, i);
    var left = '<section class="card" data-tour="r-moment"><h2>' + fmtTime(r.peakMin) + " · " + esc(r.situation) + "</h2>" +
      scene(r.moving, a.cant ? 1 : a.pressure, r.moving ? "The blob on its feet" : "The blob at its desk") +
      '<p style="margin-top:18px;font-size:17px">' + momentStory(d, r) + "</p>" +
      '<div class="chips" style="margin-bottom:16px"><span class="chip"><i class="sw" style="background:' + (r.moving ? "var(--orange)" : "var(--plum)") + '"></i>' +
      (r.moving ? "On the move" : "Barely moving") + '</span><span class="chip">' + r.steps10 + ' steps</span><span class="chip">' + r.bpm + " bpm</span>" +
      '<span class="chip">' + (a.act ? "You said: " + ACT[a.act] : "Fitbit's guess: " + ACT[guessActivity(d, r)]) + "</span></div>" +
      '<div class="inner" style="padding:12px">' + hrChart(d, Math.max(0, r.peakMin - 90), Math.min(1440, r.peakMin + 90), {
        w: 640, h: 220, sel: i, label: "Heart rate 90 minutes either side of " + fmtTime(r.peakMin),
        ticks: [-90, -45, 0, 45, 90].map(function (o) { return r.peakMin + o; }).filter(function (m) { return m >= 0 && m <= 1440; })
      }) + "</div></section>";
    left += '<section class="card' + (a.cant ? " dim" : "") + '" data-tour="r-help"><h2>Help the blob understand</h2><div class="qbody">' +
      '<div class="qrow"><b>Did the blob have something due?</b>' + yesNo("mdue:" + k, a.due, "Did the blob have something due?") + "</div>" +
      '<div class="qrow"><b>Was it on top of things?</b>' + yesNo("mtop:" + k, a.onTop, "Was it on top of things?") + "</div>" +
      '<p style="margin:16px 0 8px;font-weight:700;color:var(--ink)">How much pressure was it feeling?</p>' +
      scale("mp:" + k, a.cant ? null : a.pressure, 0.9, "How much pressure was it feeling?") + "</div>" +
      '<div class="btns" style="margin-top:20px"><button class="btn ghost" aria-pressed="' + a.cant + '" data-act="cant" data-key="' + k + '" data-fid="cant">' +
      (a.cant ? "You can't remember this one" : "I can't remember") + "</button>" +
      '<button class="btn primary" data-act="next" data-fid="next">' + (i === n - 1 ? "Back to the first" : "Next moment") + "</button></div></section>";

    var list = '<section class="card"><h3>Today\'s moments</h3><ul class="list">' + d.rises.map(function (rr, j) {
      var aa = ans(d, j), status = aa.cant ? "Can't remember" : aa.pressure != null ? aa.pressure + " of 7" : "Not yet";
      return '<li><button class="row-btn" data-act="mi" data-v="' + j + '" aria-current="' + (j === i) + '" data-fid="mi' + j + '">' +
        '<i class="sw" style="background:' + (rr.moving ? "var(--orange)" : "var(--plum)") + '"></i>' +
        '<div class="grow"><b>' + fmtTime(rr.peakMin) + "</b><span>" + esc(rr.situation) + " · " + rr.bpm + " bpm</span></div>" +
        '<span class="small">' + status + "</span></button></li>";
    }).join("") + "</ul></section>";

    return h + '<div class="grid"><div class="col">' + left + '</div><div class="col">' + list + right + "</div></div></div>";
  }

  function guessChart() {
    var W = 640, H = 240, L = 30, R = 12, T = 14, B = 30, n = DAYS.length;
    var x = function (i) { return L + i / (n - 1) * (W - L - R); };
    var y = function (v) { return T + (1 - (v - 1) / 6) * (H - T - B); };
    var g = "";
    [1, 4, 7].forEach(function (v) {
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="var(--line)"/><text x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + v + "</text>";
    });
    DAYS.forEach(function (d, i) {
      var gx = guess(d), wx = whole(d);
      g += '<line x1="' + x(i) + '" x2="' + x(i) + '" y1="' + y(gx) + '" y2="' + y(wx) + '" stroke="var(--muted)" stroke-width="2" opacity="0.5"/>' +
        '<circle cx="' + x(i) + '" cy="' + y(gx) + '" r="6" fill="var(--card)" stroke="var(--plum)" stroke-width="2.5"/>' +
        '<circle cx="' + x(i) + '" cy="' + y(wx) + '" r="6" fill="var(--plum)"/>' +
        '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + asDate(d.date).getDate() + "</text>";
    });
    return '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Your morning guess and how each day left the blob, 19 October to 1 November">' + g + "</svg>" +
      '<div class="legend"><span><i class="sw" style="border:2.5px solid var(--plum);background:var(--card)"></i>Your morning guess</span><span><i class="sw" style="background:var(--plum)"></i>How the day left it</span></div>';
  }

  function viewHeadspace() {
    var ls = links(), sug = ls.filter(function (l) { return l.ok; });
    var nDays = DAYS.filter(function (d) { return whole(d) != null; }).length;
    var h = '<div class="wrap"><div class="head"><h1>' + (sug.length ? "The blob feels pressure when it sits still." : "The blob is still getting to know you.") + "</h1>" +
      "<p>What the blob has learned from " + nDays + " days of your heartbeat, your steps and your help.</p></div>" +
      '<div class="grid"><div class="col">';
    h += '<section class="card" data-tour="h-sugg"><h2>Things the blob wants to try with you</h2>';
    if (sug.length) {
      sug.forEach(function (l) {
        var v = S.sugg[l.id];
        h += '<div class="sugg"><h3>' + esc(l.title) + "</h3><p>" + esc(l.text) + '</p><div class="pills" role="radiogroup" aria-label="' + esc(l.title) + '">' +
          '<button class="pill" role="radio" aria-checked="' + (v === "try") + '" data-act="sugg" data-key="' + l.id + '" data-v="try" data-fid="' + l.id + 't">Let\'s try it</button>' +
          '<button class="pill" role="radio" aria-checked="' + (v === "no") + '" data-act="sugg" data-key="' + l.id + '" data-v="no" data-fid="' + l.id + 'n">Not for us</button></div></div>';
      });
    } else {
      h += "<p>The blob hasn't noticed enough yet. Its ideas will show up here.</p>";
    }
    h += '<p class="small" style="margin:12px 0 0">These are gentle ideas, not medical advice. The blob gets surer the more days it spends with you.</p></section>';
    h += '<section class="card" data-tour="h-links"><h2>What the blob has noticed</h2>' + ls.map(function (l) {
      return '<div class="link-row"' + (l.r != null ? ' aria-label="' + esc(l.name + ". " + l.text + " Correlation of steps and the whole day: " + l.r.toFixed(2)) + '"' : "") + '><div><b>' + l.name + "</b><p>" + esc(l.text) + "</p></div>" +
        '<span class="chip' + (l.chip === "Starting to see it" ? " yellow" : "") + '">' + l.chip + "</span></div>";
    }).join("") + "</section>";
    h += '<section class="card" data-tour="h-guess"><h2>Your guess vs how the day went</h2>' + guessChart() + "</section></div>";

    // right column
    var situ = ["Sitting still, evening", "Sitting still, daytime", "Walking", "On its feet"], by = {};
    situ.forEach(function (s) { by[s] = { Pressure: 0, Neither: 0, Effort: 0, Overload: 0, n: 0 }; });
    DAYS.forEach(function (d) { usable(d).forEach(function (u) { var b = by[u.r.situation]; b[kind(u.r.moving, u.a.pressure)]++; b.n++; }); });
    var maxN = Math.max.apply(null, situ.map(function (s) { return by[s].n; }).concat([1]));
    h += '<div class="col"><section class="card"><h3>How well the blob knows you</h3><div class="bar-track" role="progressbar" aria-label="Days together" aria-valuemin="0" aria-valuemax="28" aria-valuenow="' + nDays + '"><span style="width:' + (nDays / 28 * 100) + '%"></span></div>' +
      '<p style="margin:12px 0 0">' + nDays + " of 28 days together. What it has noticed so far are early signs. It will check them again after four weeks.</p></section>";
    h += '<section class="card"><h3>Where the blob feels pressure</h3><div role="img" aria-label="Moments by situation, coloured by kind">' + situ.map(function (s) {
      var b = by[s];
      return '<div style="margin:14px 0"><div style="display:flex;justify-content:space-between;font-size:14px"><span>' + s + '</span><span class="muted">' + b.n + '</span></div>' +
        '<div class="stack" style="width:' + Math.max(4, b.n / maxN * 100) + '%">' + ["Pressure", "Overload", "Effort", "Neither"].map(function (k) {
          return b[k] ? '<span style="width:' + (b[k] / b.n * 100) + "%;background:" + KIND_COLOR[k] + '"></span>' : "";
        }).join("") + "</div></div>";
    }).join("") + '</div><div class="legend">' + ["Pressure", "Overload", "Effort", "Neither"].map(function (k) {
      return '<span><i class="sw" style="background:' + KIND_COLOR[k] + '"></i>' + k + "</span>";
    }).join("") + "</div></section>";
    h += '<section class="card"><h3>Every day together</h3><ul class="list">' + DAYS.map(function (d) {
      return '<li><button class="row-btn" data-act="goday" data-v="' + d.date + '" data-fid="gd' + d.date + '">' + blob(whole(d), 0.45) +
        '<div class="grow"><b>' + shortDate(d.date) + "</b><span>" + esc(d.context) + "</span></div><span>" + whole(d) + "/7</span></button></li>";
    }).join("") + "</ul></section>";
    h += '<section class="card yellow"><h3>Has it been heavy for you too?</h3><p style="margin:0">The blob can\'t diagnose anything. Talking to someone helps, and UNSW offers free support for students.</p></section>';
    return h + "</div></div></div>";
  }

  // ---------- stories from Fitbit activity ----------
  var ACT = { sport: "Exercising", feet: "On its feet, working", walk: "Walking somewhere", desk: "Sitting, working", relax: "Sitting, relaxing" };
  function stillFor(d, r) {
    var n = 0;
    for (var s = r.peakMin / 5 - 1; s >= 0 && n < 36; s--) { if (d.series[s][2] >= 60) break; n++; }
    return n * 5;
  }
  function guessActivity(d, r) {
    var lift = r.bpm - d.rhr;
    if (r.moving && r.steps10 >= 500 && lift >= 60) return "sport";
    if (r.moving) return r.mins >= 45 ? "feet" : "walk";
    return stillFor(d, r) >= 45 ? "desk" : "relax";
  }
  function span(m) {
    if (m < 60) return m + " minutes";
    if (m < 90) return "about an hour";
    return "about " + Math.round(m / 30) / 2 + " hours";
  }
  function activityStory(d, r, act) {
    var t = fmtTime(r.peakMin), lift = Math.round(r.bpm - d.rhr), still = stillFor(d, r);
    var when = r.peakMin < 720 ? "in the morning" : r.peakMin < 1080 ? "in the afternoon" : "in the evening";
    switch (act) {
      case "sport":
        return t + ". The blob is moving fast: " + r.steps10 + " steps in ten minutes, and its heart is up at " + r.bpm + " bpm. It looks like exercise, a game or a run. Its heart is pounding, but the blob can't tell if that's the running or something else.";
      case "feet":
        return t + ". The blob has been on its feet for " + span(r.mins) + ", about " + r.steps10 + " steps every ten minutes. Back and forth, back and forth. Its heart sits at " + r.bpm + " bpm. It might be a busy shift. The blob is tired, but is it under pressure?";
      case "walk":
        return t + ". The blob is walking somewhere " + when + ", " + r.steps10 + " steps in ten minutes. Its heart climbs to " + r.bpm + " bpm. Is it heading to something, or away from something? The blob doesn't know.";
      case "desk":
        return t + ". The blob has barely moved for " + span(Math.max(still, 10)) + ". It's probably working at a desk. Then, without a single step, its heart races to " + r.bpm + " bpm, " + lift + " above resting. Nothing in its body explains it.";
      default:
        return t + ". The blob is sitting still " + when + ", only " + r.steps10 + " steps in ten minutes. Maybe it's resting, maybe it's with people. But its heart races to " + r.bpm + " bpm and stays up for " + span(r.mins) + ". Something has its attention.";
    }
  }

  function weekStories() {
    var d = dayBy(S.day);
    var h = '<section class="card" data-tour="st-week" style="margin-bottom:28px"><h2>Stories from its ' + shortDate(d.date) + "</h2>" +
      '<p class="small">Made up from what your Fitbit saw. If the blob got the story wrong, tell it what it was really doing.</p>';
    if (!d.rises.length) {
      return h + "<p style=\"margin:0\">A calm day for the blob. Its heart stayed close to resting all day. Nothing to talk through tonight.</p></section>";
    }
    h += '<div class="story-grid" style="margin-top:16px">';
    d.rises.forEach(function (r, i) {
      var a = ans(d, i), k = mKey(d, i), g = guessActivity(d, r), act = a.act || g;
      h += '<div class="inner story-tile" aria-label="Moment at ' + fmtTime(r.peakMin) + '">' +
        scene(act !== "desk" && act !== "relax", a.cant ? 1 : a.pressure, ACT[act]) +
        '<p style="margin:16px 0;font-size:16px">' + esc(activityStory(d, r, act)) + "</p>" +
        '<p style="margin:0 0 8px;font-weight:700;color:var(--ink)">What was the blob doing?</p>' +
        '<div class="pills" role="radiogroup" aria-label="What was the blob doing at ' + fmtTime(r.peakMin) + '?">' +
        Object.keys(ACT).map(function (id) {
          return '<button type="button" class="pill" role="radio" aria-checked="' + (act === id) + '" data-act="act" data-key="' + k + '" data-v="' + id + '" data-fid="act' + k + id + '">' +
            ACT[id] + (id === g ? ' <span class="muted">· Fitbit\'s guess</span>' : "") + "</button>";
        }).join("") + "</div>" +
        '<p style="margin:18px 0 8px;font-weight:700;color:var(--ink)">How much pressure was it feeling?</p>' +
        scale("mp:" + k, a.cant ? null : a.pressure, 0.65, "How much pressure was it feeling at " + fmtTime(r.peakMin) + "?") +
        "</div>";
    });
    return h + "</div></section>";
  }

  function viewStories() {
    var h = '<div class="wrap"><div class="head" style="max-width:760px"><h1>Help the blob understand.</h1>' +
      "<p>Come back to its stories any time. Change how flat each one leaves the blob, or tell it what a story is missing.</p></div>" +
      weekStories() + '<h2>The blob\'s first stories</h2><div class="story-grid">';
    DATA.stories.forEach(function (_, i) {
      var s = story(i), fb = S.fb[i] || {};
      h += '<section class="card story-tile"' + (i === 0 ? ' data-tour="st-first"' : "") + ' aria-label="Story ' + (i + 1) + ' of 8">' +
        '<p class="small" style="margin-bottom:10px">Story ' + (i + 1) + " of 8</p>" + scene(s.moving, s.blob) +
        '<div class="story-card">' +
        factorRow("due", s.due ? "The blob has an assessment due tomorrow." : "The blob has nothing due this week.") +
        factorRow("moving", s.moving ? "It has been on its feet for hours." : "It has been sitting at a desk for hours.") +
        factorRow("behind", s.behind ? "It's behind, and no one can help." : "It's on top of things.") + "</div>" +
        '<h3 style="margin-top:20px">How much pressure does the blob feel?</h3>' + scale("sb:" + i, s.blob, 0.7, "How much pressure does the blob feel? Story " + (i + 1)) +
        '<p style="margin:18px 0 8px;font-weight:700;color:var(--ink)">And how much would you feel, in its place?</p>' + scale("sy:" + i, s.you, 0.6, "And how much would you feel, in its place? Story " + (i + 1)) +
        '<p style="margin:20px 0 8px;font-weight:700;color:var(--ink)">Does this story feel right for the blob?</p>' +
        '<div class="pills" role="radiogroup" aria-label="Does story ' + (i + 1) + ' feel right for the blob?">' +
        [["right", "Feels right"], ["notquite", "Not quite"]].map(function (o) {
          return '<button type="button" class="pill" role="radio" aria-checked="' + (fb.verdict === o[0]) + '" data-act="fb" data-key="' + i + '" data-v="' + o[0] + '" data-fid="fb' + i + o[0] + '">' + o[1] + "</button>";
        }).join("") + "</div>" +
        '<label class="fb-label" for="fb-note-' + i + '">Tell the blob what it\'s missing</label>' +
        '<textarea class="fb-note" id="fb-note-' + i + '" data-note="' + i + '" rows="2" placeholder="A shift after a deadline feels different…">' + esc(fb.note || "") + "</textarea>" +
        "</section>";
    });
    return h + '</div><div class="btns" style="margin-top:24px"><a class="btn primary" href="#blob">See what the blob learned</a></div></div>';
  }

  function viewBlob(fromSetup) {
    var e = effects();
    function row(label, v, color) {
      var pct = Math.min(1, Math.abs(v) / 4) * 50;
      var style = v >= 0 ? "left:50%;width:" + pct + "%" : "right:50%;width:" + pct + "%";
      return '<div class="effect"><b>' + label + '</b><div class="axis" aria-hidden="true"><i style="' + style + ";background:" + color + '"></i></div><span style="text-align:right;font-weight:700">' + signed(v) + "</span></div>";
    }
    var gap = e.gap, x = f1(Math.abs(gap));
    var h = '<div class="wrap"' + (fromSetup ? ' style="padding-top:0"' : "") + '><div class="head"><h1>The blob is starting to understand.</h1>' +
      "<p>From the 8 stories you told it, this is what the blob now knows flattens it.</p></div>" +
      '<div class="grid"><div class="col"><section class="card" data-tour="b-effects"><h2>What flattens the blob</h2><p class="small">How much flatter it gets, on the 1–7 scale</p>' +
      '<div role="img" aria-label="Effects: something due ' + signed(e.due) + ", being behind " + signed(e.behind) + ", being on its feet " + signed(e.moving) + '">' +
      row("Something due", e.due, "var(--plum)") + row("Being behind", e.behind, "var(--plum)") + row("Being on its feet", e.moving, "var(--orange)") + "</div></section>" +
      '<div class="btns">' +
      '<button class="btn ghost" data-act="retell" data-fid="retell">' + (fromSetup ? "Change my answers" : "Tell the stories again") + "</button>" +
      (S.done ? '<a class="btn primary" href="#today">Spend a day with the blob</a>' : "") + "</div></div>" +
      '<div class="col"><section class="card yellow"><h3>What this means</h3><p style="margin:0">' +
      (Math.abs(e.moving) < 0.75
        ? "Being on its feet barely flattens the blob. So when its heart races during a busy shift, it now knows that's effort, not pressure."
        : "Being on its feet flattens the blob too, so it may still mix up tiredness and pressure. It will keep watching.") + "</p></section>" +
      '<section class="card indigo" data-tour="b-gap"><h3>You and the blob</h3><p style="margin:0">In its place, you felt ' + x + " " + (gap >= 0 ? "less" : "more") + " than the blob on average. " +
      (Math.abs(gap) >= 0.6 ? "That's a big gap. You might be going easier on yourself than on the blob." : "That's close, so the blob feels much like you would.") + "</p></section></div></div></div>";
    return h;
  }


  // ---------- walkthrough ----------
  var TOUR = [
    { r: "welcome", t: "w-blob", h: "Meet the blob", b: "It's a blob. It doesn't understand how it feels. Can you help it understand how it feels?" },
    { r: "welcome", t: "w-start", h: "Start here", b: "Meet the blob teaches it with 8 short stories. It takes about 3 minutes." },
    { r: "setup", step: 1, t: "s-scale", h: "The flattening scale", b: "The blob shows pressure by flattening. Every answer in the app uses this 1 to 7 scale." },
    { r: "setup", step: 2, t: "s-story", h: "A story from its life", b: "Each story changes three things: whether something is due, whether it's behind, and whether it's on its feet." },
    { r: "setup", step: 2, t: "s-rate", h: "Two answers per story", b: "You rate how flat the blob would feel, then how flat you would feel in its place." },
    { r: "today", t: "t-chart", h: "The blob's day", b: "Heart rate across the whole day. Dots mark the moments its heart raced 25+ bpm over resting: orange while moving, plum while still. Bars along the bottom are steps." },
    { r: "today", t: "t-guess", h: "This morning's guess", b: "Each morning you guess how much the day ahead will flatten the blob. Tonight you'll compare." },
    { r: "today", t: "t-stats", h: "The day in numbers", b: "Resting heartbeat, steps, how many times its heart raced, and how flat the day left it." },
    { r: "today", t: "t-mark", h: "Mark a moment", b: "If something happens during the day, one tap tells the blob to ask about it tonight." },
    { r: "review", t: "r-moment", h: "Tonight with the blob", b: "Each moment its heart raced, told as a short story with the steps before it and a close-up of the heart rate." },
    { r: "review", t: "r-help", h: "Help the blob understand", b: "Two quick questions and the scale. If you can't remember, the blob leaves that moment out." },
    { r: "review", t: "r-map", h: "The day map", b: "Every moment placed by how much the blob was moving and how much pressure it felt: Pressure, Overload, Effort or Neither." },
    { r: "stories", t: "st-week", h: "Stories from its day", b: "The blob makes up a short story for each moment, from what your Fitbit saw. Tell it what it was really doing and how much pressure it felt." },
    { r: "stories", t: "st-first", h: "Its first stories, any time", b: "Come back to the blob's first 8 stories whenever you like. Change how flat each one leaves it, say whether it feels right, and tell it what it's missing." },
    { r: "headspace", t: "h-sugg", h: "What it learned", b: "Once the blob sees a pattern across enough days, it suggests a small way to look after you both." },
    { r: "headspace", t: "h-links", h: "What it has noticed", b: "Four links between your body and your headspace. Each one shows how sure the blob is so far." },
    { r: "headspace", t: "h-guess", h: "Your guess vs the day", b: "Open circles are your morning guess. Filled circles are how the day actually left the blob." },
    { r: "blob", t: "b-effects", h: "About the blob", b: "From your 8 stories: how much each factor flattens the blob. If being on its feet barely matters, a busy shift reads as effort, not pressure." },
    { r: "blob", t: "b-gap", h: "You and the blob", b: "How differently you'd feel in its place. A big gap might mean you go easier on yourself than on the blob." },
    { r: null, t: "tour", h: "That's the tour", b: "You can come back to it any time from here." }
  ];
  var T = null;
  function tourStart() {
    T = { i: 0, hash: location.hash || "#welcome", step: S.step, story: S.story, day: S.day, mi: S.mi };
    var d = dayBy(S.day);
    if (!d.rises.length) {
      for (var j = DAYS.length - 1; j >= 0; j--) if (DAYS[j].rises.length) { S.day = DAYS[j].date; S.mi = 0; break; }
    }
    document.getElementById("tour").hidden = false;
    tourGo(0);
  }
  function tourEnd() {
    if (!T) return;
    S.step = T.step; S.story = T.story; S.day = T.day; S.mi = T.mi;
    var back = T.hash;
    T = null;
    document.getElementById("tour").hidden = true;
    document.getElementById("tour-spot").hidden = true;
    if (location.hash !== back) location.hash = back; else { lastRoute = null; render(); }
    document.getElementById("tour-btn").focus();
  }
  function tourGo(i) {
    T.i = i;
    var st = TOUR[i];
    if (st.step != null) { S.step = st.step; if (st.step === 2) S.story = 0; }
    if (st.r && location.hash !== "#" + st.r) location.hash = "#" + st.r;
    else { lastRoute = null; render(); }
  }
  function tourPlace() {
    if (!T) return;
    var st = TOUR[T.i], box = document.getElementById("tour"), spot = document.getElementById("tour-spot");
    box.querySelector(".tour-n").textContent = "Step " + (T.i + 1) + " of " + TOUR.length;
    box.querySelector("h3").textContent = st.h;
    box.querySelector("p:not(.tour-n)").textContent = st.b;
    box.querySelector('[data-tour-act="back"]').disabled = T.i === 0;
    box.querySelector('[data-tour-act="next"]').textContent = T.i === TOUR.length - 1 ? "Done" : "Next";
    var el = st.t === "tour" ? document.getElementById("tour-btn") : document.querySelector('[data-tour="' + st.t + '"]');
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "instant" in document.documentElement.style ? "instant" : "auto" });
      tourSpot();
    } else spot.hidden = true;
    box.querySelector('[data-tour-act="next"]').focus({ preventScroll: true });
  }
  function tourSpot() {
    if (!T) return;
    var st = TOUR[T.i], spot = document.getElementById("tour-spot");
    var el = st.t === "tour" ? document.getElementById("tour-btn") : document.querySelector('[data-tour="' + st.t + '"]');
    if (!el) { spot.hidden = true; return; }
    var r = el.getBoundingClientRect(), pad = 6;
    spot.hidden = false;
    spot.style.top = (r.top - pad) + "px"; spot.style.left = (r.left - pad) + "px";
    spot.style.width = (r.width + pad * 2) + "px"; spot.style.height = (r.height + pad * 2) + "px";
    var radius = getComputedStyle(el).borderTopLeftRadius;
    spot.style.borderRadius = "calc(" + (radius === "0px" ? "12px" : radius) + " + " + pad + "px)";
  }
  document.addEventListener("click", function (ev) {
    if (ev.target.closest("#tour-btn")) { T ? tourEnd() : tourStart(); return; }
    var b = ev.target.closest("[data-tour-act]");
    if (!b || !T) return;
    var a = b.getAttribute("data-tour-act");
    if (a === "close") tourEnd();
    else if (a === "back" && T.i > 0) tourGo(T.i - 1);
    else if (a === "next") { if (T.i === TOUR.length - 1) tourEnd(); else tourGo(T.i + 1); }
  });
  document.addEventListener("keydown", function (ev) {
    if (T && ev.key === "Escape") tourEnd();
  });
  window.addEventListener("scroll", tourSpot, { passive: true });
  window.addEventListener("resize", tourSpot);

  // ---------- routing + render ----------
  function route() {
    var r = (location.hash || "#welcome").slice(1);
    return ROUTES.indexOf(r) >= 0 ? r : "welcome";
  }
  var lastRoute = null;
  function render() {
    var r = route(), app = document.getElementById("app");
    var fid = document.activeElement && document.activeElement.getAttribute("data-fid");
    var html = { welcome: viewWelcome, setup: viewSetup, today: viewToday, review: viewReview, stories: viewStories, headspace: viewHeadspace, blob: function () { return viewBlob(false); } }[r]();
    app.innerHTML = html;
    document.querySelectorAll(".tabs a").forEach(function (a) {
      if (a.getAttribute("data-tab") === r) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    var dp = document.getElementById("daypick");
    dp.innerHTML = r === "today" || r === "review" || r === "stories"
      ? '<label class="vh" for="day-select">Day</label><select id="day-select">' + DAYS.map(function (d) {
          return '<option value="' + d.date + '"' + (d.date === S.day ? " selected" : "") + ">" + shortDate(d.date) + "</option>";
        }).join("") + "</select>"
      : "";
    if (r !== lastRoute) {
      window.scrollTo(0, 0);
      if (lastRoute !== null) app.focus({ preventScroll: true });
      document.title = { welcome: "Pressure or Effort", setup: "Meet the blob · Pressure or Effort", today: "The blob's day · Pressure or Effort", review: "Tonight · Pressure or Effort", stories: "Its stories · Pressure or Effort", headspace: "What it learned · Pressure or Effort", blob: "About the blob · Pressure or Effort" }[r];
    } else if (fid) {
      var el = app.querySelector('[data-fid="' + fid + '"]');
      if (el) el.focus({ preventScroll: true });
    }
    lastRoute = r;
    if (T) setTimeout(tourPlace, 0);
  }
  function commit() { save(); render(); }

  function setValue(key, v) {
    var p = key.split(":"), t = p[0], id = p.slice(1).join(":");
    var mm = function () { return (S.m[id] = S.m[id] || {}); };
    if (t === "try") S.tryLevel = v;
    else if (t === "sb" || t === "sy") { var s = (S.stories[id] = S.stories[id] || {}); s[t === "sb" ? "blob" : "you"] = v; }
    else if (t === "guess") S.guess[id] = v;
    else if (t === "whole") S.whole[id] = v;
    else if (t === "match") S.match[id] = v;
    else if (t === "mp") { mm().pressure = v; mm().cant = false; }
    else if (t === "mdue") mm().due = !!v;
    else if (t === "mtop") mm().onTop = !!v;
  }

  var toastTimer;
  function toast(msg) {
    var t = document.getElementById("toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  document.addEventListener("click", function (ev) {
    var el = ev.target.closest("[data-act]");
    if (!el || T) return;
    var act = el.getAttribute("data-act"), v = el.getAttribute("data-v"), key = el.getAttribute("data-key");
    if (act === "set") { setValue(key, +v); commit(); }
    else if (act === "setup") {
      S.step = +v; if (S.step === 2) S.story = 0;
      if (location.hash !== "#setup") { save(); location.hash = "#setup"; } else { lastRoute = null; commit(); }
    }
    else if (act === "story") {
      var nx = S.story + +v;
      if (nx < 0) S.step = 1;
      else if (nx > 7) { S.step = 3; S.done = true; }
      else S.story = nx;
      lastRoute = null; commit();
    }
    else if (act === "retell") { S.step = 2; S.story = 0; save(); if (location.hash === "#setup") { lastRoute = null; render(); } else location.hash = "#setup"; }
    else if (act === "cant") { var m = (S.m[key] = S.m[key] || {}); m.cant = !ans(dayBy(key.split("#")[0]), +key.split("#")[1]).cant; commit(); }
    else if (act === "next") { var n = dayBy(S.day).rises.length; S.mi = (Math.min(S.mi, n - 1) + 1) % n; commit(); }
    else if (act === "mi") { S.mi = +v; commit(); }
    else if (act === "sugg") { S.sugg[key] = S.sugg[key] === v ? undefined : v; commit(); }
    else if (act === "act") { var am = (S.m[key] = S.m[key] || {}); am.act = am.act === v ? undefined : v; commit(); }
    else if (act === "fb") { var f = (S.fb[key] = S.fb[key] || {}); f.verdict = f.verdict === v ? undefined : v; commit(); }
    else if (act === "goday") { S.day = v; S.mi = 0; save(); location.hash = "#today"; }
    else if (act === "mark") toast("Marked. The blob will ask you about it tonight.");
  });

  // arrow keys inside radio groups
  document.addEventListener("keydown", function (ev) {
    var el = ev.target.closest && ev.target.closest('[role="radio"]');
    if (!el) return;
    var keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(ev.key in keys)) return;
    var group = Array.prototype.slice.call(el.parentNode.querySelectorAll('[role="radio"]'));
    var next = group[(group.indexOf(el) + keys[ev.key] + group.length) % group.length];
    ev.preventDefault();
    next.focus();
    next.click();
  });

  document.addEventListener("input", function (ev) {
    var i = ev.target.getAttribute && ev.target.getAttribute("data-note");
    if (i == null) return;
    (S.fb[i] = S.fb[i] || {}).note = ev.target.value;
    save();
  });

  document.addEventListener("change", function (ev) {
    if (ev.target.id === "day-select") { S.day = ev.target.value; S.mi = 0; commit(); }
  });
  window.addEventListener("hashchange", render);
  render();
})();
