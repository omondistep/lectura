# Contributing to Lectura

Thank you for your interest in contributing to Lectura! This guide will help you get started.

## 🚀 Quick Start

1. **Fork** the repository on GitHub
2. **Clone** your fork locally
3. **Create** a feature branch
4. **Make** your changes
5. **Test** thoroughly
6. **Submit** a pull request

## 🛠️ Development Setup

### Prerequisites
- **Python 3.8+**
- **Node.js 16+** (for Electron development)
- **Git**
- **Modern web browser**

### Local Development
```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/lectura.git
cd lectura

# Set up Python environment
python -m venv venv
source venv/bin/activate  # Linux/macOS
# or
venv\Scripts\activate     # Windows

# Install Python dependencies
pip install -r requirements.txt

# Install Node.js dependencies (for Electron)
npm install

# Start development server
python main.py
```

Open http://127.0.0.1:8000 in your browser.

## 📝 How to Contribute

### 🐛 Bug Reports
- **Search existing issues** first
- **Use the bug report template**
- **Include steps to reproduce**
- **Provide system information** (OS, Python version, browser)
- **Add screenshots** if relevant

### ✨ Feature Requests
- **Check if it already exists** in issues or discussions
- **Describe the problem** you're trying to solve
- **Explain your proposed solution**
- **Consider the scope** - keep features focused

### 🔧 Code Contributions

#### Areas We Welcome Help With:
- **Bug fixes** - Any size, from typos to major issues
- **New themes** - CSS-based themes for different aesthetics
- **Export formats** - Additional export options (Word, LaTeX, etc.)
- **Cloud integrations** - New cloud storage providers
- **Mobile responsiveness** - Better mobile/tablet experience
- **Performance improvements** - Faster rendering, smaller bundles
- **Accessibility** - Screen reader support, keyboard navigation
- **Internationalization** - Multi-language support

#### Code Style Guidelines:
- **Python**: Follow PEP 8, use type hints where helpful
- **JavaScript**: Use modern ES6+, prefer const/let over var
- **CSS**: Use CSS custom properties, maintain theme compatibility
- **HTML**: Semantic markup, accessibility attributes

#### Before You Start:
1. **Open an issue** to discuss major changes
2. **Check existing PRs** to avoid duplicate work
3. **Keep changes focused** - one feature/fix per PR

## 🧪 Testing

### Manual Testing
- **Test on multiple browsers** (Chrome, Firefox, Safari, Edge)
- **Test responsive design** (mobile, tablet, desktop)
- **Test with different themes**
- **Test Vim mode** if your changes affect the editor
- **Test cloud sync** if relevant

### Automated Testing
```bash
# Run Python tests (if available)
python -m pytest

# Run JavaScript tests (if available)
npm test

# Lint code
npm run lint
```

## 📋 Pull Request Process

### Before Submitting
- [ ] **Code follows style guidelines**
- [ ] **Changes are tested** on multiple browsers
- [ ] **Documentation updated** if needed
- [ ] **No breaking changes** without discussion
- [ ] **Commit messages are clear**

### PR Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Other (please describe)

## Testing
- [ ] Tested on Chrome
- [ ] Tested on Firefox
- [ ] Tested on mobile
- [ ] Tested with Vim mode

## Screenshots (if applicable)
Add screenshots of UI changes
```

### Review Process
1. **Automated checks** must pass
2. **Code review** by maintainers
3. **Testing** on different platforms
4. **Merge** when approved

## 🎨 Theme Development

### Creating New Themes
1. **Copy** an existing theme from `static/themes/`
2. **Modify** CSS custom properties
3. **Test** with both light and dark system preferences
4. **Add** to theme menu in `index.html`

### Theme Guidelines
- **Use CSS custom properties** for colors
- **Support both editor and preview** styling
- **Consider accessibility** (contrast ratios)
- **Test with different content** types

## 🌐 Internationalization

### Adding New Languages
1. **Create** language files in `static/i18n/`
2. **Translate** UI strings
3. **Update** language selector
4. **Test** with different text lengths

## 📚 Documentation

### What to Document
- **New features** - Add to README and relevant guides
- **API changes** - Update any affected documentation
- **Configuration options** - Document in INSTALL.md
- **Breaking changes** - Clearly mark in changelog

### Documentation Style
- **Clear and concise** language
- **Step-by-step instructions** with code examples
- **Screenshots** for UI features
- **Cross-platform** considerations

## 🤝 Community Guidelines

### Be Respectful
- **Welcoming** to newcomers
- **Constructive** feedback only
- **Patient** with questions
- **Inclusive** language

### Communication
- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - General questions and ideas
- **Pull Requests** - Code contributions with clear descriptions

## 🏷️ Release Process

### Versioning
We use [Semantic Versioning](https://semver.org/):
- **MAJOR** - Breaking changes
- **MINOR** - New features (backward compatible)
- **PATCH** - Bug fixes

### Release Checklist
- [ ] Update version numbers
- [ ] Update CHANGELOG.md
- [ ] Test installers on all platforms
- [ ] Create GitHub release with binaries
- [ ] Update documentation

## 📞 Getting Help

### For Contributors
- **Read existing code** to understand patterns
- **Ask questions** in issues or discussions
- **Start small** with documentation or minor fixes
- **Join discussions** about project direction

### For Users
- **Check documentation** first (README, INSTALL, etc.)
- **Search existing issues** before creating new ones
- **Provide detailed information** when reporting problems

---

## 🙏 Recognition

Contributors will be:
- **Listed** in the README acknowledgments
- **Credited** in release notes
- **Thanked** publicly on social media

Thank you for helping make Lectura better! 🎉

---

*For installation and usage instructions, see [README.md](README.md)*
