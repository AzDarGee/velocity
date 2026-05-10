import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import Stripe from "stripe";
import nodemailer from "nodemailer";
import admin from "firebase-admin";

import { getFirestore } from "firebase-admin/firestore";

// Initialize Firebase Admin
let firebaseConfig: any = null;
const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
if (fs.existsSync(firebaseConfigPath)) {
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
    console.log("Loaded firebase-applet-config.json. Project ID:", firebaseConfig.projectId);
  } catch (err) {
    console.error("Error reading firebase-applet-config.json:", err);
  }
} else {
  console.warn("firebase-applet-config.json NOT FOUND!");
}

// Ensure the default app is initialized
try {
  if (!admin.apps.length) {
    console.log("Starting Firebase Admin Initialization...");
    console.log("Environment Project:", process.env.GOOGLE_CLOUD_PROJECT);
    console.log("Config Project:", firebaseConfig?.projectId);

    // We MUST use the projectId from the config if we want to target the user's intended project.
    // Zero-config ADC defaults to the environment's project (which may not have APIs enabled).
    admin.initializeApp({
      projectId: firebaseConfig?.projectId || process.env.GOOGLE_CLOUD_PROJECT,
    });
    
    console.log("Firebase Admin Initialized. Targeted Project ID:", admin.app().options.projectId);
    if (admin.app().options.projectId !== firebaseConfig?.projectId) {
      console.warn("WARNING: Target project does NOT match config project!");
    }
  } else {
    console.log("Firebase Admin already initialized. Project:", admin.app().options.projectId);
  }
} catch (err) {
  console.error("Firebase Admin Initialization Error:", err);
}

/**
 * Helper to get the correct Firestore instance
 */
const getDb = () => {
  try {
    const app = admin.app();
    
    // If we have a named database ID from config, use it.
    if (firebaseConfig && firebaseConfig.firestoreDatabaseId) {
      return getFirestore(app, firebaseConfig.firestoreDatabaseId);
    }
    return getFirestore(app);
  } catch (err) {
    console.error("Failed to get Firestore instance:", err);
  }
  return getFirestore();
};

const getAuth = () => {
  return admin.auth();
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resend Transporter
const getTransporter = () => {
  const host = process.env.RESEND_SMTP_HOST || "smtp.resend.com";
  const port = parseInt(process.env.RESEND_SMTP_PORT || "465");
  const user = process.env.RESEND_SMTP_USER || "resend";
  const pass = process.env.RESEND_SMTP_PASSWORD || process.env.RESEND_API_KEY;

  if (!pass) {
    console.warn("Neither RESEND_SMTP_PASSWORD nor RESEND_API_KEY set. Email sending will fail.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });
};

let stripeClient: Stripe | null = null;
const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is required but not configured.");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
};

const CREDIT_PACKS = {
  "pack-50": { credits: 50, priceInCents: 1000, name: "Starter Pack (50 Credits)" },
  "pack-200": { credits: 200, priceInCents: 2500, name: "Content Pack (200 Credits)" },
  "pack-500": { credits: 500, priceInCents: 4500, name: "Pro Pack (500 Credits)" },
  "pack-1000": { credits: 1000, priceInCents: 9900, name: "Enterprise Pack (1000 Credits)" },
};

const SUBSCRIPTION_PLANS = {
  "sub-weekly": { credits: 50, priceInCents: 700, name: "Weekly Content Tier", interval: "week" as const },
  "sub-monthly": { credits: 200, priceInCents: 1900, name: "Monthly Content Tier", interval: "month" as const },
  "sub-yearly": { credits: 1200, priceInCents: 9900, name: "Yearly Content Tier", interval: "year" as const },
  "tier-basic-mo": { credits: 200, priceInCents: 2000, name: "Basic Content Tier", interval: "month" as const },
  "tier-basic-yr": { credits: 2400, priceInCents: 20000, name: "Basic Content Tier", interval: "year" as const },
  "tier-pro-mo": { credits: 500, priceInCents: 4000, name: "Pro Content Tier", interval: "month" as const },
  "tier-pro-yr": { credits: 6000, priceInCents: 42000, name: "Pro Content Tier", interval: "year" as const },
  "tier-unlimited-mo": { credits: 1000, priceInCents: 7500, name: "Unlimited Content Tier", interval: "month" as const },
  "tier-unlimited-yr": { credits: 12000, priceInCents: 80000, name: "Unlimited Content Tier", interval: "year" as const },
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Basic health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Debug Config (Admin Only)
  app.get("/api/admin/debug-config", async (req, res) => {
    try {
      const { adminId } = req.query;
      if (!adminId) return res.status(401).json({ error: "Unauthorized" });
      
      const userId = adminId as string;
      const caller = await getAuth().getUser(userId);
      const hardcoded = ["ashdarji1@gmail.com", "ashishdarji88@gmail.com", "saanskarastudios@gmail.com"];
      
      if (!caller.email || !hardcoded.includes(caller.email)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      res.json({
        projectId: admin.app().options.projectId,
        configProjectId: firebaseConfig?.projectId,
        databaseId: firebaseConfig?.firestoreDatabaseId,
        nodeEnv: process.env.NODE_ENV,
        hasFirebaseConfig: !!firebaseConfig
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Stripe Webhook needs raw body - must be defined BEFORE any general express.json() middleware
  // to ensure signature verification receives the unmodified raw buffer.
  app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
    const stripe = getStripe();
    const sig = req.headers["stripe-signature"];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
      if (!sig || !endpointSecret) throw new Error("Missing signature or webhook secret");
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err: any) {
      console.error(`Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log(`Payment successful for user ${session.metadata?.userId}`);
    }

    res.json({ received: true });
  });

  // Regular body parser for all subsequent routes
  app.use(express.json());

  // API Route: Send Verification Email via Resend
  app.post("/api/auth/send-verification", async (req, res) => {
    try {
      const { email, returnUrl } = req.body;
      if (!email) return res.status(400).json({ error: "Email is required" });

      const link = await getAuth().generateEmailVerificationLink(email, {
        url: returnUrl || process.env.APP_URL || "http://localhost:3000",
      });

      const transporter = getTransporter();
      const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

      console.log(`Sending verification email to ${email} from ${fromEmail}`);

      await transporter.sendMail({
        from: `Velocity Blog Synth <${fromEmail}>`,
        to: email,
        subject: "Verify your email - Velocity Blog Synth",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
            <h1 style="color: #333; font-style: italic;">Velocity_Synthesis_Protocol</h1>
            <p>Welcome to Velocity. Please verify your email to access all features.</p>
            <a href="${link}" style="display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; font-weight: bold; margin: 20px 0;">Verify Email Address</a>
            <p style="font-size: 12px; color: #666;">If you didn't request this, you can safely ignore this email.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 2px;">Velocity Synthesis // End of Transcript</p>
          </div>
        `,
      });

      console.log(`Verification email sent successfully to ${email}`);
      res.json({ success: true });
    } catch (error: any) {
      const isAuthError = error.code?.startsWith("auth/") || error.message?.includes("Identity Toolkit");
      console.error(isAuthError ? "Auth Link generation failed:" : "Email transport failed:", error.message);
      res.status(500).json({ 
        error: error.message,
        stage: isAuthError ? "auth_generation" : "email_sending"
      });
    }
  });

  // API Route: Send Password Reset Email via Resend
  app.post("/api/auth/send-password-reset", async (req, res) => {
    try {
      const { email, returnUrl } = req.body;
      if (!email) return res.status(400).json({ error: "Email is required" });

      const link = await getAuth().generatePasswordResetLink(email, {
        url: returnUrl || process.env.APP_URL || "http://localhost:3000",
      });

      const transporter = getTransporter();
      const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

      await transporter.sendMail({
        from: `Velocity Blog Synth <${fromEmail}>`,
        to: email,
        subject: "Reset your password - Velocity Blog Synth",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
            <h1 style="color: #333; font-style: italic;">Velocity_Synthesis_Protocol</h1>
            <p>You requested a password reset for your Velocity account.</p>
            <a href="${link}" style="display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; font-weight: bold; margin: 20px 0;">Reset Password</a>
            <p style="font-size: 12px; color: #666;">If you didn't request this, your account is still secure.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 2px;">Velocity Synthesis // End of Transcript</p>
          </div>
        `,
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Password Reset Email Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route: Delete User (Admin Only)
  app.post("/api/users/remove-account", async (req, res) => {
    try {
      const { userId, adminId } = req.body;
      if (!userId || !adminId) return res.status(400).json({ error: "Missing required IDs" });

      console.log(`Admin ${adminId} requesting delete of user ${userId}`);

      // Verify admin status
      const db = getDb();
      let isAdmin = false;
      
      try {
        const adminDoc = await db.collection("admins").doc(adminId).get();
        if (adminDoc.exists) {
          isAdmin = true;
        }
      } catch (err: any) {
        if (err.code !== 7 && !err.message?.includes('403') && !err.message?.includes('PERMISSION_DENIED')) {
          console.error("Firestore Admin Check Error:", err.message);
        }
      }

      if (!isAdmin) {
        try {
          const caller = await getAuth().getUser(adminId);
          const hardcoded = ["ashdarji1@gmail.com", "ashishdarji88@gmail.com", "saanskarastudios@gmail.com"];
          if (caller.email && hardcoded.includes(caller.email)) {
            isAdmin = true;
          }
        } catch (err: any) {
          if (!err.message?.includes('403') && !err.message?.includes('PERMISSION_DENIED')) {
            console.error("Auth Admin Check Error:", err.message);
          }
        }
      }

      if (!isAdmin) {
        return res.status(403).json({ error: "Access denied. Admin privileges required." });
      }

      // CHECK IF TARGET USER IS AN ADMIN - Prevent deleting admins
      const hardcoded = ["ashdarji1@gmail.com", "ashishdarji88@gmail.com", "saanskarastudios@gmail.com"];
      try {
        const targetAuthUser = await getAuth().getUser(userId);
        if (targetAuthUser.email && hardcoded.includes(targetAuthUser.email)) {
          return res.status(403).json({ error: "Access denied. Cannot delete a root administrator." });
        }
      } catch (err) {
        // Auth user might not exist or other error, proceed with caution
        console.warn("Could not check target user's auth email:", err);
      }

      const targetAdminDoc = await db.collection("admins").doc(userId).get();
      if (targetAdminDoc.exists) {
        return res.status(403).json({ error: "Access denied. Cannot delete an administrator account." });
      }

      // Delete from Auth
      try {
        await getAuth().deleteUser(userId);
      } catch (err: any) {
        console.error("Auth Delete Error:", err.message);
        // Continue anyway if auth delete fails? No, usually that's the main goal.
        return res.status(500).json({ error: `Auth Delete Failed: ${err.message}` });
      }

      // Delete from Firestore
      try {
        await db.collection("users").doc(userId).delete();
        await db.collection("users").doc(userId).collection("private").doc("keys").delete();

        const generations = await db.collection("generations").where("userId", "==", userId).get();
        const files = await db.collection("files").where("userId", "==", userId).get();
        const adminEntry = await db.collection("admins").doc(userId).get();

        const allDocsRefs = [...generations.docs.map(d => d.ref), ...files.docs.map(d => d.ref)];
        if (adminEntry.exists) {
          allDocsRefs.push(adminEntry.ref);
        }

        // Firestore batches support max 500 operations
        const BATCH_LIMIT = 500;
        for (let i = 0; i < allDocsRefs.length; i += BATCH_LIMIT) {
          const chunk = allDocsRefs.slice(i, i + BATCH_LIMIT);
          const currentBatch = db.batch();
          chunk.forEach(ref => currentBatch.delete(ref));
          await currentBatch.commit();
        }
      } catch (err: any) {
        console.error("Firestore Cleanup Error:", err.message);
        return res.status(500).json({ error: `Firestore Cleanup Failed: ${err.message}` });
      }

      res.json({ success: true, message: `User ${userId} thoroughly purged from system.` });
    } catch (error: any) {
      console.error("General Admin Delete Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route: List All Auth Users (for cleanup analysis)
  app.get("/api/admin/auth-users", async (req, res) => {
    try {
      const { adminId } = req.query;
      if (!adminId) return res.status(401).json({ error: "Unauthorized" });

      const db = getDb();
      let isAdmin = false;

      try {
        const adminDoc = await db.collection("admins").doc(adminId as string).get();
        if (adminDoc.exists) {
          isAdmin = true;
        }
      } catch (err: any) {
        if (err.code !== 7 && !err.message?.includes('403') && !err.message?.includes('PERMISSION_DENIED')) {
          console.error("Firestore ListAuth Check Error:", err.message);
        }
      }

      if (!isAdmin) {
        try {
          const caller = await getAuth().getUser(adminId as string);
          const hardcoded = ["ashdarji1@gmail.com", "ashishdarji88@gmail.com", "saanskarastudios@gmail.com"];
          if (caller.email && hardcoded.includes(caller.email)) {
            isAdmin = true;
          }
        } catch (err: any) {
          if (!err.message?.includes('403') && !err.message?.includes('PERMISSION_DENIED')) {
            console.error("Auth ListAuth Check Error:", err.message);
          }
        }
      }

      // If we still can't confirm admin and got restricted, just return empty list
      // rather than throwing a 403 which clutters the UI
      if (!isAdmin) {
        return res.json({ users: [], note: "IAM permissions restricted or not an admin" });
      }

      try {
        const listUsersResult = await getAuth().listUsers(1000);
        const users = listUsersResult.users.map(u => ({
          uid: u.uid,
          email: u.email,
          displayName: u.displayName,
          emailVerified: u.emailVerified,
          lastSignInTime: u.metadata.lastSignInTime,
          creationTime: u.metadata.creationTime
        }));

        res.json({ users });
      } catch (error: any) {
        // More robust check for permission errors
        const isForbidden = error.code === 'permission-denied' || 
                           error.message?.includes('403') || 
                           error.message?.includes('Identity Toolkit');
        
        if (isForbidden) {
          console.warn("Auth listUsers PERMISSION_DENIED. Returning empty user list.");
          res.json({ users: [], note: "IAM permissions restricted: listing auth users forbidden" });
        } else {
          throw error;
        }
      }
    } catch (error: any) {
      console.error("Internal List Auth Users Error:", error.message);
      res.status(error.code === 403 ? 403 : 500).json({ 
        error: "Failed to list users", 
        detail: error.message,
        code: error.code || 'unknown_error'
      });
    }
  });

  // API Route: Create Checkout Session
  app.post("/api/stripe/create-checkout-session", async (req, res) => {
    try {
      const { packId, userId, userEmail } = req.body;
      const pack = CREDIT_PACKS[packId as keyof typeof CREDIT_PACKS];
      const subscription = SUBSCRIPTION_PLANS[packId as keyof typeof SUBSCRIPTION_PLANS];

      if (!pack && !subscription || !userId) {
        return res.status(400).json({ error: "Invalid plan or user identity" });
      }

      const appUrl = req.headers.origin || req.headers.referer || "http://localhost:3000";
      const baseUrl = appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;

      const stripe = getStripe();
      const isSubscription = !!subscription;
      const plan = subscription || pack;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: plan.name,
                description: `Purchase ${plan.credits} credits ${isSubscription ? `per ${subscription.interval}` : "for generation"}.`,
              },
              unit_amount: plan.priceInCents,
              ...(isSubscription && {
                recurring: {
                  interval: subscription.interval,
                },
              }),
            },
            quantity: 1,
          },
        ],
        mode: isSubscription ? "subscription" : "payment",
        customer_email: userEmail,
        success_url: `${baseUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/?payment=cancelled`,
        metadata: {
          userId,
          packId,
          type: isSubscription ? "subscription" : "pack",
        },
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Stripe Session Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route: Verify Checkout Session
  app.post("/api/stripe/verify-session", async (req, res) => {
    try {
      const { sessionId, userId } = req.body;
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (
        (session.payment_status === "paid" || session.status === "complete") &&
        session.metadata?.userId === userId
      ) {
        const packId = session.metadata?.packId;
        const pack = CREDIT_PACKS[packId as keyof typeof CREDIT_PACKS];
        const subscription = SUBSCRIPTION_PLANS[packId as keyof typeof SUBSCRIPTION_PLANS];

        if (pack || subscription) {
          const creditsToAdd = (pack || subscription)!.credits;
          return res.json({ success: true, creditsToAdd, sessionId });
        }
      }

      res.json({ success: false, status: session.payment_status });
    } catch (error: any) {
      console.error("Stripe Session Verification Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route: Sync missing credits
  app.post("/api/stripe/sync-credits", async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const stripe = getStripe();
      const sessions = await stripe.checkout.sessions.list({ limit: 100 });

      const validSessions = sessions.data
        .filter(
          (session) =>
            (session.payment_status === "paid" || session.status === "complete") &&
            session.metadata?.userId === userId
        )
        .map((session) => {
          const packId = session.metadata?.packId;
          let creditsToAdd = 0;
          const pack = CREDIT_PACKS[packId as keyof typeof CREDIT_PACKS];
          const subscription = SUBSCRIPTION_PLANS[packId as keyof typeof SUBSCRIPTION_PLANS];
          if (pack || subscription) {
            creditsToAdd = (pack || subscription)!.credits;
          }
          return {
            sessionId: session.id,
            creditsToAdd,
          };
        })
        .filter((s) => s.creditsToAdd > 0);

      res.json({ success: true, validSessions });
    } catch (error: any) {
      console.error("Sync Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route: OpenRouter Models
  app.get("/api/ai/openrouter/models", async (req, res) => {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/models");
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("OpenRouter Models Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route: OpenRouter Proxy
  app.post("/api/ai/openrouter", async (req, res) => {
    try {
      const { model, messages, apiKey } = req.body;
      
      if (!apiKey) {
        return res.status(400).json({ error: "OpenRouter API Key is missing. Please set it in your profile." });
      }

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": req.headers.origin || req.headers.referer || "http://localhost:3000",
          "X-Title": "Velocity Blog Synth",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages
        })
      });

      const data = await response.json() as any;
      if (!response.ok) {
        throw new Error(data.error?.message || "OpenRouter Request failed");
      }

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("OpenRouter returned an empty response.");
      }

      res.json({ text: content });
    } catch (error: any) {
      console.error("OpenRouter Proxy Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route: Download Proxy
  app.get("/api/download", async (req, res) => {
    try {
      const fileUrl = req.query.url as string;
      const filename = req.query.filename as string || "download";

      if (!fileUrl) {
        return res.status(400).json({ error: "Missing url parameter" });
      }

      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }

      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
      
      const contentType = response.headers.get("content-type");
      if (contentType) res.setHeader("Content-Type", contentType);
      
      const buffer = await response.arrayBuffer();
      res.end(Buffer.from(buffer));
    } catch (error: any) {
      console.error("Download Proxy Error:", error);
      res.status(500).send("Error downloading file: " + error.message);
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*all", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
