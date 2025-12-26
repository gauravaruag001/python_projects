"""
Companies House API Proxy Server
This Flask server acts as a proxy to avoid CORS issues when calling the Companies House API from the browser.
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import requests
import base64
import os

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

API_BASE_URL = 'https://api.company-information.service.gov.uk'


# ========================================
# API PROXY ROUTES
# Proxy requests to Companies House API
# ========================================


@app.route('/api/search/companies', methods=['GET'])
def search_companies():
    """Proxy endpoint for searching companies"""
    try:
        # Get query parameters and API key from request
        query = request.args.get('q', '')
        items_per_page = request.args.get('items_per_page')
        start_index = request.args.get('start_index')
        api_key = request.headers.get('X-API-Key', '')
        
        print(f'\n=== Search Request ===')
        print(f'Query: {query}')
        print(f'Items per page: {items_per_page}')
        print(f'Start index: {start_index}')
        print(f'API Key received: {"Yes" if api_key else "No"}')
        
        if not api_key:
            return jsonify({'error': 'API key is required'}), 401
        
        if not query:
            return jsonify({'error': 'Search query is required'}), 400
        
        # Make request to Companies House API
        auth_string = base64.b64encode(f'{api_key}:'.encode()).decode()
        headers = {'Authorization': f'Basic {auth_string}'}
        
        params = {'q': query}
        if items_per_page: params['items_per_page'] = items_per_page
        if start_index: params['start_index'] = start_index
        
        print(f'Calling Companies House API...')
        response = requests.get(
            f'{API_BASE_URL}/search/companies',
            params=params,
            headers=headers
        )
        
        print(f'Response status: {response.status_code}')
        
        if response.status_code == 401:
            print('ERROR: Companies House returned 401 - Invalid API key')
            print('Please check that your API key is correct')
            return jsonify({
                'error': 'Invalid API key. Please verify your API key from Companies House Developer Hub.',
                'status': 401
            }), 401
        
        # Return the response from Companies House API
        return jsonify(response.json()), response.status_code
        
    except Exception as e:
        print(f'ERROR: {str(e)}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/company/<company_number>/officers', methods=['GET'])
def get_officers(company_number):
    """Proxy endpoint for getting company officers"""
    try:
        # Get API key and pagination from request
        api_key = request.headers.get('X-API-Key', '')
        items_per_page = request.args.get('items_per_page')
        start_index = request.args.get('start_index')
        
        if not api_key:
            return jsonify({'error': 'API key is required'}), 401
        
        # Make request to Companies House API
        auth_string = base64.b64encode(f'{api_key}:'.encode()).decode()
        headers = {'Authorization': f'Basic {auth_string}'}
        
        params = {}
        if items_per_page: params['items_per_page'] = items_per_page
        if start_index: params['start_index'] = start_index
        
        response = requests.get(
            f'{API_BASE_URL}/company/{company_number}/officers',
            params=params,
            headers=headers
        )
        
        # Return the response from Companies House API
        return jsonify(response.json()), response.status_code
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/search/officers', methods=['GET'])
def search_officers():
    """Proxy endpoint for searching officers by name"""
    try:
        # Get query parameter and API key from request
        query = request.args.get('q', '')
        items_per_page = request.args.get('items_per_page')
        start_index = request.args.get('start_index')
        api_key = request.headers.get('X-API-Key', '')
        
        print(f'\n=== Officers Search Request ===')
        print(f'Query: {query}')
        
        if not api_key:
            return jsonify({'error': 'API key is required'}), 401
        
        if not query:
            return jsonify({'error': 'Search query is required'}), 400
        
        # Make request to Companies House API
        auth_string = base64.b64encode(f'{api_key}:'.encode()).decode()
        headers = {'Authorization': f'Basic {auth_string}'}
        
        params = {'q': query}
        if items_per_page: params['items_per_page'] = items_per_page
        if start_index: params['start_index'] = start_index
        
        print(f'Calling Companies House Officers Search API...')
        response = requests.get(
            f'{API_BASE_URL}/search/officers',
            params=params,
            headers=headers
        )
        
        print(f'Response status: {response.status_code}')
        
        if response.status_code == 401:
            print('ERROR: Companies House returned 401 - Invalid API key')
            return jsonify({
                'error': 'Invalid API key. Please verify your API key from Companies House Developer Hub.',
                'status': 401
            }), 401
        
        # Return the response from Companies House API
        return jsonify(response.json()), response.status_code
        
    except Exception as e:
        print(f'ERROR: {str(e)}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/officers/<officer_id>/appointments', methods=['GET'])
def get_officer_appointments(officer_id):
    """Proxy endpoint for getting officer appointments (companies)"""
    try:
        # Get API key and pagination from request
        api_key = request.headers.get('X-API-Key', '')
        items_per_page = request.args.get('items_per_page')
        start_index = request.args.get('start_index')
        
        print(f'\n=== Officer Appointments Request ===')
        print(f'Officer ID: {officer_id}')
        
        if not api_key:
            return jsonify({'error': 'API key is required'}), 401
        
        # Make request to Companies House API
        auth_string = base64.b64encode(f'{api_key}:'.encode()).decode()
        headers = {'Authorization': f'Basic {auth_string}'}
        
        params = {}
        if items_per_page: params['items_per_page'] = items_per_page
        if start_index: params['start_index'] = start_index
        
        print(f'Calling Companies House Officer Appointments API...')
        response = requests.get(
            f'{API_BASE_URL}/officers/{officer_id}/appointments',
            params=params,
            headers=headers
        )
        
        print(f'Response status: {response.status_code}')
        
        if response.status_code == 401:
            print('ERROR: Companies House returned 401 - Invalid API key')
            return jsonify({
                'error': 'Invalid API key. Please verify your API key from Companies House Developer Hub.',
                'status': 401
            }), 401
        
        # Return the response from Companies House API
        return jsonify(response.json()), response.status_code
        
    except Exception as e:
        print(f'ERROR: {str(e)}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'message': 'Companies House API Proxy is running'})

# ========================================
# STATIC FILE ROUTES
# Serve HTML, CSS, and JavaScript files
# ========================================

@app.route('/')
def index():
    """Serve the main HTML file"""
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    """Serve static files (CSS, JS, etc.)"""
    # Log static file requests for debugging
    print(f'Serving static file: {filename}')
    return send_from_directory('.', filename)

if __name__ == '__main__':
    print('Starting Companies House API Proxy Server...')
    print('Server will run on http://localhost:5000')
    print('Make sure to configure your API key in the web application')
    print('\nOpen http://localhost:5000/api/health to verify the server is running\n')
    app.run(debug=True, port=5000)
