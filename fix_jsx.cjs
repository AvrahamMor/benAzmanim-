const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, 'src', 'App.jsx');
let appCode = fs.readFileSync(appPath, 'utf8');

// I need to find the place where I messed up the JSX.
// At line 538, we have </tbody> of the employees-table.
// Then I added </table> </div> <div> <button addRow> </div> </div> </div> )}
// And then it jumps straight to: </tr> </thead> <tbody> {/* Morning Section */}

const badSectionRegex = /<\/tbody>\s*<\/table>\s*<\/div>\s*<div style={{ padding: '16px', textAlign: 'center', marginTop: '10px' }}>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*\)}\s*<\/tr>\s*<\/thead>\s*<tbody>/m;

const correctSection = `</tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Department Schedule View */}
        {CATEGORIES.includes(currentView) && (
          <div className="schedule-view">
            <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1>סידור עבודה: {currentView}</h1>
                <p>ניהול משמרות יומי ושבועי</p>
              </div>
              <button 
                onClick={handleExportSchedule}
                className="btn-primary" 
                style={{ background: 'var(--primary-color)' }}
              >
                <Download size={18} /> הורד סידור עבודה
              </button>
            </div>

            <div className="board">
              <div id="schedule-export-target" className="table-wrapper">
                <table className="schedule-matrix">
                  <thead>
                    <tr>
                      <th className="slot-num-col">#</th>
                      {DAYS.map(day => (
                        <th key={day}>{day}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>`;

if (appCode.match(badSectionRegex)) {
  appCode = appCode.replace(badSectionRegex, correctSection);
  console.log("Replaced bad section!");
} else {
  console.log("Could not find bad section.");
}

// Now I need to correctly add the AddRow button at the end of the CATEGORIES block!
// The CATEGORIES block ends with:
//                      );
//                     })}
//                   </tbody>
//                 </table>
//               </div>
//             </div>
//           </div>
//         )}

const endOfCategoriesRegex = /<\/tbody>\s*<\/table>\s*<\/div>\s*<\/div>\s*<\/div>\s*\)}/m;

const newEndOfCategories = `</tbody>
                </table>
              </div>
              <div style={{ padding: '16px', textAlign: 'center', marginTop: '10px' }}>
                <button onClick={() => addRow(currentView)} className="btn-primary" style={{ background: 'var(--primary-color)' }}>
                   <Plus size={18} style={{marginLeft: '8px'}} /> הוסף שורת משמרת ריקה
                </button>
              </div>
            </div>
          </div>
        )}`;

if (appCode.match(endOfCategoriesRegex)) {
  appCode = appCode.replace(endOfCategoriesRegex, newEndOfCategories);
  console.log("Added addRow to Categories view!");
} else {
  console.log("Could not find end of Categories block.");
}

fs.writeFileSync(appPath, appCode);
