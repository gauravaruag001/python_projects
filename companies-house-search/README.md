# Companies House Search Application

A modern web application to search the UK Companies House database and display company officers.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Get Your API Key

1. Visit [Companies House Developer Hub](https://developer.company-information.service.gov.uk/)
2. Register for a free account
3. Create a **REST API key**
4. Copy your API key

### 3. Start the Server

```bash
python server.py
```

The server will start on `http://localhost:5000`

### 4. Open the Application

Open `index.html` in your web browser, or navigate to the file directly.

### 5. Configure API Key

1. Click the settings button (⚙️) in the top-right corner
2. Paste your API key
3. Click "Save API Key"

### 6. Start Searching!

Search for UK companies like:
- Tesco
- British Airways
- BBC
- Barclays
- Rolls-Royce

## 📁 Files

- `index.html` - Main web application
- `styles.css` - Styling and animations
- `app.js` - JavaScript functionality
- `server.py` - Flask proxy server (avoids CORS issues)
- `requirements.txt` - Python dependencies

## 🔧 How It Works

The application uses a Python Flask server as a proxy to avoid CORS (Cross-Origin Resource Sharing) issues when calling the Companies House API from the browser. This is a common pattern for browser-based applications that need to call external APIs.

**Architecture:**
```
Browser → Flask Server (localhost:5000) → Companies House API
```

## ⚠️ Troubleshooting

### "Invalid API key" Error

This error occurs when:
1. **CORS blocking** - The browser blocks direct API calls (this is why we use the proxy server)
2. **Wrong API key** - Make sure you copied the entire API key correctly
3. **Server not running** - Make sure `python server.py` is running

**Solution:** Make sure the Flask server is running before using the application!

### Port Already in Use

If port 5000 is already in use, you can change it in `server.py`:
```python
app.run(debug=True, port=5001)  # Change to any available port
```

Then update `app.js`:
```javascript
const API_BASE_URL = 'http://localhost:5001/api';  // Match the port
```

## 🎨 Features

- ✨ Modern dark mode design with glassmorphism
- 🔍 Search UK companies by name
- 👥 View company officers and their details
- 📱 Fully responsive design
- ⚡ Fast and smooth animations
- 🔐 Secure API key storage in browser

## 📝 License

Free to use for personal and commercial projects.
