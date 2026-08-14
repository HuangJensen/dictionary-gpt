// 纯静态词典查询：2/3字母分组 + 主题切换 + 顶部固定/滚动缩小 + 回到顶部
(function () {
  'use strict';
  var form = document.getElementById('search-form');
  var input = document.getElementById('q');
  var mode = document.getElementById('mode');
  var statusEl = document.getElementById('status');
  var resultsEl = document.getElementById('results');
  var cache = {};
  var keys = null;
  var fnames = null;
  var timer = null;

  var CDN = 'https://cdn.jsdelivr.net/gh/HuangJensen/dictionary-gpt@main/docs/static-data/';

  function esc(s) {
    var div = document.createElement('div');
    div.textContent = s == null ? '' : String(s);
    return div.innerHTML;
  }

  // 分组索引已内嵌在 keys.js
  keys = new Set(window.DICT_KEYS || []);

  function keyFor(q, keys) {
    var w = q.trim().toLowerCase();
    var m3 = w.match(/^([a-z])([a-z])([a-z])/);
    if (m3 && keys.has(m3[1] + m3[2] + m3[3])) return m3[1] + m3[2] + m3[3];
    var m2 = w.match(/^([a-z])([a-z])/);
    if (m2) return m2[1] + m2[2];
    if (/^[a-z]$/.test(w.charAt(0))) return w.charAt(0) + '0';
    return '00';
  }

  function loadChunk(key) {
    if (cache[key] !== undefined) return Promise.resolve(cache[key]);
    var fname = (fnames && fnames[key]) || key;
    return fetch('static-data/' + fname + '.json.gz')
      .then(function (res) {
        if (!res.ok) {
          return fetch(CDN + fname + '.json.gz').then(function (r2) {
            if (!r2.ok) throw new Error('数据加载失败 (' + r2.status + ')');
            return r2.arrayBuffer();
          });
        }
        return res.arrayBuffer();
      })
      .then(function (buf) {
        var ds = new DecompressionStream('gzip');
        var stream = new Blob([buf]).stream().pipeThrough(ds);
        return new Response(stream).json();
      })
      .then(function (data) { cache[key] = data; return data; });
  }

  function render(r) {
    var html = '<li class="item">';
    html += '<div class="word">' + esc(r.w);
    if (r.ph) html += ' <span class="phonetic">/' + esc(r.ph) + '/</span>';
    if (r.py) html += ' <span class="pinyin">[' + esc(r.py) + ']</span>';
    if (r.p) html += ' <span class="pos">' + esc(r.p) + '</span>';
    html += '</div>';
    var tags = (r.t || '').split(/\s+/).filter(Boolean);
    if (tags.length) {
      html += '<div class="tags">' + tags.map(function (t) {
        return '<span class="tag">' + esc(t) + '</span>';
      }).join('') + '</div>';
    }
    if (r.ex) html += '<div class="exchange">词形：' + esc(r.ex) + '</div>';
    html += '<div class="def">' + esc(r.d) + '</div>';
    if (r.s) html += '<div class="meta">来源：' + esc(r.s) + '</div>';
    html += '</li>';
    return html;
  }

  function search() {
    var q = input.value.trim();
    if (!q) { resultsEl.innerHTML = ''; statusEl.textContent = ''; return; }
    if (q.length < 2) { statusEl.textContent = '请输入至少 2 个字母'; resultsEl.innerHTML = ''; return; }
    statusEl.textContent = '加载中…';
    var m = mode.value;
    var key = keyFor(q, keys);
    loadChunk(key).then(function (data) {
      var ql = q.toLowerCase();
      var out = [];
      var i;
      if (m === 'exact') {
        for (i = 0; i < data.length; i++) {
          if (data[i].w.toLowerCase() === ql) { out.push(data[i]); break; }
        }
      } else if (m === 'fuzzy') {
        for (i = 0; i < data.length; i++) {
          var e = data[i];
          if (e.w.toLowerCase().indexOf(ql) >= 0 ||
              (e.d && e.d.toLowerCase().indexOf(ql) >= 0) ||
              (e.py && e.py.toLowerCase().indexOf(ql) >= 0)) {
            out.push(e);
            if (out.length >= 30) break;
          }
        }
      } else {
        for (i = 0; i < data.length; i++) {
          if (data[i].w.toLowerCase().indexOf(ql) === 0) { out.push(data[i]); if (out.length >= 30) break; }
        }
      }
      if (out.length === 0) {
        statusEl.textContent = '未找到 “' + q + '” 的相关结果';
        resultsEl.innerHTML = '';
        return;
      }
      statusEl.textContent = '找到 ' + out.length + ' 条结果（本地搜索）';
      resultsEl.innerHTML = out.map(render).join('');
    }).catch(function (err) {
      statusEl.textContent = '出错了：' + err.message;
      resultsEl.innerHTML = '';
    });
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); search(); });
  input.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(search, 200);
  });
  mode.addEventListener('change', search);

  // ===== 顶部固定 + 滚动缩小 + 回到顶部 =====
  var topbar = document.getElementById('topbar');
  var backtop = document.getElementById('backtop');
  function onScroll() {
    var y = window.scrollY || document.documentElement.scrollTop || 0;
    if (topbar) topbar.classList.toggle('compact', y > 40);
    if (backtop) backtop.classList.toggle('show', y > 200);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  if (backtop) {
    backtop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ===== 主题切换（下拉 + 记住选择）=====
  var THEMES = ['white', 'black', 'green', 'gray'];
  var LABELS = { white: '白', black: '黑', green: '护眼绿（白天）', gray: '护眼灰（黑夜）' };
  var DOTS = { white: '#f0f4ff', black: '#141414', green: '#c7edcc', gray: '#3b3a38' };
  function applyTheme(t) {
    document.body.setAttribute('data-theme', t);
    var lab = document.getElementById('theme-label');
    var dot = document.getElementById('theme-dot');
    if (lab) lab.textContent = LABELS[t] || t;
    if (dot) dot.style.background = DOTS[t] || '#fff';
    try { localStorage.setItem('dict-theme', t); } catch (e) {}
  }
  var saved = null;
  try { saved = localStorage.getItem('dict-theme'); } catch (e) {}
  if (THEMES.indexOf(saved) < 0) saved = 'white';
  applyTheme(saved);

  var trigger = document.getElementById('theme-trigger');
  var menu = document.getElementById('theme-menu');
  function closeMenu() { if (menu) menu.classList.remove('open'); }
  if (trigger && menu) {
    trigger.addEventListener('click', function (ev) {
      ev.stopPropagation();
      menu.classList.toggle('open');
      trigger.setAttribute('aria-expanded', menu.classList.contains('open') ? 'true' : 'false');
    });
    menu.addEventListener('click', function (ev) {
      var o = ev.target && ev.target.closest ? ev.target.closest('.theme-option') : null;
      if (o) { applyTheme(o.getAttribute('data-theme')); closeMenu(); }
    });
    document.addEventListener('click', closeMenu);
  }
})();
