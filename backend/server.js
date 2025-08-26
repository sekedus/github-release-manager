import express from "express";
import session from "express-session";
import multer from "multer";
import bodyParser from "body-parser";
import { Octokit } from "@octokit/rest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();

// --- __dirname & __filename in ES module ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Express setup ---
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session config: use MongoStore in production when MONGO_URL is provided.
const useMongo = process.env.NODE_ENV === "production" && !!process.env.MONGO_URL;

if (useMongo) {
  app.set("trust proxy", 1);
}

const sessionOptions = {
  secret: process.env.SESSION_SECRET,
  name: process.env.SESSION_NAME,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: !!useMongo, // only secure when using mongo in production (and behind TLS)
    httpOnly: true,
    sameSite: "lax"
  }
};

if (useMongo) {
  try {
    const mongoModule = await import("connect-mongo");
    const MongoStore = mongoModule.default || mongoModule;
    sessionOptions.store = MongoStore.create({
      mongoUrl: process.env.MONGO_URL,
      collectionName: "ghrm_sessions",
      ttl: 14 * 24 * 60 * 60,  // 14 days
      autoRemove: "native"
    });
    console.log("MongoStore session store configured.");
  } catch (err) {
    console.warn("connect-mongo not found or failed to load — falling back to MemoryStore.");
    console.warn(err?.message || err);
  }
} else {
  console.warn("Using MemoryStore for sessions. In production set NODE_ENV=production and provide MONGO_URL to enable MongoStore.");
}

app.use(session(sessionOptions));

// --- Multer uploads ---
const upload = multer({ dest: path.join(__dirname, "uploads/") });

// --- Helper: get Octokit instance ---
function getOctokit(token) {
  return token ? new Octokit({ auth: token }) : new Octokit();
}

// --- Middleware: login required ---
function requireLogin(req, res, next) {
  if (!req.session.github) return res.status(401).json({ error: "Unauthorized" });
  req.octokit = getOctokit(req.session.github.token);
  next();
}

// --- Login route ---
app.post("/api/login", async (req, res) => {
  const { user, repo, token } = req.body;
  if (!user || !repo) return res.status(400).json({ error: "Missing fields" });

  const octokit = getOctokit(token);
  try {
    await octokit.rest.repos.get({ owner: user, repo });
  } catch (err) {
    return res.status(401).json({ error: "Invalid token or repository access denied" });
  }

  req.session.github = { user, repo, token: token || "" };
  res.json({ success: true });
});

// --- User info ---
app.get("/api/me", async (req, res) => {
  if (req.session.github) {
    let canWrite = false;
    if (req.session.github.token) {
      try {
        const octokit = getOctokit(req.session.github.token);
        const repoRes = await octokit.rest.repos.get({
          owner: req.session.github.user,
          repo: req.session.github.repo
        });
        // Check permissions (admin or push access)
        canWrite = repoRes.data.permissions?.push || repoRes.data.permissions?.admin || false;
      } catch {
        canWrite = false;
      }
    }
    res.json({
      loggedIn: true,
      user: req.session.github.user,
      repo: req.session.github.repo,
      token: !!req.session.github.token,
      canWrite
    });
  } else {
    res.json({ loggedIn: false });
  }
});

// --- Logout route ---
app.post("/api/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ message: "Logout failed" });
    }
    res.clearCookie(process.env.SESSION_NAME);
    res.json({ message: "Logged out" });
  });
});

// --- Get all releases ---

app.get("/api/releases", requireLogin, async (req, res) => {
  /**
   * Limit: TS = 1000
   * - per_page = 100
   * - page = Math.ceil(MAX_RESULTS / per_page)
   *
   * Source: https://docs.github.com/en/rest/releases/releases#list-releases--parameters
   */

  const { user, repo } = req.session.github;
  const MAX_RESULTS = 1000;

  let per_page = Number(req.query.per_page);
  if (isNaN(per_page) || per_page < 1) per_page = 30;
  if (per_page > 100) per_page = 100;

  const maxPage = Math.ceil(MAX_RESULTS / per_page);
  let page = Number(req.query.page);
  if (isNaN(page) || page < 1) page = 1;
  if (page > maxPage) page = maxPage;

  try {
    const response = await req.octokit.rest.repos.listReleases({
      owner: user,
      repo,
      per_page,
      page
    });

    const linkHeader = response.headers?.link || null;
    const nextPage = getNextPageFromLink(linkHeader, maxPage);

    res.json({
      next_page: nextPage,
      releases: response.data
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api#using-link-headers
function getNextPageFromLink(linkHeader, maxPage) {
  if (!linkHeader) return null;
  const links = {};
  linkHeader.split(",").forEach(part => {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match) {
      links[match[2]] = match[1];
    }
  });
  if (links.next) {
    const url = new URL(links.next);
    const nextPage = url.searchParams.get("page");
    if (nextPage && Number(nextPage) <= maxPage) {
      return Number(nextPage);
    }
  }
  return null;
}

// --- Get latest release ---
app.get("/api/release/latest", requireLogin, async (req, res) => {
  const { user, repo } = req.session.github;
  try {
    const { data } = await req.octokit.rest.repos.getLatestRelease({ owner: user, repo });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Get single release ---
app.get("/api/release/:id", requireLogin, async (req, res) => {
  const { user, repo } = req.session.github;
  try {
    const { data } = await req.octokit.rest.repos.getRelease({ owner: user, repo, release_id: req.params.id });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Create release ---
app.post("/api/release/new", requireLogin, async (req, res) => {
  const { user, repo } = req.session.github;
  const { tag_name, name, body, draft, prerelease, make_latest } = req.body;
  try {
    const { data } = await req.octokit.rest.repos.createRelease({
      owner: user,
      repo,
      tag_name,
      name,
      body,
      draft,
      prerelease,
      make_latest
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Update release ---
app.post("/api/release/:id/edit", requireLogin, async (req, res) => {
  const { user, repo } = req.session.github;
  const { tag_name, name, body, draft, prerelease, make_latest } = req.body;
  try {
    await req.octokit.rest.repos.updateRelease({
      owner: user,
      repo,
      release_id: req.params.id,
      tag_name,
      name,
      body,
      draft,
      prerelease,
      make_latest
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Delete release ---
app.delete("/api/release/:id", requireLogin, async (req, res) => {
  const { user, repo } = req.session.github;
  try {
    await req.octokit.rest.repos.deleteRelease({ owner: user, repo, release_id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Upload asset ---
app.post("/api/release/:id/upload", requireLogin, upload.single("asset"), async (req, res) => {
  const { user, repo } = req.session.github;
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No file uploaded" });
  try {
    const stats = fs.statSync(file.path);
    const stream = fs.createReadStream(file.path);
    await req.octokit.rest.repos.uploadReleaseAsset({
      owner: user,
      repo,
      release_id: req.params.id,
      name: file.originalname,
      data: stream,
      headers: {
        "content-type": "application/octet-stream",
        "content-length": stats.size
      }
    });
    fs.unlinkSync(file.path);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Delete asset ---
app.delete("/api/release/:releaseId/asset/:assetId", requireLogin, async (req, res) => {
  const { user, repo } = req.session.github;
  try {
    await req.octokit.rest.repos.deleteReleaseAsset({
      owner: user,
      repo,
      asset_id: req.params.assetId
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Serve React frontend build ---
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/build")));
  app.get("/*path", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/build/index.html"));
  });
}

// --- Start server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
