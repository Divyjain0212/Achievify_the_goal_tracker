from flask import request, jsonify
from bson.objectid import ObjectId
from app import mongo
from . import goals_bp

@goals_bp.route("/", methods=["GET"])
def get_goals():
    user_id = request.args.get("user_id")
    goals = list(mongo.db.goals.find({"user_id": user_id}))
    for g in goals:
        g["_id"] = str(g["_id"])
    return jsonify(goals), 200

@goals_bp.route("/", methods=["POST"])
def add_goal():
    data = request.json
    goal_id = mongo.db.goals.insert_one({
        "user_id": data["user_id"],
        "title": data["title"],
        "description": data.get("description", ""),
        "status": "pending"
    }).inserted_id
    return jsonify({"message": "Goal added", "goal_id": str(goal_id)}), 201

@goals_bp.route("/<goal_id>", methods=["PUT"])
def update_goal(goal_id):
    data = request.json
    mongo.db.goals.update_one({"_id": ObjectId(goal_id)}, {"$set": data})
    return jsonify({"message": "Goal updated"}), 200

@goals_bp.route("/<goal_id>", methods=["DELETE"])
def delete_goal(goal_id):
    mongo.db.goals.delete_one({"_id": ObjectId(goal_id)})
    return jsonify({"message": "Goal deleted"}), 200

@goals_bp.route("/stats", methods=["GET"])
def get_stats():
    user_id = request.args.get("user_id")
    total = mongo.db.goals.count_documents({"user_id": user_id})
    completed = mongo.db.goals.count_documents({"user_id": user_id, "status": "completed"})
    return jsonify({"total": total, "completed": completed}), 200
