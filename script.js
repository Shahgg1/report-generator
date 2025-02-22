document.addEventListener("DOMContentLoaded", () => {
  // --- Simulated User Data Storage ---
  let users = [];
  let currentUser = null;
  let generatedReportContent = ""; // Holds the generated report text
  let pdfText = ""; // Stores extracted PDF text

  // --- Helper Functions ---
  const showElement = (id) => {
    document.getElementById(id).classList.remove("hidden");
  };
  const hideElement = (id) => {
    document.getElementById(id).classList.add("hidden");
  };

  // --- Toggle between Login and Signup Forms ---
  document.getElementById("show-signup").addEventListener("click", (e) => {
    e.preventDefault();
    hideElement("login-form");
    showElement("signup-form");
  });
  document.getElementById("show-login").addEventListener("click", (e) => {
    e.preventDefault();
    hideElement("signup-form");
    showElement("login-form");
  });

  // --- Sign Up Process ---
  document.getElementById("signup-btn").addEventListener("click", () => {
    const name = document.getElementById("signup-name").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;
    if (!name || !email || !password) {
      alert("Please fill in all fields.");
      return;
    }
    // Prevent duplicate registration
    if (users.find(u => u.email === email)) {
      alert("Email already registered. Please log in.");
      return;
    }
    users.push({ name, email, password });
    alert("Sign up successful! Please log in.");
    hideElement("signup-form");
    showElement("login-form");
  });

  // --- Login Process ---
  document.getElementById("login-btn").addEventListener("click", () => {
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) {
      alert("Invalid email or password.");
      return;
    }
    currentUser = user;
    localStorage.setItem("currentUser", JSON.stringify(user));
    switchToApp();
  });

  function switchToApp() {
    hideElement("auth-container");
    showElement("app-container");
    showElement("pdf-section");
  }

  // --- Logout Process ---
  document.getElementById("logout-btn").addEventListener("click", () => {
    currentUser = null;
    localStorage.removeItem("currentUser");
    document.getElementById("login-email").value = "";
    document.getElementById("login-password").value = "";
    hideElement("app-container");
    showElement("auth-container");
  });

  // --- Auto Sign-In if User Data Exists ---
  const storedUser = localStorage.getItem("currentUser");
  if (storedUser) {
    currentUser = JSON.parse(storedUser);
    switchToApp();
  }

  // --- Extract Text from PDF ---
  document.getElementById("pdf-upload").addEventListener("change", (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = function () {
      const typedarray = new Uint8Array(this.result);
      pdfjsLib.getDocument(typedarray).promise.then((pdf) => {
        let totalPages = pdf.numPages;
        let extractedText = "";
        let pagesProcessed = 0;

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          pdf.getPage(pageNum).then((page) => {
            page.getTextContent().then((textContent) => {
              extractedText += textContent.items.map((item) => item.str).join(" ");
              pagesProcessed++;
              if (pagesProcessed === totalPages) {
                pdfText = extractedText;
              }
            });
          });
        }
      });
    };
    reader.readAsArrayBuffer(file);
  });

  // --- Navigate to Prompt Section ---
  document.getElementById("next-to-prompt").addEventListener("click", () => {
    if (!pdfText) {
      alert("Please upload a PDF file.");
      return;
    }
    hideElement("pdf-section");
    showElement("prompt-section");
  });

  // --- Navigate to Format Section ---
  document.getElementById("next-to-format").addEventListener("click", () => {
    const promptText = document.getElementById("user-prompt").value.trim();
    if (!promptText) {
      alert("Please enter a prompt.");
      return;
    }
    hideElement("prompt-section");
    showElement("format-section");
  });

  // --- Helper: Tokenize Text ---
  function tokenize(text) {
    return text.toLowerCase().match(/\w+/g) || [];
  }

  // --- Helper: Calculate Jaccard Similarity ---
  function jaccardSimilarity(setA, setB) {
    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return intersection.size / union.size;
  }

  // --- Generate Report ---
  document.getElementById("generate-report").addEventListener("click", () => {
    const promptText = document.getElementById("user-prompt").value.trim();
    const formatText = document.getElementById("report-format").value.trim();

    if (!promptText || !formatText) {
      alert("Please fill in all fields.");
      return;
    }

    // Tokenize the prompt
    const promptTokens = new Set(tokenize(promptText));

    // Split PDF text into sentences
    const sentences = pdfText.split(/(?<=[.?!])\s+/);

    // Score each sentence based on relevance to the prompt
    const scoredSentences = sentences.map((sentence) => {
      const sentenceTokens = new Set(tokenize(sentence));
      const similarity = jaccardSimilarity(promptTokens, sentenceTokens);
      return { sentence, similarity };
    });

    // Filter and sort sentences by relevance
    const relevantSentences = scoredSentences
      .filter((item) => item.similarity > 0.1) // Keep only sentences with similarity > 10%
      .sort((a, b) => b.similarity - a.similarity) // Sort by relevance
      .map((item) => item.sentence); // Extract the sentence text

    // Build the report
    generatedReportContent = `=== AI-Generated Report ===\n\n` +
      `Prompt: ${promptText}\n\n` +
      `Custom Format: ${formatText}\n\n` +
      `Extracted Information:\n${relevantSentences.join("\n")}\n\n` +
      `Generated on: ${new Date().toLocaleString()}`;

    // Update the preview area
    document.getElementById("report-content").innerText = generatedReportContent;
    hideElement("format-section");
    showElement("report-display");
  });

  // --- Download Report as PDF ---
  document.getElementById("download-report").addEventListener("click", () => {
    if (!generatedReportContent.trim()) {
      alert("No report available. Please generate a report first.");
      return;
    }
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      // Split the report content into lines
      const lines = doc.splitTextToSize(generatedReportContent, 180);

      // Add each line to the PDF
      let y = 20; // Starting Y position
      const lineHeight = 10; // Space between lines
      const pageHeight = doc.internal.pageSize.height;

      lines.forEach((line) => {
        if (y + lineHeight > pageHeight) {
          doc.addPage(); // Add a new page if the current page is full
          y = 20; // Reset Y position for the new page
        }
        doc.text(line, 10, y);
        y += lineHeight; // Move to the next line
      });

      // Save the PDF
      doc.save(`AI_Report_${Date.now()}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("There was an error generating the PDF. Please try again.");
    }
  });
});