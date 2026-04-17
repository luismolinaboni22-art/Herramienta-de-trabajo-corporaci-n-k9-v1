import re

# Read the new base64
with open('c:/Users/Jmolin/.gemini/antigravity/brain/61eb7e07-3e42-462e-b6f9-a178e1a5e5c4/logo.txt', 'r', encoding='utf-8', errors='ignore') as f:
    new_logo = f.read().strip()
    # If the PS script wrote weird bytes, clean it:
    new_logo = new_logo.replace('\x00', '')
    if new_logo.startswith('data:image/png;base64,'):
        # looks good
        pass

# Files to update
files = [
    'c:/Users/Jmolin/Desktop/ANALISIS DE RIESGOS/incidentes.js',
    'c:/Users/Jmolin/Desktop/ANALISIS DE RIESGOS/minutas.js',
    'c:/Users/Jmolin/Desktop/ANALISIS DE RIESGOS/bitacora.js'
]

pattern = re.compile(r"const\s+K9_LOGO_SIG\s+=\s+'[^']+';")
replacement = f"const K9_LOGO_SIG = '{new_logo}';"

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = pattern.sub(replacement, content)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print(f"Updated {filepath}")
