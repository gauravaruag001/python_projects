import json
import pytest
from unittest.mock import patch, MagicMock
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from base64 import b64decode
import os

from scripts.encrypt_db import encrypt_data, SECRET_KEY, main

def test_encrypt_data():
    sample_data = [{"id": 1, "question": "Test?"}]
    encrypted_b64 = encrypt_data(sample_data)
    
    # Verify it produces a valid string
    assert isinstance(encrypted_b64, str)
    assert len(encrypted_b64) > 0
    
    # Try to decrypt it to verify correctness
    raw_data = b64decode(encrypted_b64)
    iv = raw_data[:12]
    ciphertext = raw_data[12:]
    
    aesgcm = AESGCM(SECRET_KEY)
    decrypted_bytes = aesgcm.decrypt(iv, ciphertext, None)
    decrypted_str = decrypted_bytes.decode('utf-8')
    decrypted_json = json.loads(decrypted_str)
    
    assert decrypted_json == sample_data

@patch('scripts.encrypt_db.os.makedirs')
@patch('scripts.encrypt_db.open')
def test_encrypt_db_main(mock_open, mock_makedirs):
    # Setup mock file reading for the main function
    mock_questions = [
        {"id": 1, "topic": "History", "question": "q1", "options": ["a", "b", "c", "d"]},
        {"id": 2, "topic": "History", "question": "q2", "options": ["a", "b", "c", "d"]},
        {"id": 3, "topic": "Geography", "question": "q3", "options": ["a", "b", "c", "d"]},
    ]
    
    mock_file_handle = MagicMock()
    # When reading the input file, return the JSON string
    mock_file_handle.read.return_value = json.dumps(mock_questions)
    
    # MagicMock for context manager (with open)
    mock_file_context = MagicMock()
    mock_file_context.__enter__.return_value = mock_file_handle
    mock_open.return_value = mock_file_context
    
    # Mock os.path.exists so it thinks local_questions.json exists
    with patch('scripts.encrypt_db.os.path.exists', return_value=True):
        main()
        
    # Verify makedirs was called
    mock_makedirs.assert_called_with(os.path.join("db", "chunks"), exist_ok=True)
    
    # Verify files were opened for writing (topics + 10 tests + index)
    # 2 topics + 10 tests + 1 index = 13 total writes + 1 read
    assert mock_open.call_count >= 13
