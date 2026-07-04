# ♞ ChessBook

A warm, paper-themed web app for **studying chess books**. Upload a `.pdf`,
read it next to a full analysis board, play through the moves and variations
just like on Lichess, transcribe the book's comments, and export everything to
standard `.pgn`.

Everything runs **100% in your browser** — no server, no accounts. Books are
stored locally (IndexedDB), so they stay on your machine. That also means it
drops straight onto **GitHub Pages**.

## Features

- **PDF reader with 2-column splitting** — chess books are usually printed in
  two columns. Toggle **Single column** and ChessBook slices each page into one
  wide column stacked top-to-bottom, so the text is big and you just scroll down.
  A **gutter** slider aligns the cut, and `A+ / A−` zoom the page.
- **Analysis board** — drag or click pieces, legal-move dots, last-move and
  check highlights, board flip. Powered by [chess.js](https://github.com/jhlywa/chess.js).
- **Variations** — branch anywhere; alternatives show inline in parentheses like
  a real move list. *Make main line* / *Delete from here* to prune.
- **Comments** — type the book's notes on any move; they're saved and exported.
- **Set up a position** — paste a FEN from a diagram to start mid-game.
- **Export / import PGN** — full games with variations and comments.
- **Library & bookmarks** — multiple books stored locally; bookmark pages;
  it reopens your last book on the page you left off.
- **Saved studies** — keep several analyses in the browser and switch between them.

## Run locally

Because it uses ES modules, open it through a tiny web server (not `file://`):

```bash
cd ChessBook
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy to GitHub Pages

1. Create a repository on GitHub and push these files to it:
   ```bash
   git init
   git add .
   git commit -m "ChessBook"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
2. On GitHub: **Settings → Pages → Build and deployment**, set
   **Source = Deploy from a branch**, **Branch = `main` / `root`**, Save.
3. Your app is live at `https://<you>.github.io/<repo>/` in a minute or two.

No build step is needed — it's plain HTML/CSS/JS. The chess and PDF libraries
load from the jsDelivr CDN, so an internet connection is required the first time.

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| ← / → | Back / forward one move |
| Home / End | Jump to start / end of the line |

## How it's built

```
index.html        layout
css/style.css     the "old book" theme
js/board.js       self-contained board (Unicode pieces, drag & click)
js/tree.js        move tree with variations + PGN reader/writer
js/pdfview.js     PDF rendering + 2-column → 1-column slicing
js/storage.js     IndexedDB (books) + localStorage (state, bookmarks, studies)
js/app.js         wiring
```

Your books and studies live only in this browser. Clearing site data removes
them — use **Save .pgn** to keep any analysis you care about.
