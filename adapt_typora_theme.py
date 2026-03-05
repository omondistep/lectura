#!/usr/bin/env python3
"""
Typora Theme Adapter for Lectura
Converts Typora themes to work with Lectura's structure
"""

import sys
import re
from pathlib import Path

def adapt_typora_theme(input_path, output_dir="static/themes"):
    """Convert a Typora theme to Lectura format"""
    
    input_file = Path(input_path)
    if not input_file.exists():
        print(f"Error: {input_path} not found")
        return False
    
    # Read theme content
    content = input_file.read_text(encoding='utf-8')
    
    # Adaptations
    adaptations = [
        # Replace main container
        (r'#write\b', '#preview'),
        
        # Replace Typora-specific classes
        (r'\.md-fences', '.lc-code-block'),
        (r'\.md-diagram', '.lc-diagram'),
        (r'\.md-image', '.lc-image'),
        (r'\.md-meta-block', '.lc-meta'),
        (r'\.md-table', '.lc-table'),
        (r'\.md-task-list-item', '.lc-task-item'),
        
        # Ensure body/html styles apply to app
        (r'\bbody\b', 'body, #preview-pane'),
        (r'\bhtml\b', 'html, #app'),
    ]
    
    for pattern, replacement in adaptations:
        content = re.sub(pattern, replacement, content)
    
    # Add Lectura compatibility header
    header = f"""/* 
 * Adapted from Typora theme: {input_file.name}
 * Converted for Lectura compatibility
 */

"""
    content = header + content
    
    # Save adapted theme
    output_path = Path(output_dir) / input_file.name
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content, encoding='utf-8')
    
    print(f"✓ Adapted theme saved to: {output_path}")
    return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python adapt_typora_theme.py <theme.css>")
        sys.exit(1)
    
    theme_path = sys.argv[1]
    adapt_typora_theme(theme_path)
