# ReverseIQ — Software Reverse Engineering Prototype

A student-friendly full-stack prototype that analyses one uploaded Java `.java` file and displays recovered types, fields, methods, simple relationships, and documentation warnings.

## Features
- Modern responsive dashboard UI
- Flask backend with `/api/analyze` and `/api/demo`
- Java source upload (2 MB limit)
- Basic class/interface/enum, field, method and constructor extraction
- Heuristic inheritance, interface and field-type relationship detection
- UML-style class cards and analysis report
- Export analysis as JSON
- Demo project button so the UI can be explored without an upload
- Uploaded source is processed in memory, not saved to disk

## Run in Antigravity
1. Open Antigravity and open this project folder.
2. Open its terminal.
3. Ensure Python 3.10+ is installed.
4. Create and activate a virtual environment (optional but recommended):
   - Windows: `python -m venv .venv`
   - Windows PowerShell: `.\.venv\Scripts\Activate.ps1`
5. Install dependencies:
   `pip install -r requirements.txt`
6. Start the app:
   `python app.py`
7. Open `http://127.0.0.1:5000` in your browser.

## Test it
- Click **Explore sample project** to test the demo.
- Or upload a small `.java` file.
- Open **Classes & methods**, **UML explorer**, and **Documentation report**.
- Click **Export report** to download a JSON report.

## Important limitations
This is an educational prototype, not a complete Java compiler or production-grade reverse engineering tool. The source parser uses regular expressions and brace matching. Complex generics, nested classes, annotations, multiline declarations, overloaded methods, comments inside strings, and other advanced syntax can be misread. Relationship detection is intentionally basic. For a stronger research version, replace the parser with JavaParser or another real Java AST parser, then compare results against manually verified diagrams.
