/* board.js — a self-contained chessboard (no external assets).
   Renders from FEN, supports click-to-move and drag-and-drop, shows
   legal-move dots, last move and check highlights. */

const GLYPH = { k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟' };
const FILES = 'abcdefgh';

export class Board {
  constructor(el, { onMove }){
    this.el = el;
    this.onMove = onMove;
    this.orientation = 'white';
    this.fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    this.dests = {};
    this.selected = null;
    this.lastMove = null;   // [from, to]
    this.check = null;      // square of king in check
    this.squares = {};      // square -> element
    this.drag = null;

    this._buildGrid();
    this.el.addEventListener('pointerdown', e => this._onDown(e));
    window.addEventListener('pointermove', e => this._onMoveEvt(e));
    window.addEventListener('pointerup', e => this._onUp(e));
  }

  _buildGrid(){
    this.el.innerHTML = '';
    this.squares = {};
    const ranks = this.orientation === 'white' ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
    const files = this.orientation === 'white' ? [0,1,2,3,4,5,6,7] : [7,6,5,4,3,2,1,0];
    for (const r of ranks){
      for (const f of files){
        const sq = FILES[f] + (r+1);
        const cell = document.createElement('div');
        cell.className = 'sq ' + (((f + r) % 2 === 0) ? 'dark' : 'light');
        cell.dataset.square = sq;
        // edge coordinates
        if (f === (this.orientation === 'white' ? 0 : 7)){
          const c = document.createElement('span'); c.className = 'coord rank'; c.textContent = r+1; cell.appendChild(c);
        }
        if (r === (this.orientation === 'white' ? 0 : 7)){
          const c = document.createElement('span'); c.className = 'coord file'; c.textContent = FILES[f]; cell.appendChild(c);
        }
        this.el.appendChild(cell);
        this.squares[sq] = cell;
      }
    }
  }

  setOrientation(o){ this.orientation = o; this._buildGrid(); this.render(); }
  flip(){ this.setOrientation(this.orientation === 'white' ? 'black' : 'white'); }

  setPosition({ fen, dests, lastMove, check }){
    this.fen = fen;
    this.dests = dests || {};
    this.lastMove = lastMove || null;
    this.check = check || null;
    this.selected = null;
    this.render();
  }

  _fenBoard(){
    const rows = this.fen.split(' ')[0].split('/');
    const map = {}; // square -> {piece,color}
    for (let r = 0; r < 8; r++){
      let f = 0;
      for (const ch of rows[r]){
        if (/\d/.test(ch)) { f += +ch; continue; }
        const sq = FILES[f] + (8 - r);
        map[sq] = { piece: ch.toLowerCase(), color: ch === ch.toUpperCase() ? 'w' : 'b' };
        f++;
      }
    }
    return map;
  }

  render(){
    const board = this._fenBoard();
    for (const [sq, cell] of Object.entries(this.squares)){
      // reset transient nodes but keep coord labels
      cell.querySelectorAll('.piece,.dot').forEach(n => n.remove());
      cell.classList.remove('selected','lastmove','check','occupied-dest');

      if (this.lastMove && (this.lastMove[0] === sq || this.lastMove[1] === sq)) cell.classList.add('lastmove');
      if (this.check === sq) cell.classList.add('check');

      const p = board[sq];
      if (p){
        const span = document.createElement('span');
        span.className = 'piece ' + p.color;
        span.textContent = GLYPH[p.piece];
        span.dataset.square = sq;
        cell.appendChild(span);
      }
    }
    if (this.selected) this._showSelection();
  }

  _showSelection(){
    const from = this.selected;
    this.squares[from]?.classList.add('selected');
    for (const to of (this.dests[from] || [])){
      const cell = this.squares[to];
      if (!cell) continue;
      const dot = document.createElement('span');
      dot.className = 'dot';
      cell.appendChild(dot);
      if (cell.querySelector('.piece')) cell.classList.add('occupied-dest');
    }
  }

  _clearSelection(){
    if (!this.selected) return;
    this.squares[this.selected]?.classList.remove('selected');
    this.el.querySelectorAll('.dot').forEach(d => d.remove());
    this.el.querySelectorAll('.occupied-dest').forEach(c => c.classList.remove('occupied-dest'));
    this.selected = null;
  }

  _isDest(from, to){ return (this.dests[from] || []).includes(to); }
  _squareAt(x, y){
    const el = document.elementFromPoint(x, y);
    return el ? el.closest('.sq')?.dataset.square : null;
  }

  _onDown(e){
    const sq = e.target.closest?.('.sq')?.dataset.square;
    if (!sq) return;
    e.preventDefault();

    // completing a click-move
    if (this.selected && this._isDest(this.selected, sq)){
      const from = this.selected; this._clearSelection();
      this.onMove(from, sq);
      return;
    }

    // selecting a movable piece → also arm a drag
    if (this.dests[sq]){
      this._clearSelection();
      this.selected = sq;
      this._showSelection();
      const piece = this.squares[sq].querySelector('.piece');
      if (piece){
        const ghost = piece.cloneNode(true);
        ghost.classList.add('drag-ghost');
        ghost.style.fontSize = getComputedStyle(piece).fontSize;
        document.body.appendChild(ghost);
        piece.style.opacity = '0.25';
        this.drag = { from: sq, ghost, piece, moved: false };
        this._moveGhost(e.clientX, e.clientY);
      }
      return;
    }
    this._clearSelection();
  }

  _onMoveEvt(e){
    if (!this.drag) return;
    this.drag.moved = true;
    this._moveGhost(e.clientX, e.clientY);
  }
  _moveGhost(x, y){ if (this.drag){ this.drag.ghost.style.left = x + 'px'; this.drag.ghost.style.top = y + 'px'; } }

  _onUp(e){
    if (!this.drag) return;
    const { from, ghost, piece, moved } = this.drag;
    ghost.remove();
    if (piece) piece.style.opacity = '';
    this.drag = null;
    if (!moved) return; // treat as a plain click — keep selection/dots
    const to = this._squareAt(e.clientX, e.clientY);
    if (to && to !== from && this._isDest(from, to)){
      this._clearSelection();
      this.onMove(from, to);
    }
  }
}
