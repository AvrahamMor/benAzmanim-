const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, 'src', 'App.jsx');
let appCode = fs.readFileSync(appPath, 'utf8');

// 1. Add import if not exists
if (!appCode.includes('import html2canvas from')) {
    appCode = appCode.replace("import React", "import html2canvas from 'html2canvas';\nimport React");
}

// 2. Add handleExportSchedule function
const exportFunc = `
  const handleExportSchedule = async () => {
    const target = document.getElementById('schedule-export-target');
    if (!target) return;
    
    try {
      const canvas = await html2canvas(target, {
        scale: 2,
        backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
      });
      
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = \`סידור_עבודה_\${currentView}.png\`;
      link.click();
    } catch (err) {
      console.error('Failed to export schedule', err);
      alert('אירעה שגיאה בייצוא הסידור');
    }
  };
`;

if (!appCode.includes('handleExportSchedule')) {
    // Insert after const [isDarkMode...] or similar inside App()
    appCode = appCode.replace("const [isDarkMode, setIsDarkMode] = useState(false);", "const [isDarkMode, setIsDarkMode] = useState(false);\n" + exportFunc);
}

// 3. Add Download icon to imports from lucide-react if not exists (wait, Download is already imported at line 2 as per previous view_file)
// Let's check: import { ..., Download } from 'lucide-react';
if (!appCode.includes('Download')) {
    appCode = appCode.replace("from 'lucide-react';", ", Download } from 'lucide-react';");
    appCode = appCode.replace("}, Download }", "} from"); // rough cleanup if needed, but it should be fine. Actually, it's already there in line 2.
}

// 4. Add the button in department-view header
const buttonHtml = `
            <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1>מחלקת {currentView}</h1>
                <p>סידור עבודה שבועי</p>
              </div>
              <button 
                onClick={handleExportSchedule}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', 
                  padding: '8px 16px', background: 'var(--primary-color)', 
                  color: 'white', border: 'none', borderRadius: '8px', 
                  cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold'
                }}
              >
                <Download size={20} />
                הורד סידור עבודה
              </button>
            </div>`;

if (!appCode.includes('handleExportSchedule}')) {
    appCode = appCode.replace(
        /<div className="view-header">[\s\S]*?<\/div>/,
        buttonHtml
    );
}

// 5. Add id to table-wrapper
if (!appCode.includes('id="schedule-export-target"')) {
    appCode = appCode.replace(
        '<div className="table-wrapper">',
        '<div className="table-wrapper" id="schedule-export-target" style={{ padding: "16px", background: "var(--bg-color)" }}>'
    );
}

fs.writeFileSync(appPath, appCode);
console.log('App.jsx updated with export feature.');
