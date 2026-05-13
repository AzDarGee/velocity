import fs from "fs";
import path from "path";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId
  });
}
const db = getFirestore(firebaseConfig.firestoreDatabaseId);

async function test() {
  try {
    const doc = await db.collection("users").doc("test-id").get();
    console.log("Success:", "Doc retrieved");
  } catch(err) {
    console.error("Error Message:", err.message);
  }
}
test();
