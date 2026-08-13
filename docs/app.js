// 纯静态词典查询（加速版 v3）：2/3字母分组自动选择 + 同源优先 + CDN 回退
(function () {
  'use strict';
  var form = document.getElementById('search-form');
  var input = document.getElementById('q');
  var mode = document.getElementById('mode');
  var statusEl = document.getElementById('status');
  var resultsEl = document.getElementById('results');
  var cache = {};
  var keys = null; // 所有数据分组的 key 集合
  var fnames = null; // key -> 实际文件名（避免 Windows 保留名）
  var timer = null;

  var CDN = 'https://cdn.jsdelivr.net/gh/HuangJensen/dictionary-gpt@main/docs/static-data/';

  function esc(s) {
    var div = document.createElement('div');
    div.textContent = s == null ? '' : String(s);
    return div.innerHTML;
  }

  // 分组索引已内嵌在 keys.js（避免额外的网络请求）
  keys = new Set(window.DICT_KEYS || []);

  // 根据查询选数据文件 key（优先更小的 3 字母分组）
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
    // 同源优先（实测最快），失败回退 CDN
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
})();
