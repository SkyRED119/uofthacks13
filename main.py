from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import json
from datetime import datetime
import time
from pypdf import PdfReader
import io
from langdetect import detect
import os
from elevenlabs import ElevenLabs
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# Initialize ElevenLabs client
# OPTION 1: Set your API key directly here for testing
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")

# Check if key is set
if not ELEVENLABS_API_KEY:
    print("⚠️  WARNING: ELEVENLABS_API_KEY not set! TTS will not work.")
    client = None
else:
    print(f"✅ ElevenLabs API key loaded: {ELEVENLABS_API_KEY[:5]}***")
    client = ElevenLabs(api_key=ELEVENLABS_API_KEY)

blink_state = "open"
current_direction = "ltr"

events = []

# Create static directory
os.makedirs('static', exist_ok=True)


@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "Welcome to the backend API!"})


@app.route("/api/data", methods=["GET"])
def get_data():
    """Sample API endpoint that returns JSON data"""
    return jsonify({
        "status": "success",
        "data": [
            {"id": 1, "name": "Item 1"},
            {"id": 2, "name": "Item 2"},
        ]
    })


@app.route("/api/echo", methods=["POST"])
def echo():
    """Sample endpoint that echoes back posted data"""
    data = request.get_json()
    return jsonify({
        "status": "success",
        "received": data
    })


@app.route("/api/extract-pdf", methods=["POST"])
def extract_pdf():
    global current_direction
    """Extract text from uploaded PDF file"""
    print("📄 /api/extract-pdf endpoint called", flush=True)
    
    try:
        if 'file' not in request.files:
            return jsonify({
                "status": "error",
                "message": "No file provided"
            }), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({
                "status": "error",
                "message": "No file selected"
            }), 400
        
        if not file.filename.endswith('.pdf'):
            return jsonify({
                "status": "error",
                "message": "File is not a PDF"
            }), 400
        
        try:
            pdf_reader = PdfReader(io.BytesIO(file.read()))
            text = ""
            
            for page in pdf_reader.pages:
                text += page.extract_text()

            try:
                lang = detect(text)
                current_direction = "rtl" if lang in ['ar', 'he', 'fa', 'ur'] else "ltr"
            except:
                current_direction = "ltr"
            
            print(f"📄 Extracted {len(text)} characters from PDF", flush=True)
            
            return jsonify({
                "status": "success",
                "text": text,
                "direction": current_direction,
                "file_name": file.filename,
                "pages": len(pdf_reader.pages)
            }), 200
        
        except Exception as e:
            print(f"Error reading PDF: {str(e)}", flush=True)
            return jsonify({
                "status": "error",
                "message": f"Failed to read PDF: {str(e)}"
            }), 400
    
    except Exception as e:
        print(f"Error in extract_pdf: {str(e)}", flush=True)
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 400


@app.route("/api/process-word", methods=["POST"])
def process_word():
    """Process a word and partition it around focal letter"""
    print("🔍 /api/process-word endpoint called", flush=True)
    try:
        data = request.get_json()
        word = data.get('word', '')
        
        if not word:
            return jsonify({
                "status": "error",
                "message": "No word provided"
            }), 400
        
        focal_index = calculate_focal_index(word)
        
        before = word[:focal_index]
        focal = word[focal_index]
        after = word[focal_index + 1:]
        
        print(f"Word: '{word}' | Before: '{before}' | Focal: '{focal}' | After: '{after}'", flush=True)

        return jsonify({
            "status": "success",
            "original_word": word,
            "before": before,
            "focal": focal,
            "after": after,
            "focal_index": focal_index
        }), 200
    except Exception as e:
        print(f"Error processing word: {str(e)}", flush=True)
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 400


def calculate_focal_index(word):
    """Calculate which letter should be focal"""
    if len(word) <= 2:
        return len(word) // 2
    
    min_middle = max(1, len(word) // 3)
    max_middle = min(len(word) - 2, (len(word) * 2) // 3)
    
    import random
    return random.randint(min_middle, max_middle)


@app.route("/api/generate-tts", methods=["POST"])
def generate_tts():
    """Generate TTS audio with word-level timestamps"""
    print("🎙️ /api/generate-tts endpoint called", flush=True)
    
    data = request.get_json()
    text = data.get('text', '')
    user_wpm = data.get('wpm', 300)
    
    if not text:
        return jsonify({
            "status": "error",
            "error": "No text provided"
        }), 400
    
    # Check if client is initialized
    if client is None:
        print("❌ ElevenLabs client not initialized - API key missing!", flush=True)
        return jsonify({
            "status": "error",
            "error": "ElevenLabs API key not configured. Please set ELEVENLABS_API_KEY environment variable or update main.py"
        }), 500
    
    # Calculate speaking rate based on WPM
    # 150 WPM ≈ 1.0 speed, 300 WPM ≈ 2.0 speed
    speaking_rate = max(0.5, min(4.0, user_wpm / 150))
    
    try:
        print(f"Generating TTS at {speaking_rate}x speed for {user_wpm} WPM", flush=True)
        print(f"Text length: {len(text)} characters, {len(text.split())} words", flush=True)
        
        # Split text into words for alignment
        words = text.split()
        
        # Generate audio using ElevenLabs - correct method for newer SDK
        audio_generator = client.text_to_speech.convert(
            text=text,
            voice_id="pqHfZKP75CvOlQylNhV4",  # Bill voice ID
            model_id="eleven_turbo_v2_5"
        )
        
        # Collect audio bytes
        audio_bytes = b""
        for chunk in audio_generator:
            audio_bytes += chunk
        
        # Save audio file
        audio_path = "static/speech.mp3"
        with open(audio_path, "wb") as f:
            f.write(audio_bytes)
        
        print(f"✅ Audio saved to {audio_path} ({len(audio_bytes)} bytes)", flush=True)
        
        # Create synthetic alignment data based on WPM
        # This is a fallback since we don't have real timestamps
        ms_per_word = (60 / user_wpm) * 1000
        alignment = []
        current_time = 0
        
        for word in words:
            # Adjust duration based on word length
            word_duration = ms_per_word * (1 + (len(word) - 5) * 0.05)
            alignment.append({
                "word": word,
                "start_time_ms": current_time,
                "end_time_ms": current_time + word_duration
            })
            current_time += word_duration
        
        print(f"✅ Created {len(alignment)} synthetic alignments", flush=True)
        
        return jsonify({
            "status": "success",
            "audio_url": "/static/speech.mp3",
            "alignment": alignment
        }), 200
    
    except Exception as e:
        print(f"❌ TTS Error: {str(e)}", flush=True)
        import traceback
        traceback.print_exc()
        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500


@app.route("/api/event", methods=["POST"])
def log_event():
    """Log user events from the frontend"""
    try:
        data = request.get_json()
        data['timestamp'] = datetime.now().isoformat()
        events.append(data)
        
        print(f"Event logged: {data['event_type']}")
        
        return jsonify({
            "status": "success",
            "message": f"Event '{data['event_type']}' recorded",
            "total_events": len(events)
        }), 201
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 400


@app.route("/api/events", methods=["GET"])
def get_events():
    """Retrieve all logged events"""
    return jsonify({
        "status": "success",
        "total_events": len(events),
        "events": events
    })


@app.route("/api/events", methods=["DELETE"])
def clear_events():
    """Clear all logged events"""
    global events
    events = []
    return jsonify({
        "status": "success",
        "message": "All events cleared"
    })


@app.route("/blink", methods=["POST"])
def update_blink():
    global blink_state
    blink_state = request.json["state"]
    return jsonify({"status": "ok"})


@app.route("/blink_state", methods=["GET"])
def get_blink_state():
    return jsonify({"state": blink_state})


def main():
    app.run(debug=False, host="0.0.0.0", port=5001)


if __name__ == "__main__":
    main()