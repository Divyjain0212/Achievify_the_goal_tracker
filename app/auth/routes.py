from flask import request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from bson.objectid import ObjectId
from app import mongo
from . import auth_bp

@auth_bp.route("/signup", methods=["POST"])
def signup():
    data = request.json
    if not data.get("email") or not data.get("password"):
        return jsonify({"error": "Email and password required"}), 400

    if mongo.db.users.find_one({"email": data["email"]}):
        return jsonify({"error": "User already exists"}), 409

    hashed_pw = generate_password_hash(data["password"])
    user_id = mongo.db.users.insert_one({
        "username": data.get("username", ""),
        "email": data["email"],
        "password": hashed_pw
    }).inserted_id

    return jsonify({"message": "User created", "user_id": str(user_id)}), 201

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.json
    user = mongo.db.users.find_one({"email": data.get("email")})
    if not user or not check_password_hash(user["password"], data.get("password")):
        return jsonify({"error": "Invalid credentials"}), 401

    return jsonify({"message": "Login successful", "user_id": str(user["_id"])}), 200
