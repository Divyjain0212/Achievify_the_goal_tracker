from datetime import datetime

def user_schema():
    return {
        "username": "",
        "email": "",
        "password": "",  # hashed password
        "created_at": datetime.utcnow()
    }

def goal_schema():
    return {
        "user_id": "",
        "title": "",
        "description": "",
        "status": "pending",  # pending, completed
        "created_at": datetime.utcnow(),
        "due_date": None
    }
