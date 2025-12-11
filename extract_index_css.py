#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script to extract Index Page CSS from backup file and merge into _index.scss
Extracts lines 14451-17213 from main-compiled.css.backup.20251210-233136
"""

import os

# File paths
backup_file = 'assets/css/main-compiled.css.backup.20251210-233136'
target_file = 'assets/css/pages/_index.scss'

# Line range for Index Page CSS (1-indexed, so we use 14450-17213 for 0-indexed)
start_line = 14450  # 0-indexed (line 14451 in file)
end_line = 17213    # 0-indexed (line 17214 in file, exclusive)

print(f"Reading backup file: {backup_file}")
print(f"Extracting lines {start_line + 1} to {end_line} (Index Page CSS)")

# Read the backup file
try:
    with open(backup_file, 'r', encoding='utf-8') as f:
        all_lines = f.readlines()
    
    # Extract the Index Page CSS section
    index_css_lines = all_lines[start_line:end_line]
    index_css = ''.join(index_css_lines)
    
    print(f"Extracted {len(index_css_lines)} lines of CSS")
    
except FileNotFoundError:
    print(f"Error: Backup file not found: {backup_file}")
    exit(1)
except Exception as e:
    print(f"Error reading backup file: {e}")
    exit(1)

# Read current _index.scss to preserve header comments
print(f"Reading current file: {target_file}")
try:
    with open(target_file, 'r', encoding='utf-8') as f:
        current_content = f.read()
    
    # Extract header comments (first 6 lines which contain the header)
    lines = current_content.split('\n')
    header_lines = []
    for i, line in enumerate(lines[:10]):  # Check first 10 lines
        if line.strip().startswith('//') or line.strip().startswith('/*') or line.strip() == '':
            header_lines.append(line)
        else:
            break
    
    header = '\n'.join(header_lines)
    if header and not header.endswith('\n'):
        header += '\n'
    
    print(f"Preserved {len(header_lines)} header lines")
    
except FileNotFoundError:
    print(f"Warning: Target file not found, creating new one")
    header = "// ============================================\n// Index Page Styles - Specifys.ai\n// ============================================\n// Homepage-specific styles extracted from backup\n\n"

# Combine header + extracted CSS
new_content = header + index_css

# Write to target file
print(f"Writing to: {target_file}")
try:
    with open(target_file, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    # Get file size
    file_size = os.path.getsize(target_file)
    print(f"Success! Written {file_size:,} bytes ({file_size / 1024:.1f} KB) to {target_file}")
    print(f"Total lines in new file: {len(new_content.split(chr(10)))}")
    
except Exception as e:
    print(f"Error writing to target file: {e}")
    exit(1)

print("\nDone! You can now compile main.scss to generate the new main-compiled.css")
