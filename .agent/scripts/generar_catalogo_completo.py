import os
import re

ROOT_SKILLS = r".agent/skills"
AWESOME_SKILLS = r".agent/skills/awesome_skills"
OUTPUT_PATH = r".agent/skills/CATALOGO_HABILIDADES.md"

# Diccionario simple de traducción para términos comunes en descripciones de habilidades
TRANSLATIONS = {
    "Expert in": "Experto en",
    "Specialized skill for": "Habilidad especializada para",
    "Use when": "Úsala cuando",
    "Use this skill": "Usa esta habilidad",
    "Comprehensive": "Completo",
    "guide": "guía",
    "development": "desarrollo",
    "testing": "pruebas",
    "security": "seguridad",
    "building": "construir",
    "create": "crear",
    "analysis": "análisis",
    "design": "diseño",
    "patterns": "patrones",
    "best practices": "mejores prácticas",
    "implementation": "implementación",
    "optimization": "optimización",
    "management": "gestión",
    "architecture": "arquitectura",
    "framework": "marco de trabajo",
    "library": "biblioteca",
    "application": "aplicación",
    "integration": "integración",
    "automation": "automatización",
    "database": "base de datos",
    "interface": "interfaz",
    "principles": "principios",
    "workflow": "flujo de trabajo",
}

def translate_text(text):
    """Traducción básica basada en reemplazos para descripciones cortas."""
    if not text:
        return ""
    
    # Si ya parece español (contiene caracteres típicos o palabras clave), lo dejamos
    if any(x in text.lower() for x in ["habilidad", "para", "crear", "analizar", "expertos"]):
        return text

    translated = text
    for eng, esp in TRANSLATIONS.items():
        translated = re.sub(f"(?i){re.escape(eng)}", esp, translated)
    
    return translated

def extract_meta(skill_dir):
    """Extrae nombre y descripción del SKILL.md o README.md"""
    skill_md = os.path.join(skill_dir, "SKILL.md")
    name = os.path.basename(skill_dir)
    description = "Sin descripción disponible."
    
    if os.path.exists(skill_md):
        try:
            with open(skill_md, "r", encoding="utf-8") as f:
                content = f.read()
                # Try output description from yaml
                match = re.search(r'description:\s*"(.*?)"', content)
                if match:
                    description = match.group(1)
                else:
                    match = re.search(r'description:\s*(.*)', content)
                    if match:
                        description = match.group(1)
        except:
            pass
            
    return name, description

def generate_full_catalog():
    print(f"[*] Generando catálogo unificado en {OUTPUT_PATH}...")
    
    custom_skills = []
    awesome_skills_cats = {}

    # 1. Escanear Habilidades Personalizadas (Raíz)
    for item in os.listdir(ROOT_SKILLS):
        full_path = os.path.join(ROOT_SKILLS, item)
        if os.path.isdir(full_path) and item != "awesome_skills" and not item.startswith("."):
            name, desc = extract_meta(full_path)
            custom_skills.append({
                "name": name.replace("-", " ").title(),
                "path": item,
                "desc": desc
            })

    # 2. Escanear Awesome Skills (Nested)
    if os.path.exists(AWESOME_SKILLS):
        for root, dirs, files in os.walk(AWESOME_SKILLS):
            for d in dirs:
                # Si una carpeta tiene SKILL.md, es una habilidad
                skill_path = os.path.join(root, d)
                if "SKILL.md" in os.listdir(skill_path):
                    # Determinar categoría basada en la carpeta padre dentro de awesome_skills
                    # Path relativo desde awesome_skills
                    rel_path = os.path.relpath(skill_path, AWESOME_SKILLS)
                    parts = rel_path.split(os.sep)
                    
                    if len(parts) > 1:
                        category = parts[0].replace("-", " ").title()
                    else:
                        category = "General / Sin Categoría"

                    name, desc = extract_meta(skill_path)
                    
                    if category not in awesome_skills_cats:
                        awesome_skills_cats[category] = []
                    
                    awesome_skills_cats[category].append({
                        "name": name,
                        "path": f"awesome_skills/{rel_path}",
                        "desc": translate_text(desc)
                    })

    # 3. Escribir MD
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write("# Catálogo Maestro de Habilidades Antigravity 🌌\n\n")
        f.write(f"Este documento es la fuente de verdad de todas las capacidades instaladas en el agente.\n")
        f.write(f"Total Habilidades: {len(custom_skills) + sum(len(v) for v in awesome_skills_cats.values())}\n\n")
        
        # Seccion 1: Habilidades Core (Personalizadas)
        f.write("## ⭐ Habilidades Core (Instaladas Manualmente)\n")
        f.write("Estas son las habilidades de élite configuradas específicamente para este entorno.\n\n")
        f.write("| Habilidad | Descripción |\n")
        f.write("| :--- | :--- |\n")
        for skill in custom_skills:
            link = f"[{skill['name']}]({skill['path']}/SKILL.md)"
            f.write(f"| **{link}** | {skill['desc']} |\n")
        f.write("\n---\n")

        # Seccion 2: Awesome Skills
        f.write("## 🚀 Arsenal Awesome Skills (Importadas)\n")
        f.write("Habilidades especializadas importadas del repositorio comunitario.\n\n")
        
        # Índice
        f.write("### Índice de Categorías\n")
        for cat in sorted(awesome_skills_cats.keys()):
             f.write(f"- [{cat}](#{cat.lower().replace(' ', '-').replace('/', '').replace('  ', '-')})\n")
        f.write("\n")
        
        # Detalle por categoría
        for cat in sorted(awesome_skills_cats.keys()):
            f.write(f"### {cat}\n\n")
            f.write(f"| Habilidad | Descripción (Traducida) |\n")
            f.write(f"| :--- | :--- |\n")
            for skill in sorted(awesome_skills_cats[cat], key=lambda x: x['name']):
                link = f"[{skill['name']}](awesome_skills/{skill['path'].replace('awesome_skills/', '')}/SKILL.md)"
                f.write(f"| **{link}** | {skill['desc']} |\n")
            f.write("\n")

    print("[+] Catálogo generado exitosamente.")

if __name__ == "__main__":
    generate_full_catalog()
