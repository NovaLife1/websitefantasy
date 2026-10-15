require('dotenv').config();
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const Database = require('better-sqlite3');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const crypto = require('crypto');

const required = ['ADMIN_USERNAME', 'ADMIN_PASSWORD', 'SESSION_SECRET'];
for (const key of required) if (!process.env[key]) { console.error(`Missing ${key} in .env`); process.exit(1); }
if (process.env.SESSION_SECRET.length < 32) { console.error('SESSION_SECRET muss mindestens 32 Zeichen lang sein.'); process.exit(1); }
const app = express();
const dbDir = path.join(__dirname, 'data');
require('fs').mkdirSync(dbDir, { recursive: true });
const isProd = process.env.NODE_ENV === 'production';
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '20kb' }));
app.use(session({
  name: 'fc_admin_session',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: new SQLiteStore({ db: 'sessions.sqlite', dir: path.join(__dirname, 'data') }),
  cookie: { httpOnly: true, sameSite: 'strict', secure: isProd, maxAge: 8 * 60 * 60 * 1000 }
}));
const db = new Database(path.join(dbDir, 'fantasy-craft.sqlite'));
db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS players (
 mc TEXT PRIMARY KEY COLLATE NOCASE,
 name TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('Teilnehmer','Creator','Projektleitung')),
 twitch TEXT NOT NULL DEFAULT '', youtube TEXT NOT NULL DEFAULT '', skin TEXT NOT NULL DEFAULT ''
)`);
const count = db.prepare('SELECT COUNT(*) AS n FROM players').get().n;
if (!count) {
 const starter = [
 ['edwiinTTV','edwiinTTV','Projektleitung','https://twitch.tv/','',''],
 ['Murphy2022','Murphy2022','Projektleitung','https://twitch.tv/','https://youtube.com/',''],
 ['ravy_fps','ravy_fps','Projektleitung','https://twitch.tv/','https://youtube.com/',''],
 ['TheFlash_x14','TheFlash_x14','Projektleitung','https://twitch.tv/','https://youtube.com/',''],
 ['BlueKnight','BlueKnight','Creator','','https://youtube.com/',''],
 ['EnderLuna','EnderLuna','Creator','https://twitch.tv/','',''],
 ['PixelNova','PixelNova','Teilnehmer','','',''],
 ['CraftFox','CraftFox','Teilnehmer','','','']
 ];
 const insert = db.prepare('INSERT INTO players (mc,name,role,twitch,youtube,skin) VALUES (?,?,?,?,?,?)');
 const tx = db.transaction(rows => rows.forEach(row => insert.run(...row)));
 tx(starter);
}
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Zu viele Anmeldeversuche. Bitte warte 15 Minuten.' } });
const adminOnly = (req,res,next) => req.session && req.session.admin === true ? next() : res.status(401).json({ error: 'Bitte zuerst als Admin anmelden.' });
const safeEqual = (a,b) => { const aa=Buffer.from(String(a)); const bb=Buffer.from(String(b)); return aa.length===bb.length && crypto.timingSafeEqual(aa,bb); };
const validUrl = v => { if (!v) return ''; try { const u=new URL(v); return ['http:','https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
app.get('/api/players', (req,res) => res.json({ players: db.prepare('SELECT mc,name,role,twitch,youtube,skin FROM players ORDER BY name COLLATE NOCASE').all() }));
app.get('/api/me', (req,res) => res.json({ admin: !!(req.session && req.session.admin) }));
app.post('/api/login', loginLimiter, (req,res,next) => {
 const { username, password } = req.body || {};
 if (!safeEqual(username || '', process.env.ADMIN_USERNAME) || !safeEqual(password || '', process.env.ADMIN_PASSWORD)) return res.status(401).json({ error: 'Benutzername oder Passwort ist falsch.' });
 req.session.regenerate(err => { if (err) return next(err); req.session.admin = true; req.session.save(err2 => err2 ? next(err2) : res.json({ ok: true })); });
});
app.post('/api/logout', (req,res,next) => { req.session.destroy(err => { if(err) return next(err); res.clearCookie('fc_admin_session'); res.json({ok:true}); }); });
app.post('/api/players', adminOnly, (req,res) => {
 const b=req.body||{}; const mc=String(b.mc||'').trim(), name=String(b.name||'').trim(), role=String(b.role||'Teilnehmer');
 if (!/^[A-Za-z0-9_]{1,32}$/.test(mc) || !name || name.length>40 || !['Teilnehmer','Creator','Projektleitung'].includes(role)) return res.status(400).json({error:'Bitte prüfe Minecraft-Name, Anzeigename und Rolle.'});
 try { db.prepare(`INSERT INTO players (mc,name,role,twitch,youtube,skin) VALUES (@mc,@name,@role,@twitch,@youtube,@skin)
 ON CONFLICT(mc) DO UPDATE SET name=excluded.name,role=excluded.role,twitch=excluded.twitch,youtube=excluded.youtube,skin=excluded.skin`).run({mc,name,role,twitch:validUrl(b.twitch),youtube:validUrl(b.youtube),skin:validUrl(b.skin)}); res.json({ok:true}); }
 catch(e) { console.error(e); res.status(500).json({error:'Teilnehmer konnte nicht gespeichert werden.'}); }
});
app.delete('/api/players/:mc', adminOnly, (req,res) => { const result=db.prepare('DELETE FROM players WHERE mc = ? COLLATE NOCASE').run(req.params.mc); if(!result.changes) return res.status(404).json({error:'Teilnehmer nicht gefunden.'}); res.json({ok:true}); });
app.use(express.static(path.join(__dirname,'public'), { extensions:['html'] }));
app.use((err,req,res,next) => { console.error(err); res.status(500).json({error:'Interner Serverfehler.'}); });
const port=Number(process.env.PORT||3000);
app.listen(port, () => console.log(`Fantasy Craft läuft auf Port ${port}`));
