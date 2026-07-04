/* tree.js — a move tree with variations, built on chess.js. Powers a
   Lichess-style analysis board and standard PGN (with variations & comments). */

import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.0.0/dist/esm/chess.js';

const STARTPOS = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

let SEQ = 1;

export class GameTree {
  constructor(startFen = STARTPOS){
    this.chess = new Chess();
    this._start = startFen;
    this._loadStart(startFen);
    this.root = { id: SEQ++, san:null, from:null, to:null, promotion:null,
                  fen:this.chess.fen(), parent:null, children:[], comment:'', color:null, number:null };
    this.current = this.root;
  }

  _loadStart(fen){
    try { this.chess.load(fen); } catch { this.chess.load(STARTPOS); this._start = STARTPOS; }
  }

  /* ---- position helpers ---- */
  fen(){ return this.current.fen; }
  turnColor(){ this.chess.load(this.current.fen); return this.chess.turn() === 'w' ? 'white' : 'black'; }

  inCheck(){ this.chess.load(this.current.fen); return this.chess.inCheck(); }
  isGameOver(){ this.chess.load(this.current.fen); return this.chess.isGameOver(); }

  // map of from-square -> [to-squares] for the current position
  dests(){
    this.chess.load(this.current.fen);
    const d = {};
    for (const m of this.chess.moves({ verbose:true })) {
      (d[m.from] ||= []).push(m.to);
    }
    return d;
  }

  isPromotion(from, to){
    this.chess.load(this.current.fen);
    return this.chess.moves({ square:from, verbose:true }).some(m => m.to === to && m.promotion);
  }

  /* ---- mutating the tree ---- */
  move(from, to, promotion){
    this.chess.load(this.current.fen);
    let mv;
    try { mv = this.chess.move({ from, to, promotion: promotion || 'q' }); }
    catch { return null; }
    if (!mv) return null;

    const fen = this.chess.fen();
    let child = this.current.children.find(c => c.san === mv.san);
    if (!child) {
      const fullmove = parseInt(this.current.fen.split(' ')[5], 10) || 1;
      child = { id: SEQ++, san: mv.san, from: mv.from, to: mv.to, promotion: mv.promotion || null,
                fen, parent: this.current, children: [], comment:'',
                color: mv.color, number: fullmove };
      this.current.children.push(child);
    }
    this.current = child;
    return child;
  }

  goto(node){ if (node) this.current = node; }
  gotoId(id){ const n = this.findById(id); if (n) this.current = n; return n; }
  back(){ if (this.current.parent) this.current = this.current.parent; }
  forward(){ if (this.current.children[0]) this.current = this.current.children[0]; }
  toStart(){ this.current = this.root; }
  toEnd(){ while (this.current.children[0]) this.current = this.current.children[0]; }

  findById(id, node = this.root){
    if (node.id === id) return node;
    for (const c of node.children){ const f = this.findById(id, c); if (f) return f; }
    return null;
  }

  setComment(text){ if (this.current !== this.root) this.current.comment = text; }

  deleteFromHere(){
    const n = this.current;
    if (n === this.root) { // clear everything
      this.root.children = [];
      return;
    }
    const p = n.parent;
    p.children = p.children.filter(c => c !== n);
    this.current = p;
  }

  makeMainline(){
    const n = this.current;
    if (!n.parent) return;
    const arr = n.parent.children;
    const i = arr.indexOf(n);
    if (i > 0){ arr.splice(i, 1); arr.unshift(n); }
  }

  // path of nodes from root (exclusive) to current — used to draw last move / highlight
  pathToCurrent(){
    const path = [];
    let n = this.current;
    while (n && n.parent){ path.unshift(n); n = n.parent; }
    return path;
  }

  /* ---- serialization ---- */
  serialize(){
    const ser = (n) => ({ san:n.san, from:n.from, to:n.to, promotion:n.promotion, fen:n.fen,
                          comment:n.comment, color:n.color, number:n.number, children:n.children.map(ser) });
    return { start: this._start, children: this.root.children.map(ser), currentId: this.current.id };
  }

  static deserialize(data){
    const t = new GameTree(data.start || STARTPOS);
    const build = (obj, parent) => {
      const node = { id: SEQ++, san:obj.san, from:obj.from, to:obj.to, promotion:obj.promotion,
                     fen:obj.fen, parent, children:[], comment:obj.comment || '', color:obj.color, number:obj.number };
      node.children = (obj.children || []).map(c => build(c, node));
      return node;
    };
    t.root.children = (data.children || []).map(c => build(c, t.root));
    t.current = t.root;
    return t;
  }

  /* ---- PGN export (with variations + comments) ---- */
  pgn(headers = {}){
    const tags = Object.assign({
      Event: 'ChessBook Study', Site: 'ChessBook',
      Date: new Date().toISOString().slice(0,10).replace(/-/g,'.'),
      Round: '-', White: '?', Black: '?', Result: '*'
    }, headers);

    let out = '';
    for (const [k,v] of Object.entries(tags)) out += `[${k} "${v}"]\n`;
    if (this._start !== STARTPOS){
      out += `[SetUp "1"]\n[FEN "${this._start}"]\n`;
    }
    out += '\n';

    const body = this._writeLine(this.root, true);
    out += (body ? body + ' ' : '') + tags.Result + '\n';
    return out;
  }

  _token(node, blackNeedsNum){
    if (node.color === 'w') return `${node.number}. ${node.san}`;
    return (blackNeedsNum ? `${node.number}... ` : '') + node.san;
  }

  _writeLine(pos, blackNeedsNum){
    const out = [];
    while (pos.children.length){
      const main = pos.children[0];
      out.push(this._token(main, blackNeedsNum));
      blackNeedsNum = false;
      if (main.comment){ out.push(`{${main.comment.replace(/[{}]/g,'')}}`); blackNeedsNum = true; }

      if (pos.children.length > 1){
        for (let i = 1; i < pos.children.length; i++){
          const v = pos.children[i];
          let head = this._token(v, true);
          if (v.comment) head += ` {${v.comment.replace(/[{}]/g,'')}}`;
          const rest = this._writeLine(v, false);
          out.push('(' + (head + (rest ? ' ' + rest : '')).trim() + ')');
        }
        blackNeedsNum = true; // mainline black move after a variation shows its number
      }
      pos = main;
    }
    return out.join(' ');
  }
}
