import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

function saveSchedulePlugin() {
  return {
    name: 'save-schedule-api',
    configureServer(server) {
      server.middlewares.use('/api/save-schedule', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              const filePath = path.join(__dirname, 'src', 'schedule.json');
              // Ensure we write exactly what was received (pretty formatted)
              const parsed = JSON.parse(body);
              fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2) + '\n');
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true }));
            } catch (err) {
              console.error('Error saving schedule.json:', err);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
        } else {
          res.statusCode = 405;
          res.end('Method Not Allowed');
        }
      });


      server.middlewares.use('/api/archive-schedule', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              const archivesPath = path.join(__dirname, 'src', 'archives.json');
              let archives = [];
              if (fs.existsSync(archivesPath)) {
                archives = JSON.parse(fs.readFileSync(archivesPath, 'utf8'));
              }
              const newArchive = JSON.parse(body);
              archives.push(newArchive);
              fs.writeFileSync(archivesPath, JSON.stringify(archives, null, 2) + '\n');
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true }));
            } catch (err) {
              console.error('Error saving archives.json:', err);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
        } else {
          res.statusCode = 405;
          res.end('Method Not Allowed');
        }
      });

      server.middlewares.use('/api/get-archives', (req, res) => {
        if (req.method === 'GET') {
          try {
            const archivesPath = path.join(__dirname, 'src', 'archives.json');
            let archives = [];
            if (fs.existsSync(archivesPath)) {
              archives = JSON.parse(fs.readFileSync(archivesPath, 'utf8'));
            }
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(archives));
          } catch (err) {
            console.error('Error reading archives.json:', err);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        } else {
          res.statusCode = 405;
          res.end('Method Not Allowed');
        }
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), saveSchedulePlugin()],
});
