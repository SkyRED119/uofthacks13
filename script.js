// ============================================================================
// RSVP Reader - Main Application Script WITH TTS SUPPORT
// ============================================================================

const API_BASE_URL = "http://localhost:5001";

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let words = [];
let currentIndex = 0;
let isReading = false;
let isPaused = false;
let manualPause = false;
let readingTimeout = null;
let wordsPerMinute = 300;
let currentFileName = "";
let previewHistory = [];
let audioAlignment = [];
let audioPlayer = new Audio();
let ttsEnabled = false;
let isTTSMode = false; // Track if we're in TTS-synced mode

// ============================================================================
// DOM ELEMENTS
// ============================================================================

let fileInput;
let fileLabel;
let fileInfo;
let rsvpSection;
let message;

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener("DOMContentLoaded", () => {
    initializeElements();
    setupEventListeners();
});

function initializeElements() {
    fileInput = document.getElementById("fileInput");
    fileLabel = document.querySelector(".file-upload-label");
    fileInfo = document.getElementById("fileInfo");
    rsvpSection = document.getElementById("rsvpSection");
    message = document.getElementById("message");
}

function setupEventListeners() {
    setupFileUploadListeners();
    setupKeyboardListeners();
    setupTTSToggle();
}

function setupTTSToggle() {
    const ttsToggle = document.getElementById("ttsToggle");
    const ttsStatus = document.getElementById("ttsStatus");
    
    ttsToggle.addEventListener("change", (e) => {
        ttsEnabled = e.target.checked;
        if (ttsEnabled) {
            ttsStatus.textContent = "✓ TTS will be enabled on next start";
            ttsStatus.style.color = "#86efac";
        } else {
            ttsStatus.textContent = "";
            // If currently reading with TTS, stop it
            if (isTTSMode && isReading) {
                audioPlayer.pause();
                audioPlayer.currentTime = 0;
                isTTSMode = false;
                showMessage("TTS disabled - switched to timer mode", "success");
            }
        }
    });
}

// ============================================================================
// FILE UPLOAD HANDLERS
// ============================================================================

function setupFileUploadListeners() {
    // Drag and drop
    fileLabel.addEventListener("dragover", (e) => {
        e.preventDefault();
        fileLabel.classList.add("dragover");
    });

    fileLabel.addEventListener("dragleave", () => {
        fileLabel.classList.remove("dragover");
    });

    fileLabel.addEventListener("drop", (e) => {
        e.preventDefault();
        fileLabel.classList.remove("dragover");
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    // File input change
    fileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });
}

function handleFile(file) {
    const isTxtOrMd = file.name.endsWith(".txt") || file.name.endsWith(".md");
    const isPdf = file.name.endsWith(".pdf");

    if (!isTxtOrMd && !isPdf) {
        showMessage("Please upload a .txt, .md, or .pdf file", "error");
        return;
    }

    if (isPdf) {
        handlePdf(file);
    } else {
        handleTxtOrMd(file);
    }
}

function handleTxtOrMd(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            currentFileName = file.name;
            const text = e.target.result;
            parseText(text);
            showMessage(`Loaded "${file.name}" - ${words.length} words found`, "success");
            fileInfo.classList.add("show");
            fileInfo.innerHTML = `<strong>${file.name}</strong><br>${words.length} words loaded`;
            rsvpSection.classList.add("active");
            document.getElementById("totalWords").textContent = words.length;

            sendEventToBackend("file_uploaded", {
                file_name: file.name,
                word_count: words.length,
            });
        } catch (error) {
            showMessage("Error reading file: " + error.message, "error");
        }
    };
    reader.onerror = () => {
        showMessage("Error reading file", "error");
    };
    reader.readAsText(file);
}

function handlePdf(file) {
    const formData = new FormData();
    formData.append("file", file);

    fetch(`${API_BASE_URL}/api/extract-pdf`, {
        method: "POST",
        body: formData,
    })
        .then((response) => response.json())
        .then((data) => {
            if (data.status === "success") {
                currentFileName = data.file_name;
                parseText(data.text);
                showMessage(`Loaded "${data.file_name}" - ${words.length} words found (${data.pages} pages)`, "success");
                fileInfo.classList.add("show");
                fileInfo.innerHTML = `<strong>${data.file_name}</strong><br>${words.length} words loaded from ${data.pages} pages`;
                rsvpSection.classList.add("active");
                document.getElementById("totalWords").textContent = words.length;

                if (data.direction === "rtl") {
                    document.querySelector(".rsvp-container").classList.add("rtl");
                } else {
                    document.querySelector(".rsvp-container").classList.remove("rtl");
                }

                sendEventToBackend("file_uploaded", {
                    file_name: data.file_name,
                    word_count: words.length,
                    pages: data.pages,
                    file_type: "pdf",
                });
            } else {
                showMessage("Error extracting PDF: " + data.message, "error");
            }
        })
        .catch((error) => {
            showMessage("Error uploading PDF: " + error.message, "error");
        });
}

// ============================================================================
// TEXT PARSING
// ============================================================================

function parseText(text) {
    words = text
        .split(/[\s\-—]+/)
        .filter((word) => word.length > 0);
}

// ============================================================================
// KEYBOARD HANDLERS
// ============================================================================

function setupKeyboardListeners() {
    document.addEventListener("keydown", (e) => {
        if (!rsvpSection.classList.contains("active")) return;

        const searchInput = document.getElementById("searchInput");
        if (document.activeElement === searchInput) {
            if (e.code === "Enter") {
                e.preventDefault();
                searchNextWord();
            }
            return;
        }

        if (e.code === "Space") {
            e.preventDefault();
            if (isReading) {
                manualPauseReading();
            } else if (isPaused) {
                manualResumeReading();
            }
        }

        if (e.code === "ArrowUp" || e.code === "ArrowRight") {
            e.preventDefault();
            adjustWPM(50);
        }

        if (e.code === "ArrowDown" || e.code === "ArrowLeft") {
            e.preventDefault();
            adjustWPM(-50);
        }

        if (e.code === "Enter") {
            e.preventDefault();
            const startButton = document.getElementById("startButton");
            if (!startButton.disabled) {
                startReading();
            }
        }

        if (e.code === "KeyR") {
            e.preventDefault();
            resetReading();
        }
    });
}

function adjustWPM(delta) {
    const slider = document.getElementById("speedSlider");
    const newValue = Math.min(1000, Math.max(100, parseInt(slider.value) + delta));
    slider.value = newValue;
    updateSpeed();
}

// ============================================================================
// READING CONTROLS
// ============================================================================

async function startReading() {
    if (event) event.preventDefault();

    if (words.length === 0) {
        showMessage("Please upload a file first", "error");
        return;
    }
    
    isReading = true;
    isPaused = false;
    currentIndex = 0;
    document.getElementById("startButton").disabled = true;
    document.getElementById("pauseButton").disabled = false;

    const currentWPM = parseInt(document.getElementById("speedSlider").value);

    // Auto-play music
    const musicPlayer = document.getElementById("musicPlayer");
    if (musicPlayer) {
        musicPlayer.play().catch(err => console.log("Music autoplay not allowed"));
    }

    sendEventToBackend("reading_started", { tts_enabled: ttsEnabled });

    // Choose reading mode
    if (ttsEnabled) {
        await startTTSMode(currentWPM);
    } else {
        displayNextWord();
    }
}

async function startTTSMode(currentWPM) {
    try {
        isTTSMode = true;
        showMessage("🎙️ Generating speech audio... Please wait", "success");
        
        console.log("TTS Mode: Starting generation...");
        console.log(`Text: ${words.length} words, WPM: ${currentWPM}`);
        
        const response = await fetch(`${API_BASE_URL}/api/generate-tts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                text: words.join(" "), 
                wpm: currentWPM 
            })
        });
        
        console.log("TTS Response status:", response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error("TTS Response error:", errorText);
            throw new Error(`TTS generation failed: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("TTS Response data:", data);
        
        if (data.status === "error") {
            throw new Error(data.error || "Unknown TTS error");
        }
        
        audioAlignment = data.alignment || [];
        console.log(`Loaded ${audioAlignment.length} word alignments`);
        
        // Set audio source
        audioPlayer.src = `${API_BASE_URL}${data.audio_url}`;
        audioPlayer.src += `?t=${new Date().getTime()}`;
        audioPlayer.load(); // Force the browser to fetch the new file

        // Sync display to audio playback
        audioPlayer.ontimeupdate = () => {
            if (!isTTSMode || !isReading) return;
            
            const currentTimeMs = audioPlayer.currentTime * 1000;
            
            // Find the word that should be displayed at this time
            for (let i = 0; i < audioAlignment.length; i++) {
                const wordData = audioAlignment[i];
                if (currentTimeMs >= wordData.start_time_ms && currentTimeMs <= wordData.end_time_ms) {
                    // Find this word in our words array
                    if (i !== currentIndex && i < words.length) {
                        currentIndex = i;
                        processWordWithBackend(words[i]);
                        updateContextDisplay();
                        document.getElementById("currentWord").textContent = currentIndex + 1;
                        const progress = ((currentIndex + 1) / words.length) * 100;
                        document.getElementById("progressFill").style.width = progress + "%";
                    }
                    break;
                }
            }
        };

        audioPlayer.onended = () => {
            console.log("TTS audio ended");
            isReading = false;
            isTTSMode = false;
            document.getElementById("startButton").disabled = false;
            document.getElementById("pauseButton").disabled = true;
            document.getElementById("rsvpWord").textContent = "Finished!";
            showMessage("Reading complete!", "success");
        };

        audioPlayer.onerror = (e) => {
            console.error("Audio playback error:", e);
            showMessage("Audio file not found or failed to load. Check backend console.", "error");
            isReading = false;
            document.getElementById("startButton").disabled = false;
        };

        console.log("Starting audio playback...");
        await audioPlayer.play();
        console.log("Audio is playing!");
        showMessage("🔊 Speech playing - words synced to audio!", "success");
        
    } catch (error) {
        console.error("TTS error:", error);
        showMessage(`⚠️ TTS failed (${error.message}) - using timer mode instead`, "error");
        isTTSMode = false;
        ttsEnabled = false;
        document.getElementById("ttsToggle").checked = false;
        document.getElementById("ttsStatus").textContent = "";
        // Fallback to normal reading
        displayNextWord();
    }
}

function pauseReading() {
    if (isReading) {
        isPaused = true;
        isReading = false;
        clearTimeout(readingTimeout);
        document.getElementById("pauseButton").disabled = true;
        document.getElementById("resumeButton").disabled = false;

        if (isTTSMode) {
            audioPlayer.pause();
        }

        sendEventToBackend("reading_paused");
    }
}

function resumeReading() {
    if (isPaused) {
        isPaused = false;
        isReading = true;
        document.getElementById("pauseButton").disabled = false;
        document.getElementById("resumeButton").disabled = true;

        sendEventToBackend("reading_resumed");

        if (isTTSMode) {
            audioPlayer.play();
        } else {
            displayNextWord();
        }
    }
}

function manualPauseReading() {
    if (isReading) {
        manualPause = true;
        // Only pause music during MANUAL pauses
        const musicPlayer = document.getElementById("musicPlayer");
        if (musicPlayer && !musicPlayer.paused) { 
            musicPlayer.pause(); 
        }
        pauseReading();
    }
}

function manualResumeReading() {
    if (isPaused && manualPause) {
        manualPause = false;
        // Only resume music during MANUAL resumes
        const musicPlayer = document.getElementById("musicPlayer");
        if (musicPlayer && musicPlayer.paused) { 
            musicPlayer.play().catch(err => console.log("Music autoplay blocked")); 
        }
        resumeReading();
    }
}

function resetReading() {
    isReading = false;
    isPaused = false;
    currentIndex = 0;
    previewHistory = [];
    isTTSMode = false;
    clearTimeout(readingTimeout);
    
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    audioAlignment = [];
    
    document.getElementById("rsvpWord").textContent = "Ready?";
    document.getElementById("currentWord").textContent = "0";
    document.getElementById("progressFill").style.width = "0%";
    document.getElementById("contextText").innerHTML = "";
    document.getElementById("startButton").disabled = false;
    document.getElementById("pauseButton").disabled = true;
    document.getElementById("resumeButton").disabled = true;

    const musicPlayer = document.getElementById("musicPlayer");
    if (musicPlayer) {
        musicPlayer.pause();
        musicPlayer.currentTime = 0;
    }

    sendEventToBackend("reading_reset");
}

function loadCustomMusic(event) {
    const file = event.target.files[0];
    if (!file) return;

    const musicPlayer = document.getElementById("musicPlayer");
    const fileURL = URL.createObjectURL(file);
    
    const sources = musicPlayer.getElementsByTagName("source");
    if (sources.length > 0) {
        sources[0].src = fileURL;
    } else {
        const source = document.createElement("source");
        source.type = file.type;
        source.src = fileURL;
        musicPlayer.appendChild(source);
    }
    
    musicPlayer.load();
    showMessage(`Loaded custom music: ${file.name}`, "success");
}

// ============================================================================
// WORD DISPLAY AND TIMING
// ============================================================================

function updateContextDisplay() {
    const contextRadius = 10;
    const start = Math.max(0, currentIndex - contextRadius);
    const end = Math.min(words.length, currentIndex + contextRadius + 1);
    
    const contextWords = words.slice(start, end);
    
    const html = contextWords
        .map((word, idx) => {
            const actualIndex = start + idx;
            if (actualIndex === currentIndex) {
                return `<span class="current-word">${word}</span>`;
            }
            return `<span class="clickable-word" onclick="jumpToWord(${actualIndex})" title="Click to jump to this word">${word}</span>`;
        })
        .join(" ");
    
    document.getElementById("contextText").innerHTML = html;
}

function jumpToWord(index) {
    if (index < 0 || index >= words.length) {
        return;
    }
    currentIndex = index;
    clearTimeout(readingTimeout);
    
    processWordWithBackend(words[index]);
    updateContextDisplay();
    document.getElementById("currentWord").textContent = index + 1;
    document.getElementById("progressFill").style.width = ((index + 1) / words.length) * 100 + "%";
    
    sendEventToBackend("word_jumped", {
        word_index: index,
        word: words[index],
    });
}

function searchNextWord() {
    const searchTerm = document.getElementById("searchInput").value.toLowerCase().trim();
    const searchMessage = document.getElementById("searchMessage");
    
    if (!searchTerm) {
        searchMessage.textContent = "Please enter a word to search";
        searchMessage.style.color = "#fca5a5";
        return;
    }
    
    if (searchTerm.includes(" ")) {
        searchMessage.textContent = "Please search for only one word at a time";
        searchMessage.style.color = "#fca5a5";
        return;
    }
    
    let foundIndex = -1;
    for (let i = currentIndex + 1; i < words.length; i++) {
        if (words[i].toLowerCase().includes(searchTerm)) {
            foundIndex = i;
            break;
        }
    }
    
    if (foundIndex === -1) {
        for (let i = 0; i <= currentIndex; i++) {
            if (words[i].toLowerCase().includes(searchTerm)) {
                foundIndex = i;
                break;
            }
        }
    }
    
    if (foundIndex !== -1) {
        jumpToWord(foundIndex);
        searchMessage.textContent = `Found "${searchTerm}" in "${words[foundIndex]}" at word ${foundIndex + 1} of ${words.length}`;
        searchMessage.style.color = "#86efac";
        
        sendEventToBackend("word_searched", {
            search_term: searchTerm,
            word_index: foundIndex,
            word: words[foundIndex],
        });
    } else {
        searchMessage.textContent = `"${searchTerm}" not found in document`;
        searchMessage.style.color = "#fca5a5";
    }
}

function displayNextWord() {
    // Don't run timer-based display in TTS mode
    if (isTTSMode) return;
    
    if (!isReading || currentIndex >= words.length) {
        if (currentIndex >= words.length) {
            isReading = false;
            document.getElementById("startButton").disabled = false;
            document.getElementById("pauseButton").disabled = true;
            document.getElementById("resumeButton").disabled = true;
            document.getElementById("rsvpWord").textContent = "Finished!";
        }
        return;
    }

    const currentWord = words[currentIndex];
    document.getElementById("currentWord").textContent = currentIndex + 1;

    const progress = ((currentIndex + 1) / words.length) * 100;
    document.getElementById("progressFill").style.width = progress + "%";

    updateContextDisplay();
    processWordWithBackend(currentWord);

    currentIndex++;

    const delayMs = 60000 / wordsPerMinute;
    let extraPause = (currentWord.length * (delayMs / 1000)) * currentWord.length;

    if (currentWord.includes(".") || currentWord.includes("!") || currentWord.includes("?") || 
        currentWord.includes(";") || currentWord.includes(":")) {
        extraPause += 100;
    } else if (currentWord.includes(",")) {
        extraPause += 50;
    }

    readingTimeout = setTimeout(() => {
        if (isReading && !isTTSMode) {
            displayNextWord();
        }
    }, delayMs + extraPause);
}

// ============================================================================
// SPEED CONTROL
// ============================================================================

function updateSpeed() {
    wordsPerMinute = parseInt(document.getElementById("speedSlider").value);
    document.getElementById("speedDisplay").textContent = wordsPerMinute;

    sendEventToBackend("wpm_changed", {
        new_wpm: wordsPerMinute,
    });
}

// ============================================================================
// BACKEND COMMUNICATION
// ============================================================================

async function processWordWithBackend(word) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/process-word`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ word: word }),
        });

        if (!response.ok) {
            console.error("Failed to process word on backend");
            renderWordSimple(word);
            return;
        }

        const data = await response.json();
        
        if (data.before !== undefined && data.focal !== undefined && data.after !== undefined) {
            renderWord(data.before, data.focal, data.after, data.focal_index);
        } else {
            renderWordSimple(word);
        }
    } catch (error) {
        console.error("Error processing word on backend:", error);
        renderWordSimple(word);
    }
}

function renderWord(before, focal, after, focalIndex) {
    const rsvpWordElement = document.getElementById("rsvpWord");
    const container = document.querySelector(".rsvp-container");

    const rtlRegex = /[\u0590-\u08FF]/; 
    if (rtlRegex.test(before + focal + after)) {
        container.classList.add("rtl");
    } else {
        container.classList.remove("rtl");
    }
    
    const html = `
        <span class="word-part before">${before}</span><span class="word-part focal">${focal}</span><span class="word-part after">${after}</span>
    `;
    
    rsvpWordElement.innerHTML = html;
    rsvpWordElement.style.transform = 'translateX(0)';
}

function renderWordSimple(word) {
    const rsvpWordElement = document.getElementById("rsvpWord");
    
    const focalIndex = Math.floor(word.length / 2);
    const before = word.substring(0, focalIndex);
    const focal = word[focalIndex];
    const after = word.substring(focalIndex + 1);
    
    const html = `
        <span class="word-part before">${before}</span><span class="word-part focal">${focal}</span><span class="word-part after">${after}</span>
    `;
    
    rsvpWordElement.innerHTML = html;
    rsvpWordElement.style.transform = 'translateX(0)';
}

async function sendEventToBackend(eventType, additionalData = {}) {
    try {
        const eventData = {
            event_type: eventType,
            wpm: wordsPerMinute,
            current_word_index: currentIndex,
            total_words: words.length,
            file_name: currentFileName,
            is_reading: isReading,
            is_paused: isPaused,
            ...additionalData,
        };

        const response = await fetch(`${API_BASE_URL}/api/event`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(eventData),
        });

        if (!response.ok) {
            console.error("Failed to send event to backend");
        }
    } catch (error) {
        console.error("Error sending event to backend:", error);
    }
}

// ============================================================================
// BLINK DETECTION INTEGRATION
// ============================================================================

setInterval(async () => {
    try {
        const res = await fetch(`${API_BASE_URL}/blink_state`);
        const data = await res.json();

        if (data.state === "closed" && isReading && !isPaused) {
            console.log("👁️ Blink detected: Pausing");
            // Blink pauses do NOT pause music
            pauseReading();
        } 
        else if (data.state === "open" && isPaused && !manualPause) {
            console.log("👁️ Eyes open: Resuming");
            // Blink resumes do NOT resume music
            resumeReading();
        }
    } catch (err) {
        // Silent fail if backend down
    }
}, 100);

// ============================================================================
// UI UTILITIES
// ============================================================================

function showMessage(msg, type) {
    message.textContent = msg;
    message.className = `message ${type}`;
    message.style.display = "block";
    if (type === "success") {
        setTimeout(() => {
            message.style.display = "none";
        }, 5000);
    }
}