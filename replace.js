const fs = require('fs'); 
const appPath = 'c:/Users/fabri/OneDrive/Desktop/Clone-Gone/gone-site/src/App.jsx'; 
let app = fs.readFileSync(appPath, 'utf8'); 
app = app.replace(/background:\s*['"]#(fff|ffffff)['"]/gi, "background: 'var(--bg-card)'"); 
fs.writeFileSync(appPath, app);
console.log('Done');
