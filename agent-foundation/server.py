import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, jsonify, request
from flask_cors import CORS

from agent.monitor import load_progress, load_blockers
from agent.obsidian import generate_obsidian_note, get_export_history
from agent.memory import get_memories, save_memory, delete_memory
from agent.analytics import get_mock_analytics
from agent.wordpress import fetch_posts, fetch_shops

app = Flask(__name__)
CORS(app)

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
PM_DIR = os.path.join(PROJECT_ROOT, "..", "pm")
OBSIDIAN_DIR = os.path.join(PROJECT_ROOT, "..", "MensEsthe-Notes")
os.makedirs(OBSIDIAN_DIR, exist_ok=True)

DASHBOARD_HTML = r"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Agent Monitor - mens-esthe</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;height:100vh;display:flex;flex-direction:column;overflow:hidden}
.header{background:#1e293b;padding:13px 20px;border-bottom:1px solid #334155;display:flex;justify-content:space-between;align-items:center;flex-shrink:0}
.header h1{font-size:16px;color:#38bdf8;font-weight:700}
.header .meta{font-size:11px;color:#64748b}
.tabs{display:flex;background:#1e293b;padding:0 20px;border-bottom:1px solid #334155;flex-shrink:0;overflow-x:auto}
.tab{padding:10px 16px;cursor:pointer;border-bottom:2px solid transparent;color:#94a3b8;font-size:13px;transition:all .18s;white-space:nowrap;user-select:none}
.tab:hover{color:#e2e8f0}
.tab.active{color:#38bdf8;border-bottom-color:#38bdf8}
.page-layout{display:flex;flex:1;overflow:hidden}
#main-content{flex:1;overflow-y:auto;padding:18px 22px}
.wp-sidebar{width:150px;flex-shrink:0;background:#080d1a;border-left:1px solid #1e293b;padding:11px;overflow-y:auto}
.wp-sidebar h4{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#475569;margin:13px 0 4px;padding-bottom:4px;border-bottom:1px solid #1e293b}
.wp-sidebar h4:first-child{margin-top:0}
.wp-sidebar a{display:block;padding:5px 7px;border-radius:4px;color:#94a3b8;text-decoration:none;font-size:11px;transition:all .12s;line-height:1.4}
.wp-sidebar a:hover{background:#1e293b;color:#e2e8f0}
/* panels */
.panel{display:none}.panel.active{display:block}
/* stats row */
.stats{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap}
.stat-card{background:#1e293b;border-radius:8px;padding:12px 16px;border:1px solid #334155;text-align:center;min-width:84px}
.stat-card .num{font-size:22px;font-weight:700;color:#38bdf8}
.stat-card .label{font-size:10px;color:#94a3b8;margin-top:3px}
/* buttons */
.btn{background:#38bdf8;color:#0f172a;border:none;padding:7px 16px;border-radius:6px;cursor:pointer;font-weight:600;font-size:12px;margin-right:6px;margin-bottom:8px;text-decoration:none;display:inline-block;transition:background .15s}
.btn:hover{background:#7dd3fc}
.btn:disabled{opacity:.5;cursor:default}
.btn-sm{padding:4px 10px;font-size:11px}
.btn-ghost{background:#334155;color:#e2e8f0}.btn-ghost:hover{background:#475569}
/* misc */
.status-ok{color:#4ade80}.status-error{color:#f87171}
pre{background:#0a0f1e;padding:12px;border-radius:8px;font-size:11px;overflow-x:auto;white-space:pre-wrap;max-height:460px;overflow-y:auto;line-height:1.6;border:1px solid #1e293b}
.memory-card{background:#1e293b;border:1px solid #334155;border-radius:8px;padding:11px;margin-bottom:7px}
.memory-card .mdate{font-size:10px;color:#64748b;margin-top:4px}
.memory-card .mdel{float:right;color:#f87171;cursor:pointer;font-size:11px;background:none;border:none}
.export-item{padding:8px 0;border-bottom:1px solid #1e293b;font-size:12px}
.form-hidden{display:none}
input,textarea{width:100%;background:#0a0f1e;border:1px solid #334155;color:#e2e8f0;padding:8px;border-radius:6px;font-size:12px;margin-bottom:6px}
input:focus,textarea:focus{outline:none;border-color:#38bdf8}
textarea{resize:vertical}
/* analytics */
.period-btns{display:flex;gap:6px;margin-bottom:12px;align-items:center}
.period-btn{background:#1e293b;color:#94a3b8;border:1px solid #334155;padding:4px 13px;border-radius:6px;cursor:pointer;font-size:12px;transition:all .15s}
.period-btn.active{background:#38bdf8;color:#0f172a;border-color:#38bdf8;font-weight:600}
.chart-wrap{background:#1e293b;border:1px solid #334155;border-radius:8px;padding:12px;margin-bottom:14px;height:210px;position:relative}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.sec-title{font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin:0 0 7px}
.tag-mock{display:inline-block;font-size:9px;padding:1px 5px;border-radius:3px;background:#422006;color:#fb923c}
/* tables */
table.dt{width:100%;border-collapse:collapse;font-size:12px}
table.dt th{text-align:left;color:#475569;font-weight:500;padding:5px 6px;border-bottom:1px solid #1e293b;white-space:nowrap}
table.dt td{padding:6px 6px;border-bottom:1px solid #0a0f1e;color:#cbd5e1;vertical-align:middle}
table.dt tr:hover td{background:rgba(255,255,255,.02)}
.la{color:#38bdf8;text-decoration:none}.la:hover{text-decoration:underline}
/* blog & shops */
.search-bar{display:flex;gap:8px;margin-bottom:9px;align-items:center}
.search-bar input{width:250px;margin:0}
.pager{display:flex;gap:4px;margin-top:9px;flex-wrap:wrap}
.pager-btn{background:#1e293b;border:1px solid #334155;color:#94a3b8;padding:3px 9px;border-radius:4px;cursor:pointer;font-size:11px;transition:all .12s}
.pager-btn:hover{background:#334155}
.pager-btn.active{background:#38bdf8;color:#0f172a;border-color:#38bdf8;font-weight:600}
</style>
</head>
<body>
<div class="header">
  <h1>Agent Monitor &#x2014; mens-esthe-kuchikomi</h1>
  <div class="meta">Port: 3333 | <span id="health" class="status-ok">&#x25CF; Online</span></div>
</div>
<div class="tabs">
  <div class="tab active" onclick="switchTab('progress')">進捗</div>
  <div class="tab" onclick="switchTab('blockers')">ブロック</div>
  <div class="tab" onclick="switchTab('memory')">AI記憶</div>
  <div class="tab" onclick="switchTab('obsidian')">Obsidian</div>
  <div class="tab" onclick="switchTab('analytics')">📈 分析</div>
  <div class="tab" onclick="switchTab('blog')">📝 ブログ</div>
  <div class="tab" onclick="switchTab('shops')">🏪 店舗</div>
</div>
<div class="page-layout">
<div id="main-content">

  <!-- 進捗 -->
  <div id="panel-progress" class="panel active">
    <div class="stats" id="progress-stats"></div>
    <button class="btn" onclick="loadProgress()">更新</button>
    <div id="progress-content"><p style="color:#64748b">読み込み中...</p></div>
  </div>

  <!-- ブロック -->
  <div id="panel-blockers" class="panel">
    <div class="stats" id="blocker-stats"></div>
    <button class="btn" onclick="loadBlockers()">更新</button>
    <div id="blockers-content"><p style="color:#64748b">読み込み中...</p></div>
  </div>

  <!-- AI記憶 -->
  <div id="panel-memory" class="panel">
    <button class="btn" onclick="showMemoryForm()">+ 記憶を追加</button>
    <button class="btn btn-ghost" onclick="loadMemories()">更新</button>
    <div id="memory-form" class="form-hidden" style="margin-bottom:12px;margin-top:8px">
      <input id="mem-title" placeholder="タイトル">
      <textarea id="mem-content" rows="3" placeholder="内容"></textarea>
      <button class="btn btn-sm" onclick="saveMemory()">保存</button>
      <button class="btn btn-sm btn-ghost" onclick="document.getElementById('memory-form').style.display='none'">キャンセル</button>
    </div>
    <div id="memory-content"></div>
  </div>

  <!-- Obsidian -->
  <div id="panel-obsidian" class="panel">
    <button class="btn" id="btn-gen" onclick="generateObsidian()">今すぐ書き出す</button>
    <span id="obs-status" style="font-size:12px;margin-left:8px"></span>
    <h3 style="margin:13px 0 6px;font-size:13px;color:#94a3b8">書き出し履歴</h3>
    <div id="obsidian-history"></div>
  </div>

  <!-- 分析 -->
  <div id="panel-analytics" class="panel">
    <div class="period-btns">
      <button class="period-btn active" onclick="setPeriod(7,this)">7日</button>
      <button class="period-btn" onclick="setPeriod(30,this)">30日</button>
      <button class="period-btn" onclick="setPeriod(90,this)">90日</button>
      <span id="mock-badge" class="tag-mock" style="display:none;margin-left:4px">モックデータ</span>
    </div>
    <div class="stats" id="analytics-stats"></div>
    <div class="chart-wrap"><canvas id="analytics-chart"></canvas></div>
    <div class="two-col">
      <div>
        <p class="sec-title">人気ページ TOP10</p>
        <table class="dt">
          <thead><tr><th>#</th><th>ページ</th><th>PV</th></tr></thead>
          <tbody id="pages-tbody"></tbody>
        </table>
      </div>
      <div>
        <p class="sec-title">キーワード順位 <span class="tag-mock">モック</span></p>
        <table class="dt">
          <thead><tr><th>#</th><th>キーワード</th><th>順位</th><th>表示</th></tr></thead>
          <tbody id="kw-tbody"></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- ブログ -->
  <div id="panel-blog" class="panel">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:9px">
      <a href="https://mens-esthe-kuchikomi.com/wp-admin/post-new.php" target="_blank" class="btn btn-sm">+ 新規投稿</a>
      <span id="blog-total" style="font-size:12px;color:#64748b"></span>
    </div>
    <table class="dt">
      <thead><tr><th>タイトル</th><th>投稿日</th><th>操作</th></tr></thead>
      <tbody id="blog-tbody"><tr><td colspan="3" style="color:#64748b">読み込み中...</td></tr></tbody>
    </table>
    <div class="pager" id="blog-pager"></div>
  </div>

  <!-- 店舗 -->
  <div id="panel-shops" class="panel">
    <div class="search-bar">
      <input type="text" id="shop-search" placeholder="店舗名で検索..." oninput="debounceShop()">
      <span id="shop-total" style="font-size:12px;color:#64748b"></span>
    </div>
    <table class="dt">
      <thead><tr><th>店舗名</th><th>スラッグ</th><th>操作</th></tr></thead>
      <tbody id="shops-tbody"><tr><td colspan="3" style="color:#64748b">読み込み中...</td></tr></tbody>
    </table>
    <div class="pager" id="shops-pager"></div>
  </div>

</div><!-- /main-content -->

<div class="wp-sidebar">
  <h4>WP管理</h4>
  <a href="https://mens-esthe-kuchikomi.com/wp-admin/" target="_blank">管理TOP</a>
  <a href="https://mens-esthe-kuchikomi.com/wp-admin/post-new.php" target="_blank">+ 新規投稿</a>
  <a href="https://mens-esthe-kuchikomi.com/wp-admin/edit.php" target="_blank">投稿一覧</a>
  <a href="https://mens-esthe-kuchikomi.com/wp-admin/edit.php?post_type=shop" target="_blank">店舗管理</a>
  <a href="https://mens-esthe-kuchikomi.com/wp-admin/edit.php?post_type=page" target="_blank">固定ページ</a>
  <a href="https://mens-esthe-kuchikomi.com/wp-admin/upload.php" target="_blank">メディア</a>
  <a href="https://mens-esthe-kuchikomi.com/wp-admin/themes.php" target="_blank">外観</a>
  <a href="https://mens-esthe-kuchikomi.com/wp-admin/plugins.php" target="_blank">プラグイン</a>
  <a href="https://mens-esthe-kuchikomi.com/wp-admin/options-general.php" target="_blank">設定</a>
  <h4>サイト</h4>
  <a href="https://mens-esthe-kuchikomi.com/" target="_blank">トップ ↗</a>
  <a href="https://analytics.google.com/" target="_blank">GA4 ↗</a>
  <a href="https://search.google.com/search-console" target="_blank">GSC ↗</a>
</div>
</div><!-- /page-layout -->

<script>
async function fetchAPI(url, opts) {
  try {
    var r = await fetch(url, opts || {});
    return r.json();
  } catch(e) {
    return {error: String(e)};
  }
}

var ALL_TABS = ['progress','blockers','memory','obsidian','analytics','blog','shops'];
function switchTab(n) {
  document.querySelectorAll('.tab').forEach(function(t, i) {
    t.classList.toggle('active', ALL_TABS[i] === n);
  });
  document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('active'); });
  document.getElementById('panel-' + n).classList.add('active');
  if (n === 'progress')  loadProgress();
  if (n === 'blockers')  loadBlockers();
  if (n === 'memory')    loadMemories();
  if (n === 'obsidian')  loadObsidianHistory();
  if (n === 'analytics') loadAnalytics();
  if (n === 'blog')      loadBlog(1);
  if (n === 'shops')     loadShops(1);
}

/* -------- Progress -------- */
async function loadProgress() {
  var d = await fetchAPI('/api/progress');
  var s = d.stats || {};
  document.getElementById('progress-stats').innerHTML =
    sc(s.progress_pct||0,'%','進捗率') + sc(s.completed||0,'','完了') + sc(s.total||0,'','総タスク');
  document.getElementById('progress-content').innerHTML = d.error
    ? '<p class="status-error">' + d.error + '</p>'
    : '<pre>' + esc(d.content || '') + '</pre>';
}

/* -------- Blockers -------- */
async function loadBlockers() {
  var d = await fetchAPI('/api/blockers');
  var s = d.stats || {};
  document.getElementById('blocker-stats').innerHTML =
    sc(s.active||0,'','アクティブ') + sc(s.resolved||0,'','解決済');
  document.getElementById('blockers-content').innerHTML = d.error
    ? '<p class="status-error">' + d.error + '</p>'
    : '<pre>' + esc(d.content || 'ブロックなし') + '</pre>';
}

/* -------- Memory -------- */
async function loadMemories() {
  var d = await fetchAPI('/api/memory');
  var div = document.getElementById('memory-content');
  if (!Array.isArray(d) || d.length === 0) {
    div.innerHTML = '<p style="color:#94a3b8">記憶はまだありません。</p>'; return;
  }
  div.innerHTML = d.slice().reverse().map(function(m) {
    return '<div class="memory-card">' +
      '<strong>' + esc(m.title) + '</strong>' +
      '<button class="mdel" onclick="deleteMemory(' + m.id + ')">削除</button>' +
      '<p style="margin-top:5px;color:#94a3b8;font-size:12px">' + esc(m.content||'') + '</p>' +
      '<div class="mdate">' + ((m.date||'').slice(0,16).replace('T',' ')) + '</div></div>';
  }).join('');
}
function showMemoryForm() {
  document.getElementById('memory-form').style.display = 'block';
  document.getElementById('mem-title').focus();
}
async function saveMemory() {
  var title = document.getElementById('mem-title').value;
  var content = document.getElementById('mem-content').value;
  if (!title || !content) return;
  await fetchAPI('/api/memory', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:title,content:content})});
  document.getElementById('memory-form').style.display='none';
  document.getElementById('mem-title').value='';
  document.getElementById('mem-content').value='';
  loadMemories();
}
async function deleteMemory(id) {
  await fetchAPI('/api/memory/' + id, {method:'DELETE'});
  loadMemories();
}

/* -------- Obsidian -------- */
async function generateObsidian() {
  var btn = document.getElementById('btn-gen');
  btn.disabled=true; btn.textContent='生成中...';
  try {
    var d = await fetchAPI('/api/obsidian/generate', {method:'POST'});
    document.getElementById('obs-status').innerHTML = d.success
      ? '<span class="status-ok">保存完了: ' + esc(d.file) + '</span>'
      : '<span class="status-error">エラー: ' + esc(d.error) + '</span>';
    loadObsidianHistory();
  } finally { btn.disabled=false; btn.textContent='今すぐ書き出す'; }
}
async function loadObsidianHistory() {
  var d = await fetchAPI('/api/obsidian/history');
  document.getElementById('obsidian-history').innerHTML = Array.isArray(d) && d.length
    ? d.map(function(f){return '<div class="export-item">'+esc(f)+'</div>';}).join('')
    : '<p style="color:#94a3b8">まだ書き出しはありません</p>';
}

/* -------- Analytics -------- */
var _chart=null, _days=7;
function setPeriod(days,btn) {
  _days=days;
  document.querySelectorAll('.period-btn').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  loadAnalytics(days);
}
async function loadAnalytics(days) {
  days=days||_days;
  var d=await fetchAPI('/api/analytics?days='+days);
  if(d.mock) document.getElementById('mock-badge').style.display='inline';
  var s=d.totals||{};
  document.getElementById('analytics-stats').innerHTML =
    sc(fmt(s.pageviews),'','PV') + sc(fmt(s.sessions),'','セッション') +
    sc(s.bounce_rate||0,'%','直帰率') + sc(fmtDur(s.avg_duration),'','平均滞在');
  renderChart(d.daily||[]);
  var pages=d.pages||[];
  document.getElementById('pages-tbody').innerHTML=pages.map(function(p,i){
    return '<tr><td>'+(i+1)+'</td><td><a href="https://mens-esthe-kuchikomi.com'+esc(p.path)+'" target="_blank" class="la">'+esc(p.title)+'</a></td><td>'+fmt(p.pageviews)+'</td></tr>';
  }).join('');
  var kws=[['メンズエステ 東京',1,12500],['メンズエステ 大阪',3,8200],['メンズエステ おすすめ',5,6400],
    ['メンズエステ 名古屋',4,4100],['メンズエステ 口コミ',7,3800],['メンズエステ 福岡',6,2900],
    ['メンズエステ 料金',12,2100],['メンズエステ 人気',9,1800],['メンズエステ 安い',15,1500],['メンズエステ 初回',11,1200]];
  document.getElementById('kw-tbody').innerHTML=kws.map(function(k,i){
    var c=k[1]<=3?'#4ade80':k[1]<=10?'#38bdf8':'#94a3b8';
    return '<tr><td>'+(i+1)+'</td><td>'+k[0]+'</td><td style="color:'+c+';font-weight:600">'+k[1]+'</td><td>'+fmt(k[2])+'</td></tr>';
  }).join('');
}
function renderChart(daily) {
  var canvas=document.getElementById('analytics-chart');
  if(!canvas||typeof Chart==='undefined') return;
  if(_chart){try{_chart.destroy();}catch(e){}}
  _chart=new Chart(canvas.getContext('2d'),{
    type:'line',
    data:{
      labels:daily.map(function(d){return d.date.slice(5);}),
      datasets:[
        {label:'PV',data:daily.map(function(d){return d.pageviews;}),borderColor:'#38bdf8',backgroundColor:'rgba(56,189,248,.1)',tension:.3,fill:true,pointRadius:0},
        {label:'セッション',data:daily.map(function(d){return d.sessions;}),borderColor:'#4ade80',backgroundColor:'rgba(74,222,128,.07)',tension:.3,fill:true,pointRadius:0}
      ]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{labels:{color:'#94a3b8',font:{size:11}}}},
      scales:{
        x:{ticks:{color:'#475569',font:{size:9},maxTicksLimit:12},grid:{color:'rgba(30,41,59,.7)'}},
        y:{ticks:{color:'#475569',font:{size:9}},grid:{color:'rgba(30,41,59,.7)'}}
      }
    }
  });
}

/* -------- Blog -------- */
var _blogPage=1;
async function loadBlog(page) {
  _blogPage=page||1;
  var d=await fetchAPI('/api/wp/posts?page='+_blogPage);
  if(d.error){
    document.getElementById('blog-tbody').innerHTML='<tr><td colspan="3" class="status-error">'+esc(d.error)+'</td></tr>';
    return;
  }
  document.getElementById('blog-total').textContent='全'+(d.total||0)+'件';
  document.getElementById('blog-tbody').innerHTML=(d.posts||[]).map(function(p){
    var t=p.title&&p.title.rendered?p.title.rendered:'(無題)';
    return '<tr>'+
      '<td><a href="'+esc(p.link||'#')+'" target="_blank" class="la">'+esc(t)+'</a></td>'+
      '<td style="color:#64748b;white-space:nowrap">'+((p.date||'').slice(0,10))+'</td>'+
      '<td style="white-space:nowrap"><a href="https://mens-esthe-kuchikomi.com/wp-admin/post.php?post='+p.id+'&action=edit" target="_blank" class="la" style="margin-right:8px">編集</a>'+
      '<a href="'+esc(p.link||'#')+'" target="_blank" class="la">表示</a></td></tr>';
  }).join('')||'<tr><td colspan="3" style="color:#64748b">記事なし</td></tr>';
  renderPager('blog-pager',_blogPage,d.total_pages||1,loadBlog);
}

/* -------- Shops -------- */
var _shopPage=1,_shopQ='',_shopTimer=null;
function debounceShop(){
  clearTimeout(_shopTimer);
  _shopTimer=setTimeout(function(){_shopQ=document.getElementById('shop-search').value;loadShops(1);},350);
}
async function loadShops(page){
  _shopPage=page||1;
  var url='/api/wp/shops?page='+_shopPage+(_shopQ?'&search='+encodeURIComponent(_shopQ):'');
  var d=await fetchAPI(url);
  if(d.error){
    document.getElementById('shops-tbody').innerHTML='<tr><td colspan="3" class="status-error">'+esc(d.error)+'</td></tr>';
    return;
  }
  document.getElementById('shop-total').textContent='全'+(d.total||0)+'店舗';
  document.getElementById('shops-tbody').innerHTML=(d.shops||[]).map(function(s){
    var t=s.title&&s.title.rendered?s.title.rendered:'(無名)';
    return '<tr>'+
      '<td><a href="'+esc(s.link||'#')+'" target="_blank" class="la">'+esc(t)+'</a></td>'+
      '<td style="color:#64748b;font-size:11px">'+esc(s.slug||'')+'</td>'+
      '<td style="white-space:nowrap"><a href="https://mens-esthe-kuchikomi.com/wp-admin/post.php?post='+s.id+'&action=edit" target="_blank" class="la" style="margin-right:8px">編集</a>'+
      '<a href="'+esc(s.link||'#')+'" target="_blank" class="la">表示</a></td></tr>';
  }).join('')||'<tr><td colspan="3" style="color:#64748b">店舗なし</td></tr>';
  renderPager('shops-pager',_shopPage,d.total_pages||1,loadShops);
}

/* -------- Shared utils -------- */
function renderPager(id,cur,total,fn){
  var el=document.getElementById(id);
  if(total<=1){el.innerHTML='';return;}
  var h='';
  for(var i=1;i<=Math.min(total,10);i++){
    h+='<button class="pager-btn'+(i===cur?' active':'')+'" onclick="'+fn.name+'('+i+')">'+i+'</button>';
  }
  el.innerHTML=h;
}
function sc(num,suffix,label){
  return '<div class="stat-card"><div class="num">'+num+suffix+'</div><div class="label">'+label+'</div></div>';
}
function fmt(n){return n?Number(n).toLocaleString('ja-JP'):'0';}
function fmtDur(s){if(!s)return '0:00';var m=Math.floor(s/60);return m+':'+String(s%60).padStart(2,'0');}
function esc(s){var d=document.createElement('div');d.textContent=String(s||'');return d.innerHTML;}

/* init */
loadProgress();
loadObsidianHistory();
</script>
</body>
</html>"""


@app.route("/")
def dashboard():
    return DASHBOARD_HTML


@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "project": "mens-esthe-kuchikomi", "port": 3333})


@app.route("/api/progress")
def api_progress():
    return jsonify(load_progress(PM_DIR))


@app.route("/api/blockers")
def api_blockers():
    return jsonify(load_blockers(PM_DIR))


@app.route("/api/obsidian/generate", methods=["POST"])
def api_generate():
    return jsonify(generate_obsidian_note(PM_DIR, OBSIDIAN_DIR))


@app.route("/api/obsidian/history")
def api_history():
    return jsonify(get_export_history(OBSIDIAN_DIR))


@app.route("/api/memory", methods=["GET", "POST"])
def api_memory():
    if request.method == "POST":
        return jsonify(save_memory(request.get_json()))
    return jsonify(get_memories())


@app.route("/api/memory/<int:mid>", methods=["DELETE"])
def api_memory_delete(mid: int):
    return jsonify(delete_memory(mid))


@app.route("/api/analytics")
def api_analytics():
    days = request.args.get("days", 30, type=int)
    return jsonify(get_mock_analytics(days))


@app.route("/api/wp/posts")
def api_wp_posts():
    page = request.args.get("page", 1, type=int)
    return jsonify(fetch_posts(page=page))


@app.route("/api/wp/shops")
def api_wp_shops():
    page = request.args.get("page", 1, type=int)
    search = request.args.get("search", "")
    return jsonify(fetch_shops(page=page, search=search))


if __name__ == "__main__":
    print("Agent Foundation Server 起動中...")
    print("   プロジェクト: mens-esthe-kuchikomi")
    print("   ダッシュボード: http://localhost:3333")
    print("   API: http://localhost:3333/api/health")
    app.run(host="0.0.0.0", port=3333, debug=True)
