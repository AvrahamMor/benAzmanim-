const fs = require('fs');
const path = './src/App.css';
let content = fs.readFileSync(path, 'utf8');

// Find the start of the bad encoding. It starts after line 646.
// Let's just remove anything after .table-wrapper::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.25); }
const anchor = '.table-wrapper::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.25); }';
const idx = content.indexOf(anchor);

if (idx !== -1) {
  content = content.substring(0, idx + anchor.length);
  content += `\n\n.double-shift-badge {
  position: absolute;
  top: -10px;
  right: 0px;
  background: var(--danger, #ef4444);
  color: white;
  font-size: 0.65rem;
  padding: 1px 4px;
  border-radius: 4px;
  pointer-events: none;
  font-weight: bold;
  z-index: 2;
  box-shadow: 0 1px 2px rgba(0,0,0,0.2);
}\n`;
  fs.writeFileSync(path, content, 'utf8');
  console.log('Fixed CSS file');
} else {
  console.log('Anchor not found');
}
