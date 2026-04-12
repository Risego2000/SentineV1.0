import json
import sys

def generate_slide_structure(title, sections):
    """
    Genera un JSON con la estructura básica de una presentación.
    """
    deck = {
        "title": title,
        "slides": [
            {
                "type": "title",
                "title": title,
                "subtitle": "Generado automáticamente por Antigravity Design"
            }
        ]
    }
    
    for section in sections:
        deck["slides"].append({
            "type": "content",
            "title": section["title"],
            "bullet_points": section["points"],
            "visual_suggestion": section.get("visual", "Imagen profesional relacionada")
        })
        
    deck["slides"].append({
        "type": "closing",
        "title": "¡Gracias!",
        "subtitle": "Preguntas y contacto"
    })
    
    return json.dumps(deck, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python analizar_contenido.py [titulo] [secciones_en_json]")
        sys.exit(1)
        
    # Este script es una utilidad para que el agente organice la data
    # En una implementación real, aquí podría integrarse un parser de markdown
    print(generate_slide_structure("Ejemplo de Presentación", [
        {"title": "Introducción", "points": ["Punto 1", "Punto 2"]},
        {"title": "Desarrollo", "points": ["Punto A", "Punto B"]}
    ]))
