import json
import os
import sys

INDEX_PATH = r".agent/temp_awesome_skills/skills_index.json"
OUTPUT_PATH = r".agent/skills/awesome_skills/CATALOGO_HABILIDADES.md"

def generate_catalog():
    if not os.path.exists(INDEX_PATH):
        print(f"Error: No se encuentra el índice en {INDEX_PATH}")
        return

    with open(INDEX_PATH, 'r', encoding='utf-8') as f:
        skills = json.load(f)

    # Agrupar skills por categoría (basado en el path)
    categories = {}
    
    for skill in skills:
        path_parts = skill['path'].split('/')
        # skills/category/skill-name or skills/skill-name
        if len(path_parts) > 2:
            category = path_parts[1].replace('-', ' ').title()
        else:
            category = "General"
            
        if category not in categories:
            categories[category] = []
            
        categories[category].append(skill)

    # Generar Markdown
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        f.write("# Catálogo de Habilidades Antigravity 🌌\n\n")
        f.write("Este documento detalla todas las habilidades disponibles en su arsenal, importadas de `antigravity-awesome-skills`.\n\n")
        
        # Índice de Categorías
        f.write("## Índice de Categorías\n")
        sorted_categories = sorted(categories.keys())
        for cat in sorted_categories:
            f.write(f"- [{cat}](#{cat.lower().replace(' ', '-')})\n")
        f.write("\n---\n")
        
        # Detalle
        for cat in sorted_categories:
            f.write(f"\n## {cat}\n\n")
            f.write(f"| Habilidad | Descripción |\n")
            f.write(f"| :--- | :--- |\n")
            
            for skill in sorted(categories[cat], key=lambda x: x['name']):
                name = skill['name']
                desc = skill['description'].replace('\n', ' ').strip()
                # Create link to the skill folder if possible (assuming standard structure)
                skill_folder = skill['path'].replace('skills/', '')
                
                f.write(f"| **[{name}]({skill_folder}/README.md)** | {desc} |\n")

    print(f"Catálogo generado éxitosamente en: {OUTPUT_PATH}")

if __name__ == "__main__":
    generate_catalog()
