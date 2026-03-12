const fetch = require('node-fetch');

async function testInterview() {
    console.log("Testing /api/resume/interview...");
    try {
        const response = await fetch("http://localhost:5001/api/resume/interview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                role: "React Developer",
                resumeData: "Experienced in JavaScript and React.",
                userQuestion: "Ask me 3 technical interview questions."
            })
        });
        const data = await response.json();
        console.log("Interview Response:", JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Interview test failed:", err.message);
    }
}

async function testAnalyze() {
    console.log("\nTesting /api/resume/analyze (Mocking file upload not easy with simple fetch, but checking fallback or logic)...");
    // This is hard to test without a real file upload via CLI easily, 
    // but we can check if the server is up and responding to routes.
}

testInterview();
