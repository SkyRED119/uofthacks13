from flask import Flask, jsonify, request
from flask_cors import CORS
import json
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# In-memory storage for events (in production, use a database)
events = []


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


def main():
    app.run(debug=True, host="0.0.0.0", port=5001)


if __name__ == "__main__":
    main()
