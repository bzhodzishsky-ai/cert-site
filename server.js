import express from 'express';
import multer from 'multer';
import { nanoid } from 'nanoid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const STORAGE_DIR = path.join(__dirname, 'storage');
if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR);

// Храним метаданные в простом JSON-файле
const DB_FILE = path.join(STORAGE_DIR, 'db.json');
function loadDB() {
  if (!fs.existsSync(DB_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { return {}; }
}
function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, STORAGE_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `tpl-${nanoid(10)}${ext}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Только JPG или PNG'));
  }
});

// 1. Отдаем статику из папки public
app.use(express.static(path.join(__dirname, 'public')));
app.use('/storage', express.static(STORAGE_DIR));

// 2. Главная страница (/) теперь открывает organizer.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'organizer.html'));
});

// 3. Загрузка шаблона
app.post('/api/upload', upload.single('template'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не получен' });
  
  // Получаем координаты от организатора
  const x = parseFloat(req.body.x) || 567;
  const y = parseFloat(req.body.y) || 570;
  const maxWidth = parseFloat(req.body.maxWidth) || 470;

  const id = nanoid(8);
  const db = loadDB();
  db[id] = {
    templateFile: req.file.filename,
    createdAt: new Date().toISOString(),
    nameBox: { x: x, y: y, maxWidth: maxWidth, color: '#1a1a1a' }
  };
  saveDB(db);
  res.json({ id, url: `/c/${id}` });
});

// 4. Получить данные шаблона
app.get('/api/cert/:id', (req, res) => {
  const db = loadDB();
  const item = db[req.params.id];
  if (!item) return res.status(404).json({ error: 'Не найдено' });
  res.json({
    id: req.params.id,
    templateUrl: `/storage/${item.templateFile}`,
    nameBox: item.nameBox
  });
});

// 5. Страница участника
app.get('/c/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'participant.html'));
});

app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
