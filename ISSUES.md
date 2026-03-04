# Lectura Code Review — Identified Issues

## Security Issues (Critical/High)

- [x] **1. XSS in OAuth callbacks** — `main.py:1078-1108` — `code`, `state`, `error` injected into `<script>` via f-strings
- [x] **2. `postMessage` with wildcard origin** — `main.py:1080-1106` — `'*'` allows any page to intercept OAuth tokens
- [x] **3. Missing path validation on `create_folder`** — `main.py:410-414`
- [x] **4. Missing path validation on `rename_folder`** — `main.py:417-427`
- [x] **5. Missing path validation on `download_md`** — `main.py:471-477`
- [x] **6. Missing path validation on `reveal_in_file_manager`** — `main.py:430-440`
- [x] **7. XSS in HTML export** — `main.py:496` — filename injected into `<title>` unsanitized
- [x] **8. GitHub token in localStorage** — `editor.js:2527` — vulnerable to XSS exfiltration

## Architectural Issues (Medium)

- [x] **9. Hardcoded 3s startup delay** — `electron-main.js:39-41` — should poll server readiness
- [x] **10. Duplicate GitHub OAuth implementations** — `main.py:790-822` and `main.py:1034-1108`
- [x] **11. Silent auto-publish every 10 minutes** — `editor.js:2814-2817` — no user consent
- [x] **12. Fake terminal** — `editor.js:2365-2414` — simulates commands, returns hardcoded output
- [x] **13. Fake git commit/push** — `editor.js:2554-2581` — buttons do nothing real

## Code Quality Issues

- [x] **14. Bare `except:` clauses** — `main.py:320, 340` — should be `except Exception:`
- [x] **15. No encoding/error handling on `read_file`** — `main.py:365`
- [x] **16. `populateFileList` data shape mismatch** — `editor.js:1026-1028` — expects strings, gets objects
- [x] **17. Duplicate file creation logic** — `editor.js` — same code copy-pasted 4 times
- [x] **18. Placeholder GitHub client ID** — `editor.js:2443` — hardcoded non-functional value

## Performance Issues

- [x] **19. Vim mode polling every frame** — `editor.js:848-872` — runs even when Vim disabled
- [x] **20. `loadFileList()` called excessively** — every save/rename/delete rebuilds entire tree
- [x] **21. Search reads entire files into memory** — `main.py:453-454` — no indexing or limits
- [x] **22. File list reads first line of every file** — `main.py:308-322` — on every refresh
