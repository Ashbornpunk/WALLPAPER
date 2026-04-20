'use strict';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { MongoClient } = require('mongodb');

// Ensure data directories exist
const DATA_DIR = __dirname;
const WALL_DIR = path.join(DATA_DIR, 'wallpapers');
if (!fs.existsSync(WALL_DIR)) { fs.mkdirSync(WALL_DIR); }

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/anime-dark';
const DB_NAME = 'anime-dark';
let db;

// Initialize MongoDB connection
async function connectDB() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(); // Use database from URI
    console.log('Connected to MongoDB');
    
    // Migrate old data if exists
    migrateOldData();
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
}

// Migrate old JSON data to MongoDB
function migrateOldData() {
  if (fs.existsSync(path.join(DATA_DIR, 'database.json'))) {
    try {
      const oldData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'database.json'), 'utf8'));
      if (oldData.length > 0) {
        db.collection('wallpapers').countDocuments({}, (err, count) => {
          if (count === 0) {
            const migratedData = oldData.map(item => ({
              file: item.file,
              tags: item.tags,
              createdAt: new Date()
            }));
            db.collection('wallpapers').insertMany(migratedData, (err, result) => {
              if (!err) {
                console.log(`Migrated ${result.insertedCount} wallpapers from JSON to MongoDB`);
                // Optionally backup and remove old file
                fs.renameSync(path.join(DATA_DIR, 'database.json'), path.join(DATA_DIR, 'database.json.backup'));
              }
            });
          }
        });
      }
    } catch (err) {
      console.error('Migration error:', err);
    }
  }
}

// Database helper functions
function getAllWallpapers(callback) {
  db.collection('wallpapers').find({}).sort({ createdAt: -1 }).toArray((err, wallpapers) => {
    if (err) {
      console.error('Error querying database:', err);
      callback([]);
    } else {
      callback(wallpapers);
    }
  });
}

function addWallpaper(filename, tags, callback) {
  const wallpaper = {
    file: filename,
    tags: tags,
    createdAt: new Date()
  };
  db.collection('wallpapers').insertOne(wallpaper, (err, result) => {
    if (err) {
      console.error('Error inserting wallpaper:', err);
      callback(false);
    } else {
      console.log('Inserted wallpaper:', filename);
      callback(true);
    }
  });
}

// Set up Multer for uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, WALL_DIR),
  filename: (req, file, cb) => {
    // Sanitize name and append unique suffix
    let base = path.basename(file.originalname, path.extname(file.originalname))
                   .toLowerCase().replace(/[^a-z0-9]/g, '_');
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = Date.now() + '-' + Math.round(Math.random()*1E9);
    cb(null, base + '-' + unique + ext);
  }
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Enable CORS
app.use(cors());

// Serve static images
app.use('/wallpapers', express.static(WALL_DIR));

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en"><head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dark Anime Wallpapers</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=Poppins:wght@600;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      background: linear-gradient(135deg, #0a0e27 0%, #16213e 50%, #0f3460 100%);
      color: #e0e0e0;
      font-family: 'Inter', sans-serif;
      min-height: 100vh;
      overflow-x: hidden;
      position: relative;
    }
    
    body::before {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(circle at 20% 50%, rgba(255, 107, 107, 0.1) 0%, transparent 50%),
                  radial-gradient(circle at 80% 80%, rgba(78, 205, 196, 0.1) 0%, transparent 50%);
      pointer-events: none;
      z-index: 0;
    }
    
    header {
      position: relative;
      z-index: 1;
      text-align: center;
      padding: 50px 20px 30px;
      background: rgba(10, 14, 39, 0.6);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    h1 {
      font-family: 'Poppins', sans-serif;
      font-size: 3.5rem;
      font-weight: 700;
      background: linear-gradient(135deg, #ff6b6b 0%, #4ecdc4 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      text-shadow: 0 0 30px rgba(255, 107, 107, 0.3);
      animation: fadeInDown 0.8s ease;
      margin-bottom: 10px;
    }
    
    .subtitle {
      color: #a0a0a0;
      font-size: 0.95rem;
      font-weight: 300;
      animation: fadeInUp 0.8s ease 0.1s both;
    }
    
    .search-container {
      position: relative;
      z-index: 1;
      max-width: 600px;
      margin: 40px auto;
      padding: 0 20px;
      display: flex;
      gap: 12px;
      animation: fadeInUp 0.8s ease 0.2s both;
    }
    
    #s {
      flex: 1;
      padding: 14px 24px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 50px;
      color: #e0e0e0;
      font-family: 'Inter', sans-serif;
      font-size: 1rem;
      outline: none;
      transition: all 0.3s ease;
      backdrop-filter: blur(10px);
    }
    
    #s:focus {
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(255, 255, 255, 0.3);
      box-shadow: 0 0 20px rgba(78, 205, 196, 0.2);
    }
    
    #s::placeholder {
      color: rgba(224, 224, 224, 0.5);
    }
    
    .search-btn {
      padding: 14px 32px;
      background: linear-gradient(135deg, #ff6b6b 0%, #ff8e72 100%);
      border: none;
      border-radius: 50px;
      color: white;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      font-family: 'Inter', sans-serif;
      box-shadow: 0 8px 25px rgba(255, 107, 107, 0.3);
    }
    
    .search-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 35px rgba(255, 107, 107, 0.4);
    }
    
    .search-btn:active {
      transform: translateY(0);
    }
    
    .header-links {
      position: relative;
      z-index: 1;
      margin: 20px 0;
      animation: fadeInUp 0.8s ease 0.3s both;
    }
    
    .admin-link {
      display: inline-block;
      padding: 10px 24px;
      background: rgba(78, 205, 196, 0.15);
      border: 1px solid rgba(78, 205, 196, 0.3);
      border-radius: 30px;
      color: #4ecdc4;
      text-decoration: none;
      font-weight: 500;
      transition: all 0.3s ease;
      font-size: 0.95rem;
    }
    
    .admin-link:hover {
      background: rgba(78, 205, 196, 0.25);
      border-color: rgba(78, 205, 196, 0.5);
      transform: translateY(-2px);
    }
    
    #g {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 24px;
      padding: 50px 40px;
      max-width: 1400px;
      margin: 0 auto;
    }
    
    .box {
      position: relative;
      overflow: hidden;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      animation: fadeInScale 0.6s ease;
    }
    
    .box:hover {
      transform: translateY(-12px);
      box-shadow: 0 20px 40px rgba(78, 205, 196, 0.2), 0 0 30px rgba(255, 107, 107, 0.1);
      border-color: rgba(78, 205, 196, 0.3);
    }
    
    .box img {
      width: 100%;
      height: 320px;
      object-fit: cover;
      transition: transform 0.5s ease;
      display: block;
    }
    
    .box:hover img {
      transform: scale(1.08) rotate(0.5deg);
    }
    
    .overlay {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(to top, rgba(10, 14, 39, 0.95), transparent);
      padding: 24px;
      opacity: 0;
      transition: opacity 0.4s ease;
      display: flex;
      align-items: flex-end;
      height: 150px;
    }
    
    .box:hover .overlay {
      opacity: 1;
    }
    
    .download-btn {
      display: inline-block;
      padding: 10px 20px;
      background: linear-gradient(135deg, #4ecdc4 0%, #44b3aa 100%);
      border: none;
      border-radius: 25px;
      color: white;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.3s ease;
      font-family: 'Inter', sans-serif;
      box-shadow: 0 4px 15px rgba(78, 205, 196, 0.3);
    }
    
    .download-btn:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 20px rgba(78, 205, 196, 0.4);
    }
    
    .empty-state {
      grid-column: 1 / -1;
      padding: 60px 20px;
      text-align: center;
      color: #707070;
    }
    
    .empty-state p {
      font-size: 1.1rem;
      margin-bottom: 10px;
    }
    
    @keyframes fadeInDown {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    @keyframes fadeInScale {
      from {
        opacity: 0;
        transform: scale(0.9);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
    
    @media (max-width: 768px) {
      h1 { font-size: 2.5rem; }
      .search-container { flex-direction: column; }
      #g { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; padding: 30px 20px; }
      .box img { height: 240px; }
    }
  </style>
</head><body>
  <header>
    <h1>🌑 Dark Anime Wallpapers</h1>
    <p class="subtitle">Discover stunning dark anime wallpapers</p>
  </header>

  <div class="search-container">
    <input id="s" placeholder="Search by tags...">
    <button class="search-btn" onclick="load()">Search</button>
  </div>

  <div class="header-links">
    <a href="/admin" class="admin-link">+ Upload Wallpaper</a>
  </div>

  <div id="g"></div>

  <script>
    async function load() {
      const q = encodeURIComponent(document.getElementById('s').value.trim());
      const grid = document.getElementById('g');
      
      try {
        const res = await fetch('/api?w=' + q);
        if (!res.ok) throw new Error('Network error');
        
        const data = await res.json();
        grid.innerHTML = '';
        
        if (data.length === 0) {
          grid.innerHTML = '<div class="empty-state"><p>No wallpapers found</p><p style="font-size: 0.9rem; color: #505050;">Try different search terms or upload new ones!</p></div>';
          return;
        }
        
        data.forEach((w, i) => {
          const box = document.createElement('div');
          box.className = 'box';
          box.style.animationDelay = (i * 0.05) + 's';
          box.innerHTML = 
            \`<img src="/wallpapers/\${w.file}" alt="Wallpaper" loading="lazy">
             <div class="overlay">
               <a href="/wallpapers/\${w.file}" download class="download-btn">⬇ Download</a>
             </div>\`;
          grid.appendChild(box);
        });
      } catch (err) {
        grid.innerHTML = '<div class="empty-state"><p>Error loading wallpapers</p></div>';
        console.error('Load error:', err);
      }
    }
    
    window.addEventListener('load', load);
  </script>
</body></html>`);
});

// Upload form page
app.get('/admin', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en"><head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Upload Wallpaper</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=Poppins:wght@600;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      background: linear-gradient(135deg, #0a0e27 0%, #16213e 50%, #0f3460 100%);
      color: #e0e0e0;
      font-family: 'Inter', sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      position: relative;
      overflow: hidden;
    }
    
    body::before {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(circle at 20% 50%, rgba(255, 107, 107, 0.1) 0%, transparent 50%),
                  radial-gradient(circle at 80% 80%, rgba(78, 205, 196, 0.1) 0%, transparent 50%);
      pointer-events: none;
    }
    
    header {
      text-align: center;
      margin-bottom: 40px;
      animation: fadeInDown 0.8s ease;
    }
    
    h1 {
      font-family: 'Poppins', sans-serif;
      font-size: 2.5rem;
      font-weight: 700;
      background: linear-gradient(135deg, #4ecdc4 0%, #ff6b6b 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 8px;
    }
    
    .back-link {
      display: inline-block;
      margin-top: 30px;
      padding: 10px 20px;
      background: rgba(78, 205, 196, 0.15);
      border: 1px solid rgba(78, 205, 196, 0.3);
      border-radius: 30px;
      color: #4ecdc4;
      text-decoration: none;
      font-weight: 500;
      transition: all 0.3s ease;
      font-size: 0.95rem;
    }
    
    .back-link:hover {
      background: rgba(78, 205, 196, 0.25);
      border-color: rgba(78, 205, 196, 0.5);
      transform: translateY(-2px);
    }
    
    form {
      position: relative;
      z-index: 1;
      background: rgba(10, 14, 39, 0.7);
      backdrop-filter: blur(15px);
      padding: 50px;
      border-radius: 20px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      max-width: 450px;
      width: 100%;
      animation: fadeInUp 0.8s ease 0.1s both;
    }
    
    .form-group {
      margin-bottom: 24px;
    }
    
    label {
      display: block;
      margin-bottom: 8px;
      font-weight: 600;
      color: #e0e0e0;
      font-size: 0.95rem;
    }
    
    input[type="file"],
    input[type="text"] {
      width: 100%;
      padding: 14px 18px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 12px;
      color: #e0e0e0;
      font-family: 'Inter', sans-serif;
      font-size: 1rem;
      transition: all 0.3s ease;
      outline: none;
    }
    
    input[type="file"]::file-selector-button {
      background: linear-gradient(135deg, #ff6b6b 0%, #ff8e72 100%);
      border: none;
      color: white;
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      margin-right: 12px;
      transition: all 0.3s ease;
    }
    
    input[type="file"]::file-selector-button:hover {
      transform: translateY(-2px);
    }
    
    input[type="text"]::placeholder {
      color: rgba(224, 224, 224, 0.5);
    }
    
    input[type="text"]:focus,
    input[type="file"]:focus {
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(78, 205, 196, 0.3);
      box-shadow: 0 0 20px rgba(78, 205, 196, 0.2);
    }
    
    button {
      width: 100%;
      padding: 14px 24px;
      background: linear-gradient(135deg, #ff6b6b 0%, #ff8e72 100%);
      border: none;
      border-radius: 12px;
      color: white;
      font-weight: 700;
      font-size: 1rem;
      cursor: pointer;
      transition: all 0.3s ease;
      font-family: 'Inter', sans-serif;
      box-shadow: 0 8px 25px rgba(255, 107, 107, 0.3);
    }
    
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 35px rgba(255, 107, 107, 0.4);
    }
    
    button:active {
      transform: translateY(0);
    }
    
    .success-message {
      display: none;
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #4ecdc4 0%, #44b3aa 100%);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 8px 25px rgba(78, 205, 196, 0.3);
      z-index: 1000;
      animation: slideIn 0.4s ease;
    }
    
    @keyframes fadeInDown {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateX(100px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
    
    @media (max-width: 768px) {
      h1 { font-size: 1.8rem; }
      form { padding: 30px; }
    }
  </style>
</head><body>
  <header>
    <h1>📤 Upload Wallpaper</h1>
  </header>

  <form action="/upload" method="post" enctype="multipart/form-data">
    <div class="form-group">
      <label for="image">Select Image</label>
      <input type="file" id="image" name="image" accept="image/*" required>
    </div>
    
    <div class="form-group">
      <label for="tags">Tags (comma-separated)</label>
      <input type="text" id="tags" name="tags" placeholder="e.g. dark, anime, sad, night" required>
    </div>
    
    <button type="submit">Upload Wallpaper</button>
  </form>

  <a href="/" class="back-link">← Back to Gallery</a>

  <script>
    document.querySelector('form').addEventListener('submit', function(e) {
      const fileInput = document.getElementById('image');
      if (!fileInput.files[0]) {
        e.preventDefault();
        alert('Please select an image');
      }
    });
  </script>
</body></html>`);
});

// API for searching wallpapers
app.get('/api', (req, res) => {
  getAllWallpapers((wallpapers) => {
    const q = (req.query.w || '').toLowerCase();
    let result = wallpapers;
    if (q) {
      result = wallpapers.filter(item =>
        item.tags.join(' ').toLowerCase().includes(q)
      );
    }
    res.json(result);
  });
});

// Handle uploads
app.post('/upload', (req, res) => {
  upload.single('image')(req, res, err => {
    if (err) {
      console.error('Upload error:', err);
      return res.status(400).send('Upload error: ' + err.message);
    }
    if (!req.file) {
      return res.status(400).send('No file uploaded');
    }
    // Process tags
    const tags = (req.body.tags || '').split(',')
                   .map(t => t.trim().toLowerCase())
                   .filter(Boolean);
    if (tags.length === 0) {
      return res.status(400).send('No tags provided');
    }
    addWallpaper(req.file.filename, tags, (success) => {
      if (success) {
        res.redirect('/');
      } else {
        res.status(400).send('Error saving to database');
      }
    });
  });
});

// Start server
connectDB().then(() => {
  app.listen(PORT, HOST, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log('If connecting from another device, use your computer\'s LAN IP, e.g. http://192.168.x.x:3000');
  });
}).catch(err => {
  console.error('Failed to connect to database:', err);
  process.exit(1);
});
