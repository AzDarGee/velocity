import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import Stripe from "stripe";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize Firebase Admin
const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

let app;
if (!getApps().length) {
  app = initializeApp({
    projectId: firebaseConfig.projectId
  });
} else {
  app = getApps()[0];
}
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Stripe
const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is required but not configured.");
  }
  return new Stripe(key);
};

const CREDIT_PACKS = {
  "pack-50": { credits: 50, priceInCents: 100, name: "Starter Pack (50 Credits)" },
  "pack-200": { credits: 200, priceInCents: 100, name: "Content Pack (200 Credits)" },
  "pack-500": { credits: 500, priceInCents: 100, name: "Pro Pack (500 Credits)" },
  "pack-1000": { credits: 1000, priceInCents: 100, name: "Enterprise Pack (1000 Credits)" },
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Stripe Webhook needs raw body
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
      const userId = session.metadata?.userId;
      const packId = session.metadata?.packId;

      if (userId && packId && CREDIT_PACKS[packId as keyof typeof CREDIT_PACKS]) {
        const creditsToAdd = CREDIT_PACKS[packId as keyof typeof CREDIT_PACKS].credits;
        
        try {
          const userRef = db.collection("users").doc(userId);
          await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) {
              transaction.set(userRef, { 
                credits: creditsToAdd, 
                createdAt: FieldValue.serverTimestamp() 
              });
            } else {
              const currentCredits = userDoc.data()?.credits || 0;
              transaction.update(userRef, { credits: currentCredits + creditsToAdd });
            }
          });
          console.log(`Successfully added ${creditsToAdd} credits to user ${userId}`);
        } catch (error) {
          console.error("Error updating user credits after checkout:", error);
        }
      }
    }

    res.json({ received: true });
  });

  // Regular body parser for other routes
  app.use(express.json());

  // API Route: Create Checkout Session
  app.post("/api/stripe/create-checkout-session", async (req, res) => {
    try {
      const { packId, userId, userEmail } = req.body;
      const pack = CREDIT_PACKS[packId as keyof typeof CREDIT_PACKS];

      if (!pack || !userId) {
        return res.status(400).json({ error: "Invalid pack or user identity" });
      }

      const appUrl = req.headers.origin || req.headers.referer || "http://localhost:3000";
      // Removing trailing slash if any
      const baseUrl = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl;

      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: pack.name,
                description: `Purchase ${pack.credits} credits for generation.`,
              },
              unit_amount: pack.priceInCents,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        customer_email: userEmail,
        success_url: `${baseUrl}/?payment=success`,
        cancel_url: `${baseUrl}/?payment=cancelled`,
        metadata: {
          userId,
          packId,
        },
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Stripe Session Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route: Deduct credits (server-side verification)
  app.post("/api/credits/decrement", async (req, res) => {
    try {
      const { userId, amount = 5 } = req.body; // Default 5 credits per generation
      
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const userRef = db.collection("users").doc(userId);
      const result = await db.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) throw new Error("User record not found");
        
        const currentCredits = userDoc.data()?.credits || 0;
        if (currentCredits < amount) {
          return { success: false, error: "Insufficient credits" };
        }

        transaction.update(userRef, { credits: currentCredits - amount });
        return { success: true, remaining: currentCredits - amount };
      });

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
    const distPath = path.resolve(process.cwd(), "dist");
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
