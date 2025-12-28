"""
Companies House API Proxy Server

This Flask server acts as a proxy to avoid CORS issues when calling the 
Companies House API from the browser. It standardizes error handling and
provides a clean interface for the frontend.
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import requests
import base64
import os

app = Flask(__name__)
# Enable CORS for all routes to allow requests from the frontend
CORS(app)

# The base URL for all Companies House API requests
API_BASE_URL = 'https://api.company-information.service.gov.uk'

def ch_api_request(endpoint, query_params=None):
    """
    Helper function to make requests to the Companies House API.
    
    Args:
        endpoint (str): The API endpoint to call (e.g., '/search/companies').
        query_params (dict): Optional dictionary of query parameters.
        
    Returns:
        tuple: (JSON response, status code)
    """
    try:
        # 1. Extraction: Get the API key from the incoming request headers
        api_key = request.headers.get('X-API-Key', '')
        if not api_key:
            return jsonify({'error': 'Companies House API key is missing. Please check your settings.'}), 401

        # 2. Authentication: Prepare Basic Auth header
        # Companies House uses the API key as the username and an empty password
        auth_string = base64.b64encode(f'{api_key}:'.encode()).decode()
        headers = {'Authorization': f'Basic {auth_string}'}

        # 3. Request: Send the request to Companies House
        url = f'{API_BASE_URL}{endpoint}'
        print(f"Proxying request to: {url} with params: {query_params}")
        
        response = requests.get(url, params=query_params, headers=headers)
        
        # 4. Error Handling: Check for specific status codes
        if response.status_code == 401:
            return jsonify({
                'error': 'Invalid API key. Please verify your credentials on the Companies House Developer Hub.',
                'status': 401
            }), 401
            
        # 5. Success: Return the raw JSON and the original status code
        return jsonify(response.json()), response.status_code

    except Exception as e:
        print(f"Error in ch_api_request: {str(e)}")
        return jsonify({'error': f"Internal server error: {str(e)}"}), 500

# ========================================
# API PROXY ROUTES
# ========================================

@app.route('/api/company/<company_number>', methods=['GET'])
def get_company_profile(company_number):
    """Route for retrieving full company profile."""
    return ch_api_request(f'/company/{company_number}')

@app.route('/api/company/<company_number>/persons-with-significant-control', methods=['GET'])
def get_company_pscs(company_number):
    """Route for retrieving persons with significant control."""
    params = {
        'items_per_page': request.args.get('items_per_page', 100),
        'start_index': request.args.get('start_index', 0)
    }
    return ch_api_request(f'/company/{company_number}/persons-with-significant-control', params)

@app.route('/api/company/<company_number>/filing-history', methods=['GET'])
def get_filing_history(company_number):
    """Route for retrieving company filing history."""
    params = {
        'items_per_page': request.args.get('items_per_page', 100),
        'start_index': request.args.get('start_index', 0)
    }
    return ch_api_request(f'/company/{company_number}/filing-history', params)

@app.route('/api/company/<company_number>/charges', methods=['GET'])
def get_company_charges(company_number):
    """Route for retrieving company charges (mortgages)."""
    params = {
        'items_per_page': request.args.get('items_per_page', 100),
        'start_index': request.args.get('start_index', 0)
    }
    return ch_api_request(f'/company/{company_number}/charges', params)

@app.route('/api/search/companies', methods=['GET'])
def search_companies():
    """Route for searching companies by name or number."""
    query = request.args.get('q', '')
    if not query:
        return jsonify({'error': 'Search query (q) is required'}), 400
        
    params = {
        'q': query,
        'items_per_page': request.args.get('items_per_page', 20),
        'start_index': request.args.get('start_index', 0)
    }
    
    return ch_api_request('/search/companies', params)

@app.route('/api/company/<company_number>/officers', methods=['GET'])
def get_officers(company_number):
    """Route for retrieving officers of a specific company."""
    params = {
        'items_per_page': request.args.get('items_per_page', 100),
        'start_index': request.args.get('start_index', 0)
    }
    
    return ch_api_request(f'/company/{company_number}/officers', params)

@app.route('/api/search/officers', methods=['GET'])
def search_officers():
    """Route for searching corporate officers by name."""
    query = request.args.get('q', '')
    if not query:
        return jsonify({'error': 'Search query (q) is required'}), 400
        
    params = {
        'q': query,
        'items_per_page': request.args.get('items_per_page', 20),
        'start_index': request.args.get('start_index', 0)
    }
    
    return ch_api_request('/search/officers', params)

@app.route('/api/officers/<officer_id>/appointments', methods=['GET'])
def get_officer_appointments(officer_id):
    """Route for retrieving all company appointments for a specific officer."""
    params = {
        'items_per_page': request.args.get('items_per_page', 100),
        'start_index': request.args.get('start_index', 0)
    }
    
    return ch_api_request(f'/officers/{officer_id}/appointments', params)

@app.route('/api/health', methods=['GET'])
def health_check():
    """Utility endpoint to verify the proxy server is active."""
    return jsonify({
        'status': 'ok',
        'message': 'Companies House API Proxy is active and ready.'
    })

# ========================================
# STATIC FILE ROUTES
# ========================================

@app.route('/')
def index():
    """Serve the primary entry point (index.html)."""
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    """Serve static assets like CSS and JavaScript files from the root directory."""
    return send_from_directory('.', filename)

@app.route('/js/<path:filename>')
def serve_js(filename):
    """Serve modular JavaScript files from the 'js' subdirectory."""
    return send_from_directory('js', filename)

if __name__ == '__main__':
    # Initialize the Flask development server
    port = int(os.environ.get('PORT', 5000))
    print(f"Starting server on http://localhost:{port}...")
    app.run(debug=True, port=port)
