import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import Stripe from "stripe";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
      console.log(`Payment successful for user ${session.metadata?.userId}`);
      // In AI Studio preview environment without service accounts, we handle credit syncing locally in the browser
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
        success_url: `${baseUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
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

  // API Route: Verify Checkout Session
  app.post("/api/stripe/verify-session", async (req, res) => {
    try {
      const { sessionId, userId } = req.body;
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status === "paid" && session.metadata?.userId === userId) {
        const packId = session.metadata?.packId;
        if (packId && CREDIT_PACKS[packId as keyof typeof CREDIT_PACKS]) {
          const creditsToAdd = CREDIT_PACKS[packId as keyof typeof CREDIT_PACKS].credits;
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
        .filter(session => session.payment_status === "paid" && session.metadata?.userId === userId)
        .map(session => {
           const packId = session.metadata?.packId;
           let creditsToAdd = 0;
           if (packId && CREDIT_PACKS[packId as keyof typeof CREDIT_PACKS]) {
             creditsToAdd = CREDIT_PACKS[packId as keyof typeof CREDIT_PACKS].credits;
           }
           return {
             sessionId: session.id,
             creditsToAdd
           };
        })
        .filter(s => s.creditsToAdd > 0);

      res.json({ success: true, validSessions });
    } catch (error: any) {
      console.error("Sync Error:", error);
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
