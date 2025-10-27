from motor.motor_asyncio import AsyncIOMotorClient
import asyncio, os
from dotenv import load_dotenv

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")

async def test_connection():
    try:
        client = AsyncIOMotorClient(MONGO_URI)
        db = client.neurolearn
        print("✅ Connected to MongoDB successfully!")
        print("Existing collections:", await db.list_collection_names())
    except Exception as e:
        print("❌ Connection failed:", e)

asyncio.run(test_connection())
