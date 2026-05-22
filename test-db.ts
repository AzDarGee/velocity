import fs from "fs";
import path from "path";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

if (!getApps().length) {
  initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID
  });
}
const db = getFirestore(process.env.VITE_FIREBASE_DATABASE_ID);

async function test() {
  try {
    const doc = await db.collection("users").doc("test-id").get();
    console.log("Success:", "Doc retrieved");
  } catch(err) {
    console.error("Error Message:", err.message);
  }
}
test();
