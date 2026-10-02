import glob
import subprocess
import re

print("=== 1. Checking JS Syntax on all assets ===")
assets = glob.glob('public/assets/*.js') + glob.glob('dist/assets/*.js')
errors = 0
for path in assets:
    res = subprocess.run(['node', '-c', path], capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Syntax error in {path}:\n{res.stderr}")
        errors += 1

if errors == 0:
    print("ALL ASSET JS FILES PASSED SYNTAX CHECK!")

print("\n=== 2. Checking for undeclared variable usages in app asset bundles ===")
app_assets = [p for p in assets if 'vendor' not in p]

# Common global builtins to ignore
builtins = {
  'window', 'document', 'console', 'localStorage', 'sessionStorage', 'fetch', 'Promise',
  'Date', 'Math', 'JSON', 'Array', 'Object', 'String', 'Number', 'Boolean', 'RegExp',
  'Error', 'Set', 'Map', 'Symbol', 'CustomEvent', 'Event', 'AudioContext', 'webkitAudioContext',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'location', 'navigator',
  'URL', 'URLSearchParams', 'FormData', 'Blob', 'File', 'FileReader', 'Image', 'Element',
  'HTMLElement', 'Node', 'MutationObserver', 'ResizeObserver', 'IntersectionObserver',
  'parseInt', 'parseFloat', 'isNaN', 'encodeURIComponent', 'decodeURIComponent', 'btoa', 'atob',
  'type', 'typeof', 'undefined', 'null', 'true', 'false', 'Infinity', 'NaN', 'this', 'self', 'globalThis'
}

for path in app_assets:
    with open(path) as f:
        code = f.read()

    # Find bracket lookups like `Foo[bar]` or property lookups `Foo.bar` or call `Foo(...)`
    # Check if Foo is defined or imported in code
    matches = set(re.findall(r'\b([A-Z][a-zA-Z0-9_$]*)\b\s*(?:\[|\(|\.)', code))
    for var in sorted(matches):
        if var in builtins or var in ['React', 'ReactDOM', 'L', 'L_MAP', 'Leaflet']:
            continue
        # Check if var is declared with var/let/const/function/import or destructured or in params
        decl_pattern = rf'(?:const|let|var|function|import|export|class)\s+[^;]*\b{var}\b|\b{var}\s*='
        if not re.search(decl_pattern, code):
            # Check if imported in destructured import
            destruct_pattern = rf'\{{[^}}]*\b{var}\b[^}}]*\}}'
            if not re.search(destruct_pattern, code):
                print(f"Potential missing identifier '{var}' in {path}")

print("\nAudit Complete.")
