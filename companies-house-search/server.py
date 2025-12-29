"""
Companies House API Proxy Server

This Flask server acts as a proxy to avoid CORS issues when calling the 
Companies House API from the browser. It standardizes error handling and
provides a clean interface for the frontend.

API keys are stored securely in environment variables and never exposed to the client.
Security hardened with input validation, CORS restrictions, and SSRF protection.
"""

from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS
from werkzeug.utils import safe_join
import requests
import base64
import os
import re
from dotenv import load_dotenv
from urllib.parse import urlparse

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

# SECURITY FIX #1: Restrict CORS to localhost only (development)
# In production, replace with your actual domain
ALLOWED_ORIGINS = [
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'http://localhost:3000',  # Common dev server port
]

CORS(app, origins=ALLOWED_ORIGINS, supports_credentials=True)

# Load API keys from environment variables
COMPANIES_HOUSE_API_KEY = os.getenv('COMPANIES_HOUSE_API_KEY')
GOOGLE_MAPS_API_KEY = os.getenv('GOOGLE_MAPS_API_KEY')

# Validate that required API key is present
if not COMPANIES_HOUSE_API_KEY:
    print("WARNING: COMPANIES_HOUSE_API_KEY not found in environment variables!")
    print("Please create a .env file with your API key. See .env.example for template.")

# The base URL for all Companies House API requests
API_BASE_URL = 'https://api.company-information.service.gov.uk'
# The base URL for the Companies House Document API
DOCUMENT_API_BASE_URL = 'https://document-api.company-information.service.gov.uk'

# SECURITY FIX #2: Whitelist of allowed API endpoints to prevent SSRF
ALLOWED_ENDPOINTS = [
    r'^/company/[A-Z0-9]{8,}$',
    r'^/company/[A-Z0-9]{8,}/persons-with-significant-control$',
    r'^/company/[A-Z0-9]{8,}/filing-history$',
    r'^/company/[A-Z0-9]{8,}/charges$',
    r'^/company/[A-Z0-9]{8,}/officers$',
    r'^/search/companies$',
    r'^/search/officers$',
    r'^/officers/[a-zA-Z0-9_-]+/appointments$',
]

def validate_endpoint(endpoint):
    """
    SECURITY: Validate that the endpoint matches allowed patterns to prevent SSRF.
    """
    for pattern in ALLOWED_ENDPOINTS:
        if re.match(pattern, endpoint):
            return True
    return False

def sanitize_integer_param(value, default, min_val=1, max_val=1000):
    """
    SECURITY FIX #7: Validate and sanitize integer parameters.
    """
    try:
        int_val = int(value)
        # Clamp to reasonable limits to prevent abuse
        return max(min_val, min(int_val, max_val))
    except (ValueError, TypeError):
        return default

def ch_api_request(endpoint, query_params=None):
    """
    Helper function to make requests to the Companies House API.
    Uses the API key from environment variables (server-side only).
    
    Args:
        endpoint (str): The API endpoint to call (e.g., '/search/companies').
        query_params (dict): Optional dictionary of query parameters.
        
    Returns:
        tuple: (JSON response, status code)
    """
    try:
        # Use server-side API key from environment
        if not COMPANIES_HOUSE_API_KEY:
            return jsonify({'error': 'Server configuration error'}), 500

        # SECURITY FIX #2: Validate endpoint to prevent SSRF
        if not validate_endpoint(endpoint):
            return jsonify({'error': 'Invalid endpoint requested'}), 400

        # Authentication: Prepare Basic Auth header
        # Companies House uses the API key as the username and an empty password
        auth_string = base64.b64encode(f'{COMPANIES_HOUSE_API_KEY}:'.encode()).decode()
        headers = {'Authorization': f'Basic {auth_string}'}

        # Request: Send the request to Companies House
        url = f'{API_BASE_URL}{endpoint}'
        
        # SECURITY: Set timeout to prevent hanging requests
        response = requests.get(url, params=query_params, headers=headers, timeout=30)
        
        # Error Handling: Check for specific status codes
        if response.status_code == 401:
            return jsonify({'error': 'Authentication failed'}), 401
        
        if response.status_code == 404:
            return jsonify({'error': 'Resource not found'}), 404
            
        # Success: Return the raw JSON and the original status code
        return jsonify(response.json()), response.status_code

    except requests.exceptions.Timeout:
        # SECURITY FIX #5: Don't expose internal error details
        return jsonify({'error': 'Request timeout'}), 504
    except requests.exceptions.RequestException:
        return jsonify({'error': 'External service error'}), 502
    except Exception:
        # SECURITY FIX #5: Generic error message, log internally
        return jsonify({'error': 'Internal server error'}), 500


# ========================================
# API PROXY ROUTES
# ========================================

@app.route('/api/company/<company_number>', methods=['GET'])
def get_company_profile(company_number):
    """Route for retrieving full company profile."""
    # SECURITY FIX #7: Validate company number format
    if not re.match(r'^[A-Z0-9]{6,8}$', company_number, re.IGNORECASE):
        return jsonify({'error': 'Invalid company number format'}), 400
    return ch_api_request(f'/company/{company_number.upper()}')

@app.route('/api/company/<company_number>/persons-with-significant-control', methods=['GET'])
def get_company_pscs(company_number):
    """Route for retrieving persons with significant control."""
    if not re.match(r'^[A-Z0-9]{6,8}$', company_number, re.IGNORECASE):
        return jsonify({'error': 'Invalid company number format'}), 400
    
    params = {
        'items_per_page': sanitize_integer_param(request.args.get('items_per_page', 100), 100),
        'start_index': sanitize_integer_param(request.args.get('start_index', 0), 0, 0, 10000)
    }
    return ch_api_request(f'/company/{company_number.upper()}/persons-with-significant-control', params)

@app.route('/api/company/<company_number>/filing-history', methods=['GET'])
def get_filing_history(company_number):
    """Route for retrieving company filing history."""
    if not re.match(r'^[A-Z0-9]{6,8}$', company_number, re.IGNORECASE):
        return jsonify({'error': 'Invalid company number format'}), 400
    
    params = {
        'items_per_page': sanitize_integer_param(request.args.get('items_per_page', 100), 100),
        'start_index': sanitize_integer_param(request.args.get('start_index', 0), 0, 0, 10000)
    }
    return ch_api_request(f'/company/{company_number.upper()}/filing-history', params)

@app.route('/api/company/<company_number>/charges', methods=['GET'])
def get_company_charges(company_number):
    """Route for retrieving company charges (mortgages)."""
    if not re.match(r'^[A-Z0-9]{6,8}$', company_number, re.IGNORECASE):
        return jsonify({'error': 'Invalid company number format'}), 400
    
    params = {
        'items_per_page': sanitize_integer_param(request.args.get('items_per_page', 100), 100),
        'start_index': sanitize_integer_param(request.args.get('start_index', 0), 0, 0, 10000)
    }
    return ch_api_request(f'/company/{company_number.upper()}/charges', params)

@app.route('/api/search/companies', methods=['GET'])
def search_companies():
    """Route for searching companies by name or number."""
    query = request.args.get('q', '').strip()
    if not query:
        return jsonify({'error': 'Search query is required'}), 400
    
    # SECURITY FIX #7: Limit query length to prevent abuse
    if len(query) > 200:
        return jsonify({'error': 'Search query too long'}), 400
        
    params = {
        'q': query,
        'items_per_page': sanitize_integer_param(request.args.get('items_per_page', 20), 20),
        'start_index': sanitize_integer_param(request.args.get('start_index', 0), 0, 0, 10000)
    }
    
    return ch_api_request('/search/companies', params)

@app.route('/api/company/<company_number>/officers', methods=['GET'])
def get_officers(company_number):
    """Route for retrieving officers of a specific company."""
    if not re.match(r'^[A-Z0-9]{6,8}$', company_number, re.IGNORECASE):
        return jsonify({'error': 'Invalid company number format'}), 400
    
    params = {
        'items_per_page': sanitize_integer_param(request.args.get('items_per_page', 100), 100),
        'start_index': sanitize_integer_param(request.args.get('start_index', 0), 0, 0, 10000)
    }
    
    return ch_api_request(f'/company/{company_number.upper()}/officers', params)

@app.route('/api/search/officers', methods=['GET'])
def search_officers():
    """Route for searching corporate officers by name."""
    query = request.args.get('q', '').strip()
    if not query:
        return jsonify({'error': 'Search query is required'}), 400
    
    # SECURITY FIX #7: Limit query length
    if len(query) > 200:
        return jsonify({'error': 'Search query too long'}), 400
        
    params = {
        'q': query,
        'items_per_page': sanitize_integer_param(request.args.get('items_per_page', 20), 20),
        'start_index': sanitize_integer_param(request.args.get('start_index', 0), 0, 0, 10000)
    }
    
    return ch_api_request('/search/officers', params)

@app.route('/api/officers/<officer_id>/appointments', methods=['GET'])
def get_officer_appointments(officer_id):
    """Route for retrieving all company appointments for a specific officer."""
    # SECURITY FIX #7: Validate officer ID format
    if not re.match(r'^[a-zA-Z0-9_-]{1,100}$', officer_id):
        return jsonify({'error': 'Invalid officer ID format'}), 400
    
    params = {
        'items_per_page': sanitize_integer_param(request.args.get('items_per_page', 100), 100),
        'start_index': sanitize_integer_param(request.args.get('start_index', 0), 0, 0, 10000)
    }
    
    return ch_api_request(f'/officers/{officer_id}/appointments', params)

@app.route('/api/document/<document_id>/content', methods=['GET'])
def get_document_content(document_id):
    """Route for retrieving document content from the Document API."""
    try:
        # Use server-side API key
        if not COMPANIES_HOUSE_API_KEY:
            return jsonify({'error': 'Server configuration error'}), 500

        # SECURITY FIX #7: Validate document ID format
        if not re.match(r'^[a-zA-Z0-9_-]{1,100}$', document_id):
            return jsonify({'error': 'Invalid document ID format'}), 400

        accept_header = request.headers.get('Accept', '*/*')

        auth_string = base64.b64encode(f'{COMPANIES_HOUSE_API_KEY}:'.encode()).decode()
        headers = {
            'Authorization': f'Basic {auth_string}',
            'Accept': accept_header
        }

        url = f'{DOCUMENT_API_BASE_URL}/document/{document_id}/content'
        
        # SECURITY: Set timeout and size limit
        response = requests.get(url, headers=headers, stream=True, timeout=60)
        
        # Check if the request was successful
        if response.status_code != 200:
            return jsonify({'error': 'Document not available'}), response.status_code

        # Return the response as a stream with relevant headers
        def generate():
            # SECURITY: Limit document size to 50MB
            max_size = 50 * 1024 * 1024
            downloaded = 0
            for chunk in response.iter_content(chunk_size=8192):
                downloaded += len(chunk)
                if downloaded > max_size:
                    break
                yield chunk

        # Filter headers to avoid conflicts
        excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
        headers = [(name, value) for (name, value) in response.headers.items()
                  if name.lower() not in excluded_headers]
        
        return Response(generate(), status=response.status_code, headers=headers)

    except requests.exceptions.Timeout:
        return jsonify({'error': 'Request timeout'}), 504
    except requests.exceptions.RequestException:
        return jsonify({'error': 'External service error'}), 502
    except Exception:
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/health', methods=['GET'])
def health_check():
    """Utility endpoint to verify the proxy server is active."""
    return jsonify({
        'status': 'ok',
        'message': 'Companies House API Proxy is active and ready.'
    })

# SECURITY FIX #4: Remove Google Maps API key endpoint
# Instead, implement Maps Static API with signed URLs on server-side
# For now, we'll use a different approach - don't expose the key at all
# Frontend will need to be updated to not use Google Maps, or use a different method

# Commenting out the insecure endpoint:
# @app.route('/api/config/google-maps-key', methods=['GET'])
# def get_google_maps_key():
#     """Endpoint to provide Google Maps API key to frontend if configured."""
#     if GOOGLE_MAPS_API_KEY:
#         return jsonify({'key': GOOGLE_MAPS_API_KEY}), 200
#     else:
#         return jsonify({'key': None}), 200


# ========================================
# STATIC FILE ROUTES
# ========================================

# SECURITY FIX #3: Secure static file serving with path validation
ALLOWED_EXTENSIONS = {'.html', '.css', '.js', '.json', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf'}

def is_safe_path(base_path, path, allowed_extensions):
    """
    SECURITY: Validate that the requested path is safe.
    Prevents directory traversal and limits to allowed file types.
    """
    # Use safe_join to prevent path traversal
    try:
        full_path = safe_join(base_path, path)
    except:
        return False
    
    # Check if file exists
    if not os.path.isfile(full_path):
        return False
    
    # Check extension
    _, ext = os.path.splitext(full_path)
    if ext.lower() not in allowed_extensions:
        return False
    
    # Ensure the path doesn't contain suspicious patterns
    if '..' in path or path.startswith('/'):
        return False
    
    return True

@app.route('/')
def index():
    """Serve the primary entry point (index.html)."""
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    """Serve static assets like CSS and JavaScript files from the root directory."""
    # SECURITY FIX #3: Validate path before serving
    if not is_safe_path('.', filename, ALLOWED_EXTENSIONS):
        return jsonify({'error': 'File not found'}), 404
    
    try:
        return send_from_directory('.', filename)
    except:
        return jsonify({'error': 'File not found'}), 404

@app.route('/js/<path:filename>')
def serve_js(filename):
    """Serve modular JavaScript files from the 'js' subdirectory."""
    # SECURITY FIX #3: Validate path before serving
    if not is_safe_path('js', filename, ALLOWED_EXTENSIONS):
        return jsonify({'error': 'File not found'}), 404
    
    try:
        return send_from_directory('js', filename)
    except:
        return jsonify({'error': 'File not found'}), 404

# SECURITY FIX #9: Add security headers
@app.after_request
def add_security_headers(response):
    """Add security headers to all responses."""
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    # Basic CSP - adjust as needed
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self'"
    return response

if __name__ == '__main__':
    # SECURITY FIX #8: Use environment variable for debug mode
    debug_mode = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    
    # Initialize the Flask development server
    port = int(os.environ.get('PORT', 5000))
    print(f"Starting server on http://localhost:{port}...")
    
    # WARNING: Never use debug=True in production!
    if debug_mode:
        print("WARNING: Running in DEBUG mode. This should NEVER be used in production!")
    
    app.run(debug=debug_mode, port=port, host='127.0.0.1')
