/* pdfview.js — render a PDF page and, for 2-column books, slice it into a
   single tall column so text stays large while you scroll. */

import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

export class PdfView {
  constructor(pagesEl, readerEl){
    this.pagesEl = pagesEl;
    this.readerEl = readerEl;
    this.pdf = null;
    this.page = 1;
    this.numPages = 0;
    this.zoom = 1;
    this.single = true;
    this.split = 0.5;
    this._token = 0;   // guards against overlapping renders
  }

  async load(data){
    this.pdf = await pdfjsLib.getDocument({ data }).promise;
    this.numPages = this.pdf.numPages;
  }

  setPage(n){ this.page = Math.min(Math.max(1, n | 0), this.numPages || 1); return this.render(); }
  next(){ return this.setPage(this.page + 1); }
  prev(){ return this.setPage(this.page - 1); }
  setZoom(z){ this.zoom = Math.min(2.6, Math.max(0.5, z)); return this.render(); }
  setSingle(v){ this.single = v; return this.render(); }
  setSplit(v){ this.split = v; return this.render(); }

  async render(){
    if (!this.pdf) return;
    const token = ++this._token;
    const page = await this.pdf.getPage(this.page);
    if (token !== this._token) return;

    const base = page.getViewport({ scale: 1 });
    const containerW = Math.max(320, this.readerEl.clientWidth - 40);

    // choose a render scale so one column roughly fills the container width
    const colWidthPts = this.single ? base.width * this.split : base.width;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = (containerW * this.zoom) / colWidthPts * dpr;
    const viewport = page.getViewport({ scale });

    const full = document.createElement('canvas');
    full.width = viewport.width;
    full.height = viewport.height;
    const ctx = full.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    if (token !== this._token) return;

    this.pagesEl.innerHTML = '';
    if (this.single){
      const cut = Math.round(full.width * this.split);
      this.pagesEl.appendChild(this._slice(full, 0, cut, 'Left column'));
      this.pagesEl.appendChild(this._slice(full, cut, full.width - cut, 'Right column'));
    } else {
      const img = document.createElement('canvas');
      img.width = full.width; img.height = full.height;
      img.getContext('2d').drawImage(full, 0, 0);
      img.className = 'page-slice';
      this.pagesEl.appendChild(img);
    }
    this.readerEl.scrollTop = 0;
  }

  _slice(full, sx, sw, label){
    const wrap = document.createDocumentFragment();
    const tag = document.createElement('div');
    tag.className = 'slice-label';
    tag.textContent = label;
    const c = document.createElement('canvas');
    c.width = sw; c.height = full.height;
    c.className = 'page-slice';
    c.getContext('2d').drawImage(full, sx, 0, sw, full.height, 0, 0, sw, full.height);
    wrap.appendChild(tag);
    wrap.appendChild(c);
    return wrap;
  }
}
