import fs from "fs";

async function fetchModels() {
  const r = await fetch("https://openrouter.ai/api/v1/models");
  const data = await r.json();
  const videoModels = data.data.filter((m: any) => m.id.toLowerCase().includes("video") || (m.architecture?.modality || "").includes("video") || m.id.toLowerCase().includes("luma") || m.id.toLowerCase().includes("sora") || m.id.toLowerCase().includes("runway") || m.id.toLowerCase().includes("kling") || m.id.toLowerCase().includes("haiper"));
  const imageModels = data.data.filter((m: any) => m.id.toLowerCase().includes("image") || (m.architecture?.modality || "").includes("image->") || m.id.toLowerCase().includes("dall-e") || m.id.toLowerCase().includes("flux") || m.id.toLowerCase().includes("midjourney") || m.id.toLowerCase().includes("stable-diffusion"));
  
  console.log("Video models count:", videoModels.length);
  videoModels.forEach(v => console.log(v.id, v.architecture?.modality));

  console.log("Image models count:", imageModels.length);
  imageModels.forEach(v => console.log(v.id, v.architecture?.modality));
}
fetchModels();
