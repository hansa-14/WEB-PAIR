const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { exec } = require("child_process");
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  makeCacheableSignalKeyStore,
  Browsers,
  jidNormalizedUser,
} = require("@whiskeysockets/baileys");
const { upload } = require("./mega");

const router = express.Router();
const MESSAGE = process.env.MESSAGE || `✅ SESSION GENERATED SUCCESSFULLY`;
const botsPath = path.join(__dirname, "bots.json");

function removeFile(folder) {
  if (fs.existsSync(folder)) fs.rmSync(folder, { recursive: true, force: true });
}

function generateId(length = 6, numberLength = 4) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < length; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
  const num = Math.floor(Math.random() * Math.pow(10, numberLength));
  return `${id}${num}`;
}

router.get("/", async (req, res) => {
  let number = req.query.number?.replace(/[^0-9]/g, "");
  if (!number) return res.status(400).send({ error: "Missing number" });

  const authFolder = "./auth_info_baileys";

  async function startPairing() {
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
      },
      browser: Browsers.macOS("Safari"),
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
    });

    sock.ev.on("creds.update", saveCreds);

    if (!sock.authState.creds.registered) {
      try {
        await delay(1500);
        const code = await sock.requestPairingCode(number);
        if (!res.headersSent) res.send({ code });
      } catch (e) {
        console.error("❌ Failed to generate pairing code:", e.message);
        if (!res.headersSent) res.status(500).send({ error: "Pairing failed" });
        sock.end();
        return;
      }
    }

sock.ev.on("connection.update", async function handleConnection(update) {
  const { connection, lastDisconnect } = update;

  if (connection === "open") {
    sock.ev.off("connection.update", handleConnection); // 🔁 remove listener

    try {
      const userJid = jidNormalizedUser(sock.user.id);
      await sock.waitForSocketOpen();
      console.log("🟢 Connected. Sending credentials...");

      await delay(10000);
      const credsStream = fs.createReadStream(path.join(authFolder, "creds.json"));
      const megaLink = await upload(credsStream, `${generateId()}.json`);
      const sessionId = megaLink.replace("https://mega.nz/file/", "");

      // Send credentials & message
      const msg = await sock.sendMessage(userJid, { text: sessionId });
      await sock.sendMessage(userJid, { text: MESSAGE }, { quoted: msg });

      // Save to bots.json
      const bots = fs.existsSync(botsPath) ? JSON.parse(fs.readFileSync(botsPath)) : [];
      const newBot = {
        number,
        owner: "AutoPair",
        session: sessionId,
        prefix: ".",
        mode: "public",
        autoReply: true,
        autoVoice: true,
        autoReact: true,
        autoType: true,
        statusView: true,
        statusReact: true,
        statusReply: false,
        readCmd: true,
        sendWelcome: false,
        statusReactEmoji: "💚",
        AutoReactEmoji: "💕",
        autoRec: true,
        online: true,
      };

      const existingIndex = bots.findIndex((b) => b.number === number);
      if (existingIndex > -1) bots[existingIndex] = newBot;
      else bots.push(newBot);

      fs.writeFileSync(botsPath, JSON.stringify(bots, null, 2));

      try {
        await axios.post("https://dew-md.up.railway.app/api/deploy", newBot);
        console.log("✅ Auto-deploy success");
      } catch (err) {
        console.error("❌ Deploy failed:", err.message);
      }

    } catch (err) {
      console.error("❌ Session processing failed:", err.message);
    } finally {
      sock.end();
      removeFile(authFolder);
      await delay(500);
      startPairing(); // recursive restart
    }

  } else if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
    sock.ev.off("connection.update", handleConnection); // 🔁 remove listener
    console.warn("🔁 Reconnecting after disconnect...");
    sock.end();
    removeFile(authFolder);
    await delay(10000);
    startPairing();
  }
});

  }

  try {
    await startPairing();
  } catch (err) {
    console.error("❌ Top-level error:", err.message);
    if (!res.headersSent) res.status(500).send({ error: "Internal server error" });
    exec("pm2 restart DEW-MD");
  }
});

// Crash fallback
process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err);
  exec("pm2 restart DEW-MD");
});

module.exports = router;
