/* Frase a Frase — EXPERIMENTAL: Comunidade > Jogos > Xadrez (contra a máquina)
 *
 * Módulo isolado. Para remover tudo do projeto:
 *   1. apagar a pasta experimental/comunidade/
 *   2. apagar a linha <script src="experimental/comunidade/comunidade.js..."> do index.html
 * Nada mais no app depende deste arquivo.
 *
 * O que faz:
 *   - Põe o item "Comunidade" no menu lateral (antes de "Conta").
 *   - Comunidade abre uma tela com "Jogos"; Jogos abre o "Xadrez".
 *   - Xadrez completo contra a máquina: roque, en passant, promoção, xeque, xeque-mate,
 *     afogamento, 50 lances, repetição tripla e material insuficiente. 3 níveis.
 *   - Partida salva em localStorage['fraseafrase.xadrez'] (some com "Excluir conta").
 */
(function () {
  'use strict';
  var STORE = 'fraseafrase.xadrez';

  /* ================= estilo ================= */
  var css = `
.cx-ov{position:fixed;inset:0;z-index:85;background:var(--ink);color:var(--text);display:flex;flex-direction:column;font-family:Inter,Manrope,system-ui,sans-serif;animation:cx-up .42s cubic-bezier(.16,1,.3,1) both;overscroll-behavior:contain}
@keyframes cx-up{from{opacity:0;transform:translate3d(0,18px,0)}to{opacity:1;transform:none}}
@keyframes cx-in{from{opacity:0;transform:translate3d(0,10px,0)}to{opacity:1;transform:none}}
@keyframes cx-pop{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}
.cx-top{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:12px 14px;padding-top:max(12px,env(safe-area-inset-top))}
.cx-back{width:42px;height:42px;border-radius:14px;border:1px solid var(--hair2,var(--line2));background:var(--deck);color:var(--text);display:flex;align-items:center;justify-content:center;flex:0 0 auto;transition:transform .14s}
.cx-back:active{transform:scale(.94)}
.cx-ttl{display:flex;flex-direction:column;min-width:0}
.cx-ttl small{font-size:12px;color:var(--muted);font-weight:600}
.cx-ttl strong{font-size:19px;letter-spacing:-.02em}
.cx-exp{margin-left:auto;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--accent-t);background:var(--tint-purple);border-radius:999px;padding:4px 9px}
.cx-body{flex:1 1 auto;overflow-y:auto;padding:6px 18px 28px;padding-bottom:max(28px,env(safe-area-inset-bottom))}
.cx-body>*{animation:cx-in .5s cubic-bezier(.16,1,.3,1) both}
.cx-body>*:nth-child(2){animation-delay:.05s}.cx-body>*:nth-child(3){animation-delay:.1s}.cx-body>*:nth-child(4){animation-delay:.15s}
.cx-h1{margin:6px 0 4px;font-size:28px;font-weight:700;letter-spacing:-.035em}
.cx-p{margin:0 0 18px;color:var(--muted);font-size:14.5px;line-height:1.5}
.cx-card{width:100%;display:flex;align-items:center;gap:14px;text-align:left;padding:16px;border-radius:18px;border:1px solid var(--hair,var(--line));background:var(--deck);color:var(--text);box-shadow:var(--lift,none);margin-bottom:10px;transition:transform .14s,border-color .25s}
.cx-card:active{transform:scale(.98)}
.cx-card .cx-ic{width:46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;background:var(--tint-purple);color:var(--accent-t);flex:0 0 auto}
.cx-card .cx-tx{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.cx-card .cx-tx strong{font-size:16px}
.cx-card .cx-tx span{font-size:13px;color:var(--muted)}
.cx-card .cx-go{color:var(--faint,var(--muted))}
.cx-card.is-soon{opacity:.55;pointer-events:none}
/* xadrez */
.cx-game{display:flex;flex-direction:column;gap:12px;max-width:520px;margin:0 auto}
.cx-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:36px}
.cx-who{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600}
.cx-dot{width:12px;height:12px;border-radius:50%;border:1.5px solid var(--line2)}
.cx-dot.w{background:#fff}.cx-dot.b{background:#23242D}
.cx-who.is-turn .cx-dot{box-shadow:0 0 0 3px color-mix(in srgb,var(--accent-t) 35%,transparent)}
.cx-caps{display:flex;flex-wrap:wrap;gap:0;min-height:18px;opacity:.85}
.cx-caps svg{width:18px;height:18px;margin-right:-4px}
.cx-adv{font-size:12px;color:var(--muted);margin-left:6px;align-self:center}
.cx-board-wrap{position:relative;border-radius:14px;overflow:hidden;box-shadow:0 1px 2px rgba(20,26,51,.06),0 14px 34px -14px rgba(20,26,51,.28)}
.cx-board{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));grid-template-rows:repeat(8,minmax(0,1fr));aspect-ratio:1/1;width:100%;user-select:none;-webkit-user-select:none;touch-action:manipulation}
.cx-sq{position:relative;aspect-ratio:1/1;min-width:0;min-height:0;overflow:hidden;border:0;padding:0;margin:0;background:var(--sq);display:flex;align-items:center;justify-content:center;transition:background-color .25s}
.cx-sq.l{--sq:#ECEAF6}.cx-sq.d{--sq:#9F95DA}
@media (prefers-color-scheme:dark){.cx-sq.l{--sq:#CFCBE6}.cx-sq.d{--sq:#7C70C4}.cx-board-wrap{box-shadow:0 14px 34px -14px rgba(0,0,0,.7)}}
.cx-sq.is-last::before{content:"";position:absolute;inset:0;background:rgba(255,206,72,.42)}
.cx-sq.is-sel::before{content:"";position:absolute;inset:0;background:rgba(255,206,72,.62)}
.cx-sq.is-check::before{content:"";position:absolute;inset:0;background:radial-gradient(circle,rgba(240,60,90,.85) 0%,rgba(240,60,90,.35) 45%,rgba(240,60,90,0) 72%)}
.cx-sq.is-move::after{content:"";position:absolute;width:30%;height:30%;border-radius:50%;background:rgba(20,26,51,.22);pointer-events:none;animation:cx-pop .2s ease both}
.cx-sq.is-cap::after{content:"";position:absolute;inset:4%;border-radius:50%;border:4px solid rgba(20,26,51,.24);pointer-events:none;animation:cx-pop .2s ease both}
.cx-pc{position:relative;z-index:1;width:88%;height:88%;pointer-events:none;transition:transform .22s cubic-bezier(.16,1,.3,1);filter:drop-shadow(0 1px 1px rgba(0,0,0,.18))}
.cx-sq.is-sel .cx-pc{transform:translateY(-3px) scale(1.05)}
.cx-pc.is-new{animation:cx-land .32s cubic-bezier(.16,1,.3,1) both}
@keyframes cx-land{from{transform:scale(.8);opacity:.4}to{transform:none;opacity:1}}
.cx-coord{position:absolute;font-size:9.5px;font-weight:700;line-height:1;pointer-events:none;z-index:2}
.cx-sq.l .cx-coord{color:#7C70C4}.cx-sq.d .cx-coord{color:#F1EFFA}
.cx-coord.r{top:3px;left:3px}.cx-coord.f{bottom:3px;right:4px}
.cx-status{text-align:center;font-size:14.5px;font-weight:600;min-height:22px;color:var(--text2,var(--text))}
.cx-status.is-think{color:var(--muted)}
.cx-status.is-end{color:var(--accent-t);font-size:16px}
.cx-tools{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.cx-btn{min-height:46px;border-radius:14px;border:1px solid var(--hair2,var(--line2));background:var(--deck);color:var(--text);font:inherit;font-size:14px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:6px;transition:transform .14s,background-color .25s,opacity .25s}
.cx-btn:active:not(:disabled){transform:scale(.97)}
.cx-btn:disabled{opacity:.45}
.cx-btn.is-main{border:none;background:var(--brand,#5B3DF5);color:#fff}
.cx-seg{display:flex;gap:4px;padding:4px;border-radius:14px;background:var(--deck2)}
.cx-seg button{flex:1;min-height:38px;border:none;border-radius:10px;background:transparent;color:var(--muted);font:inherit;font-size:13.5px;font-weight:600;transition:background-color .25s,color .25s}
.cx-seg button[aria-pressed="true"]{background:var(--deck);color:var(--text);box-shadow:0 1px 3px rgba(20,26,51,.12)}
.cx-lbl{font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin:4px 2px -4px}
.cx-moves{font-size:13px;color:var(--muted);line-height:1.7;word-spacing:2px;max-height:72px;overflow-y:auto}
.cx-moves b{color:var(--text);font-weight:600}
.cx-modal{position:absolute;inset:0;z-index:5;background:rgba(20,26,51,.45);display:flex;align-items:center;justify-content:center;padding:20px;animation:cx-fade .25s ease both}
@keyframes cx-fade{from{opacity:0}to{opacity:1}}
.cx-box{width:100%;max-width:340px;background:var(--deck);color:var(--text);border-radius:22px;padding:22px 20px;box-shadow:0 30px 70px rgba(0,0,0,.35);animation:cx-pop .35s cubic-bezier(.16,1,.3,1) both;display:flex;flex-direction:column;gap:12px;text-align:center}
.cx-box h3{margin:0;font-size:20px;letter-spacing:-.02em}
.cx-box p{margin:0;color:var(--muted);font-size:14px;line-height:1.5}
.cx-promo{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.cx-promo button{aspect-ratio:1;border-radius:14px;border:1px solid var(--hair2,var(--line2));background:var(--deck2);display:flex;align-items:center;justify-content:center;padding:6px}
.cx-promo svg{width:100%;height:100%}
@media (prefers-reduced-motion:reduce){.cx-ov,.cx-ov *{animation:none!important;transition:none!important}}
`;
  var st = document.createElement('style'); st.id = 'cx-style'; st.textContent = css; document.head.appendChild(st);

  /* ================= ícones e peças ================= */
  function svgIc(d, size) { return '<svg width="' + (size || 22) + '" height="' + (size || 22) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; }
  var IC = {
    people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.2c3 .2 5.5 2.6 5.5 5.8"/>',
    game: '<rect x="2.5" y="7" width="19" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3"/><circle cx="15.5" cy="11.5" r=".9" fill="currentColor"/><circle cx="17.5" cy="14" r=".9" fill="currentColor"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    chev: '<path d="m9 18 6-6-6-6"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    flip: '<path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    knight: '<path d="M8 20h9c0-3.5-.8-6.2-2.2-8.4-.7-1.3-.7-3 0-4.6-2.2 0-3.8.8-5 2.2L8.7 8 8 10.3C6.2 11.6 5 13.3 4.6 15.4c-.2 1 .6 1.8 1.6 1.5L8 16c.7 0 1.4-.4 2-1-.6 2-1.6 3.4-2 5z"/>'
  };
  // peças originais, desenho geométrico simples (viewBox 45x45)
  var BASE = 'M11.5 38.5c0-2.2 1.6-3.6 3.6-3.6h14.8c2 0 3.6 1.4 3.6 3.6v1.5h-22z';
  var SHAPES = {
    p: '<path d="M22.5 9.5a5.2 5.2 0 0 1 3.4 9.1c3.1 1.6 5.1 4.6 5.1 8.4 0 2.6-.8 4.6-2 6.2H16c-1.2-1.6-2-3.6-2-6.2 0-3.8 2-6.8 5.1-8.4a5.2 5.2 0 0 1 3.4-9.1z"/><path d="' + BASE + '"/>',
    r: '<path d="M13 9.5h4.2v3.3h3.3V9.5h4v3.3h3.3V9.5H32v7.3l-3.3 3.4v10.6l3.3 3.6H13l3.3-3.6V20.2L13 16.8z"/><path d="M16.3 20.2h12.4" fill="none"/><path d="' + BASE + '"/>',
    n: '<path d="M14.5 34.5h18c.3-6.6-.7-12-3.4-16.4-1.3-2.2-1.6-5-1-8.3-3.4.2-6 1.6-7.8 3.8l-2.3-2.8-.9 4.6c-3.5 2.2-6.2 5.6-7.4 9.9-.4 1.6 1 2.8 2.6 2.3l3.3-1.3c1.4 0 2.6-.6 3.6-1.8-.7 3.7-2.8 6.6-4.7 10z"/><circle cx="20.6" cy="16.6" r="1.2" class="cx-eye"/><path d="' + BASE + '"/>',
    b: '<circle cx="22.5" cy="8.6" r="2.4"/><path d="M22.5 11.4c5.2 3.6 7.5 7.8 7.5 11.6 0 3.3-1.6 5.6-3.2 7.1H18.2c-1.6-1.5-3.2-3.8-3.2-7.1 0-3.8 2.3-8 7.5-11.6z"/><path d="M25.4 17.2 21 21.6" fill="none"/><path d="M16.8 30.1h11.4v4.8H16.8z"/><path d="' + BASE + '"/>',
    q: '<circle cx="9.8" cy="12" r="2.2"/><circle cx="22.5" cy="8.4" r="2.2"/><circle cx="35.2" cy="12" r="2.2"/><circle cx="16" cy="10" r="1.8"/><circle cx="29" cy="10" r="1.8"/><path d="M10.4 14.2 13.4 29h18.2l3-14.8-6.1 7.4-.4-9.9-5.6 9.2-5.6-9.2-.4 9.9z"/><path d="M13.4 29h18.2v5.9H13.4z"/><path d="' + BASE + '"/>',
    k: '<path d="M22.5 4.5v8.2M18.6 8.3h7.8" fill="none"/><path d="M22.5 14.6c-2.9-3.2-8.8-2.8-10.4 1.4-1.4 3.6.2 7.6 2.4 10.4l1.2 2.6h13.6l1.2-2.6c2.2-2.8 3.8-6.8 2.4-10.4-1.6-4.2-7.5-4.6-10.4-1.4z"/><path d="M15.7 29h13.6v5.9H15.7z"/><path d="' + BASE + '"/>'
  };
  function pieceSvg(pc, cls) {
    var white = pc === pc.toUpperCase();
    var fill = white ? '#FBFBFE' : '#24252F', stroke = white ? '#24252F' : '#0E0F14', eye = white ? '#24252F' : '#FBFBFE';
    return '<svg class="cx-pc' + (cls ? ' ' + cls : '') + '" viewBox="0 0 45 45" aria-hidden="true"><g fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">' +
      SHAPES[pc.toLowerCase()].replace('class="cx-eye"', 'fill="' + eye + '" stroke="none"') + '</g></svg>';
  }

  /* ================= motor de xadrez ================= */
  // tabuleiro: array de 64, índice 0 = a8 ... 63 = h1. Maiúscula = brancas.
  var START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  function parseFen(fen) {
    var f = fen.split(' '), b = [], rows = f[0].split('/');
    rows.forEach(function (r) { for (var i = 0; i < r.length; i++) { var c = r[i]; if (/\d/.test(c)) for (var k = 0; k < +c; k++) b.push(null); else b.push(c); } });
    return { b: b, turn: f[1], cast: f[2] === '-' ? '' : f[2], ep: f[3] === '-' ? -1 : sqIdx(f[3]), half: +f[4] || 0, full: +f[5] || 1 };
  }
  function sqIdx(s) { return (8 - +s[1]) * 8 + 'abcdefgh'.indexOf(s[0]); }
  function sqName(i) { return 'abcdefgh'[i % 8] + (8 - (i >> 3)); }
  function isW(p) { return p && p === p.toUpperCase(); }
  function colorOf(p) { return p ? (isW(p) ? 'w' : 'b') : null; }
  var KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  var KG = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  var DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]], ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  function attacked(P, sq, by) { // a casa sq é atacada pela cor "by"?
    var b = P.b, r = sq >> 3, c = sq & 7, i, rr, cc, p;
    var pawnDir = by === 'w' ? 1 : -1; // peões brancos atacam "para cima" (linha menor)
    for (i = -1; i <= 1; i += 2) { rr = r + pawnDir; cc = c + i; if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) { p = b[rr * 8 + cc]; if (p && p === (by === 'w' ? 'P' : 'p')) return true; } }
    for (i = 0; i < 8; i++) { rr = r + KN[i][0]; cc = c + KN[i][1]; if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) { p = b[rr * 8 + cc]; if (p && p === (by === 'w' ? 'N' : 'n')) return true; } }
    for (i = 0; i < 8; i++) { rr = r + KG[i][0]; cc = c + KG[i][1]; if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) { p = b[rr * 8 + cc]; if (p && p === (by === 'w' ? 'K' : 'k')) return true; } }
    function ray(dirs, a, q) {
      for (var d = 0; d < 4; d++) { rr = r + dirs[d][0]; cc = c + dirs[d][1];
        while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) { p = b[rr * 8 + cc]; if (p) { if (p === a || p === q) return true; break; } rr += dirs[d][0]; cc += dirs[d][1]; } }
      return false;
    }
    if (ray(DIAG, by === 'w' ? 'B' : 'b', by === 'w' ? 'Q' : 'q')) return true;
    if (ray(ORTH, by === 'w' ? 'R' : 'r', by === 'w' ? 'Q' : 'q')) return true;
    return false;
  }
  function kingSq(P, col) { var k = col === 'w' ? 'K' : 'k'; for (var i = 0; i < 64; i++) if (P.b[i] === k) return i; return -1; }
  function inCheck(P, col) { return attacked(P, kingSq(P, col), col === 'w' ? 'b' : 'w'); }

  function pseudo(P, capsOnly) {
    var b = P.b, me = P.turn, out = [], i, d, rr, cc, t, p;
    function add(f, to, promo, flag) { out.push({ f: f, t: to, pc: b[f], cap: flag === 'ep' ? (me === 'w' ? 'p' : 'P') : b[to], promo: promo || null, flag: flag || null }); }
    for (i = 0; i < 64; i++) {
      p = b[i]; if (!p || colorOf(p) !== me) continue;
      var r = i >> 3, c = i & 7, lp = p.toLowerCase();
      if (lp === 'p') {
        var dir = me === 'w' ? -1 : 1, startRow = me === 'w' ? 6 : 1, lastRow = me === 'w' ? 0 : 7;
        rr = r + dir;
        if (rr >= 0 && rr < 8) {
          if (!capsOnly && !b[rr * 8 + c]) {
            if (rr === lastRow) ['q', 'r', 'b', 'n'].forEach(function (x) { add(i, rr * 8 + c, x); });
            else { add(i, rr * 8 + c); if (r === startRow && !b[(rr + dir) * 8 + c]) add(i, (rr + dir) * 8 + c, null, 'dbl'); }
          } else if (capsOnly && rr === lastRow && !b[rr * 8 + c]) add(i, rr * 8 + c, 'q');
          for (d = -1; d <= 1; d += 2) { cc = c + d; if (cc < 0 || cc > 7) continue; t = rr * 8 + cc;
            if (b[t] && colorOf(b[t]) !== me) { if (rr === lastRow) ['q', 'r', 'b', 'n'].forEach(function (x) { if (!capsOnly || x === 'q') add(i, t, x); }); else add(i, t); }
            else if (t === P.ep) add(i, t, null, 'ep'); }
        }
      } else if (lp === 'n' || lp === 'k') {
        var set = lp === 'n' ? KN : KG;
        for (d = 0; d < 8; d++) { rr = r + set[d][0]; cc = c + set[d][1]; if (rr < 0 || rr > 7 || cc < 0 || cc > 7) continue; t = rr * 8 + cc;
          if (!b[t]) { if (!capsOnly) add(i, t); } else if (colorOf(b[t]) !== me) add(i, t); }
        if (lp === 'k' && !capsOnly) {
          var opp = me === 'w' ? 'b' : 'w', home = me === 'w' ? 60 : 4;
          if (i === home && !attacked(P, home, opp)) {
            if (P.cast.indexOf(me === 'w' ? 'K' : 'k') >= 0 && !b[home + 1] && !b[home + 2] && b[home + 3] === (me === 'w' ? 'R' : 'r') && !attacked(P, home + 1, opp) && !attacked(P, home + 2, opp)) add(i, home + 2, null, 'oo');
            if (P.cast.indexOf(me === 'w' ? 'Q' : 'q') >= 0 && !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] === (me === 'w' ? 'R' : 'r') && !attacked(P, home - 1, opp) && !attacked(P, home - 2, opp)) add(i, home - 2, null, 'ooo');
          }
        }
      } else {
        var dirs = lp === 'b' ? DIAG : lp === 'r' ? ORTH : DIAG.concat(ORTH);
        for (d = 0; d < dirs.length; d++) { rr = r + dirs[d][0]; cc = c + dirs[d][1];
          while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) { t = rr * 8 + cc;
            if (!b[t]) { if (!capsOnly) add(i, t); } else { if (colorOf(b[t]) !== me) add(i, t); break; }
            rr += dirs[d][0]; cc += dirs[d][1]; } }
      }
    }
    return out;
  }
  function make(P, m) { // altera P; devolve dados para desfazer
    var u = { m: m, cast: P.cast, ep: P.ep, half: P.half, full: P.full, capSq: m.flag === 'ep' ? (m.t + (P.turn === 'w' ? 8 : -8)) : m.t, capPc: null };
    var b = P.b;
    u.capPc = b[u.capSq];
    b[u.capSq] = null;
    b[m.t] = m.promo ? (P.turn === 'w' ? m.promo.toUpperCase() : m.promo) : m.pc;
    b[m.f] = null;
    if (m.flag === 'oo') { b[m.t - 1] = b[m.t + 1]; b[m.t + 1] = null; }
    if (m.flag === 'ooo') { b[m.t + 1] = b[m.t - 2]; b[m.t - 2] = null; }
    var c = P.cast;
    if (m.pc === 'K') c = c.replace('K', '').replace('Q', '');
    if (m.pc === 'k') c = c.replace('k', '').replace('q', '');
    [[63, 'K'], [56, 'Q'], [7, 'k'], [0, 'q']].forEach(function (x) { if (m.f === x[0] || m.t === x[0]) c = c.replace(x[1], ''); });
    P.cast = c;
    P.ep = m.flag === 'dbl' ? (m.f + m.t) / 2 : -1;
    P.half = (m.pc.toLowerCase() === 'p' || u.capPc) ? 0 : P.half + 1;
    if (P.turn === 'b') P.full++;
    P.turn = P.turn === 'w' ? 'b' : 'w';
    return u;
  }
  function unmake(P, u) {
    var m = u.m, b = P.b;
    P.turn = P.turn === 'w' ? 'b' : 'w';
    b[m.f] = m.pc; b[m.t] = null;
    if (u.capPc) b[u.capSq] = u.capPc;
    if (m.flag === 'oo') { b[m.t + 1] = b[m.t - 1]; b[m.t - 1] = null; }
    if (m.flag === 'ooo') { b[m.t - 2] = b[m.t + 1]; b[m.t + 1] = null; }
    P.cast = u.cast; P.ep = u.ep; P.half = u.half; P.full = u.full;
  }
  function legal(P, capsOnly) {
    var me = P.turn, res = [];
    pseudo(P, capsOnly).forEach(function (m) { var u = make(P, m); if (!inCheck(P, me)) res.push(m); unmake(P, u); });
    return res;
  }
  function posKey(P) { return P.b.map(function (x) { return x || '.'; }).join('') + P.turn + P.cast + P.ep; }
  function insufficient(P) {
    var minors = [], other = 0;
    P.b.forEach(function (p, i) { if (!p) return; var l = p.toLowerCase(); if (l === 'k') return; if (l === 'b' || l === 'n') minors.push({ p: l, sq: i }); else other++; });
    if (other) return false;
    if (minors.length <= 1) return true;
    if (minors.every(function (x) { return x.p === 'b'; })) { var col = ((minors[0].sq >> 3) + minors[0].sq) & 1; return minors.every(function (x) { return (((x.sq >> 3) + x.sq) & 1) === col; }); }
    return false;
  }

  /* ---------- avaliação e busca ---------- */
  var VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  // tabelas de posição (do ponto de vista das brancas, índice 0 = a8)
  var PST = {
    p: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
    n: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
    b: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
    r: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
    q: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
    k: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
    ke: [-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30, -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50]
  };
  function evaluate(P) { // positivo = bom para quem joga
    var s = 0, b = P.b, mat = 0, i, p, l;
    for (i = 0; i < 64; i++) { p = b[i]; if (p && p.toLowerCase() !== 'k' && p.toLowerCase() !== 'p') mat += VAL[p.toLowerCase()]; }
    var endgame = mat <= 1300;
    for (i = 0; i < 64; i++) {
      p = b[i]; if (!p) continue; l = p.toLowerCase();
      var tbl = PST[l === 'k' && endgame ? 'ke' : l];
      if (isW(p)) s += VAL[l] + tbl[i]; else s -= VAL[l] + tbl[(7 - (i >> 3)) * 8 + (i & 7)];
    }
    return P.turn === 'w' ? s : -s;
  }
  function order(ms) {
    ms.forEach(function (m) { m.o = (m.cap ? 10 * VAL[m.cap.toLowerCase()] - VAL[m.pc.toLowerCase()] / 10 + 1000 : 0) + (m.promo ? 800 : 0); });
    return ms.sort(function (a, b) { return b.o - a.o; });
  }
  var nodes = 0, deadline = 0, stop = false;
  function quiesce(P, a, b, qd) {
    nodes++;
    var stand = evaluate(P);
    if (stand >= b) return b;
    if (a < stand) a = stand;
    if (qd <= 0) return a;
    var ms = order(legal(P, true));
    for (var i = 0; i < ms.length; i++) {
      var u = make(P, ms[i]); var sc = -quiesce(P, -b, -a, qd - 1); unmake(P, u);
      if (sc >= b) return b; if (sc > a) a = sc;
    }
    return a;
  }
  function search(P, depth, a, b, ply) {
    if ((++nodes & 1023) === 0 && Date.now() > deadline) stop = true;
    if (stop) return 0;
    if (depth <= 0) return quiesce(P, a, b, 4);
    var ms = legal(P, false);
    if (!ms.length) return inCheck(P, P.turn) ? -100000 + ply : 0;
    if (P.half >= 100) return 0;
    order(ms);
    for (var i = 0; i < ms.length; i++) {
      var u = make(P, ms[i]); var sc = -search(P, depth - 1, -b, -a, ply + 1); unmake(P, u);
      if (stop) return 0;
      if (sc >= b) return b; if (sc > a) a = sc;
    }
    return a;
  }
  var LEVELS = { facil: { depth: 1, noise: 120, ms: 400 }, medio: { depth: 2, noise: 25, ms: 1200 }, dificil: { depth: 4, noise: 0, ms: 2500 } };
  function bestMove(P, lvl) {
    var L = LEVELS[lvl] || LEVELS.medio, ms = order(legal(P, false));
    if (!ms.length) return null;
    deadline = Date.now() + L.ms; stop = false; nodes = 0;
    var best = ms[0], d;
    for (d = 1; d <= L.depth; d++) { // aprofunda aos poucos; para se o tempo acabar
      var a = -Infinity, cand = null, scored = [];
      for (var i = 0; i < ms.length; i++) {
        var u = make(P, ms[i]); var sc = -search(P, d - 1, -1e9, 1e9, 1); unmake(P, u);
        if (stop) break;
        sc += L.noise ? (Math.random() * 2 - 1) * L.noise : 0;
        scored.push([sc, ms[i]]);
        if (sc > a) { a = sc; cand = ms[i]; }
      }
      if (stop) break;
      best = cand || best;
      // próxima iteração começa pelos melhores
      ms = scored.sort(function (x, y) { return y[0] - x[0]; }).map(function (x) { return x[1]; });
    }
    return best;
  }

  /* ---------- notação ---------- */
  function san(P, m) {
    var s;
    if (m.flag === 'oo') s = 'O-O'; else if (m.flag === 'ooo') s = 'O-O-O';
    else {
      var l = m.pc.toLowerCase(), letter = { n: 'C', b: 'B', r: 'T', q: 'D', k: 'R', p: '' }[l];
      s = letter;
      if (l !== 'p') {
        var amb = legal(P, false).filter(function (x) { return x.pc === m.pc && x.t === m.t && x.f !== m.f; });
        if (amb.length) { var sf = amb.some(function (x) { return (x.f & 7) === (m.f & 7); }); s += sf ? sqName(m.f)[1] : sqName(m.f)[0]; if (sf && amb.some(function (x) { return (x.f >> 3) === (m.f >> 3); })) s = letter + sqName(m.f); }
      }
      if (m.cap) s += (l === 'p' ? sqName(m.f)[0] : '') + 'x';
      s += sqName(m.t);
      if (m.promo) s += '=' + { q: 'D', r: 'T', b: 'B', n: 'C' }[m.promo];
    }
    var u = make(P, m); var chk = inCheck(P, P.turn), mate = chk && !legal(P, false).length; unmake(P, u);
    return s + (mate ? '#' : chk ? '+' : '');
  }

  /* ================= estado do jogo ================= */
  var G = null;
  function newGame(side, lvl) {
    G = { P: parseFen(START), side: side || 'w', lvl: lvl || 'medio', hist: [], sans: [], reps: {}, over: null, sel: -1, last: null, flip: false };
    G.reps[posKey(G.P)] = 1;
    save();
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify({ side: G.side, lvl: G.lvl, moves: G.hist.map(function (h) { return [h.m.f, h.m.t, h.m.promo]; }) })); } catch (e) {}
  }
  function load() {
    try {
      var d = JSON.parse(localStorage.getItem(STORE) || 'null'); if (!d) return false;
      newGame(d.side, d.lvl);
      (d.moves || []).forEach(function (x) {
        var m = legal(G.P, false).filter(function (y) { return y.f === x[0] && y.t === x[1] && (y.promo || null) === (x[2] || null); })[0];
        if (m) apply(m, true);
      });
      return true;
    } catch (e) { return false; }
  }
  function apply(m, quiet) {
    var s = san(G.P, m);
    var u = make(G.P, m);
    G.hist.push(u); G.sans.push(s); G.last = { f: m.f, t: m.t };
    var k = posKey(G.P); G.reps[k] = (G.reps[k] || 0) + 1;
    G.over = result();
    if (!quiet) save();
  }
  function result() {
    var P = G.P, ms = legal(P, false);
    if (!ms.length) return inCheck(P, P.turn) ? { kind: 'mate', win: P.turn === 'w' ? 'b' : 'w' } : { kind: 'stale' };
    if (P.half >= 100) return { kind: 'fifty' };
    if (G.reps[posKey(P)] >= 3) return { kind: 'rep' };
    if (insufficient(P)) return { kind: 'mat' };
    return null;
  }
  function undoOne() {
    var u = G.hist.pop(); if (!u) return;
    var k = posKey(G.P); G.reps[k]--;
    unmake(G.P, u); G.sans.pop();
    var prev = G.hist[G.hist.length - 1]; G.last = prev ? { f: prev.m.f, t: prev.m.t } : null;
    G.over = null;
  }

  /* ================= telas ================= */
  var ov = null, stack = [], thinking = false, aiTimer = null;
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }

  function openOverlay() {
    if (ov) return;
    ov = el('<div class="cx-ov" role="dialog" aria-modal="true"><div class="cx-top"></div><div class="cx-body"></div></div>');
    document.body.appendChild(ov);
    document.body.classList.add('cc-locked');
  }
  function closeOverlay() {
    clearTimeout(aiTimer); thinking = false;
    if (ov) ov.remove(); ov = null; stack = [];
    document.body.classList.remove('cc-locked');
  }
  function show(name, push) {
    if (push !== false) stack.push(name);
    var top = ov.querySelector('.cx-top'), body = ov.querySelector('.cx-body');
    var titles = { comunidade: ['Frase a Frase', 'Comunidade'], jogos: ['Comunidade', 'Jogos'], xadrez: ['Jogos', 'Xadrez'] };
    var t = titles[name];
    top.innerHTML = '<button type="button" class="cx-back" aria-label="Voltar">' + svgIc(IC.back, 20) + '</button>' +
      '<div class="cx-ttl"><small>' + t[0] + '</small><strong>' + t[1] + '</strong></div><span class="cx-exp">Experimental</span>';
    top.querySelector('.cx-back').onclick = goBack;
    body.scrollTop = 0;
    if (name === 'comunidade') {
      body.innerHTML = '<h1 class="cx-h1">Comunidade</h1><p class="cx-p">Um espaço para fazer uma pausa nos estudos. Por enquanto, tem jogos.</p>' +
        card('jogos', IC.game, 'Jogos', 'Jogue contra a máquina');
    } else if (name === 'jogos') {
      body.innerHTML = '<h1 class="cx-h1">Jogos</h1><p class="cx-p">Escolha um jogo.</p>' +
        card('xadrez', IC.knight, 'Xadrez', G && G.hist.length && !G.over ? 'Continuar partida contra a máquina' : 'Você contra a máquina, em 3 níveis');
    } else if (name === 'xadrez') {
      if (!G && !load()) newGame('w', 'medio');
      body.innerHTML = '';
      body.appendChild(chessView());
      paintBoard(); maybeAi();
    }
    body.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function () { show(b.getAttribute('data-go')); }; });
  }
  function card(go, ic, title, sub) {
    return '<button type="button" class="cx-card" data-go="' + go + '"><span class="cx-ic">' + svgIc(ic, 24) + '</span><span class="cx-tx"><strong>' + title + '</strong><span>' + sub + '</span></span><span class="cx-go">' + svgIc(IC.chev, 20) + '</span></button>';
  }
  function goBack() {
    if (!ov) return false;
    if (ov.querySelector('.cx-modal')) { ov.querySelector('.cx-modal').remove(); return true; }
    clearTimeout(aiTimer); thinking = false;
    stack.pop();
    if (!stack.length) { closeOverlay(); return true; }
    show(stack[stack.length - 1], false);
    return true;
  }

  /* ---------- tela do xadrez ---------- */
  var V = {};
  function chessView() {
    var root = el('<div class="cx-game">' +
      '<div class="cx-bar"><div class="cx-who" data-c="opp"><span class="cx-dot"></span><span>Máquina</span></div><div class="cx-caps" data-caps="opp"></div></div>' +
      '<div class="cx-board-wrap"><div class="cx-board" role="grid" aria-label="Tabuleiro"></div></div>' +
      '<div class="cx-bar"><div class="cx-who" data-c="me"><span class="cx-dot"></span><span>Você</span></div><div class="cx-caps" data-caps="me"></div></div>' +
      '<div class="cx-status" aria-live="polite"></div>' +
      '<div class="cx-tools">' +
        '<button type="button" class="cx-btn" data-a="undo">' + svgIc(IC.undo, 18) + 'Desfazer</button>' +
        '<button type="button" class="cx-btn" data-a="flip">' + svgIc(IC.flip, 18) + 'Girar</button>' +
        '<button type="button" class="cx-btn is-main" data-a="new">' + svgIc(IC.plus, 18) + 'Nova</button>' +
      '</div>' +
      '<div class="cx-lbl">Lances</div><div class="cx-moves"></div>' +
      '</div>');
    V = { root: root, board: root.querySelector('.cx-board'), status: root.querySelector('.cx-status'), moves: root.querySelector('.cx-moves') };
    for (var i = 0; i < 64; i++) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'cx-sq';
      b.addEventListener('click', onSquare);
      V.board.appendChild(b);
    }
    root.querySelector('[data-a="undo"]').onclick = function () {
      if (thinking) return;
      clearTimeout(aiTimer);
      // volta até ser a vez do jogador
      undoOne(); while (G.hist.length && G.P.turn !== G.side) undoOne();
      G.sel = -1; save(); paintBoard(); maybeAi();
    };
    root.querySelector('[data-a="flip"]').onclick = function () { G.flip = !G.flip; paintBoard(); };
    root.querySelector('[data-a="new"]').onclick = newGameDialog;
    return root;
  }
  function viewIdx(k) { // posição k na grade -> índice da casa
    var black = (G.side === 'b') !== G.flip;
    return black ? 63 - k : k;
  }
  function paintBoard(anim) {
    if (!ov || !V.board) return;
    var P = G.P, sel = G.sel, moves = sel >= 0 ? legal(P, false).filter(function (m) { return m.f === sel; }) : [];
    var chk = !G.over || G.over.kind === 'mate' ? (inCheck(P, P.turn) ? kingSq(P, P.turn) : -1) : -1;
    var sqs = V.board.children;
    for (var k = 0; k < 64; k++) {
      var i = viewIdx(k), b = sqs[k], r = i >> 3, c = i & 7;
      var cls = 'cx-sq ' + (((r + c) & 1) ? 'd' : 'l');
      if (G.last && (G.last.f === i || G.last.t === i)) cls += ' is-last';
      if (i === sel) cls += ' is-sel';
      if (i === chk) cls += ' is-check';
      var mv = moves.filter(function (m) { return m.t === i; })[0];
      if (mv) cls += mv.cap ? ' is-cap' : ' is-move';
      b.className = cls;
      b.dataset.i = i;
      var html = P.b[i] ? pieceSvg(P.b[i], anim && G.last && G.last.t === i ? 'is-new' : '') : '';
      var rowEdge = k % 8 === 0, colEdge = k >= 56;
      if (rowEdge) html += '<span class="cx-coord r">' + (8 - r) + '</span>';
      if (colEdge) html += '<span class="cx-coord f">' + 'abcdefgh'[c] + '</span>';
      if (b.__h !== html) { b.innerHTML = html; b.__h = html; }
      b.setAttribute('aria-label', sqName(i) + (P.b[i] ? ' ' + P.b[i] : ''));
    }
    // jogadores, capturas
    var opp = G.side === 'w' ? 'b' : 'w';
    var meEl = V.root.querySelector('[data-c="me"]'), opEl = V.root.querySelector('[data-c="opp"]');
    meEl.querySelector('.cx-dot').className = 'cx-dot ' + G.side; opEl.querySelector('.cx-dot').className = 'cx-dot ' + opp;
    meEl.classList.toggle('is-turn', P.turn === G.side && !G.over); opEl.classList.toggle('is-turn', P.turn === opp && !G.over);
    var capBy = { w: [], b: [] }, matW = 0, matB = 0;
    G.hist.forEach(function (u) { if (u.capPc) capBy[isW(u.capPc) ? 'b' : 'w'].push(u.capPc); });
    P.b.forEach(function (p) { if (p) { if (isW(p)) matW += VAL[p.toLowerCase()]; else matB += VAL[p.toLowerCase()]; } });
    function capsHtml(col) {
      var list = capBy[col].slice().sort(function (a, b) { return VAL[b.toLowerCase()] - VAL[a.toLowerCase()]; });
      var diff = Math.round(((col === 'w' ? matW - matB : matB - matW)) / 100);
      return list.map(function (p) { return pieceSvg(p); }).join('') + (diff > 0 ? '<span class="cx-adv">+' + diff + '</span>' : '');
    }
    V.root.querySelector('[data-caps="me"]').innerHTML = capsHtml(G.side);
    V.root.querySelector('[data-caps="opp"]').innerHTML = capsHtml(opp);
    // situação
    var s = '', cls2 = 'cx-status';
    if (G.over) {
      cls2 += ' is-end';
      s = { mate: G.over.win === G.side ? 'Xeque-mate! Você venceu.' : 'Xeque-mate. A máquina venceu.', stale: 'Empate por afogamento.', fifty: 'Empate pela regra dos 50 lances.', rep: 'Empate por repetição.', mat: 'Empate: material insuficiente.' }[G.over.kind];
    } else if (thinking) { s = 'A máquina está pensando…'; cls2 += ' is-think'; }
    else if (P.turn === G.side) s = inCheck(P, P.turn) ? 'Xeque! Proteja o rei.' : 'Sua vez.';
    else s = 'Vez da máquina.';
    V.status.className = cls2; V.status.textContent = s;
    // lances
    var mv2 = '';
    for (var j = 0; j < G.sans.length; j += 2) mv2 += '<b>' + (j / 2 + 1) + '.</b> ' + G.sans[j] + (G.sans[j + 1] ? ' ' + G.sans[j + 1] : '') + '  ';
    V.moves.innerHTML = mv2 || 'Nenhum lance ainda. As brancas começam.';
    V.moves.scrollTop = V.moves.scrollHeight;
    V.root.querySelector('[data-a="undo"]').disabled = !G.hist.length || thinking;
  }
  function onSquare(e) {
    if (!G || G.over || thinking || G.P.turn !== G.side) return;
    var i = +e.currentTarget.dataset.i, P = G.P, p = P.b[i];
    if (G.sel >= 0) {
      var opts = legal(P, false).filter(function (m) { return m.f === G.sel && m.t === i; });
      if (opts.length) {
        if (opts.length > 1) { promoDialog(opts); return; }
        play(opts[0]); return;
      }
    }
    G.sel = p && colorOf(p) === G.side && G.sel !== i ? i : -1;
    paintBoard();
  }
  function play(m) {
    G.sel = -1; apply(m); paintBoard(true); maybeAi();
  }
  function maybeAi() {
    if (!G || G.over || G.P.turn === G.side || thinking) return;
    thinking = true; paintBoard();
    aiTimer = setTimeout(function () {
      var m = bestMove(G.P, G.lvl);
      thinking = false;
      if (!ov || !m) { paintBoard(); return; }
      apply(m); paintBoard(true);
      if (G.over) setTimeout(endDialog, 500);
    }, 380);
  }
  function modal(inner) {
    var old = ov.querySelector('.cx-modal'); if (old) old.remove();
    var m = el('<div class="cx-modal"><div class="cx-box">' + inner + '</div></div>');
    m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
    ov.appendChild(m); return m;
  }
  function promoDialog(opts) {
    var col = G.side === 'w';
    var m = modal('<h3>Promover peão</h3><p>Escolha a nova peça.</p><div class="cx-promo">' +
      ['q', 'r', 'b', 'n'].map(function (x) { return '<button type="button" data-p="' + x + '" aria-label="' + { q: 'Dama', r: 'Torre', b: 'Bispo', n: 'Cavalo' }[x] + '">' + pieceSvg(col ? x.toUpperCase() : x) + '</button>'; }).join('') + '</div>');
    m.querySelectorAll('[data-p]').forEach(function (b) { b.onclick = function () { var x = b.getAttribute('data-p'); m.remove(); play(opts.filter(function (o) { return o.promo === x; })[0]); }; });
  }
  function newGameDialog() {
    var side = G.side, lvl = G.lvl;
    var m = modal('<h3>Nova partida</h3>' +
      '<div class="cx-lbl" style="text-align:left">Jogar com</div><div class="cx-seg" data-g="side"><button type="button" data-v="w">Brancas</button><button type="button" data-v="b">Pretas</button><button type="button" data-v="r">Sorteio</button></div>' +
      '<div class="cx-lbl" style="text-align:left">Nível da máquina</div><div class="cx-seg" data-g="lvl"><button type="button" data-v="facil">Fácil</button><button type="button" data-v="medio">Médio</button><button type="button" data-v="dificil">Difícil</button></div>' +
      '<button type="button" class="cx-btn is-main" data-a="go">Começar</button><button type="button" class="cx-btn" data-a="cancel">Cancelar</button>');
    function sync() {
      m.querySelectorAll('[data-g="side"] button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === side)); });
      m.querySelectorAll('[data-g="lvl"] button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === lvl)); });
    }
    m.querySelectorAll('[data-g="side"] button').forEach(function (b) { b.onclick = function () { side = b.dataset.v; sync(); }; });
    m.querySelectorAll('[data-g="lvl"] button').forEach(function (b) { b.onclick = function () { lvl = b.dataset.v; sync(); }; });
    m.querySelector('[data-a="cancel"]').onclick = function () { m.remove(); };
    m.querySelector('[data-a="go"]').onclick = function () {
      clearTimeout(aiTimer); thinking = false;
      newGame(side === 'r' ? (Math.random() < .5 ? 'w' : 'b') : side, lvl);
      m.remove(); paintBoard(); maybeAi();
    };
    sync();
  }
  function endDialog() {
    if (!ov || !G.over || ov.querySelector('.cx-modal')) return;
    var win = G.over.kind === 'mate' && G.over.win === G.side, lose = G.over.kind === 'mate' && !win;
    var m = modal('<h3>' + (win ? 'Você venceu!' : lose ? 'Não foi dessa vez' : 'Empate') + '</h3><p>' + V.status.textContent + '</p>' +
      '<button type="button" class="cx-btn is-main" data-a="again">Jogar de novo</button><button type="button" class="cx-btn" data-a="close">Ver tabuleiro</button>');
    m.querySelector('[data-a="again"]').onclick = function () { m.remove(); newGameDialog(); };
    m.querySelector('[data-a="close"]').onclick = function () { m.remove(); };
  }

  /* ================= menu lateral ================= */
  function inject() {
    var panel = document.querySelector('#faf-menu .fm-panel'); if (!panel || panel.querySelector('[data-id="comunidade"]')) return;
    var secs = panel.querySelectorAll('.fm-sec'), conta = null;
    secs.forEach(function (s) { if (/conta/i.test(s.textContent)) conta = s; });
    var sec = el('<div class="fm-sec">Comunidade</div>');
    var item = el('<button type="button" class="fm-item" data-id="comunidade"><span class="fm-ic">' + svgIc(IC.people, 20) + '</span><span class="fm-txt"><span>Comunidade</span><small>Jogos</small></span><span class="fm-tag">Teste</span></button>');
    item.addEventListener('click', function (e) {
      e.stopPropagation();
      var close = document.querySelector('#faf-menu .fm-close'); if (close) close.click();
      openOverlay(); show('comunidade');
    });
    if (conta) { panel.insertBefore(sec, conta); panel.insertBefore(item, conta); }
    else { panel.appendChild(sec); panel.appendChild(item); }
  }
  function watchMenu() {
    var menu = document.getElementById('faf-menu');
    if (!menu) { setTimeout(watchMenu, 300); return; }
    new MutationObserver(inject).observe(menu, { childList: true, subtree: true });
    inject();
  }
  watchMenu();

  /* ================= botão voltar do celular ================= */
  // Roda antes do controle de voltar do app (captura) e só age com a Comunidade aberta.
  window.addEventListener('popstate', function (e) {
    if (!ov) return;
    e.stopImmediatePropagation();
    goBack();
    var st = history.state, d = st && st.faf ? (st.d || 0) : 0;
    if (d === 0) { try { history.pushState({ faf: 1, d: 1 }, ''); } catch (er) {} }
  }, true);

  window.FAF_COMUNIDADE = { open: function (where) { openOverlay(); show('comunidade'); if (where === 'jogos' || where === 'xadrez') show('jogos'); if (where === 'xadrez') show('xadrez'); }, close: closeOverlay };
})();
