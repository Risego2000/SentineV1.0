import os
import re

ROOT_SKILLS = r".agent/skills"
AWESOME_SKILLS = r".agent/skills/awesome_skills"
WORKFLOWS_DIR = r".agent/workflows"

def extract_meta(skill_dir):
    """Extrae descripción del SKILL.md o usa una genérica."""
    skill_md = os.path.join(skill_dir, "SKILL.md")
    description = f"Ejecutar la habilidad {os.path.basename(skill_dir)}"
    
    if os.path.exists(skill_md):
        try:
            with open(skill_md, "r", encoding="utf-8") as f:
                content = f.read()
                # Try output description from yaml frontmatter
                match = re.search(r'description:\s*"(.*?)"', content)
                if match:
                    description = match.group(1)
                else:
                    match = re.search(r'description:\s*(.*)', content)
                    if match:
                        description = match.group(1).strip()
        except:
            pass
            
    # Limpiar descripción para YAML (evitar saltos de línea extraños)
    description = description.replace('\n', ' ').replace('"', "'").strip()
    return description

def create_workflow_file(skill_name, description, skill_path):
    # Asegurar nombre de comando válido (solo minúsculas y guiones)
    command_name = skill_name.lower().replace(" ", "-")
    filename = os.path.join(WORKFLOWS_DIR, f"{command_name}.md")
    
    # Path relativo para instruccion
    relative_skill_path = skill_path.replace("\\", "/")
    
    content = f"""---
description: {description}
---

1. El usuario invoca el comando `/{command_name}`.
2. El agente activa la habilidad ubicada en `{relative_skill_path}`.
3. El agente lee el archivo `SKILL.md` de dicha habilidad para entender sus capacidades y modo de uso.
4. El agente procede a asistir al usuario siguiendo las instrucciones de la habilidad.
"""
    
    try:
        with open(filename, "w", encoding="utf-8") as f:
            f.write(content)
        return True
    except Exception as e:
        print(f"Error escribiendo {filename}: {e}")
        return False

def generate_workflows():
    print(f"[*] Iniciando generación masiva de workflows en {WORKFLOWS_DIR}...")
    
    if not os.path.exists(WORKFLOWS_DIR):
        os.makedirs(WORKFLOWS_DIR)
        
    count = 0

    # 1. Habilidades Core
    for item in os.listdir(ROOT_SKILLS):
        full_path = os.path.join(ROOT_SKILLS, item)
        if os.path.isdir(full_path) and item != "awesome_skills" and not item.startswith("."):
            desc = extract_meta(full_path)
            # Path relativo desde la raiz del workspace, aprox
            rel_path = f".agent/skills/{item}"
            if create_workflow_file(item, desc, rel_path):
                count += 1

    # 2. Awesome Skills
    if os.path.exists(AWESOME_SKILLS):
        for root, dirs, files in os.walk(AWESOME_SKILLS):
            for d in dirs:
                skill_path = os.path.join(root, d)
                if "SKILL.md" in os.listdir(skill_path):
                    desc = extract_meta(skill_path)
                    
                    # Calcular path relativo limpio
                    # root es .agent/skills/awesome_skills/categoria
                    # skill es .agent/skills/awesome_skills/categoria/nombre
                    full_rel = os.path.relpath(skill_path, os.getcwd())
                    # Ajuste si estamos running desde root
                    if full_rel.startswith(".."): # Si el cwd es diferente
                         full_rel = f".agent/skills/awesome_skills/{os.path.relpath(skill_path, AWESOME_SKILLS)}"
                    
                    # Simplificación: Usamos el path relativo hardcodeado correcto
                    rel_to_awesome = os.path.relpath(skill_path, AWESOME_SKILLS)
                    final_path = f".agent/skills/awesome_skills/{rel_to_awesome}"
                    
                    if create_workflow_file(d, desc, final_path):
                        count += 1

    print(f"[+] Generación completada. {count} workflows creados.")

if __name__ == "__main__":
    generate_workflows()
