from flask import Flask
from flask_pymongo import PyMongo
from flask_cors import CORS

mongo = PyMongo()

def create_app():
    app = Flask(__name__, instance_relative_config=True)

    # Load default config then instance config
    app.config.from_object("config")
    app.config.from_pyfile("config.py", silent=True)

    CORS(app)
    mongo.init_app(app)

    # Register blueprints
    from app.auth.routes import auth_bp
    from app.goals.routes import goals_bp

    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(goals_bp, url_prefix="/goals")

    return app
