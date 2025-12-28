from datetime import datetime as dt

# Get the current minute from the system time
current_minute = dt.now().minute

# Check if the current minute is odd using modulo operator
if current_minute % 2 != 0:
    print("current minute looks ODD!")
else:
    print("Current minute is even")

