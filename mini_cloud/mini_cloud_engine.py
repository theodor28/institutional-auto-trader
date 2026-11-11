# -*- coding: utf-8 -*-
"""STEINER MINI CLOUD 3.0 | scoped mission engine: Execute -> Observe -> Repair -> Verify.
NO Windows desktop capture. Browser opens only local, agent-created, script-free HTML.
Does not access Chrome profile, private tabs, UAC, arbitrary processes or personal files.
"""
from pathlib import Path
import base64
import hashlib
import json
import os
import re
import time
import uuid
from datetime import datetime, timezone

MAX_BYTES = 50_000
ISSUE_RULES = ("missing_doctype", "missing_lang", "missing_charset",
               "missing_viewport", "missing_title", "missing_h1",
               "horizontal_overflow", "console_errors", "screenshot_failed")
VALID_PATH = re.compile(r"^sites/[a-z0-9_-]{1,62}/index[.]html$")
EXTERNAL = re.compile(r"<\s*(script|iframe|form|object|embed)\b|(?:src|href)\s*=\s*['\"]?\s*(?:https?:|javascript:)", re.I)
def now(): return datetime.now(timezone.utc).isoformat()
def sha(data): return hashlib.sha256(data).hexdigest()
def safe_site(output: Path, path: str) -> Path:
    if not isinstance(path,str) or not VALID_PATH.fullmatch(path):
        raise ValueError("Only generated sites/<slug>/index.html may be inspected")
    base = output.resolve()
    sub = (output / path)
    if any(p.is_symlink() for p in [sub, sub.parent, sub.parent.parent]):
        raise ValueError("Symlink rejected")
    target = sub.resolve()
    if not target.is_relative_to(base) or not target.is_file():
        raise ValueError("Generated site does not exist")
    if target.stat().st_size>MAX_BYTES:
        raise ValueError("Generated HTML too large")
    data = target.read_bytes()
    content = data.decode("utf-8", errors="strict")
    if EXTERNAL.search(content):
        raise ValueError("Active/external HTML not accepted in automated browser")
    return target

def static_issues(text):
    problems=[]
    if not re.search(r"<!doctype\s+html\s*>",text,re.I):problems.append("missing_doctype")
    if not re.search(r'<html[^>]+lang=["\'][^"\']+["\']',text,re.I):problems.append("missing_lang")
    if not re.search(r'<meta\s+charset=["\']utf-8["\']',text,re.I):problems.append("missing_charset")
    if not re.search(r'<meta\s+name=["\']viewport["\']',text,re.I):problems.append("missing_viewport")
    if not re.search(r"<title>\s*[^<]+\s*</title>",text,re.I):problems.append("missing_title")
    if not re.search(r"<h1\b[^>]*>.*?</h1>",text,re.I|re.S):problems.append("missing_h1")
    return problems

def browser_observe(target:Path, report_dir:Path, stage:str):
    """Vision is *scoped* to locally generated HTML; two real browser screenshots."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise RuntimeError("Playwright not installed. Vision requires Chrome/Edge Playwright.") from exc
    report_dir.mkdir(parents=True,exist_ok=True)
    traces=[]
    browser=None
    with sync_playwright() as p:
        last=None
        for channel in ("chrome","msedge",None):
            try:
                kw={"headless":True}
                if channel:kw["channel"]=channel
                browser=p.chromium.launch(**kw)
                break
            except Exception as exc:last=exc
        if browser is None:
            raise RuntimeError("Cannot launch isolated Chrome/Edge: "+type(last).__name__)
        try:
            for name,width,height in [("desktop",1280,720),("mobile",390,844)]:
                ctx=browser.new_context(viewport={"width":width,"height":height},
                                        java_script_enabled=False,
                                        service_workers="block",
                                        accept_downloads=False,
                                        offline=True)
                page=ctx.new_page()
                errors=[]
                page.on("console",lambda message,errors=errors:
                    errors.append(message.text[:180]) if message.type=="error" else None)
                page.on("pageerror",lambda err,errors=errors:errors.append(str(err)[:180]))
                # file:// only. No outgoing network access, even if edited content is malicious.
                page.route("**/*",lambda route:route.continue_()
                           if route.request.url.startswith("file:///") else route.abort())
                page.goto(target.as_uri(),wait_until="load",timeout=15000)
                page.wait_for_timeout(100)
                state=page.evaluate("""() => ({
                    viewport:innerWidth, document:document.documentElement.scrollWidth,
                    body:document.body.scrollWidth,
                    title:document.title,
                    heading:document.querySelector('h1')?.innerText||'',
                    textLength:document.body.innerText.length,
                    images:[...document.images].filter(i=>!i.complete||i.naturalWidth===0).length
                })""")
                namefile=report_dir/(stage+"_"+name+".png")
                screenshot=page.screenshot(path=str(namefile),full_page=True,animations="disabled",timeout=15000)
                thumb=b""
                if name=="desktop":
                    try:
                        thumb=page.screenshot(type="jpeg",quality=32,
                            full_page=False,animations="disabled",timeout=15000)
                    except Exception:pass
                trace={
                  "view":name,"width":width,"height":height,
                  "issues":(["horizontal_overflow"] if state["document"]>width+2 or state["body"]>width+2 else [])
                           +(["broken_images"] if state["images"] else [])
                           +(["console_errors"] if errors else [])
                           +(["missing_h1"] if not state["heading"] else []),
                  "metrics":state,"console_errors":errors[:6],
                  "screenshot":str(namefile.relative_to(report_dir.parent)),
                  "screenshot_bytes":len(screenshot),"screenshot_sha256":sha(screenshot)
                }
                if thumb and len(thumb)<45_000:
                    trace["thumbnail"]="data:image/jpeg;base64,"+base64.b64encode(thumb).decode("ascii")
                traces.append(trace)
                ctx.close()
        finally:
            browser.close()
    return traces

def report_issues(audits):
    found=set()
    for i in audits["static"]:found.add(i)
    for view in audits["views"]:
        for issue in view["issues"]:found.add(issue)
    return sorted(found)

def inspect(output:Path, relative:str,stage:str="before",report_dir=None):
    target=safe_site(output,relative)
    d=report_dir or (output/"missions"/("inspection-"+uuid.uuid4().hex[:9]))
    d.mkdir(parents=True,exist_ok=True)
    html=target.read_text(encoding="utf-8")
    audits={"static":static_issues(html),"views":browser_observe(target,d,stage),
            "sha256":sha(target.read_bytes()),"checked_at":now()}
    audits["issues"]=report_issues(audits)
    audits["ok"]=not bool(audits["issues"])
    return audits,d

def bounded_repair(text,issues):
    """Heuristic repairs to safe HTML only. Never invents arbitrary JS or external calls."""
    before=text
    applied=[]
    if "missing_doctype" in issues:
        text="<!doctype html>\n"+text
        applied.append("Added HTML5 doctype")
    if "missing_lang" in issues:
        text=re.sub(r"<html\b",'<html lang="pt-BR"',text,count=1,flags=re.I)
        applied.append("Added document language")
    if "missing_charset" in issues:
        text=re.sub(r"<head\b[^>]*>",lambda m:m.group(0)+'<meta charset="utf-8">',
                    text,count=1,flags=re.I)
        applied.append("Added UTF-8 declaration")
    if "missing_viewport" in issues:
        text=re.sub(r"<head\b[^>]*>",lambda m:m.group(0)+
                    '<meta name="viewport" content="width=device-width,initial-scale=1">',
                    text,count=1,flags=re.I)
        applied.append("Added responsive viewport")
    if "missing_title" in issues:
        text=re.sub(r"<head\b[^>]*>",lambda m:m.group(0)+"<title>Site verificado</title>",
                    text,count=1,flags=re.I)
        applied.append("Added document title")
    if "horizontal_overflow" in issues and "</style>" in text.lower():
        text=re.sub(r"</style>",'html,body{max-width:100%;overflow-x:hidden}'+
                    '*{overflow-wrap:anywhere}</style>',text,count=1,flags=re.I)
        applied.append("Added overflow protection")
    # Missing semantic heading or broken image is reported for manual remediation;
    # no unsupported synthetic content or image URLs are invented.
    return text,applied

def mission(conf, args, create_site):
    """One bounded cycle: create -> test -> repair if needed -> re-test. No arbitrary code."""
    title=str(args.get("title","")).strip()[:100]
    description=str(args.get("description","")).strip()[:800]
    if not title or not description:
        raise ValueError("Mission needs a title and description")
    output=conf["workspace"]/"STEINER_MINI_WINDOWS"/"CLOUD_OUTPUTS"
    output=output.resolve()
    output.mkdir(parents=True,exist_ok=True)
    trace=[]
    timestamp=now()
    site=create_site(conf,"create_site",{"title":title,"description":description})
    relative=site["relative_path"]
    trace.append({"step":"execute","status":"complete","path":relative,
                  "sha256":site["sha256"]})
    directory=output/"missions"/("mission-"+uuid.uuid4().hex[:12])
    before,dirpath=inspect(output,relative,"before",directory)
    trace.append({"step":"observe","status":"complete","issues":before["issues"],
                  "screenshots":2})
    fixes=[]
    target=safe_site(output,relative)
    if before["issues"]:
        previous=target.read_text(encoding="utf-8")
        corrected,fixes=bounded_repair(previous,before["issues"])
        if corrected != previous:
            backup=directory/"original.html"
            backup.write_bytes(target.read_bytes())
            target.write_bytes(corrected.encode("utf-8"))
        trace.append({"step":"repair","status":"changed" if fixes else "no_safe_fix",
                      "fixes":fixes})
        after,_=inspect(output,relative,"after",directory)
    else:
        after=before
        trace.append({"step":"repair","status":"unnecessary","fixes":[]})
    trace.append({"step":"verify","status":"pass" if after["ok"] else "review",
                  "issues":after["issues"]})
    result={"mission_id":directory.name,"created_at":timestamp,
            "path":relative,"status":"verified" if after["ok"] else "needs_review",
            "initial_issues":before["issues"],"final_issues":after["issues"],
            "fixes":fixes,"steps":trace,
            "sha256":after["sha256"],
            "screenshots":[{"view":v["view"],"file":v["screenshot"],
                           "bytes":v["screenshot_bytes"],
                           "sha256":v["screenshot_sha256"]} for v in after["views"]],
            "summary":"Browser inspected only local generated HTML; no Windows desktop captured"}
    thumb=next((v.get("thumbnail") for v in after["views"] if v["view"]=="desktop"),None)
    if thumb: result["screenshot_data_uri"]=thumb
    data=json.dumps({k:v for k,v in result.items() if k!="screenshot_data_uri"},
                    ensure_ascii=False,indent=2)
    (directory/"report.json").write_bytes(data.encode("utf-8"))
    result["report_path"]=(directory/"report.json").relative_to(output).as_posix()
    result["preview_html"]=target.read_text(encoding="utf-8")[:12000]
    return result

def inspect_generated(conf,args,auto_repair=False):
    output=(conf["workspace"]/"STEINER_MINI_WINDOWS"/"CLOUD_OUTPUTS").resolve()
    path=args.get("path","")
    directory=output/"missions"/("inspection-"+uuid.uuid4().hex[:12])
    before,_=inspect(output,path,"before",directory)
    target=safe_site(output,path)
    fixed=[]
    after=before
    if auto_repair and before["issues"]:
        source=target.read_text(encoding="utf-8")
        repaired,fixed=bounded_repair(source,before["issues"])
        if repaired!=source:
            (directory/"original.html").write_bytes(target.read_bytes())
            target.write_bytes(repaired.encode("utf-8"))
            after,_=inspect(output,path,"after",directory)
    result={
        "path":path,"status":"verified" if after["ok"] else "needs_review",
        "initial_issues":before["issues"],"final_issues":after["issues"],
        "fixes":fixed,"sha256":after["sha256"],
        "screenshot_paths":[v["screenshot"] for v in after["views"]],
        "summary":"Only an agent-generated site was visited; personal Chrome untouched."
    }
    thumb=next((v.get("thumbnail") for v in after["views"] if v["view"]=="desktop"),None)
    if thumb:result["screenshot_data_uri"]=thumb
    (directory/"report.json").write_bytes(json.dumps(
        {k:v for k,v in result.items() if k!="screenshot_data_uri"},
        ensure_ascii=False,indent=2).encode("utf-8"))
    return result

def selftest():
    from tempfile import TemporaryDirectory
    import types
    from pathlib import Path
    with TemporaryDirectory() as td:
        root=Path(td)
        output=root/"STEINER_MINI_WINDOWS"/"CLOUD_OUTPUTS"
        path=output/"sites"/"test-mission"
        path.mkdir(parents=True)
        file=path/"index.html"
        # deliberate issues: viewport and title missing; long unwrapped text
        source='<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>body{margin:0}</style></head><body><h1>Test page</h1><p>OK</p></body></html>'
        file.write_bytes(source.encode("utf-8"))
        conf={"workspace":root,"agent":"test"}
        before,_=inspect(output,"sites/test-mission/index.html")
        assert "missing_viewport" in before["issues"]
        assert "missing_title" in before["issues"]
        updated=inspect_generated(conf,{"path":"sites/test-mission/index.html"},True)
        assert updated["status"]=="verified",updated
        assert set(updated["fixes"])=={"Added responsive viewport","Added document title"}
        assert len(updated["screenshot_paths"])==2
        assert updated["sha256"]==sha(file.read_bytes())
        try:
            inspect_generated(conf,{"path":"../../cloud_agent_config.json"},False)
            raise AssertionError("Traversal not blocked")
        except ValueError:pass
        assert not EXTERNAL.search(file.read_text(encoding="utf-8"))
        print("PASS VISION/EXECUTOR/REPAIR: 2 screenshots, bounded fixes, browser re-check, path guard")
    return True
