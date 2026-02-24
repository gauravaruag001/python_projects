import os
try:
    import pypdf
    with open(r"c:\Users\44743\Desktop\LinUK - Study Materials.pdf", "rb") as f:
        reader = pypdf.PdfReader(f)
        print(f"PDF Pages: {len(reader.pages)}")
except ImportError:
    print("pypdf not installed.")
except Exception as e:
    print(f"Error: {e}")
