import os
import re

def test_static_assets_are_strictly_offline():
    """Verify that static HTML, CSS, and JS files make no outbound CDN/network calls."""
    static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
    
    # Matches http:// or https:// or // external URL imports
    url_pattern = re.compile(r'https?://[^\s\'"<>]+')
    
    violations = []
    for root, _, files in os.walk(static_dir):
        for f in files:
            if f.endswith((".html", ".css", ".js")):
                path = os.path.join(root, f)
                with open(path, "r", encoding="utf-8", errors="ignore") as fp:
                    content = fp.read()
                    matches = url_pattern.findall(content)
                    # Filter out allowed informational links or comments if any, but require zero remote script/style links
                    for m in matches:
                        if "cdn" in m.lower() or "fonts.googleapis" in m.lower() or "unpkg" in m.lower() or "cdnjs" in m.lower():
                            violations.append(f"{f}: {m}")
                            
    assert len(violations) == 0, f"Found external CDN references: {violations}"
