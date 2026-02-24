import json
import os
import random
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from base64 import b64encode

# Hardcoded key for simple client-side decryption (must match app.js)
SECRET_KEY = b"linuk-secret-key-123456789012345" # exactly 32 bytes

def encrypt_data(data_dict):
    """Encrypts a python dictionary to a base64 encoded AES-GCM payload."""
    aesgcm = AESGCM(SECRET_KEY)
    iv = os.urandom(12)
    data_bytes = json.dumps(data_dict).encode('utf-8')
    ciphertext = aesgcm.encrypt(iv, data_bytes, None)
    # The payload format: iv + ciphertext so the client can extract the iv
    payload = iv + ciphertext
    return b64encode(payload).decode('utf-8')

def main():
    input_file = os.path.join("db", "local_questions.json")
    chunks_dir = os.path.join("db", "chunks")
    
    if not os.path.exists(input_file):
        print(f"Error: Could not find {input_file}")
        return

    os.makedirs(chunks_dir, exist_ok=True)
    
    with open(input_file, 'r', encoding='utf-8') as f:
        all_questions = json.load(f)
        
    print(f"Loaded {len(all_questions)} questions from {input_file}")
    
    topics = {}
    for q in all_questions:
        topic = q.get('topic', 'General')
        if topic not in topics:
            topics[topic] = []
        topics[topic].append(q)
        
    index_data = {
        "topics": [],
        "tests": []
    }
    
    import re
    # 1. Generate topic chunks
    print("Generating encrypted topic chunks...")
    for topic_name, questions in topics.items():
        # Clean filename: remove special characters, replace spaces with underscores
        safe_name = re.sub(r'[^a-zA-Z0-9\s]', '', topic_name)
        safe_name = safe_name.strip().replace(" ", "_").lower()
        filename = f"topic_{safe_name}.enc"
        
        # Encrypt and save
        encrypted_str = encrypt_data(questions)
        with open(os.path.join(chunks_dir, filename), 'w', encoding='utf-8') as f:
            f.write(encrypted_str)
            
        index_data["topics"].append({
            "name": topic_name,
            "file": filename,
            "count": len(questions)
        })
        print(f" - Created {filename} ({len(questions)} questions)")

    # 2. Generate test chunks (random sets of 24)
    print("Generating encrypted test chunks...")
    num_tests = 15 # Generate 15 different pre-built tests
    for i in range(1, num_tests + 1):
        filename = f"test_{i}.enc"
        # Pick 24 random questions from all topics
        test_questions = random.sample(all_questions, min(24, len(all_questions)))
        
        # Shuffle options to ensure randomness in tests
        for q in test_questions:
            random.shuffle(q['options'])
            
        encrypted_str = encrypt_data(test_questions)
        with open(os.path.join(chunks_dir, filename), 'w', encoding='utf-8') as f:
            f.write(encrypted_str)
            
        index_data["tests"].append({
            "id": i,
            "file": filename
        })
    print(f" - Created {num_tests} test chunks")
    
    # 3. Save master index
    index_file = os.path.join("db", "index.json")
    with open(index_file, 'w', encoding='utf-8') as f:
        json.dump(index_data, f, indent=4)
    print(f"Created index file: {index_file}")

if __name__ == "__main__":
    main()
