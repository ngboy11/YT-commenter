import express from "express";
import session from "express-session";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { google } from "googleapis";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

const youtube = google.youtube({ version: "v3", auth: oauth2Client });

// 🟢 Home page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 🔑 Google Login
app.get("/auth", (req, res) => {
  const scopes = ["https://www.googleapis.com/auth/youtube.force-ssl"];
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
  });
  res.redirect(url);
});

// 🔐 OAuth callback
app.get("/oauth2callback", async (req, res) => {
  const { code } = req.query;
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  req.session.tokens = tokens;
  res.redirect("/");
});

// 🚪 Sign out
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

// 🧠 Check login status
app.get("/status", (req, res) => {
  res.json({ signedIn: !!req.session.tokens });
});

// 📝 Post comment
app.post("/comment", async (req, res) => {
  if (!req.session.tokens) return res.status(401).json({ message: "Not signed in" });

  oauth2Client.setCredentials(req.session.tokens);

  const { videoUrl, comment } = req.body;
  const videoId = new URL(videoUrl).searchParams.get("v");

  try {
    await youtube.commentThreads.insert({
      part: "snippet",
      requestBody: {
        snippet: {
          videoId,
          topLevelComment: {
            snippet: {
              textOriginal: comment,
            },
          },
        },
      },
    });
    res.json({ message: "Comment posted successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error posting comment" });
  }
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
