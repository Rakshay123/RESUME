const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
let pdfParse = require("pdf-parse");
if (typeof pdfParse !== "function" && pdfParse.default) {
  pdfParse = pdfParse.default;
}
const mammoth = require("mammoth");
const fetch = require('node-fetch');
const crypto = require('crypto');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Global counter and cache for 100 trials max
let aiCallCount = 0;
const MAX_CALLS = 100;
const CACHE_FILE = './ai_cache.json';

let cache = {};
if (fs.existsSync(CACHE_FILE)) {
  try {
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch (e) {
    console.warn('Cache load failed:', e.message);
  }
}

// Save cache on exit
process.on('SIGINT', () => {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  process.exit();
});

const callAI = async (prompt) => {
  console.log("callAI initiated...");
  console.log("Checking keys: Groq:", !!process.env.GROQ_API_KEY, "OpenAI:", !!process.env.OPENAI_API_KEY, "Gemini:", !!process.env.GEMINI_API_KEY);
  const promptHash = crypto.createHash('md5').update(prompt).digest('hex');
  
  if (cache[promptHash]) {
    console.log('AI Cache HIT:', promptHash.slice(0,8));
    return cache[promptHash];
  }
  
  if (aiCallCount >= MAX_CALLS) {
    console.warn('Max AI calls reached. Using fallback.');
    throw new Error(`Max AI calls (${MAX_CALLS}) reached for this session.`);
  }
  
  aiCallCount++;
  console.log(`AI Call ${aiCallCount}/${MAX_CALLS}`);
  
  let responseText;
  try {
    if (process.env.GROQ_API_KEY) {
      console.log("Using Groq...");
      const apiKey = process.env.GROQ_API_KEY;
      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
          max_tokens: 1024,
          response_format: { type: "json_object" }
        })
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: { message: resp.statusText } }));
        throw new Error(`Groq API error (${resp.status}): ${errData.error?.message || resp.statusText}`);
      }

      const data = await resp.json();
      responseText = data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : "";
    } else if (process.env.OPENAI_API_KEY) {
      console.log("Using OpenAI...");
      const apiKey = process.env.OPENAI_API_KEY;
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 800
        })
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: { message: resp.statusText } }));
        throw new Error(`OpenAI API error (${resp.status}): ${errData.error?.message || resp.statusText}`);
      }

      const data = await resp.json();
      responseText = data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : "";
    } else if (process.env.GEMINI_API_KEY) {
      console.log("Using Gemini API Key: " + process.env.GEMINI_API_KEY.slice(0, 5) + "...");
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const maxRetries = 5;
      let lastError = null;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`Gemini attempt ${attempt}...`);
          const result = await model.generateContent(prompt);
          const response = await result.response;
          const text = response.text();
          if (!text) throw new Error("Empty response from Gemini");
          
          responseText = text;
          console.log("Gemini response success!");
          break;
        } catch (error) {
          lastError = error;
          console.error(`Gemini attempt ${attempt} failed:`, error.message);
          if (error.message.includes("429") || error.message.includes("quota")) {
            console.warn(`Quota hit. Retrying in ${attempt * 2}s...`);
            await new Promise(resolve => setTimeout(resolve, attempt * 2000));
            continue;
          }
          break;
        }
      }
      if (!responseText) throw lastError || new Error("Gemini failed after retries");
    } else {
      throw new Error("No API key (GROQ_API_KEY, OPENAI_API_KEY or GEMINI_API_KEY) found in .env");
    }

    if (responseText) {
      cache[promptHash] = responseText;
      try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
      } catch (e) {
        console.warn("Failed to write cache file:", e.message);
      }
    }
    return responseText;
  } catch (err) {
    console.error("callAI Error Context:", err.message);
    throw err;
  }
};

const upload = multer({ dest: "uploads/" });

// Local Fallback helper
const extractResumeLocally = (text) => {
  console.log("Running local extraction fallback...");
  const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
  const phoneMatch = text.match(/(\+?1?\s*\(?[0-9]{3}\)?[\s.-]?[0-9]{3}[\s.-]?[0-9]{4})/);
  let nameMatch = text.match(/^([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,2})/m);
  
  const skillKeywords = ["javascript", "python", "react", "node", "java", "sql", "mongodb", "express", "html", "css", "typescript", "aws", "docker", "kubernetes", "api", "rest", "graphql", "git", "linux"];
  const foundSkills = skillKeywords.filter(skill => text.toLowerCase().includes(skill));
  
  return {
    name: nameMatch ? (nameMatch[1] || nameMatch[0]) : "Candidate Name",
    email: emailMatch ? emailMatch[1] : "not@detected.com",
    phone: phoneMatch ? phoneMatch[1] : "Not detected",
    skills: foundSkills.slice(0, 6).length > 0 ? foundSkills.slice(0, 6) : ["Communication", "Leadership", "Technical Skills"],
    ats_score: Math.min(100, Math.round((foundSkills.length / 10) * 100)) || 25,
    summary_analysis: "Local extraction used as fallback. Technical skills detected and analyzed.",
    strengths: ["Clear layout", "Technical background", "Professional focus"],
    weaknesses: ["Missing metric-driven results", "Could use more specific tools", "Limited context"],
    improvement_suggestions: ["Add: Quantify your achievements with numbers", "Fix: Include more industry keywords", "Action: Expand on project impact"],
    job_role_match: [
      { role: "Software Developer", match: 70 },
      { role: "Technical Analyst", match: 65 }
    ],
    experience_analysis: "Experience appears consistent with the detected skills.",
    formatting_issues: ["None detected locally"],
    grammar_suggestions: ["Ensure consistent tense across all bullet points"],
    rawText: text
  };
};

// JSON helper to clean and parse AI response
const parseAIJSON = (text) => {
  try {
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
    }
    const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
  } catch (e) {
    console.warn("AI JSON Parse failed, raw text:", text);
    throw new Error("Invalid response format from AI. Retrying may help.");
  }
};

// --- ROUTES ---

router.post("/analyze", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      console.warn("Upload attempt with no file.");
      return res.status(400).json({ message: "No file uploaded" });
    }

    console.log(`Analyzing file: ${req.file.originalname} (${req.file.mimetype})`);
    let resumeText = "";
    const ext = req.file.originalname.toLowerCase();

    if (req.file.mimetype === "application/pdf" || ext.endsWith(".pdf")) {
      console.log("Processing as PDF...");
      console.log("pdfParse function type:", typeof pdfParse);
      try {
        const dataBuffer = fs.readFileSync(req.file.path);
        
        // Try pdf-parse first
        console.log("Attempting pdf-parse extraction...");
        try {
          let data;
          if (typeof pdfParse === "function") {
            data = await pdfParse(dataBuffer);
          } else if (pdfParse && typeof pdfParse.default === "function") {
            data = await pdfParse.default(dataBuffer);
          } else {
            console.warn("pdfParse is not a function, skipping to fallback.");
          }
          if (data) {
            resumeText = data.text || "";
            console.log(`pdf-parse extracted ${resumeText.trim().length} characters.`);
          }
        } catch (e) {
          console.warn("pdf-parse library error:", e.message);
        }

        // Fallback to pdf2json if empty
        if (!resumeText.trim()) {
          console.log("pdf-parse returned empty text, falling back to pdf2json...");
          const PDFParser = require("pdf2json");
          const pdfParser = new PDFParser(null, 1); // 1 = text only mode
          
          resumeText = await new Promise((resolve, reject) => {
            pdfParser.on("pdfParser_dataError", errData => reject(errData.parserError));
            pdfParser.on("pdfParser_dataReady", pdfData => {
              const text = pdfParser.getRawTextContent();
              resolve(text || "");
            });
            pdfParser.loadPDF(req.file.path);
          });
          console.log(`pdf2json extracted ${resumeText.trim().length} characters.`);
        }
      } catch (pdfErr) {
        console.warn("PDF libraries failed, trying OCR:", pdfErr.message);
        try {
          const Tesseract = require("tesseract.js");
          console.log("Starting Tesseract OCR...");
          const { data: { text } } = await Tesseract.recognize(req.file.path, "eng");
          resumeText = text;
          console.log(`OCR extracted ${resumeText.trim().length} characters.`);
        } catch (ocrErr) {
          console.error("OCR failed:", ocrErr.message);
        }
      }
    } else if (ext.endsWith(".docx") || req.file.mimetype.includes("word") || req.file.mimetype.includes("officedocument")) {
      console.log("Processing as DOCX...");
      try {
        const dataBuffer = fs.readFileSync(req.file.path);
        const result = await mammoth.extractRawText({ buffer: dataBuffer });
        resumeText = result.value || "";
        console.log(`Mammoth extracted ${resumeText.trim().length} characters.`);
        if (result.messages.length > 0) console.log("Mammoth messages:", result.messages);
      } catch (docxErr) {
        console.error("DOCX extraction error:", docxErr.message);
      }
    } else {
      console.log("Processing as plain text...");
      resumeText = fs.readFileSync(req.file.path, "utf8");
    }

    if (!resumeText || !resumeText.trim()) {
      console.error("Extraction failed: All methods returned empty text.");
      return res.status(400).json({ 
        message: "Failed to extract text from resume. Ensure the file is not corrupted or password-protected." 
      });
    }

    const prompt = `You are an Advanced ATS Resume Analyzer using Llama 3.3 70B.
Analyze the resume and return a valid JSON object matching this schema:
{
  "name": "Candidate Full Name",
  "email": "email@example.com",
  "phone": "phone number",
  "ats_score": 85,
  "skills": ["Skill1", "Skill2", "Skill3", "Skill4", "Skill5", "Skill6"],
  "missing_keywords": ["Keyword1", "Keyword2"],
  "summary_analysis": "A brief professional summary of the candidate's profile (max 30 words).",
  "formatting_issues": ["Issue 1", "Issue 2"],
  "grammar_suggestions": ["Suggestion 1", "Suggestion 2"],
  "experience_analysis": "An evaluation of the candidate's work history and impact (max 40 words).",
  "improvement_suggestions": ["Action: Detail", "Action: Detail"],
  "job_role_match": [
    {"role": "Software Engineer", "match": 90},
    {"role": "Full Stack Developer", "match": 85}
  ],
  "strengths": ["Strength 1", "Strength 2", "Strength 3"],
  "weaknesses": ["Weakness 1", "Weakness 2", "Weakness 3"]
}

Rules:
* Extract data accurately from the text.
* Provide exactly 3 fields for strengths and weaknesses.
* Ensure ats_score is a number 0-100.
* Ensure improvement_suggestions are in "Action: Detail" format.
* Return ONLY the JSON object.

Resume Text:
${resumeText}`;

    try {
      console.log("Calling AI for analysis...");
      const aiResponse = await callAI(prompt);
      const result = parseAIJSON(aiResponse);
      console.log("Analysis successful!");
      res.json({ ...result, rawText: resumeText });
    } catch (err) {
      console.warn("AI Analyze failed, using local fallback:", err.message);
      res.json(extractResumeLocally(resumeText));
    } finally {
      fs.unlink(req.file.path, () => {});
    }
  } catch (err) {
    console.error("Route /analyze system error:", err.message);
    res.status(500).json({ message: "Analysis failed: " + err.message });
  }
});

router.post("/interview", async (req, res) => {
  try {
    const { role, resumeData, userQuestion } = req.body;
    console.log(`Interview request for role: ${role}`);
    
    // Strict rules for Interview Assistant
    const prompt = `You are a technical interview assistant.
Your job is to help candidates prepare for interviews based on their resume and job description.
Rules:
* Ask or answer interview questions related to the candidate's skills
* Keep answers short and clear
* Give practical explanations
* If the user asks for interview questions, generate 3-5 questions
* If the user asks for explanations, explain in simple terms

Candidate Resume Context:
${resumeData || "Not provided"}

Job Role:
${role || "Technical Role"}

User Message:
${userQuestion || "Start the interview practice."}`;

    try {
      const response = await callAI(prompt);
      res.json({ response });
    } catch (err) {
      console.error("Interview route error:", err.message);
      res.json({ response: "I'm having trouble connecting to my AI core. Let's try again in a moment." });
    }
  } catch (err) {
    res.status(500).json({ message: "Interview error: " + err.message });
  }
});

router.post("/jobmatch", async (req, res) => {
  try {
    const { jobDescription, resumeText } = req.body;
    const prompt = `Compare this resume with the job description. Return JSON: {match_score, matching_skills, missing_skills, recommendations}.
    
    Resume: ${resumeText || "N/A"}
    Job Description: ${jobDescription}`;
    
    try {
      const aiResp = await callAI(prompt);
      res.json(parseAIJSON(aiResp));
    } catch (err) {
      console.error("Jobmatch route error:", err.message);
      res.status(500).json({ message: "Job match failed" });
    }
  } catch (err) {
    res.status(500).json({ message: "Job match failed" });
  }
});

router.post("/recommend", async (req, res) => {
  try {
    const { resumeText } = req.body;
    const prompt = `Based on this resume, recommend 5 job roles. Return as JSON array of strings.
    Resume: ${resumeText}`;
    
    try {
      const aiResp = await callAI(prompt);
      res.json({ recommendations: parseAIJSON(aiResp) });
    } catch (err) {
      console.error("Recommend route error:", err.message);
      res.status(500).json({ message: "Recommendation failed" });
    }
  } catch (err) {
    res.status(500).json({ message: "Recommendation failed" });
  }
});

router.post("/rewrite", async (req, res) => {
  try {
    const { resumeText } = req.body;
    const prompt = `You are a professional resume writer.
Enhance and professionalize the following resume text.
Return ONLY a valid JSON object with two fields:
1. "rewritten": A clean, plain-text version of the enhanced resume.
2. "html": A beautifully formatted HTML version of the resume.

Rules for "html":
* Use modern, clean CSS (inline styles or standard tags).
* Include clear sections for "Experience", "Education", "Skills", and "Summary".
* Use a professional font-family (sans-serif).
* Add subtle formatting like bold titles and bullet points.
* Ensure the background is white and text is dark for PDF conversion.

Resume Text:
${resumeText}`;
    
    try {
      console.log("Calling AI for resume rewrite...");
      const aiResp = await callAI(prompt);
      const result = parseAIJSON(aiResp);
      res.json(result);
    } catch (err) {
      console.error("Rewrite route error:", err.message);
      res.status(500).json({ message: "AI Rewrite failed: " + err.message });
    }
  } catch (err) {
    res.status(500).json({ message: "Rewrite system error: " + err.message });
  }
});

module.exports = router;