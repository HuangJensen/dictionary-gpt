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

  // ===== 词缀库（前缀 / 后缀）=====
  var AFFIXES = [
    { a: 'un-', t: '前缀', m: '不；非；相反', e: 'unhappy 不快乐的 · undo 撤销' },
    { a: 're-', t: '前缀', m: '再；重新；返回', e: 'return 返回 · rebuild 重建' },
    { a: 'pre-', t: '前缀', m: '前；预先', e: 'preview 预览 · prepare 准备' },
    { a: 'post-', t: '前缀', m: '后', e: 'postwar 战后的 · postpone 推迟' },
    { a: 'anti-', t: '前缀', m: '反对；对抗', e: 'antiwar 反战的 · antibiotic 抗生素' },
    { a: 'auto-', t: '前缀', m: '自己；自动', e: 'autograph 亲笔签名 · automobile 汽车' },
    { a: 'bi-', t: '前缀', m: '二；两', e: 'bicycle 自行车 · bilingual 双语的' },
    { a: 'tri-', t: '前缀', m: '三', e: 'triangle 三角形 · tricycle 三轮车' },
    { a: 'uni-', t: '前缀', m: '单一', e: 'uniform 制服 · unique 独特的' },
    { a: 'mono-', t: '前缀', m: '单一', e: 'monopoly 垄断 · monologue 独白' },
    { a: 'multi-', t: '前缀', m: '多', e: 'multimedia 多媒体 · multiply 乘' },
    { a: 'co-', t: '前缀', m: '共同；一起', e: 'cooperate 合作 · coexist 共存' },
    { a: 'com-/con-/col-/cor-', t: '前缀', m: '共同；加强', e: 'combine 结合 · connect 连接' },
    { a: 'counter-', t: '前缀', m: '反对；相反', e: 'counterattack 反击 · counterpart 对应物' },
    { a: 'de-', t: '前缀', m: '向下；除去；相反', e: 'decrease 减少 · decode 解码' },
    { a: 'dis-', t: '前缀', m: '不；相反；分离', e: 'dislike 不喜欢 · disconnect 断开' },
    { a: 'en-/em-', t: '前缀', m: '使成为；进入', e: 'enable 使能够 · embrace 拥抱' },
    { a: 'ex-', t: '前缀', m: '出；前', e: 'export 出口 · ex-president 前总统' },
    { a: 'fore-', t: '前缀', m: '前；预先', e: 'forecast 预报 · forehead 前额' },
    { a: 'in-/im-/il-/ir-', t: '前缀', m: '不；无', e: 'incorrect 错误的 · impossible 不可能的' },
    { a: 'in-/im-', t: '前缀', m: '向内；进入', e: 'inside 内部 · import 进口' },
    { a: 'inter-', t: '前缀', m: '在…之间；相互', e: 'international 国际的 · interact 互动' },
    { a: 'intra-', t: '前缀', m: '在内', e: 'intranet 内网 · intramural 校内的' },
    { a: 'kilo-', t: '前缀', m: '千', e: 'kilometer 千米 · kilogram 千克' },
    { a: 'macro-', t: '前缀', m: '大；宏观', e: 'macroeconomics 宏观经济学' },
    { a: 'mal-', t: '前缀', m: '坏；恶', e: 'malfunction 故障 · malnutrition 营养不良' },
    { a: 'mega-', t: '前缀', m: '百万；大', e: 'megabyte 兆字节' },
    { a: 'micro-', t: '前缀', m: '小；微', e: 'microscope 显微镜 · microphone 麦克风' },
    { a: 'mid-', t: '前缀', m: '中间', e: 'midnight 午夜 · midway 中途' },
    { a: 'milli-', t: '前缀', m: '千分之一', e: 'millimeter 毫米' },
    { a: 'mini-', t: '前缀', m: '小', e: 'minibus 小巴 · minimum 最小' },
    { a: 'mis-', t: '前缀', m: '错误；坏', e: 'mistake 错误 · misunderstand 误解' },
    { a: 'neo-', t: '前缀', m: '新', e: 'neoclassical 新古典的' },
    { a: 'non-', t: '前缀', m: '不；非', e: 'nonsense 胡说 · nonfiction 非虚构' },
    { a: 'out-', t: '前缀', m: '超过；在外', e: 'outrun 跑得更快 · outside 外面' },
    { a: 'over-', t: '前缀', m: '过度；在上', e: 'overdo 做得过火 · overhead 头顶的' },
    { a: 'pan-', t: '前缀', m: '全；泛', e: 'panorama 全景' },
    { a: 'para-', t: '前缀', m: '旁；辅助', e: 'paragraph 段落 · parallel 平行' },
    { a: 'per-', t: '前缀', m: '通过；完全', e: 'perfect 完美的 · persist 坚持' },
    { a: 'pro-', t: '前缀', m: '向前；支持', e: 'progress 进步 · proactive 主动的' },
    { a: 'retro-', t: '前缀', m: '向后', e: 'retrograde 后退的 · retroactive 追溯的' },
    { a: 'semi-', t: '前缀', m: '半', e: 'semicircle 半圆 · semicolon 分号' },
    { a: 'sub-', t: '前缀', m: '在下；次', e: 'subway 地铁 · subtitle 字幕' },
    { a: 'super-', t: '前缀', m: '超级；在上', e: 'supermarket 超市 · supervise 监督' },
    { a: 'tele-', t: '前缀', m: '远；电', e: 'telephone 电话 · television 电视' },
    { a: 'trans-', t: '前缀', m: '横过；转变', e: 'translate 翻译 · transport 运输' },
    { a: 'ultra-', t: '前缀', m: '超；极端', e: 'ultraviolet 紫外线 · ultra-modern 超现代的' },
    { a: 'under-', t: '前缀', m: '在下；不足', e: 'underground 地下 · underestimate 低估' },
    { a: 'vice-', t: '前缀', m: '副', e: 'vice-president 副总统' },
    { a: 'a-', t: '前缀', m: '无；不；处于…状态', e: 'acentric 无中心的 · asleep 睡着的' },
    { a: 'ab-', t: '前缀', m: '离开；相反', e: 'abnormal 反常的 · absent 缺席的' },
    { a: 'ad-', t: '前缀', m: '朝向；加强', e: 'advance 前进 · adhere 黏着' },
    { a: '-tion/-sion', t: '后缀', m: '行为；状态（名词）', e: 'action 行动 · decision 决定' },
    { a: '-ment', t: '后缀', m: '行为；结果（名词）', e: 'development 发展 · movement 运动' },
    { a: '-ness', t: '后缀', m: '状态；性质（名词）', e: 'happiness 幸福 · kindness 善良' },
    { a: '-ity/-ty', t: '后缀', m: '性质；状态（名词）', e: 'ability 能力 · safety 安全' },
    { a: '-er/-or', t: '后缀', m: '…的人/物；比较级', e: 'teacher 教师 · actor 演员' },
    { a: '-ist', t: '后缀', m: '…主义者；…的人', e: 'artist 艺术家 · scientist 科学家' },
    { a: '-ism', t: '后缀', m: '主义；学说', e: 'socialism 社会主义 · tourism 旅游' },
    { a: '-ance/-ence', t: '后缀', m: '状态；性质（名词）', e: 'importance 重要性 · difference 差异' },
    { a: '-ship', t: '后缀', m: '身份；关系', e: 'friendship 友谊 · leadership 领导' },
    { a: '-hood', t: '后缀', m: '时期；状态', e: 'childhood 童年 · neighborhood 邻里' },
    { a: '-dom', t: '后缀', m: '领域；状态', e: 'freedom 自由 · kingdom 王国' },
    { a: '-ful', t: '后缀', m: '充满…的', e: 'careful 小心的 · beautiful 美丽的' },
    { a: '-less', t: '后缀', m: '无…的', e: 'careless 粗心的 · homeless 无家可归的' },
    { a: '-ly', t: '后缀', m: '副词；…的', e: 'quickly 快速地 · friendly 友好的' },
    { a: '-able/-ible', t: '后缀', m: '可…的', e: 'readable 可读的 · visible 可见的' },
    { a: '-al', t: '后缀', m: '…的；与…有关', e: 'national 国家的 · natural 自然的' },
    { a: '-ive', t: '后缀', m: '有…倾向的', e: 'active 积极的 · creative 有创造力的' },
    { a: '-ous', t: '后缀', m: '多…的；…的', e: 'famous 著名的 · dangerous 危险的' },
    { a: '-ic', t: '后缀', m: '…的', e: 'basic 基础的 · historic 历史的' },
    { a: '-ish', t: '后缀', m: '…的；稍微', e: 'childish 孩子气的 · English 英语' },
    { a: '-en', t: '后缀', m: '使变得（动词）', e: 'soften 变软 · lengthen 加长' },
    { a: '-ize/-ise', t: '后缀', m: '使…化（动词）', e: 'realize 实现 · organize 组织' },
    { a: '-fy/-ify', t: '后缀', m: '使…化（动词）', e: 'simplify 简化 · satisfy 满足' },
    { a: '-ate', t: '后缀', m: '使成为（动词）', e: 'activate 激活 · create 创造' },
    { a: '-ing', t: '后缀', m: '进行；动名词', e: 'running 跑步 · reading 阅读' },
    { a: '-ed', t: '后缀', m: '过去式/过去分词', e: 'walked 走了 · interested 感兴趣的' },
    { a: '-s/-es', t: '后缀', m: '复数；第三人称单数', e: 'books 书 · goes 去' },
    { a: '-est', t: '后缀', m: '最高级', e: 'fastest 最快 · tallest 最高' },
    { a: '-y', t: '后缀', m: '多…的；小称', e: 'sunny 晴朗的 · puppy 小狗' },
    { a: '-ee', t: '后缀', m: '被…的人', e: 'employee 雇员 · trainee 受训者' },
    { a: '-eer', t: '后缀', m: '从事…的人', e: 'engineer 工程师 · volunteer 志愿者' },
    { a: '-ess', t: '后缀', m: '女性', e: 'actress 女演员 · princess 公主' },
    { a: '-let', t: '后缀', m: '小', e: 'booklet 小册子 · leaflet 传单' },
    { a: '-ling', t: '后缀', m: '小；幼', e: 'duckling 小鸭子 · seedling 幼苗' },
    { a: '-like', t: '后缀', m: '像…的', e: 'childlike 孩子般的' },
    { a: '-ward', t: '后缀', m: '朝向', e: 'backward 向后 · forward 向前' },
    { a: '-wise', t: '后缀', m: '方向；方式', e: 'clockwise 顺时针 · likewise 同样地' },
    { a: '-th', t: '后缀', m: '状态；性质', e: 'health 健康 · truth 真相' },
    { a: '-ure', t: '后缀', m: '行为；结果', e: 'culture 文化 · nature 自然' },
    { a: '-some', t: '后缀', m: '易于…的', e: 'handsome 英俊的 · troublesome 麻烦的' }
  ];
  function renderAffixes(q) {
    var ql = (q || '').trim().toLowerCase();
    var list = AFFIXES.filter(function (x) {
      if (!ql) return true;
      return x.a.toLowerCase().indexOf(ql) >= 0 || x.m.indexOf(ql) >= 0;
    });
    var html = '';
    ['前缀', '后缀'].forEach(function (t) {
      var items = list.filter(function (x) { return x.t === t; });
      if (!items.length) return;
      html += '<div class="affix-type">' + t + '（' + items.length + '）</div>';
      items.forEach(function (x) {
        html += '<div class="affix-item"><span class="affix-name">' + esc(x.a) + '</span><span class="affix-mean">' + esc(x.m) + '</span><div class="affix-ex">' + esc(x.e) + '</div></div>';
      });
    });
    affixList.innerHTML = html || '<div class="affix-empty">未找到相关词缀</div>';
  }
  var affixBtn = document.getElementById('affix-btn');
  var affixPanel = document.getElementById('affix-panel');
  var affixQ = document.getElementById('affix-q');
  var affixList = document.getElementById('affix-list');
  var affixClose = document.getElementById('affix-close');
  if (affixBtn && affixPanel) {
    affixBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      var open = affixPanel.classList.toggle('open');
      if (open) { renderAffixes(affixQ.value); affixQ.focus(); }
    });
    affixPanel.addEventListener('click', function (ev) { ev.stopPropagation(); });
    if (affixClose) affixClose.addEventListener('click', function () { affixPanel.classList.remove('open'); });
    if (affixQ) affixQ.addEventListener('input', function () { renderAffixes(affixQ.value); });
    document.addEventListener('click', function () { affixPanel.classList.remove('open'); });
  }
})();