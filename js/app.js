/* app.js — glue: book library + reader, board, move tree, comments, PGN. */

import { Board } from './board.js';
import { GameTree } from './tree.js';
import { PdfView } from './pdfview.js';
import { bookStore, prefs } from './storage.js';

const $ = (id) => document.getElementById(id);
const FILES = 'abcdefgh';

/* ---------------- state ---------------- */
let tree = new GameTree();
const auto = prefs.autoStudy();
if (auto){ try { tree = GameTree.deserialize(auto); } catch {} }

const pdf = new PdfView($('pages'), $('reader'));
let currentBookId = null;

const board = new Board($('board'), { onMove: handleMove });

/* ---------------- board / moves ---------------- */
function kingSquare(color){
  const rows = tree.fen().split(' ')[0].split('/');
  const target = color === 'w' ? 'K' : 'k';
  for (let r = 0; r < 8; r++){
    let f = 0;
    for (const ch of rows[r]){
      if (/\d/.test(ch)){ f += +ch; continue; }
      if (ch === target) return FILES[f] + (8 - r);
      f++;
    }
  }
  return null;
}

function refresh(){
  const lm = tree.current.parent ? [tree.current.from, tree.current.to] : null;
  const check = tree.inCheck() ? kingSquare(tree.turnColor() === 'white' ? 'w' : 'b') : null;
  board.setPosition({ fen: tree.fen(), dests: tree.dests(), lastMove: lm, check });
  renderMoves();
  updateComment();
  updateStatus();
  $('fen-out').textContent = tree.fen();
  prefs.setAutoStudy(tree.serialize());
}

function handleMove(from, to){
  if (tree.isPromotion(from, to)){
    askPromotion(tree.turnColor(), (piece) => { tree.move(from, to, piece); refresh(); });
  } else {
    tree.move(from, to);
    refresh();
  }
}

function updateStatus(){
  const badge = $('turn-badge');
  if (tree.isGameOver()){ badge.textContent = 'Game over'; return; }
  const side = tree.turnColor() === 'white' ? 'White' : 'Black';
  badge.textContent = (tree.inCheck() ? 'Check — ' : '') + side + ' to move';
}

/* ---------------- move list with variations ---------------- */
function renderMoves(){
  const box = $('moves');
  box.innerHTML = '';
  renderLine(box, tree.root, true, false);
  const cur = box.querySelector('.mv.current');
  if (cur) cur.scrollIntoView({ block:'nearest' });
}

function moveEl(node, showNum){
  const span = document.createElement('span');
  span.className = 'mv' + (node === tree.current ? ' current' : '') + (node.comment ? ' has-comment' : '');
  span.dataset.id = node.id;
  let text = '';
  if (node.color === 'w') text = `${node.number}. ${node.san}`;
  else text = (showNum ? `${node.number}… ` : '') + node.san;
  span.textContent = text + ' ';
  span.addEventListener('click', () => { tree.gotoId(node.id); refresh(); });
  return span;
}

// render the mainline starting from `pos`, injecting variations inline
function renderLine(container, pos, blackNeedsNum, asVariation){
  while (pos.children.length){
    const main = pos.children[0];
    container.appendChild(moveEl(main, main.color === 'w' || blackNeedsNum));
    blackNeedsNum = false;

    if (main.comment && !asVariation){
      const c = document.createElement('span');
      c.className = 'inline-comment';
      c.textContent = '“' + main.comment + '” ';
      container.appendChild(c);
      blackNeedsNum = true;
    }

    if (pos.children.length > 1){
      for (let i = 1; i < pos.children.length; i++){
        const v = pos.children[i];
        const wrap = document.createElement('span');
        wrap.className = 'variation';
        const open = document.createElement('span'); open.className = 'var-open'; open.textContent = '( '; wrap.appendChild(open);
        wrap.appendChild(moveEl(v, true));
        renderLine(wrap, v, false, true);
        const close = document.createElement('span'); close.className = 'var-close'; close.textContent = ') '; wrap.appendChild(close);
        container.appendChild(wrap);
      }
      blackNeedsNum = true;
    }
    pos = main;
  }
}

/* ---------------- comment ---------------- */
function updateComment(){
  const ta = $('comment');
  ta.value = tree.current.comment || '';
  ta.disabled = tree.current === tree.root;
  ta.placeholder = tree.current === tree.root
    ? 'Play a move first, then add the book’s notes here…'
    : 'Type notes for the current move…';
}
$('comment').addEventListener('input', (e) => {
  tree.setComment(e.target.value);
  const cur = $('moves').querySelector('.mv.current');
  if (cur) cur.classList.toggle('has-comment', !!e.target.value);
  prefs.setAutoStudy(tree.serialize());
});

/* ---------------- promotion ---------------- */
function askPromotion(color, cb){
  const modal = $('promo-modal');
  const picker = $('promo-picker');
  picker.innerHTML = '';
  for (const k of ['q','r','b','n']){
    const btn = document.createElement('button');
    const pc = document.createElement('div');
    pc.className = 'piece ' + (color === 'white' ? 'w' : 'b') + k.toUpperCase();
    pc.style.cssText = 'position:static;width:100%;height:100%;filter:none;';
    btn.appendChild(pc);
    btn.addEventListener('click', () => { modal.hidden = true; cb(k); });
    picker.appendChild(btn);
  }
  modal.hidden = false;
}
$('promo-modal').addEventListener('click', (e) => { if (e.target.id === 'promo-modal') $('promo-modal').hidden = true; });

/* ---------------- navigation buttons ---------------- */
$('nav-start').onclick = () => { tree.toStart(); refresh(); };
$('nav-back').onclick  = () => { tree.back(); refresh(); };
$('nav-fwd').onclick   = () => { tree.forward(); refresh(); };
$('nav-end').onclick   = () => { tree.toEnd(); refresh(); };
$('board-flip').onclick = () => board.flip();
$('board-reset').onclick = () => {
  if (confirm('Start a new game? This clears the current moves (export first if you want to keep them).')){
    tree = new GameTree(); refresh();
  }
};
$('mainline-btn').onclick = () => { tree.makeMainline(); refresh(); };
$('delete-btn').onclick = () => {
  if (tree.current === tree.root) return;
  tree.deleteFromHere(); refresh();
};

document.addEventListener('keydown', (e) => {
  if (['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) return;
  if (e.key === 'ArrowLeft'){ tree.back(); refresh(); }
  else if (e.key === 'ArrowRight'){ tree.forward(); refresh(); }
  else if (e.key === 'Home'){ tree.toStart(); refresh(); }
  else if (e.key === 'End'){ tree.toEnd(); refresh(); }
});

/* ---------------- FEN setup ---------------- */
$('fen-set').onclick = () => {
  const fen = $('fen-input').value.trim();
  if (!fen) return;
  try {
    const t = new GameTree(fen);
    if (t.fen().split(' ')[0] !== fen.split(' ')[0]) throw new Error('bad');
    tree = t; refresh();
    $('fen-input').value = '';
  } catch { alert('That FEN doesn’t look valid.'); }
};

/* ---------------- PGN export / import ---------------- */
$('btn-download-pgn').onclick = () => {
  const white = prompt('White player / label:', 'Study') ?? 'Study';
  const black = prompt('Black player / label:', 'Analysis') ?? 'Analysis';
  const pgn = tree.pgn({ White: white, Black: black });
  const blob = new Blob([pgn], { type: 'application/x-chess-pgn' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (white + '_vs_' + black).replace(/\s+/g,'_') + '.pgn';
  a.click();
  URL.revokeObjectURL(a.href);
};

$('btn-import-pgn').onclick = () => $('pgn-input').click();
$('pgn-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  importPgn(text);
  e.target.value = '';
});

// Import a PGN into the tree (handles variations, comments, and a SetUp FEN).
function importPgn(text){
  try {
    const fenTag = /\[FEN\s+"([^"]+)"\]/.exec(text);
    const start = fenTag ? fenTag[1] : undefined;
    const t = start ? new GameTree(start) : new GameTree();

    // strip tag pairs, keep movetext
    let mt = text.replace(/\[[^\]]*\]/g, ' ');
    // tokenize: comments {..}, parens, move numbers, SAN
    const tokens = mt.match(/\{[^}]*\}|\(|\)|\d+\.(\.\.)?|\$\d+|[A-Za-z][A-Za-z0-9=+#!?-]*|O-O(?:-O)?|1-0|0-1|1\/2-1\/2|\*/g) || [];

    const stack = [];
    let node = t.root;
    let lastForComment = null;
    for (const tok of tokens){
      if (tok === '(') { stack.push(node); node = node.parent || node; continue; }
      if (tok === ')') { node = stack.pop() || t.root; continue; }
      if (/^\{/.test(tok)) { if (lastForComment) lastForComment.comment = tok.slice(1,-1).trim(); continue; }
      if (/^\d+\.(\.\.)?$/.test(tok) || /^\$\d+$/.test(tok)) continue;
      if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(tok)) continue;
      // a SAN move — apply it from `node`
      t.current = node;
      const mv = applySan(t, tok);
      if (mv){ node = t.current; lastForComment = node; }
    }
    tree = t; tree.current = t.root; refresh();
    alert('PGN imported.');
  } catch (err){ alert('Could not import that PGN.'); }
}

function applySan(t, san){
  t.chess.load(t.current.fen);
  let mv;
  try { mv = t.chess.move(san.replace(/[+#!?]+$/,'')); } catch { return null; }
  if (!mv) return null;
  return t.move(mv.from, mv.to, mv.promotion);
}

/* ---------------- saved studies ---------------- */
function refreshStudySelect(){
  const sel = $('study-select');
  sel.innerHTML = '<option value="">Saved studies…</option>';
  for (const name of Object.keys(prefs.studies())){
    const o = document.createElement('option'); o.value = name; o.textContent = name; sel.appendChild(o);
  }
}
$('save-study').onclick = () => {
  const name = prompt('Name this study:');
  if (!name) return;
  prefs.saveStudy(name, tree.serialize());
  refreshStudySelect();
};
$('study-select').onchange = (e) => {
  const name = e.target.value;
  if (!name) return;
  const data = prefs.studies()[name];
  if (data){ tree = GameTree.deserialize(data); refresh(); }
};
$('delete-study').onclick = () => {
  const name = $('study-select').value;
  if (name && confirm('Delete study “' + name + '”?')){ prefs.deleteStudy(name); refreshStudySelect(); }
};

/* ---------------- book library ---------------- */
async function refreshLibrary(){
  const sel = $('library-select');
  sel.innerHTML = '<option value="">Your books…</option>';
  const books = await bookStore.list();
  books.sort((a,b) => b.addedAt - a.addedAt);
  for (const b of books){
    const o = document.createElement('option'); o.value = b.id; o.textContent = b.name; sel.appendChild(o);
  }
  if (currentBookId) sel.value = currentBookId;
}

$('pdf-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const buf = await file.arrayBuffer();
  const id = `${file.name}::${file.size}`;
  await bookStore.put({ id, name: file.name, size: file.size, addedAt: Date.now(), data: buf });
  await refreshLibrary();
  await openBook(id);
  e.target.value = '';
});

$('library-select').onchange = (e) => { if (e.target.value) openBook(e.target.value); };

async function openBook(id){
  const rec = await bookStore.get(id);
  if (!rec) return;
  currentBookId = id;
  prefs.setLastBook(id);
  $('reader-empty').style.display = 'none';

  const st = prefs.bookState(id);
  pdf.zoom = st.zoom ?? 1;
  pdf.single = st.single ?? true;
  pdf.split = st.split ?? 0.5;
  $('single-col').checked = pdf.single;
  $('split-range').value = pdf.split;
  $('split-control').style.display = pdf.single ? '' : 'none';

  // data may be an ArrayBuffer; clone so pdf.js can transfer it
  await pdf.load(rec.data.slice(0));
  $('page-count').textContent = pdf.numPages;
  $('page-num').max = pdf.numPages;
  await pdf.setPage(Math.min(st.page || 1, pdf.numPages));
  $('page-num').value = pdf.page;
  refreshBookmarks();
  $('library-select').value = id;
}

function saveBookState(){
  if (!currentBookId) return;
  const st = prefs.bookState(currentBookId);
  st.page = pdf.page; st.zoom = pdf.zoom; st.single = pdf.single; st.split = pdf.split;
  prefs.setBookState(currentBookId, st);
}

/* ---------- reader controls ---------- */
async function gotoPage(n){ await pdf.setPage(n); $('page-num').value = pdf.page; saveBookState(); }
$('page-prev').onclick = () => gotoPage(pdf.page - 1);
$('page-next').onclick = () => gotoPage(pdf.page + 1);
$('page-num').addEventListener('change', (e) => gotoPage(parseInt(e.target.value, 10) || 1));
$('zoom-in').onclick  = async () => { await pdf.setZoom(pdf.zoom + 0.15); saveBookState(); };
$('zoom-out').onclick = async () => { await pdf.setZoom(pdf.zoom - 0.15); saveBookState(); };
$('single-col').addEventListener('change', async (e) => {
  await pdf.setSingle(e.target.checked);
  $('split-control').style.display = e.target.checked ? '' : 'none';
  saveBookState();
});
$('split-range').addEventListener('input', async (e) => { await pdf.setSplit(parseFloat(e.target.value)); saveBookState(); });

/* ---------- bookmarks ---------- */
function refreshBookmarks(){
  const sel = $('bm-select');
  sel.innerHTML = '<option value="">Bookmarks</option>';
  if (!currentBookId) return;
  for (const bm of prefs.bookState(currentBookId).bookmarks){
    const o = document.createElement('option'); o.value = bm.page; o.textContent = `p.${bm.page} — ${bm.label}`; sel.appendChild(o);
  }
}
$('bm-add').onclick = () => {
  if (!currentBookId) return;
  const label = prompt('Bookmark label:', 'Chapter / diagram');
  if (label === null) return;
  const st = prefs.bookState(currentBookId);
  st.bookmarks.push({ page: pdf.page, label: label || 'Bookmark' });
  st.bookmarks.sort((a,b) => a.page - b.page);
  prefs.setBookState(currentBookId, st);
  refreshBookmarks();
};
$('bm-select').onchange = (e) => { if (e.target.value) gotoPage(parseInt(e.target.value, 10)); };

/* re-render on resize (debounced) */
let rz;
window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => pdf.render(), 200); });

/* resizable divider */
(function(){
  const divider = $('divider');
  const book = $('book-panel');
  let dragging = false;
  divider.addEventListener('pointerdown', (e) => { dragging = true; e.preventDefault(); });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const layout = document.querySelector('.layout');
    const pct = ((e.clientX - layout.offsetLeft) / layout.clientWidth) * 100;
    if (pct > 25 && pct < 75){ book.style.flex = `0 0 ${pct}%`; }
  });
  window.addEventListener('pointerup', () => { if (dragging){ dragging = false; pdf.render(); } });
})();

/* ---------------- boot ---------------- */
(async function init(){
  refresh();
  refreshStudySelect();
  await refreshLibrary();
  const last = prefs.lastBook();
  if (last){ try { await openBook(last); } catch {} }
})();
