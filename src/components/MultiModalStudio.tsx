<<<<<<< Updated upstream
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Image as ImageIcon, Video, Music, Wand2, Upload, Settings2, Download, RefreshCw, X, Play, Sparkles, BookOpen, Trash2, AlertCircle, Check } from 'lucide-react';

interface MultiModalStudioProps {
  theme: 'light' | 'dark';
  onAddAssetToNarrative?: (asset: MediaAsset) => void;
  credits: number;
  userId: string;
  isAdmin: boolean;
}

const GENERATION_COSTS: Record<GenerationMode, number> = {
  image: 10,
  video: 40,
  music: 40
};

type GenerationMode = 'image' | 'video' | 'music';

export interface MediaAsset {
  id: string;
  type: 'image' | 'video' | 'audio';
  source: 'uploaded' | 'generated';
  name: string;
  url?: string;
  model?: string;
  timestamp: string;
  metadata?: any;
}

const DEFAULT_STYLES = [
  "Pop", "Rock", "Hip Hop", "R&B", "Country", 
  "Jazz", "Classical", "Electronic", "Dance", "Folk",
  "Acoustic", "Blues", "Soul", "Funk", "Disco",
  "Reggae", "Latin", "Metal", "Punk", "Indie Rock",
  "Alternative", "Synthwave", "Ambient", "Cinematic", "Lo-Fi",
  "Trap", "EDM", "House", "Techno", "K-Pop"
];

export function MultiModalStudio({ theme, onAddAssetToNarrative, credits, userId, isAdmin }: MultiModalStudioProps) {
  const [activeMode, setActiveMode] = useState<GenerationMode>('image');
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<string>("16:9");
  const [resolution, setResolution] = useState<string>("1080p");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sunoCustomMode, setSunoCustomMode] = useState(false);
  const [sunoInstrumental, setSunoInstrumental] = useState(false);
  const [sunoModel, setSunoModel] = useState("V4_5ALL");
  const [sunoStyles, setSunoStyles] = useState<string[]>([]);
  const [customStyles, setCustomStyles] = useState<string[]>([]);
  const [newStyle, setNewStyle] = useState("");
  const [sunoTitle, setSunoTitle] = useState("");
  const [sunoPersonaId, setSunoPersonaId] = useState("");
  const [sunoPersonaModel, setSunoPersonaModel] = useState("");
  const [sunoNegativeTags, setSunoNegativeTags] = useState("");
  const [sunoVocalGender, setSunoVocalGender] = useState("");
  const [sunoStyleWeight, setSunoStyleWeight] = useState<number>(0.65);
  const [sunoWeirdnessConstraint, setSunoWeirdnessConstraint] = useState<number>(0.65);
  const [sunoAudioWeight, setSunoAudioWeight] = useState<number>(0.65);
  const [isAutoPrompting, setIsAutoPrompting] = useState(false);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [coverGeneratingAssets, setCoverGeneratingAssets] = useState<Set<string>>(new Set());
  const [lyricsLoadingAssets, setLyricsLoadingAssets] = useState<Set<string>>(new Set());
  const [viewingCover, setViewingCover] = useState<MediaAsset | null>(null);
  const [viewingAssetDetails, setViewingAssetDetails] = useState<MediaAsset | null>(null);
  const [viewingLyrics, setViewingLyrics] = useState<MediaAsset | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<MediaAsset | null>(null);

  useEffect(() => {
    if (!userId) return;
    
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;
    
    const fetchAssets = async () => {
      try {
        const { db, handleFirestoreError, OperationType } = await import('../lib/firebase');
        const { collection, query, orderBy, onSnapshot } = await import('firebase/firestore');
        const assetsRef = collection(db, 'users', userId, 'media_assets');
        const q = query(assetsRef, orderBy('timestamp', 'desc'));
        
        unsubscribe = onSnapshot(q, (snapshot) => {
          if (!isMounted) return;
          const loaded: MediaAsset[] = [];
          snapshot.forEach(doc => {
            loaded.push(doc.data() as MediaAsset);
          });
          setAssets(loaded);
        }, (error) => {
           // Provide a fallback silent error handle if permission initially denied, 
           // though we should throw to the ErrorBoundary if intended. For assets we might just log and fail silently.
           console.error("Firestore Error in Assets:", error);
           // handleFirestoreError(error, OperationType.LIST, `users/${userId}/media_assets`);
        });
      } catch (err) {
        console.error("Failed to set up assets listener:", err);
      }
    };
    
    fetchAssets();
    
    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [userId]);

  const handleAutoPrompt = async () => {
    if (isAutoPrompting || isGenerating) return;
    setIsAutoPrompting(true);
    setError(null);
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const apiKey = (process.env as any).GEMINI_API_KEY || (process.env as any).API_KEY;
      if (!apiKey) throw new Error("Gemini API Key is required for auto-prompting.");
      
      const genAI = new GoogleGenAI({ apiKey });
      
      let systemPrompt = "You are a creative prompt engineer. ";
      if (activeMode === 'image') systemPrompt += "Generate a highly detailed and descriptive prompt for an image generation model. Focus on composition, lighting, subject matter, style, and mood.";
      else if (activeMode === 'video') systemPrompt += "Generate a highly detailed, cinematic prompt for a video generation model (like Veo). Describe the scene, the motion, the camera movement, the lighting, and the overall atmosphere.";
      else if (activeMode === 'music') {
        if (sunoCustomMode) systemPrompt += "Generate creative lyrics with musical direction tags (like [Verse], [Chorus]) for a custom music generation model.";
        else systemPrompt += "Generate a creative and evocative prompt for a music generation model. Describe the genre, instrumentation, tempo, mood, and any lyrical themes.";
      }
      
      systemPrompt += ` Only return the prompt text, nothing else. If the user already provided some text, enhance and expand upon it: "${prompt || 'Surprise me'}"`;

      const response = await genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
      });
      
      const newPrompt = response.text?.trim() || "";
      if (newPrompt) setPrompt(newPrompt);
    } catch (err: any) {
      console.error("Auto prompt error:", err);
      setError(err.message || "Failed to generate prompt.");
    } finally {
      setIsAutoPrompting(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setError(null);

    const cost = GENERATION_COSTS[activeMode];
    if (!isAdmin && credits < cost) {
      setError(`Insufficient Credits: Generation requires ${cost} credits. You have ${credits}.`);
      return;
    }

    setIsGenerating(true);

    const startTime = Date.now();

    let finalUrl: string | undefined = undefined;
    let modelUsed = "";
    let finalMetadata: any = { prompt };

    try {
      if (!isAdmin) {
        // Deduct credits via Firestore transaction
        // Importing db here to avoid dependency issues if needed, but it's better to expect it in lib/firebase
        const { db, handleFirestoreError, OperationType } = await import('../lib/firebase');
        const { doc, runTransaction, collection, serverTimestamp } = await import('firebase/firestore');
        
        await runTransaction(db, async (transaction) => {
          const userRef = doc(db, 'users', userId);
          const userDoc = await transaction.get(userRef);
          if (!userDoc.exists()) throw new Error("User record not found");
          const currentCredits = userDoc.data().credits || 0;
          if (currentCredits < cost) throw new Error(`Insufficient credits`);
          
          transaction.update(userRef, { credits: currentCredits - cost });
          
          // Log activity
          const activityRef = doc(collection(db, 'users', userId, 'activity'));
          transaction.set(activityRef, {
            type: `${activeMode}_generation`,
            description: `${activeMode.charAt(0).toUpperCase() + activeMode.slice(1)} Synthesis`,
            cost: cost,
            timestamp: serverTimestamp(),
            metadata: {
              prompt: prompt.substring(0, 500)
            }
          });
        }).catch(err => {
          handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
          throw err;
        });
      }

      if (activeMode === 'music') {
        const apiKey = (import.meta as any).env.VITE_SUNO_API_KEY;
        if (!apiKey) {
          throw new Error('VITE_SUNO_API_KEY environment variable is required to generate music with Suno AI.');
        }
        modelUsed = "Suno AI";
        const payload: any = {
          prompt: prompt,
          customMode: sunoCustomMode,
          instrumental: sunoInstrumental,
          model: sunoModel,
          title: sunoTitle || "Generated Track",
          style: sunoStyles.join(", ") || (sunoInstrumental ? "Instrumental" : ""),
          callBackUrl: window.location.origin + "/api/suno-callback",
          wait_audio: true 
        };

        if (sunoPersonaId) payload.personaId = sunoPersonaId;
        if (sunoPersonaModel) payload.personaModel = sunoPersonaModel;
        if (sunoNegativeTags) payload.negativeTags = sunoNegativeTags;
        if (sunoVocalGender) payload.vocalGender = sunoVocalGender;
        if (sunoStyleWeight !== 0.65) payload.styleWeight = sunoStyleWeight;
        if (sunoWeirdnessConstraint !== 0.65) payload.weirdnessConstraint = sunoWeirdnessConstraint;
        if (sunoAudioWeight !== 0.65) payload.audioWeight = sunoAudioWeight;

        const response = await fetch('https://api.sunoapi.org/api/v1/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Suno AI Music Generation failed: ${errText}`);
        }

        const jsonRes = await response.json();
        
        if (jsonRes.code && jsonRes.code !== 200) {
           throw new Error(`Suno AI Music Generation failed: ${jsonRes.msg || JSON.stringify(jsonRes)}`);
        }

        let sunoItem = null;
        
        // Check if initial response already contains audio data (since wait_audio: true was used)
        const initialItems = jsonRes?.data?.response?.sunoData || jsonRes?.data?.sunoData || jsonRes?.sunoData || (Array.isArray(jsonRes.data) ? jsonRes.data : null);
        if (Array.isArray(initialItems) && initialItems.length > 0) {
            const potentialItem = initialItems[0];
            if (potentialItem.audioUrl || potentialItem.streamAudioUrl || potentialItem.audio_url || potentialItem.url) {
                sunoItem = potentialItem;
            }
        }

        const taskId = jsonRes?.data?.taskId || jsonRes?.taskId || (Array.isArray(jsonRes.data) && jsonRes.data[0]?.task_id) || jsonRes?.data?.task_id || jsonRes?.data?.id || jsonRes?.id;

        if (!sunoItem && taskId) {
            let attempts = 0;
            while(attempts < 180) { // 6 minutes max (Suno can sometimes be slow for high quality)
               await new Promise(r => setTimeout(r, 2000));
               const statusRes = await fetch(`https://api.sunoapi.org/api/v1/generate/record-info?taskId=${taskId}`, {
                   headers: {
                      'Authorization': `Bearer ${apiKey}`
                   }
               });
               if (!statusRes.ok) {
                   attempts++;
                   continue;
               }
               const statusData = await statusRes.json();
               const status = statusData?.data?.status || statusData?.status;
               
               if (status === 'SUCCESS' || status === 'COMPLETED') {
                   const items = statusData?.data?.response?.sunoData || statusData?.data?.sunoData || statusData?.sunoData || (Array.isArray(statusData.data) ? statusData.data : null);
                   if (Array.isArray(items) && items.length > 0) {
                       sunoItem = items[0];
                       // Ensure it has an audio URL before stopping
                       if (sunoItem.audioUrl || sunoItem.streamAudioUrl || sunoItem.audio_url || sunoItem.url) {
                           break;
                       }
                   }
               } else if (status && (status.includes('FAIL') || status.includes('ERROR') || status.includes('EXCEPTION'))) {
                   throw new Error(`Suno AI generation failed with status: ${status}. Message: ${statusData?.data?.errorMessage || statusData?.message || 'Unknown error'}`);
               }
               attempts++;
            }
        }

        if (!sunoItem || (!sunoItem.audioUrl && !sunoItem.streamAudioUrl && !sunoItem.audio_url && !sunoItem.url)) {
             throw new Error("Timeout or could not find audio metadata in Suno AI task results.");
        }

        const audioUrl = sunoItem.audioUrl || sunoItem.streamAudioUrl || sunoItem.audio_url || sunoItem.url;
        
        finalMetadata = { prompt, task_id: taskId, ...sunoItem };

        const audioRes = await fetch(audioUrl);
        if (!audioRes.ok) throw new Error("Failed to download generated audio from Suno URL");
        let blob = await audioRes.blob();

        try {
            const imageUrl = sunoItem.image_large_url || sunoItem.image_url || sunoItem.imageUrl || sunoItem.imageLargeUrl;
            if (imageUrl) {
                const imageRes = await fetch(imageUrl, {
                    // Important for remote images that might not have CORS explicitly set for JS but wait, it's suno
                });
                if (imageRes.ok) {
                    const imageBuffer = await imageRes.arrayBuffer();
                    const audioBuffer = await blob.arrayBuffer();
                    
                    const ID3WriterModule = await import('browser-id3-writer');
                    const ID3Writer = ID3WriterModule.default || (ID3WriterModule as any);
                    const titleToUse = sunoTitle || sunoItem.title || "Generated Track";
                    
                    const writer = new (ID3Writer as any)(audioBuffer);
                    writer.setFrame('TIT2', titleToUse)
                          .setFrame('TPE1', ['Media Studio AI'])
                          .setFrame('APIC', {
                              type: 3,
                              data: imageBuffer,
                              description: 'Front cover'
                          });
                    writer.addTag();
                    const taggedBuffer = writer.arrayBuffer;
                    blob = new Blob([taggedBuffer], { type: 'audio/mpeg' });
                    
                    finalMetadata.coverUrl = imageUrl;
                }
            }
        } catch (id3Err) {
            console.error("Failed to write ID3 metadata:", id3Err);
        }

        finalUrl = URL.createObjectURL(blob);
      } else if (activeMode === 'image' || activeMode === 'video') {
        const { GoogleGenAI } = await import("@google/genai");
        
        // Paid model check
        if (typeof (window as any).aistudio !== 'undefined') {
          const hasKey = await (window as any).aistudio.hasSelectedApiKey();
          if (!hasKey) {
            await (window as any).aistudio.openSelectKey();
          }
        }
        
        // Ensure we use the most up-to-date API key (often GEMINI_API_KEY or API_KEY in this env)
        const apiKey = (process.env as any).GEMINI_API_KEY || (process.env as any).API_KEY;
        if (!apiKey) throw new Error("Gemini API Key is required for synthesis.");
        const genAI = new GoogleGenAI({ apiKey });

        if (activeMode === 'image') {
          modelUsed = "Imagen 3.0";
          const response = await genAI.models.generateContent({
            model: "imagen-3.0-generate-002",
            contents: [{ parts: [{ text: prompt }] }],
            config: {
              imageConfig: {
                 aspectRatio: aspectRatio as any,
              }
            }
          });
          
          console.log("Image generation response:", JSON.stringify(response));
          const imagePart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
          if (imagePart?.inlineData?.data) {
            finalUrl = `data:image/png;base64,${imagePart.inlineData.data}`;
          } else {
            console.error("Image generation failed, response:", JSON.stringify(response));
            throw new Error("No image data returned. Ensure Imagen API is enabled.");
          }
        } else if (activeMode === 'video') {
          modelUsed = "Veo 3.1";
          let operation = await genAI.models.generateVideos({
            model: 'veo-3.1-generate-preview',
            prompt: prompt,
            config: {
              numberOfVideos: 1,
              resolution: resolution as any,
              aspectRatio: aspectRatio as any
            }
          });

          // Polling for video completion
          while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await genAI.operations.getVideosOperation({ operation });
          }

          const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
          if (!downloadLink) throw new Error("Video synthesis failed to return a valid stream URI.");

          // Fetch video using API key in header as per skill guidelines
          const videoResponse = await fetch(downloadLink, {
            method: 'GET',
            headers: {
              'x-goog-api-key': apiKey,
            },
          });

          if (!videoResponse.ok) throw new Error("Failed to secure kinetic stream from synthesized URI.");
          const blob = await videoResponse.blob();
          finalUrl = URL.createObjectURL(blob);
        }
      }
      
      const endTime = Date.now();
      finalMetadata.generationTimeMs = endTime - startTime;

      let assetName = `${activeMode}_generation_${prompt.substring(0, 10).replace(/[^a-zA-Z0-9_\-]/g, "")}.${activeMode === 'music' ? 'mp3' : activeMode === 'image' ? 'png' : 'mp4'}`;
      if (activeMode === 'music') {
        const titleToUse = sunoTitle || finalMetadata.title;
        if (titleToUse && titleToUse !== 'Generated Track') {
           assetName = `${titleToUse.replace(/[^a-zA-Z0-9_\- ]/g, "").trim().replace(/ /g, "_")}.mp3`;
        }
      }

      const newAsset: MediaAsset = {
        id: `gen-${Math.random().toString(36).substr(2, 9)}`,
        type: activeMode === 'music' ? 'audio' : activeMode,
        source: 'generated',
        name: assetName,
        model: modelUsed,
        timestamp: new Date().toISOString(),
        metadata: finalMetadata,
        url: finalUrl
      };
      
      let storageUrl = finalUrl;
      const { db, storage } = await import('../lib/firebase');
      const { doc, setDoc } = await import('firebase/firestore');
      const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
      
      try {
        if (finalUrl) {
          const fetchRes = await fetch(finalUrl);
          const finalBlob = await fetchRes.blob();
          const storageRef = ref(storage, `uploads/generated/${userId}/${newAsset.id}_${newAsset.name}`);
          
          await uploadBytes(storageRef, finalBlob, { contentType: finalBlob.type });
          storageUrl = await getDownloadURL(storageRef);
          
      // Add size to metadata
          newAsset.metadata = {
            ...newAsset.metadata,
            fileSize: finalBlob.size,
            imageUrl: storageUrl // Ensure imageUrl is added for image mode
          };
          
          // Revoke the local object URL to prevent memory leaks now that we have it requested
          if (finalUrl.startsWith('blob:')) {
             URL.revokeObjectURL(finalUrl);
          }
        }
        
        newAsset.url = storageUrl;

        const assetRef = doc(db, 'users', userId, 'media_assets', newAsset.id);
        const assetData = { ...newAsset, userId };
        await setDoc(assetRef, assetData);
      } catch (err) {
        console.error("Failed to save asset to database:", err);
      }
      
      setPrompt("");
    } catch (err: any) {
      console.error(`Generation error (${activeMode}):`, err);
      setError(err.message || "An unexpected error occurred during synthesis.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateCover = async (asset: MediaAsset) => {
    console.log("handleGenerateCover clicked for:", asset.id, "Metadata:", asset.metadata);
    if (asset.type !== 'audio' || (!asset.metadata?.task_id && !asset.metadata?.taskId)) {
      console.log("handleGenerateCover skipped: audio check or task_id missing", asset.type, asset.metadata);
      return;
    }
    
    setCoverGeneratingAssets(prev => new Set(prev).add(asset.id));
    setError(null);

    try {
      const prompt = `Generate a high quality, square cover art for a song. There should be no text on the image. Song metadata: ${asset.metadata?.prompt || asset.name}. Lyrics: ${asset.metadata?.lyrics || 'No lyrics provided'}`;
      
      const { GoogleGenAI } = await import("@google/genai");
      const apiKey = (process.env as any).GEMINI_API_KEY || (process.env as any).API_KEY;
      if (!apiKey) throw new Error("Gemini API Key is required.");
      
      const genAI = new GoogleGenAI({ apiKey });
      
      const response = await genAI.models.generateContent({
        model: "imagen-3.0-generate-002",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          imageConfig: {
             numberOfImages: 1,
             outputMimeType: "image/png",
          }
        }
      });
      
      const imagePart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
      
      if (!imagePart?.inlineData?.data) {
        throw new Error("No image data returned. Ensure the model supports image generation.");
      }
      
      // Upload raw image to Storage
      const { db, storage } = await import('../lib/firebase');
      const { ref, uploadString, getDownloadURL } = await import('firebase/storage');
      const { doc, updateDoc } = await import('firebase/firestore');

      const path = `uploads/generated/${userId}/${asset.id}_cover.png`;
      const storageRef = ref(storage, path);
      
      // Upload using base64 string
      const uploadResult = await uploadString(storageRef, imagePart.inlineData.data, 'base64', {
        contentType: 'image/png'
      });
      
      const imageUrl = await getDownloadURL(storageRef);
      const coverSize = uploadResult.metadata.size;
      
      // userId is required here; hopefully it's available in the component scope
      const assetRef = doc(db, 'users', userId, 'media_assets', asset.id);

      // Now attach cover to the actual MP3 file using browser-id3-writer
      if (asset.url) {
        try {
            const { getBytes, uploadBytes } = await import('firebase/storage');
            
            // asset.url is the download URL which can be parsed by `ref` directly
            const audioStorageRef = ref(storage, asset.url);
            const audioBuffer = await getBytes(audioStorageRef);
                
            // Convert base64 to ArrayBuffer for ID3Writer
            const binaryString = window.atob(imagePart.inlineData.data);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const imageBuffer = bytes.buffer;

            const ID3WriterModule = await import('browser-id3-writer');
            const ID3Writer = ID3WriterModule.default || (ID3WriterModule as any);
            const titleToUse = asset.metadata?.title || asset.name.replace('.mp3', '') || "Generated Track";
            
            const writer = new (ID3Writer as any)(audioBuffer);
            writer.setFrame('TIT2', titleToUse)
                  .setFrame('TPE1', ['Media Studio AI'])
                  .setFrame('APIC', {
                      type: 3,
                      data: imageBuffer,
                      description: 'Front cover'
                  });
            writer.addTag();
            const taggedBuffer = writer.arrayBuffer;
            const taggedBlob = new Blob([taggedBuffer], { type: 'audio/mpeg' });

            await uploadBytes(audioStorageRef, taggedBlob, { contentType: 'audio/mpeg' });
            // Note: The URL might not change visually but it's safe to keep using the existing one.
        } catch (id3Err) {
            console.error("Failed to write ID3 metadata for updated cover:", id3Err);
        }
      }

      try {
        await updateDoc(assetRef, {
          userId: userId,
          'metadata.coverUrl': imageUrl,
          'metadata.coverSize': coverSize
        });
      } catch (updateErr) {
        // Log this specifically to separate from storage errors
        console.error("Firestore updateDoc error:", updateErr);
        const { handleFirestoreError, OperationType } = await import('../lib/firebase');
        if (handleFirestoreError) {
           handleFirestoreError(updateErr, OperationType.UPDATE, assetRef.path);
        }
        throw updateErr;
      }
      
      // Update local assets state
      setAssets(prev => prev.map(a => a.id === asset.id ? {...a, metadata: {...a.metadata, coverUrl: imageUrl, coverSize}} : a));

      // Notify completion
      setError("Cover art generated and attached to track!");
      setTimeout(() => setError(null), 3000);

    } catch (err: any) {
      console.error("Cover generation error:", err);
      setError(err.message || "Failed to generate cover.");
    } finally {
      setCoverGeneratingAssets(prev => {
        const next = new Set(prev);
        next.delete(asset.id);
        return next;
      });
    }
  };

  const handleFetchTimestampedLyrics = async (asset: MediaAsset) => {
    console.log("handleFetchTimestampedLyrics clicked for:", asset.id, "Metadata:", asset.metadata);
    
    // The asset metadata is where the task_id and id should be
    const taskId = asset.metadata?.task_id || asset.metadata?.taskId;
    const audioId = asset.metadata?.id || asset.metadata?.audioId;
    
    if (asset.type !== 'audio' || !taskId) {
       console.log("handleFetchTimestampedLyrics skipped: audio check or task_id missing", asset.type, taskId, asset.metadata);
       return;
    }
    
    if (!audioId) {
      console.log("handleFetchTimestampedLyrics skipped: audioId missing", asset.metadata);
      return;
    }

    // If we already have them, just show them
    if (asset.metadata?.timestampedLyrics) {
      setViewingLyrics(asset);
      return;
    }

    setLyricsLoadingAssets(prev => new Set(prev).add(asset.id));
    setError(null);

    try {
      const apiKey = (import.meta as any).env.VITE_SUNO_API_KEY;
      if (!apiKey) throw new Error('VITE_SUNO_API_KEY is required for lyrics');

      const response = await fetch('https://api.sunoapi.org/api/v1/generate/get-timestamped-lyrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          taskId: taskId,
          audioId: audioId
        })
      });

      if (!response.ok) throw new Error(`Lyric fetch failed: ${await response.text()}`);
      
      const jsonRes = await response.json();
      const lyricsData = jsonRes?.data?.response || jsonRes?.data || jsonRes;

      if (!lyricsData || (!lyricsData.lyrics && !lyricsData.segments)) {
         setError("No lyrics found for this track - it might be an instrumental.");
         setTimeout(() => setError(null), 3000);
         
         const { db } = await import('../lib/firebase');
         const { doc, updateDoc } = await import('firebase/firestore');
         const assetRef = doc(db, 'users', userId, 'media_assets', asset.id);
         await updateDoc(assetRef, {
           userId: userId,
           'metadata.timestampedLyrics': 'Instrumental / No Lyrics'
         });
         setAssets(prev => prev.map(a => a.id === asset.id ? {...a, metadata: {...a.metadata, timestampedLyrics: 'Instrumental / No Lyrics'}} : a));
         
         return;
      }

      // Update Firestore
      const { db } = await import('../lib/firebase');
      const { doc, updateDoc } = await import('firebase/firestore');
      const assetRef = doc(db, 'users', userId, 'media_assets', asset.id);
      
      await updateDoc(assetRef, {
        userId: userId,
        'metadata.timestampedLyrics': lyricsData
      });

      setViewingLyrics({
        ...asset,
        metadata: {
          ...asset.metadata,
          timestampedLyrics: lyricsData
        }
      });

    } catch (err: any) {
      console.error("Lyrics fetch error:", err);
      setError(err.message || "Failed to retrieve temporal lyrics.");
    } finally {
      setLyricsLoadingAssets(prev => {
        const next = new Set(prev);
        next.delete(asset.id);
        return next;
      });
    }
  };

  const executeDeleteAsset = async (asset: MediaAsset) => {
    if (!userId) return;
    try {
      const { db, storage } = await import('../lib/firebase');
      const { doc, deleteDoc } = await import('firebase/firestore');
      const { ref, deleteObject } = await import('firebase/storage');
      
      const assetRef = doc(db, 'users', userId, 'media_assets', asset.id);
      await deleteDoc(assetRef);
      
      if (asset.source === 'generated') {
        try {
          const storageRef = ref(storage, `uploads/generated/${userId}/${asset.id}_${asset.name}`);
          await deleteObject(storageRef);
        } catch (storageErr) {
          console.error("Failed to delete main asset from storage.", storageErr);
        }
        if (asset.metadata?.coverUrl || asset.type === 'audio') {
          try {
            const coverRef = ref(storage, `uploads/generated/${userId}/${asset.id}_cover.png`);
            await deleteObject(coverRef);
          } catch (storageErr) {
            console.error("Failed to delete cover art from storage.", storageErr);
          }
        }
      }
    } catch (err) {
      console.error("Failed to delete asset:", err);
    }
    setAssetToDelete(null);
  };

  const getModelBadgeColors = (type: GenerationMode) => {
    switch (type) {
      case 'image': return 'from-purple-500 to-indigo-600 border-indigo-500 text-indigo-50';
      case 'video': return 'from-teal-400 to-cyan-600 border-teal-500 text-cyan-50';
      case 'music': return 'from-amber-400 to-orange-600 border-orange-500 text-orange-50';
      default: return 'from-gray-500 to-gray-700';
    }
  };

  const getBorderColor = (asset: MediaAsset) => {
    if (asset.source === 'uploaded') return theme === 'dark' ? 'border-[#333]' : 'border-gray-200';
    if (asset.type === 'image') return 'border-indigo-500 shadow-[0_0_15px_-3px_rgba(99,102,241,0.3)]';
    if (asset.type === 'video') return 'border-teal-500 shadow-[0_0_15px_-3px_rgba(20,184,166,0.3)]';
    if (asset.type === 'audio') return 'border-orange-500 shadow-[0_0_15px_-3px_rgba(249,115,22,0.3)]';
    return '';
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  return (
    <div className={`flex flex-col h-full ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
      {/* Studio Header */}
      <div className={`p-3 md:p-6 border-b ${theme === 'dark' ? 'border-[#333]' : 'border-gray-200'} flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4`}>
        <div>
          <h2 className="text-lg md:text-2xl font-black uppercase tracking-tight italic leading-none">Synthesis Studio</h2>
          <p className="text-[8px] md:text-xs font-mono opacity-60 uppercase tracking-widest mt-1">Multi-Modal Environment</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none no-scrollbar">
          {(['image', 'video', 'music'] as GenerationMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setActiveMode(mode)}
              className={`px-3 md:px-4 py-1.5 md:py-2 border-2 text-[10px] md:text-sm font-bold uppercase transition-all flex items-center gap-2 shrink-0 ${
                activeMode === mode 
                  ? theme === 'dark' ? 'border-white bg-white text-black' : 'border-black bg-black text-white'
                  : theme === 'dark' ? 'border-[#333] hover:border-gray-500' : 'border-gray-200 hover:border-gray-400'
              }`}
            >
              {mode === 'image' && <ImageIcon className="w-3 h-3 md:w-4 md:h-4" />}
              {mode === 'video' && <Video className="w-3 h-3 md:w-4 md:h-4" />}
              {mode === 'music' && <Music className="w-3 h-3 md:w-4 md:h-4" />}
              <span className={mode === activeMode ? 'inline' : 'hidden md:inline'}>{mode}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Left Console - Generation controls */}
        <div className={`w-full lg:w-1/3 border-b lg:border-b-0 lg:border-r ${theme === 'dark' ? 'border-[#333] bg-[#0A0A0A]' : 'border-gray-200 bg-gray-50'} p-4 md:p-6 flex flex-col lg:h-auto max-h-[100vh] lg:max-h-none`}>
          <div className="flex items-center gap-2 mb-4 md:mb-6 shrink-0">
            <Wand2 className="w-4 h-4 md:w-5 md:h-5 opacity-60" />
            <h3 className="font-bold uppercase tracking-widest text-[10px] md:text-sm">Composer Parameters</h3>
          </div>

          <div className="flex-1 space-y-4 md:space-y-6 overflow-y-auto min-h-0 pr-1 md:pr-4 history-scrollbar">
            {error && (
              <div className="p-4 border-2 border-red-500/20 bg-red-500/5 text-red-500 text-[10px] font-mono flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            
            {/* Mock Advanced Settings based on mode */}
            <div className={`p-4 border ${theme === 'dark' ? 'border-[#333] bg-black/20' : 'border-gray-200 bg-white'}`}>
              <div className="flex items-center gap-2 mb-4">
                <Settings2 className="w-4 h-4 opacity-50" />
                <span className="text-xs uppercase font-bold tracking-widest">Model Config</span>
              </div>
              
              <div className="space-y-4">
                {activeMode === 'image' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase font-mono opacity-60 mb-1 block">Aspect Ratio</label>
                      <select 
                        value={aspectRatio}
                        onChange={e => setAspectRatio(e.target.value)}
                        disabled={isGenerating}
                        className={`w-full p-2 border text-xs font-mono ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333]' : 'bg-gray-50 border-gray-200'} ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <option value="1:1">1:1 Square</option>
                        <option value="4:3">4:3 Ratio</option>
                        <option value="3:4">3:4 Ratio</option>
                        <option value="16:9">16:9 Wide</option>
                        <option value="9:16">9:16 Vertical</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-mono opacity-60 mb-1 block">Style</label>
                      <select 
                        disabled={isGenerating}
                        className={`w-full p-2 border text-xs font-mono ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333]' : 'bg-gray-50 border-gray-200'} ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <option>Photorealistic</option>
                        <option>Cinematic</option>
                        <option>Digital Art</option>
                      </select>
                    </div>
                  </div>
                )}
                
                {activeMode === 'video' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase font-mono opacity-60 mb-1 block">Aspect Ratio</label>
                      <select 
                        value={aspectRatio === '1:1' ? '16:9' : aspectRatio} // Veo prefers 16:9 or 9:16
                        onChange={e => setAspectRatio(e.target.value)}
                        disabled={isGenerating}
                        className={`w-full p-2 border text-xs font-mono ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333]' : 'bg-gray-50 border-gray-200'} ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <option value="16:9">16:9 Landscape</option>
                        <option value="9:16">9:16 Portrait</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-mono opacity-60 mb-1 block">Resolution</label>
                      <select 
                        value={resolution}
                        onChange={e => setResolution(e.target.value)}
                        disabled={isGenerating}
                        className={`w-full p-2 border text-xs font-mono ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333]' : 'bg-gray-50 border-gray-200'} ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <option value="720p">720p HD</option>
                        <option value="1080p">1080p Full HD</option>
                        <option value="4k">4K Ultra HD</option>
                      </select>
                    </div>
                  </div>
                )}
                
                {activeMode === 'music' && (
                  <div className="flex flex-col gap-8 mt-2">
                    {/* Primary Controls */}
                    <div className={`p-5 border-2 transition-colors ${theme === 'dark' ? 'bg-[#141414] border-[#333]' : 'bg-gray-50/50 border-gray-200'}`}>
                      <div className="flex flex-col gap-5 mb-5">
                        <div>
                          <label className="text-[10px] uppercase font-mono opacity-60 mb-2 block tracking-wider">Model</label>
                          <select 
                            value={sunoModel}
                            onChange={e => setSunoModel(e.target.value)}
                            disabled={isGenerating}
                            className={`w-full p-2.5 border text-[11px] font-mono outline-none cursor-pointer ${theme === 'dark' ? 'bg-[#0A0A0A] border-[#333] text-[#F8F8F7]' : 'bg-white border-gray-300 text-black'} ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <option value="V5_5">V5.5 Customized</option>
                            <option value="V5">V5 Latest</option>
                            <option value="V4_5ALL">V4.5 ALL</option>
                            <option value="V4_5PLUS">V4.5 PLUS</option>
                            <option value="V4_5">V4.5</option>
                            <option value="V4">V4 Improved</option>
                          </select>
                        </div>
                        <div className="flex flex-wrap items-center gap-6">
                          <label className={`flex items-center gap-2 group ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                            <input 
                              type="checkbox" 
                              checked={sunoCustomMode}
                              onChange={e => setSunoCustomMode(e.target.checked)}
                              disabled={isGenerating}
                              className={`w-4 h-4 cursor-pointer accent-black ${theme === 'dark' ? 'bg-black border-[#333]' : ''} ${isGenerating ? 'cursor-not-allowed' : ''}`}
                            />
                            <span className="text-[11px] font-bold uppercase tracking-widest group-hover:opacity-100 opacity-80 transition-opacity">Custom Mode</span>
                          </label>
                          <label className={`flex items-center gap-2 group ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                            <input 
                              type="checkbox" 
                              checked={sunoInstrumental}
                              onChange={e => setSunoInstrumental(e.target.checked)}
                              disabled={isGenerating}
                              className={`w-4 h-4 cursor-pointer accent-black ${theme === 'dark' ? 'bg-black border-[#333]' : ''} ${isGenerating ? 'cursor-not-allowed' : ''}`}
                            />
                            <span className="text-[11px] font-bold uppercase tracking-widest group-hover:opacity-100 opacity-80 transition-opacity">Instrumental</span>
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-5 pt-5 border-t border-current/10">
                        <div>
                          <label className="text-[10px] uppercase font-mono opacity-60 mb-2 block tracking-wider">Song Title</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Neon Horizon"
                            value={sunoTitle}
                            onChange={e => setSunoTitle(e.target.value)}
                            disabled={isGenerating}
                            className={`w-full p-2.5 border text-[11px] font-mono outline-none focus:border-current transition-colors ${theme === 'dark' ? 'bg-[#0A0A0A] border-[#333] placeholder-[#555]' : 'bg-white border-gray-300 placeholder-gray-400'} ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                          />
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-[10px] uppercase font-mono opacity-60 tracking-wider">Style / Genre [{sunoStyles.length}]</label>
                            {sunoStyles.length > 0 && (
                              <button 
                                onClick={() => setSunoStyles([])}
                                className={`text-[9px] font-mono hover:opacity-100 opacity-60 uppercase transition-opacity ${theme === 'dark' ? 'text-white' : 'text-black'}`}
                              >
                                De-select All
                              </button>
                            )}
                          </div>
                          <div className={`flex gap-2 mb-2 ${isGenerating ? 'opacity-50' : ''}`}>
                            <input 
                              type="text"
                              value={newStyle}
                              onChange={(e) => setNewStyle(e.target.value)}
                              disabled={isGenerating}
                              placeholder="Add custom style (comma-separated)..."
                              className={`flex-1 p-2.5 border text-[11px] font-mono outline-none focus:border-current transition-colors ${theme === 'dark' ? 'bg-[#0A0A0A] border-[#333] placeholder-[#555]' : 'bg-white border-gray-300 placeholder-gray-400'} ${isGenerating ? 'cursor-not-allowed' : ''}`}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && newStyle.trim() && !isGenerating) {
                                  e.preventDefault();
                                  const vals = newStyle.split(',').map(v => v.trim()).filter(Boolean);
                                  let addedStyles = [...customStyles];
                                  let selectedStyles = [...sunoStyles];
                                  vals.forEach(val => {
                                    if (!addedStyles.includes(val) && !DEFAULT_STYLES.includes(val)) {
                                      addedStyles = [val, ...addedStyles];
                                    }
                                    if (!selectedStyles.includes(val)) {
                                      selectedStyles = [...selectedStyles, val];
                                    }
                                  });
                                  setCustomStyles(addedStyles);
                                  setSunoStyles(selectedStyles);
                                  setNewStyle("");
                                }
                              }}
                            />
                            <button 
                              onClick={() => {
                                if (newStyle.trim()) {
                                  const vals = newStyle.split(',').map(v => v.trim()).filter(Boolean);
                                  let addedStyles = [...customStyles];
                                  let selectedStyles = [...sunoStyles];
                                  vals.forEach(val => {
                                    if (!addedStyles.includes(val) && !DEFAULT_STYLES.includes(val)) {
                                      addedStyles = [val, ...addedStyles];
                                    }
                                    if (!selectedStyles.includes(val)) {
                                      selectedStyles = [...selectedStyles, val];
                                    }
                                  });
                                  setCustomStyles(addedStyles);
                                  setSunoStyles(selectedStyles);
                                  setNewStyle("");
                                }
                              }}
                              disabled={isGenerating || !newStyle.trim()}
                              className={`px-1 py-2.5 border text-[11px] font-mono uppercase tracking-widest transition-colors ${theme === 'dark' ? 'bg-[#0A0A0A] border-[#333] text-white hover:bg-white hover:text-black' : 'bg-white border-gray-300 text-black hover:bg-black hover:text-white'} ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              Add
                            </button>
                          </div>
                          <div className={`w-full border max-h-40 overflow-y-auto p-4 space-y-3 scrollbar-thin ${
                            theme === 'dark' 
                              ? 'bg-[#0A0A0A] border-[#333] scrollbar-thumb-[#333] scrollbar-track-transparent' 
                              : 'bg-white border-gray-300 scrollbar-thumb-gray-200 scrollbar-track-transparent'
                          }`}>
                            {Array.from(new Set([...customStyles, ...DEFAULT_STYLES])).map((style, idx) => (
                              <label key={`style-seg-${style}`} className={`flex items-center gap-3 group/item ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                                <div className="relative flex items-center justify-center">
                                  <input 
                                    type="checkbox"
                                    checked={sunoStyles.includes(style)}
                                    disabled={isGenerating}
                                    onChange={(e) => {
                                      if (isGenerating) return;
                                      const newStyleList = e.target.checked 
                                        ? [...sunoStyles, style]
                                        : sunoStyles.filter(a => a !== style);
                                      setSunoStyles(newStyleList);
                                    }}
                                    className={`peer appearance-none w-4 h-4 border transition-colors ${
                                      theme === 'dark' 
                                        ? 'border-[#333] bg-[#141414] checked:bg-white checked:border-white' 
                                        : 'border-gray-300 bg-white checked:bg-black checked:border-black'
                                    } ${isGenerating ? 'cursor-not-allowed' : ''}`}
                                  />
                                  <Check className={`w-2.5 h-2.5 absolute opacity-0 peer-checked:opacity-100 pointer-events-none ${theme === 'dark' ? 'text-black' : 'text-white'}`} />
                                </div>
                                <span className={`text-[11px] font-mono transition-colors ${sunoStyles.includes(style) ? 'font-bold' : 'opacity-60 group-hover/item:opacity-100'}`}>
                                  {style}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Secondary Controls */}
                    <div className="flex flex-col gap-8">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-current/10">
                          <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">Vocals & Modifiers</span>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <label className="text-[9px] uppercase font-mono opacity-60 mb-2 block tracking-wider">Vocal Gender</label>
                            <select 
                              value={sunoVocalGender}
                              onChange={e => setSunoVocalGender(e.target.value)}
                              disabled={isGenerating}
                              className={`w-full p-2 border text-[10px] font-mono outline-none cursor-pointer ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333]' : 'bg-gray-50 border-gray-200'} ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <option value="">Any</option>
                              <option value="m">Male</option>
                              <option value="f">Female</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] uppercase font-mono opacity-60 mb-2 block tracking-wider">Negative Tags</label>
                            <input 
                              type="text" 
                              placeholder="e.g. Heavy Metal"
                              value={sunoNegativeTags}
                              onChange={e => setSunoNegativeTags(e.target.value)}
                              disabled={isGenerating}
                              className={`w-full p-2 border text-[10px] font-mono outline-none focus:border-current ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333] placeholder-[#555]' : 'bg-gray-50 border-gray-200 placeholder-gray-400'} ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-current/10">
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${!sunoCustomMode ? 'opacity-30' : 'opacity-50'}`}>
                            Persona {sunoCustomMode ? '' : '(Custom Mode Only)'}
                          </span>
                        </div>
                        <div className={`grid grid-cols-1 gap-4 transition-opacity ${!sunoCustomMode ? 'opacity-40' : 'opacity-100'}`}>
                          <div>
                            <label className="text-[9px] uppercase font-mono opacity-60 mb-2 block tracking-wider">Persona ID</label>
                            <input 
                              type="text" 
                              disabled={isGenerating || !sunoCustomMode}
                              placeholder="e.g. persona_123"
                              value={sunoPersonaId}
                              onChange={e => setSunoPersonaId(e.target.value)}
                              className={`w-full p-2 border text-[10px] font-mono outline-none focus:border-current ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333] placeholder-[#555]' : 'bg-gray-50 border-gray-200 placeholder-gray-400'} ${(!sunoCustomMode || isGenerating) ? 'cursor-not-allowed opacity-50' : ''}`}
                            />
                          </div>
                          <div>
                            <label className="text-[9px] uppercase font-mono opacity-60 mb-2 block tracking-wider">Persona Model</label>
                            <select 
                              disabled={isGenerating || !sunoCustomMode}
                              value={sunoPersonaModel}
                              onChange={e => setSunoPersonaModel(e.target.value)}
                              className={`w-full p-2 border text-[10px] font-mono outline-none cursor-pointer ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333]' : 'bg-gray-50 border-gray-200'} ${(!sunoCustomMode || isGenerating) ? 'cursor-not-allowed opacity-50' : ''}`}
                            >
                              <option value="">Default</option>
                              <option value="style_persona">Style</option>
                              {(sunoModel === 'V5' || sunoModel === 'V5_5') && (
                                <option value="voice_persona">Voice</option>
                              )}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Weights & Constraints */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-current/10">
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">Parameters & Weights</span>
                      </div>
                      <div className="grid grid-cols-1 gap-6">
                        <div className={`p-4 border ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
                          <label className="flex items-center justify-between text-[9px] uppercase font-mono mb-3 tracking-wider">
                            <span className="opacity-70">Style Weight</span>
                            <span className="font-bold opacity-100">{sunoStyleWeight.toFixed(2)}</span>
                          </label>
                          <input 
                            type="range" min="0" max="1" step="0.05"
                            value={sunoStyleWeight} onChange={e => setSunoStyleWeight(parseFloat(e.target.value))}
                            disabled={isGenerating}
                            className={`w-full h-1 bg-current/20 appearance-none rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-current [&::-webkit-slider-thumb]:rounded-full ${isGenerating ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                          />
                        </div>
                        <div className={`p-4 border ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
                          <label className="flex items-center justify-between text-[9px] uppercase font-mono mb-3 tracking-wider">
                            <span className="opacity-70">Weirdness</span>
                            <span className="font-bold opacity-100">{sunoWeirdnessConstraint.toFixed(2)}</span>
                          </label>
                          <input 
                            type="range" min="0" max="1" step="0.05"
                            value={sunoWeirdnessConstraint} onChange={e => setSunoWeirdnessConstraint(parseFloat(e.target.value))}
                            disabled={isGenerating}
                            className={`w-full h-1 bg-current/20 appearance-none rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-current [&::-webkit-slider-thumb]:rounded-full ${isGenerating ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                          />
                        </div>
                        <div className={`p-4 border ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
                          <label className="flex items-center justify-between text-[9px] uppercase font-mono mb-3 tracking-wider">
                            <span className="opacity-70">Audio Weight</span>
                            <span className="font-bold opacity-100">{sunoAudioWeight.toFixed(2)}</span>
                          </label>
                          <input 
                            type="range" min="0" max="1" step="0.05"
                            value={sunoAudioWeight} onChange={e => setSunoAudioWeight(parseFloat(e.target.value))}
                            disabled={isGenerating}
                            className={`w-full h-1 bg-current/20 appearance-none rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-current [&::-webkit-slider-thumb]:rounded-full ${isGenerating ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-current/10 shrink-0">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] md:text-xs font-mono uppercase opacity-60 font-bold block">Master Prompt</label>
                <button
                  onClick={handleAutoPrompt}
                  disabled={isAutoPrompting || isGenerating}
                  className={`flex items-center gap-1.5 px-2 py-1 border text-[9px] font-mono tracking-widest uppercase transition-colors ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333] hover:bg-white hover:text-black' : 'bg-gray-50 border-gray-200 hover:bg-black hover:text-white'} ${(isAutoPrompting || isGenerating) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isAutoPrompting ? <RefreshCw className="w-3 h-3 animate-spin shrink-0" /> : <Sparkles className="w-3 h-3 shrink-0" />}
                  Auto-Generate
                </button>
              </div>
              <textarea 
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                disabled={isGenerating || isAutoPrompting}
                placeholder={`Describe the ${activeMode} you want to synthesize...`}
                className={`w-full p-3 md:p-4 border resize-none h-24 md:h-32 font-mono text-xs md:text-sm focus:outline-none transition-colors ${
                  theme === 'dark' 
                    ? 'bg-[#1A1A1A] border-[#333] focus:border-white' 
                    : 'bg-white border-gray-300 focus:border-black'
                } ${(isGenerating || isAutoPrompting) ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
            </div>
          </div>
          
          <button 
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className={`w-full p-4 font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all mt-6 flex-shrink-0 ${
              isGenerating 
                ? 'opacity-50 cursor-not-allowed bg-gray-500 text-white' 
                : `bg-gradient-to-r ${getModelBadgeColors(activeMode)} shadow-lg hover:shadow-xl hover:-translate-y-0.5`
            }`}
          >
            {isGenerating ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Wand2 className="w-5 h-5" />
            )}
            <div className="flex flex-col items-center">
              <span>{isGenerating ? 'Synthesizing...' : `Generate ${activeMode}`}</span>
              {!isGenerating && (
                <span className="text-[10px] opacity-60 font-mono tracking-tighter">
                  -{GENERATION_COSTS[activeMode]} CREDITS
                </span>
              )}
            </div>
          </button>
        </div>

        {/* Right Console - Assets File Manager */}
        <div className={`flex-1 flex flex-col overflow-hidden border-l border-t lg:border-t-0 ${theme === 'dark' ? 'border-[#333] bg-[#0A0A0A]' : 'border-gray-200 bg-white'}`}>
          <div className={`p-4 md:p-6 lg:p-8 flex items-center justify-between border-b ${theme === 'dark' ? 'border-[#333]' : 'border-gray-200'}`}>
            <div className="flex flex-col">
              <h3 className="font-black uppercase tracking-widest text-lg flex items-center gap-3">
                <Upload className="w-5 h-5 opacity-60" />
                Synthesis Library
              </h3>
              <p className="text-[10px] font-mono opacity-50 uppercase tracking-[0.2em] mt-1">Stored generations and uploads</p>
            </div>
            <div className="px-3 py-1 border-2 font-mono text-xs font-bold tracking-widest uppercase opacity-60">
              {assets.length} Entry_Points
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            {assets.length === 0 ? (
              <div className={`w-full h-full min-h-[300px] flex flex-col items-center justify-center border-2 border-dashed ${theme === 'dark' ? 'border-[#333] text-[#F8F8F7]' : 'border-gray-300 text-black'}`}>
                <div className={`p-4 rounded-full mb-4 ${theme === 'dark' ? 'bg-[#1A1A1A]' : 'bg-gray-100'}`}>
                  < ImageIcon className="w-8 h-8 opacity-40" />
                </div>
                <h4 className="text-sm font-bold uppercase tracking-widest mb-2">No Assets Generated</h4>
                <p className="text-[10px] font-mono opacity-50 uppercase tracking-widest text-center max-w-xs">
                  Generate images, videos, or audio tracks to populate your synthesis library.
                </p>
              </div>
            ) : (
              <div className={`overflow-x-auto border-2 ${theme === 'dark' ? 'border-[#333]' : 'border-gray-200'}`}>
                <table className="w-full text-left border-collapse min-w-[800px]">
                <thead className={`border-b-2 ${theme === 'dark' ? 'border-[#333] bg-[#141414]' : 'border-gray-200 bg-gray-50'}`}>
                  <tr className="text-[9px] uppercase font-mono tracking-widest opacity-60">
                    <th className="py-4 px-4 font-normal">Asset</th>
                    <th className="py-4 px-4 font-normal">Type & Source</th>
                    <th className="py-4 px-4 font-normal">Details & Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {assets.map((asset) => (
                      <motion.tr
                        key={asset.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`group border-b last:border-b-0 transition-colors ${
                          theme === 'dark' ? 'border-[#222] hover:bg-[#141414]' : 'border-gray-100 hover:bg-gray-50'
                        }`}
                      >
                        {/* Name and Preview */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-4">
                            <div 
                              onClick={() => {
                                setViewingCover(asset);
                              }}
                              className={`w-12 h-12 flex-shrink-0 border-2 flex items-center justify-center relative overflow-hidden bg-black/5 dark:bg-white/5 transition-transform cursor-pointer hover:scale-105 active:scale-95 ${getBorderColor(asset).split(' ')[0]}`}
                            >
                              {(asset.metadata?.coverUrl || asset.metadata?.imageUrl || asset.url) && (
                                <img src={asset.metadata?.coverUrl || asset.metadata?.imageUrl || asset.url} referrerPolicy="no-referrer" alt="" className="absolute inset-0 w-full h-full object-cover" />
                              )}
                              {!(asset.metadata?.coverUrl || asset.metadata?.imageUrl || asset.url) && (
                                <>
                                  {asset.type === 'image' && <ImageIcon className="w-4 h-4 opacity-50 relative z-10" />}
                                  {asset.type === 'video' && <Video className="w-4 h-4 opacity-50 relative z-10" />}
                                  {asset.type === 'audio' && <Music className="w-4 h-4 opacity-50 relative z-10" />}
                                </>
                              )}
                            </div>
                            <div className="flex flex-col min-w-0">
                               <span className="font-bold text-sm uppercase tracking-tight truncate max-w-[200px] mb-1" title={asset.name}>{asset.name}</span>
                               
                               {/* Asset Actions */}
                               <div className="flex gap-1.5 mt-1.5 mb-1.5">
                                 {asset.type === 'audio' && asset.source === 'generated' && (
                                   <button 
                                     onClick={(e) => { e.stopPropagation(); handleGenerateCover(asset); }}
                                     disabled={coverGeneratingAssets.has(asset.id)}
                                     className={`w-7 h-7 flex items-center justify-center border-2 transition-colors ${
                                       theme === 'dark' ? 'border-amber-500/30 text-amber-500 hover:bg-amber-600 hover:text-white' : 'border-amber-500/30 text-amber-600 hover:bg-amber-600 hover:text-white'
                                     } ${coverGeneratingAssets.has(asset.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                     title="Generate Song Cover"
                                   >
                                     {coverGeneratingAssets.has(asset.id) ? (
                                       <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                     ) : (
                                       <Sparkles className="w-3.5 h-3.5" />
                                     )}
                                   </button>
                                 )}
                                 {asset.type === 'audio' && asset.source === 'generated' && (
                                   <button 
                                     onClick={(e) => { e.stopPropagation(); handleFetchTimestampedLyrics(asset); }}
                                     disabled={lyricsLoadingAssets.has(asset.id)}
                                     className={`w-7 h-7 flex items-center justify-center border-2 transition-colors ${
                                       theme === 'dark' ? 'border-indigo-500/30 text-indigo-400 hover:bg-indigo-500 hover:text-black' : 'border-indigo-500/30 text-indigo-600 hover:bg-indigo-500 hover:text-white'
                                     } ${lyricsLoadingAssets.has(asset.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                     title="View Temporal Lyrics"
                                   >
                                     {lyricsLoadingAssets.has(asset.id) ? (
                                       <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                     ) : (
                                       <Wand2 className="w-3.5 h-3.5" />
                                     )}
                                   </button>
                                 )}
                                 {asset.source === 'generated' && (
                                   <button 
                                     onClick={() => onAddAssetToNarrative?.(asset)}
                                     className={`w-7 h-7 flex items-center justify-center border-2 transition-colors ${
                                       theme === 'dark' ? 'border-[#333] hover:bg-white hover:text-black' : 'border-gray-200 hover:bg-black hover:text-white'
                                     }`}
                                     title="Add to Narrative Context"
                                   >
                                     <BookOpen className="w-3.5 h-3.5" />
                                   </button>
                                 )}
                                 <button 
                                   onClick={() => {
                                     if (asset.url) {
                                       window.open(asset.url, '_blank');
                                     }
                                   }}
                                   className={`w-7 h-7 flex items-center justify-center border-2 transition-colors ${
                                     theme === 'dark' ? 'border-[#333] hover:border-white' : 'border-gray-200 hover:border-black'
                                   }`} title="Download / Open">
                                     <Download className="w-3.5 h-3.5" />
                                 </button>
                                 <button 
                                   onClick={() => setAssetToDelete(asset)}
                                   className="w-7 h-7 flex items-center justify-center border-2 border-transparent hover:border-red-500 text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-colors" title="Purge Record">
                                     <Trash2 className="w-3.5 h-3.5" />
                                 </button>
                               </div>

                               <span className="text-[9px] font-mono opacity-50 uppercase tracking-widest mt-1">
                                 {new Date(asset.timestamp).toLocaleDateString()} {new Date(asset.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                               </span>
                            </div>
                          </div>
                        </td>

                        {/* Type and Source */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <div className="flex flex-col items-start gap-2">
                             <div 
                               onClick={() => {
                                 setViewingAssetDetails(asset);
                               }}
                               className={`px-2 py-1 text-[8px] uppercase font-mono font-black tracking-widest border transition-all ${getBorderColor(asset).split(' ')[0]} cursor-pointer hover:bg-zinc-900 hover:text-white dark:hover:bg-zinc-100 dark:hover:text-zinc-900 hover:scale-105 active:scale-95`}
                             >
                               {asset.type}
                             </div>
                             {asset.source === 'uploaded' ? (
                               <div className="text-[9px] uppercase font-mono font-bold tracking-widest opacity-40">
                                 USR_RAW
                               </div>
                             ) : (
                               <div className="flex flex-col">
                                 <div className={`text-[10px] uppercase font-mono font-bold bg-clip-text text-transparent bg-gradient-to-r ${getModelBadgeColors(asset.type as GenerationMode)}`}>
                                   {asset.model}
                                 </div>
                                 {asset.metadata?.generationTimeMs && (
                                   <div className="text-[8px] font-mono opacity-40 mt-0.5">
                                     GEN: {(asset.metadata.generationTimeMs / 1000).toFixed(1)}s
                                   </div>
                                 )}
                               </div>
                             )}
                          </div>
                        </td>

                        {/* Details and Metadata */}
                        <td className="py-4 px-4">
                          <div className="flex flex-col items-start justify-center max-w-[300px]">
                            {asset.type === 'audio' && asset.url && (
                              <div className="mb-2 w-full">
                                <audio src={asset.url} controls className="w-full max-w-[200px] h-7 grayscale opacity-80 hover:opacity-100 transition-opacity mix-blend-luminosity" />
                              </div>
                            )}
                            {asset.source === 'generated' && asset.metadata ? (
                              <div className="flex flex-col gap-1 w-full relative">
                                <span className={`text-[11px] font-mono italic leading-relaxed line-clamp-2 pr-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} title={asset.metadata.prompt}>
                                  "{asset.metadata.prompt}"
                                </span>
                                {(asset.metadata.title || asset.metadata.tags || asset.metadata.duration) && (
                                  <div className="flex flex-wrap gap-2 text-[9px] font-mono uppercase tracking-widest opacity-50 mt-1">
                                     {asset.metadata.title && <span>{asset.metadata.title}</span>}
                                     {asset.metadata.duration && <span>• {asset.metadata.duration}s</span>}
                                     {asset.metadata.tags && <span className="truncate max-w-[150px]">• {asset.metadata.tags}</span>}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] font-mono opacity-30 uppercase tracking-widest">No Context Data</span>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Cover Details Modal */}
      <AnimatePresence>
        {viewingCover && (
          <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
             onClick={() => setViewingCover(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className={`w-full max-w-[400px] max-h-[90vh] overflow-hidden border-4 ${theme === 'dark' ? 'bg-[#0A0A0A] border-[#333]' : 'bg-white border-black'} shadow-2xl`}
              onClick={e => e.stopPropagation()}
            >
              <div className="relative aspect-square w-full">
                <img 
                  src={viewingCover.metadata.coverUrl || viewingCover.metadata.imageUrl} 
                  alt={viewingCover.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <button 
                  onClick={() => setViewingCover(null)}
                  className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 md:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg md:text-xl font-black uppercase italic leading-none">{viewingCover.metadata.title || viewingCover.name}</h3>
                    <p className="text-[10px] font-mono opacity-50 uppercase tracking-[0.2em] mt-2">Music Cover Artifact</p>
                  </div>
                  < Music className="w-5 h-5 opacity-40 shrink-0" />
                </div>
                
                <div className="p-3 border border-current/10 bg-current/5 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[9px] uppercase font-mono opacity-40 block mb-1">Source Token</span>
                      <p className="text-[10px] font-mono font-bold truncate">{viewingCover.metadata.task_id || viewingCover.id}</p>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-mono opacity-40 block mb-1">Generated</span>
                      <p className="text-[10px] font-mono font-bold">{new Date(viewingCover.timestamp).toLocaleDateString()}</p>
                    </div>
                  </div>
                  {viewingCover.metadata.tags && (
                    <div>
                      <span className="text-[9px] uppercase font-mono opacity-40 block mb-1">Atmosphere</span>
                      <p className="text-[10px] font-mono line-clamp-2">{viewingCover.metadata.tags}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {viewingCover.url && (
                    <button 
                      onClick={() => window.open(viewingCover.url, '_blank')}
                      className={`flex-1 p-2.5 font-bold uppercase tracking-widest text-[9px] md:text-[10px] flex items-center justify-center gap-2 border-2 ${
                        theme === 'dark' ? 'bg-white text-black border-white' : 'bg-black text-white border-black'
                      } hover:opacity-90 transition-all`}
                    >
                      <Download className="w-3.5 h-3.5" /> Download
                    </button>
                  )}
                  <button 
                    onClick={() => {
                        const link = document.createElement('a');
                        link.href = viewingCover.metadata.coverUrl || viewingCover.metadata.imageUrl;
                        link.download = `cover_${viewingCover.name}.png`;
                        link.target = '_blank';
                        link.click();
                    }}
                    className={`flex-1 p-2.5 font-bold uppercase tracking-widest text-[9px] md:text-[10px] flex items-center justify-center gap-2 border-2 ${
                      theme === 'dark' ? 'border-[#333] hover:border-white' : 'border-gray-200 hover:border-black'
                    } transition-all`}
                  >
                    Save Art
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Asset Details Modal */}
      <AnimatePresence>
        {viewingAssetDetails && (
          <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
             onClick={() => setViewingAssetDetails(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className={`w-full max-w-[500px] max-h-[85vh] overflow-hidden border-4 ${theme === 'dark' ? 'bg-[#0A0A0A] border-[#333]' : 'bg-white border-black'} shadow-2xl flex flex-col`}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-current/10">
                <div className="flex items-center gap-3">
                  {viewingAssetDetails.type === 'audio' && <Music className="w-5 h-5 text-indigo-500" />}
                  {viewingAssetDetails.type === 'image' && <ImageIcon className="w-5 h-5 text-indigo-500" />}
                  {viewingAssetDetails.type === 'video' && <Video className="w-5 h-5 text-indigo-500" />}
                  <h3 className="text-[9px] w-[236.688px] font-black uppercase tracking-widest italic">{viewingAssetDetails.name}</h3>
                </div>
                <button onClick={() => setViewingAssetDetails(null)} className="p-1 hover:opacity-50 transition-opacity">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {/* Visual Header */}
                <div className="flex gap-4 items-start">
                  <div className={`w-24 h-24 shrink-0 border-2 ${theme === 'dark' ? 'border-[#333]' : 'border-black'} relative overflow-hidden bg-black/5`}>
                    {(viewingAssetDetails.metadata?.coverUrl || viewingAssetDetails.metadata?.imageUrl || viewingAssetDetails.url) ? (
                      <img 
                        src={viewingAssetDetails.metadata.coverUrl || viewingAssetDetails.metadata.imageUrl || viewingAssetDetails.url} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        alt=""
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music className="w-8 h-8 opacity-20" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 min-w-0">
                    <p className="text-[10px] uppercase font-mono opacity-40">Composition Details</p>
                    <h4 className="text-lg font-bold truncate leading-tight uppercase italic">{viewingAssetDetails.metadata?.title || 'Untitled Work'}</h4>
                    <div className="flex flex-wrap gap-2 pt-2">
                       {viewingAssetDetails.metadata?.tags?.split(' ').slice(0, 5).map((tag: string, i: number) => (
                         <span key={i} className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-500 text-[8px] font-mono uppercase tracking-tighter border border-indigo-500/20">
                            {tag}
                         </span>
                       ))}
                    </div>
                  </div>
                </div>

                {/* Prompt Section */}
                <div className="space-y-3">
                   <div className="flex items-center gap-2">
                     <div className="h-[1px] flex-1 bg-current/10" />
                     <span className="text-[10px] font-mono uppercase opacity-40 tracking-widest">
                       {viewingAssetDetails.type === 'audio' ? 'COMPOSITION SOURCE' : 'GENETIC PROMPT'}
                     </span>
                     <div className="h-[1px] flex-1 bg-current/10" />
                   </div>
                   <div className={`p-6 border text-center transition-all ${
                     viewingAssetDetails.type === 'audio' 
                       ? 'font-serif text-base md:text-lg leading-relaxed italic whitespace-pre-wrap' 
                       : 'font-mono text-[11px] leading-relaxed italic whitespace-pre-wrap'
                     } ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white/90' : 'bg-black/5 border-black/10 text-black/90'}`}>
                      {viewingAssetDetails.metadata?.prompt || 'No prompt recorded.'}
                   </div>
                </div>

                {/* Technical Specs */}
                <div className="grid grid-cols-2 gap-px bg-current/10 border border-current/10 overflow-hidden">
                  {[
                    { label: 'Artifact ID', value: viewingAssetDetails.metadata?.task_id || viewingAssetDetails.id },
                    { label: 'Model Core', value: viewingAssetDetails.metadata?.model_name || 'Suno v3.5' },
                    { label: 'Main Asset Size', value: viewingAssetDetails.metadata?.fileSize ? formatBytes(viewingAssetDetails.metadata.fileSize) : 'N/A' },
                    { label: 'Cover Size', value: viewingAssetDetails.metadata?.coverSize ? formatBytes(viewingAssetDetails.metadata.coverSize) : 'N/A' },
                    { label: 'Synthesis Status', value: 'Complete' },
                    { label: 'Temporal Signature', value: new Date(viewingAssetDetails.timestamp).toLocaleString() }
                  ].map((spec, i) => (
                    <div key={i} className={`p-3 ${theme === 'dark' ? 'bg-[#0A0A0A]' : 'bg-white'}`}>
                      <span className="text-[9px] uppercase font-mono opacity-40 block mb-0.5">{spec.label}</span>
                      <p className="text-[10px] font-mono font-bold truncate tracking-tight">{spec.value}</p>
                    </div>
                  ))}
                </div>

                {/* Lyrics Section if available */}
                {viewingAssetDetails.metadata?.lyrics && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                       <div className="h-[1px] flex-1 bg-current/10" />
                       <span className="text-[10px] font-mono uppercase opacity-40 tracking-widest">TRANSCRIBED SCRIPT</span>
                       <div className="h-[1px] flex-1 bg-current/10" />
                    </div>
                    <div className={`p-6 border text-center whitespace-pre-wrap max-h-60 overflow-y-auto custom-scrollbar italic ${
                      theme === 'dark' ? 'bg-white/5 border-white/10 text-white/80' : 'bg-black/5 border-black/10 text-black/80'
                    }`}>
                       <p className="text-sm md:text-base leading-loose">{viewingAssetDetails.metadata.lyrics}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-current/10 bg-current/5">
                <button 
                  onClick={() => setViewingAssetDetails(null)}
                  className={`w-full p-2.5 font-bold uppercase tracking-widest text-[10px] border-2 ${
                    theme === 'dark' ? 'bg-white text-black border-white' : 'bg-black text-white border-black'
                  } hover:opacity-90 transition-all`}
                >
                  Close Artifact Details
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lyrics Modal */}
      <AnimatePresence>
        {viewingLyrics && (
          <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
             onClick={() => setViewingLyrics(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className={`w-full max-w-lg max-h-[80vh] flex flex-col border-4 ${theme === 'dark' ? 'bg-[#0A0A0A] border-[#333]' : 'bg-white border-black'} shadow-2xl overflow-hidden`}
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 border-b border-current/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BookOpen className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-sm font-black uppercase tracking-[0.2em]">{viewingLyrics.name} // Temporal Lyrics</h3>
                </div>
                <button onClick={() => setViewingLyrics(null)} className="p-1 hover:opacity-50 transition-opacity">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar">
                {viewingLyrics.metadata?.timestampedLyrics?.segments ? (
                  <div className="space-y-6">
                    {viewingLyrics.metadata.timestampedLyrics.segments.map((segment: any, idx: number) => (
                      <div key={idx} className="group flex gap-4">
                        <div className="w-12 shrink-0 font-mono text-[10px] opacity-30 pt-1">
                          {(segment.start_time / 1000).toFixed(1)}s
                        </div>
                        <div className={`p-4 md:p-6 border-l-4 transition-colors ${theme === 'dark' ? 'border-white/5 group-hover:border-indigo-500 bg-white/5' : 'border-black/5 group-hover:border-indigo-500 bg-black/5'} flex-1`}>
                           <p className="text-base md:text-xl font-serif leading-loose italic tracking-tight text-current/90">
                             {segment.text}
                           </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20 px-10 space-y-4">
                    <Music className="w-12 h-12 opacity-10 mx-auto" />
                    <p className="text-xs font-mono uppercase opacity-40">Synthetic transcription yielded no segments. This track may be purely sonic.</p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-current/10 bg-current/5">
                <button 
                  onClick={() => setViewingLyrics(null)}
                  className={`w-full p-3 font-bold uppercase tracking-widest text-xs border-2 ${
                    theme === 'dark' ? 'bg-white text-black border-white' : 'bg-black text-white border-black'
                  } hover:opacity-90 transition-all`}
                >
                  Return to Studio
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Deletion Confirmation Modal */}
      <AnimatePresence>
        {assetToDelete && (
          <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
             onClick={() => setAssetToDelete(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className={`w-full max-w-[400px] border-4 p-6 ${theme === 'dark' ? 'bg-[#0A0A0A] border-[#333]' : 'bg-white border-black'} shadow-2xl`}
              onClick={e => e.stopPropagation()}
            >
              <h3 className="font-black uppercase tracking-widest mb-4">Purge Asset</h3>
              <p className="text-sm font-mono mb-6 opacity-70">Are you sure you want to permanently delete {assetToDelete.name}? This action cannot be undone.</p>
              <div className="flex gap-4">
                 <button onClick={() => setAssetToDelete(null)} className="flex-1 border-2 border-zinc-500 py-2 uppercase font-bold text-xs hover:bg-zinc-500/10 transition-colors">Cancel</button>
                 <button onClick={() => executeDeleteAsset(assetToDelete)} className="flex-1 border-2 border-red-500 bg-red-500/10 text-red-500 py-2 uppercase font-bold text-xs hover:bg-red-500 hover:text-white transition-colors">Purge</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
=======
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Image as ImageIcon, Video, Music, Wand2, Upload, Settings2, Download, RefreshCw, X, Play, Sparkles, BookOpen, Trash2, AlertCircle, Check } from 'lucide-react';

interface MultiModalStudioProps {
  theme: 'light' | 'dark';
  onAddAssetToNarrative?: (asset: MediaAsset) => void;
  credits: number;
  userId: string;
  isAdmin: boolean;
}

const GENERATION_COSTS: Record<GenerationMode, number> = {
  image: 10,
  video: 40,
  music: 40
};

type GenerationMode = 'image' | 'video' | 'music';

export interface MediaAsset {
  id: string;
  type: 'image' | 'video' | 'audio';
  source: 'uploaded' | 'generated';
  name: string;
  url?: string;
  model?: string;
  timestamp: string;
  metadata?: any;
}

const DEFAULT_STYLES = [
  "Pop", "Rock", "Hip Hop", "R&B", "Country", 
  "Jazz", "Classical", "Electronic", "Dance", "Folk",
  "Acoustic", "Blues", "Soul", "Funk", "Disco",
  "Reggae", "Latin", "Metal", "Punk", "Indie Rock",
  "Alternative", "Synthwave", "Ambient", "Cinematic", "Lo-Fi",
  "Trap", "EDM", "House", "Techno", "K-Pop"
];

export function MultiModalStudio({ theme, onAddAssetToNarrative, credits, userId, isAdmin }: MultiModalStudioProps) {
  const [activeMode, setActiveMode] = useState<GenerationMode>('image');
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<string>("16:9");
  const [resolution, setResolution] = useState<string>("1080p");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sunoCustomMode, setSunoCustomMode] = useState(false);
  const [sunoInstrumental, setSunoInstrumental] = useState(false);
  const [sunoModel, setSunoModel] = useState("V4_5ALL");
  const [sunoStyles, setSunoStyles] = useState<string[]>([]);
  const [customStyles, setCustomStyles] = useState<string[]>([]);
  const [newStyle, setNewStyle] = useState("");
  const [sunoTitle, setSunoTitle] = useState("");
  const [sunoPersonaId, setSunoPersonaId] = useState("");
  const [sunoPersonaModel, setSunoPersonaModel] = useState("");
  const [sunoNegativeTags, setSunoNegativeTags] = useState("");
  const [sunoVocalGender, setSunoVocalGender] = useState("");
  const [sunoStyleWeight, setSunoStyleWeight] = useState<number>(0.65);
  const [sunoWeirdnessConstraint, setSunoWeirdnessConstraint] = useState<number>(0.65);
  const [sunoAudioWeight, setSunoAudioWeight] = useState<number>(0.65);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [coverGeneratingAssets, setCoverGeneratingAssets] = useState<Set<string>>(new Set());
  const [lyricsLoadingAssets, setLyricsLoadingAssets] = useState<Set<string>>(new Set());
  const [viewingCover, setViewingCover] = useState<MediaAsset | null>(null);
  const [viewingAssetDetails, setViewingAssetDetails] = useState<MediaAsset | null>(null);
  const [viewingLyrics, setViewingLyrics] = useState<MediaAsset | null>(null);

  useEffect(() => {
    if (!userId) return;
    
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;
    
    const fetchAssets = async () => {
      try {
        const { db, handleFirestoreError, OperationType } = await import('../lib/firebase');
        const { collection, query, orderBy, onSnapshot } = await import('firebase/firestore');
        const assetsRef = collection(db, 'users', userId, 'media_assets');
        const q = query(assetsRef, orderBy('timestamp', 'desc'));
        
        unsubscribe = onSnapshot(q, (snapshot) => {
          if (!isMounted) return;
          const loaded: MediaAsset[] = [];
          snapshot.forEach(doc => {
            loaded.push(doc.data() as MediaAsset);
          });
          setAssets(loaded);
        }, (error) => {
           // Provide a fallback silent error handle if permission initially denied, 
           // though we should throw to the ErrorBoundary if intended. For assets we might just log and fail silently.
           console.error("Firestore Error in Assets:", error);
           // handleFirestoreError(error, OperationType.LIST, `users/${userId}/media_assets`);
        });
      } catch (err) {
        console.error("Failed to set up assets listener:", err);
      }
    };
    
    fetchAssets();
    
    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [userId]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setError(null);

    const cost = GENERATION_COSTS[activeMode];
    if (!isAdmin && credits < cost) {
      setError(`Insufficient Credits: Generation requires ${cost} credits. You have ${credits}.`);
      return;
    }

    setIsGenerating(true);

    const startTime = Date.now();

    let finalUrl: string | undefined = undefined;
    let modelUsed = "";
    let finalMetadata: any = { prompt };

    try {
      if (!isAdmin) {
        // Deduct credits via Firestore transaction
        // Importing db here to avoid dependency issues if needed, but it's better to expect it in lib/firebase
        const { db, handleFirestoreError, OperationType } = await import('../lib/firebase');
        const { doc, runTransaction, collection, serverTimestamp } = await import('firebase/firestore');
        
        await runTransaction(db, async (transaction) => {
          const userRef = doc(db, 'users', userId);
          const userDoc = await transaction.get(userRef);
          if (!userDoc.exists()) throw new Error("User record not found");
          const currentCredits = userDoc.data().credits || 0;
          if (currentCredits < cost) throw new Error(`Insufficient credits`);
          
          transaction.update(userRef, { credits: currentCredits - cost });
          
          // Log activity
          const activityRef = doc(collection(db, 'users', userId, 'activity'));
          transaction.set(activityRef, {
            type: `${activeMode}_generation`,
            description: `${activeMode.charAt(0).toUpperCase() + activeMode.slice(1)} Synthesis`,
            cost: cost,
            timestamp: serverTimestamp(),
            metadata: {
              prompt: prompt.substring(0, 500)
            }
          });
        }).catch(err => {
          handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
          throw err;
        });
      }

      if (activeMode === 'music') {
        const apiKey = (import.meta as any).env.VITE_SUNO_API_KEY;
        if (!apiKey) {
          throw new Error('VITE_SUNO_API_KEY environment variable is required to generate music with Suno AI.');
        }
        modelUsed = "Suno AI";
        const payload: any = {
          prompt: prompt,
          customMode: sunoCustomMode,
          instrumental: sunoInstrumental,
          model: sunoModel,
          title: sunoTitle || "Generated Track",
          style: sunoStyles.join(", ") || (sunoInstrumental ? "Instrumental" : ""),
          callBackUrl: window.location.origin + "/api/suno-callback",
          wait_audio: true 
        };

        if (sunoPersonaId) payload.personaId = sunoPersonaId;
        if (sunoPersonaModel) payload.personaModel = sunoPersonaModel;
        if (sunoNegativeTags) payload.negativeTags = sunoNegativeTags;
        if (sunoVocalGender) payload.vocalGender = sunoVocalGender;
        if (sunoStyleWeight !== 0.65) payload.styleWeight = sunoStyleWeight;
        if (sunoWeirdnessConstraint !== 0.65) payload.weirdnessConstraint = sunoWeirdnessConstraint;
        if (sunoAudioWeight !== 0.65) payload.audioWeight = sunoAudioWeight;

        const response = await fetch('https://api.sunoapi.org/api/v1/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Suno AI Music Generation failed: ${errText}`);
        }

        const jsonRes = await response.json();
        
        if (jsonRes.code && jsonRes.code !== 200) {
           throw new Error(`Suno AI Music Generation failed: ${jsonRes.msg || JSON.stringify(jsonRes)}`);
        }

        let sunoItem = null;
        
        // Check if initial response already contains audio data (since wait_audio: true was used)
        const initialItems = jsonRes?.data?.response?.sunoData || jsonRes?.data?.sunoData || jsonRes?.sunoData || (Array.isArray(jsonRes.data) ? jsonRes.data : null);
        if (Array.isArray(initialItems) && initialItems.length > 0) {
            const potentialItem = initialItems[0];
            if (potentialItem.audioUrl || potentialItem.streamAudioUrl || potentialItem.audio_url || potentialItem.url) {
                sunoItem = potentialItem;
            }
        }

        const taskId = jsonRes?.data?.taskId || jsonRes?.taskId || (Array.isArray(jsonRes.data) && jsonRes.data[0]?.task_id) || jsonRes?.data?.task_id || jsonRes?.data?.id || jsonRes?.id;

        if (!sunoItem && taskId) {
            let attempts = 0;
            while(attempts < 180) { // 6 minutes max (Suno can sometimes be slow for high quality)
               await new Promise(r => setTimeout(r, 2000));
               const statusRes = await fetch(`https://api.sunoapi.org/api/v1/generate/record-info?taskId=${taskId}`, {
                   headers: {
                      'Authorization': `Bearer ${apiKey}`
                   }
               });
               if (!statusRes.ok) {
                   attempts++;
                   continue;
               }
               const statusData = await statusRes.json();
               const status = statusData?.data?.status || statusData?.status;
               
               if (status === 'SUCCESS' || status === 'COMPLETED') {
                   const items = statusData?.data?.response?.sunoData || statusData?.data?.sunoData || statusData?.sunoData || (Array.isArray(statusData.data) ? statusData.data : null);
                   if (Array.isArray(items) && items.length > 0) {
                       sunoItem = items[0];
                       // Ensure it has an audio URL before stopping
                       if (sunoItem.audioUrl || sunoItem.streamAudioUrl || sunoItem.audio_url || sunoItem.url) {
                           break;
                       }
                   }
               } else if (status && (status.includes('FAIL') || status.includes('ERROR') || status.includes('EXCEPTION'))) {
                   throw new Error(`Suno AI generation failed with status: ${status}. Message: ${statusData?.data?.errorMessage || statusData?.message || 'Unknown error'}`);
               }
               attempts++;
            }
        }

        if (!sunoItem || (!sunoItem.audioUrl && !sunoItem.streamAudioUrl && !sunoItem.audio_url && !sunoItem.url)) {
             throw new Error("Timeout or could not find audio metadata in Suno AI task results.");
        }

        const audioUrl = sunoItem.audioUrl || sunoItem.streamAudioUrl || sunoItem.audio_url || sunoItem.url;
        
        finalMetadata = { prompt, task_id: taskId, ...sunoItem };

        const audioRes = await fetch(audioUrl);
        if (!audioRes.ok) throw new Error("Failed to download generated audio from Suno URL");
        const blob = await audioRes.blob();
        finalUrl = URL.createObjectURL(blob);
      } else if (activeMode === 'image' || activeMode === 'video') {
        const { GoogleGenAI } = await import("@google/genai");
        
        // Paid model check
        if (typeof (window as any).aistudio !== 'undefined') {
          const hasKey = await (window as any).aistudio.hasSelectedApiKey();
          if (!hasKey) {
            await (window as any).aistudio.openSelectKey();
          }
        }
        
        // Ensure we use the most up-to-date API key (often GEMINI_API_KEY or API_KEY in this env)
        const apiKey = (process.env as any).GEMINI_API_KEY || (process.env as any).API_KEY;
        if (!apiKey) throw new Error("Gemini API Key is required for synthesis.");
        const genAI = new GoogleGenAI({ apiKey });

        if (activeMode === 'image') {
          modelUsed = "Gemini 2.5 Flash Image";
          const response = await genAI.models.generateContent({
            model: "gemini-2.5-flash-image",
            contents: [{ parts: [{ text: prompt }] }],
            config: {
              imageConfig: {
                aspectRatio: aspectRatio as any,
              }
            }
          });
          
          const imagePart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
          if (imagePart?.inlineData?.data) {
            finalUrl = `data:image/png;base64,${imagePart.inlineData.data}`;
          } else {
            throw new Error("No image data returned. Ensure Imagen API is enabled.");
          }
        } else if (activeMode === 'video') {
          modelUsed = "Veo 3.1";
          let operation = await genAI.models.generateVideos({
            model: 'veo-3.1-generate-preview',
            prompt: prompt,
            config: {
              numberOfVideos: 1,
              resolution: resolution as any,
              aspectRatio: aspectRatio as any
            }
          });

          // Polling for video completion
          while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await genAI.operations.getVideosOperation({ operation });
          }

          const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
          if (!downloadLink) throw new Error("Video synthesis failed to return a valid stream URI.");

          // Fetch video using API key in header as per skill guidelines
          const videoResponse = await fetch(downloadLink, {
            method: 'GET',
            headers: {
              'x-goog-api-key': apiKey,
            },
          });

          if (!videoResponse.ok) throw new Error("Failed to secure kinetic stream from synthesized URI.");
          const blob = await videoResponse.blob();
          finalUrl = URL.createObjectURL(blob);
        }
      }
      
      const endTime = Date.now();
      finalMetadata.generationTimeMs = endTime - startTime;

      let assetName = `${activeMode}_generation_${prompt.substring(0, 10).replace(/[^a-zA-Z0-9_\-]/g, "")}.${activeMode === 'music' ? 'mp3' : activeMode === 'image' ? 'png' : 'mp4'}`;
      if (activeMode === 'music') {
        const titleToUse = sunoTitle || finalMetadata.title;
        if (titleToUse && titleToUse !== 'Generated Track') {
           assetName = `${titleToUse.replace(/[^a-zA-Z0-9_\- ]/g, "").trim().replace(/ /g, "_")}.mp3`;
        }
      }

      const newAsset: MediaAsset = {
        id: `gen-${Math.random().toString(36).substr(2, 9)}`,
        type: activeMode === 'music' ? 'audio' : activeMode,
        source: 'generated',
        name: assetName,
        model: modelUsed,
        timestamp: new Date().toISOString(),
        metadata: finalMetadata,
        url: finalUrl
      };
      
      let storageUrl = finalUrl;
      const { db, storage } = await import('../lib/firebase');
      const { doc, setDoc } = await import('firebase/firestore');
      const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
      
      try {
        if (finalUrl) {
          const fetchRes = await fetch(finalUrl);
          const finalBlob = await fetchRes.blob();
          const storageRef = ref(storage, `uploads/generated/${userId}/${newAsset.id}_${newAsset.name}`);
          
          await uploadBytes(storageRef, finalBlob, { contentType: finalBlob.type });
          storageUrl = await getDownloadURL(storageRef);
          
          // Revoke the local object URL to prevent memory leaks now that we have it requested
          if (finalUrl.startsWith('blob:')) {
             URL.revokeObjectURL(finalUrl);
          }
        }
        
        newAsset.url = storageUrl;

        const assetRef = doc(db, 'users', userId, 'media_assets', newAsset.id);
        const assetData = { ...newAsset, userId };
        await setDoc(assetRef, assetData);
      } catch (err) {
        console.error("Failed to save asset to database:", err);
      }
      
      setPrompt("");
    } catch (err: any) {
      console.error(`Generation error (${activeMode}):`, err);
      setError(err.message || "An unexpected error occurred during synthesis.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateCover = async (asset: MediaAsset) => {
    console.log("handleGenerateCover clicked for:", asset.id, "Metadata:", asset.metadata);
    if ((asset.type !== 'audio' && asset.type !== 'video') || (!asset.metadata?.task_id && !asset.metadata?.taskId && !asset.metadata?.prompt)) {
      console.log("handleGenerateCover skipped: audio/video check or metadata missing", asset.type, asset.metadata);
      return;
    }
    
    setCoverGeneratingAssets(prev => new Set(prev).add(asset.id));
    setError(null);

    try {
      let prompt = "";
      if (asset.type === 'audio') {
        prompt = `Generate a high quality, square cover art for a song. There should be no text on the image. Song metadata: ${asset.metadata?.prompt || asset.name}. Lyrics: ${asset.metadata?.lyrics || 'No lyrics provided'}`;
      } else {
        prompt = `Generate a high quality cover art or thumbnail for a video. There should be no text on the image. Video metadata: ${asset.metadata?.prompt || asset.name}.`;
      }
      
      const { GoogleGenAI } = await import("@google/genai");
      const apiKey = (process.env as any).GEMINI_API_KEY || (process.env as any).API_KEY;
      if (!apiKey) throw new Error("Gemini API Key is required.");
      
      const genAI = new GoogleGenAI({ apiKey });
      
      const response = await genAI.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          imageConfig: {
            aspectRatio: "1:1",
          }
        }
      });
      
      const imagePart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
      
      if (!imagePart?.inlineData?.data) {
        throw new Error("No image data returned. Ensure the model supports image generation.");
      }
      
      // Upload raw image to Storage
      const { db, storage } = await import('../lib/firebase');
      const { ref, uploadString, getDownloadURL } = await import('firebase/storage');
      const { doc, updateDoc } = await import('firebase/firestore');

      const path = `uploads/generated/${userId}/${asset.id}_cover.png`;
      const storageRef = ref(storage, path);
      
      // Upload using base64 string
      await uploadString(storageRef, imagePart.inlineData.data, 'base64', {
        contentType: 'image/png'
      });
      
      const imageUrl = await getDownloadURL(storageRef);
      
      // userId is required here; hopefully it's available in the component scope
      const assetRef = doc(db, 'users', userId, 'media_assets', asset.id);
      
      await updateDoc(assetRef, {
        'metadata.coverUrl': imageUrl
      });
      // Update local assets state
      setAssets(prev => prev.map(a => a.id === asset.id ? {...a, metadata: {...a.metadata, coverUrl: imageUrl}} : a));

      // Notify completion
      setError("Cover art generated!");
      setTimeout(() => setError(null), 3000);

    } catch (err: any) {
      console.error("Cover generation error:", err);
      setError(err.message || "Failed to generate cover.");
    } finally {
      setCoverGeneratingAssets(prev => {
        const next = new Set(prev);
        next.delete(asset.id);
        return next;
      });
    }
  };

  const handleFetchTimestampedLyrics = async (asset: MediaAsset) => {
    console.log("handleFetchTimestampedLyrics clicked for:", asset.id, "Metadata:", asset.metadata);
    
    // The asset metadata is where the task_id and id should be
    const taskId = asset.metadata?.task_id || asset.metadata?.taskId;
    const audioId = asset.metadata?.id || asset.metadata?.audioId;
    
    if (asset.type !== 'audio' || !taskId) {
       console.log("handleFetchTimestampedLyrics skipped: audio check or task_id missing", asset.type, taskId, asset.metadata);
       return;
    }
    
    if (!audioId) {
      console.log("handleFetchTimestampedLyrics skipped: audioId missing", asset.metadata);
      return;
    }

    // If we already have them, just show them
    if (asset.metadata?.timestampedLyrics) {
      setViewingLyrics(asset);
      return;
    }

    setLyricsLoadingAssets(prev => new Set(prev).add(asset.id));
    setError(null);

    try {
      const apiKey = (import.meta as any).env.VITE_SUNO_API_KEY;
      if (!apiKey) throw new Error('VITE_SUNO_API_KEY is required for lyrics');

      const response = await fetch('https://api.sunoapi.org/api/v1/generate/get-timestamped-lyrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          taskId: taskId,
          audioId: audioId
        })
      });

      if (!response.ok) throw new Error(`Lyric fetch failed: ${await response.text()}`);
      
      const jsonRes = await response.json();
      const lyricsData = jsonRes?.data?.response || jsonRes?.data || jsonRes;

      if (!lyricsData || (!lyricsData.lyrics && !lyricsData.segments)) {
         setError("No lyrics found for this track - it might be an instrumental.");
         setTimeout(() => setError(null), 3000);
         
         const { db } = await import('../lib/firebase');
         const { doc, updateDoc } = await import('firebase/firestore');
         const assetRef = doc(db, 'users', userId, 'media_assets', asset.id);
         await updateDoc(assetRef, {
           'metadata.timestampedLyrics': 'Instrumental / No Lyrics'
         });
         setAssets(prev => prev.map(a => a.id === asset.id ? {...a, metadata: {...a.metadata, timestampedLyrics: 'Instrumental / No Lyrics'}} : a));
         
         return;
      }

      // Update Firestore
      const { db } = await import('../lib/firebase');
      const { doc, updateDoc } = await import('firebase/firestore');
      const assetRef = doc(db, 'users', userId, 'media_assets', asset.id);
      
      await updateDoc(assetRef, {
        'metadata.timestampedLyrics': lyricsData
      });

      setViewingLyrics({
        ...asset,
        metadata: {
          ...asset.metadata,
          timestampedLyrics: lyricsData
        }
      });

    } catch (err: any) {
      console.error("Lyrics fetch error:", err);
      setError(err.message || "Failed to retrieve temporal lyrics.");
    } finally {
      setLyricsLoadingAssets(prev => {
        const next = new Set(prev);
        next.delete(asset.id);
        return next;
      });
    }
  };

  const handleDeleteAsset = async (asset: MediaAsset) => {
    if (!userId) return;
    try {
      const { db, storage } = await import('../lib/firebase');
      const { doc, deleteDoc } = await import('firebase/firestore');
      const { ref, deleteObject } = await import('firebase/storage');
      
      const assetRef = doc(db, 'users', userId, 'media_assets', asset.id);
      await deleteDoc(assetRef);
      
      if (asset.source === 'generated') {
        try {
          const storageRef = ref(storage, `uploads/generated/${userId}/${asset.id}_${asset.name}`);
          await deleteObject(storageRef);
        } catch (storageErr) {
          console.error("Failed to delete main asset from storage.", storageErr);
        }
        if (asset.metadata?.coverUrl || asset.type === 'audio') {
          try {
            const coverRef = ref(storage, `uploads/generated/${userId}/${asset.id}_cover.png`);
            await deleteObject(coverRef);
          } catch (storageErr) {
            console.error("Failed to delete cover art from storage.", storageErr);
          }
        }
      }
    } catch (err) {
      console.error("Failed to delete asset:", err);
    }
  };

  const getModelBadgeColors = (type: GenerationMode) => {
    switch (type) {
      case 'image': return 'from-purple-500 to-indigo-600 border-indigo-500 text-indigo-50';
      case 'video': return 'from-teal-400 to-cyan-600 border-teal-500 text-cyan-50';
      case 'music': return 'from-amber-400 to-orange-600 border-orange-500 text-orange-50';
      default: return 'from-gray-500 to-gray-700';
    }
  };

  const getBorderColor = (asset: MediaAsset) => {
    if (asset.source === 'uploaded') return theme === 'dark' ? 'border-[#333]' : 'border-gray-200';
    if (asset.type === 'image') return 'border-indigo-500 shadow-[0_0_15px_-3px_rgba(99,102,241,0.3)]';
    if (asset.type === 'video') return 'border-teal-500 shadow-[0_0_15px_-3px_rgba(20,184,166,0.3)]';
    if (asset.type === 'audio') return 'border-orange-500 shadow-[0_0_15px_-3px_rgba(249,115,22,0.3)]';
    return '';
  };

  return (
    <div className={`flex flex-col h-full ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
      {/* Studio Header */}
      <div className={`p-3 md:p-6 border-b ${theme === 'dark' ? 'border-[#333]' : 'border-gray-200'} flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4`}>
        <div>
          <h2 className="text-lg md:text-2xl font-black uppercase tracking-tight italic leading-none">Synthesis Studio</h2>
          <p className="text-[8px] md:text-xs font-mono opacity-60 uppercase tracking-widest mt-1">Multi-Modal Environment</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none no-scrollbar">
          {(['image', 'video', 'music'] as GenerationMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setActiveMode(mode)}
              className={`px-3 md:px-4 py-1.5 md:py-2 border-2 text-[10px] md:text-sm font-bold uppercase transition-all flex items-center gap-2 shrink-0 ${
                activeMode === mode 
                  ? theme === 'dark' ? 'border-white bg-white text-black' : 'border-black bg-black text-white'
                  : theme === 'dark' ? 'border-[#333] hover:border-gray-500' : 'border-gray-200 hover:border-gray-400'
              }`}
            >
              {mode === 'image' && <ImageIcon className="w-3 h-3 md:w-4 md:h-4" />}
              {mode === 'video' && <Video className="w-3 h-3 md:w-4 md:h-4" />}
              {mode === 'music' && <Music className="w-3 h-3 md:w-4 md:h-4" />}
              <span className={mode === activeMode ? 'inline' : 'hidden md:inline'}>{mode}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Left Console - Generation controls */}
        <div className={`w-full lg:w-1/3 border-b lg:border-b-0 lg:border-r ${theme === 'dark' ? 'border-[#333] bg-[#0A0A0A]' : 'border-gray-200 bg-gray-50'} p-4 md:p-6 flex flex-col lg:h-auto max-h-[100vh] lg:max-h-none`}>
          <div className="flex items-center gap-2 mb-4 md:mb-6 shrink-0">
            <Wand2 className="w-4 h-4 md:w-5 md:h-5 opacity-60" />
            <h3 className="font-bold uppercase tracking-widest text-[10px] md:text-sm">Composer Parameters</h3>
          </div>

          <div className="flex-1 space-y-4 md:space-y-6 overflow-y-auto min-h-0 pr-1 md:pr-4 history-scrollbar">
            <div className="space-y-2">
              <label className="text-[10px] md:text-xs font-mono uppercase opacity-60 font-bold block">Master Prompt</label>
              <textarea 
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                disabled={isGenerating}
                placeholder={`Describe the ${activeMode} you want to synthesize...`}
                className={`w-full p-3 md:p-4 border resize-none h-24 md:h-32 font-mono text-xs md:text-sm focus:outline-none transition-colors ${
                  theme === 'dark' 
                    ? 'bg-[#1A1A1A] border-[#333] focus:border-white' 
                    : 'bg-white border-gray-300 focus:border-black'
                } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
            </div>

            {error && (
              <div className="p-4 border-2 border-red-500/20 bg-red-500/5 text-red-500 text-[10px] font-mono flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            
            {/* Mock Advanced Settings based on mode */}
            <div className={`p-4 border ${theme === 'dark' ? 'border-[#333] bg-black/20' : 'border-gray-200 bg-white'}`}>
              <div className="flex items-center gap-2 mb-4">
                <Settings2 className="w-4 h-4 opacity-50" />
                <span className="text-xs uppercase font-bold tracking-widest">Model Config</span>
              </div>
              
              <div className="space-y-4">
                {activeMode === 'image' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase font-mono opacity-60 mb-1 block">Aspect Ratio</label>
                      <select 
                        value={aspectRatio}
                        onChange={e => setAspectRatio(e.target.value)}
                        disabled={isGenerating}
                        className={`w-full p-2 border text-xs font-mono ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333]' : 'bg-gray-50 border-gray-200'} ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <option value="1:1">1:1 Square</option>
                        <option value="4:3">4:3 Ratio</option>
                        <option value="3:4">3:4 Ratio</option>
                        <option value="16:9">16:9 Wide</option>
                        <option value="9:16">9:16 Vertical</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-mono opacity-60 mb-1 block">Style</label>
                      <select 
                        disabled={isGenerating}
                        className={`w-full p-2 border text-xs font-mono ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333]' : 'bg-gray-50 border-gray-200'} ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <option>Photorealistic</option>
                        <option>Cinematic</option>
                        <option>Digital Art</option>
                      </select>
                    </div>
                  </div>
                )}
                
                {activeMode === 'video' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase font-mono opacity-60 mb-1 block">Aspect Ratio</label>
                      <select 
                        value={aspectRatio === '1:1' ? '16:9' : aspectRatio} // Veo prefers 16:9 or 9:16
                        onChange={e => setAspectRatio(e.target.value)}
                        disabled={isGenerating}
                        className={`w-full p-2 border text-xs font-mono ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333]' : 'bg-gray-50 border-gray-200'} ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <option value="16:9">16:9 Landscape</option>
                        <option value="9:16">9:16 Portrait</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-mono opacity-60 mb-1 block">Resolution</label>
                      <select 
                        value={resolution}
                        onChange={e => setResolution(e.target.value)}
                        disabled={isGenerating}
                        className={`w-full p-2 border text-xs font-mono ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333]' : 'bg-gray-50 border-gray-200'} ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <option value="720p">720p HD</option>
                        <option value="1080p">1080p Full HD</option>
                        <option value="4k">4K Ultra HD</option>
                      </select>
                    </div>
                  </div>
                )}
                
                {activeMode === 'music' && (
                  <div className="flex flex-col gap-8 mt-2">
                    {/* Primary Controls */}
                    <div className={`p-5 border-2 transition-colors ${theme === 'dark' ? 'bg-[#141414] border-[#333]' : 'bg-gray-50/50 border-gray-200'}`}>
                      <div className="flex flex-col gap-5 mb-5">
                        <div>
                          <label className="text-[10px] uppercase font-mono opacity-60 mb-2 block tracking-wider">Model</label>
                          <select 
                            value={sunoModel}
                            onChange={e => setSunoModel(e.target.value)}
                            disabled={isGenerating}
                            className={`w-full p-2.5 border text-[11px] font-mono outline-none cursor-pointer ${theme === 'dark' ? 'bg-[#0A0A0A] border-[#333] text-[#F8F8F7]' : 'bg-white border-gray-300 text-black'} ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <option value="V5_5">V5.5 Customized</option>
                            <option value="V5">V5 Latest</option>
                            <option value="V4_5ALL">V4.5 ALL</option>
                            <option value="V4_5PLUS">V4.5 PLUS</option>
                            <option value="V4_5">V4.5</option>
                            <option value="V4">V4 Improved</option>
                          </select>
                        </div>
                        <div className="flex flex-wrap items-center gap-6">
                          <label className={`flex items-center gap-2 group ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                            <input 
                              type="checkbox" 
                              checked={sunoCustomMode}
                              onChange={e => setSunoCustomMode(e.target.checked)}
                              disabled={isGenerating}
                              className={`w-4 h-4 cursor-pointer accent-black ${theme === 'dark' ? 'bg-black border-[#333]' : ''} ${isGenerating ? 'cursor-not-allowed' : ''}`}
                            />
                            <span className="text-[11px] font-bold uppercase tracking-widest group-hover:opacity-100 opacity-80 transition-opacity">Custom Mode</span>
                          </label>
                          <label className={`flex items-center gap-2 group ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                            <input 
                              type="checkbox" 
                              checked={sunoInstrumental}
                              onChange={e => setSunoInstrumental(e.target.checked)}
                              disabled={isGenerating}
                              className={`w-4 h-4 cursor-pointer accent-black ${theme === 'dark' ? 'bg-black border-[#333]' : ''} ${isGenerating ? 'cursor-not-allowed' : ''}`}
                            />
                            <span className="text-[11px] font-bold uppercase tracking-widest group-hover:opacity-100 opacity-80 transition-opacity">Instrumental</span>
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-5 pt-5 border-t border-current/10">
                        <div>
                          <label className="text-[10px] uppercase font-mono opacity-60 mb-2 block tracking-wider">Song Title</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Neon Horizon"
                            value={sunoTitle}
                            onChange={e => setSunoTitle(e.target.value)}
                            disabled={isGenerating}
                            className={`w-full p-2.5 border text-[11px] font-mono outline-none focus:border-current transition-colors ${theme === 'dark' ? 'bg-[#0A0A0A] border-[#333] placeholder-[#555]' : 'bg-white border-gray-300 placeholder-gray-400'} ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                          />
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-[10px] uppercase font-mono opacity-60 tracking-wider">Style / Genre [{sunoStyles.length}]</label>
                            {sunoStyles.length > 0 && (
                              <button 
                                onClick={() => setSunoStyles([])}
                                className={`text-[9px] font-mono hover:opacity-100 opacity-60 uppercase transition-opacity ${theme === 'dark' ? 'text-white' : 'text-black'}`}
                              >
                                De-select All
                              </button>
                            )}
                          </div>
                          <div className={`flex gap-2 mb-2 ${isGenerating ? 'opacity-50' : ''}`}>
                            <input 
                              type="text"
                              value={newStyle}
                              onChange={(e) => setNewStyle(e.target.value)}
                              disabled={isGenerating}
                              placeholder="Add custom style (comma-separated)..."
                              className={`flex-1 p-2.5 border text-[11px] font-mono outline-none focus:border-current transition-colors ${theme === 'dark' ? 'bg-[#0A0A0A] border-[#333] placeholder-[#555]' : 'bg-white border-gray-300 placeholder-gray-400'} ${isGenerating ? 'cursor-not-allowed' : ''}`}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && newStyle.trim() && !isGenerating) {
                                  e.preventDefault();
                                  const vals = newStyle.split(',').map(v => v.trim()).filter(Boolean);
                                  let addedStyles = [...customStyles];
                                  let selectedStyles = [...sunoStyles];
                                  vals.forEach(val => {
                                    if (!addedStyles.includes(val) && !DEFAULT_STYLES.includes(val)) {
                                      addedStyles = [val, ...addedStyles];
                                    }
                                    if (!selectedStyles.includes(val)) {
                                      selectedStyles = [...selectedStyles, val];
                                    }
                                  });
                                  setCustomStyles(addedStyles);
                                  setSunoStyles(selectedStyles);
                                  setNewStyle("");
                                }
                              }}
                            />
                            <button 
                              onClick={() => {
                                if (newStyle.trim()) {
                                  const vals = newStyle.split(',').map(v => v.trim()).filter(Boolean);
                                  let addedStyles = [...customStyles];
                                  let selectedStyles = [...sunoStyles];
                                  vals.forEach(val => {
                                    if (!addedStyles.includes(val) && !DEFAULT_STYLES.includes(val)) {
                                      addedStyles = [val, ...addedStyles];
                                    }
                                    if (!selectedStyles.includes(val)) {
                                      selectedStyles = [...selectedStyles, val];
                                    }
                                  });
                                  setCustomStyles(addedStyles);
                                  setSunoStyles(selectedStyles);
                                  setNewStyle("");
                                }
                              }}
                              disabled={isGenerating || !newStyle.trim()}
                              className={`px-1 py-2.5 border text-[11px] font-mono uppercase tracking-widest transition-colors ${theme === 'dark' ? 'bg-[#0A0A0A] border-[#333] text-white hover:bg-white hover:text-black' : 'bg-white border-gray-300 text-black hover:bg-black hover:text-white'} ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              Add
                            </button>
                          </div>
                          <div className={`w-full border max-h-40 overflow-y-auto p-4 space-y-3 scrollbar-thin ${
                            theme === 'dark' 
                              ? 'bg-[#0A0A0A] border-[#333] scrollbar-thumb-[#333] scrollbar-track-transparent' 
                              : 'bg-white border-gray-300 scrollbar-thumb-gray-200 scrollbar-track-transparent'
                          }`}>
                            {Array.from(new Set([...customStyles, ...DEFAULT_STYLES])).map((style, idx) => (
                              <label key={`style-seg-${style}`} className={`flex items-center gap-3 group/item ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                                <div className="relative flex items-center justify-center">
                                  <input 
                                    type="checkbox"
                                    checked={sunoStyles.includes(style)}
                                    disabled={isGenerating}
                                    onChange={(e) => {
                                      if (isGenerating) return;
                                      const newStyleList = e.target.checked 
                                        ? [...sunoStyles, style]
                                        : sunoStyles.filter(a => a !== style);
                                      setSunoStyles(newStyleList);
                                    }}
                                    className={`peer appearance-none w-4 h-4 border transition-colors ${
                                      theme === 'dark' 
                                        ? 'border-[#333] bg-[#141414] checked:bg-white checked:border-white' 
                                        : 'border-gray-300 bg-white checked:bg-black checked:border-black'
                                    } ${isGenerating ? 'cursor-not-allowed' : ''}`}
                                  />
                                  <Check className={`w-2.5 h-2.5 absolute opacity-0 peer-checked:opacity-100 pointer-events-none ${theme === 'dark' ? 'text-black' : 'text-white'}`} />
                                </div>
                                <span className={`text-[11px] font-mono transition-colors ${sunoStyles.includes(style) ? 'font-bold' : 'opacity-60 group-hover/item:opacity-100'}`}>
                                  {style}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Secondary Controls */}
                    <div className="flex flex-col gap-8">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-current/10">
                          <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">Vocals & Modifiers</span>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <label className="text-[9px] uppercase font-mono opacity-60 mb-2 block tracking-wider">Vocal Gender</label>
                            <select 
                              value={sunoVocalGender}
                              onChange={e => setSunoVocalGender(e.target.value)}
                              disabled={isGenerating}
                              className={`w-full p-2 border text-[10px] font-mono outline-none cursor-pointer ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333]' : 'bg-gray-50 border-gray-200'} ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <option value="">Any</option>
                              <option value="m">Male</option>
                              <option value="f">Female</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] uppercase font-mono opacity-60 mb-2 block tracking-wider">Negative Tags</label>
                            <input 
                              type="text" 
                              placeholder="e.g. Heavy Metal"
                              value={sunoNegativeTags}
                              onChange={e => setSunoNegativeTags(e.target.value)}
                              disabled={isGenerating}
                              className={`w-full p-2 border text-[10px] font-mono outline-none focus:border-current ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333] placeholder-[#555]' : 'bg-gray-50 border-gray-200 placeholder-gray-400'} ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-current/10">
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${!sunoCustomMode ? 'opacity-30' : 'opacity-50'}`}>
                            Persona {sunoCustomMode ? '' : '(Custom Mode Only)'}
                          </span>
                        </div>
                        <div className={`grid grid-cols-1 gap-4 transition-opacity ${!sunoCustomMode ? 'opacity-40' : 'opacity-100'}`}>
                          <div>
                            <label className="text-[9px] uppercase font-mono opacity-60 mb-2 block tracking-wider">Persona ID</label>
                            <input 
                              type="text" 
                              disabled={isGenerating || !sunoCustomMode}
                              placeholder="e.g. persona_123"
                              value={sunoPersonaId}
                              onChange={e => setSunoPersonaId(e.target.value)}
                              className={`w-full p-2 border text-[10px] font-mono outline-none focus:border-current ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333] placeholder-[#555]' : 'bg-gray-50 border-gray-200 placeholder-gray-400'} ${(!sunoCustomMode || isGenerating) ? 'cursor-not-allowed opacity-50' : ''}`}
                            />
                          </div>
                          <div>
                            <label className="text-[9px] uppercase font-mono opacity-60 mb-2 block tracking-wider">Persona Model</label>
                            <select 
                              disabled={isGenerating || !sunoCustomMode}
                              value={sunoPersonaModel}
                              onChange={e => setSunoPersonaModel(e.target.value)}
                              className={`w-full p-2 border text-[10px] font-mono outline-none cursor-pointer ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333]' : 'bg-gray-50 border-gray-200'} ${(!sunoCustomMode || isGenerating) ? 'cursor-not-allowed opacity-50' : ''}`}
                            >
                              <option value="">Default</option>
                              <option value="style_persona">Style</option>
                              {(sunoModel === 'V5' || sunoModel === 'V5_5') && (
                                <option value="voice_persona">Voice</option>
                              )}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Weights & Constraints */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-current/10">
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">Parameters & Weights</span>
                      </div>
                      <div className="grid grid-cols-1 gap-6">
                        <div className={`p-4 border ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
                          <label className="flex items-center justify-between text-[9px] uppercase font-mono mb-3 tracking-wider">
                            <span className="opacity-70">Style Weight</span>
                            <span className="font-bold opacity-100">{sunoStyleWeight.toFixed(2)}</span>
                          </label>
                          <input 
                            type="range" min="0" max="1" step="0.05"
                            value={sunoStyleWeight} onChange={e => setSunoStyleWeight(parseFloat(e.target.value))}
                            disabled={isGenerating}
                            className={`w-full h-1 bg-current/20 appearance-none rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-current [&::-webkit-slider-thumb]:rounded-full ${isGenerating ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                          />
                        </div>
                        <div className={`p-4 border ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
                          <label className="flex items-center justify-between text-[9px] uppercase font-mono mb-3 tracking-wider">
                            <span className="opacity-70">Weirdness</span>
                            <span className="font-bold opacity-100">{sunoWeirdnessConstraint.toFixed(2)}</span>
                          </label>
                          <input 
                            type="range" min="0" max="1" step="0.05"
                            value={sunoWeirdnessConstraint} onChange={e => setSunoWeirdnessConstraint(parseFloat(e.target.value))}
                            disabled={isGenerating}
                            className={`w-full h-1 bg-current/20 appearance-none rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-current [&::-webkit-slider-thumb]:rounded-full ${isGenerating ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                          />
                        </div>
                        <div className={`p-4 border ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
                          <label className="flex items-center justify-between text-[9px] uppercase font-mono mb-3 tracking-wider">
                            <span className="opacity-70">Audio Weight</span>
                            <span className="font-bold opacity-100">{sunoAudioWeight.toFixed(2)}</span>
                          </label>
                          <input 
                            type="range" min="0" max="1" step="0.05"
                            value={sunoAudioWeight} onChange={e => setSunoAudioWeight(parseFloat(e.target.value))}
                            disabled={isGenerating}
                            className={`w-full h-1 bg-current/20 appearance-none rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-current [&::-webkit-slider-thumb]:rounded-full ${isGenerating ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <button 
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className={`w-full p-4 font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all mt-6 flex-shrink-0 ${
              isGenerating 
                ? 'opacity-50 cursor-not-allowed bg-gray-500 text-white' 
                : `bg-gradient-to-r ${getModelBadgeColors(activeMode)} shadow-lg hover:shadow-xl hover:-translate-y-0.5`
            }`}
          >
            {isGenerating ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Wand2 className="w-5 h-5" />
            )}
            <div className="flex flex-col items-center">
              <span>{isGenerating ? 'Synthesizing...' : `Generate ${activeMode}`}</span>
              {!isGenerating && (
                <span className="text-[10px] opacity-60 font-mono tracking-tighter">
                  -{GENERATION_COSTS[activeMode]} CREDITS
                </span>
              )}
            </div>
          </button>
        </div>

        {/* Right Console - Assets File Manager */}
        <div className={`flex-1 flex flex-col overflow-hidden border-l border-t lg:border-t-0 ${theme === 'dark' ? 'border-[#333] bg-[#0A0A0A]' : 'border-gray-200 bg-white'}`}>
          <div className={`p-4 md:p-6 lg:p-8 flex items-center justify-between border-b ${theme === 'dark' ? 'border-[#333]' : 'border-gray-200'}`}>
            <div className="flex flex-col">
              <h3 className="font-black uppercase tracking-widest text-lg flex items-center gap-3">
                <Upload className="w-5 h-5 opacity-60" />
                Synthesis Library
              </h3>
              <p className="text-[10px] font-mono opacity-50 uppercase tracking-[0.2em] mt-1">Stored generations and uploads</p>
            </div>
            <div className="px-3 py-1 border-2 font-mono text-xs font-bold tracking-widest uppercase opacity-60">
              {assets.length} Entry_Points
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            {assets.length === 0 ? (
              <div className={`w-full h-full min-h-[300px] flex flex-col items-center justify-center border-2 border-dashed ${theme === 'dark' ? 'border-[#333] text-[#F8F8F7]' : 'border-gray-300 text-black'}`}>
                <div className={`p-4 rounded-full mb-4 ${theme === 'dark' ? 'bg-[#1A1A1A]' : 'bg-gray-100'}`}>
                  < ImageIcon className="w-8 h-8 opacity-40" />
                </div>
                <h4 className="text-sm font-bold uppercase tracking-widest mb-2">No Assets Generated</h4>
                <p className="text-[10px] font-mono opacity-50 uppercase tracking-widest text-center max-w-xs">
                  Generate images, videos, or audio tracks to populate your synthesis library.
                </p>
              </div>
            ) : (
              <div className={`overflow-x-auto border-2 ${theme === 'dark' ? 'border-[#333]' : 'border-gray-200'}`}>
                <table className="w-full text-left border-collapse min-w-[800px]">
                <thead className={`border-b-2 ${theme === 'dark' ? 'border-[#333] bg-[#141414]' : 'border-gray-200 bg-gray-50'}`}>
                  <tr className="text-[9px] uppercase font-mono tracking-widest opacity-60">
                    <th className="py-4 px-4 font-normal">Asset</th>
                    <th className="py-4 px-4 font-normal">Type & Source</th>
                    <th className="py-4 px-4 font-normal">Details & Metadata</th>
                    <th className="py-4 px-4 font-normal text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {assets.map((asset) => (
                      <motion.tr
                        key={asset.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`group border-b last:border-b-0 transition-colors ${
                          theme === 'dark' ? 'border-[#222] hover:bg-[#141414]' : 'border-gray-100 hover:bg-gray-50'
                        }`}
                      >
                        {/* Name and Preview */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-4">
                            <div 
                              onClick={() => {
                                if ((asset.type === 'audio' || asset.type === 'video') && (asset.metadata?.coverUrl || asset.metadata?.imageUrl)) {
                                  setViewingCover(asset);
                                } else if (asset.type === 'image' && asset.url) {
                                  setViewingCover(asset);
                                }
                              }}
                              className={`w-12 h-12 flex-shrink-0 border-2 flex items-center justify-center relative overflow-hidden bg-black/5 dark:bg-white/5 transition-transform ${(asset.metadata?.coverUrl || asset.metadata?.imageUrl || (asset.type === 'image' && asset.url)) ? 'cursor-pointer hover:scale-105 active:scale-95' : ''} ${getBorderColor(asset).split(' ')[0]}`}
                            >
                              {(asset.metadata?.coverUrl || asset.metadata?.imageUrl) && (asset.type === 'audio' || asset.type === 'video') ? (
                                <img src={asset.metadata.coverUrl || asset.metadata.imageUrl} referrerPolicy="no-referrer" alt="" className="absolute inset-0 w-full h-full object-cover object-center" />
                              ) : asset.type === 'image' && asset.url ? (
                                <img src={asset.url} referrerPolicy="no-referrer" alt="" className="absolute inset-0 w-full h-full object-cover object-center" />
                              ) : (
                                <>
                                  {asset.metadata?.imageUrl && asset.type === 'audio' && (
                                    <img src={asset.metadata.imageUrl} referrerPolicy="no-referrer" alt="" className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-overlay object-center" />
                                  )}
                                  {asset.type === 'image' && !asset.url && <ImageIcon className="w-4 h-4 opacity-50 relative z-10" />}
                                  {asset.type === 'video' && <Video className="w-4 h-4 opacity-50 relative z-10" />}
                                  {asset.type === 'audio' && <Music className="w-4 h-4 opacity-50 relative z-10" />}
                                </>
                              )}
                            </div>
                            <div className="flex flex-col min-w-0">
                               <span className="font-bold text-sm uppercase tracking-tight truncate max-w-[200px] mb-1" title={asset.name}>{asset.name}</span>
                               <span className="text-[9px] font-mono opacity-50 uppercase tracking-widest">
                                 {new Date(asset.timestamp).toLocaleDateString()} {new Date(asset.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                               </span>
                            </div>
                          </div>
                        </td>

                        {/* Type and Source */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <div className="flex flex-col items-start gap-2">
                             <div 
                               onClick={() => {
                                 if (asset.type === 'audio') {
                                   setViewingAssetDetails(asset);
                                 }
                               }}
                               className={`px-2 py-1 text-[8px] uppercase font-mono font-black tracking-widest border transition-all ${getBorderColor(asset).split(' ')[0]} ${asset.type === 'audio' ? 'cursor-pointer hover:bg-zinc-900 hover:text-white dark:hover:bg-zinc-100 dark:hover:text-zinc-900 hover:scale-105 active:scale-95' : ''}`}
                             >
                               {asset.type}
                             </div>
                             {asset.source === 'uploaded' ? (
                               <div className="text-[9px] uppercase font-mono font-bold tracking-widest opacity-40">
                                 USR_RAW
                               </div>
                             ) : (
                               <div className="flex flex-col">
                                 <div className={`text-[10px] uppercase font-mono font-bold bg-clip-text text-transparent bg-gradient-to-r ${getModelBadgeColors(asset.type as GenerationMode)}`}>
                                   {asset.model}
                                 </div>
                                 {asset.metadata?.generationTimeMs && (
                                   <div className="text-[8px] font-mono opacity-40 mt-0.5">
                                     GEN: {(asset.metadata.generationTimeMs / 1000).toFixed(1)}s
                                   </div>
                                 )}
                               </div>
                             )}
                          </div>
                        </td>

                        {/* Details and Metadata */}
                        <td className="py-4 px-4">
                          <div className="flex flex-col items-start justify-center max-w-[300px]">
                            {asset.type === 'audio' && asset.url && (
                              <div className="mb-2 w-full">
                                <audio src={asset.url} controls className="w-full max-w-[200px] h-7 grayscale opacity-80 hover:opacity-100 transition-opacity mix-blend-luminosity" />
                              </div>
                            )}
                            {asset.source === 'generated' && asset.metadata ? (
                              <div className="flex flex-col gap-1 w-full relative">
                                <span className={`text-[11px] font-mono italic leading-relaxed line-clamp-2 pr-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} title={asset.metadata.prompt}>
                                  "{asset.metadata.prompt}"
                                </span>
                                {(asset.metadata.title || asset.metadata.tags || asset.metadata.duration) && (
                                  <div className="flex flex-wrap gap-2 text-[9px] font-mono uppercase tracking-widest opacity-50 mt-1">
                                     {asset.metadata.title && <span>{asset.metadata.title}</span>}
                                     {asset.metadata.duration && <span>• {asset.metadata.duration}s</span>}
                                     {asset.metadata.tags && <span className="truncate max-w-[150px]">• {asset.metadata.tags}</span>}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] font-mono opacity-30 uppercase tracking-widest">No Context Data</span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          <div className={`flex items-center justify-end gap-2 transition-opacity ${asset.url ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                             {(asset.type === 'audio' || asset.type === 'video') && asset.source === 'generated' && (
                               <button 
                                 onClick={(e) => { e.stopPropagation(); handleGenerateCover(asset); }}
                                 disabled={coverGeneratingAssets.has(asset.id)}
                                 className={`p-2 rounded-none border-2 transition-colors flex items-center gap-2 ${
                                   theme === 'dark' ? 'border-amber-500/30 text-amber-500 hover:bg-amber-600 hover:text-white' : 'border-amber-500/30 text-amber-600 hover:bg-amber-600 hover:text-white'
                                 } ${coverGeneratingAssets.has(asset.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                 title={`Generate ${asset.type === 'audio' ? 'Song' : 'Video'} Cover`}
                               >
                                 {coverGeneratingAssets.has(asset.id) ? (
                                   <RefreshCw className="w-3 h-3 animate-spin" />
                                 ) : (
                                   <Sparkles className="w-3 h-3" />
                                 )}
                                 <span className="text-[9px] font-bold uppercase tracking-widest hidden xl:inline">
                                   {coverGeneratingAssets.has(asset.id) ? 'Painting...' : 'Cover'}
                                 </span>
                               </button>
                            )}
                            {asset.type === 'audio' && asset.source === 'generated' && (
                               <button 
                                 onClick={(e) => { e.stopPropagation(); handleFetchTimestampedLyrics(asset); }}
                                 disabled={lyricsLoadingAssets.has(asset.id)}
                                 className={`p-2 rounded-none border-2 transition-colors flex items-center gap-2 ${
                                   theme === 'dark' ? 'border-indigo-500/30 text-indigo-400 hover:bg-indigo-500 hover:text-black' : 'border-indigo-500/30 text-indigo-600 hover:bg-indigo-500 hover:text-white'
                                 } ${lyricsLoadingAssets.has(asset.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                 title="View Temporal Lyrics"
                               >
                                 {lyricsLoadingAssets.has(asset.id) ? (
                                   <RefreshCw className="w-3 h-3 animate-spin" />
                                 ) : (
                                   <Wand2 className="w-3 h-3" />
                                 )}
                                 <span className="text-[9px] font-bold uppercase tracking-widest hidden xl:inline">
                                   {lyricsLoadingAssets.has(asset.id) ? 'Decoding...' : 'Lyrics'}
                                 </span>
                               </button>
                            )}
                            {asset.source === 'generated' && (
                              <button 
                                onClick={() => onAddAssetToNarrative?.(asset)}
                                className={`p-2 rounded-none border-2 transition-colors group-hover:border-current flex items-center gap-2 ${
                                  theme === 'dark' ? 'border-[#333] hover:bg-white hover:text-black hover:border-white' : 'border-gray-200 hover:bg-black hover:text-white hover:border-black'
                                }`}
                                title="Add to Narrative Context"
                              >
                                <BookOpen className="w-3 h-3" />
                                <span className="text-[9px] font-bold uppercase tracking-widest hidden xl:inline">Insert</span>
                              </button>
                            )}
                            <button 
                              onClick={() => {
                                if (asset.url) {
                                  window.open(asset.url, '_blank');
                                }
                              }}
                              className={`p-2 rounded-none border-2 transition-colors ${
                              theme === 'dark' ? 'border-[#333] hover:border-white' : 'border-gray-200 hover:border-black'
                            }`} title="Download / Open">
                              <Download className="w-3 h-3" />
                            </button>
                            <button 
                              onClick={() => handleDeleteAsset(asset)}
                              className="p-2 rounded-none border-2 border-transparent hover:border-red-500 text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-colors" title="Purge Record">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Cover Details Modal */}
      <AnimatePresence>
        {viewingCover && (
          <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
             onClick={() => setViewingCover(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className={`w-full max-w-[400px] max-h-[90vh] overflow-hidden border-4 ${theme === 'dark' ? 'bg-[#0A0A0A] border-[#333]' : 'bg-white border-black'} shadow-2xl`}
              onClick={e => e.stopPropagation()}
            >
              <div className="relative aspect-square w-full">
                <img 
                  src={viewingCover.url || viewingCover.metadata?.coverUrl || viewingCover.metadata?.imageUrl} 
                  alt={viewingCover.name}
                  className="w-full h-full object-cover object-center"
                  referrerPolicy="no-referrer"
                />
                <button 
                  onClick={() => setViewingCover(null)}
                  className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 md:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg md:text-xl font-black uppercase italic leading-none">{viewingCover.metadata?.title || viewingCover.name}</h3>
                    <p className="text-[10px] font-mono opacity-50 uppercase tracking-[0.2em] mt-2">{viewingCover.type === 'audio' ? 'Music Cover Artifact' : viewingCover.type === 'video' ? 'Video Cover Artifact' : 'Image Artifact'}</p>
                  </div>
                  {viewingCover.type === 'audio' ? <Music className="w-5 h-5 opacity-40 shrink-0" /> : viewingCover.type === 'video' ? <Video className="w-5 h-5 opacity-40 shrink-0" /> : <ImageIcon className="w-5 h-5 opacity-40 shrink-0" />}
                </div>
                
                <div className="p-3 border border-current/10 bg-current/5 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[9px] uppercase font-mono opacity-40 block mb-1">Source Token</span>
                      <p className="text-[10px] font-mono font-bold truncate">{viewingCover.metadata?.task_id || viewingCover.id}</p>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-mono opacity-40 block mb-1">Generated</span>
                      <p className="text-[10px] font-mono font-bold">{new Date(viewingCover.timestamp).toLocaleDateString()}</p>
                    </div>
                  </div>
                  {viewingCover.metadata?.tags && (
                    <div>
                      <span className="text-[9px] uppercase font-mono opacity-40 block mb-1">Atmosphere</span>
                      <p className="text-[10px] font-mono line-clamp-2">{viewingCover.metadata.tags}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {viewingCover.url && (
                    <button 
                      onClick={() => window.open(viewingCover.url, '_blank')}
                      className={`flex-1 p-2.5 font-bold uppercase tracking-widest text-[9px] md:text-[10px] flex items-center justify-center gap-2 border-2 ${
                        theme === 'dark' ? 'bg-white text-black border-white' : 'bg-black text-white border-black'
                      } hover:opacity-90 transition-all`}
                    >
                      <Download className="w-3.5 h-3.5" /> Download
                    </button>
                  )}
                  <button 
                    onClick={() => {
                        const link = document.createElement('a');
                        link.href = viewingCover.url || viewingCover.metadata?.coverUrl || viewingCover.metadata?.imageUrl;
                        link.download = `cover_${viewingCover.name}.png`;
                        link.target = '_blank';
                        link.click();
                    }}
                    className={`flex-1 p-2.5 font-bold uppercase tracking-widest text-[9px] md:text-[10px] flex items-center justify-center gap-2 border-2 ${
                      theme === 'dark' ? 'border-[#333] hover:border-white' : 'border-gray-200 hover:border-black'
                    } transition-all`}
                  >
                    Save Art
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Asset Details Modal */}
      <AnimatePresence>
        {viewingAssetDetails && (
          <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
             onClick={() => setViewingAssetDetails(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className={`w-full max-w-[500px] max-h-[85vh] overflow-hidden border-4 ${theme === 'dark' ? 'bg-[#0A0A0A] border-[#333]' : 'bg-white border-black'} shadow-2xl flex flex-col`}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-current/10">
                <div className="flex items-center gap-3">
                  <Music className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-sm font-black uppercase tracking-widest italic">{viewingAssetDetails.name}</h3>
                </div>
                <button onClick={() => setViewingAssetDetails(null)} className="p-1 hover:opacity-50 transition-opacity">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {/* Visual Header */}
                <div className="flex gap-4 items-start">
                  <div className={`w-24 h-24 shrink-0 border-2 ${theme === 'dark' ? 'border-[#333]' : 'border-black'} relative overflow-hidden bg-black/5`}>
                    {(viewingAssetDetails.metadata?.coverUrl || viewingAssetDetails.metadata?.imageUrl) ? (
                      <img 
                        src={viewingAssetDetails.metadata.coverUrl || viewingAssetDetails.metadata.imageUrl} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        alt=""
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music className="w-8 h-8 opacity-20" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 min-w-0">
                    <p className="text-[10px] uppercase font-mono opacity-40">Composition Details</p>
                    <h4 className="text-lg font-bold truncate leading-tight uppercase italic">{viewingAssetDetails.metadata?.title || 'Untitled Work'}</h4>
                    <div className="flex flex-wrap gap-2 pt-2">
                       {viewingAssetDetails.metadata?.tags?.split(' ').slice(0, 5).map((tag: string, i: number) => (
                         <span key={i} className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-500 text-[8px] font-mono uppercase tracking-tighter border border-indigo-500/20">
                            {tag}
                         </span>
                       ))}
                    </div>
                  </div>
                </div>

                {/* Prompt Section */}
                <div className="space-y-2">
                   <div className="flex items-center gap-2">
                     <div className="h-[1px] flex-1 bg-current/10" />
                     <span className="text-[10px] font-mono uppercase opacity-40 tracking-widest">Genetic Prompt</span>
                     <div className="h-[1px] flex-1 bg-current/10" />
                   </div>
                   <div className={`p-4 border font-mono text-[11px] leading-relaxed italic ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white/80' : 'bg-black/5 border-black/10 text-black/80'}`}>
                      {viewingAssetDetails.metadata?.prompt || 'No prompt recorded.'}
                   </div>
                </div>

                {/* Technical Specs */}
                <div className="grid grid-cols-2 gap-px bg-current/10 border border-current/10 overflow-hidden">
                  {[
                    { label: 'Artifact ID', value: viewingAssetDetails.metadata?.task_id || viewingAssetDetails.id },
                    { label: 'Model Core', value: viewingAssetDetails.metadata?.model_name || 'Suno v3.5' },
                    { label: 'Synthesis Status', value: 'Complete' },
                    { label: 'Temporal Signature', value: new Date(viewingAssetDetails.timestamp).toLocaleString() }
                  ].map((spec, i) => (
                    <div key={i} className={`p-3 ${theme === 'dark' ? 'bg-[#0A0A0A]' : 'bg-white'}`}>
                      <span className="text-[9px] uppercase font-mono opacity-40 block mb-0.5">{spec.label}</span>
                      <p className="text-[10px] font-mono font-bold truncate tracking-tight">{spec.value}</p>
                    </div>
                  ))}
                </div>

                {/* Lyrics Section if available */}
                {viewingAssetDetails.metadata?.lyrics && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                       <div className="h-[1px] flex-1 bg-current/10" />
                       <span className="text-[10px] font-mono uppercase opacity-40 tracking-widest">Transcribed Script</span>
                       <div className="h-[1px] flex-1 bg-current/10" />
                    </div>
                    <pre className={`p-4 border font-mono text-[10px] max-h-40 overflow-y-auto whitespace-pre-wrap ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
                       {viewingAssetDetails.metadata.lyrics}
                    </pre>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-current/10 bg-current/5">
                <button 
                  onClick={() => setViewingAssetDetails(null)}
                  className={`w-full p-2.5 font-bold uppercase tracking-widest text-[10px] border-2 ${
                    theme === 'dark' ? 'bg-white text-black border-white' : 'bg-black text-white border-black'
                  } hover:opacity-90 transition-all`}
                >
                  Close Artifact Details
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lyrics Modal */}
      <AnimatePresence>
        {viewingLyrics && (
          <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
             onClick={() => setViewingLyrics(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className={`w-full max-w-lg max-h-[80vh] flex flex-col border-4 ${theme === 'dark' ? 'bg-[#0A0A0A] border-[#333]' : 'bg-white border-black'} shadow-2xl overflow-hidden`}
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 border-b border-current/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BookOpen className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-sm font-black uppercase tracking-[0.2em]">{viewingLyrics.name} // Temporal Lyrics</h3>
                </div>
                <button onClick={() => setViewingLyrics(null)} className="p-1 hover:opacity-50 transition-opacity">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar">
                {viewingLyrics.metadata?.timestampedLyrics?.segments ? (
                  <div className="space-y-6">
                    {viewingLyrics.metadata.timestampedLyrics.segments.map((segment: any, idx: number) => (
                      <div key={idx} className="group flex gap-4">
                        <div className="w-12 shrink-0 font-mono text-[10px] opacity-30 pt-1">
                          {(segment.start_time / 1000).toFixed(1)}s
                        </div>
                        <div className={`p-4 border-l-2 transition-colors ${theme === 'dark' ? 'border-white/10 group-hover:border-indigo-500 bg-white/5' : 'border-black/10 group-hover:border-indigo-500 bg-black/5'}`}>
                           <p className="text-sm md:text-base font-medium leading-relaxed italic">
                             {segment.text}
                           </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20 px-10 space-y-4">
                    <Music className="w-12 h-12 opacity-10 mx-auto" />
                    <p className="text-xs font-mono uppercase opacity-40">Synthetic transcription yielded no segments. This track may be purely sonic.</p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-current/10 bg-current/5">
                <button 
                  onClick={() => setViewingLyrics(null)}
                  className={`w-full p-3 font-bold uppercase tracking-widest text-xs border-2 ${
                    theme === 'dark' ? 'bg-white text-black border-white' : 'bg-black text-white border-black'
                  } hover:opacity-90 transition-all`}
                >
                  Return to Studio
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
>>>>>>> Stashed changes
