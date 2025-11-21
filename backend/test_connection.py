import psycopg2
from dotenv import load_dotenv
import os

load_dotenv()

# Parse the DATABASE_URL
db_url = os.getenv("DATABASE_URL")
print(f"Attempting to connect with URL: {db_url}")

# Try to connect
try:
    # First, try to connect to the default postgres database
    conn = psycopg2.connect(
        host="localhost",
        port=5433,
        user="postgres",
        password="Venkatesh431971",
        database="postgres"  # Connect to default database first
    )
    print("✅ Successfully connected to PostgreSQL!")
    
    # Check if uber_clone database exists
    conn.autocommit = True
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM pg_database WHERE datname='uber_clone'")
    exists = cursor.fetchone()
    
    if exists:
        print("✅ Database 'uber_clone' already exists!")
    else:
        print("⚠️  Database 'uber_clone' does NOT exist. Creating it now...")
        cursor.execute("CREATE DATABASE uber_clone")
        print("✅ Database 'uber_clone' created successfully!")
    
    cursor.close()
    conn.close()
    
except psycopg2.OperationalError as e:
    print(f"❌ Connection failed: {e}")
    print("\n🔍 Troubleshooting:")
    print("1. Check if PostgreSQL is running on port 5433")
    print("2. Verify your password is correct: Venkatesh431971")
    print("3. Make sure the 'postgres' user exists")
except Exception as e:
    print(f"❌ Unexpected error: {e}")
