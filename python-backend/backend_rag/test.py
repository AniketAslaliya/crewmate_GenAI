import os
from pinecone import Pinecone
from dotenv import load_dotenv

# 1. Load Config
load_dotenv()
api_key = os.environ.get("PINECONE_API_KEY")
index_name = os.environ.get("PINECONE_INDEX_NAME", "final-api") # Make sure this matches your .env

if not api_key:
    print("❌ Error: PINECONE_API_KEY not found.")
    exit()

try:
    # 2. Connect
    pc = Pinecone(api_key=api_key)
    index = pc.Index(index_name)
    
    # 3. GET STATS (Find the Namespace)
    stats = index.describe_index_stats()
    namespaces = list(stats.get('namespaces', {}).keys())
    
    if not namespaces:
        print("❌ Your index is empty! No namespaces found.")
        print("Step 1: Go to /docs -> /api/ingest and upload a file first.")
        exit()

    print(f"✅ Found Namespaces: {namespaces}")
    
    # 4. Use the first available namespace automatically
    target_ns = "test_enc::003"
    print(f"🔎 Inspecting Namespace: '{target_ns}'")

    # 5. Query
    dummy_vector = [0.1] * 384 
    results = index.query(
        vector=dummy_vector,
        top_k=1,
        include_metadata=True,
        namespace=target_ns
    )

    # 6. Check Encryption
    if results['matches']:
        raw_text = results['matches'][0]['metadata'].get('text', 'No text found')
        print("\n--- RAW DATA FROM PINECONE ---")
        print(f"ID: {results['matches'][0]['id']}")
        print(f"Stored Text: {raw_text[:100]}...") 
        
        if raw_text.startswith("gAAAA"):
            print("\n🔒 SUCCESS: The text is ENCRYPTED!")
        else:
            print("\n⚠️ WARNING: The text is PLAIN TEXT (Not Encrypted).")
            print("   (This might be an old file uploaded before you added encryption.)")
    else:
        print("Namespace exists but returned no results (strange).")

except Exception as e:
    print(f"Error: {e}")