import os
import json
import time
from google import genai
from google.genai import types
import pypdf

# =====================================================================
# Configuration
# =====================================================================
# Ensure you set your API key as an environment variable:
# set GEMINI_API_KEY=your_api_key_here
# or replace os.environ.get("GEMINI_API_KEY") with "your_api_key_here"

API_KEY = os.environ.get("GEMINI_API_KEY", "")
PDF_PATH = r"c:\Users\44743\Desktop\LinUK - Study Materials.pdf"
OUTPUT_FILE = r"db\local_questions.json"
QUESTIONS_PER_BATCH = 20
TOTAL_TARGET_NEW_QUESTIONS = 120

# =====================================================================

def extract_text_from_pdf(pdf_path):
    """Extracts all text from the given PDF file."""
    print(f"Extracting text from {pdf_path}...")
    text_content = ""
    try:
        with open(pdf_path, "rb") as f:
            reader = pypdf.PdfReader(f)
            for page in reader.pages:
                text_content += page.extract_text() + "\n"
        print(f"Successfully extracted {len(text_content)} characters of text.")
        return text_content
    except Exception as e:
        print(f"Error reading PDF: {e}")
        return ""

def generate_questions_batch(client, text_chunk, start_id, batch_size=20):
    """Uses Gemini to generate a batch of questions based on a text chunk."""
    prompt = f"""
    You are an expert at creating 'Life in the UK' test questions.
    Based on the following excerpt from the official study materials, generate exactly {batch_size} unique, accurate multiple-choice questions.
    
    The questions should be formatted as a JSON array of objects.
    Each object must have the following keys strictly:
    - "id": an integer starting from {start_id}
    - "topic": a string representing the topic (e.g., "Values and Principles", "What is the UK?", "History", "Modern Society", "Government & Law")
    - "question": the question string
    - "options": an array of exactly 4 string options
    - "correctAnswer": the correct option string (must match exactly one of the options)
    - "explanation": a brief string explaining why the answer is correct
    
    Source Material Excerpt:
    {text_chunk}
    
    Return ONLY valid JSON. Output must start with [ and end with ]. Do not include Markdown blocks like ```json.
    """
    
    print(f"Requesting {batch_size} questions from Gemini API...")
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        
        # Clean up potential markdown formatting
        res_text = response.text.strip()
        if res_text.startswith("```json"):
            res_text = res_text[7:]
        if res_text.endswith("```"):
            res_text = res_text[:-3]
            
        questions = json.loads(res_text.strip())
        return questions
    except Exception as e:
        print(f"Error generating questions: {e}")
        return []

def main():
    if not API_KEY:
        print("ERROR: GEMINI_API_KEY environment variable is not set.")
        print("Please set it before running this script.")
        return

    client = genai.Client(api_key=API_KEY)
    
    # Create db folder if it doesn't exist
    os.makedirs('db', exist_ok=True)
    
    text_content = extract_text_from_pdf(PDF_PATH)
    if not text_content:
        return
        
    # Split text into chunks to feed the AI (approx 20,000 chars per chunk to avoid hitting limits and keep focus)
    chunk_size = 20000
    chunks = [text_content[i:i+chunk_size] for i in range(0, len(text_content), chunk_size)]
    
    # Load existing database to append to it
    all_questions = []
    current_id = 1000
    
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                all_questions = json.load(f)
            print(f"Loaded {len(all_questions)} existing questions from {OUTPUT_FILE}")
            
            # Find the highest existing ID to continue from there
            if all_questions:
                current_id = max(q.get("id", 1000) for q in all_questions) + 1
        except Exception as e:
            print(f"Error reading existing database: {e}")
            
    initial_count = len(all_questions)
    target_total_count = initial_count + TOTAL_TARGET_NEW_QUESTIONS
    
    print(f"Starting generation of {TOTAL_TARGET_NEW_QUESTIONS} new questions...")
    
    chunk_idx = 0
    while len(all_questions) < target_total_count and chunk_idx < len(chunks):
        # Determine how many we need in this batch
        remaining = target_total_count - len(all_questions)
        batch_size = min(QUESTIONS_PER_BATCH, remaining)
        
        batch = generate_questions_batch(client, chunks[chunk_idx], current_id, batch_size)
        
        if batch:
            all_questions.extend(batch)
            current_id += len(batch)
            print(f"Successfully generated {len(batch)} new questions. Total in DB so far: {len(all_questions)}")
            
            # Save intermediate progress
            with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
                json.dump(all_questions, f, indent=4)
        else:
            print("Failed to generate batch, retrying or skipping...")
            
        chunk_idx += 1
        # Sleep to avoid rate limits
        time.sleep(3)
        
    print(f"\nDone! Successfully generated {len(all_questions) - initial_count} new questions.")
    print(f"Total database size: {len(all_questions)} questions.")
    print(f"Data saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
