import os
import re
import sqlite3

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS


# ==========================================
# CREATE FLASK APPLICATION
# ==========================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# In Vercel serverless functions, the root filesystem is read-only; use /tmp for SQLite
if os.environ.get("VERCEL"):
    DATABASE = "/tmp/password_evaluations.db"
else:
    DATABASE = os.path.join(BASE_DIR, "password_evaluations.db")

app = Flask(__name__)

CORS(app)


# ==========================================
# DATABASE SETUP
# ==========================================

def init_database():

    connection = sqlite3.connect(DATABASE)

    cursor = connection.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS evaluations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            score INTEGER NOT NULL,
            status TEXT NOT NULL,
            has_upper INTEGER NOT NULL,
            has_lower INTEGER NOT NULL,
            has_digit INTEGER NOT NULL,
            has_special INTEGER NOT NULL,
            has_length INTEGER NOT NULL,
            suggestions TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    connection.commit()

    connection.close()


# Initialize database table on startup (required for production WSGI / Gunicorn)
init_database()


# ==========================================
# FRONTEND & STATIC FILE ROUTES
# ==========================================

@app.route("/", methods=["GET"])
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/<path:filename>", methods=["GET"])
def serve_static(filename):
    allowed_files = {"style.css", "script.js", "favicon.ico"}
    if filename in allowed_files:
        return send_from_directory(BASE_DIR, filename)
    return jsonify({"error": "Not found"}), 404


# ==========================================
# HEALTH CHECK API
# ==========================================

@app.route("/health", methods=["GET"])
@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({"status": "healthy"}), 200


# ==========================================
# PASSWORD EVALUATION API
# ==========================================

@app.route("/api/evaluate", methods=["POST"])
def evaluate_password():

    # Get JSON data from frontend safely
    data = request.get_json(silent=True) or {}

    # Get password
    password = data.get("password", "")


    # ==========================================
    # CHECK PASSWORD REQUIREMENTS
    # ==========================================

    has_upper = bool(re.search(r"[A-Z]", password))

    has_lower = bool(re.search(r"[a-z]", password))

    has_digit = bool(re.search(r"[0-9]", password))

    has_special = bool(
        re.search(
            r"[!@#$%^&*()_+\-=\[\]{}|;:,.<>?/\\'`~]",
            password
        )
    )

    has_length = len(password) >= 8


    # ==========================================
    # CALCULATE SCORE
    # ==========================================

    score = sum([
        has_upper,
        has_lower,
        has_digit,
        has_special,
        has_length
    ])


    # ==========================================
    # DETERMINE STATUS
    # ==========================================

    if score <= 2:
        status = "WEAK"

    elif score <= 4:
        status = "MEDIUM"

    else:
        status = "STRONG"


    # ==========================================
    # GENERATE SUGGESTIONS
    # ==========================================

    suggestions = []

    if not has_upper:
        suggestions.append(
            "Add an uppercase letter"
        )

    if not has_lower:
        suggestions.append(
            "Add a lowercase letter"
        )

    if not has_digit:
        suggestions.append(
            "Add a number"
        )

    if not has_special:
        suggestions.append(
            "Add a special character"
        )

    if not has_length:
        suggestions.append(
            "Use at least 8 characters"
        )


    # ==========================================
    # SAVE RESULT TO DATABASE
    # ==========================================

    connection = sqlite3.connect(DATABASE)

    cursor = connection.cursor()

    cursor.execute("""
        INSERT INTO evaluations (
            score,
            status,
            has_upper,
            has_lower,
            has_digit,
            has_special,
            has_length,
            suggestions
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        score,
        status,
        int(has_upper),
        int(has_lower),
        int(has_digit),
        int(has_special),
        int(has_length),
        ", ".join(suggestions)
    ))

    connection.commit()

    connection.close()


    # ==========================================
    # SEND RESULT TO FRONTEND
    # ==========================================

    return jsonify({

        "score": score,

        "status": status,

        "checks": {

            "has_upper": has_upper,

            "has_lower": has_lower,

            "has_digit": has_digit,

            "has_special": has_special,

            "has_length": has_length

        },

        "suggestions": suggestions

    })

# ======================================================
# HISTORY API
# ======================================================

@app.route("/api/history", methods=["GET"])
def get_history():

    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row

    cursor = connection.cursor()

    cursor.execute("""
        SELECT
            id,
            score,
            status,
            has_upper,
            has_lower,
            has_digit,
            has_special,
            has_length,
            suggestions,
            created_at
        FROM evaluations
        ORDER BY id DESC
    """)

    evaluations = [dict(row) for row in cursor.fetchall()]

    connection.close()

    return jsonify(evaluations)

# ==========================================
# START SERVER
# ==========================================

if __name__ == "__main__":

    # Ensure database is initialized
    init_database()

    # Support dynamic PORT assigned by cloud providers (e.g., Render, Railway, Heroku)
    port = int(os.environ.get("PORT", 5000))
    debug_mode = os.environ.get("FLASK_DEBUG", "false").lower() in ("true", "1")

    app.run(
        host="0.0.0.0",
        port=port,
        debug=debug_mode
    )
