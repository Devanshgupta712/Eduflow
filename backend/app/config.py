import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./apptech_lms.db"
    JWT_SECRET: str = "apptech-careers-lms-secret-key-2026"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    CORS_ORIGINS: list[str] = [
        "https://lms.appteknow.com",
        "https://appteknow.com",
        "https://www.appteknow.com",
        "http://lms.appteknow.com",
        "http://localhost:3000",
        "https://lms-beta-lilac.vercel.app",
        "https://lms-beta.lilac.vercel.app",
        "https://lms-lilac.vercel.app",
    ]
    # Cloudinary Config (Optional for local dev, required for production files)
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # SMTP Email Config (for OTP verification)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""  # Set in .env
    SMTP_PASSWORD: str = ""  # Set in .env
    SMTP_SENDER: str = "EduSuite.ai <devanshd7124g@gmail.com>"

    # VAPID Keys for Web Push Notifications
    VAPID_PRIVATE_KEY: str = ""
    VAPID_SUBJECT: str = "mailto:admin@edusuite.ai"

    class Config:
        # Get the absolute path to the root .env file
        # __file__ is backend/app/config.py
        # dirname(__file__) is backend/app
        # dirname(dirname(__file__)) is backend
        # dirname(dirname(dirname(__file__))) is root
        env_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")

settings = Settings()
