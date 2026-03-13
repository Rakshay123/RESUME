require("dotenv").config();
const fetch = require("node-fetch");

async function testGroq() {
  console.log("Testing Groq API...");
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("GROQ_API_KEY is missing from .env");
    return;
  }
  
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: "Say hello" }]
      })
    });
    
    const data = await response.json();
    if (response.ok) {
      console.log("Groq API Success:", data.choices[0].message.content);
    } else {
      console.error("Groq API Error:", data);
    }
  } catch (err) {
    console.error("Fetch failed:", err.message);
  }
}

testGroq();
