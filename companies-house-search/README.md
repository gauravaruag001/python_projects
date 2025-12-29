# Companies House Search Application

A modern web application to search the UK Companies House database and display company officers.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Get Your Companies House API Key

1. Visit [Companies House Developer Hub](https://developer.company-information.service.gov.uk/)
2. Register for a free account
3. Create a **REST API key**
4. Copy your API key

### 3. Configure Environment Variables

1. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file and add your Companies House API key:
   ```
   COMPANIES_HOUSE_API_KEY=your_actual_api_key_here
   ```

3. **(Optional)** To enable Google Maps location display, add a Google Maps API key:
   - Visit [Google Cloud Console](https://console.cloud.google.com/)
   - Create a project and enable the **Maps Embed API**
   - Create an API key and add it to your `.env` file:
     ```
     GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
     ```

### 4. Start the Server

```bash
python server.py
```

The server will start on `http://localhost:5000`

### 5. Open the Application

Once the server is running, open your web browser and navigate to:
```
http://localhost:5000
```

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

## 🔐 Environment Variables

The application uses a `.env` file to securely store API keys on the server-side. This prevents exposing sensitive credentials to the browser.

**Required:**
- `COMPANIES_HOUSE_API_KEY` - Your Companies House API key (required for all functionality)

**Optional:**
- `GOOGLE_MAPS_API_KEY` - Google Maps API key for displaying company address locations
- `FLASK_DEBUG` - Set to `true` for development mode (never use in production!)

See `.env.example` for the template.

## ⚠️ Troubleshooting

### "Invalid API key" Error

This error occurs when:
1. **Missing .env file** - Make sure you created a `.env` file with your API key
2. **Wrong API key** - Verify you copied the entire API key correctly in the `.env` file
3. **Server not running** - Make sure `python server.py` is running

**Solution:** Check your `.env` file and restart the Flask server!

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
- 🗺️ Google Maps integration for company addresses (optional)
- 📱 Fully responsive design
- ⚡ Fast and smooth animations
- 🔐 Secure API key management (server-side only)

## 📝 License

Free to use for personal and commercial projects.
