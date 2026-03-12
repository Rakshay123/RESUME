require('dotenv').config();
const fetch = require('node-fetch');

async function testGroq() {
    console.log("Testing Groq API...");
    console.log("Model: llama-3.3-70b-versatile");
    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey) {
        console.error("GROQ_API_KEY is missing in .env");
        return;
    }

    try {
        const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [{ role: "user", content: "Say hello" }],
                max_tokens: 10
            })
        });

        const data = await resp.json();
        if (data.error) {
            console.error("Groq API Error:", data.error);
        } else {
            console.log("Groq Success:", data.choices[0].message.content);
        }
    } catch (err) {
        console.error("Fetch Error:", err.message);
    }
}

testGroq();
