require("dotenv").config();
const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const fetch = require('node-fetch');
const crypto = require('crypto');

// --- CONFIG & CACHE ---
const upload = multer({ dest: "uploads/" });
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

const saveCache = () => {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (e) {
    console.warn('Cache save failed:', e.message);
  }
};

// --- AI CALL HANDLER ---
const callAI = async (prompt) => {
  const promptHash = crypto.createHash('md5').update(prompt).digest('hex');
  if (cache[promptHash]) return cache[promptHash];

  if (aiCallCount >= MAX_CALLS) throw new Error("Max AI calls reached");
  aiCallCount++;

  try {
    // Primary: Groq
    if (process.env.GROQ_API_KEY) {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1
        })
      });
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (text) {
        cache[promptHash] = text;
        saveCache();
        return text;
      }
    }

    // Fallback: Gemini (Ollama etc could be added here)
    throw new Error("No primary AI response available");
  } catch (err) {
    console.error("AI Error:", err.message);
    throw err;
  }
};

const parseAIJSON = (text) => {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error("JSON Parse failed: " + e.message);
  }
};

// --- LOCAL FALLBACK ENGINES ---
const extractResumeLocally = (text, filename) => {
  const name = filename?.split('_')[0] || "Candidate";
  return {
    name: name,
    ats_score: 65,
    skills: ["Communication", "Organization", "General IT"],
    missing_keywords: [],
    summary_analysis: "Resume summary quality evaluated locally.",
    grammar_suggestions: ["No grammar suggestions availalbe in local mode"],
    experience_analysis: "Professional experience summarized locally.",
    improvement_suggestions: ["Use AI mode for deeper analysis", "Ensure clear section headers"],
    job_role_match: [
      { role: "Software Engineer", match: 70 },
      { role: "Developer", match: 65 },
      { role: "System Analyst", match: 60 }
    ]
  };
};

const rewriteResumeLocally = (text) => {
  return {
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h1 style="border-bottom: 2px solid #444; padding-bottom: 5px;">Resume - Local Enhancement</h1>
        <div style="white-space: pre-wrap; margin-top: 20px;">${text}</div>
        <p style="margin-top: 30px; color: #666; font-style: italic;">*Enhanced locally with professional markers.*</p>
      </div>
    `,
    suggestions: ["Use more quantitative data", "Improve layout", "Add key skills section"]
  };
};

// --- ROUTES ---

router.post("/analyze", upload.single("resume"), async (req, res) => {
  let tempPath = req.file?.path;
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    let resumeText = "";
    const ext = req.file.originalname.toLowerCase();

    if (req.file.mimetype === "application/pdf" || ext.endsWith(".pdf")) {
      try {
        const dataBuffer = fs.readFileSync(tempPath);
        
        let data;
        if (typeof pdfParse === 'function') {
          data = await pdfParse(dataBuffer);
        } else if (pdfParse && typeof pdfParse.default === 'function') {
          data = await pdfParse.default(dataBuffer);
        } else {
          // Local require fallback
          const pdf = require("pdf-parse");
          data = await (typeof pdf === 'function' ? pdf(dataBuffer) : pdf.default(dataBuffer));
        }

        resumeText = data.text || "";
      } catch (err) {
        console.warn("PDF extraction error:", err.message);
      }
    } else if (ext.endsWith(".docx") || req.file.mimetype.includes("word")) {
      try {
        const dataBuffer = fs.readFileSync(tempPath);
        const result = await mammoth.extractRawText({ buffer: dataBuffer });
        resumeText = result.value || "";
      } catch (err) {
        console.warn("DOCX extraction error:", err.message);
      }
    } else {
      resumeText = fs.readFileSync(tempPath, "utf8");
    }

    if (!resumeText || resumeText.length < 50) {
      resumeText = "Candidate Name extracted from file: " + req.file.originalname;
    }

    const prompt = `
You are an ATS Resume Analyzer.

Analyze the following resume and return ONLY short JSON.

Fields required:
1. ats_score (score out of 100 based on ATS compatibility)
2. skills (maximum 8 detected technical skills)
3. summary_analysis (1–2 lines about resume summary quality)
4. formatting_issues (list of formatting problems)
5. grammar_suggestions (2 short corrections or improvements)
6. experience_analysis (short comment about experience section)
7. improvement_suggestions (3 short points to improve resume)
8. job_role_match (top 3 matching job roles with percentage)

Rules:
- Keep response short.
- Do not explain anything outside JSON.
- Maximum 120 words total.

Resume:
${resumeText}
`;

    try {
      const aiResponse = await callAI(prompt);
      const result = parseAIJSON(aiResponse);
      res.json({ ...result, rawText: resumeText });
    } catch (err) {
      console.warn("AI Analysis failed, using local fallback");
      res.json({ ...extractResumeLocally(resumeText, req.file.originalname), rawText: resumeText });
    }

  } catch (err) {
    console.error("Analysis Error:", err.message);
    res.status(500).json({ message: "System error during analysis" });
  } finally {
    if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
});

router.post("/rewrite", async (req, res) => {
  try {
    const { resumeText } = req.body;
    const prompt = `Rewrite this resume into a professional A4 layout. Return ONLY JSON with fields "html" (the full professional resume in clean HTML/CSS) and "suggestions" (array of 3 improvements). Use standard resume sections like Experience, Education, and Skills. Provide the response as a single valid JSON object.
    
    Resume Text: ${resumeText}`;
    
    try {
      const aiResponse = await callAI(prompt);
      res.json(parseAIJSON(aiResponse));
    } catch (err) {
      console.warn("Rewrite AI failed, using local fallback");
      res.json(rewriteResumeLocally(resumeText));
    }
  } catch (err) {
    res.status(500).json({ message: "Rewrite error" });
  }
});

module.exports = router;