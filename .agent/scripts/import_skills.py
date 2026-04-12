import os
import shutil
import pathlib

SOURCE_DIR = r".agent/temp_awesome_skills/skills"
DEST_DIR = r".agent/skills/awesome_skills"

def translate_headers(content):
    """
    Traduce las cabeceras estándar de los archivos SKILL.md.
    """
    replacements = {
        "## When to use this skill": "## Cuándo usar esta habilidad",
        "## When to use": "## Cuándo usar esta habilidad",
        "## How to use": "## Cómo usarla",
        "## Best Practices": "## Mejores Prácticas",
        "## Best practices": "## Mejores Prácticas",
        "## Description": "## Descripción",
        "# Description": "# Descripción"
    }
    
    for eng, esp in replacements.items():
        content = content.replace(eng, esp)
        
    return content

def import_skills():
    print(f"[*] Iniciando importación desde {SOURCE_DIR} a {DEST_DIR}...")
    
    if not os.path.exists(DEST_DIR):
        os.makedirs(DEST_DIR)
        
    # Walk through the source directory
    count = 0
    for root, dirs, files in os.walk(SOURCE_DIR):
        for file in files:
            if file == "SKILL.md":
                source_path = os.path.join(root, file)
                
                # Determine relative path to maintain structure
                rel_path = os.path.relpath(root, SOURCE_DIR)
                dest_folder = os.path.join(DEST_DIR, rel_path)
                
                # Create destination folder
                os.makedirs(dest_folder, exist_ok=True)
                
                # Read content
                try:
                    with open(source_path, "r", encoding="utf-8") as f:
                        content = f.read()
                    
                    # Translate Headers
                    translated_content = translate_headers(content)
                    
                    # Write to destination
                    dest_path = os.path.join(dest_folder, "SKILL.md")
                    with open(dest_path, "w", encoding="utf-8") as f:
                        f.write(translated_content)
                        
                    # Copy other files in the same directory (scripts, etc)
                    for other_file in os.listdir(root):
                        if other_file != "SKILL.md":
                            src_other = os.path.join(root, other_file)
                            dst_other = os.path.join(dest_folder, other_file)
                            if os.path.isfile(src_other):
                                shutil.copy2(src_other, dst_other)
                            elif os.path.isdir(src_other):
                                if not os.path.exists(dst_other):
                                    shutil.copytree(src_other, dst_other)
                                    
                    count += 1
                    if count % 50 == 0:
                        print(f"Procesadas {count} habilidades...")
                        
                except Exception as e:
                    print(f"Error procesando {source_path}: {e}")

    print(f"\n[+] Importación completada. Total habilidades: {count}")

if __name__ == "__main__":
    import_skills()
