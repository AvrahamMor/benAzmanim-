const fs = require('fs');
const path = require('path');

const appCssPath = path.join(__dirname, 'src', 'App.css');
let cssCode = fs.readFileSync(appCssPath, 'utf8');

// Replace :root variables
cssCode = cssCode.replace(
  /:root \{[\s\S]*?\}/,
  `:root {
  --primary-color: #d4af37;
  --primary-hover: #b5952f;
  --bg-color: #121212;
  --sidebar-bg: rgba(20, 20, 20, 0.95);
  --card-bg: rgba(30, 30, 30, 0.9);
  --card-border: rgba(212, 175, 55, 0.3);
  --text-dark: #f8f8f8;
  --text-muted: #a0a0a0;
  --danger: #ef4444;
  --danger-light: rgba(239, 68, 68, 0.2);
  --success: #10b981;
  --warning: #f59e0b;
}`
);

// Remove body.dark-mode block
cssCode = cssCode.replace(/body\.dark-mode \{[\s\S]*?\}/, '');

// Replace body background
cssCode = cssCode.replace(
  /body \{[\s\S]*?\}/,
  `body {
  font-family: 'Heebo', sans-serif;
  background: radial-gradient(circle at center, #1a1a1a 0%, #000000 100%);
  color: var(--text-dark);
  min-height: 100vh;
  margin: 0;
}`
);

// We need to also clean up some hardcoded light colors in table th, td, etc.
// Replace schedule-matrix th background
cssCode = cssCode.replace(
  /\.schedule-matrix th \{[\s\S]*?\}/,
  `.schedule-matrix th {
  padding: 16px;
  background: rgba(20, 20, 20, 0.95);
  color: var(--primary-color);
  font-weight: 600;
  text-align: center;
  position: sticky;
  top: 0;
  z-index: 10;
  border-bottom: 2px solid var(--card-border);
}`
);

cssCode = cssCode.replace(
  /\.matrix-cell \{[\s\S]*?\}/,
  `.matrix-cell {
  background: rgba(30, 30, 30, 0.8);
  border: 1px solid var(--card-border);
  min-width: 160px;
  vertical-align: top;
  transition: all 0.3s ease;
}`
);

cssCode = cssCode.replace(
  /\.matrix-cell:hover \{[\s\S]*?\}/,
  `.matrix-cell:hover {
  background: rgba(40, 40, 40, 0.95);
}`
);

cssCode = cssCode.replace(
  /\.matrix-cell\.active-cell \{[\s\S]*?\}/,
  `.matrix-cell.active-cell {
  background: rgba(30, 30, 30, 0.95);
  box-shadow: inset 0 0 0 1px var(--primary-color);
}`
);

cssCode = cssCode.replace(
  /\.slot-num-cell \{[\s\S]*?\}/,
  `.slot-num-cell {
  background: rgba(20, 20, 20, 0.8);
  color: var(--primary-color);
  font-weight: bold;
  text-align: center;
  vertical-align: middle;
  border-left: 2px solid var(--card-border);
}`
);

cssCode = cssCode.replace(
  /\.compact-input, \.compact-time \{[\s\S]*?\}/,
  `.compact-input, .compact-time {
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(10, 10, 10, 0.8);
  border-radius: 6px;
  padding: 6px;
  font-size: 0.9rem;
  font-family: inherit;
  transition: all 0.2s;
  color: #fff;
}`
);

cssCode = cssCode.replace(
  /\.compact-input:focus, \.compact-time:focus, \.compact-input:hover, \.compact-time:hover \{[\s\S]*?\}/,
  `.compact-input:focus, .compact-time:focus, .compact-input:hover, .compact-time:hover {
  background: rgba(20, 20, 20, 0.9);
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.2);
  outline: none;
}`
);

fs.writeFileSync(appCssPath, cssCode);
console.log('App.css updated with Black and Gold theme.');
