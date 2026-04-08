// server.js — Fully Updated & Production-Ready
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcrypt';
import ms from 'ms';
import compression from 'compression';
import helmet from 'helmet';
import dotenv from 'dotenv';
import pool from './db.js';
import { issueTokens, requireAuth, refreshTokens, logout, optionalAuth } from './auth.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

const app = express();
const ORDER_STATUS = ['created', 'paid', 'processing', 'shipped', 'cancelled', 'cancelled_by_user'];

/* --------------------------- Middleware --------------------------- */
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(helmet({ contentSecurityPolicy: false }));

/* ----------------------------- Static ----------------------------- */
const PUBLIC = path.join(__dirname, 'public');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

app.use('/static', express.static(PUBLIC));
app.use('/uploads', express.static(UPLOAD_DIR));

/* ================= Multer File Upload Setup ================= */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, name + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

/* ---------------------- Helper: Avatar URL ------------------------ */
function getAvatarUrl(user) {
  if (!user) return '/static/img/avatar.png';
  const initials = (user.fullname || user.email || 'U')
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=1877f2&color=fff&size=128`;
}

/* ---------------------- Helper: Safe JSON ------------------------- */
function safeJson(str) {
  try {
    return typeof str === 'string' ? JSON.parse(str) : str;
  } catch {
    return [];
  }
}

/* ---------------------- Guest Cart Helpers ------------------------ */
const GUEST_COOKIE = 'guest_cart';
const cookieOpts = () => ({
  httpOnly: true,
  sameSite: 'Strict',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 30 * 24 * 3600 * 1000,
});

function readGuestCart(req) {
  try {
    const raw = req.cookies?.[GUEST_COOKIE];
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr)
      ? arr.filter(x => x && Number.isInteger(+x.product_id) && Number.isInteger(+x.qty) && +x.qty > 0)
          .map(x => ({ product_id: Number(x.product_id), qty: Number(x.qty) }))
      : [];
  } catch {
    return [];
  }
}
function writeGuestCart(res, items) {
  res.cookie(GUEST_COOKIE, JSON.stringify(items || []), cookieOpts());
}
function clearGuestCart(res) {
  res.cookie(GUEST_COOKIE, '[]', { ...cookieOpts(), maxAge: 0 });
}

/* ------------------------- Auth: signup/login --------------------- */
app.post('/signup', async (req, res) => {
  const { email, password, fullname } = req.body || {};
  if (!email || !password || !fullname)
    return res.status(400).json({ error: 'email, password, fullname required' });
  if (String(password).length < 8) return res.status(400).json({ error: 'Password too short' });
  try {
    const dupe = await pool.query('SELECT 1 FROM users WHERE email=$1', [email.trim()]);
    if (dupe.rowCount) return res.status(400).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(String(password), 12);
    const u = await pool.query(
      `INSERT INTO users (email, password_hash, fullname) VALUES ($1,$2,$3) RETURNING id,email,fullname`,
      [email.trim(), hash, String(fullname).trim()]
    );
    const user = { id: u.rows[0].id, email: u.rows[0].email };
    const out = await issueTokens(res, user, req);
    await mergeGuestCartToUser(req, res, user.id);
    if (!res.headersSent)
      res.json({
        user: { id: user.id, email: user.email, fullname: u.rows[0].fullname, avatar_url: getAvatarUrl(u.rows[0]) },
        ...(out || {}),
      });
  } catch (e) {
    res.status(500).json({ error: 'Signup failed', detail: e.message });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  try {
    const r = await pool.query('SELECT id,email,password_hash,fullname FROM users WHERE email=$1', [email.trim()]);
    if (!r.rowCount) return res.status(401).json({ error: 'Invalid credentials' });
    const user = r.rows[0];
    const ok = await bcrypt.compare(String(password), user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const out = await issueTokens(res, { id: user.id, email: user.email }, req);
    await mergeGuestCartToUser(req, res, user.id);
    if (!res.headersSent)
      res.json({
        user: { id: user.id, email: user.email, fullname: user.fullname, avatar_url: getAvatarUrl(user) },
        ...(out || {}),
      });
  } catch {
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/refresh', async (req, res) => {
  try {
    const out = await refreshTokens(req, res);
    if (!res.headersSent && out) res.json(out);
  } catch {
    if (!res.headersSent) res.status(401).json({ error: 'Refresh failed' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  clearGuestCart(res);
  return logout(req, res);
});

/* ------------------------------ Me ------------------------------- */
app.get('/api/me', requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT id,email,fullname,is_admin,created_at,avatar_url,bio,website FROM users WHERE id=$1',
      [req.user.sub]
    );
    if (!r.rowCount) return res.status(404).json({ error: 'Not found' });
    const user = r.rows[0];
    res.json({ ...user, avatar_url: getAvatarUrl(user) });
  } catch (e) {
    if (e.code === '42703') {
      const r2 = await pool.query('SELECT id,email,fullname,created_at FROM users WHERE id=$1', [req.user.sub]);
      if (!r2.rowCount) return res.status(404).json({ error: 'Not found' });
      return res.json({ ...r2.rows[0], is_admin: false, avatar_url: getAvatarUrl(r2.rows[0]) });
    }
    res.status(500).json({ error: 'Me failed' });
  }
});

app.put('/api/me', requireAuth, async (req, res) => {
  const { fullname } = req.body || {};
  if (!fullname) return res.status(400).json({ error: 'fullname required' });
  try {
    const r = await pool.query(
      `UPDATE users SET fullname=$1, updated_at=now() WHERE id=$2 RETURNING id,email,fullname,is_admin,created_at`,
      [String(fullname).trim(), req.user.sub]
    );
    res.json({ ...r.rows[0], avatar_url: getAvatarUrl(r.rows[0]) });
  } catch (e) {
    if (e.code === '42703') {
      const r2 = await pool.query(
        `UPDATE users SET fullname=$1 WHERE id=$2 RETURNING id,email,fullname,created_at`,
        [String(fullname).trim(), req.user.sub]
      );
      return res.json({ ...r2.rows[0], is_admin: false, avatar_url: getAvatarUrl(r2.rows[0]) });
    }
    res.status(500).json({ error: 'Update failed' });
  }
});

/* ----------------------- Token cleanup job ------------------------ */
setInterval(async () => {
  try {
    const refreshMs = ms(process.env.JWT_REFRESH_EXPIRES_IN || '7d');
    const refreshSec = Math.floor(refreshMs / 1000);
    await pool.query(
      `UPDATE refresh_tokens SET revoked_at = now() WHERE revoked_at IS NULL AND created_at < now() - ($1 || ' seconds')::interval`,
      [refreshSec]
    );
  } catch {}
}, 5 * 60 * 1000);

/* ------------------------------ Products -------------------------- */
app.get('/api/products', async (_req, res) => {
  try {
    const r = await pool.query('SELECT id,name,description,price_cents,image_url,stock FROM products ORDER BY id');
    res.json(r.rows);
  } catch (e) {
    if (e.code === '42703') {
      const r2 = await pool.query('SELECT id,name,description,price_cents,image_url FROM products ORDER BY id');
      return res.json(r2.rows.map(p => ({ ...p, stock: null })));
    }
    res.status(500).json({ error: 'Products failed' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const r = await pool.query('SELECT id,name,description,price_cents,image_url,stock FROM products WHERE id=$1', [
      req.params.id,
    ]);
    if (!r.rowCount) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) {
    if (e.code === '42703') {
      const r2 = await pool.query('SELECT id,name,description,price_cents,image_url FROM products WHERE id=$1', [
        req.params.id,
      ]);
      if (!r2.rowCount) return res.status(404).json({ error: 'Not found' });
      return res.json({ ...r2.rows[0], stock: null });
    }
    res.status(500).json({ error: 'Product failed' });
  }
});

/* ------------------------------ Articles -------------------------- */
app.post('/api/articles', requireAuth, upload.single('image'), async (req, res) => {
  const { title, content } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : null;
  const r = await pool.query(
    `INSERT INTO articles (user_id, title, content, image_url) VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.user.sub, title, content, image_url]
  );
  const article = r.rows[0];
  const user = await pool.query('SELECT fullname FROM users WHERE id=$1', [article.user_id]);
  res.json({ ...article, fullname: user.rows[0]?.fullname || '', avatar_url: getAvatarUrl(user.rows[0]), stars: 0 });
});

app.get('/api/articles', async (req, res) => {
  const r = await pool.query(`
    SELECT a.*, u.fullname,
      (SELECT COUNT(*) FROM article_stars s WHERE s.article_id = a.id) AS stars
    FROM articles a
    JOIN users u ON u.id = a.user_id
    ORDER BY a.created_at DESC
  `);
  const articles = r.rows.map(a => ({ ...a, avatar_url: getAvatarUrl({ fullname: a.fullname }) }));
  res.json(articles);
});

app.get('/api/articles/:id', async (req, res) => {
  const articleId = parseInt(req.params.id, 10);
  if (isNaN(articleId)) return res.status(400).json({ error: 'Invalid article ID' });
  try {
    const result = await pool.query(`
      SELECT a.*, u.fullname, u.avatar_url,
        CAST((SELECT COUNT(*) FROM article_stars WHERE article_id = a.id) AS INTEGER) as stars
      FROM articles a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.id = $1
    `, [articleId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Article not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching single article:', err);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

app.post('/api/articles/:id/star', requireAuth, async (req, res) => {
  const userId = req.user.sub;
  const articleId = req.params.id;
  try {
    let isStarred = false;
    const deleteRes = await pool.query(
      'DELETE FROM article_stars WHERE user_id = $1 AND article_id = $2 RETURNING *',
      [userId, articleId]
    );
    if (deleteRes.rowCount > 0) {
      isStarred = false;
    } else {
      await pool.query(
        'INSERT INTO article_stars (user_id, article_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, articleId]
      );
      isStarred = true;
    }
    const countRes = await pool.query('SELECT COUNT(*) FROM article_stars WHERE article_id = $1', [articleId]);
    const totalStars = parseInt(countRes.rows[0].count);
    res.json({ starred: isStarred, stars: totalStars });
  } catch (err) {
    console.error("Star toggle error:", err);
    res.status(500).json({ error: 'Failed to toggle star' });
  }
});

// ✅ SINGLE DELETE ROUTE (removed duplicate)
app.delete('/api/articles/:id', requireAuth, async (req, res) => {
  const articleId = Number(req.params.id);
  const userId = req.user.sub;
  const r = await pool.query('SELECT user_id FROM articles WHERE id=$1', [articleId]);
  if (!r.rowCount) return res.status(404).json({ error: 'Article not found' });
  if (r.rows[0].user_id != userId) return res.status(403).json({ error: 'Forbidden' });
  await pool.query('DELETE FROM article_stars WHERE article_id=$1', [articleId]);
  await pool.query('DELETE FROM articles WHERE id=$1', [articleId]);
  res.json({ ok: true });
});

/* ------------------------------ Posts ----------------------------- */
app.post('/api/posts', requireAuth, upload.array('images', 5), async (req, res) => {
  const { content } = req.body;
  const post = await pool.query(
    `INSERT INTO posts (user_id, content) VALUES ($1,$2) RETURNING *`,
    [req.user.sub, content]
  );
  const postId = post.rows[0].id;
  for (const file of req.files || []) {
    await pool.query(`INSERT INTO post_images (post_id, image_url) VALUES ($1,$2)`, [
      postId,
      `/uploads/${file.filename}`,
    ]);
  }
  const full = await pool.query(`
    SELECT p.*, u.fullname,
      COALESCE(json_agg(DISTINCT pi.image_url) FILTER (WHERE pi.id IS NOT NULL), '[]') AS images,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes_count
    FROM posts p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN post_images pi ON pi.post_id = p.id
    WHERE p.id = $1
    GROUP BY p.id, u.fullname
  `, [postId]);
  const p = full.rows[0];
  res.json({ ...p, avatar_url: getAvatarUrl({ fullname: p.fullname }) });
});

app.get('/api/posts/feed', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const offset = parseInt(req.query.offset) || 0;
    const posts = await pool.query(`
      SELECT p.*, u.fullname,
        COALESCE(json_agg(DISTINCT pi.image_url) FILTER (WHERE pi.id IS NOT NULL), '[]') AS images,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes_count,
        COALESCE(json_object_agg(pr.reaction, pr.cnt) FILTER (WHERE pr.reaction IS NOT NULL), '{}') AS reactions
      FROM posts p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN post_images pi ON pi.post_id = p.id
      LEFT JOIN (
        SELECT post_id, reaction, COUNT(*) AS cnt
        FROM post_reactions
        GROUP BY post_id, reaction
      ) pr ON pr.post_id = p.id
      GROUP BY p.id, u.fullname
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    const total = await pool.query('SELECT COUNT(*) FROM posts');
    res.json({
      posts: posts.rows,
      hasMore: offset + posts.rows.length < parseInt(total.rows[0].count)
    });
  } catch (err) {
    console.error('Error fetching feed:', err);
    res.status(500).json({ error: 'Failed to load feed' });
  }
});

app.get('/api/posts', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT p.*, u.fullname,
        COALESCE(json_agg(DISTINCT pi.image_url) FILTER (WHERE pi.id IS NOT NULL), '[]') AS images,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes_count,
        COALESCE(json_object_agg(pr.reaction, pr.cnt) FILTER (WHERE pr.reaction IS NOT NULL), '{}') AS reactions
      FROM posts p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN post_images pi ON pi.post_id = p.id
      LEFT JOIN (
        SELECT post_id, reaction, COUNT(*) AS cnt
        FROM post_reactions
        GROUP BY post_id, reaction
      ) pr ON pr.post_id = p.id
      GROUP BY p.id, u.fullname
      ORDER BY p.created_at DESC
      LIMIT 50
    `);
    const enriched = r.rows.map(p => ({ ...p, avatar_url: getAvatarUrl({ fullname: p.fullname }) }));
    res.json(enriched);
  } catch (err) {
    console.error('Error fetching posts:', err);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

app.post('/api/posts/:id/react', requireAuth, async (req, res) => {
  const { reaction } = req.body;
  const userId = req.user.sub;
  const postId = req.params.id;
  const existing = await pool.query('SELECT reaction FROM post_reactions WHERE post_id=$1 AND user_id=$2', [
    postId, userId,
  ]);
  if (existing.rowCount && existing.rows[0].reaction === reaction) {
    await pool.query('DELETE FROM post_reactions WHERE post_id=$1 AND user_id=$2', [postId, userId]);
  } else {
    await pool.query('DELETE FROM post_reactions WHERE post_id=$1 AND user_id=$2', [postId, userId]);
    await pool.query('INSERT INTO post_reactions(post_id,user_id,reaction) VALUES($1,$2,$3)', [
      postId, userId, reaction,
    ]);
  }
  const counts = await pool.query(
    'SELECT reaction, COUNT(*) FROM post_reactions WHERE post_id=$1 GROUP BY reaction',
    [postId]
  );
  const countMap = {};
  counts.rows.forEach(r => (countMap[r.reaction] = Number(r.count)));
  res.json({ ok: true, reactions: countMap });
});

app.post('/api/posts/:id/like', requireAuth, async (req, res) => {
  const userId = req.user.sub;
  const postId = req.params.id;
  try {
    const exists = await pool.query('SELECT id FROM likes WHERE user_id=$1 AND post_id=$2', [userId, postId]);
    if (exists.rowCount) {
      await pool.query('DELETE FROM likes WHERE user_id=$1 AND post_id=$2', [userId, postId]);
      return res.json({ liked: false });
    }
    await pool.query('INSERT INTO likes (user_id, post_id) VALUES ($1, $2)', [userId, postId]);
    res.json({ liked: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to like' });
  }
});

app.delete('/api/posts/:id', requireAuth, async (req, res) => {
  const postId = Number(req.params.id);
  const userId = req.user.sub;
  const r = await pool.query('SELECT user_id FROM posts WHERE id=$1', [postId]);
  if (!r.rowCount) return res.status(404).json({ error: 'Post not found' });
  if (r.rows[0].user_id != userId) return res.status(403).json({ error: 'Forbidden' });
  await pool.query('DELETE FROM post_reactions WHERE post_id=$1', [postId]);
  await pool.query('DELETE FROM posts WHERE id=$1', [postId]);
  res.json({ ok: true });
});

/* ---------------------------- Comments ---------------------------- */
app.post('/api/comments', requireAuth, async (req, res) => {
  const { content, post_id } = req.body;
  if (!content || !post_id) return res.status(400).json({ error: 'content and post_id required' });
  const r = await pool.query(
    `INSERT INTO comments (user_id, content, post_id) VALUES ($1,$2,$3) RETURNING *`,
    [req.user.sub, content, post_id]
  );
  const comment = r.rows[0];
  const user = await pool.query('SELECT fullname FROM users WHERE id=$1', [comment.user_id]);
  res.json({ ...comment, fullname: user.rows[0]?.fullname || '', avatar_url: getAvatarUrl(user.rows[0]), reactions: {} });
});

app.get('/api/posts/:id/comments', async (req, res) => {
  const postId = req.params.id;
  try {
    const r = await pool.query(`
      SELECT c.*, u.fullname
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.post_id = $1
      ORDER BY c.created_at ASC
    `, [postId]);
    const comments = r.rows.map(c => ({
      ...c, replies: [], fullname: c.fullname || '', avatar_url: getAvatarUrl({ fullname: c.fullname }),
    }));
    const commentMap = {};
    const roots = [];
    comments.forEach(c => { commentMap[c.id] = c; });
    comments.forEach(c => {
      if (c.parent_comment_id && commentMap[c.parent_comment_id]) {
        commentMap[c.parent_comment_id].replies.push(c);
      } else {
        roots.push(c);
      }
    });
    for (const c of comments) {
      const reactions = await pool.query(
        `SELECT reaction, COUNT(*) as count FROM comment_reactions WHERE comment_id = $1 GROUP BY reaction`,
        [c.id]
      );
      c.reactions = {};
      reactions.rows.forEach(r => (c.reactions[r.reaction] = Number(r.count)));
    }
    res.json(roots);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load comments' });
  }
});

app.post('/api/comments/:id/react', requireAuth, async (req, res) => {
  const { reaction } = req.body;
  const userId = req.user.sub;
  const commentId = req.params.id;
  const existing = await pool.query('SELECT reaction FROM comment_reactions WHERE comment_id=$1 AND user_id=$2', [
    commentId, userId,
  ]);
  if (existing.rowCount && existing.rows[0].reaction === reaction) {
    await pool.query('DELETE FROM comment_reactions WHERE comment_id=$1 AND user_id=$2', [commentId, userId]);
  } else {
    await pool.query('DELETE FROM comment_reactions WHERE comment_id=$1 AND user_id=$2', [commentId, userId]);
    await pool.query('INSERT INTO comment_reactions(comment_id,user_id,reaction) VALUES($1,$2,$3)', [
      commentId, userId, reaction,
    ]);
  }
  const counts = await pool.query(
    'SELECT reaction, COUNT(*) FROM comment_reactions WHERE comment_id=$1 GROUP BY reaction',
    [commentId]
  );
  const countMap = {};
  counts.rows.forEach(r => (countMap[r.reaction] = Number(r.count)));
  res.json({ ok: true, count: countMap[reaction] || 0 });
});

app.post('/api/comments/:id/reply', requireAuth, async (req, res) => {
  const { content } = req.body;
  const parent_comment_id = req.params.id;
  if (!content) return res.status(400).json({ error: 'content required' });
  const parent = await pool.query('SELECT post_id FROM comments WHERE id=$1', [parent_comment_id]);
  if (!parent.rowCount) return res.status(404).json({ error: 'Parent comment not found' });
  const post_id = parent.rows[0].post_id;
  const r = await pool.query(
    `INSERT INTO comments (user_id, content, post_id, parent_comment_id) VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.user.sub, content, post_id, parent_comment_id]
  );
  const comment = r.rows[0];
  const user = await pool.query('SELECT fullname FROM users WHERE id=$1', [comment.user_id]);
  res.json({ ...comment, fullname: user.rows[0]?.fullname || '', avatar_url: getAvatarUrl(user.rows[0]), reactions: {} });
});

app.delete('/api/comments/:id', requireAuth, async (req, res) => {
  const commentId = Number(req.params.id);
  const userId = req.user.sub;
  const r = await pool.query('SELECT user_id FROM comments WHERE id=$1', [commentId]);
  if (!r.rowCount) return res.status(404).json({ error: 'Comment not found' });
  if (r.rows[0].user_id != userId) return res.status(403).json({ error: 'Forbidden' });
  await pool.query('DELETE FROM comments WHERE id=$1', [commentId]);
  res.json({ ok: true });
});

/* ------------------------ User Profile Routes --------------------- */
app.get('/api/users/:id', async (req, res) => {
  try {
    const uid = Number(req.params.id);
    const userR = await pool.query(
      `SELECT id, email, fullname, created_at, avatar_url, bio, website FROM users WHERE id = $1`,
      [uid]
    );
    if (!userR.rowCount) return res.status(404).json({ error: 'User not found' });
    const user = userR.rows[0];
    const [postsR, articlesR, followersR, followingR] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM posts WHERE user_id = $1', [uid]),
      pool.query('SELECT COUNT(*) FROM articles WHERE user_id = $1', [uid]),
      pool.query('SELECT COUNT(*) FROM follows WHERE following_id = $1', [uid]),
      pool.query('SELECT COUNT(*) FROM follows WHERE follower_id = $1', [uid]),
    ]);
    res.json({
      ...user, avatar_url: getAvatarUrl(user),
      posts_count: parseInt(postsR.rows[0].count),
      articles_count: parseInt(articlesR.rows[0].count),
      followers_count: parseInt(followersR.rows[0].count),
      following_count: parseInt(followingR.rows[0].count),
    });
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

app.get('/api/users/:id/posts', async (req, res) => {
  try {
    const uid = Number(req.params.id);
    const posts = await pool.query(`
      SELECT p.*, u.fullname,
        COALESCE(json_agg(DISTINCT pi.image_url) FILTER (WHERE pi.id IS NOT NULL), '[]') AS images,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes_count,
        COALESCE(json_object_agg(pr.reaction, pr.cnt) FILTER (WHERE pr.reaction IS NOT NULL), '{}') AS reactions
      FROM posts p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN post_images pi ON pi.post_id = p.id
      LEFT JOIN (
        SELECT post_id, reaction, COUNT(*) AS cnt
        FROM post_reactions
        GROUP BY post_id, reaction
      ) pr ON pr.post_id = p.id
      WHERE p.user_id = $1
      GROUP BY p.id, u.fullname
      ORDER BY p.created_at DESC
      LIMIT 50
    `, [uid]);
    const enriched = posts.rows.map(p => ({ ...p, avatar_url: getAvatarUrl({ fullname: p.fullname }) }));
    res.json(enriched);
  } catch (err) {
    console.error('Error fetching user posts:', err);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

app.get('/api/users/:id/articles', async (req, res) => {
  try {
    const uid = Number(req.params.id);
    const articles = await pool.query(`
      SELECT a.*, u.fullname,
        (SELECT COUNT(*) FROM article_stars s WHERE s.article_id = a.id) AS stars
      FROM articles a
      JOIN users u ON u.id = a.user_id
      WHERE a.user_id = $1
      ORDER BY a.created_at DESC
      LIMIT 50
    `, [uid]);
    const enriched = articles.rows.map(a => ({ ...a, avatar_url: getAvatarUrl({ fullname: a.fullname }) }));
    res.json(enriched);
  } catch (err) {
    console.error('Error fetching user articles:', err);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

app.post('/api/users/:id/follow', requireAuth, async (req, res) => {
  try {
    const followerId = Number(req.user.sub);
    const followingId = Number(req.params.id);
    if (followerId === followingId) return res.status(400).json({ error: 'Cannot follow yourself' });
    const existing = await pool.query(
      'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2',
      [followerId, followingId]
    );
    let following;
    if (existing.rowCount) {
      await pool.query('DELETE FROM follows WHERE follower_id = $1 AND following_id = $2', [followerId, followingId]);
      following = false;
    } else {
      await pool.query('INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)', [followerId, followingId]);
      following = true;
    }
    res.json({ ok: true, following });
  } catch (err) {
    console.error('Error following user:', err);
    res.status(500).json({ error: 'Failed to update follow status' });
  }
});

app.get('/api/users/:id/follow-status', requireAuth, async (req, res) => {
  try {
    const followerId = Number(req.user.sub);
    const followingId = Number(req.params.id);
    const r = await pool.query(
      'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2',
      [followerId, followingId]
    );
    res.json({ following: !!r.rowCount });
  } catch (err) {
    console.error('Error checking follow status:', err);
    res.status(500).json({ error: 'Failed to check follow status' });
  }
});

/* ------------------------------ Cart ------------------------------ */
async function ensureCart(userId) {
  const r = await pool.query('SELECT id FROM carts WHERE user_id=$1', [userId]);
  if (r.rowCount) return r.rows[0].id;
  const c = await pool.query('INSERT INTO carts (user_id) VALUES ($1) RETURNING id', [userId]);
  return c.rows[0].id;
}

async function getStock(productId) {
  try {
    const r = await pool.query('SELECT stock FROM products WHERE id=$1', [productId]);
    return r.rowCount ? Number(r.rows[0].stock) : null;
  } catch (e) {
    if (e.code === '42703') return Infinity;
    throw e;
  }
}

app.get('/api/cart', requireAuth, async (req, res) => {
  const cartId = await ensureCart(req.user.sub);
  const r = await pool.query(
    `SELECT ci.id, ci.qty, p.id AS product_id, p.name, p.price_cents, p.image_url,
            CASE WHEN to_regclass('public.products') IS NOT NULL THEN p.stock ELSE NULL END AS stock
       FROM cart_items ci JOIN products p ON p.id = ci.product_id
      WHERE ci.cart_id=$1 ORDER BY ci.id`,
    [cartId]
  ).catch(async e => {
    if (e.code === '42703') {
      const r2 = await pool.query(
        `SELECT ci.id, ci.qty, p.id AS product_id, p.name, p.price_cents, p.image_url
           FROM cart_items ci JOIN products p ON p.id = ci.product_id
          WHERE ci.cart_id=$1 ORDER BY ci.id`,
        [cartId]
      );
      return { rows: r2.rows.map(x => ({ ...x, stock: null })) };
    }
    throw e;
  });
  res.json(r.rows);
});

app.post('/api/cart/items', requireAuth, async (req, res) => {
  const productId = Number(req.body?.product_id);
  const addQty = Math.max(1, parseInt(req.body?.qty || 1, 10));
  if (!Number.isInteger(productId)) return res.status(400).json({ error: 'Invalid product' });
  const cartId = await ensureCart(req.user.sub);
  const [stockVal, cur] = await Promise.all([
    getStock(productId),
    pool.query('SELECT qty FROM cart_items WHERE cart_id=$1 AND product_id=$2', [cartId, productId]),
  ]);
  if (stockVal === null) return res.status(404).json({ error: 'Product not found' });
  const unlimited = stockVal === Infinity;
  const already = cur.rowCount ? Number(cur.rows[0].qty) : 0;
  const remain = unlimited ? Infinity : stockVal - already;
  if (!unlimited && remain <= 0) return res.status(400).json({ error: 'Sold out' });
  const toAdd = unlimited ? addQty : Math.min(addQty, remain);
  await pool.query(
    `INSERT INTO cart_items (cart_id, product_id, qty)
     VALUES ($1,$2,$3)
     ON CONFLICT (cart_id, product_id)
     DO UPDATE SET qty = cart_items.qty + EXCLUDED.qty`,
    [cartId, productId, toAdd]
  );
  res.json({ ok: true, added: toAdd, remaining: unlimited ? null : remain - toAdd });
});

app.delete('/api/cart/items/:id', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM cart_items WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

/* ----------------------------- Checkout --------------------------- */
app.post('/api/checkout', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cartId = await ensureCart(req.user.sub);
    const items = await client.query(
      `SELECT p.id AS product_id, p.name, p.price_cents, ci.qty, p.stock
         FROM cart_items ci
         JOIN products p ON p.id = ci.product_id
        WHERE ci.cart_id=$1
        FOR UPDATE OF p`,
      [cartId]
    );
    if (!items.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cart empty' });
    }
    const hasStock = items.rows[0] && Object.prototype.hasOwnProperty.call(items.rows[0], 'stock');
    if (hasStock) {
      for (const row of items.rows) {
        if (row.stock !== null && Number(row.stock) < Number(row.qty)) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Only ${row.stock} left for "${row.name}"` });
        }
      }
      for (const row of items.rows) {
        await client.query(`UPDATE products SET stock = stock - $2 WHERE id=$1 AND stock >= $2`, [
          row.product_id, row.qty,
        ]);
      }
    }
    const orderItems = items.rows.map(r => ({
      product_id: Number(r.product_id), name: String(r.name), qty: Number(r.qty), price_cents: Number(r.price_cents),
    }));
    const total = orderItems.reduce((s, x) => s + x.qty * x.price_cents, 0);
    let orderRow;
    try {
      const o = await client.query(
        `INSERT INTO orders (user_id, items, total_cents, status)
         VALUES ($1,$2::jsonb,$3,'created')
         RETURNING id,total_cents,status,created_at`,
        [req.user.sub, JSON.stringify(orderItems), total]
      );
      orderRow = o.rows[0];
    } catch (e) {
      if (e.code === '42703') {
        const o2 = await client.query(
          `INSERT INTO orders (user_id, total_cents, status) VALUES ($1,$2,'created')
           RETURNING id,total_cents,status,created_at`,
          [req.user.sub, total]
        );
        orderRow = o2.rows[0];
      } else {
        throw e;
      }
    }
    await client.query('DELETE FROM cart_items WHERE cart_id=$1', [cartId]);
    await client.query('COMMIT');
    res.json({
      order_id: orderRow.id, total_cents: orderRow.total_cents, status: orderRow.status,
      created_at: orderRow.created_at, items: orderItems,
    });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: 'Checkout failed', detail: e.message });
  } finally {
    client.release();
  }
});

/* ================= COMPLETE CHECKOUT WITH ADDRESS ================= */
app.post('/api/checkout/complete', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { address, phone, notes, billing_address } = req.body || {};
    const cartId = await ensureCart(req.user.sub);
    const itemsRes = await client.query(
      `SELECT p.id AS product_id, p.name, p.price_cents, ci.qty, p.stock 
       FROM cart_items ci 
       JOIN products p ON p.id = ci.product_id 
       WHERE ci.cart_id = $1`,
      [cartId]
    );
    if (!itemsRes.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cart is empty' });
    }
    for (const row of itemsRes.rows) {
      if (row.stock !== null && Number(row.stock) < Number(row.qty)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Only ${row.stock} left for "${row.name}"` });
      }
    }
    for (const row of itemsRes.rows) {
      if (row.stock !== null) {
        await client.query(`UPDATE products SET stock = stock - $2 WHERE id = $1`, [row.product_id, row.qty]);
      }
    }
    const orderItems = itemsRes.rows.map(r => ({
      product_id: Number(r.product_id), name: String(r.name), qty: Number(r.qty), price_cents: Number(r.price_cents)
    }));
    const total = orderItems.reduce((s, x) => s + x.qty * x.price_cents, 0);
    const orderRes = await client.query(
      `INSERT INTO orders (
        user_id, items, total_cents, status, shipping_address, customer_phone, billing_address
      ) VALUES ($1, $2::jsonb, $3, 'created', $4::jsonb, $5, $6::jsonb) 
      RETURNING id, total_cents, status, created_at`,
      [
        req.user.sub, JSON.stringify(orderItems), total,
        JSON.stringify(address || {}), phone || null,
        JSON.stringify(billing_address || address || {})
      ]
    );
    await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);
    await client.query('COMMIT');
    res.json({ order_id: orderRes.rows[0].id, status: 'success', total_cents: orderRes.rows[0].total_cents });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Checkout complete error:', e);
    res.status(500).json({ error: 'Checkout failed', detail: e.message });
  } finally {
    client.release();
  }
});

/* ------------------------------ Orders ---------------------------- */
app.get('/api/orders', requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, items, total_cents, status, created_at, updated_at
         FROM orders WHERE user_id=$1 ORDER BY created_at DESC`,
      [req.user.sub]
    );
    const rows = r.rows.map(o => ({
      ...o, items: Array.isArray(o.items) ? o.items : typeof o.items === 'string' ? safeJson(o.items) : [],
    }));
    res.json(rows);
  } catch (e) {
    if (e.code === '42703') {
      const r2 = await pool.query(
        `SELECT id, total_cents, status, created_at FROM orders WHERE user_id=$1 ORDER BY created_at DESC`,
        [req.user.sub]
      );
      return res.json(r2.rows.map(o => ({ ...o, items: [] })));
    }
    res.status(500).json({ error: 'Orders failed' });
  }
});

app.post('/api/orders/:id/cancel', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `SELECT id, items, status FROM orders WHERE id=$1 AND user_id=$2 FOR UPDATE`,
      [req.params.id, req.user.sub]
    );
    if (!r.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not found' });
    }
    const ord = r.rows[0];
    const items = Array.isArray(ord.items) ? ord.items : typeof ord.items === 'string' ? safeJson(ord.items) : [];
    if (ord.status === 'created' && items.length) {
      try {
        for (const it of items) {
          await client.query(`UPDATE products SET stock = stock + $2 WHERE id=$1`, [it.product_id, it.qty]);
        }
      } catch (e) {
        if (e.code !== '42703') throw e;
      }
    }
    const u = await client.query(
      `UPDATE orders SET status='cancelled_by_user', updated_at=now()
         WHERE id=$1 AND user_id=$2
       RETURNING id, status`,
      [req.params.id, req.user.sub]
    ).catch(async e => {
      if (e.code === '42703') {
        const u2 = await client.query(
          `UPDATE orders SET status='cancelled_by_user' WHERE id=$1 AND user_id=$2 RETURNING id, status`,
          [req.params.id, req.user.sub]
        );
        return u2;
      }
      throw e;
    });
    await client.query('COMMIT');
    res.json(u.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: 'Cancel failed' });
  } finally {
    client.release();
  }
});

/* ---------------------------- Guest Cart -------------------------- */
app.get('/api/guest-cart', async (req, res) => {
  const items = readGuestCart(req);
  if (!items.length) return res.json([]);
  const ids = items.map(i => i.product_id);
  const r = await pool.query(
    `SELECT id,name,price_cents,image_url,stock FROM products WHERE id = ANY($1::bigint[])`,
    [ids]
  ).catch(async e => {
    if (e.code === '42703') {
      const r2 = await pool.query(
        `SELECT id,name,price_cents,image_url FROM products WHERE id = ANY($1::bigint[])`,
        [ids]
      );
      return { rows: r2.rows.map(p => ({ ...p, stock: null })) };
    }
    throw e;
  });
  const map = new Map(r.rows.map(p => [p.id, p]));
  const detailed = items.filter(i => map.has(i.product_id)).map(i => {
    const p = map.get(i.product_id);
    return {
      id: -i.product_id, qty: i.qty, product_id: p.id, name: p.name,
      price_cents: p.price_cents, image_url: p.image_url, stock: p.stock,
    };
  });
  res.json(detailed);
});

app.post('/api/guest-cart/items', async (req, res) => {
  const productId = Number(req.body?.product_id);
  const addQty = Math.max(1, parseInt(req.body?.qty || 1, 10));
  if (!Number.isInteger(productId)) return res.status(400).json({ error: 'Invalid product' });
  const stock = await getStock(productId);
  if (stock === null) return res.status(404).json({ error: 'Product not found' });
  let items = readGuestCart(req);
  const idx = items.findIndex(x => x.product_id === productId);
  const already = idx === -1 ? 0 : items[idx].qty;
  const remain = stock === Infinity ? Infinity : stock - already;
  if (remain !== Infinity && remain <= 0) return res.status(400).json({ error: 'Sold out' });
  const toAdd = stock === Infinity ? addQty : Math.min(addQty, remain);
  if (idx === -1) items.push({ product_id: productId, qty: toAdd });
  else items[idx].qty += toAdd;
  writeGuestCart(res, items);
  res.json({ ok: true, added: toAdd, remaining: stock === Infinity ? null : remain - toAdd });
});

app.delete('/api/guest-cart/items/:productId', async (req, res) => {
  const pid = Number(req.params.productId);
  writeGuestCart(res, readGuestCart(req).filter(x => x.product_id !== pid));
  res.json({ ok: true });
});

app.post('/api/guest-cart/clear', async (_req, res) => {
  clearGuestCart(res);
  res.json({ ok: true });
});

app.post('/api/cart/merge', requireAuth, async (req, res) => {
  const merged = await mergeGuestCartToUser(req, res, req.user.sub);
  res.json({ merged });
});
// Add this route after your other routes (around line 1050+)
app.get('/order/success', requireAuth, async (req, res) => {
  const orderId = req.query.id;
  
  // Fetch order details
  try {
    const order = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [orderId, req.user.sub]
    );
    
    if (!order.rows.length) {
      return res.status(404).send('Order not found');
    }
    
    // Send a simple success page
    res.send(`
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title data-translate="checkout.success.page_title">Order Success - Zar3ty</title>
    
    <!-- Load translation system -->
    <script src="/static/js/lang.js"></script>
    
    <style>
      body {
        font-family: system-ui, -apple-system, sans-serif;
        background: linear-gradient(180deg, #f7fafc 0, #e0e7ef 100%);
        margin: 0;
        padding: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
      }
      .success-container {
        background: white;
        padding: 40px;
        border-radius: 16px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        text-align: center;
        max-width: 500px;
      }
      .success-icon {
        font-size: 64px;
        margin-bottom: 20px;
      }
      h1 {
        color: #10b981;
        margin: 0 0 10px 0;
      }
      .order-id {
        color: #64748b;
        margin: 20px 0;
        font-size: 1.1rem;
        direction: ltr; /* Keep order ID LTR */
        display: inline-block;
      }
      .btn {
        display: inline-block;
        padding: 12px 24px;
        background: #2563eb;
        color: white;
        text-decoration: none;
        border-radius: 8px;
        font-weight: 600;
        margin: 10px;
        transition: background 0.2s;
      }
      .btn:hover {
        background: #1d4ed8;
      }
      .btn-secondary {
        background: #e2e8f0;
        color: #1e293b;
      }
      .btn-secondary:hover {
        background: #cbd5e1;
      }
    </style>
  </head>
  <body>
    <div class="success-container">
      <div class="success-icon">✅</div>
      <h1 data-translate="checkout.success.title">Order Placed Successfully!</h1>
      <p class="order-id">
        <span data-translate="checkout.success.order_id">Order #</span>${orderId}
      </p>
      <p data-translate="checkout.success.thank_you">Thank you for your order. You can track your order status in your profile.</p>
      <div style="margin-top: 30px;">
        <a href="/profile" class="btn" data-translate="checkout.success.view_orders">View My Orders</a>
        <a href="/" class="btn btn-secondary" data-translate="checkout.success.continue_shopping">Continue Shopping</a>
      </div>
    </div>
  </body>
  </html>
`);
  } catch (err) {
    console.error('Error fetching order:', err);
    res.status(500).send('Error loading order details');
  }
});


async function mergeGuestCartToUser(req, res, userId) {
  const items = readGuestCart(req);
  if (!items.length) return 0;
  const cartId = await ensureCart(userId);
  for (const it of items) {
    const stock = await getStock(it.product_id);
    if (stock === null || stock <= 0) continue;
    const cur = await pool.query('SELECT qty FROM cart_items WHERE cart_id=$1 AND product_id=$2', [
      cartId, it.product_id,
    ]);
    const already = cur.rowCount ? Number(cur.rows[0].qty) : 0;
    const remain = stock === Infinity ? Infinity : stock - already;
    if (remain !== Infinity && remain <= 0) continue;
    const toAdd = stock === Infinity ? it.qty : Math.min(it.qty, remain);
    await pool.query(
      `INSERT INTO cart_items (cart_id, product_id, qty)
       VALUES ($1,$2,$3)
       ON CONFLICT (cart_id, product_id)
       DO UPDATE SET qty = cart_items.qty + EXCLUDED.qty`,
      [cartId, it.product_id, toAdd]
    );
  }
  clearGuestCart(res);
  return items.length;
}

/* ------------------------------ Admin ----------------------------- */
async function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const r = await pool.query('SELECT is_admin FROM users WHERE id=$1', [req.user.sub]);
    if (!r.rowCount || !r.rows[0].is_admin) return res.status(403).json({ error: 'Forbidden' });
    next();
  } catch (e) {
    if (e.code === '42703') return res.status(403).json({ error: 'Admin not enabled' });
    next(e);
  }
}

app.get('/admin', requireAuth, requireAdmin, (_req, res) =>
  res.sendFile(path.join(PUBLIC, 'html', 'admin.html'))
);

app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q) {
    if (/^\d+$/.test(q)) {
      const rId = await pool.query(
        `SELECT id,email,fullname,created_at,is_admin FROM users WHERE id=$1 LIMIT 1`,
        [Number(q)]
      );
      return res.json(rId.rows.map(u => ({ ...u, avatar_url: getAvatarUrl(u) })));
    }
    const like = `%${q}%`;
    const r = await pool.query(
      `SELECT id,email,fullname,created_at,is_admin FROM users
         WHERE email ILIKE $1 OR fullname ILIKE $1
         ORDER BY id DESC LIMIT 100`,
      [like]
    );
    return res.json(r.rows.map(u => ({ ...u, avatar_url: getAvatarUrl(u) })));
  }
  const r = await pool.query(
    `SELECT id,email,fullname,created_at,is_admin FROM users ORDER BY id DESC LIMIT 100`
  );
  res.json(r.rows.map(u => ({ ...u, avatar_url: getAvatarUrl(u) })));
});

app.post('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  const { email, password, fullname, is_admin = false } = req.body || {};
  if (!email || !password || !fullname)
    return res.status(400).json({ error: 'email, password, fullname required' });
  if (String(password).length < 8) return res.status(400).json({ error: 'Password too short' });
  const dupe = await pool.query('SELECT 1 FROM users WHERE email=$1', [email.trim()]);
  if (dupe.rowCount) return res.status(400).json({ error: 'Email already exists' });
  const hash = await bcrypt.hash(String(password), 12);
  try {
    const u = await pool.query(
      `INSERT INTO users (email,password_hash,fullname,is_admin)
       VALUES ($1,$2,$3,$4)
       RETURNING id,email,fullname,is_admin,created_at`,
      [email.trim(), hash, String(fullname).trim(), !!is_admin]
    );
    res.json({ ...u.rows[0], avatar_url: getAvatarUrl(u.rows[0]) });
  } catch (e) {
    if (e.code === '42703') {
      const u2 = await pool.query(
        `INSERT INTO users (email,password_hash,fullname)
         VALUES ($1,$2,$3)
         RETURNING id,email,fullname,created_at`,
        [email.trim(), hash, String(fullname).trim()]
      );
      return res.json({ ...u2.rows[0], is_admin: false, avatar_url: getAvatarUrl(u2.rows[0]) });
    }
    res.status(500).json({ error: 'Create failed' });
  }
});

app.delete('/api/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const uid = Number(req.params.id);
  await pool.query('DELETE FROM users WHERE id=$1', [uid]);
  res.json({ ok: true });
});

app.put('/api/admin/users/:id/admin', requireAuth, requireAdmin, async (req, res) => {
  const uid = Number(req.params.id);
  const flag = !!req.body?.is_admin;
  try {
    await pool.query('UPDATE users SET is_admin=$1 WHERE id=$2', [flag, uid]);
  } catch (e) {
    if (e.code === '42703') return res.status(403).json({ error: 'Admin not enabled' });
    throw e;
  }
  res.json({ ok: true });
});

app.get('/api/admin/users/:id/orders', requireAuth, requireAdmin, async (req, res) => {
  const uid = Number(req.params.id);
  try {
    const r = await pool.query(
      `SELECT id, items, total_cents, status, created_at, updated_at
         FROM orders WHERE user_id=$1 ORDER BY created_at DESC`,
      [uid]
    );
    const rows = r.rows.map(o => ({
      ...o, items: Array.isArray(o.items) ? o.items : typeof o.items === 'string' ? safeJson(o.items) : [],
    }));
    res.json(rows);
  } catch (e) {
    if (e.code === '42703') {
      const r2 = await pool.query(
        `SELECT id, total_cents, status, created_at FROM orders WHERE user_id=$1 ORDER BY created_at DESC`,
        [uid]
      );
      return res.json(r2.rows.map(o => ({ ...o, items: [] })));
    }
    res.status(500).json({ error: 'Orders fetch failed' });
  }
});

app.put('/api/admin/orders/:id/status', requireAuth, requireAdmin, async (req, res) => {
  const oid = Number(req.params.id);
  const next = String(req.body?.status || '').trim();
  if (!ORDER_STATUS.includes(next)) return res.status(400).json({ error: 'Invalid status' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cur = await client.query(`SELECT id, status, items FROM orders WHERE id=$1 FOR UPDATE`, [oid]);
    if (!cur.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not found' });
    }
    const prev = cur.rows[0].status;
    const items = Array.isArray(cur.rows[0].items)
      ? cur.rows[0].items
      : typeof cur.rows[0].items === 'string'
      ? safeJson(cur.rows[0].items)
      : [];
    if (prev === 'created' && next === 'cancelled' && items.length) {
      try {
        for (const it of items) {
          await client.query(`UPDATE products SET stock = stock + $2 WHERE id=$1`, [it.product_id, it.qty]);
        }
      } catch (e) {
        if (e.code !== '42703') throw e;
      }
    }
    const u = await client.query(
      `UPDATE orders SET status=$2, updated_at=now() WHERE id=$1 RETURNING id,status,updated_at`,
      [oid, next]
    );
    await client.query('COMMIT');
    res.json(u.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: 'Status update failed' });
  } finally {
    client.release();
  }
});

app.get('/api/admin/products', requireAuth, requireAdmin, async (_req, res) => {
  const r = await pool.query('SELECT id,name,description,price_cents,image_url,stock FROM products ORDER BY id');
  res.json(r.rows);
});

app.post('/api/admin/products', requireAuth, requireAdmin, upload.single('image'), async (req, res) => {
  const { name, description, price_cents, image_url, stock } = req.body || {};
  const finalImageUrl = req.file ? `/uploads/${req.file.filename}` : image_url || null;
  const r = await pool.query(
    `INSERT INTO products(name,description,price_cents,image_url,stock)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [name, description || null, Number(price_cents), finalImageUrl, stock == null || stock === '' ? null : Number(stock)]
  );
  res.json(r.rows[0]);
});

app.put('/api/admin/products/:id', requireAuth, requireAdmin, upload.single('image'), async (req, res) => {
  const id = Number(req.params.id);
  const { name, description, price_cents, image_url, stock } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    let finalImageUrl = req.file ? `/uploads/${req.file.filename}` : image_url || null;
    if (!req.file && !image_url) {
      const curr = await pool.query('SELECT image_url FROM products WHERE id=$1', [id]);
      finalImageUrl = curr.rows[0]?.image_url;
    }
    const q = `UPDATE products SET name=$1, description=$2, price_cents=$3, image_url=$4, stock=$5 WHERE id=$6
               RETURNING id,name,description,price_cents,image_url,stock`;
    const vals = [
      name, description || null, Number(price_cents), finalImageUrl,
      stock == null || stock === '' ? null : Number(stock), id,
    ];
    const r = await pool.query(q, vals);
    if (!r.rowCount) return res.status(404).json({ error: 'Product not found' });
    return res.json(r.rows[0]);
  } catch (e) {
    if (e.code === '42703') {
      try {
        let finalImageUrlFallback = req.file ? `/uploads/${req.file.filename}` : image_url || null;
        if (!req.file && !image_url) {
          const curr = await pool.query('SELECT image_url FROM products WHERE id=$1', [id]);
          finalImageUrlFallback = curr.rows[0]?.image_url;
        }
        const q2 = `UPDATE products SET name=$1, description=$2, price_cents=$3, image_url=$4 WHERE id=$5
                    RETURNING id,name,description,price_cents,image_url`;
        const vals2 = [name, description || null, Number(price_cents), finalImageUrlFallback, id];
        const r2 = await pool.query(q2, vals2);
        if (!r2.rowCount) return res.status(404).json({ error: 'Product not found' });
        return res.json({ ...r2.rows[0], stock: null });
      } catch (e2) {
        console.error('product update fallback error', e2);
        return res.status(500).json({ error: 'Update failed' });
      }
    }
    console.error('product update error', e);
    return res.status(500).json({ error: 'Update failed' });
  }
});

app.delete('/api/admin/products/:id', requireAuth, requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM products WHERE id=$1', [Number(req.params.id)]);
  res.json({ ok: true });
});

app.get('/api/admin/orders', requireAuth, requireAdmin, async (req, res) => {
  const { q = '', status = '', user_id, limit = 200, offset = 0 } = req.query;
  const clauses = [];
  const params = [];
  let i = 1;
  if (status && ORDER_STATUS.includes(status)) {
    clauses.push(`o.status = $${i++}`);
    params.push(status);
  }
  if (user_id && /^\d+$/.test(user_id)) {
    clauses.push(`o.user_id = $${i++}`);
    params.push(Number(user_id));
  }
  if (q) {
    clauses.push(`(u.email ILIKE $${i} OR u.fullname ILIKE $${i})`);
    params.push(`%${q}%`);
    i++;
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  // ✅ FIXED: Include shipping_address, customer_phone, billing_address
  const sql = `
    SELECT o.id, o.user_id, u.email, u.fullname, 
           o.items, o.total_cents, o.status, o.created_at, o.updated_at,
           o.shipping_address, o.customer_phone, o.billing_address
      FROM orders o
      JOIN users u ON u.id = o.user_id
      ${where}
     ORDER BY o.created_at DESC
     LIMIT $${i} OFFSET $${i + 1}
  `;
  params.push(Number(limit), Number(offset));
  try {
    const r = await pool.query(sql, params);
    const rows = r.rows.map(o => ({
      ...o, items: Array.isArray(o.items) ? o.items : typeof o.items === 'string' ? safeJson(o.items) : [],
    }));
    res.json(rows);
  } catch (e) {
    if (e.code === '42703') {
      const r2 = await pool.query(
        `SELECT o.id, o.user_id, u.email, u.fullname, o.total_cents, o.status, o.created_at
           FROM orders o JOIN users u ON u.id = o.user_id
           ${where.replace('o.items, ', '').replace('o.updated_at, o.shipping_address, o.customer_phone, o.billing_address', 'o.created_at')}
           LIMIT $${i} OFFSET $${i + 1}`,
        params
      );
      return res.json(r2.rows.map(o => ({ ...o, items: [], shipping_address: null, customer_phone: null, billing_address: null })));
    }
    res.status(500).json({ error: 'All-orders fetch failed' });
  }
});

/* ------------------------------ Courses --------------------------- */
app.get('/api/courses', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, description, image_url, modules, created_at, updated_at
       FROM courses ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching courses:', err);
    res.status(500).json({ error: 'Failed to load courses' });
  }
});

app.get('/api/admin/courses', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, description, image_url, modules, created_at, updated_at, completed_course
       FROM courses ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching courses:', err);
    res.status(500).json({ error: 'Failed to load courses' });
  }
});

app.post('/api/admin/courses', requireAuth, requireAdmin, upload.single('image'), async (req, res) => {
  const { title, description, image_url } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  const finalImageUrl = req.file ? `/uploads/${req.file.filename}` : image_url || null;
  try {
    const { rows } = await pool.query(
      'INSERT INTO courses (title, description, image_url) VALUES ($1, $2, $3) RETURNING id',
      [title, description, finalImageUrl]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (e) {
    res.status(500).json({ error: 'Course creation failed' });
  }
});

app.put('/api/admin/courses/:id', requireAuth, requireAdmin, upload.single('image'), async (req, res) => {
  const id = Number(req.params.id);
  const { title, description, image_url, modules } = req.body;
  const completed_course = !!(req.body.completed_course === true || req.body.completed_course === 'true');
  if (!title) return res.status(400).json({ error: 'Title is required' });
  try {
    let finalImageUrl = req.file ? `/uploads/${req.file.filename}` : image_url || null;
    if (!req.file && !image_url) {
      const curr = await pool.query('SELECT image_url FROM courses WHERE id=$1', [id]);
      finalImageUrl = curr.rows[0]?.image_url;
    }
    let finalModules = modules;
    if (typeof modules === 'string') {
      try {
        finalModules = JSON.parse(modules);
      } catch {
        finalModules = [];
      }
    }
    const { rowCount } = await pool.query(
      `UPDATE courses SET title=$1, description=$2, image_url=$3, modules=$4, completed_course=$5 WHERE id=$6`,
      [title, description, finalImageUrl, JSON.stringify(finalModules || []), completed_course, id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Course not found' });
    return res.status(200).json({ message: 'Course updated' });
  } catch (e) {
    console.error('Update course error:', e);
    return res.status(500).json({ error: 'Course update failed', detail: e.message });
  }
});

app.delete('/api/admin/courses/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM courses WHERE id=$1', [id]);
    if (!rowCount) return res.status(404).json({ error: 'Course not found' });
    res.status(200).json({ message: 'Course deleted' });
  } catch (e) {
    res.status(500).json({ error: 'Course deletion failed' });
  }
});

app.get('/api/courses/:id', optionalAuth, async (req, res) => {
  const courseId = Number(req.params.id);
  try {
    const { rows } = await pool.query(
      `SELECT id, title, description, image_url, modules, created_at, updated_at FROM courses WHERE id=$1`,
      [courseId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const course = rows[0];
    course.modules = Array.isArray(course.modules)
      ? course.modules
      : typeof course.modules === 'string'
      ? safeJson(course.modules)
      : [];
    const modules_count = course.modules.length;
    const videos_count = course.modules.reduce((s, m) => s + (Array.isArray(m.videos) ? m.videos.length : 0), 0);
    let enrolled = false, progress = null, completed_at = null;
    try {
      if (req.user && req.user.sub) {
        const r2 = await pool.query(
          `SELECT enrolled_at, meta, completed_at, status FROM enrollments
           WHERE user_id=$1 AND course_id=$2 LIMIT 1`,
          [Number(req.user.sub), courseId]
        );
        if (r2.rowCount) {
          enrolled = true;
          let meta = r2.rows[0].meta;
          if (typeof meta === 'string' && meta) {
            try { meta = JSON.parse(meta); } catch (e) {}
          }
          progress = meta || {};
          completed_at = r2.rows[0].completed_at || null;
        }
      }
    } catch (e) {
      console.warn('enrollment lookup failed', e);
    }
    return res.json({ ...course, modules_count, videos_count, enrolled, progress, completed_at });
  } catch (err) {
    console.error('GET /api/courses/:id error', err);
    return res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/courses/:id/enroll', requireAuth, async (req, res) => {
  const userId = Number(req.user.sub);
  const courseId = Number(req.params.id);
  const r = await pool.query(
    `INSERT INTO enrollments (user_id, course_id) VALUES ($1,$2)
     ON CONFLICT (user_id, course_id) DO NOTHING RETURNING *`,
    [userId, courseId]
  );
  if (!r.rowCount) return res.json({ ok: true, enrolled: true });
  res.json({ ok: true, enrolled: true, enrolled_at: r.rows[0].enrolled_at });
});

app.delete('/api/courses/:id/enroll', requireAuth, async (req, res) => {
  const userId = Number(req.user.sub);
  const courseId = Number(req.params.id);
  await pool.query('DELETE FROM enrollments WHERE user_id=$1 AND course_id=$2', [userId, courseId]);
  res.json({ ok: true });
});

app.get('/api/me/enrollments', requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT e.course_id, e.enrolled_at, e.meta, e.status, c.title, c.image_url
       FROM enrollments e JOIN courses c ON c.id = e.course_id
       WHERE e.user_id=$1 ORDER BY e.enrolled_at DESC`,
      [Number(req.user.sub)]
    );
    const rows = r.rows.map(row => {
      let meta = row.meta;
      if (typeof meta === 'string' && meta) {
        try { meta = JSON.parse(meta); } catch (e) { meta = {}; }
      }
      return { ...row, meta };
    });
    res.json(rows);
  } catch (e) {
    console.error('GET /api/me/enrollments failed', e);
    res.status(500).json({ error: 'Enrollments fetch failed' });
  }
});

app.get('/api/course/:id/completedcourse', async (req, res) => {
  const courseId = Number(req.params.id);
  if (isNaN(courseId)) return res.status(400).json({ error: 'Invalid course ID' });
  try {
    const r = await pool.query(`SELECT completed_course FROM courses WHERE id = $1`, [courseId]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Course not found', completed_course: false });
    const completed = !!r.rows[0].completed_course;
    res.json([{ completed_course: completed }]);
  } catch (err) {
    console.error('Error fetching completed course:', err);
    res.status(500).json({ error: 'Failed to load completed course' });
  }
});

app.post('/api/courses/:id/progress', requireAuth, async (req, res) => {
  const userId = Number(req.user.sub);
  const courseId = Number(req.params.id);
  const { module_idx, video_idx, quiz_passed, quiz_score } = req.body || {};
  const isVideoProgress = Number.isInteger(video_idx);
  const isQuizProgress = quiz_passed !== undefined && quiz_score !== undefined && Number.isInteger(quiz_score);
  if (!Number.isInteger(module_idx)) return res.status(400).json({ error: 'module_idx required' });
  if (!isVideoProgress && !isQuizProgress)
    return res.status(400).json({ error: 'Either video_idx or (quiz_passed + quiz_score) required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO enrollments(user_id, course_id) VALUES($1,$2) ON CONFLICT (user_id, course_id) DO NOTHING`,
      [userId, courseId]
    );
    const c = await client.query('SELECT modules FROM courses WHERE id=$1', [courseId]);
    if (!c.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Course not found' });
    }
    const modules = Array.isArray(c.rows[0].modules)
      ? c.rows[0].modules
      : typeof c.rows[0].modules === 'string'
      ? safeJson(c.rows[0].modules)
      : [];
    const totalVideos = modules.reduce((s, m) => s + (Array.isArray(m.videos) ? m.videos.length : 0), 0);
    const r = await client.query('SELECT meta FROM enrollments WHERE user_id=$1 AND course_id=$2 FOR UPDATE', [
      userId, courseId,
    ]);
    let meta = r.rowCount ? r.rows[0].meta || {} : {};
    if (!meta.watched) meta.watched = {};
    if (!meta.quizzes) meta.quizzes = {};
    const mKey = `m${module_idx}`;
    if (isVideoProgress) {
      meta.watched[mKey] = Array.isArray(meta.watched[mKey]) ? meta.watched[mKey] : [];
      if (!meta.watched[mKey].includes(Number(video_idx))) meta.watched[mKey].push(Number(video_idx));
    }
    if (isQuizProgress) {
      meta.quizzes[mKey] = { passed: !!quiz_passed, score: Number(quiz_score) };
    }
    const watchedCount = Object.values(meta.watched).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
    let completedAt = null;
    let status = 'active';
    const allQuizzesPassed = modules.every((m, idx) => {
      const hasQuiz = m.questions && Array.isArray(m.questions) && m.questions.length > 0;
      if (!hasQuiz) return true;
      const qRes = meta.quizzes[`m${idx}`];
      return qRes && qRes.passed === true;
    });
    if (totalVideos > 0 && watchedCount >= totalVideos && allQuizzesPassed) {
      completedAt = new Date().toISOString();
      status = 'completed';
    }
    await client.query(
      `UPDATE enrollments SET meta=$1::jsonb, completed_at=$2, status=$3 WHERE user_id=$4 AND course_id=$5`,
      [JSON.stringify(meta), completedAt, status, userId, courseId]
    );
    await client.query('COMMIT');
    return res.json({ ok: true, watchedCount, totalVideos, completed: !!completedAt });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('progress error', err);
    return res.status(500).json({ error: 'Progress failed' });
  } finally {
    client.release();
  }
});

/* --------------------------- Notifications ------------------------ */
app.get('/api/notifications/unread-count', requireAuth, async (req, res) => {
  const r = await pool.query(`SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND is_read=false`, [req.user.sub]);
  res.json({ count: parseInt(r.rows[0].count) });
});

app.get('/api/notifications', requireAuth, async (req, res) => {
  const r = await pool.query(
    `SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20`,
    [req.user.sub]
  );
  res.json(r.rows);
});

/* ---------------------- Translation Proxy Endpoint ---------------- */
app.get('/api/translate', async (req, res) => {
  try {
    const { text, src = 'auto', dest = 'en' } = req.query;
    if (!text) return res.status(400).json({ error: 'text required' });
    const flaskUrl = `http://127.0.0.1:5000/translate?text=${encodeURIComponent(text)}&src=${src}&dest=${dest}`;
    const proxyRes = await fetch(flaskUrl);
    const data = await proxyRes.json();
    res.json(data);
  } catch (e) {
    console.error('Translation proxy error:', e);
    res.json({ translated_text: req.query.text });
  }
});

/* ------------------------------ Routes ---------------------------- */
app.get('/', (_req, res) => res.sendFile(path.join(PUBLIC, 'html', 'index.html')));
app.get('/login', (_req, res) => res.sendFile(path.join(PUBLIC, 'html', 'index.html')));
app.get('/bot', (_req, res) => res.sendFile(path.join(PUBLIC, 'html', 'bot.html')));
app.get('/agritourism', (_req, res) => res.sendFile(path.join(PUBLIC, 'html', 'agritourism.html')));
app.get('/signup', (_req, res) => res.sendFile(path.join(PUBLIC, 'html', 'index.html')));
app.get('/posts', (_req, res) => res.sendFile(path.join(PUBLIC, 'html', 'posts.html')));
app.get('/checkout', (_req, res) => res.sendFile(path.join(PUBLIC, 'html', 'checkout.html')));
app.get('/articles', (_req, res) => res.sendFile(path.join(PUBLIC, 'html', 'articles.html')));
app.get('/profile', requireAuth, async (req, res) => {
  try {
    const r = await pool.query('SELECT is_admin FROM users WHERE id=$1', [req.user.sub]);
    const isAdmin = !!(r.rowCount && r.rows[0].is_admin);
    if (isAdmin) return res.redirect('/admin');
  } catch {}
  return res.sendFile(path.join(PUBLIC, 'html', 'profile.html'));
});
app.get('/courses', (_req, res) => res.sendFile(path.join(PUBLIC, 'html', 'courses.html')));
app.get('/course/:id', optionalAuth, (_req, res) => res.sendFile(path.join(PUBLIC, 'html', 'course.html')));
app.get('/user/:id', (_req, res) => res.sendFile(path.join(PUBLIC, 'html', 'pro.html')));

app.get('/health', async (_req, res) => {
  try {
    const r = await pool.query('SELECT 1 AS ok');
    res.json({ db: 'up', result: r.rows[0] });
  } catch (e) {
    res.status(500).json({ db: 'down', error: e.message });
  }
});

app.get('/lang/:locale', (req, res) => {
  const locale = req.params.locale;
  if (!['en', 'ar'].includes(locale)) return res.status(404).json({ error: 'Language not supported' });
  const filePath = path.join(__dirname, 'static', 'lang', `lang.${locale}.json`);
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) return res.status(404).json({ error: 'Language file not found' });
    res.type('application/json').send(data);
  });
});

/* ------------------------------ Start ----------------------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});