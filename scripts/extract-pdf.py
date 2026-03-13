#!/usr/bin/env python3
"""Extract per-page text from a PDF using PyMuPDF. Outputs JSON to stdout."""

import sys
import json
import fitz

def extract(pdf_path: str) -> dict:
    doc = fitz.open(pdf_path)
    pages = []
    for i, page in enumerate(doc):
        text = page.get_text()
        if text.strip():
            pages.append({"page": i + 1, "text": text})
    return {"pageCount": len(doc), "pages": pages}

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: extract-pdf.py <path>"}), file=sys.stderr)
        sys.exit(1)
    result = extract(sys.argv[1])
    json.dump(result, sys.stdout)
