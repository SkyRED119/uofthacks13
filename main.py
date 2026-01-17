from flask import Flask, jsonify, request
from flask_cors import CORS
import json
from datetime import datetime
from pypdf import PdfReader
import io

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

blink_state = "open"

# In-memory storage for events 
events = []
# NOTE TO SELF: In production, consider using a database for persistent storage.


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
    """Extract text from uploaded PDF file"""
    print("📄 /api/extract-pdf endpoint called", flush=True)
    try:
        # Check if file is in request
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
        
        # Read PDF
        try:
            pdf_reader = PdfReader(io.BytesIO(file.read()))
            text = ""
            
            for page in pdf_reader.pages:
                text += page.extract_text()
            
            print(f"📄 Extracted {len(text)} characters from PDF", flush=True)
            
            return jsonify({
                "status": "success",
                "text": text,
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
    print("📝 /api/process-word endpoint called", flush=True)
    try:
        data = request.get_json()
        word = data.get('word', '')
        
        if not word:
            return jsonify({
                "status": "error",
                "message": "No word provided"
            }), 400
        
        # Calculate focal letter index
        focal_index = calculate_focal_index(word)
        
        # Partition the word
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


@app.route("/api/event", methods=["POST"])
def log_event():
    """Log user events from the frontend"""
    try:
        data = request.get_json()
        
        # Add timestamp to the event
        data['timestamp'] = datetime.now().isoformat()
        
        # Store the event
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
    app.run(debug=True, host="0.0.0.0", port=5001)


if __name__ == "__main__":
    main()
