import os
import argparse
import sys
import re

def create_skill(name, description):
    # Validar nombre: solo letras, números y espacios/guiones
    if not re.match(r'^[a-zA-Z0-9\s-]+$', name):
        print(f"Error: El nombre '{name}' contiene caracteres no permitidos. Usa solo letras, números y espacios.")
        sys.exit(1)

    # Ensure name is slug-friendly
    slug_name = name.lower().strip().replace(" ", "-")
    base_path = os.path.join(".agent", "skills", slug_name)
    
    if os.path.exists(base_path):
        print(f"Error: La habilidad '{slug_name}' ya existe en {base_path}")
        sys.exit(1)
    
    # Create directory structure
    print(f"[*] Creando estructura para la habilidad: {slug_name}...")
    os.makedirs(base_path, exist_ok=True)
    os.makedirs(os.path.join(base_path, "scripts"), exist_ok=True)
    os.makedirs(os.path.join(base_path, "examples"), exist_ok=True)
    os.makedirs(os.path.join(base_path, "resources"), exist_ok=True)
    
    # Create SKILL.md
    skill_md_path = os.path.join(base_path, "SKILL.md")
    content = f"""---
description: "{description}"
---

# {name}

> 🧠 **Gobernanza:** Esta habilidad opera bajo los estándares definidos en [Experto Antigravity](../experto-antigravity/SKILL.md).

## Cuándo usar esta habilidad

- [Define aquí los escenarios o disparadores para esta habilidad]

## Cómo usarla

1. [Paso 1]
2. [Paso 2]

## Mejores Prácticas

- [Consejo 1]
- [Consejo 2]
"""
    
    # Create README.md for the human user
    readme_path = os.path.join(base_path, "README.md")
    readme_content = f"""# Habilidad: {name}

{description}

## Estructura
- `SKILL.md`: Instrucciones principales para el agente AI Antigravity.
- `scripts/`: Herramientas y automatizaciones.
- `examples/`: Casos de uso y ejemplos de referencia.
- `resources/`: Material de apoyo adicional.

---
*Creado automáticamente por Maestro Creador de Habilidades.*
"""

    with open(skill_md_path, "w", encoding="utf-8") as f:
        f.write(content)
    
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write(readme_content)
    
    print(f"\n[+] ¡Éxito! Habilidad '{name}' configurada correctamente.")
    print(f"    - Directorio: {base_path}")
    print(f"    - Skill Config: {skill_md_path}")
    print(f"    - README: {readme_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Automatiza la creación de nuevas habilidades para Antigravity.")
    parser.add_argument("name", help="Nombre de la nueva habilidad (ej: 'Analizador de Código')")
    parser.add_argument("description", help="Breve descripción de la habilidad para el descubrimiento del agente.")
    
    args = parser.parse_args()
    create_skill(args.name, args.description)
