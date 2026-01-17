from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes


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


def main():
    app.run(debug=True, host="0.0.0.0", port=5001)


if __name__ == "__main__":
    main()
