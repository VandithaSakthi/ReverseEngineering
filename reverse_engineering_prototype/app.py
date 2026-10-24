from flask import Flask, render_template, request, jsonify
from werkzeug.utils import secure_filename
import re
import os

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 2 * 1024 * 1024
ALLOWED_EXTENSIONS = {".java"}

def strip_comments(source):
    """Remove comments while preserving strings as much as practical for a student prototype."""
    source = re.sub(r'/\*[\s\S]*?\*/', '', source)
    source = re.sub(r'(?m)^\s*//.*$', '', source)
    return source

def analyze_java(source, filename="Uploaded.java"):
    clean = strip_comments(source)
    package_match = re.search(r'\bpackage\s+([\w.]+)\s*;', clean)
    package_name = package_match.group(1) if package_match else "(default package)"

    class_pattern = re.compile(
        r'\b(class|interface|enum)\s+([A-Za-z_$][\w$]*)'
        r'(?:\s+extends\s+([\w.$]+))?'
        r'(?:\s+implements\s+([\w.$,\s]+?))?\s*\{'
    )
    classes = []
    for match in class_pattern.finditer(clean):
        kind, name, parent, implements = match.groups()
        start = match.end()
        depth, end = 1, start
        while end < len(clean) and depth:
            if clean[end] == '{':
                depth += 1
            elif clean[end] == '}':
                depth -= 1
            end += 1
        body = clean[start:end-1] if depth == 0 else clean[start:]
        fields = []
        methods = []

        # Basic field extraction; intentionally limited to common Java declarations.
        field_pattern = re.compile(
            r'(?m)^\s*(?:(?:public|protected|private|static|final|transient|volatile)\s+)*'
            r'([\w<>\[\].?, ]+?)\s+([A-Za-z_$][\w$]*)\s*(?:=[^;]*)?;'
        )
        for fm in field_pattern.finditer(body):
            field_type, field_name = fm.groups()
            field_type = " ".join(field_type.split())
            if field_type not in {"return", "throw", "new", "case"} and "(" not in field_type:
                fields.append({"type": field_type, "name": field_name})

        method_pattern = re.compile(
            r'(?m)^\s*(?:(?:public|protected|private|static|final|abstract|synchronized|native)\s+)*'
            r'([\w<>\[\].?]+)\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*(?:throws\s+[\w., ]+)?\s*\{?'
        )
        for mm in method_pattern.finditer(body):
            return_type, method_name, params = mm.groups()
            if method_name != name:
                methods.append({
                    "return_type": return_type,
                    "name": method_name,
                    "parameters": params.strip()
                })

        # Find constructor declarations separately.
        constructor_pattern = re.compile(
            r'\b(?:public|protected|private)?\s*' + re.escape(name) + r'\s*\(([^)]*)\)'
        )
        for cm in constructor_pattern.finditer(body):
            methods.append({"return_type": "constructor", "name": name, "parameters": cm.group(1).strip()})

        # Deduplicate repeated matches while preserving order.
        seen = set()
        unique_methods = []
        for item in methods:
            key = (item["name"], item["parameters"], item["return_type"])
            if key not in seen:
                seen.add(key)
                unique_methods.append(item)

        interfaces = [x.strip() for x in implements.split(",")] if implements else []
        classes.append({
            "name": name,
            "kind": kind,
            "extends": parent,
            "implements": interfaces,
            "fields": fields,
            "methods": unique_methods,
            "field_count": len(fields),
            "method_count": len(unique_methods)
        })

    # Identify simple references between discovered classes.
    names = {item["name"] for item in classes}
    relationships = []
    for item in classes:
        if item["extends"] and item["extends"].split(".")[-1] in names:
            relationships.append({"from": item["name"], "to": item["extends"].split(".")[-1], "type": "inherits"})
        for interface in item["implements"]:
            short = interface.split(".")[-1]
            if short in names:
                relationships.append({"from": item["name"], "to": short, "type": "implements"})
        for other in names:
            if other != item["name"] and re.search(r'\b' + re.escape(other) + r'\b', clean):
                # Only report likely references that occur in this class body.
                if other in [f["type"].split(".")[-1].split("<")[0].replace("[]", "") for f in item["fields"]]:
                    relationships.append({"from": item["name"], "to": other, "type": "association"})

    # Unique relationships
    rel_seen, unique_rels = set(), []
    for rel in relationships:
        key = (rel["from"], rel["to"], rel["type"])
        if key not in rel_seen:
            rel_seen.add(key)
            unique_rels.append(rel)

    warnings = []
    if not classes:
        warnings.append("No class, interface, or enum declarations were detected. Check that this is a Java source file.")
    for item in classes:
        if not item["methods"]:
            warnings.append(f"{item['name']} has no methods detected by the prototype analyzer.")
    if not re.search(r'(?m)^\s*/\*|^\s*//', source):
        warnings.append("No source comments were detected. Confirm whether the file needs documentation.")

    return {
        "filename": filename,
        "package": package_name,
        "classes": classes,
        "relationships": unique_rels,
        "class_count": len(classes),
        "field_count": sum(c["field_count"] for c in classes),
        "method_count": sum(c["method_count"] for c in classes),
        "relationship_count": len(unique_rels),
        "warnings": warnings,
        "note": "Prototype parser: results are heuristic and may miss complex Java syntax, nested types, annotations, or multiline declarations."
    }

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/api/analyze", methods=["POST"])
def analyze():
    if "file" not in request.files:
        return jsonify({"error": "Please choose a .java file to analyze."}), 400
    file = request.files["file"]
    filename = secure_filename(file.filename or "Uploaded.java")
    if not filename.lower().endswith(".java"):
        return jsonify({"error": "Only .java files are supported in this prototype."}), 400
    try:
        source = file.read().decode("utf-8")
    except UnicodeDecodeError:
        return jsonify({"error": "Could not read the file as UTF-8 text."}), 400
    if not source.strip():
        return jsonify({"error": "The selected file is empty."}), 400
    return jsonify(analyze_java(source, filename))

@app.route("/api/demo", methods=["POST"])
def demo():
    source = """
package demo;
interface Payable { double calculatePay(); }
class Person {
    private String name;
    private int age;
    public String getName() { return name; }
}
class Student extends Person {
    private String rollNumber;
    private Course course;
    public void registerCourse(Course course) { this.course = course; }
}
class Course {
    private String courseName;
    private int credits;
    public String getCourseName() { return courseName; }
}
"""
    return jsonify(analyze_java(source, "DemoCollegeSystem.java"))

@app.errorhandler(413)
def too_large(_error):
    return jsonify({"error": "File is too large. Please upload a file smaller than 2 MB."}), 413

if __name__ == "__main__":
    app.run(debug=True)
