// ============================================================================
// RSVP Reader - Main Application Script
// ============================================================================

const API_BASE_URL = "http://localhost:5001";

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let words = [];
let currentIndex = 0;
let isReading = false;
let isPaused = false;
let readingTimeout = null;
let wordsPerMinute = 300;
let currentFileName = "";

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
    const validNames = file.name.endsWith(".txt") || file.name.endsWith(".md");

    if (!validNames) {
        showMessage("Please upload a .txt or .md file", "error");
        return;
    }

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

// ============================================================================
// TEXT PARSING
// ============================================================================

function parseText(text) {
    // Split by whitespace, dashes, or em dashes and filter out empty strings
    words = text
        .split(/[\s\-—]+/)
        .filter((word) => word.length > 0);
}

// ============================================================================
// KEYBOARD HANDLERS
// ============================================================================

function setupKeyboardListeners() {
    document.addEventListener("keydown", (e) => {
        // Only handle keyboard shortcuts if reading mode is active or file is loaded
        if (!rsvpSection.classList.contains("active")) return;

        // Spacebar: Pause/Resume
        if (e.code === "Space") {
            e.preventDefault();
            if (isReading) {
                pauseReading();
            } else if (isPaused) {
                resumeReading();
            }
        }

        // Arrow Up/Right: Increase WPM
        if (e.code === "ArrowUp" || e.code === "ArrowRight") {
            e.preventDefault();
            adjustWPM(50);
        }

        // Arrow Down/Left: Decrease WPM
        if (e.code === "ArrowDown" || e.code === "ArrowLeft") {
            e.preventDefault();
            adjustWPM(-50);
        }

        // Enter: Start reading
        if (e.code === "Enter") {
            e.preventDefault();
            const startButton = document.getElementById("startButton");
            if (!startButton.disabled) {
                startReading();
            }
        }

        // R: Reset
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

function startReading() {
    if (words.length === 0) {
        showMessage("Please upload a file first", "error");
        return;
    }
    isReading = true;
    isPaused = false;
    currentIndex = 0;
    document.getElementById("startButton").disabled = true;
    document.getElementById("pauseButton").disabled = false;

    sendEventToBackend("reading_started");

    displayNextWord();
}

function pauseReading() {
    if (isReading) {
        isPaused = true;
        isReading = false;
        clearTimeout(readingTimeout);
        document.getElementById("pauseButton").disabled = true;
        document.getElementById("resumeButton").disabled = false;

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

        displayNextWord();
    }
}

function resetReading() {
    isReading = false;
    isPaused = false;
    currentIndex = 0;
    clearTimeout(readingTimeout);
    document.getElementById("rsvpWord").textContent = "Ready?";
    document.getElementById("currentWord").textContent = "0";
    document.getElementById("progressFill").style.width = "0%";
    document.getElementById("startButton").disabled = false;
    document.getElementById("pauseButton").disabled = true;
    document.getElementById("resumeButton").disabled = true;

    sendEventToBackend("reading_reset");
}

// ============================================================================
// WORD DISPLAY AND TIMING
// ============================================================================

function displayNextWord() {
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
    document.getElementById("rsvpWord").textContent = currentWord;
    document.getElementById("currentWord").textContent = currentIndex + 1;

    const progress = ((currentIndex + 1) / words.length) * 100;
    document.getElementById("progressFill").style.width = progress + "%";

    currentIndex++;

    // Calculate delay based on WPM
    const delayMs = 60000 / wordsPerMinute;

    // Check for punctuation and add extra pause
    let extraPause = 0;
    if (
        currentWord.includes(".") ||
        currentWord.includes("!") ||
        currentWord.includes("?") ||
        currentWord.includes(";") ||
        currentWord.includes(":")
    ) {
        extraPause = 100; // 100ms pause for sentence-ending punctuation
    } else if (currentWord.includes(",")) {
        extraPause = 50; // 50ms pause for commas
    }

    readingTimeout = setTimeout(() => {
        if (isReading) {
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
