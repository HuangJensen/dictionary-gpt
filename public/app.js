// 前端查询逻辑：纯 JS + fetch，无任何框架依赖
(function () {
  'use strict';
  var form = document.getElementById('search-form');
  var input = document.getElementById('q');
  var mode = document.getElementById('mode');
  var statusEl = document.getElementById('status');
  var resultsEl = document.getElementById('results');
  var timer = null;

  function esc(s) {
    var div = document.createElement('div');
    div.textContent = s == null ? '' : String(s);
    return div.innerHTML;
  }

  function render(r) {
    var html = '<li class="item">';

    html += '<div class="word">' + esc(r.word);
    if (r.phonetic) html += ' <span class="phonetic">/' + esc(r.phonetic) + '/</span>';
    if (r.pinyin) html += ' <span class="pinyin">[' + esc(r.pinyin) + ']</span>';
    if (r.pos) html += ' <span class="pos">' + esc(r.pos) + '</span>';
    html += '</div>';

    var tags = (r.tag || '').split(/\s+/).filter(Boolean);
    if (tags.length) {
      html += '<div class="tags">' + tags.map(function (t) {
        return '<span class="tag">' + esc(t) + '</span>';
      }).join('') + '</div>';
    }

    if (r.exchange) html += '<div class="exchange">词形：' + esc(r.exchange) + '</div>';
    html += '<div class="def">' + esc(r.definition) + '</div>';

    if (r.audio && /^https?:/.test(r.audio)) {
      html += '<div class="meta"><a href="' + esc(r.audio) + '" target="_blank" rel="noopener">🔊 发音</a></div>';
    }
    html += '<div class="meta">来源：' + esc(r.source) + '</div>';
    html += '</li>';
    return html;
  }

  function search() {
    var q = input.value.trim();
    if (!q) { resultsEl.innerHTML = ''; statusEl.textContent = ''; return; }

    statusEl.textContent = '查询中…';
    var url = '/api/search?q=' + encodeURIComponent(q) +
      '&mode=' + encodeURIComponent(mode.value) + '&limit=30';

    fetch(url)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.error) {
          statusEl.textContent = '出错了：' + data.error;
          resultsEl.innerHTML = '';
          return;
        }
        if (data.count === 0) {
          statusEl.textContent = '未找到 “' + q + '” 的相关结果';
          resultsEl.innerHTML = '';
          return;
        }
        statusEl.textContent = '找到 ' + data.count + ' 条结果';
        resultsEl.innerHTML = data.results.map(render).join('');
      })
      .catch(function (err) {
        statusEl.textContent = '请求失败：' + err.message;
        resultsEl.innerHTML = '';
      });
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); search(); });
  input.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(search, 300);
  });
  mode.addEventListener('change', search);
})();
