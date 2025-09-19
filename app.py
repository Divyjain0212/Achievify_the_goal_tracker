from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure
from bson import ObjectId
from bson.errors import InvalidId
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
import os
from datetime import datetime, timedelta
from functools import wraps

# --- Flask App Initialization ---
app = Flask(__name__)
# WARNING: This should be a long, random, secret string in production.
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'my_super_secret_dev_key_12345')
CORS(app) # Allow requests from your frontend

# --- MongoDB Configuration ---
# It's better to use an environment variable for this in production
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/")
DB_NAME = "achievifyDB"

# --- Database Connection ---
try:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    client.admin.command('ping') # Use ping to verify connection
    db = client[DB_NAME]
    goals_collection = db["goals"]
    users_collection = db["users"]
    print("✅ MongoDB connection successful.")
except ConnectionFailure as e:
    print(f"❌ Could not connect to MongoDB: {e}")
    exit()

# --- Helper to convert MongoDB ObjectId to string for JSON serialization ---
def serialize_doc(doc):
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    if doc and "user_id" in doc:
        # Don't expose user_id in the API response
        del doc["user_id"]
    return doc

# --- Authentication Decorator (JWT) ---
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            try:
                # Expected format: "Bearer <token>"
                token = request.headers['Authorization'].split(" ")[1]
            except IndexError:
                return jsonify({'error': 'Malformed Authorization header'}), 401
        
        if not token:
            return jsonify({'error': 'Token is missing!'}), 401
        
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = users_collection.find_one({'_id': ObjectId(data['user_id'])})
            if not current_user:
                return jsonify({'error': 'User not found!'}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired!'}), 401
        except (jwt.InvalidTokenError, InvalidId):
            return jsonify({'error': 'Token is invalid!'}), 401
        
        return f(current_user, *args, **kwargs)
    return decorated

# --- Auth Routes ---
@app.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email and password are required'}), 400

    email = data.get('email').lower().strip()
    
    if users_collection.find_one({'email': email}):
        return jsonify({'error': 'Email address already in use'}), 409

    hashed_password = generate_password_hash(data.get('password'), method='pbkdf2:sha256')
    
    users_collection.insert_one({
        'email': email,
        'password': hashed_password,
        'created_at': datetime.utcnow()
    })
    
    return jsonify({'message': 'New user created successfully. Please log in.'}), 201

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email and password are required'}), 400

    email = data.get('email').lower().strip()
    user = users_collection.find_one({'email': email})

    if not user or not check_password_hash(user['password'], data.get('password')):
        return jsonify({'error': 'Invalid email or password'}), 401
    
    token = jwt.encode({
        'user_id': str(user['_id']),
        'email': user['email'],
        'exp': datetime.utcnow() + timedelta(hours=24) # Token expires in 24 hours
    }, app.config['SECRET_KEY'], algorithm="HS256")
    
    return jsonify({'token': token, 'email': user['email']})

# --- Goal Routes (Protected by @token_required) ---
@app.route('/goals', methods=['GET'])
@token_required
def get_goals(current_user):
    try:
        user_id = current_user['_id']
        goals = [serialize_doc(goal) for goal in goals_collection.find({'user_id': user_id})]
        return jsonify(goals), 200
    except Exception as e:
        return jsonify({"error": "An unexpected error occurred", "details": str(e)}), 500

@app.route('/goals', methods=['POST'])
@token_required
def add_goal(current_user):
    data = request.get_json()
    if not data or not data.get('text') or not data['text'].strip():
        return jsonify({"error": "Goal text cannot be empty"}), 400
    
    new_goal = {
        "text": data['text'].strip(),
        "completed": False,
        "dueDate": data.get('dueDate'), # Use .get() for optional fields
        "category": data.get('category', 'Personal'),
        "priority": data.get('priority', 'medium'),
        "user_id": current_user['_id'],
        "created_at": datetime.utcnow() # Add creation timestamp for sorting
    }
    result = goals_collection.insert_one(new_goal)
    created_goal = goals_collection.find_one({"_id": result.inserted_id})
    return jsonify(serialize_doc(created_goal)), 201

@app.route('/goals/<goal_id>', methods=['PUT'])
@token_required
def update_goal(current_user, goal_id):
    try:
        data = request.get_json()
        obj_id = ObjectId(goal_id)
        
        # Build the update query dynamically
        update_fields = {}
        if 'completed' in data and isinstance(data['completed'], bool):
            update_fields['completed'] = data['completed']
        if 'text' in data and data['text'].strip():
            update_fields['text'] = data['text'].strip()
        # Add other fields as needed
        if 'dueDate' in data: update_fields['dueDate'] = data['dueDate']
        if 'category' in data: update_fields['category'] = data['category']
        if 'priority' in data: update_fields['priority'] = data['priority']

        if not update_fields:
            return jsonify({"error": "No valid fields to update"}), 400

        result = goals_collection.update_one(
            {'_id': obj_id, 'user_id': current_user['_id']},
            {"$set": update_fields}
        )
        
        if result.matched_count == 0:
            return jsonify({'error': 'Goal not found or permission denied'}), 404
            
        updated_goal = goals_collection.find_one({"_id": obj_id})
        return jsonify(serialize_doc(updated_goal)), 200
    except InvalidId:
        return jsonify({"error": f"'{goal_id}' is not a valid goal ID."}), 400
    except Exception as e:
        return jsonify({"error": "An unexpected error occurred", "details": str(e)}), 500

@app.route('/goals/<goal_id>', methods=['DELETE'])
@token_required
def delete_goal(current_user, goal_id):
    try:
        obj_id = ObjectId(goal_id)
        result = goals_collection.delete_one({'_id': obj_id, 'user_id': current_user['_id']})
        
        if result.deleted_count == 0:
            return jsonify({'error': 'Goal not found or permission denied'}), 404
        
        return jsonify({"message": "Goal deleted successfully"}), 200
    except InvalidId:
        return jsonify({"error": f"'{goal_id}' is not a valid goal ID."}), 400
    except Exception as e:
        return jsonify({"error": "An unexpected error occurred", "details": str(e)}), 500

# --- Run the Flask App ---
if __name__ == '__main__':
    # Use 0.0.0.0 to make it accessible on your local network
    app.run(host='0.0.0.0', port=5000, debug=True)