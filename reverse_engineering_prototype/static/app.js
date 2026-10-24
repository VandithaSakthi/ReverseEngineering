let latestResult = null;
const $ = (id) => document.getElementById(id);
const fileInput = $("java-file");
const dropZone = $("drop-zone");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[ch]));
}
function updateFileName() {
  const file = fileInput.files[0];
  $("selected-file").textContent = file ? `${file.name} · ${(file.size/1024).toFixed(1)} KB` : "No file selected";
}
fileInput.addEventListener("change", updateFileName);
["dragenter","dragover"].forEach(evt => dropZone.addEventListener(evt, e => {
  e.preventDefault(); dropZone.classList.add("dragover");
}));
["dragleave","drop"].forEach(evt => dropZone.addEventListener(evt, e => {
  e.preventDefault(); dropZone.classList.remove("dragover");
}));
dropZone.addEventListener("drop", e => {
  const file = e.dataTransfer.files[0];
  if (file && file.name.toLowerCase().endsWith(".java")) {
    const transfer = new DataTransfer(); transfer.items.add(file); fileInput.files = transfer.files; updateFileName();
  } else {
    showMessage("Please drop a .java source file.");
  }
});
function showMessage(message, success=false) {
  $("form-message").textContent = message;
  $("form-message").className = "form-message" + (success ? " success" : "");
}
$("jump-upload").addEventListener("click", () => $("upload-section").scrollIntoView({behavior:"smooth",block:"center"}));

async function postJsonOrFile(url, file=null) {
  const body = new FormData();
  if (file) body.append("file", file);
  const response = await fetch(url, {method:"POST", body});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Analysis failed.");
  return data;
}
$("upload-form").addEventListener("submit", async e => {
  e.preventDefault();
  const file = fileInput.files[0];
  if (!file) return showMessage("Choose a Java source file first.");
  if (!file.name.toLowerCase().endsWith(".java")) return showMessage("Only .java files are supported.");
  const btn = $("analyze-btn");
  btn.disabled = true; btn.textContent = "Analyzing source…"; showMessage("");
  try {
    const result = await postJsonOrFile("/api/analyze", file);
    renderResults(result);
    showMessage("Analysis completed successfully.", true);
  } catch (err) {
    showMessage(err.message);
  } finally {
    btn.disabled = false; btn.innerHTML = 'Run analysis <span>→</span>';
  }
});
$("demo-btn").addEventListener("click", async () => {
  showMessage("Loading the sample project…", true);
  try { renderResults(await postJsonOrFile("/api/demo")); showMessage("Sample project analyzed successfully.", true); }
  catch (err) { showMessage(err.message); }
});
function renderResults(data) {
  latestResult = data;
  $("results-section").classList.remove("hidden");
  $("result-title").textContent = data.filename || "Recovered software structure";
  $("result-subtitle").textContent = `${data.package} · ${data.class_count} types identified`;
  $("stat-classes").textContent = data.class_count;
  $("stat-methods").textContent = data.method_count;
  $("stat-relations").textContent = data.relationship_count;
  $("stat-warnings").textContent = data.warnings.length;
  $("view-classes").innerHTML = data.classes.length ? data.classes.map(c => `
    <article class="class-card">
      <div class="class-card-head"><span class="class-name">${escapeHtml(c.name)}</span><span class="class-kind">${escapeHtml(c.kind)}${c.extends ? " · extends "+escapeHtml(c.extends) : ""}</span></div>
      <div class="class-card-body">
        <div class="class-column"><h4>ATTRIBUTES (${c.fields.length})</h4>${c.fields.length ? c.fields.map(f=>`<div class="code-item"><span>${escapeHtml(f.type)}</span> ${escapeHtml(f.name)}</div>`).join("") : '<div class="empty">No attributes detected</div>'}</div>
        <div class="class-column"><h4>METHODS (${c.methods.length})</h4>${c.methods.length ? c.methods.map(m=>`<div class="code-item"><span>${escapeHtml(m.return_type)}</span> ${escapeHtml(m.name)}(${escapeHtml(m.parameters)})</div>`).join("") : '<div class="empty">No methods detected</div>'}</div>
      </div>
    </article>`).join("") : '<div class="warning-item"><span>!</span>No types detected. Check the uploaded Java file.</div>';
  $("view-uml").innerHTML = `<div class="uml-canvas"><div class="uml-row">${data.classes.map(c=>`
    <div class="uml-box"><h4>${escapeHtml(c.name)}</h4><div class="uml-fields">${c.fields.map(f=>`− ${escapeHtml(f.name)}: ${escapeHtml(f.type)}`).join("<br>") || '<span class="empty">No fields</span>'}</div><div class="uml-methods">${c.methods.map(m=>`+ ${escapeHtml(m.name)}(${escapeHtml(m.parameters)})`).join("<br>") || '<span class="empty">No methods</span>'}</div></div>`).join("")}</div>
    ${data.relationships.length ? `<div class="rel-list">${data.relationships.map(r=>`<span class="rel-chip">${escapeHtml(r.from)} → ${escapeHtml(r.to)} · ${escapeHtml(r.type)}</span>`).join("")}</div>` : '<p class="muted" style="margin-top:14px">No relationships were confidently detected by this prototype.</p>'}
    </div>`;
  $("view-warnings").innerHTML = data.warnings.length ? data.warnings.map(w=>`<div class="warning-item"><span>!</span><div>${escapeHtml(w)}</div></div>`).join("") : '<div class="warning-item success-item"><span>✓</span><div>No basic documentation warnings were detected. This does not guarantee that the code is fully documented.</div></div>';
  $("parser-note").textContent = data.note || "";
  setActiveTab("classes");
  $("results-section").scrollIntoView({behavior:"smooth",block:"start"});
}
function setActiveTab(tab) {
  document.querySelectorAll(".result-tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
  ["classes","uml","warnings"].forEach(name=>$("view-"+name).classList.toggle("hidden",name!==tab));
}
document.querySelectorAll(".result-tab").forEach(b=>b.addEventListener("click",()=>setActiveTab(b.dataset.tab)));
$("download-report").addEventListener("click", () => {
  if (!latestResult) return;
  const report = {
    title: "ReverseIQ Software Analysis Report",
    generatedAt: new Date().toISOString(),
    ...latestResult
  };
  const blob = new Blob([JSON.stringify(report,null,2)],{type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download="reverseiq-analysis-report.json"; a.click();
  URL.revokeObjectURL(url);
});
document.querySelectorAll(".nav-item").forEach(button=>button.addEventListener("click",()=>{
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.remove("active"));
  button.classList.add("active");
  const view=button.dataset.view;
  $("crumb-current").textContent=button.textContent.trim();
  if(view==="analysis") $("upload-section").scrollIntoView({behavior:"smooth",block:"center"});
  else if(view==="diagrams" && latestResult){$("results-section").classList.remove("hidden");setActiveTab("uml");$("results-section").scrollIntoView({behavior:"smooth"});}
  else if(view==="reports" && latestResult){$("results-section").classList.remove("hidden");setActiveTab("warnings");$("results-section").scrollIntoView({behavior:"smooth"});}
  else if(view==="overview") window.scrollTo({top:0,behavior:"smooth"});
}));
