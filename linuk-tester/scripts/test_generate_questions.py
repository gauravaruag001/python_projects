import json
import pytest
from unittest.mock import patch, MagicMock
from scripts.generate_questions import extract_text_from_pdf, generate_questions_batch

@patch('scripts.generate_questions.pypdf.PdfReader')
def test_extract_text_from_pdf(MockPdfReader):
    # Create mock pages
    mock_page1 = MagicMock()
    mock_page1.extract_text.return_value = "Page 1 Content"
    mock_page2 = MagicMock()
    mock_page2.extract_text.return_value = "Page 2 Content"
    
    # Configure reader
    mock_reader_instance = MagicMock()
    mock_reader_instance.pages = [mock_page1, mock_page2]
    MockPdfReader.return_value = mock_reader_instance
    
    # Mock open to avoid actual file I/O
    with patch('builtins.open', MagicMock()):
        result = extract_text_from_pdf("dummy.pdf")
        
    assert "Page 1 Content" in result
    assert "Page 2 Content" in result
    assert result == "Page 1 Content\nPage 2 Content\n"

def test_extract_text_missing_file():
    # Should catch FileNotFoundError and return empty string
    result = extract_text_from_pdf("nonexistent_file.pdf")
    assert result == ""

def test_generate_questions_batch():
    mock_client = MagicMock()
    
    # The JSON string we expect the mock Gemini to return
    mock_json_response = '''```json
    [
        {
            "id": 1000,
            "topic": "History",
            "question": "What is the capital?",
            "options": ["London", "Paris", "Berlin", "Rome"],
            "correctAnswer": "London",
            "explanation": "Because it is."
        }
    ]
    ```'''
    
    mock_response = MagicMock()
    mock_response.text = mock_json_response
    
    mock_client.models.generate_content.return_value = mock_response
    
    result = generate_questions_batch(mock_client, "some text", 1000, 1)
    
    # Assert parsing works and markdown is stripped
    assert isinstance(result, list)
    assert len(result) == 1
    assert result[0]["id"] == 1000
    assert result[0]["topic"] == "History"
    
def test_generate_questions_batch_error():
    mock_client = MagicMock()
    # Force an exception (e.g., rate limit)
    mock_client.models.generate_content.side_effect = Exception("API Error")
    
    result = generate_questions_batch(mock_client, "text", 1, 1)
    # Should handle error and return empty list
    assert result == []
