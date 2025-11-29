"""
Script to update the vacation table schema with missing columns
"""
import psycopg2
from app.config import settings

def update_vacation_table():
    """Add missing columns to the vacations table"""
    # Parse the database URL
    # Format: postgresql://username:password@host:port/database
    db_url = settings.database_url
    # Extract components
    parts = db_url.split("://")[1].split("@")
    user_pass = parts[0].split(":")
    host_port_db = parts[1].split("/")
    
    username = user_pass[0]
    password = user_pass[1]
    host_port = host_port_db[0].split(":")
    host = host_port[0]
    port = host_port[1] if len(host_port) > 1 else "5432"
    database = host_port_db[1]
    
    # Connect to the database
    conn = psycopg2.connect(
        host=host,
        port=port,
        database=database,
        user=username,
        password=password
    )
    
    cursor = conn.cursor()
    
    # List of columns to add
    columns_to_add = [
        ("schedule", "TEXT"),
        ("flight_details", "TEXT"),
        ("activities", "TEXT"),
        ("meal_preferences", "TEXT")
    ]
    
    # Add each column if it doesn't exist
    for column_name, column_type in columns_to_add:
        try:
            # Check if column exists
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='vacations' AND column_name=%s
            """, (column_name,))
            
            if cursor.fetchone() is None:
                # Column doesn't exist, add it
                cursor.execute(f"ALTER TABLE vacations ADD COLUMN {column_name} {column_type}")
                print(f"✓ Added column '{column_name}' to vacations table")
            else:
                print(f"✓ Column '{column_name}' already exists in vacations table")
        except Exception as e:
            print(f"⚠ Error checking/adding column '{column_name}': {e}")
    
    # Commit changes and close connection
    conn.commit()
    cursor.close()
    conn.close()
    print("\n✅ Vacation table schema update completed!")

if __name__ == "__main__":
    update_vacation_table()