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
  "pack-50": { credits: 50, priceInCents: 1000, name: "Starter Pack (50 Credits)" },
  "pack-200": { credits: 200, priceInCents: 2500, name: "Content Pack (200 Credits)" },
  "pack-500": { credits: 500, priceInCents: 4500, name: "Pro Pack (500 Credits)" },
  "pack-1000": { credits: 1000, priceInCents: 9900, name: "Enterprise Pack (1000 Credits)" },
};

const SUBSCRIPTION_PLANS = {
  "sub-weekly": { credits: 50, priceInCents: 700, name: "Weekly Content Tier", interval: "week" as const },
  "sub-monthly": { credits: 200, priceInCents: 1900, name: "Monthly Content Tier", interval: "month" as const },
  "sub-yearly": { credits: 1200, priceInCents: 9900, name: "Yearly Content Tier", interval: "year" as const },
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
      
      // Do not set Content-Length because fetch decompresses the response
      // leaving the original Content-Length incorrect for the piped stream,
      // which causes HTTP parse errors or stalled downloads.

      if (response.body) {
        const { Readable } = await import("stream");
        const nodeStream = Readable.fromWeb(response.body as any);
        nodeStream.pipe(res);
      } else {
        const buffer = await response.arrayBuffer();
        res.end(Buffer.from(buffer));
      }
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
