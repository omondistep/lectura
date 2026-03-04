# Adding Typora Themes to Lectura

Lectura supports Typora themes with minimal adaptation. Follow these steps:

## Quick Start

1. **Download a Typora theme** from [theme.typora.io](https://theme.typora.io/)

2. **Adapt the theme:**
   ```bash
   python adapt_typora_theme.py path/to/downloaded-theme.css
   ```

3. **Restart the app** - The theme will appear in the Themes menu automatically

## Manual Adaptation (Optional)

If you prefer to adapt themes manually:

1. Open the theme CSS file
2. Replace `#write` with `#preview`
3. Save to `static/themes/` folder
4. Restart Lectura

## Recommended Themes

Popular Typora themes that work well:
- **Drake** - Clean, modern dark theme
- **Pie** - Minimalist light theme  
- **Lapis** - Blue-tinted professional theme
- **Ursine** - Bear-inspired theme
- **Academic** - LaTeX-style academic writing
- **Monospace** - Typewriter aesthetic

## Theme Structure

Typora themes style the preview/reading pane. Lectura uses:
- `#preview` - Main content area (Typora uses `#write`)
- Standard Markdown HTML elements
- CSS variables for colors

## Troubleshooting

**Theme doesn't appear:**
- Check the file is in `static/themes/`
- Ensure it has `.css` extension
- Restart the Python server

**Theme looks broken:**
- Run the adapter script to fix compatibility
- Some Typora-specific features may not work
- Report issues on GitHub

## Creating Custom Themes

You can create themes from scratch:

```css
/* my-theme.css */
#preview {
  background: #ffffff;
  color: #333333;
  font-family: Georgia, serif;
  padding: 2em;
  max-width: 800px;
  margin: 0 auto;
}

#preview h1 {
  color: #2c3e50;
  border-bottom: 2px solid #3498db;
}

/* Add more styles... */
```

Save to `static/themes/my-theme.css` and restart.
