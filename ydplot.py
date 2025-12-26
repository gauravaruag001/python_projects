import yfinance as yf
import matplotlib.pyplot as plt
import pandas as pd

def main():
    ticker_symbol = input("Enter a stock ticker symbol: ").upper().strip()
    
    if not ticker_symbol:
        print("Error: Ticker symbol cannot be empty.")
        return

    try:
        ticker = yf.Ticker(ticker_symbol)
        
        # Fetch info to check exchange
        # Note: yfinance can be slow to fetch info, so we do this first to validate
        info = ticker.info
        
        # Check if 'exchange' is present and if it relates to NASDAQ
        # Common values for NASDAQ: 'NMS', 'NASDAQ', 'NGM'
        exchange = info.get('exchange', '').upper()
        
        if 'NASDAQ' not in exchange and 'NMS' not in exchange and 'NGM' not in exchange:
            print(f"The ticker '{ticker_symbol}' is on exchange '{exchange}', not NASDAQ.")
            return
            
        # Get period input
        period_input = input("Enter time period (week/month/year): ").lower().strip()
        
        period_map = {
            'week': '5d',
            'month': '1mo',
            'year': '1y'
        }
        
        yf_period = period_map.get(period_input, '5d') # Default to week if invalid
        if period_input not in period_map:
             print(f"Invalid period '{period_input}'. Defaulting to 'week'.")
             period_label = "Past Week"
        else:
             period_label = f"Past {period_input.capitalize()}"

        print(f"Fetching data for {ticker_symbol} (NASDAQ) for {period_label}...")
        
        # Fetch history
        hist = ticker.history(period=yf_period)
        
        if hist.empty:
            print(f"No data found for {ticker_symbol}.")
            return
            
        # Get Company Name
        company_name = info.get('shortName', ticker_symbol)

        # Plotting
        plt.figure(figsize=(10, 6))
        plt.plot(hist.index, hist['Close'], marker='o', linestyle='-')
        plt.title(f"{company_name} ({ticker_symbol}) - {period_label} Performance (Close Price)")
        plt.xlabel("Date")
        plt.ylabel("Price (USD)")
        plt.grid(True)
        plt.xticks(rotation=45)
        plt.tight_layout()
        plt.show()
        
    except Exception as e:
        print(f"An error occurred: {e}")
        # In case of invalid ticker, yfinance might not raise exception immediately but return empty info or history
        # but often 404s raise exceptions in recent versions or just print errors.

if __name__ == "__main__":
    main()
