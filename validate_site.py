#!/usr/bin/env python3
"""
Site Validation Script
Tests all pages on the Jekyll site for functionality
"""

import requests
import json
from urllib.parse import urljoin
from datetime import datetime
import sys

BASE_URL = "http://localhost:4000"
BACKEND_URL = "https://specifys-ai-development.onrender.com"

# List of all pages to test
PAGES_WITH_LAYOUT = [
    ("/blog/", "Blog"),
    ("/article.html", "Article"),
    ("/pages/articles.html", "Articles"),
    ("/academy.html", "Academy"),
    ("/academy/category.html", "Academy Category"),
    ("/academy/guide.html", "Academy Guide"),
    ("/dynamic-post/", "Dynamic Post"),
    ("/tools/map/vibe-coding-tools-map.html", "Tools Map"),
]

STATIC_PAGES = [
    ("/", "Homepage"),
    ("/pages/about.html", "About"),
    ("/pages/pricing.html", "Pricing"),
    ("/pages/auth.html", "Auth"),
    ("/pages/profile.html", "Profile"),
    ("/pages/spec-viewer.html", "Spec Viewer"),
    ("/pages/demo-spec.html", "Demo Spec"),
    ("/pages/how.html", "How It Works"),
    ("/pages/why.html", "Why"),
    ("/pages/ToolPicker.html", "Tool Picker"),
    ("/pages/404.html", "404"),
    ("/pages/maintenance.html", "Maintenance"),
    ("/pages/admin-dashboard.html", "Admin Dashboard"),
    ("/pages/legacy-viewer.html", "Legacy Viewer"),
    ("/pages/admin/academy/index.html", "Academy Admin"),
]

# CSS files that should be loaded
REQUIRED_CSS = [
    "main-compiled.css",
    "buttons.css",
    "display.css",
    "text.css",
    "spacing.css",
]

# JavaScript files that should be loaded
REQUIRED_JS = [
    "config.js",
    "api-client.js",
    "base.js",
    "Modal.js",
    "store.js",
    "app-logger.js",
    "css-monitor.js",
]

results = {
    "timestamp": datetime.now().isoformat(),
    "base_url": BASE_URL,
    "backend_url": BACKEND_URL,
    "pages": {},
    "issues": [],
    "summary": {
        "total": 0,
        "passed": 0,
        "failed": 0,
        "warnings": 0
    }
}

def check_page(url, name):
    """Check a single page"""
    print(f"\n{'='*60}")
    print(f"Checking: {name} ({url})")
    print(f"{'='*60}")
    
    page_result = {
        "url": url,
        "name": name,
        "status": "unknown",
        "http_status": None,
        "css_files": [],
        "js_files": [],
        "errors": [],
        "warnings": [],
        "links": []
    }
    
    try:
        # Check HTTP status
        response = requests.get(urljoin(BASE_URL, url), timeout=10)
        page_result["http_status"] = response.status_code
        
        if response.status_code != 200:
            page_result["status"] = "failed"
            page_result["errors"].append(f"HTTP {response.status_code}")
            results["summary"]["failed"] += 1
            return page_result
        
        # Parse HTML
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Check CSS files
        css_links = soup.find_all('link', rel='stylesheet')
        for link in css_links:
            href = link.get('href', '')
            if href:
                page_result["css_files"].append(href)
        
        # Check JavaScript files
        js_scripts = soup.find_all('script', src=True)
        for script in js_scripts:
            src = script.get('src', '')
            if src:
                page_result["js_files"].append(src)
        
        # Check for required CSS files
        css_found = [css for css in REQUIRED_CSS if any(css in f for f in page_result["css_files"])]
        missing_css = [css for css in REQUIRED_CSS if css not in css_found]
        
        if missing_css:
            page_result["warnings"].append(f"Missing CSS files: {', '.join(missing_css)}")
        
        # Check for links
        links = soup.find_all('a', href=True)
        for link in links:
            href = link.get('href', '')
            if href and not href.startswith('http') and not href.startswith('#'):
                page_result["links"].append(href)
        
        # Check for console errors (we can't actually check this, but we can note it)
        page_result["warnings"].append("Console errors should be checked manually in browser")
        
        page_result["status"] = "passed" if not page_result["errors"] else "failed"
        if page_result["warnings"]:
            results["summary"]["warnings"] += 1
        
        if page_result["status"] == "passed":
            results["summary"]["passed"] += 1
        else:
            results["summary"]["failed"] += 1
            
    except Exception as e:
        page_result["status"] = "failed"
        page_result["errors"].append(str(e))
        results["summary"]["failed"] += 1
    
    results["summary"]["total"] += 1
    return page_result

def check_backend():
    """Check backend connectivity"""
    print(f"\n{'='*60}")
    print("Checking Backend API")
    print(f"{'='*60}")
    
    try:
        response = requests.get(f"{BACKEND_URL}/api/health", timeout=10)
        if response.status_code == 200:
            print(f"✓ Backend health check: OK ({response.status_code})")
            return True
        else:
            print(f"✗ Backend health check: Failed ({response.status_code})")
            results["issues"].append(f"Backend health check returned {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ Backend health check: Error - {e}")
        results["issues"].append(f"Backend health check error: {e}")
        return False

def main():
    print("="*60)
    print("Site Validation Script")
    print("="*60)
    print(f"Base URL: {BASE_URL}")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Timestamp: {results['timestamp']}")
    
    # Check backend
    check_backend()
    
    # Check pages with layout
    print(f"\n{'='*60}")
    print("Checking Pages with Jekyll Layout")
    print(f"{'='*60}")
    for url, name in PAGES_WITH_LAYOUT:
        results["pages"][name] = check_page(url, name)
    
    # Check static pages
    print(f"\n{'='*60}")
    print("Checking Static Pages")
    print(f"{'='*60}")
    for url, name in STATIC_PAGES:
        results["pages"][name] = check_page(url, name)
    
    # Print summary
    print(f"\n{'='*60}")
    print("Summary")
    print(f"{'='*60}")
    print(f"Total pages: {results['summary']['total']}")
    print(f"Passed: {results['summary']['passed']}")
    print(f"Failed: {results['summary']['failed']}")
    print(f"Warnings: {results['summary']['warnings']}")
    
    # Save results
    output_file = "docs/SITE-VALIDATION-REPORT.json"
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2)
    print(f"\nResults saved to: {output_file}")
    
    return results['summary']['failed'] == 0

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nValidation interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\nError: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

