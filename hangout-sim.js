/* Hangout presence, simulated.
 *
 * The demo has no backend, so the other blobs in a room are made up here, seeded from the date so a
 * room is the same all day. Swap this file for a realtime presence channel later (one channel per band).
 *
 * Every event, sent or received, carries only { anonId, band, colour, action, target?, ts }.
 * Nothing about stories, heart rate, steps, times or exact level is in it.
 */
(function () {
  "use strict";
  var COLOURS = ["honey", "peach", "rose", "lilac", "sky", "mint"];

  function seeded(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
  }
  function randomId() {
    var a = new Uint8Array(8);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }
  // a fresh id each day (and each load); never stored, never tied to anything
  var myId = randomId();

  function between(lo, hi) { return lo + Math.random() * (hi - lo); }

  // the blobs in a room today: 4 to 10, the same all day
  function roomBlobs(day, band) {
    var rnd = seeded(day + "|" + band), n = 4 + Math.floor(rnd() * 7), blobs = [];
    for (var i = 0; i < n; i++) blobs.push({ anonId: Math.floor(rnd() * 1e12).toString(16), colour: COLOURS[Math.floor(rnd() * COLOURS.length)] });
    return blobs;
  }

  // join(day, band, colour, onEvent) -> session
  function join(day, band, colour, onEvent) {
    var blobs = roomBlobs(day, band);
    var timers = [], live = true, lastMetoo = 0, breathing = false;
    var emit = function (e) { if (live) onEvent(Object.assign({ band: band, ts: Date.now() }, e)); };
    var later = function (fn, ms) { var t = setTimeout(function () { if (live) fn(); }, ms); timers.push(t); return t; };

    function waveLoop() {
      later(function () { var b = blobs[Math.floor(Math.random() * blobs.length)]; emit({ anonId: b.anonId, colour: b.colour, action: "wave" }); waveLoop(); }, between(8000, 20000));
    }
    function metooLoop() {
      later(function () {
        if (Date.now() - lastMetoo >= 60000 && Math.random() < 0.5) {
          var b = blobs[Math.floor(Math.random() * blobs.length)]; lastMetoo = Date.now();
          emit({ anonId: b.anonId, colour: b.colour, action: "metoo", target: myId });
        }
        metooLoop();
      }, between(20000, 40000));
    }
    // now and then someone else starts a breathing round and invites the room
    function inviteLoop() {
      later(function () {
        if (!breathing && Math.random() < 0.35) { var b = blobs[Math.floor(Math.random() * blobs.length)]; emit({ anonId: b.anonId, colour: b.colour, action: "breathe" }); }
        inviteLoop();
      }, between(45000, 90000));
    }
    waveLoop(); metooLoop(); inviteLoop();

    return {
      me: { anonId: myId, band: band, colour: colour },
      blobs: blobs,
      send: function (action, target) {
        // what a real client would publish
        var payload = { anonId: myId, band: band, colour: colour, action: action, ts: Date.now() };
        if (target) payload.target = target;
        return payload;
      },
      // about 60% of the room joins a breathing round, each after 1-3s
      breathe: function (onJoin) {
        breathing = true;
        blobs.forEach(function (b) { if (Math.random() < 0.6) later(function () { onJoin(b.anonId); }, between(1000, 3000)); });
        later(function () { breathing = false; }, 60000);
      },
      leave: function () { live = false; timers.forEach(clearTimeout); }
    };
  }
  // peek: only your own room, only how many are there and their colours
  window.HangoutSim = { join: join, peek: roomBlobs };
})();
