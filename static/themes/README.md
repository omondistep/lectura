# Typora Theme Compatibility

This folder contains Typora-compatible themes for Lectura.

## Adding Typora Themes

1. Download any Typora theme (.css file)
2. Run the adapter script to convert it:
   ```bash
   python adapt_typora_theme.py path/to/theme.css
   ```
3. The adapted theme will be saved here automatically

## Theme Conversion

The adapter automatically:
- Replaces `#write` with `#preview`
- Replaces `.md-` prefixes with `.lc-`
- Adjusts root variables for app compatibility
- Preserves all typography and styling

## Popular Typora Themes

Download from: https://theme.typora.io/

Recommended themes:
- Drake
- Pie
- Lapis
- Ursine
- Monospace
- Academic
