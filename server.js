require('dotenv').config();
const express  = require('express');
const path     = require('path');
const session  = require('express-session');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');

const app  = express();
const PORT = process.env.PORT || 3000;
const ALLOWED_DOMAIN = 'turing-motors.com';

// ── デバイス設定 ─────────────────────────────────────────
const CAMERA_CONFIG = [
  { serial: process.env.DEVICE_ID_1 || '', label: process.env.DEVICE_LABEL_1 || 'カメラ1' },
  { serial: process.env.DEVICE_ID_2 || '', label: process.env.DEVICE_LABEL_2 || 'カメラ2' },
].filter(c => c.serial);

let CAMERAS = CAMERA_CONFIG.map(c => ({ ...c, id: c.serial }));

async function resolveDeviceIds() {
  const apiKey = process.env.SAFIE_API_KEY;
  if (!apiKey) return;
  try {
    const res  = await fetch('https://openapi.safie.link/v2/devices', {
      headers: { 'Safie-API-Key': apiKey }
    });
    if (!res.ok) return;
    const data = await res.json();
    const map  = {};
    for (const d of data.list || []) map[d.serial] = d.device_id;
    CAMERAS = CAMERA_CONFIG.map(c => ({ ...c, id: map[c.serial] || c.serial }));
    console.log('📷 デバイスID解決完了:');
    CAMERAS.forEach(c => console.log(`   ${c.label}: ${c.serial} → ${c.id}`));
  } catch (e) {
    console.warn('デバイスID解決エラー:', e.message);
  }
}

// ── セッション ────────────────────────────────────────────
app.use(session({
  secret:            process.env.SESSION_SECRET || 'change-this-secret',
  resave:            false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24時間
}));

// ── Google OAuth ──────────────────────────────────────────
passport.use(new GoogleStrategy(
  {
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  process.env.GOOGLE_CALLBACK_URL,
  },
  (accessToken, refreshToken, profile, done) => {
    const email = profile.emails?.[0]?.value || '';
    if (email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      return done(null, { id: profile.id, name: profile.displayName, email });
    }
    return done(null, false); // ドメイン不一致 → 弾く
  }
));

passport.serializeUser((user, done)   => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

app.use(passport.initialize());
app.use(passport.session());

// ── 認証ミドルウェア ───────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
}

// ── 認証ルート ─────────────────────────────────────────────
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login?error=1' }),
  (req, res) => res.redirect('/')
);

app.get('/logout', (req, res) => {
  req.logout(() => res.redirect('/login'));
});

// ── 静的ファイル（login.html はここで配信するため auth 不要） ──
app.use(express.static(path.join(__dirname, 'public')));

// ── 保護されたルート ───────────────────────────────────────
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'viewer.html'));
});

app.get('/api/config', requireAuth, (req, res) => {
  const apiKey = process.env.SAFIE_API_KEY;
  if (!apiKey)            return res.status(500).json({ error: 'APIキーが未設定です' });
  if (!CAMERAS.length)    return res.status(500).json({ error: 'カメラIDが未設定です' });
  res.json({ apiKey, cameras: CAMERAS });
});

app.get('/api/snapshot/:deviceId', requireAuth, async (req, res) => {
  const apiKey = process.env.SAFIE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'APIキー未設定' });

  const cam = CAMERAS.find(c => c.id === req.params.deviceId || c.serial === req.params.deviceId);
  if (!cam) return res.status(400).json({ error: '不正なデバイスID' });

  try {
    const safieRes = await fetch(
      `https://openapi.safie.link/v2/devices/${cam.id}/image`,
      { headers: { 'Safie-API-Key': apiKey } }
    );
    if (!safieRes.ok) {
      const body = await safieRes.json().catch(() => ({}));
      return res.status(safieRes.status).json({ error: `Safie API ${safieRes.status}`, detail: body });
    }
    const buf = Buffer.from(await safieRes.arrayBuffer());
    res.set('Content-Type', safieRes.headers.get('content-type') || 'image/jpeg');
    res.set('Cache-Control', 'no-store');
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ── 起動 ───────────────────────────────────────────────────
resolveDeviceIds().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🅿️  駐車場カメラ ライブビューア 起動中`);
    console.log(`   → http://localhost:${PORT}\n`);
  });
});
