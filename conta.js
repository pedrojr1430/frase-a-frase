/* Frase a Frase — conta e sincronização (Supabase)
   Entrar com Google ou com e-mail e senha (com "Esqueci minha senha").
   O login é opcional: sem conta, tudo continua só no aparelho.
   O progresso (todas as chaves fraseafrase.*) vai para a tabela `progresso`, uma linha por chave.
   Regra de conflito: vence a alteração mais recente de cada chave.
   Para ligar: preencher CONFIG.url e CONFIG.anonKey (ver supabase/LEIA-ME.md). */
(function () {
  'use strict';

  var CONFIG = {
    url: '',      // ex.: https://xxxxxxxx.supabase.co
    anonKey: ''   // chave pública "anon" (pode ficar no site)
  };
  var LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
  var SKIP = { 'fraseafrase.trcache': 1, 'fraseafrase.sync': 1 };
  var META_KEY = 'fraseafrase.sync';
  var HOME = location.origin + location.pathname.replace(/[^/]*$/, '');

  var configured = !!(CONFIG.url && CONFIG.anonKey);
  var frozen = false; // depois de baixar da nuvem, nada regrava o aparelho até recarregar
  var sb = null, user = null, ready = false, tracking = false, applying = false;
  var dirty = {}, timer = null, lastSync = null, syncing = false, syncErr = '';
  var listeners = [];

  function tracked(k) { return k && k.indexOf('fraseafrase.') === 0 && !SKIP[k]; }
  function meta() { try { return JSON.parse(localStorage.getItem(META_KEY) || '{}') || {}; } catch (e) { return {}; } }
  function saveMeta(m) { try { _set.call(localStorage, META_KEY, JSON.stringify(m)); } catch (e) {} }
  function emit() { listeners.forEach(function (f) { try { f(); } catch (e) {} }); }

  // ---------- registro de alterações locais ----------
  var _set = Storage.prototype.setItem, _rem = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (k, v) {
    if (frozen && this === localStorage && tracked(k)) return;
    var before = this === localStorage && tracked(k) ? localStorage.getItem(k) : null;
    _set.call(this, k, v);
    if (this === localStorage && tracked(k) && !applying && before !== String(v)) touch(k);
  };
  Storage.prototype.removeItem = function (k) {
    if (frozen && this === localStorage && tracked(k)) return;
    _rem.call(this, k);
    if (this === localStorage && tracked(k) && !applying) touch(k);
  };
  function touch(k) {
    if (!tracking || !user || window.__fafWiping) return;
    var m = meta(); m.m = m.m || {}; m.m[k] = Date.now(); saveMeta(m);
    dirty[k] = 1;
    clearTimeout(timer); timer = setTimeout(flush, 2500);
  }

  function localKeys() {
    var out = [];
    for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (tracked(k)) out.push(k); }
    return out;
  }
  // Há progresso de verdade neste aparelho? (o app grava um estado vazio ao abrir, isso não conta)
  function hasLocalProgress() {
    function obj(k) { try { return JSON.parse(localStorage.getItem(k) || 'null') || {}; } catch (e) { return {}; } }
    function n(o) { return o && typeof o === 'object' ? Object.keys(o).length : 0; }
    var a = obj('fraseafrase.v2'), c = obj('fraseafrase.curso');
    return n(a.known) + n(a.review) + n(a.read) + n(a.heard) + (Array.isArray(a.mine) ? a.mine.length : 0) > 0 ||
      (c.xp || 0) > 0 || n(c.lessons) > 0;
  }

  // ---------- envio ----------
  function flush() {
    clearTimeout(timer);
    var keys = Object.keys(dirty);
    if (!keys.length || !user || !sb) return Promise.resolve();
    dirty = {};
    var m = meta(); m.m = m.m || {};
    var rows = [], gone = [];
    keys.forEach(function (k) {
      var v = localStorage.getItem(k);
      var t = new Date(m.m[k] || Date.now()).toISOString();
      if (v === null) gone.push(k); else rows.push({ user_id: user.id, chave: k, dados: v, atualizado_em: t });
    });
    syncing = true; emit();
    var jobs = [];
    if (rows.length) jobs.push(sb.from('progresso').upsert(rows, { onConflict: 'user_id,chave' }));
    if (gone.length) jobs.push(sb.from('progresso').delete().eq('user_id', user.id).in('chave', gone));
    return Promise.all(jobs).then(function (res) {
      var err = res.filter(function (r) { return r && r.error; })[0];
      if (err) throw err.error;
      lastSync = new Date(); syncErr = '';
    }).catch(function (e) {
      keys.forEach(function (k) { dirty[k] = 1; });
      syncErr = 'Sem conexão. Tentamos de novo em seguida.';
      clearTimeout(timer); timer = setTimeout(flush, 30000);
    }).then(function () { syncing = false; emit(); });
  }

  // ---------- recebimento ----------
  function fetchCloud() {
    return sb.from('progresso').select('chave,dados,atualizado_em').eq('user_id', user.id).then(function (r) {
      if (r.error) throw r.error;
      return r.data || [];
    });
  }
  function applyRows(rows, replaceAll) {
    var m = meta(); m.m = m.m || {};
    applying = true;
    try {
      if (replaceAll) localKeys().forEach(function (k) { if (!rows.some(function (r) { return r.chave === k; })) { _rem.call(localStorage, k); delete m.m[k]; } });
      rows.forEach(function (r) { _set.call(localStorage, r.chave, r.dados); m.m[r.chave] = Date.parse(r.atualizado_em) || Date.now(); });
    } finally { applying = false; }
    m.uid = user.id; saveMeta(m);
    frozen = true; window.__fafWiping = true; // o app recarrega em seguida com o progresso da nuvem
  }
  function pushAll() {
    var m = meta(); m.m = m.m || {};
    localKeys().forEach(function (k) { if (!m.m[k]) m.m[k] = Date.now(); dirty[k] = 1; });
    m.uid = user.id; saveMeta(m);
    return flush();
  }

  // Ao abrir o app (ou ao entrar): junta nuvem e aparelho.
  function pull(first) {
    return fetchCloud().then(function (rows) {
      var m = meta();
      var sameUser = m.uid === user.id;
      if (!sameUser) {
        // Primeiro acesso desta conta neste aparelho.
        if (!rows.length) return pushAll().then(function () { return false; });
        if (!hasLocalProgress()) { applyRows(rows, true); return true; }
        return chooseSide().then(function (side) {
          if (side === 'cloud') { applyRows(rows, true); return true; }
          return sb.from('progresso').delete().eq('user_id', user.id).then(function () { m.m = {}; m.uid = user.id; saveMeta(m); return pushAll(); }).then(function () { return false; });
        });
      }
      // Mesma conta: vence o mais recente de cada chave.
      m.m = m.m || {};
      var take = [], cloudKeys = {};
      rows.forEach(function (r) {
        cloudKeys[r.chave] = 1;
        var tc = Date.parse(r.atualizado_em) || 0, tl = m.m[r.chave] || 0;
        if (tc > tl && localStorage.getItem(r.chave) !== r.dados) take.push(r);
        else if (tl > tc) dirty[r.chave] = 1;
      });
      localKeys().forEach(function (k) { if (!cloudKeys[k]) { if (!m.m[k]) { m.m[k] = Date.now(); saveMeta(m); } dirty[k] = 1; } });
      if (take.length) applyRows(take, false);
      return flush().then(function () { return take.length > 0; });
    }).then(function (changed) {
      lastSync = new Date(); syncErr = '';
      if (changed) { try { sessionStorage.setItem('faf.synced', '1'); } catch (e) {} location.reload(); return; }
    }).catch(function () {
      syncErr = 'Não foi possível sincronizar agora. O progresso continua salvo neste aparelho.';
    }).then(function () { tracking = true; emit(); });
  }

  // ---------- biblioteca e sessão ----------
  function loadLib() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    return new Promise(function (ok, fail) {
      var s = document.createElement('script'); s.src = LIB; s.async = true;
      s.onload = ok; s.onerror = function () { fail(new Error('lib')); };
      document.head.appendChild(s);
    });
  }
  function start() {
    if (!configured) { ready = true; tracking = true; emit(); return; }
    loadLib().then(function () {
      sb = window.supabase.createClient(CONFIG.url, CONFIG.anonKey, {
        auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'faf-auth' }
      });
      sb.auth.onAuthStateChange(function (ev, session) {
        var was = user && user.id;
        user = session ? session.user : null;
        if (ev === 'PASSWORD_RECOVERY') { setTimeout(function () { openSheet('nova-senha'); }, 300); }
        if (user && user.id !== was && ready) { tracking = false; pull(); }
        emit();
      });
      return sb.auth.getSession();
    }).then(function (r) {
      user = r && r.data && r.data.session ? r.data.session.user : null;
      ready = true; emit();
      if (user) return pull(); tracking = true;
    }).catch(function () { ready = true; tracking = true; syncErr = 'Não foi possível carregar o login. Verifique a internet.'; emit(); });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });
    try { if (sessionStorage.getItem('faf.synced')) { sessionStorage.removeItem('faf.synced'); setTimeout(function () { note('Progresso atualizado com a sua conta.'); }, 900); } } catch (e) {}
  }

  // ---------- ações ----------
  function friendly(e) {
    var msg = (e && (e.message || e.error_description)) || '';
    if (/Invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
    if (/Email not confirmed/i.test(msg)) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
    if (/already registered|already been registered/i.test(msg)) return 'Já existe uma conta com este e-mail. Use "Entrar" ou "Esqueci minha senha".';
    if (/Password should be at least/i.test(msg)) return 'A senha precisa ter pelo menos 8 caracteres.';
    if (/rate limit|too many/i.test(msg)) return 'Muitas tentativas. Espere alguns minutos e tente de novo.';
    if (/not authorized/i.test(msg)) return 'O envio de e-mails ainda não está configurado. Tente entrar com o Google.';
    if (/fetch|network/i.test(msg)) return 'Sem conexão com a internet.';
    return 'Algo deu errado. Tente de novo.';
  }
  function google() {
    return sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: HOME, queryParams: { prompt: 'select_account' } } });
  }
  function signIn(email, pass) {
    return sb.auth.signInWithPassword({ email: email, password: pass }).then(function (r) { if (r.error) throw r.error; return r; });
  }
  function signUp(email, pass) {
    return sb.auth.signUp({ email: email, password: pass, options: { emailRedirectTo: HOME } }).then(function (r) {
      if (r.error) throw r.error;
      if (r.data && r.data.user && r.data.user.identities && !r.data.user.identities.length) throw new Error('already registered');
      return r;
    });
  }
  function resetPass(email) {
    return sb.auth.resetPasswordForEmail(email, { redirectTo: HOME }).then(function (r) { if (r.error) throw r.error; });
  }
  function newPass(pass) {
    return sb.auth.updateUser({ password: pass }).then(function (r) { if (r.error) throw r.error; });
  }
  function signOut() {
    return flush().catch(function () {}).then(function () { return sb.auth.signOut(); }).then(function () {
      var m = meta(); delete m.uid; m.m = {}; saveMeta(m); user = null; emit();
    });
  }
  function deleteAccount() {
    if (!sb || !user) return Promise.resolve();
    clearTimeout(timer); dirty = {};
    return sb.rpc('excluir_minha_conta').then(function (r) { if (r.error) throw r.error; return sb.auth.signOut(); })
      .then(function () { user = null; });
  }

  // ---------- telas ----------
  var GOOGLE_G = '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
  var EYE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  var X = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  var CLOUD = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 0 0 4.6 12.5 3.5 3.5 0 0 0 6.5 19h11Z"/></svg>';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var sheet = null, mode = 'entrar', msg = null, busy = false, lastEmail = '';

  function openSheet(m) {
    mode = m || (user ? 'conta' : 'entrar'); msg = null;
    if (!sheet) {
      sheet = document.createElement('div'); sheet.className = 'fa-wrap';
      sheet.innerHTML = '<div class="fa-back"></div><section class="fa-sheet" role="dialog" aria-modal="true" aria-labelledby="fa-title"></section>';
      document.body.appendChild(sheet);
      sheet.addEventListener('click', onClick);
      sheet.addEventListener('submit', onSubmit);
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheet && !sheet.hidden) closeSheet(); });
    }
    sheet.hidden = false; document.body.classList.add('fa-open');
    paint();
    var f = sheet.querySelector('input, .fa-btn'); if (f) setTimeout(function () { f.focus(); }, 60);
  }
  function closeSheet() { if (!sheet) return; sheet.hidden = true; document.body.classList.remove('fa-open'); }

  function input(id, label, type, ac, val) {
    var pass = type === 'password';
    return '<label class="fa-field" for="' + id + '"><span>' + label + '</span><span class="fa-inp"><input id="' + id + '" name="' + id + '" type="' + type + '" autocomplete="' + ac + '" value="' + esc(val || '') + '" required' +
      (pass ? ' minlength="8"' : '') + (type === 'email' ? ' inputmode="email" autocapitalize="off" spellcheck="false"' : '') + '>' +
      (pass ? '<button type="button" class="fa-eye" data-act="eye" aria-label="Mostrar senha">' + EYE + '</button>' : '') + '</span></label>';
  }
  function msgHtml() { return msg ? '<p class="fa-msg' + (msg.ok ? ' is-ok' : '') + '" role="' + (msg.ok ? 'status' : 'alert') + '">' + esc(msg.t) + '</p>' : ''; }

  function paint() {
    if (!sheet) return;
    var box = sheet.querySelector('.fa-sheet'), h = '';
    h += '<div class="fa-top"><button type="button" class="fa-x" data-act="close" aria-label="Fechar">' + X + '</button></div>';
    if (!configured) {
      h += '<div class="fa-hero">' + CLOUD + '</div><h2 id="fa-title">Entrar no Frase a Frase</h2>' +
        '<p class="fa-lead">O login está sendo configurado. Em breve você poderá entrar com o Google ou com seu e-mail e levar o progresso para qualquer aparelho.</p>' +
        '<button type="button" class="fa-btn is-google" disabled>' + GOOGLE_G + 'Continuar com Google</button>' +
        '<p class="fa-small">Por enquanto o progresso fica salvo neste aparelho.</p>';
    } else if (!ready) {
      h += '<h2 id="fa-title">Conta</h2><p class="fa-lead">Carregando…</p>';
    } else if (mode === 'nova-senha') {
      h += '<h2 id="fa-title">Criar nova senha</h2><p class="fa-lead">Digite a nova senha da sua conta.</p>' +
        '<form class="fa-form" data-form="nova-senha" novalidate>' + input('fa-pass', 'Nova senha (mínimo 8 caracteres)', 'password', 'new-password') + msgHtml() +
        '<button type="submit" class="fa-btn is-main"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Salvando…' : 'Salvar nova senha') + '</button></form>';
    } else if (user) {
      var md = user.user_metadata || {};
      var name = md.full_name || md.name || '';
      var pic = md.avatar_url || md.picture || '';
      var via = (user.app_metadata && user.app_metadata.provider) === 'google' ? 'Conta Google' : 'E-mail e senha';
      var st = syncing ? 'Sincronizando…' : syncErr ? syncErr : lastSync ? 'Sincronizado às ' + lastSync.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Progresso salvo na nuvem';
      h += '<div class="fa-user">' + (pic ? '<img src="' + esc(pic) + '" alt="" referrerpolicy="no-referrer">' : '<span class="fa-ini">' + esc((name || user.email || '?').charAt(0).toUpperCase()) + '</span>') +
        '<div><h2 id="fa-title">' + esc(name || 'Minha conta') + '</h2><p>' + esc(user.email || '') + '</p><small>' + via + '</small></div></div>' +
        '<div class="fa-sync' + (syncErr ? ' is-err' : '') + '">' + CLOUD + '<span>' + esc(st) + '</span></div>' +
        '<p class="fa-small">Seu progresso (frases, textos, curso e preferências) fica salvo na conta. Entre com ela em outro celular ou no computador para continuar de onde parou.</p>' +
        msgHtml() +
        '<button type="button" class="fa-btn is-light" data-act="sync">Sincronizar agora</button>' +
        (via === 'E-mail e senha' ? '<button type="button" class="fa-btn is-light" data-act="to-nova-senha">Trocar senha</button>' : '') +
        '<button type="button" class="fa-btn is-light" data-act="sair">Sair da conta</button>' +
        '<button type="button" class="fa-link is-danger" data-act="excluir">Excluir conta</button>';
    } else if (mode === 'esqueci') {
      h += '<h2 id="fa-title">Esqueci minha senha</h2><p class="fa-lead">Digite o e-mail da sua conta. Enviaremos um link para criar uma senha nova.</p>' +
        '<form class="fa-form" data-form="esqueci" novalidate>' + input('fa-email', 'E-mail', 'email', 'email', lastEmail) + msgHtml() +
        '<button type="submit" class="fa-btn is-main"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Enviando…' : 'Enviar link') + '</button></form>' +
        '<button type="button" class="fa-link" data-act="to-entrar">Voltar para entrar</button>';
    } else {
      var criar = mode === 'criar';
      h += '<div class="fa-hero">' + CLOUD + '</div><h2 id="fa-title">' + (criar ? 'Criar conta' : 'Entrar no Frase a Frase') + '</h2>' +
        '<p class="fa-lead">Guarde seu progresso na nuvem e continue em qualquer aparelho.</p>' +
        '<button type="button" class="fa-btn is-google" data-act="google">' + GOOGLE_G + 'Continuar com Google</button>' +
        '<div class="fa-or"><span>ou com seu e-mail</span></div>' +
        '<div class="fa-seg" role="tablist"><button type="button" role="tab" data-act="to-entrar" aria-selected="' + !criar + '">Entrar</button><button type="button" role="tab" data-act="to-criar" aria-selected="' + criar + '">Criar conta</button></div>' +
        '<form class="fa-form" data-form="' + mode + '" novalidate>' + input('fa-email', 'E-mail', 'email', 'email', lastEmail) +
        input('fa-pass', criar ? 'Crie uma senha (mínimo 8 caracteres)' : 'Senha', 'password', criar ? 'new-password' : 'current-password') + msgHtml() +
        '<button type="submit" class="fa-btn is-main"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Aguarde…' : criar ? 'Criar conta' : 'Entrar') + '</button></form>' +
        (criar ? '' : '<button type="button" class="fa-link" data-act="to-esqueci">Esqueci minha senha</button>') +
        '<p class="fa-small">O login é opcional. Sem conta, o progresso fica só neste aparelho. Ao entrar, você concorda com a <a href="privacidade.html" target="_blank" rel="noopener">Política de Privacidade</a>.</p>';
    }
    box.innerHTML = h;
  }

  function run(p, okMsg, after) {
    busy = true; msg = null; paint();
    return Promise.resolve(p).then(function () { busy = false; msg = okMsg ? { ok: true, t: okMsg } : null; if (after) after(); paint(); })
      .catch(function (e) { busy = false; msg = { t: friendly(e) }; paint(); });
  }

  function onClick(e) {
    if (e.target.classList.contains('fa-back')) { closeSheet(); return; }
    var b = e.target.closest('[data-act]'); if (!b) return;
    var a = b.getAttribute('data-act');
    var em = sheet.querySelector('#fa-email'); if (em) lastEmail = em.value.trim();
    if (a === 'close') closeSheet();
    else if (a === 'eye') { var i = b.parentNode.querySelector('input'); var show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha'); }
    else if (a.indexOf('to-') === 0) { mode = a.slice(3); msg = null; paint(); }
    else if (a === 'google') run(google().then(function (r) { if (r && r.error) throw r.error; }));
    else if (a === 'sync') run(pull(), null);
    else if (a === 'sair') {
      if (!window.confirm('Sair da conta? O progresso continua neste aparelho, mas deixa de ser sincronizado.')) return;
      run(signOut(), null, function () { mode = 'entrar'; });
    }
    else if (a === 'excluir') {
      closeSheet();
      var item = document.querySelector('.fm-item[data-id="excluir"]');
      if (window.FAF_MENU && window.FAF_MENU.confirmDelete) window.FAF_MENU.confirmDelete(); else if (item) item.click();
    }
  }
  function onSubmit(e) {
    e.preventDefault();
    var f = e.target, kind = f.getAttribute('data-form');
    var email = (f.querySelector('#fa-email') || {}).value, pass = (f.querySelector('#fa-pass') || {}).value;
    if (email !== undefined) { email = email.trim(); lastEmail = email; }
    if (email !== undefined && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { msg = { t: 'Digite um e-mail válido.' }; paint(); return; }
    if (pass !== undefined && pass.length < 8) { msg = { t: 'A senha precisa ter pelo menos 8 caracteres.' }; paint(); return; }
    if (kind === 'entrar') run(signIn(email, pass), null, function () { mode = 'conta'; });
    else if (kind === 'criar') run(signUp(email, pass).then(function (r) {
      if (r.data && r.data.session) return; // confirmação de e-mail desligada: já entrou
      throw { ok: true };
    }).catch(function (x) { if (x && x.ok) { msg = null; return 'sent'; } throw x; }).then(function (r) {
      if (r === 'sent') { mode = 'entrar'; setTimeout(function () { msg = { ok: true, t: 'Enviamos um link de confirmação para ' + email + '. Abra o e-mail, confirme e depois entre aqui.' }; paint(); }, 0); }
    }));
    else if (kind === 'esqueci') run(resetPass(email), 'Se existir uma conta com ' + email + ', enviamos um link para criar uma senha nova. Veja também a caixa de spam.');
    else if (kind === 'nova-senha') run(newPass(pass), 'Senha alterada.', function () { mode = 'conta'; });
  }

  // Escolha no primeiro acesso, quando aparelho e conta já têm progresso.
  function chooseSide() {
    return new Promise(function (done) {
      var w = document.createElement('div'); w.className = 'fm-modal';
      w.innerHTML = '<div class="fm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="fa-ch-t"><h2 id="fa-ch-t">Qual progresso manter?</h2>' +
        '<p>Este aparelho e a sua conta já têm progresso salvo. Escolha qual usar daqui para frente. O outro será substituído.</p>' +
        '<div class="fa-choice"><button type="button" class="fa-btn is-main" data-s="cloud">Usar o da conta</button><button type="button" class="fa-btn is-light" data-s="local">Usar o deste aparelho</button></div></div>';
      document.body.appendChild(w);
      w.addEventListener('click', function (e) { var b = e.target.closest('[data-s]'); if (!b) return; w.remove(); done(b.getAttribute('data-s')); });
    });
  }

  function note(t) {
    var n = document.createElement('div'); n.className = 'fa-note'; n.setAttribute('role', 'status'); n.textContent = t;
    document.body.appendChild(n); setTimeout(function () { n.classList.add('is-out'); setTimeout(function () { n.remove(); }, 400); }, 2800);
  }

  // ---------- ganchos usados pelo resto do app ----------
  window.FAF_ACCOUNT = {
    open: openSheet,
    close: closeSheet,
    isOpen: function () { return !!(sheet && !sheet.hidden); },
    user: function () { return user; },
    label: function () {
      if (user) return { label: 'Minha conta', sub: user.email || 'Conectado' };
      return { label: 'Entrar', sub: 'Google ou e-mail' };
    },
    onChange: function (f) { listeners.push(f); }
  };
  window.FAF_SYNC = {
    push: function () {}, // as gravações já são captadas automaticamente
    status: function () {
      if (!configured) return null;
      if (user) return { ready: true, text: 'Conectado como ' + (user.email || 'sua conta') + '. O progresso é salvo na nuvem automaticamente.', action: function () { openSheet('conta'); }, actionLabel: 'Minha conta' };
      return { ready: true, text: 'Entre com o Google ou com seu e-mail para guardar o progresso na nuvem e continuar em qualquer aparelho.', action: function () { openSheet('entrar'); }, actionLabel: 'Entrar' };
    },
    deleteAccount: deleteAccount
  };
  listeners.push(paint);
  listeners.push(function () { if (window.FAF_MENU) window.FAF_MENU.repaint(); });

  start();
})();
