import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { marked } from "marked";
import { 
  Upload, 
  FileVideo, 
  FileAudio,
  FileImage,
  FileText,
  Eye,
  Settings2, 
  Sparkles, 
  Type as LucideType, 
  Loader2, 
  ChevronRight, 
  CheckCircle2,
  AlertCircle,
  Clock,
  Check,
  Copy,
  Layout,
  Download,
  BookOpen,
  X,
  Plus,
  Trash2,
  Sun,
  Moon,
  LogIn,
  LogOut,
  Wand2
} from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { GoogleGenAI } from "@google/genai";
import * as mammoth from "mammoth";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { AuthGuard } from "./components/auth/AuthGuard";
import { UserButton } from "./components/auth/AuthUI";
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { auth, db, storage, handleFirestoreError, OperationType } from "./lib/firebase";
import { onSnapshot, doc, getDoc, setDoc, serverTimestamp, runTransaction, collection, query, where, orderBy, addDoc, updateDoc, deleteDoc, getDocs, increment } from "firebase/firestore";

// Initialize Gemini directly on the frontend as per AI Studio guidelines
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface BlogPreferences {
  targetAudience: string[];
  tone: string[];
  length: string;
  specificFocus: string;
  model: string;
}

type UploadState = 'PENDING' | 'UPLOADING' | 'PROCESSING' | 'ACTIVE' | 'FAILED';

interface MediaFile {
  id: string;
  file?: File;
  status: UploadState;
  name?: string;
  uri?: string;
  mimeType?: string;
  previewUrl?: string;
  firestoreId?: string;
  progress?: number;
  size?: number;
  type?: 'video' | 'audio' | 'image';
  extractedText?: string;
  storageUrl?: string;
}

interface AttachedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  data?: string; // base64 (deprecated for new files)
  storageUrl?: string;
  uri?: string;
  mimeType?: string;
  extractedText?: string;
}

import { AdminDashboard } from "./components/AdminDashboard";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { Header } from "./components/layout/Header";
import { GenerationViewer } from "./components/GenerationViewer";

const getOpenRouterCategory = (m: any) => {
  const id = m.id.toLowerCase();
  const mod = m.architecture?.modality || "";

  if (mod.includes("embedding") || id.includes("embed") || id.includes("bge-")) return "3. Embeddings";
  if (id.includes("rerank")) return "6. Rerank";
  if (id.includes("whisper") || id.includes("transcri")) return "8. Transcription";
  if (mod.includes("speech") || id.includes("tts") || id.includes("elevenlabs") || id.includes("speak") || id.includes("parler")) return "7. Speech";
  if (mod.includes("audio") || id.includes("music") || id.includes("suno") || id.includes("udio")) return "4. Audio";
  if (mod.includes("video") || id.includes("video") || id.includes("luma") || id.includes("runway") || id.includes("kling") || id.includes("minimax/video") || id.includes("sora") || id.includes("haiper")) return "5. Video";
  if (mod.includes("image") || id.includes("dall-e") || id.includes("flux") || id.includes("stable-diffusion") || id.includes("midjourney") || id.includes("recraft") || id.includes("ideogram") || id.includes("black-forest-labs") || id.includes("stabilityai")) return "2. Image";
  return "1. Text";
};

export default function App() {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [blogPost, setBlogPost] = useState<string | null>(null);
  const [originalContent, setOriginalContent] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [genToDelete, setGenToDelete] = useState<string | null>(null);
  const [mediaFileToDelete, setMediaFileToDelete] = useState<MediaFile | null>(null);
  const [viewMode, setViewMode] = useState<"preview" | "raw" | "html">("preview");
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewMedia, setPreviewMedia] = useState<MediaFile | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      if (saved === "light" || saved === "dark") return saved;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  });
  const [preferences, setPreferences] = useState<BlogPreferences>({
    targetAudience: [],
    tone: [],
    length: "Medium (approx. 600 words)",
    specificFocus: "Unique narrative stories.",
    model: "gemini-3-flash-preview",
  });
  const [openRouterModels, setOpenRouterModels] = useState<any[]>([]);
  const [credits, setCredits] = useState<number | null>(null);
  const [hasOpenRouterKey, setHasOpenRouterKey] = useState(false);
  const [isGeneratingFocus, setIsGeneratingFocus] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null);
  const [currentAttachedFiles, setCurrentAttachedFiles] = useState<AttachedFile[]>([]);
  const [historySortBy, setHistorySortBy] = useState<'updatedAt' | 'createdAt'>('updatedAt');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [viewerContent, setViewerContent] = useState<{ content: string; title: string } | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const loadingMessages = [
    { title: "Initializing_Protocol", detail: "ESTABLISHING SECURE UPLINK TO MULTIMODAL CORES..." },
    { title: "Analyzing_Data_Streams", detail: "EXTRACTING SEMANTIC VECTORS FROM SOURCE MEDIA..." },
    { title: "Synthesizing_Narrative", detail: "MAPPING CONTENT TO TARGET AUDIENCE SEGMENTS..." },
    { title: "Refining_Voice_Profile", detail: "APPLYING SELECTED TONE AND ATTRIBUTE LAYERS..." },
    { title: "Structuring_Layout", detail: "OPTIMIZING HIERARCHY AND MARKDOWN ARCHITECTURE..." },
    { title: "Finalizing_Synthesis", detail: "PERFORMING FINAL HEURISTIC POLISH..." }
  ];

  useEffect(() => {
    let interval: any;
    if (isProcessing) {
      interval = setInterval(() => {
        setLoadingMessageIndex((prev) => (prev + 1) % loadingMessages.length);
      }, 2500);
    } else {
      setLoadingMessageIndex(0);
    }
    return () => clearInterval(interval);
  }, [isProcessing]);

  useEffect(() => {
    fetch("/api/ai/openrouter/models")
      .then(res => res.json())
      .then(data => {
        if (data.data) {
          // Deduplicate by model id
          const uniqueModelsMap = new Map();
          data.data.forEach((m: any) => uniqueModelsMap.set(m.id, m));
          const uniqueModels = Array.from(uniqueModelsMap.values());
          const sorted = uniqueModels.sort((a: any, b: any) => a.name.localeCompare(b.name));
          setOpenRouterModels(sorted);
        }
      })
      .catch(console.error);
  }, []);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const downloadLocalFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadFile = async (file: AttachedFile) => {
    const url = file.storageUrl || file.data;
    if (!url) {
      alert("Source data missing for this asset.");
      return;
    }
    
    try {
      if (file.storageUrl) {
        // Use our proxy to stream the file natively as an attachment without blowing up browser memory
        const proxyUrl = `/api/download?url=${encodeURIComponent(file.storageUrl)}&filename=${encodeURIComponent(file.name)}`;
        const link = document.createElement("a");
        link.href = proxyUrl;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error("Error downloading file:", error);
      alert("Failed to download file. Please check console for details.");
    }
  };

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;
    let unsubscribeHistory: (() => void) | null = null;
    let unsubscribeKeys: (() => void) | null = null;

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        if (user.email === 'ashdarji1@gmail.com' || user.email === 'ashishdarji88@gmail.com' || user.email === 'saanskarastudios@gmail.com') {
          setIsAdmin(true);
        } else {
          getDoc(doc(db, 'admins', user.uid))
            .then(adminDoc => setIsAdmin(adminDoc.exists()))
            .catch(() => setIsAdmin(false));
        }
        // Fetch credits
        unsubscribeDoc = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            setCredits(data.credits || 0);
            if (data.hasSeenOnboarding === false) {
              setShowOnboarding(true);
            }
          }
        }, (err) => {
          handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
        });

        // Fetch keys 
        unsubscribeKeys = onSnapshot(doc(db, 'users', user.uid, 'private', 'keys'), (doc) => {
           setHasOpenRouterKey(doc.exists() && !!doc.data().openRouterKey);
        }, (err) => {
           console.error("Error fetching keys:", err);
        });

        // Fetch generation history
        const q = query(
          collection(db, "generations"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc")
        );
        unsubscribeHistory = onSnapshot(q, (snapshot) => {
          const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setHistory(docs);
        }, (err) => {
          handleFirestoreError(err, OperationType.LIST, "generations");
        });
      } else {
        if (unsubscribeDoc) unsubscribeDoc();
        if (unsubscribeHistory) unsubscribeHistory();
        if (unsubscribeKeys) unsubscribeKeys();
        unsubscribeDoc = null;
        unsubscribeHistory = null;
        unsubscribeKeys = null;
        setHasOpenRouterKey(false);
        
        setCredits(null);
        setHistory([]);
        setCurrentGenerationId(null);
        setCurrentAttachedFiles([]);
        setIsAdmin(false);
        setBlogPost(null);
        setOriginalContent(null);
        setMediaFiles([]);
        setPreviewMedia(null);
        setIsProcessing(false);
        setIsGeneratingFocus(false);
        setError(null);
        setPreferences({
          targetAudience: [],
          tone: [],
          length: "Medium (approx. 600 words)",
          specificFocus: "Unique narrative stories.",
          model: "gemini-3-flash-preview",
        });
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
      if (unsubscribeHistory) unsubscribeHistory();
      if (unsubscribeKeys) unsubscribeKeys();
    };
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const uploadFile = async (id: string, file: File) => {
    try {
      setMediaFiles(prev => prev.map(v => v.id === id ? { ...v, status: 'UPLOADING', progress: 0 } : v));

      const isDocx = file.name.toLowerCase().endsWith('.docx');
      let extractedText = "";

      if (isDocx) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          extractedText = result.value;
        } catch (mErr) {
          console.error("Mammoth Error:", mErr);
          extractedText = "Error: Failed to extract text from Word document.";
        }
      }

      let uri = "";
      let mimeType = file.type || "application/octet-stream";

      // Parallel: Gemini Upload (for AI context) and Firebase Storage Upload (for persistence)
      const user = auth.currentUser;
      if (!user) throw new Error("User must be authenticated to upload files.");

      // 1. Firebase Storage Upload
      console.log(`Starting storage upload for: ${file.name}`);
      const storageRef = ref(storage, `uploads/${user.uid}/${id}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      const storagePromise = new Promise<string>((resolve, reject) => {
        uploadTask.on('state_changed', 
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`Storage Progress for ${file.name}: ${progress.toFixed(2)}%`);
            setMediaFiles(prev => prev.map(v => v.id === id ? { ...v, progress } : v));
          }, 
          (error) => {
            console.error(`Storage Upload Error (${file.name}):`, error);
            reject(new Error(`Storage: ${error.message}`));
          }, 
          async () => {
            try {
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              console.log(`Storage Success for ${file.name}: ${downloadUrl}`);
              resolve(downloadUrl);
            } catch (urlErr: any) {
              reject(new Error(`Storage URL: ${urlErr.message}`));
            }
          }
        );
      });

      // 2. Gemini File API Upload
      let geminiPromise = Promise.resolve({ uri: "", mimeType: "" });
      if (!isDocx) {
        console.log(`Starting Gemini upload for: ${file.name}`);
        geminiPromise = (async () => {
          try {
            if (!process.env.GEMINI_API_KEY) {
              console.warn("GEMINI_API_KEY is missing. AI processing might fail.");
              // Don't throw here, allow storage-only if it's a simple image
            }
            
            const uploadResult = await ai.files.upload({
              file: file,
              config: {
                mimeType: file.type || "application/octet-stream",
                displayName: file.name.substring(0, 100),
              },
            });

            let uploadedFile = uploadResult;
            console.log(`Gemini Upload Result (${file.name}):`, uploadedFile.name, uploadedFile.state);
            
            while (uploadedFile.state === "PROCESSING") {
              console.log(`Gemini Processing ${file.name}...`);
              await new Promise(resolve => setTimeout(resolve, 3000));
              uploadedFile = await ai.files.get({ name: uploadResult.name });
            }
            const finalFile = await ai.files.get({ name: uploadResult.name });
            console.log(`Gemini Success for ${file.name}: ${finalFile.uri}`);
            return { uri: finalFile.uri, mimeType: finalFile.mimeType };
          } catch (gErr: any) {
            console.error(`Gemini Upload Error (${file.name}):`, gErr);
            // If it's a small image/audio, we might be able to use inlineData later, 
            // but for now let's just log and continue if we have storageUrl, 
            // or throw if it's critical (video/large doc)
            if (file.size > 10 * 1024 * 1024) throw new Error(`Gemini: ${gErr.message}`);
            return { uri: "", mimeType: "" };
          }
        })();
      }

      // Wait for uploads with better error handling
      const results = await Promise.allSettled([storagePromise, geminiPromise]);
      
      const storageResult = results[0];
      const geminiResult = results[1];

      if (storageResult.status === 'rejected') {
        const errorReason = storageResult.reason.message || storageResult.reason;
        console.error("Storage failed:", errorReason);
        if (String(errorReason).includes('unauthorized') || String(errorReason).includes('Firebase Storage: User does not have permission')) {
          throw new Error('Firebase Storage is not enabled or its security rules deny access. Please go to your Firebase Console (Storage tab), click "Get Started", and update the rules to allow reads and writes for authenticated users.');
        }
        throw new Error(`Storage error: ${errorReason}`);
      }

      const storageUrl = storageResult.value;
      const gRes = geminiResult.status === 'fulfilled' ? geminiResult.value : { uri: "", mimeType: "" };
      
      if (geminiResult.status === 'rejected') {
        console.warn("Gemini upload failed, will attempt to use storage URL if possible:", geminiResult.reason);
      }

      uri = gRes.uri;
      mimeType = gRes.mimeType || file.type || "application/octet-stream";

      if (!uri && !isDocx) {
        console.warn(`No URI obtained for ${file.name}. AI generation might fail for this file.`);
      }

      let firestoreId = "";
      try {
        const fileDoc: any = {
          userId: user.uid,
          name: file.name,
          type: file.type,
          size: file.size,
          storageUrl: storageUrl,
          createdAt: serverTimestamp(),
          uri: uri,
          mimeType: mimeType
        };
        if (extractedText) fileDoc.extractedText = extractedText;
        const fileRef = await addDoc(collection(db, "files"), fileDoc);
        firestoreId = fileRef.id;
      } catch (fErr) {
        console.error("Firestore file record save failed:", fErr);
      }

      setMediaFiles(prev => prev.map(v => v.id === id ? { 
        ...v, 
        status: 'ACTIVE', 
        uri: uri,
        mimeType: mimeType,
        firestoreId,
        storageUrl,
        extractedText,
        progress: 100
      } : v));

    } catch (err: any) {
      console.error("Upload Error Detailed:", err);
      let errorMsg = `Failed to process ${file.name}: ${err.message || "Upload failed"}`;
      
      if (err.message?.includes("API key not valid")) {
        errorMsg = "AI Configuration Error: Invalid Gemini API key. Please check your environment variables.";
      } else if (err.message?.includes("quota")) {
        errorMsg = "AI Quota Exceeded: The system has reached its current processing limit. Please try again later.";
      } else if (err.message?.includes("Storage")) {
        errorMsg = `Storage Error: Failed to upload ${file.name} to cloud storage. Ensure your connection is stable.`;
      }

      setMediaFiles(prev => prev.map(v => v.id === id ? { ...v, status: 'FAILED' } : v));
      setError(errorMsg);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(file => {
        const id = Math.random().toString(36).substring(7);
        const mediaFile: MediaFile = {
          id,
          file,
          name: file.name,
          status: 'UPLOADING',
          progress: 0,
          previewUrl: URL.createObjectURL(file),
          size: file.size,
          mimeType: file.type
        };
        uploadFile(id, file); // Trigger background upload
        return mediaFile;
      });
      setMediaFiles((prev) => [...prev, ...newFiles]);
    }
  };

  useEffect(() => {
    return () => {
      mediaFiles.forEach(v => {
        if (v.previewUrl) URL.revokeObjectURL(v.previewUrl);
      });
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  const removeMedia = (id: string) => {
    const fileToRemove = mediaFiles.find(v => v.id === id);
    if (fileToRemove?.previewUrl) URL.revokeObjectURL(fileToRemove.previewUrl);
    setMediaFiles((prev) => prev.filter((v) => v.id !== id));
    if (mediaFiles.length <= 1) setError(null);
  };

  const isFilesReady = mediaFiles.length > 0 && mediaFiles.every(v => v.status === 'ACTIVE');

  const getCreditsForLength = (length: string) => {
    if (length.includes("Short")) return 5;
    if (length.includes("Medium")) return 10;
    if (length.includes("Long-form")) return 15;
    if (length.includes("SuperLong")) return 20;
    return 10; // Default
  };

  const currentCost = getCreditsForLength(preferences.length);

  const handleGenerateFocus = async () => {
    if (!isFilesReady) return;
    setIsGeneratingFocus(true);
    try {
      const readyVideos = mediaFiles.filter(v => v.status === 'ACTIVE');
      const isOpenRouter = preferences.model.includes("/");

      const promptText = `You are a content strategy expert. Generate a short, compelling strategic focus (1-2 sentences) for a blog post based on these parameters and the provided media:
Theme: General professional content
Target Audience: ${preferences.targetAudience.join(", ")}
Tone: ${preferences.tone.join(", ")}
Make it sound like a unique narrative angle or specific topic focus derived directly from the core message of the provided media files. Do not include quotes or preambles, just output the focus text.`;

      // Gather additional text content from media files for the prompt
      let additionalText = "";
      readyVideos.forEach(v => {
        if (v.extractedText) {
          additionalText += `\n[Content of Doc ${v.name}]:\n${v.extractedText}\n`;
        }
      });

      const fullPromptText = promptText + (additionalText ? "\n\nSource Content:\n" + additionalText : "");

      if (isOpenRouter) {
        const user = auth.currentUser;
        if (!user) throw new Error("Authentication Required");
        const keyDoc = await getDoc(doc(db, "users", user.uid, "private", "keys"));
        const apiKey = keyDoc.exists() ? keyDoc.data().openRouterKey : null;

        if (!apiKey) {
          throw new Error("OpenRouter Key Missing");
        }

        const response = await fetch("/api/ai/openrouter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: preferences.model,
            apiKey,
            messages: [{ role: "user", content: fullPromptText }]
          })
        });

        const data = await response.json();
        if (data.text) {
          setPreferences(prev => ({ ...prev, specificFocus: data.text.trim() }));
        }
      } else {
        const fileParts = readyVideos.map(v => {
          if (v.extractedText) return null; // already included in fullPromptText
          if (!v.uri) return null;
          return {
            fileData: {
              fileUri: v.uri,
              mimeType: v.mimeType || "application/octet-stream"
            }
          };
        }).filter(p => p !== null);

        const result = await ai.models.generateContent({
          model: preferences.model,
          contents: [
            ...fileParts as any,
            fullPromptText
          ]
        });

        if (result.text) {
          setPreferences(prev => ({ ...prev, specificFocus: result.text.trim() }));
        }
      }
    } catch (err: any) {
      console.error("Focus generation error:", err);
      setError(`The selected LLM provider could not handle this request. Please choose another LLM provider. Details: ${err.message || "Unknown error."}`);
    } finally {
      setIsGeneratingFocus(false);
    }
  };

  const handleGenerate = async () => {
    const user = auth.currentUser;
    if (!user) {
      setError("Security Identity Null: Re-authentication required.");
      return;
    }

    if (!user.emailVerified && !isAdmin) {
      setError("Identity verification pending. Please check your inbox and verify your email to unlock synthesis protocols.");
      return;
    }

    const readyVideos = mediaFiles.filter(v => v.status === 'ACTIVE');
    if (readyVideos.length === 0) return;
    
    setIsProcessing(true);
    setError(null);
    
    let tempGenId = "";

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Security Identity Null: Re-authentication required.");
      const userRef = doc(db, "users", user.uid);
      
      const userCheck = await getDoc(userRef);
      if (!userCheck.exists()) {
        await setDoc(userRef, {
          email: user.email || 'unknown@example.com',
          displayName: user.displayName || 'User',
          photoURL: user.photoURL || '',
          createdAt: serverTimestamp(),
          credits: 50,
          hasSeenOnboarding: false
        });
      }

      const cost = getCreditsForLength(preferences.length);
      if (!isAdmin) {
        await runTransaction(db, async (transaction) => {
          const userDoc = await transaction.get(userRef);
          if (!userDoc.exists()) throw new Error("User record not found");
          const currentCredits = userDoc.data().credits || 0;
          if (currentCredits < cost) throw new Error(`Insufficient credits`);
          transaction.update(userRef, { credits: currentCredits - cost });
        });
      }

      // 1. Create Placeholder Generation
      const fileIds: string[] = readyVideos.map(v => (v as any).firestoreId).filter(Boolean);
      const generationData = {
        userId: user.uid,
        content: "",
        title: "Synthesizing...",
        preferences: preferences,
        fileIds: fileIds,
        status: "processing",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, "generations"), generationData);
      tempGenId = docRef.id;
      setGeneratingIds(prev => new Set(prev).add(tempGenId));
      setCurrentGenerationId(tempGenId);
      setBlogPost(""); // Clear current view for new one
      // REMOVED setIsProcessing(false) here to keep loading state visible during synthesis

      // 2. Perform Generation
      const isOpenRouter = preferences.model.includes("/");
      let generatedContent = "";

      if (isOpenRouter) {
        const keyDoc = await getDoc(doc(db, "users", user.uid, "private", "keys"));
        const apiKey = keyDoc.exists() ? keyDoc.data().openRouterKey : null;
        if (!apiKey) throw new Error("OpenRouter API Key is missing");

        const prompt = `You are a world-class blog post writer. 
Convert provided media context into a high-quality, professional blog post.

STRUCTURE REQUIREMENTS:
1. TITLE: Start with a compelling H1 title (e.g., # My Amazing Story).
2. KEY SECTIONS: Use H2 (##) and H3 (###) headers to organize the content into logical sections.
3. QUOTES: Include at least two insightful blockquotes (>) synthesizing key takeaways or "voice" from the media.
4. NARRATIVE: Create a cohesive story, not just a description of the files.

TARGET AUDIENCE: ${preferences.targetAudience.join(", ")}
TONE: ${preferences.tone.join(", ")}
LENGTH: ${preferences.length}
SPECIFIC FOCUS: ${preferences.specificFocus}

IMPORTANT: You MUST embed the provided media assets at relevant points in the article using standard Markdown image syntax with the specific Media IDs provided below.
Syntax: ![Description](MEDIA_ID_ID)
Example: If you want to place a video with ID 'abc', use: ![Video Context](MEDIA_ID_abc)

AVAILABLE MEDIA ASSETS (IDs and Names):
${readyVideos.map(v => `- ID: ${(v as any).firestoreId || v.id} | Name: ${v.name}`).join('\n')}

Synthesize the content from these assets into a cohesive narrative.`;

        let additionalText = "";
        readyVideos.forEach(v => { if (v.extractedText) additionalText += `\n\n[Content ${v.name}]:\n${v.extractedText}`; });
        
        const response = await fetch("/api/ai/openrouter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: preferences.model,
            apiKey,
            messages: [{ role: "user", content: prompt + additionalText }]
          })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Generation Failed");
        generatedContent = data.text;
      } else {
        const fileParts = readyVideos.map(v => v.uri ? { fileData: { fileUri: v.uri, mimeType: v.mimeType || "application/octet-stream" } } : null).filter(p => p !== null);
        const prompt = `You are an expert technical blogger. Transform provided media into a high-quality, professional blog post.

STRUCTURE REQUIREMENTS:
1. TITLE: Start with a compelling H1 title (e.g., # My Amazing Story).
2. KEY SECTIONS: Use H2 (##) and H3 (###) headers to organize the content into logical sections.
3. QUOTES: Include at least two insightful blockquotes (>) synthesizing key takeaways or "voice" from the media.
4. NARRATIVE: Create a cohesive story, not just a description of the files.

TARGET AUDIENCE: ${preferences.targetAudience.join(", ")}
TONE: ${preferences.tone.join(", ")}
LENGTH: ${preferences.length}
SPECIFIC FOCUS: ${preferences.specificFocus}

IMPORTANT: You MUST embed the provided media assets at relevant points in the article using standard Markdown image syntax with the specific Media IDs provided below.
Syntax: ![Description](MEDIA_ID_ID)
Example: If you want to place a video with ID 'abc', use: ![Video Context](MEDIA_ID_abc)

AVAILABLE MEDIA ASSETS (IDs and Names):
${readyVideos.map(v => `- ID: ${(v as any).firestoreId || v.id} | Name: ${v.name}`).join('\n')}

Synthesize the content from these assets into a cohesive narrative. Do not just list them.`;

        let additionalText = "";
        readyVideos.forEach(v => { if (v.extractedText) additionalText += `\n\n[Content ${v.name}]:\n${v.extractedText}`; });

        const response = await ai.models.generateContent({
          model: preferences.model,
          contents: [...(fileParts as any), prompt + additionalText]
        });

        if (!response.text) throw new Error("Model failed");
        generatedContent = response.text;
      }

      // 3. Finalize Generation Record
      await updateDoc(doc(db, "generations", tempGenId), {
        content: generatedContent,
        title: generatedContent.split('\n')[0].replace(/^#+\s*/, '').substring(0, 100) || "Untitled Blog Post",
        status: "completed",
        updatedAt: serverTimestamp()
      });

      setIsProcessing(false); // FINALLY set to false after completion

      // Update current view if this was the latest
      setCurrentGenerationId(prev => {
        if (prev === tempGenId) {
          setBlogPost(generatedContent);
          setOriginalContent(generatedContent);
        }
        return prev;
      });

    } catch (err: any) {
      console.error("Synthesis Error:", err);
      let errorMsg = `Synthesis failed: ${err.message || "Unknown error"}`;
      
      if (err.message?.includes("429") || err.message?.includes("quota") || err.message?.toLowerCase().includes("exhausted")) {
        errorMsg = "Critical Quota Alert: You have exceeded the daily request limit for this AI model. Please try switching to a different model (like Gemini 1.5 Flash) or wait for the quota to reset (usually every 24 hours).";
      } else if (err.message?.includes("permission") || err.message?.includes("Identity Toolkit")) {
        errorMsg = "Security Initialization Failure: The server identity lacks the necessary permissions to verify your request. Please ensure 'Identity Toolkit API' is enabled and the service account has 'Service Usage Consumer' and 'Authentication Admin' roles.";
      }

      if (tempGenId) {
        await updateDoc(doc(db, "generations", tempGenId), { status: "failed" }).catch(() => {});
      }
      setError(errorMsg);
    } finally {
      if (tempGenId) {
        setGeneratingIds(prev => {
          const next = new Set(prev);
          next.delete(tempGenId);
          return next;
        });
      }
      setIsProcessing(false);
    }
  };

  const copyToClipboard = () => {
    if (blogPost) {
      navigator.clipboard.writeText(blogPost);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const exportToPDF = async () => {
    const element = contentRef.current;
    if (!element || !blogPost) return;
    
    setIsProcessing(true);
    try {
      // html2canvas doesn't support oklch() colors used in Tailwind 4
      // We must temporarily replace them with hex/rgb or ensure the container doesn't use them
      const originalStyle = element.getAttribute("style");
      element.style.backgroundColor = "#ffffff";
      element.style.color = "#141414";
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        width: element.offsetWidth,
        height: element.offsetHeight,
        onclone: (clonedDoc) => {
          // Modern CSS color functions (oklch, oklab) cause crashes in html2canvas.
          // We aggressively replace them with safe hex values in the cloned document.
          const elements = clonedDoc.querySelectorAll('*');
          elements.forEach(el => {
            const htmlEl = el as HTMLElement;
            if (!htmlEl.style) return;

            // Check computed styles and provide hex fallbacks
            const style = window.getComputedStyle(el);
            if (style.color.includes('okl')) htmlEl.style.setProperty('color', '#141414', 'important');
            if (style.backgroundColor.includes('okl')) {
              const isProse = htmlEl.classList.contains('prose');
              htmlEl.style.setProperty('background-color', isProse ? '#ffffff' : 'transparent', 'important');
            }
            if (style.borderColor.includes('okl')) htmlEl.style.setProperty('border-color', '#141414', 'important');
            
            // Check and clean CSS variables which are frequent in Tailwind 4
            for (let i = htmlEl.style.length - 1; i >= 0; i--) {
              const prop = htmlEl.style[i];
              if (prop.startsWith('--') && htmlEl.style.getPropertyValue(prop).includes('okl')) {
                htmlEl.style.removeProperty(prop);
              }
            }

            // Handle SVGs
            if (el instanceof SVGElement) {
              const fill = el.getAttribute('fill');
              if (fill && fill.includes('okl')) el.setAttribute('fill', '#141414');
              const stroke = el.getAttribute('stroke');
              if (stroke && stroke.includes('okl')) el.setAttribute('stroke', '#141414');
            }
          });
        }
      });
      
      // Restore style
      if (element) {
        if (originalStyle) element.setAttribute("style", originalStyle);
        else element.removeAttribute("style");
      }
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      // Handle multi-page if needed (simplified)
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`blog-post-${Date.now()}.pdf`);
    } catch (err: any) {
      console.error("PDF Export Error:", err);
      setError(`Failed to export PDF: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const sanitizedPost = blogPost ? blogPost.replace(/^```markdown\n?/, "").replace(/\n?```$/, "") : "";

  const handleNewPost = () => {
    setBlogPost(null);
    setOriginalContent(null);
    setCurrentGenerationId(null);
    setCurrentAttachedFiles([]);
    setMediaFiles([]);
    setPreferences({
      targetAudience: [],
      tone: [],
      length: "Medium (approx. 600 words)",
      specificFocus: "Unique narrative stories.",
      model: "gemini-3-flash-preview",
    });
    setIsHistoryOpen(false);
  };

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const loadGeneration = async (gen: any) => {
    setBlogPost(gen.content);
    setOriginalContent(gen.content);
    setCurrentGenerationId(gen.id);
    setCurrentAttachedFiles([]);
    setMediaFiles([]);
    if (gen.preferences) {
      setPreferences(gen.preferences);
    }
    
    // Fetch attached files
    if (gen.fileIds && gen.fileIds.length > 0) {
      try {
        const filePromises = gen.fileIds.map((fileId: string) => getDoc(doc(db, "files", fileId)));
        const fileSnaps = await Promise.all(filePromises);
        
        const files: AttachedFile[] = fileSnaps
          .filter(snap => snap.exists())
          .map(snap => {
            const data = snap.data() as any;
            return {
              id: snap.id,
              name: data.name,
              type: data.type,
              size: data.size,
              data: data.data,
              uri: data.uri,
              mimeType: data.mimeType,
              storageUrl: data.storageUrl,
              extractedText: data.extractedText
            };
          });
        
        setCurrentAttachedFiles(files);
        
        // Populate mediaFiles so the preview can find them
        const restoredMedia: MediaFile[] = files.map(f => ({
          id: f.id,
          firestoreId: f.id,
          name: f.name,
          type: (f.type.includes('video') ? 'video' : f.type.includes('audio') ? 'audio' : f.type.includes('image') ? 'image' : undefined) as any,
          status: 'ACTIVE',
          progress: 100,
          previewUrl: f.data || f.storageUrl || undefined, // use storageUrl as previewUrl fallback
          size: f.size,
          mimeType: f.type,
          uri: (f as any).uri,
          storageUrl: f.storageUrl,
          extractedText: f.extractedText
        }));
        setMediaFiles(restoredMedia);
      } catch (err) {
        console.error("Error fetching attached files:", err);
      }
    }

    setIsHistoryOpen(false);
  };

  const deleteGeneration = async (id: string) => {
    try {
      const genSnap = await getDoc(doc(db, "generations", id));
      if (genSnap.exists()) {
        const fileIds = genSnap.data().fileIds || [];
        for (const fileId of fileIds) {
          try {
            await deleteDoc(doc(db, "files", fileId));
          } catch (fileErr) {
            console.error("Error deleting file:", fileId, fileErr);
          }
        }
      }
      await deleteDoc(doc(db, "generations", id));
      if (currentGenerationId === id) {
        handleNewPost();
      }
      setIsDeleteModalOpen(false);
      setGenToDelete(null);
    } catch (err) {
      console.error("Delete error:", err);
      handleFirestoreError(err, OperationType.DELETE, `generations/${id}`);
    }
  };

  const confirmDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setGenToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const handleUpdate = async () => {
    if (!currentGenerationId || !blogPost) return;
    try {
      await updateDoc(doc(db, "generations", currentGenerationId), {
        content: blogPost,
        updatedAt: serverTimestamp(),
        title: blogPost.split('\n')[0].replace(/^#+\s*/, '') || "Untitled Blog Post"
      });
      setOriginalContent(blogPost);
      alert("Post updated successfully!");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `generations/${currentGenerationId}`);
      alert("Failed to update post.");
    }
  };

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);
    const user = auth.currentUser;
    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          hasSeenOnboarding: true
        });
      } catch (err) {
        console.error("Failed to update onboarding status:", err);
      }
    }
  };

  const sortedHistory = useMemo(() => {
    return [...history].sort((a: any, b: any) => {
      if (historySortBy === 'createdAt') {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
      } else {
        const timeA = Math.max(a.updatedAt?.toMillis() || 0, a.createdAt?.toMillis() || 0);
        const timeB = Math.max(b.updatedAt?.toMillis() || 0, b.createdAt?.toMillis() || 0);
        return timeB - timeA;
      }
    });
  }, [history, historySortBy]);

  return (
    <AuthGuard theme={theme}>
      {showOnboarding && <OnboardingWizard theme={theme} onComplete={handleOnboardingComplete} />}
      <AnimatePresence>
        {viewerContent && (
          <GenerationViewer 
            content={viewerContent.content}
            title={viewerContent.title}
            theme={theme}
            isAdmin={isAdmin}
            mediaFiles={mediaFiles}
            onClose={() => setViewerContent(null)}
            onDownload={exportToPDF}
            onCopy={copyToClipboard}
          />
        )}
      </AnimatePresence>
      {/* History Sidebar */}
      <AnimatePresence>
        {isHistoryOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoryOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className={`fixed top-0 left-0 h-full w-[310px] md:w-[380px] z-[101] shadow-2xl border-r ${
                theme === 'dark' ? 'bg-[#111111] border-[#333] text-[#F8F8F7]' : 'bg-white border-[#141414] text-[#141414]'
              }`}
            >
              <div className="p-8 h-full flex flex-col">
                <div className="flex items-center justify-between mb-8">
                  <h2 className={`font-serif italic text-2xl uppercase tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Generation History</h2>
                  <button 
                    onClick={() => setIsHistoryOpen(false)}
                    className={`p-2 transition-all ${theme === 'dark' ? 'text-white hover:bg-white hover:text-black' : 'text-black hover:bg-black hover:text-white'}`}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {history.length > 0 && (
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-widest opacity-60 flex-shrink-0 mr-2">Sort by:</span>
                    <select
                      value={historySortBy}
                      onChange={(e) => setHistorySortBy(e.target.value as any)}
                      className={`text-[10px] font-mono uppercase border px-2 py-1 outline-none ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333] text-white' : 'bg-[#F8F8F7] border-[#141414] text-black'}`}
                    >
                      <option value="updatedAt">Last Updated</option>
                      <option value="createdAt">Last Created</option>
                    </select>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                  {sortedHistory.length === 0 ? (
                    <div className={`h-full flex flex-col items-center justify-center text-center space-y-4 ${theme === 'dark' ? 'opacity-40 text-white' : 'opacity-30 text-black'}`}>
                      <Clock className="w-12 h-12" />
                      <p className="font-mono text-xs uppercase">No historical records found</p>
                    </div>
                  ) : (
                    sortedHistory.map((gen) => {
                      const isGenProcessing = gen.status === 'processing' || generatingIds.has(gen.id);
                      return (
                        <div 
                          key={gen.id}
                          onClick={() => !isGenProcessing && loadGeneration(gen)}
                          className={`p-4 border transition-all cursor-pointer group relative ${
                            isGenProcessing ? 'opacity-70 cursor-wait' : ''
                          } ${
                            currentGenerationId === gen.id 
                              ? (theme === 'dark' ? 'border-yellow-500 bg-yellow-500/10' : 'border-yellow-500 bg-yellow-50') 
                              : (theme === 'dark' ? 'border-[#333] bg-[#141414] hover:border-white' : 'border-[#141414] hover:bg-[#F8F8F7]')
                          }`}
                        >
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                              <span className={`text-[10px] font-mono ${theme === 'dark' ? 'text-gray-400' : 'opacity-40 text-black'}`}>
                                {historySortBy === 'createdAt' && gen.createdAt ? (
                                  `Created: ${gen.createdAt.toDate().toLocaleDateString()}`
                                ) : (
                                  `Updated: ${(gen.updatedAt || gen.createdAt)?.toDate().toLocaleDateString()}`
                                )}
                              </span>
                              {isGenProcessing ? (
                                <Loader2 className="w-3 h-3 animate-spin text-yellow-500" />
                              ) : gen.status === 'failed' ? (
                                <AlertCircle className="w-3 h-3 text-red-500" />
                              ) : (
                                <CheckCircle2 className="w-3 h-3 opacity-20 group-hover:opacity-100 transition-opacity" />
                              )}
                            </div>
                            <span className={`text-xs font-bold truncate pr-6 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                              {isGenProcessing ? "Processing Synthesis..." : (gen.title || "Untitled Post")}
                            </span>
                            <div className="flex gap-2 mt-2">
                              <span className={`text-[9px] font-mono px-1 border uppercase ${theme === 'dark' ? 'border-gray-600 text-gray-400' : 'border-black/20 opacity-40 text-black'}`}>{gen.preferences?.model?.replace('gemini-', '')}</span>
                              <span className={`text-[9px] font-mono px-1 border uppercase ${theme === 'dark' ? 'border-gray-600 text-gray-400' : 'border-black/20 opacity-40 text-black'}`}>
                                {Array.isArray(gen.preferences?.tone) ? gen.preferences.tone.join(", ") : gen.preferences?.tone}
                              </span>
                            </div>
                          </div>
                          {!isGenProcessing && (
                            <button 
                              onClick={(e) => confirmDelete(gen.id, e)}
                              className={`absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-2 transition-all rounded-full ${
                                theme === 'dark' 
                                  ? 'text-gray-400 hover:text-red-500 hover:bg-red-500/10' 
                                  : 'text-black hover:text-red-500 hover:bg-red-50'
                              }`}
                              title="Delete Generation"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <button 
                  onClick={handleNewPost}
                  className={`mt-8 w-full py-4 border-2 font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                    theme === 'dark' 
                      ? 'bg-white text-black border-white hover:bg-black hover:text-white' 
                      : 'bg-black text-white border-black hover:bg-white hover:text-black'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  New Synthesis
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#0A0A0A] text-[#F8F8F7]' : 'bg-[#E4E3E0] text-[#141414]'} font-sans selection:bg-black selection:text-white transition-colors duration-300 pb-20`}>
      <Header 
        theme={theme}
        setTheme={setTheme}
        setIsHistoryOpen={setIsHistoryOpen}
        setIsAdminModalOpen={setIsAdminModalOpen}
        isAdmin={isAdmin}
        mediaFilesCount={mediaFiles.length}
        handleNewPost={handleNewPost}
      />

      <main className="max-w-7xl mx-auto p-6 md:p-12">
        <div className={`grid grid-cols-1 lg:grid-cols-12 gap-0 border-2 ${theme === 'dark' ? 'border-[#333] bg-[#141414] shadow-[12px_12px_0px_0px_rgba(255,255,255,0.05)]' : 'border-[#141414] bg-white shadow-[12px_12px_0px_0px_rgba(20,20,20,1)]'} transition-all`}>
          
          {/* Controls Panel */}
          <div className={`lg:col-span-5 border-b lg:border-b-0 lg:border-r ${theme === 'dark' ? 'border-[#333]' : 'border-[#141414]'} p-8 space-y-12`}>
            <section id="onboarding-intake" className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-serif italic text-xs uppercase opacity-50 tracking-widest">01 / Source Intake</span>
                <Layout className="w-3 h-3 opacity-30" />
              </div>
              
              <div className="space-y-4">
                <AnimatePresence>
                  {mediaFiles.map((v) => (
                    <motion.div 
                      key={v.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className={`flex flex-col p-4 border transition-all group ${
                        v.status === 'ACTIVE' 
                          ? (theme === 'dark' ? 'border-green-500 bg-green-500/20 shadow-[4px_4px_0px_0px_rgba(34,197,94,1)] text-green-400' : 'border-green-500 bg-green-100 shadow-[4px_4px_0px_0px_rgba(34,197,94,1)] text-green-800') 
                          : (theme === 'dark' ? 'border-[#333] bg-[#1A1A1A]' : 'border-[#141414] bg-[#F8F8F7]')
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3 overflow-hidden flex-1">
                          <div className={`w-10 h-10 shrink-0 flex items-center justify-center border-2 ${theme === 'dark' ? 'bg-black/60 border-white/10 shadow-[2px_2px_0px_0px_rgba(255,255,255,0.05)]' : 'bg-gray-100 border-black/10 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.05)]'} overflow-hidden rounded-sm group-hover:scale-110 transition-transform duration-300`}>
                            {(v.mimeType?.includes('image') || (v.file && v.file.type.includes('image'))) && v.previewUrl ? (
                              <img src={v.previewUrl} className="w-full h-full object-cover" alt="" />
                            ) : v.mimeType?.includes('video') || (v.file && v.file.type.includes('video')) ? (
                              <div className="relative w-full h-full flex items-center justify-center">
                                <FileVideo className="w-4 h-4 opacity-60" />
                                <div className="absolute inset-x-0 bottom-0 h-1 bg-blue-500/30" />
                              </div>
                            ) : v.mimeType?.includes('audio') || (v.file && v.file.type.includes('audio')) ? (
                              <div className="relative w-full h-full flex items-center justify-center">
                                <FileAudio className="w-4 h-4 opacity-60" />
                                <div className="absolute inset-x-0 bottom-0 h-1 bg-indigo-500/30" />
                              </div>
                            ) : v.mimeType?.includes('pdf') || v.name?.toLowerCase().endsWith('.pdf') ? (
                              <div className="relative w-full h-full flex items-center justify-center bg-red-500/5">
                                <FileText className="w-4 h-4 text-red-600" />
                                <div className="absolute inset-x-0 bottom-0 h-1 bg-red-600" />
                              </div>
                            ) : (
                              <div className="relative w-full h-full flex items-center justify-center bg-indigo-500/5">
                                <FileText className="w-4 h-4 text-indigo-600" />
                                <div className="absolute inset-x-0 bottom-0 h-1 bg-indigo-600" />
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[11px] font-mono font-bold truncate leading-tight uppercase tracking-tighter">{v.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[8px] opacity-40 font-mono">{( (v.size || 0) / (1024 * 1024)).toFixed(2)}MB</span>
                              {v.status === 'ACTIVE' && (
                                <span className="text-[8px] text-green-600 font-mono tracking-tighter bg-green-500/10 px-1">SYNCED</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => setPreviewMedia(v)}
                            className={`p-1 transition-colors ${theme === 'dark' ? 'hover:bg-white hover:text-black' : 'hover:bg-black hover:text-white'}`}
                            title="Preview File"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                          <button 
                            onClick={async () => {
                              if (v.file) downloadLocalFile(v.file);
                              else if (v.storageUrl || v.previewUrl) {
                                await downloadFile({
                                  id: v.id,
                                  name: v.name || 'download',
                                  type: v.mimeType || 'application/octet-stream',
                                  size: v.size || 0,
                                  storageUrl: v.storageUrl || v.previewUrl,
                                  data: v.previewUrl,
                                  uri: v.uri,
                                  mimeType: v.mimeType,
                                  extractedText: v.extractedText
                                });
                              }
                            }}
                            className={`p-1 transition-colors ${theme === 'dark' ? 'hover:bg-white hover:text-black' : 'hover:bg-black hover:text-white'}`}
                            title="Download File"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                          <button 
                            onClick={() => setMediaFileToDelete(v)}
                            className={`p-1 transition-colors ${theme === 'dark' ? 'hover:bg-white hover:text-black' : 'hover:bg-black hover:text-white'}`}
                            title="Remove File"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Status Indicator */}
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center gap-2">
                          {v.status === 'PENDING' && <Loader2 className="w-3 h-3 animate-spin text-gray-500" />}
                          {v.status === 'UPLOADING' && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
                          {v.status === 'PROCESSING' && <Clock className="w-3 h-3 animate-pulse text-orange-500" />}
                          {v.status === 'ACTIVE' && <Check className="w-3 h-3 text-green-600" />}
                          {v.status === 'FAILED' && <AlertCircle className="w-3 h-3 text-red-500" />}
                          <span className={`text-[9px] font-mono font-bold uppercase tracking-widest ${
                            v.status === 'ACTIVE' ? 'text-green-700' : 
                            v.status === 'FAILED' ? 'text-red-600' : 
                            v.status === 'PENDING' ? 'text-gray-500 animate-pulse' :
                            'text-[#8E9299]'
                          }`}>
                            {v.status === 'PENDING' ? 'QUEUED...' : v.status}
                          </span>
                        </div>
                        {v.status === 'ACTIVE' && (
                          <span className="text-[9px] font-mono text-green-600 font-bold">READY_FOR_SYNTHESIS</span>
                        )}
                        {v.status === 'UPLOADING' && v.progress !== undefined && (
                          <span className="text-[9px] font-mono text-blue-500 font-bold">{Math.round(v.progress)}%</span>
                        )}
                      </div>

                      {/* Mock progress bar for UPLOADING */}
                      {(v.status === 'PENDING' || v.status === 'UPLOADING' || v.status === 'PROCESSING') && (
                        <div className="w-full h-[2px] bg-black/5 mt-3 overflow-hidden rounded">
                          <motion.div 
                            className={`h-full ${v.status === 'PENDING' ? 'bg-gray-400' : v.status === 'UPLOADING' ? 'bg-blue-500' : 'bg-orange-500'}`}
                            initial={{ width: "0%" }}
                            animate={{ 
                              width: v.status === 'PENDING' ? ["0%", "100%", "0%"] : v.status === 'UPLOADING' ? `${v.progress || 60}%` : "90%" 
                            }}
                            transition={{ 
                              duration: v.status === 'PENDING' ? 1.5 : 0.5, 
                              ease: "easeInOut", 
                              repeat: v.status === 'PENDING' ? Infinity : 0 
                            }}
                          />
                        </div>
                      )}
                    </motion.div>
                  ))??[]}
                </AnimatePresence>

                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative border p-12 transition-all cursor-pointer group flex flex-col items-center gap-4
                    ${theme === 'dark' ? 'border-[#333]' : 'border-[#141414]'}
                    ${mediaFiles.length === 0 ? (theme === 'dark' ? 'bg-[#1A1A1A]' : 'bg-[#F8F8F7]') : `border-dashed opacity-60 hover:opacity-100 ${theme === 'dark' ? 'hover:bg-[#1A1A1A]' : 'hover:bg-[#F8F8F7]'}`}`}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    className="hidden" 
                    accept="video/*,audio/*,image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
                    multiple
                    onChange={handleFileChange}
                  />
                  <div className={`p-4 border ${theme === 'dark' ? 'border-[#F8F8F7]' : 'border-[#141414]'} transition-all group-hover:bg-black group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black ${mediaFiles.length > 0 ? 'scale-75' : ''}`}>
                    <Plus className="w-8 h-8" />
                  </div>
                  <div className="text-center">
                    <p className="font-mono text-xs uppercase tracking-widest">
                      {mediaFiles.length === 0 ? "Mount Source Media" : "Add More Clips"}
                    </p>
                    {mediaFiles.length === 0 && (
                      <p className="text-[10px] mt-2 font-mono opacity-50">Support: .mp4, .mp3, .wav, .mov, etc (Max 5GB/file)</p>
                    )}
                  </div>
                </div>
                
                {mediaFiles.length > 0 && (
                  <p className="text-[10px] text-orange-600 font-mono italic">
                    Note: High-capacity ingestion active. Large files (up to 5GB) may take several minutes to transmit and process.
                  </p>
                )}
              </div>
            </section>

            <section id="onboarding-config" className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="font-serif italic text-xs uppercase opacity-50 tracking-widest">02 / Processing Prefs</span>
                <Settings2 className="w-3 h-3 opacity-30" />
              </div>

              <div className="space-y-6">
                <div className="space-y-2 group">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] uppercase font-mono font-bold tracking-widest opacity-60">LLM_Model</label>
                    <Sparkles className="w-3 h-3 opacity-20" />
                  </div>
                  <select 
                    value={preferences.model}
                    onChange={(e) => setPreferences({ ...preferences, model: e.target.value })}
                    className={`w-full border px-4 py-3 font-mono text-sm outline-none appearance-none cursor-pointer transition-colors ${
                      theme === 'dark' 
                        ? 'bg-[#1A1A1A] border-[#333] text-[#F8F8F7] focus:bg-black hover:border-[#F8F8F7]' 
                        : 'bg-[#F8F8F7] border-[#141414] text-[#141414] focus:bg-white hover:border-black'
                    }`}
                  >
                    <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Analytical & Deep)</option>
                    <option value="gemini-3-flash-preview">Gemini 3 Flash (Fast & Balanced)</option>
                    <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite (High Speed)</option>
                    {hasOpenRouterKey && openRouterModels.length > 0 && (
                      (() => {
                        const categories = ["1. Text", "2. Image", "3. Embeddings", "4. Audio", "5. Video", "6. Rerank", "7. Speech", "8. Transcription"];
                        const groupedModels: Record<string, any[]> = {};
                        openRouterModels.forEach(m => {
                          const cat = getOpenRouterCategory(m);
                          if (!groupedModels[cat]) groupedModels[cat] = [];
                          groupedModels[cat].push(m);
                        });

                        return (
                          <>
                            <option disabled className="font-bold border-t">-- Dynamic OpenRouter Models --</option>
                            {categories.map(cat => {
                              if (!groupedModels[cat] || groupedModels[cat].length === 0) return null;
                              return (
                                <optgroup key={cat} label={`-- ${cat.split('. ')[1]} --`} className="font-bold border-t bg-black/5 dark:bg-white/5">
                                  {groupedModels[cat].map(m => (
                                    <option key={`dyn-${m.id}`} value={m.id} className="font-normal bg-white dark:bg-[#1A1A1A]">{m.name}</option>
                                  ))}
                                </optgroup>
                              );
                            })}
                          </>
                        );
                      })()
                    )}
                    {hasOpenRouterKey && (
                      <>
                        <option disabled className="font-bold border-t">-- OpenRouter Presets --</option>
                        <option value="openai/gpt-4o">OpenAI: GPT-4o</option>
                        <option value="anthropic/claude-3.5-sonnet">Anthropic: Claude 3.5 Sonnet</option>
                        <option value="meta-llama/llama-3.1-405b-instruct">Meta: Llama 3.1 405B</option>
                        <option value="google/gemini-2.0-flash-exp:free">Google: Gemini 2.0 Flash (via OR)</option>
                      </>
                    )}
                  </select>
                  <p className="text-[9px] font-mono opacity-40 uppercase leading-tight mt-1">
                    {preferences.model.includes("/") ? "→ Routing priority: OpenRouter multi-provider relay." : (preferences.model.includes("pro") ? "→ Extraction priority: Maximum complexity & reasoning depth." : "→ Extraction priority: Speed & efficient token consumption.")}
                  </p>
                </div>

                <div className="space-y-4 group">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] uppercase font-mono font-bold tracking-widest opacity-60">Target_Audience_Segments [{preferences.targetAudience.length}]</label>
                    <BookOpen className="w-3 h-3 opacity-20" />
                  </div>
                  <div className={`w-full border max-h-48 overflow-y-auto p-4 space-y-2 scrollbar-thin ${
                    theme === 'dark' 
                      ? 'bg-[#1A1A1A] border-[#333] scrollbar-thumb-[#333] scrollbar-track-transparent' 
                      : 'bg-white/40 border-[#141414]/10 scrollbar-thumb-black/20 scrollbar-track-transparent'
                  }`}>
                    {[
                      "Business Professionals & Content Marketers", "General Audience / Beginners", "Technical Audience / Developers", 
                      "Students & Educators", "Executives & Decision Makers", "Hobbyists & Enthusiasts", "Creative Professionals",
                      "Digital Nomads", "E-commerce Founders", "SaaS Product Managers", "Environmental Activists", "Health & Wellness Coaches",
                      "Financial Advisors", "Real Estate Agents", "Cybersecurity Specialists", "AI Researchers", "UX/UI Designers",
                      "Data Scientists", "Blockchain Developers", "Cloud Architects", "Mobile App Developers", "Game Developers",
                      "Virtual Reality Content Creators", "Social Media Influencers", "Small Business Owners", "Startup Founders",
                      "Venture Capitalists", "Angel Investors", "HR Professionals", "Legal Tech Specialists", "Medical Professionals",
                      "Fitness Trainers", "Travel Bloggers", "Food Critics & Chefs", "Parent Communities", "Retirement Planners",
                      "Sustainability Consultants", "Non-Profit Directors", "Philanthropists", "Government Policy Makers", "Urban Planners",
                      "Architecture Enthusiasts", "Interior Designers", "Fashion Designers", "Music Producers", "Podcast Hosts",
                      "Video Editors", "Journalists & Reporters", "Bio-Tech Engineers", "Aerospace Enthusiasts", "Robotics Engineers",
                      "Renewable Energy Techs", "Agri-Tech Innovators", "Supply Chain Logistics Pros", "Customer Success Managers",
                      "Sales Representatives", "Public Relations Experts", "Event Planners"
                    ].map((audience) => (
                      <label key={audience} className="flex items-center gap-3 cursor-pointer group/item">
                        <div className="relative flex items-center justify-center">
                          <input 
                            type="checkbox"
                            checked={preferences.targetAudience.includes(audience)}
                            onChange={(e) => {
                              const newAudience = e.target.checked 
                                ? [...preferences.targetAudience, audience]
                                : preferences.targetAudience.filter(a => a !== audience);
                              setPreferences({ ...preferences, targetAudience: newAudience });
                            }}
                            className={`peer appearance-none w-4 h-4 border transition-colors ${
                              theme === 'dark' 
                                ? 'border-[#333] bg-[#0A0A0A] checked:bg-[#F8F8F7]' 
                                : 'border-[#141414] bg-white checked:bg-black'
                            }`}
                          />
                          <Check className={`w-2 h-2 absolute opacity-0 peer-checked:opacity-100 pointer-events-none ${theme === 'dark' ? 'text-black' : 'text-white'}`} />
                        </div>
                        <span className={`text-[11px] font-mono transition-colors ${preferences.targetAudience.includes(audience) ? 'font-bold' : 'opacity-60 group-hover/item:opacity-100'}`}>
                          {audience}
                        </span>
                      </label>
                    ))}
                  </div>
                  {preferences.targetAudience.length === 0 && (
                    <p className="text-[9px] font-mono text-red-500 uppercase flex items-center gap-1">
                      <AlertCircle className="w-2 h-2" />
                      Select at least one segment
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] uppercase font-mono font-bold tracking-widest opacity-60">Voice_Tones</label>
                    <div className="text-[8px] font-mono opacity-40 uppercase">Multi_Selection_Active</div>
                  </div>
                  <div className={`grid grid-cols-2 md:grid-cols-3 gap-2 border p-4 max-h-48 overflow-y-auto custom-scrollbar ${
                    theme === 'dark' ? 'border-[#333] bg-[#1A1A1A]' : 'border-[#141414]/10 bg-white/40'
                  }`}>
                    {[
                      "Professional", "Humorous", "Conversational", "Authoritative",
                      "Casual & Relatable", "Inspirational & Uplifting", "Direct & No-Nonsense",
                      "Playful & Quirky", "Thought-Provoking & Philosophical", "Urgent & Bold",
                      "Empathetic & Supportive", "Skeptical & Analytical", "Visionary & Future-Focused",
                      "Story-Driven & Narrative", "Educational & Instructive", "Minimalist & Concise",
                      "Energetic & High-Vibe", "Humble & Authentic", "Sarcastic & Witty",
                      "Scientific & Data-Driven", "Provocative & Contrarian", "Luxurious & Sophisticated",
                      "Nostalgic & Reflective", "Cyberpunk & Technical"
                    ].map((tone) => (
                      <label key={tone} className="flex items-center gap-2 cursor-pointer group/item">
                        <div className="relative flex items-center justify-center">
                          <input 
                            type="checkbox"
                            checked={preferences.tone.includes(tone)}
                            onChange={(e) => {
                              const newTone = e.target.checked 
                                ? [...preferences.tone, tone]
                                : preferences.tone.filter(t => t !== tone);
                              setPreferences({ ...preferences, tone: newTone });
                            }}
                            className={`peer appearance-none w-3 h-3 border transition-colors ${
                              theme === 'dark' 
                                ? 'border-[#333] bg-[#0A0A0A] checked:bg-[#F8F8F7]' 
                                : 'border-[#141414] bg-white checked:bg-black'
                            }`}
                          />
                          <Check className={`w-2 h-2 absolute opacity-0 peer-checked:opacity-100 pointer-events-none ${theme === 'dark' ? 'text-black' : 'text-white'}`} />
                        </div>
                        <span className={`text-[10px] font-mono transition-colors ${preferences.tone.includes(tone) ? 'font-bold' : 'opacity-60 group-hover/item:opacity-100'}`}>
                          {tone}
                        </span>
                      </label>
                    ))}
                  </div>
                  {preferences.tone.length === 0 && (
                    <p className="text-[9px] font-mono text-red-500 uppercase flex items-center gap-1">
                      <AlertCircle className="w-2 h-2" />
                      Select at least one tone
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] uppercase font-mono font-bold tracking-widest opacity-60">Target_Length</label>
                    <select 
                      value={preferences.length}
                      onChange={(e) => setPreferences({ ...preferences, length: e.target.value })}
                      className={`w-full border px-4 py-3 font-mono text-sm outline-none appearance-none cursor-pointer transition-colors ${
                        theme === 'dark' 
                          ? 'bg-[#1A1A1A] border-[#333] text-[#F8F8F7] focus:bg-black hover:border-[#F8F8F7]' 
                          : 'bg-[#F8F8F7] border-[#141414] text-[#141414] focus:bg-white hover:border-black'
                      }`}
                    >
                      <option>Short (approx. 300 words)</option>
                      <option>Medium (approx. 600 words)</option>
                      <option>Long-form (approx. 1000+ words)</option>
                      <option>SuperLong (approx. 2000+ words)</option>
                    </select>
                    <p className="text-[9px] font-mono opacity-40 uppercase leading-tight mt-1">
                      {preferences.length.includes("Short") && "→ Extraction priority: Executive summaries & core soundbites."}
                      {preferences.length.includes("Medium") && "→ Extraction priority: Balanced narrative & supporting evidence."}
                      {preferences.length.includes("Long") && "→ Extraction priority: Deep-dive analysis & comprehensive context."}
                      {preferences.length.includes("SuperLong") && "→ Extraction priority: Ultimate resource creation & whitepaper depth."}
                    </p>
                  </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className={`text-[10px] uppercase font-mono font-bold tracking-widest ${(!isFilesReady || preferences.targetAudience.length === 0) ? 'opacity-30' : 'opacity-60'}`}>Strategic_Focus</label>
                    <button
                      type="button"
                      onClick={handleGenerateFocus}
                      disabled={isGeneratingFocus || !isFilesReady || preferences.targetAudience.length === 0 || preferences.tone.length === 0}
                      className={`flex items-center gap-1 text-[10px] uppercase font-mono font-bold tracking-widest px-2 py-1 border transition-colors ${
                        theme === 'dark'
                          ? 'border-[#333] hover:bg-[#333] text-[#F8F8F7]'
                          : 'border-[#141414] hover:bg-[#141414] hover:text-white text-[#141414]'
                      } ${!isFilesReady || isGeneratingFocus || preferences.targetAudience.length === 0 || preferences.tone.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {isGeneratingFocus ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-3 h-3" />
                          Auto-Generate
                        </>
                      )}
                    </button>
                  </div>
                  <textarea 
                    value={preferences.specificFocus}
                    onChange={(e) => setPreferences({ ...preferences, specificFocus: e.target.value })}
                    disabled={!isFilesReady || preferences.targetAudience.length === 0 || preferences.tone.length === 0}
                    rows={4}
                    className={`w-full border px-4 py-3 font-mono text-sm outline-none resize-none transition-colors ${
                      theme === 'dark' 
                        ? 'bg-[#1A1A1A] border-[#333] text-[#F8F8F7] focus:bg-black hover:border-[#F8F8F7]' 
                        : 'bg-[#F8F8F7] border-[#141414] text-[#141414] focus:bg-white hover:border-black'
                    } ${!isFilesReady || preferences.targetAudience.length === 0 || preferences.tone.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                  {(!isFilesReady || preferences.targetAudience.length === 0 || preferences.tone.length === 0) && (
                    <p className="text-[10px] font-mono text-orange-500 opacity-80 uppercase leading-tight">
                      {preferences.targetAudience.length === 0 
                        ? "Awaiting_Audience: Select target segments to define strategic focus." 
                        : (preferences.tone.length === 0 
                            ? "Awaiting_Tone: Select voice tones to enable narrative generation." 
                            : "Awaiting_Uplink: Media context required to initialize strategic focus.")
                      }
                    </p>
                  )}
                </div>
              </div>
            </section>

            {credits !== null && credits < currentCost && !isAdmin ? (
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('open-topup'))}
                className={`w-full py-5 border-2 font-bold text-sm uppercase tracking-[0.2em] transition-all relative overflow-hidden group ${
                  theme === 'dark' 
                    ? 'bg-yellow-500 text-black border-yellow-500 hover:bg-yellow-400 shadow-[6px_6px_0px_0px_rgba(234,179,8,0.2)] active:shadow-none' 
                    : 'bg-yellow-500 text-black hover:bg-yellow-600 hover:text-white border-black shadow-[6px_6px_0px_0px_rgba(20,20,20,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]'
                }`}
              >
                <span className="relative z-10 flex items-center justify-center gap-3">
                  <div className="flex flex-col items-center">
                    <span>Buy Credits</span>
                    <span className="text-[8px] font-mono opacity-80 tracking-widest mt-0.5 uppercase">INSUFFICIENT FUNDS ({currentCost.toFixed(1)} REQ)</span>
                  </div>
                </span>
              </button>
            ) : (
              <div className="space-y-4">
                {auth.currentUser && !auth.currentUser.emailVerified && !isAdmin && (
                  <div className={`p-6 border-2 flex flex-col items-center gap-3 text-center ${theme === 'dark' ? 'border-orange-500/50 bg-orange-500/10' : 'border-[#141414] bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]'}`}>
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-orange-500">
                      <AlertCircle className="w-4 h-4" />
                      Protocol Locked
                    </div>
                    <p className={`text-[9px] font-mono leading-relaxed opacity-80 max-w-[300px] ${theme === 'dark' ? 'text-[#F8F8F7]' : 'text-black'}`}>
                      Email [ <span className="font-bold underline decoration-dotted">{auth.currentUser.email}</span> ] is unverified. 
                      Verification required to authorize synthesis credits.
                    </p>
                    <div className="flex gap-2 w-full mt-2">
                      <button 
                        onClick={async () => {
                          try {
                            await fetch('/api/auth/send-verification', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ email: auth.currentUser?.email, returnUrl: window.location.origin })
                            });
                            alert("Verification payload transmitted to " + auth.currentUser?.email);
                          } catch (err) {
                             console.error(err);
                             alert("Failed to transmit verification link.");
                          }
                        }}
                        className={`flex-1 py-2 text-[9px] uppercase font-black tracking-widest border-2 transition-all ${
                          theme === 'dark' ? 'border-[#F8F8F7] text-[#F8F8F7] hover:bg-[#F8F8F7] hover:text-black' : 'border-[#141414] text-[#141414] hover:bg-black hover:text-white'
                        }`}
                      >
                        Resend_Email
                      </button>
                      <button 
                        onClick={async () => {
                          if (auth.currentUser) {
                            await auth.currentUser.reload();
                            window.location.reload();
                          }
                        }}
                        className={`flex-1 py-2 text-[9px] uppercase font-black tracking-widest border-2 transition-all ${
                          theme === 'dark' ? 'border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black' : 'border-orange-600 text-orange-600 hover:bg-orange-600 hover:text-white'
                        }`}
                      >
                        Sync_Status
                      </button>
                    </div>
                  </div>
                )}
                
                <button 
                  onClick={handleGenerate}
                  disabled={isProcessing || mediaFiles.length === 0 || !mediaFiles.every(v => v.status === 'ACTIVE') || preferences.targetAudience.length === 0 || preferences.tone.length === 0 || (auth.currentUser && !auth.currentUser.emailVerified && !isAdmin)}
                  className={`w-full py-5 border-2 font-bold text-sm uppercase tracking-[0.2em] transition-all relative overflow-hidden group
                    ${isProcessing || mediaFiles.length === 0 || !mediaFiles.every(v => v.status === 'ACTIVE') || preferences.targetAudience.length === 0 || preferences.tone.length === 0 || (auth.currentUser && !auth.currentUser.emailVerified && !isAdmin)
                      ? 'bg-transparent text-[#8E9299] border-[#141414] opacity-50 cursor-not-allowed' 
                      : (theme === 'dark' 
                          ? 'bg-white text-black hover:bg-[#F8F8F7] border-[#F8F8F7] shadow-[6px_6px_0px_0px_rgba(255,255,255,0.1)] active:shadow-none' 
                          : 'bg-white text-black hover:bg-black hover:text-white border-[#141414] shadow-[6px_6px_0px_0px_rgba(20,20,20,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]')}`}
                >
                  {isProcessing && <div className="absolute inset-0 bg-black/5 animate-pulse" />}
                  <span className="relative z-10 flex items-center justify-center gap-3">
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>{loadingMessages[loadingMessageIndex].title}</span>
                      </>
                    ) : !mediaFiles.every(v => v.status === 'ACTIVE') && mediaFiles.length > 0 ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Awaiting_Uplink...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <div className="flex flex-col items-center">
                          <span>Initialize Synthesis</span>
                          <span className="text-[8px] font-mono opacity-50 tracking-widest mt-0.5 uppercase">EST_COST: {currentCost.toFixed(1)}_CRD</span>
                        </div>
                      </>
                    )}
                  </span>
                </button>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-600 space-y-1">
                <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase">
                  <AlertCircle className="w-3 h-3" />
                  ERROR_LOG [CRITICAL]
                </div>
                <p className="text-xs font-mono leading-tight">{error}</p>
              </div>
            )}
          </div>

          {/* Preview Panel */}
          <div id="onboarding-preview" className={`lg:col-span-7 lg:border-l ${theme === 'dark' ? 'bg-[#0A0A0A] border-[#333]' : 'bg-[#F8F8F7] border-[#141414]'} min-h-[700px] flex flex-col transition-colors duration-300`}>
            <div className={`border-b ${theme === 'dark' ? 'border-[#333] bg-[#141414]' : 'border-[#141414] bg-white'} px-8 py-4 flex items-center justify-between overflow-hidden transition-colors`}>
               <span className="font-serif italic text-xs uppercase opacity-50 tracking-widest">03 / Output Preview</span>
               <div className="flex items-center gap-4">
                 {blogPost && (
                   <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setViewerContent({ content: blogPost, title: blogPost.split('\n')[0].replace(/^#+\s*/, '') || "Untitled Synthesis" })}
                        className={`p-2 border-2 ${theme === 'dark' ? 'border-[#333] hover:bg-white hover:text-black' : 'border-[#141414] hover:bg-black hover:text-white'} transition-all`}
                        title="Enter Reading Mode"
                      >
                        <BookOpen className="w-4 h-4" />
                      </button>

                      <div className={`flex items-center border p-1 ${theme === 'dark' ? 'bg-[#0A0A0A] border-[#333]' : 'bg-[#F8F8F7] border-[#141414]'}`}>
                      <button 
                        onClick={() => setViewMode("preview")}
                        className={`px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-widest transition-colors ${viewMode === 'preview' ? (theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white') : 'hover:bg-black/5'}`}
                      >
                        Preview
                      </button>
                      <button 
                        onClick={() => setViewMode("raw")}
                        className={`px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-widest transition-colors ${viewMode === 'raw' ? (theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white') : 'hover:bg-black/5'}`}
                      >
                        Markdown
                      </button>
                      <button 
                        onClick={() => setViewMode("html")}
                        className={`px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-widest transition-colors ${viewMode === 'html' ? (theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white') : 'hover:bg-black/5'}`}
                      >
                        HTML
                      </button>
                   </div>
                </div>
               )}
               {blogPost && (
                   <div className="flex items-center gap-2">
                     {currentGenerationId && blogPost !== originalContent && (
                       <button 
                        onClick={handleUpdate}
                        className={`flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-widest px-3 py-2 border transition-all ${
                          theme === 'dark' 
                            ? 'border-yellow-500 bg-yellow-500/10 hover:bg-yellow-500 hover:text-black' 
                            : 'border-yellow-600 text-yellow-600 bg-yellow-50 hover:bg-yellow-600 hover:text-white'
                        }`}
                       >
                         <Check className="w-3 h-3" />
                         Save Edits
                       </button>
                     )}
                     <button 
                      onClick={copyToClipboard}
                      className={`flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-widest px-3 py-2 border transition-all ${
                        theme === 'dark' 
                          ? 'border-[#333] bg-[#1A1A1A] hover:bg-white hover:text-black shadow-[2px_2px_0px_0px_rgba(255,255,255,0.05)]' 
                          : 'border-[#141414] bg-white hover:bg-black hover:text-white shadow-[2px_2px_0px_0px_rgba(20,20,20,1)]'
                      } active:shadow-none active:translate-x-[1px] active:translate-y-[1px]`}
                    >
                      {isCopied ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      {isCopied ? "Transferred" : "Copy Source"}
                    </button>
                    <button 
                      onClick={exportToPDF}
                      className={`flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-widest px-3 py-2 border transition-all ${
                        theme === 'dark' 
                          ? 'border-[#333] bg-[#1A1A1A] hover:bg-white hover:text-black shadow-[2px_2px_0px_0px_rgba(255,255,255,0.05)]' 
                          : 'border-[#141414] bg-white hover:bg-black hover:text-white shadow-[2px_2px_0px_0px_rgba(20,20,20,1)]'
                      } active:shadow-none active:translate-x-[1px] active:translate-y-[1px]`}
                    >
                      <Download className="w-3 h-3" />
                      Export PDF
                    </button>
                   </div>
                  )}
               </div>
            </div>
            
            <div className={`flex-1 overflow-y-auto relative p-12 md:p-16 m-4 border selection:bg-yellow-200 transition-colors ${
              theme === 'dark' ? 'bg-[#141414] border-[#333]' : 'bg-white border-[#141414]'
            }`}>
              <AnimatePresence mode="wait">
                {isProcessing && (
                  <div className="absolute top-0 left-0 w-full h-1.5 z-30 overflow-hidden">
                    <motion.div 
                      className={`h-full ${theme === 'dark' ? 'bg-white' : 'bg-black'}`}
                      initial={{ left: "-100%" }}
                      animate={{ left: "100%" }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                      style={{ position: "absolute", width: "40%" }}
                    />
                    <div className={`absolute inset-0 opacity-20 ${theme === 'dark' ? 'bg-white/10' : 'bg-black/5'}`} />
                  </div>
                )}
                {isProcessing ? (
                  <motion.div 
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full flex flex-col items-center justify-center text-center space-y-8 py-20"
                  >
                    <div className="grid grid-cols-2 gap-2">
                       <span className={`w-4 h-4 animate-bounce [animation-delay:-0.3s] ${theme === 'dark' ? 'bg-white' : 'bg-black'}`} />
                       <span className={`w-4 h-4 animate-bounce [animation-delay:-0.15s] ${theme === 'dark' ? 'bg-white' : 'bg-black'}`} />
                       <span className={`w-4 h-4 animate-bounce [animation-delay:-0.2s] ${theme === 'dark' ? 'bg-white' : 'bg-black'}`} />
                       <span className={`w-4 h-4 animate-bounce ${theme === 'dark' ? 'bg-white' : 'bg-black'}`} />
                    </div>
                    <div className="space-y-3">
                      <h3 className="font-mono text-sm font-bold uppercase tracking-[0.3em]">{loadingMessages[loadingMessageIndex].title}</h3>
                      <p className="font-mono text-[10px] text-[#8E9299] max-w-[200px] mx-auto leading-relaxed">
                        {loadingMessages[loadingMessageIndex].detail}
                      </p>
                    </div>
                  </motion.div>
                ) : blogPost ? (
                  <motion.div
                    key={`${viewMode}-${blogPost.length}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="h-full"
                  >
                    {viewMode === 'preview' ? (
                      <div 
                        ref={contentRef}
                        className={`prose prose-neutral max-w-none p-4 transition-colors ${theme === 'dark' ? 'prose-invert bg-[#141414]' : 'bg-white'}
                        prose-h1:text-4xl prose-h1:font-extrabold prose-h1:tracking-tight prose-h1:mb-8 prose-h1:uppercase
                        prose-h2:text-2xl prose-h2:font-bold prose-h2:mt-12 prose-h2:mb-4 prose-h2:border-l-4 ${theme === 'dark' ? 'prose-h2:border-white' : 'prose-h2:border-black'} prose-h2:pl-4
                        prose-h3:text-xl prose-h3:font-bold prose-h3:mt-8 prose-h3:mb-3
                        prose-p:text-base prose-p:leading-relaxed prose-p:mb-6 ${theme === 'dark' ? 'prose-p:text-gray-300' : 'prose-p:text-gray-800'}
                        prose-ul:list-disc prose-li:mb-2
                        prose-blockquote:bg-gray-50 prose-blockquote-dark:bg-white/5 prose-blockquote:px-6 prose-blockquote:py-4 prose-blockquote:not-italic
                        ${theme === 'dark' ? 'prose-blockquote:border-l-white prose-blockquote:bg-white/5' : 'prose-blockquote:border-l-black prose-blockquote:bg-gray-50'}
                      `}>
                        <Markdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h1: ({ children }) => <h1 className="text-4xl font-serif italic mb-8 uppercase tracking-tight">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-2xl font-serif italic mt-12 mb-4 border-l-4 border-current pl-4">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-xl font-bold mt-8 mb-3">{children}</h3>,
                            blockquote: ({ children }) => (
                              <blockquote className={`my-8 pl-6 border-l-4 py-2 italic font-serif text-lg leading-relaxed ${theme === 'dark' ? 'border-white/20 text-white/70' : 'border-black/20 text-black/70'}`}>
                                {children}
                              </blockquote>
                            ),
                            p: ({ node, children, ...props }) => {
                              // Standalone images in markdown are often wrapped in a paragraph.
                              // We use the AST node to check if any child is a MEDIA_ID_ image.
                              const hasMedia = node?.children?.some((child: any) => 
                                child.tagName === "img" && child.properties?.src?.startsWith("MEDIA_ID_")
                              );

                              if (hasMedia) {
                                return <div className="mb-10 w-full" {...props}>{children}</div>;
                              }
                              return <p className={`text-base leading-relaxed mb-6 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-800'}`} {...props}>{children}</p>;
                            },
                            img: ({ node, src, alt, ...props }) => {
                              if (src?.startsWith('MEDIA_ID_')) {
                                const id = src.replace('MEDIA_ID_', '');
                                // Check both id and firestoreId to handle current session and restored history
                                const media = mediaFiles.find(m => m.id === id || m.firestoreId === id);
                                if (media && media.previewUrl) {
                                  const type = media.mimeType || media.file?.type || media.type || '';
                                  const name = media.name || media.file?.name || 'Asset';

                                  if (type.includes('image')) {
                                    return (
                                      <div className="group my-12 space-y-4">
                                        <div className="relative overflow-hidden">
                                          <img 
                                            src={media.previewUrl} 
                                            alt={alt || name} 
                                            referrerPolicy="no-referrer"
                                            className={`w-full rounded-sm border-2 ${theme === 'dark' ? 'border-[#333]' : 'border-black'} shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] transition-transform duration-700 group-hover:scale-[1.02]`} 
                                          />
                                          {/* Aesthetic Scanline Overlay */}
                                          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] bg-[length:100%_2px,3px_100%] opacity-20" />
                                          <div className={`absolute top-0 left-0 px-2 py-1 text-[8px] font-mono uppercase tracking-widest ${theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white'}`}>
                                            Visual_Asset_Ingested
                                          </div>
                                        </div>
                                        <p className="text-[10px] font-mono opacity-40 uppercase text-center italic tracking-widest">
                                          — {alt || name} {isAdmin && `(ID: ${media.firestoreId || media.id})`}
                                        </p>
                                      </div>
                                    );
                                  }
                                  if (type.includes('video')) {
                                    return (
                                      <div className="my-14 space-y-4">
                                          <div className={`relative border-2 ${theme === 'dark' ? 'border-[#333]' : 'border-black'} bg-black shadow-[12px_12px_0px_0px_rgba(0,0,0,0.1)]`}>
                                          <video src={media.previewUrl} controls className="w-full aspect-video" crossOrigin="anonymous" />
                                          <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-0.5 bg-red-600">
                                            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                            <span className="text-[8px] font-mono font-bold text-white uppercase tracking-tighter">Live_Context</span>
                                          </div>
                                        </div>
                                        <div className="flex items-center justify-center gap-4">
                                           <div className={`h-[1px] flex-1 ${theme === 'dark' ? 'bg-white/10' : 'bg-black/10'}`} />
                                           <p className="text-[10px] font-mono font-bold opacity-30 uppercase tracking-[0.3em]">Temporal_Data_Source: {name}</p>
                                           <div className={`h-[1px] flex-1 ${theme === 'dark' ? 'bg-white/10' : 'bg-black/10'}`} />
                                        </div>
                                      </div>
                                    );
                                  }
                                  if (type.includes('audio')) {
                                    return (
                                        <div className={`my-12 p-8 border-2 ${theme === 'dark' ? 'bg-[#0A0A0A] border-[#333]' : 'bg-[#F8F8F7] border-black'} rounded-sm shadow-[8px_8px_0px_0px_rgba(0,0,0,0.05)] relative overflow-hidden group`}>
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl -mr-16 -mt-16 group-hover:bg-indigo-500/10 transition-colors pointer-events-none" />
                                        <div className="flex items-center gap-6 mb-8">
                                          <div className={`w-12 h-12 flex items-center justify-center transition-transform group-hover:rotate-12 ${theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white'}`}>
                                            <FileAudio className="w-6 h-6" />
                                          </div>
                                          <div>
                                            <span className="block text-[10px] font-mono opacity-40 uppercase tracking-widest mb-1.5">Narrative_Audio_Asset</span>
                                            <span className="block text-sm font-bold uppercase tracking-tight">{name}</span>
                                          </div>
                                        </div>
                                        <audio src={media.previewUrl} controls className="w-full h-12" crossOrigin="anonymous" />
                                      </div>
                                    );
                                  }
                                  // Generic Document / PDF Card
                                  const isPdf = type.includes('pdf');
                                  return (
                                    <div className={`my-12 relative group max-w-2xl mx-auto ${theme === 'dark' ? 'bg-[#0A0A0A]' : 'bg-white'}`} id={`doc-card-${media.id}`}>
                                      <div className={`absolute -inset-1 ${isPdf ? 'bg-red-500/10' : 'bg-indigo-500/10'} rounded-sm blur-xl opacity-0 group-hover:opacity-100 transition-all duration-700`} />
                                      <div className={`relative border-2 p-8 flex flex-col md:flex-row items-center gap-8 transition-all duration-500 shadow-[0_0_0_0_rgba(0,0,0,0)] hover:shadow-[0_20px_40px_-20px_rgba(0,0,0,0.2)] ${theme === 'dark' ? 'border-[#333] hover:border-white/40' : 'border-black hover:-translate-y-1'}`}>
                                        <div className={`w-20 h-20 shrink-0 flex items-center justify-center border-2 rounded-sm transition-transform duration-500 group-hover:scale-110 ${isPdf ? 'border-red-500/40 bg-red-500/5' : 'border-indigo-500/40 bg-indigo-500/5'}`}>
                                          {isPdf ? (
                                            <div className="text-center">
                                              <FileText className="w-10 h-10 text-red-600 mb-0.5" />
                                              <span className="text-[8px] font-mono font-black text-red-600 block uppercase tracking-tighter">PDF_DOC</span>
                                            </div>
                                          ) : (
                                            <div className="text-center">
                                              <FileText className="w-10 h-10 text-indigo-600 mb-0.5" />
                                              <span className="text-[8px] font-mono font-black text-indigo-600 block uppercase tracking-tighter">WORD_DOC</span>
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex-1 min-w-0 space-y-2 text-center md:text-left">
                                          <div className="flex items-center justify-center md:justify-start gap-2">
                                            <div className={`w-2 h-2 rounded-full ${isPdf ? 'bg-red-500' : 'bg-indigo-500'} animate-pulse`} />
                                            <p className="text-[9px] font-mono font-bold opacity-40 uppercase tracking-[0.4em]">{isPdf ? 'Source_Document_Ref' : 'Knowledge_Fragment_Node'}</p>
                                          </div>
                                          <h4 className="text-xl font-bold uppercase tracking-tighter truncate leading-none">{name}</h4>
                                          <p className="text-[10px] font-mono opacity-50 uppercase tracking-widest leading-none">{( (media.size || 0) / (1024 * 1024)).toFixed(2)} MB • {media.status} • VERIFIED SOURCE</p>
                                        </div>
                                        <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
                                          <button 
                                            id={`btn-view-${media.id}`}
                                            onClick={() => setPreviewMedia(media)}
                                            className={`flex-1 md:flex-none px-6 py-3 border-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95 ${
                                              theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'
                                            }`}
                                          >
                                            View_Source
                                          </button>
                                          <button 
                                            id={`btn-dl-${media.id}`}
                                            onClick={() => {
                                              if (media.storageUrl) downloadFile({ ...media, id: media.id, name: media.name || 'document', type: media.mimeType || 'application/octet-stream', size: media.size || 0 });
                                              else if (media.file) downloadLocalFile(media.file);
                                            }}
                                            className={`p-3 border-2 transition-all hover:rotate-12 ${theme === 'dark' ? 'border-[#333] hover:bg-white hover:text-black' : 'border-black hover:bg-black hover:text-white'}`}
                                          >
                                            <Download className="w-5 h-5" />
                                          </button>
                                        </div>
                                      </div>
                                      {/* Snippet preview for docs if available */}
                                      {media.extractedText && (
                                        <div className={`mt-2 p-6 border-l-4 border-dashed text-[11px] font-mono opacity-60 italic leading-relaxed transition-all group-hover:opacity-100 ${theme === 'dark' ? 'bg-[#141414] border-white/20' : 'bg-gray-50/50 border-black/20'}`}>
                                           <span className="text-lg leading-none opacity-20 mr-2">"</span>
                                           {media.extractedText.substring(0, 240).trim()}...
                                           <span className="text-lg leading-none opacity-20 ml-2">"</span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                              }
                                if (src?.startsWith('MEDIA_ID_')) {
                                  const id = src.replace('MEDIA_ID_', '');
                                  return <div className="p-4 border border-dashed opacity-50 text-center font-mono text-[10px]">Reference_Lost {isAdmin && `: ${id}`}</div>;
                                }
                                return <img src={src} alt={alt} referrerPolicy="no-referrer" className={`max-w-full h-auto rounded-sm border ${theme === 'dark' ? 'border-white/10' : 'border-black/10'}`} {...props} />;
                            }
                          }}
                        >
                          {sanitizedPost}
                        </Markdown>
                      </div>
                    ) : viewMode === 'raw' ? (
                      <div className="flex-1 min-h-[600px] flex flex-col relative">
                        <textarea
                          readOnly={isProcessing}
                          value={blogPost || ""}
                          onScroll={(e) => e.stopPropagation()}
                          onChange={(e) => setBlogPost(e.target.value)}
                          className={`flex-1 w-full p-8 font-mono text-sm outline-none resize-none transition-colors border-none focus:ring-0 leading-relaxed ${
                            theme === 'dark' ? 'bg-[#141414] text-gray-300' : 'bg-white text-gray-800'
                          }`}
                          placeholder="Directly edit the markdown source here..."
                        />
                      </div>
                    ) : (
                      <div className="flex-1 min-h-[600px] flex flex-col relative">
                         <div className={`absolute top-4 right-4 z-10 px-2 py-1 text-[8px] font-mono uppercase tracking-widest border ${theme === 'dark' ? 'bg-black text-white border-white/20' : 'bg-white text-black border-black/20'}`}>
                           Raw_HTML_Source
                         </div>
                         <textarea
                          readOnly={isProcessing}
                          value={blogPost ? (viewMode === 'html' ? (marked.parse(sanitizedPost as string) as string) : blogPost) : ""}
                          onScroll={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            if (viewMode === 'html') {
                              // If they are in HTML mode and editing, it's risky but let's allow it if we treat it as the new content 
                              // (though it will save HTML as the blogPost source).
                              // Usually people want to edit the Markdown. 
                              // But the user asked for HTML editable.
                              setBlogPost(e.target.value);
                            }
                          }}
                          className={`flex-1 w-full p-8 font-mono text-[11px] outline-none resize-none transition-colors border-none focus:ring-0 leading-tight ${
                            theme === 'dark' ? 'bg-[#000] text-green-500/80' : 'bg-[#141414] text-[#00FF41]'
                          }`}
                        />
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-6 py-20 opacity-30">
                    <div className={`w-20 h-20 border border-dashed flex items-center justify-center mb-4 ${theme === 'dark' ? 'border-white' : 'border-[#141414]'}`}>
                       <ChevronRight className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-mono text-sm font-bold uppercase tracking-widest">Awaiting_Data</h3>
                      <p className="font-mono text-[10px]">Ready for ingestion protocol</p>
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>

      {/* Media Preview Modal */}
      <AnimatePresence>
        {previewMedia && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
            onClick={() => setPreviewMedia(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`relative max-w-5xl w-full max-h-[90vh] border-2 border-black overflow-hidden flex flex-col ${theme === 'dark' ? 'bg-[#0A0A0A] border-white/20' : 'bg-white border-black'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`p-4 border-b flex items-center justify-between ${theme === 'dark' ? 'border-white/10 bg-[#141414]' : 'border-black bg-white'}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 ${theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white'}`}>
                    {(previewMedia.mimeType?.includes('audio') || previewMedia.file?.type.includes('audio')) ? <FileAudio className="w-4 h-4" /> : 
                     (previewMedia.mimeType?.includes('image') || previewMedia.file?.type.includes('image')) ? <FileImage className="w-4 h-4" /> : 
                     (previewMedia.mimeType?.includes('video') || previewMedia.file?.type.includes('video')) ? <FileVideo className="w-4 h-4" /> :
                     <FileText className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-tight">{previewMedia.name}</h3>
                    <p className="text-[10px] font-mono opacity-40 uppercase tracking-widest">{previewMedia.mimeType || previewMedia.file?.type} • {((previewMedia.size || previewMedia.file?.size || 0) / (1024 * 1024)).toFixed(2)}MB</p>
                  </div>
                </div>
                <button 
                  onClick={() => setPreviewMedia(null)}
                  className={`p-2 transition-colors ${theme === 'dark' ? 'hover:bg-white hover:text-black' : 'hover:bg-black hover:text-white'}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 bg-black/95 flex items-center justify-center overflow-hidden min-h-[500px]">
                {(previewMedia.mimeType?.includes('video') || previewMedia.file?.type.includes('video')) && (
                  <video 
                    src={previewMedia.previewUrl} 
                    controls 
                    className="max-w-full max-h-[75vh] shadow-[0_0_100px_rgba(0,0,0,0.5)]"
                    autoPlay
                    crossOrigin="anonymous"
                  />
                )}
                {(previewMedia.mimeType?.includes('audio') || previewMedia.file?.type.includes('audio')) && (
                  <div className="w-full max-w-md p-12 bg-[#0A0A0A] border border-white/10 shadow-2xl rounded-sm">
                    <div className="flex flex-col items-center gap-10">
                       <div className="w-20 h-20 bg-white/5 border border-white/20 rounded-full flex items-center justify-center relative">
                          <FileAudio className="w-10 h-10 text-white/40" />
                          <div className="absolute inset-0 rounded-full border-b-2 border-white/20 animate-spin" />
                       </div>
                       <audio src={previewMedia.previewUrl} controls className="w-full" autoPlay crossOrigin="anonymous" />
                       <div className="text-center space-y-2">
                         <p className="text-white/40 font-mono text-[10px] uppercase tracking-[0.3em]">Temporal_Data_Source</p>
                       </div>
                    </div>
                  </div>
                )}
                {(previewMedia.mimeType?.includes('image') || previewMedia.file?.type.includes('image')) && (
                  <img 
                    src={previewMedia.previewUrl} 
                    alt={previewMedia.name} 
                    referrerPolicy="no-referrer"
                    className="max-w-full max-h-[80vh] object-contain shadow-2xl"
                  />
                )}
                {/* Robust PDF Support */}
                {(previewMedia.mimeType?.includes('pdf') || (previewMedia.file?.type === 'application/pdf')) && (
                  <iframe 
                    src={previewMedia.storageUrl || previewMedia.previewUrl} 
                    className="w-full h-full border-none bg-white"
                    title="PDF Preview"
                    referrerPolicy="no-referrer"
                  />
                )}
                {/* Robust Word/Doc Support */}
                {(previewMedia.mimeType?.includes('word') || previewMedia.name?.toLowerCase().endsWith('.docx') || previewMedia.name?.toLowerCase().endsWith('.doc')) && (
                  <div className="w-full h-full overflow-y-auto bg-gray-200/50 p-4 md:p-8 flex justify-center">
                    <div className="w-full max-w-3xl bg-white text-black font-serif shadow-[0_20px_50px_rgba(0,0,0,0.2)] min-h-[1100px] p-12 md:p-20 relative">
                       {/* Document Header Branding */}
                       <div className="flex items-center gap-6 border-b-2 border-black/10 pb-8 mb-12">
                          <div className="p-4 bg-black text-white shrink-0">
                             <FileText className="w-8 h-8" />
                          </div>
                          <div className="min-w-0">
                             <p className="text-[9px] font-mono font-bold uppercase tracking-[0.3em] text-black/30 mb-1">Source_Entity_Fragment</p>
                             <p className="text-xl md:text-2xl font-bold uppercase tracking-tighter leading-tight truncate">{previewMedia.name}</p>
                             <div className="flex items-center gap-4 mt-1">
                               <span className="text-[8px] font-mono opacity-40 uppercase tracking-widest">{((previewMedia.size || 0) / 1024).toFixed(0)} KB</span>
                               <span className="text-[8px] font-mono opacity-40 uppercase tracking-widest">• Verified Source</span>
                             </div>
                          </div>
                       </div>
                       
                       <div className="space-y-8">
                          {previewMedia.extractedText ? (
                            <div className="text-base leading-[1.8] text-black/90 font-serif whitespace-pre-wrap selection:bg-yellow-200">
                              {previewMedia.extractedText.length > 5000 
                                ? previewMedia.extractedText.substring(0, 5000) + '\n\n[... Remaining content truncated for terminal preview ...]' 
                                : previewMedia.extractedText}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-40 space-y-6 opacity-20">
                               <Loader2 className="w-10 h-10 animate-spin" />
                               <p className="text-xs font-mono uppercase tracking-[0.4em]">Extracting_Semantics</p>
                            </div>
                          )}
                       </div>

                       {/* Decorative Watermark */}
                       <div className="absolute bottom-12 right-12 opacity-[0.03] select-none pointer-events-none">
                          <p className="text-6xl font-black rotate-[-15deg] tracking-tighter">VELOCITY_AI</p>
                       </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className={`p-4 border-t flex justify-end ${theme === 'dark' ? 'border-white/10 bg-[#141414]' : 'border-black bg-white'}`}>
                <button 
                  onClick={() => setPreviewMedia(null)}
                  className={`px-6 py-2 border-2 font-bold text-xs uppercase tracking-widest transition-all active:shadow-none active:translate-x-[2px] active:translate-y-[2px] ${
                    theme === 'dark' 
                      ? 'border-white text-white hover:bg-white hover:text-black shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]' 
                      : 'border-black text-black hover:bg-black hover:text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                  }`}
                >
                  Close_Preview
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {isDeleteModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setIsDeleteModalOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={`relative max-w-sm w-full p-8 border-2 flex flex-col gap-6 ${theme === 'dark' ? 'bg-[#0A0A0A] border-red-500/50 shadow-[0_0_50px_rgba(239,68,68,0.1)]' : 'bg-white border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col gap-4 text-center">
                <div className={`w-12 h-12 mx-auto flex items-center justify-center border-2 ${theme === 'dark' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-red-50 text-red-600 border-red-600/20'}`}>
                  <Trash2 className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold uppercase tracking-tight">Confirm Deletion</h3>
                  <p className="text-xs font-mono opacity-60 leading-relaxed uppercase tracking-widest">
                    This action is permanent and will remove all associated files and generation data.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => genToDelete && deleteGeneration(genToDelete)}
                  className={`w-full py-4 border-2 font-bold text-xs uppercase tracking-widest transition-all px-6 py-2 shadow-[4px_4px_0px_0px_rgba(220,38,38,0.2)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] ${
                    theme === 'dark' 
                      ? 'bg-red-600 text-white border-red-600 hover:bg-red-700' 
                      : 'bg-red-600 text-white border-red-600 hover:bg-black'
                  }`}
                >
                  Confirm_Delete
                </button>
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  className={`w-full py-4 border-2 font-bold text-xs uppercase tracking-widest transition-all px-6 py-2 active:shadow-none active:translate-x-[2px] active:translate-y-[2px] ${
                    theme === 'dark' 
                      ? 'border-white text-white hover:bg-white hover:text-black shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]' 
                      : 'border-black text-black hover:bg-black hover:text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                  }`}
                >
                  Cancel_Operation
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Media Deletion Confirmation Modal */}
        {mediaFileToDelete && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setMediaFileToDelete(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={`relative max-w-sm w-full p-8 border-2 flex flex-col gap-6 ${theme === 'dark' ? 'bg-[#0A0A0A] border-red-500/50 shadow-[0_0_50px_rgba(239,68,68,0.1)]' : 'bg-white border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col gap-4 text-center">
                <div className={`w-12 h-12 mx-auto flex items-center justify-center border-2 ${theme === 'dark' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-red-50 text-red-600 border-red-600/20'}`}>
                  <Trash2 className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold uppercase tracking-tight text-red-600">Remove Source?</h3>
                  <p className="text-xs font-mono opacity-60 leading-relaxed uppercase tracking-widest">
                    You are about to remove <span className="font-bold underline">"{mediaFileToDelete.name || 'this asset'}"</span> from the source intake queue.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => {
                    removeMedia(mediaFileToDelete.id);
                    setMediaFileToDelete(null);
                  }}
                  className={`w-full py-4 border-2 font-bold text-xs uppercase tracking-widest transition-all px-6 py-2 shadow-[4px_4px_0px_0px_rgba(220,38,38,0.2)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] ${
                    theme === 'dark' 
                      ? 'bg-red-600 text-white border-red-600 hover:bg-red-700' 
                      : 'bg-red-600 text-white border-red-600 hover:bg-black'
                  }`}
                >
                  Confirm_Removal
                </button>
                <button 
                  onClick={() => setMediaFileToDelete(null)}
                  className={`w-full py-4 border-2 font-bold text-xs uppercase tracking-widest transition-all px-6 py-2 active:shadow-none active:translate-x-[2px] active:translate-y-[2px] ${
                    theme === 'dark' 
                      ? 'border-white text-white hover:bg-white hover:text-black shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]' 
                      : 'border-black text-black hover:bg-black hover:text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                  }`}
                >
                  Cancel_Release
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Metric Overlay (Bottom Right) */}
      <div className="fixed bottom-8 right-8 pointer-events-none hidden xl:block transition-all duration-300">
        <div className={`border-2 p-4 transition-colors duration-300 ${
          theme === 'dark' 
            ? 'bg-[#141414] border-[#333] shadow-[4px_4px_0px_0px_rgba(255,255,255,0.05)]' 
            : 'bg-white border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]'
        }`}>
          <div className="flex gap-8">
            <div className="space-y-1">
              <p className="text-[10px] font-mono uppercase opacity-40">Latent_Ref</p>
              <p className="font-mono text-xs font-bold uppercase">{preferences.model.replace(/-/g, '_')}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-mono uppercase opacity-40">Mime_Filter</p>
              <p className="font-mono text-xs font-bold">MULTI_STREAM</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    <AnimatePresence>
      {isAdminModalOpen && (
        <AdminDashboard theme={theme} isAdmin={isAdmin} onClose={() => setIsAdminModalOpen(false)} />
      )}
    </AnimatePresence>
    </AuthGuard>
  );
}
