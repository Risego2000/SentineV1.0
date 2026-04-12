import urllib.request
import xml.etree.ElementTree as ET
import sys

def fetch_trends(geo="ES"):
    """
    Obtiene las tendencias diarias de Google Trends vía RSS con headers mejorados.
    """
    url = f"https://trends.google.com/trends/trendingsearches/daily/rss?geo={geo}"
    
    try:
        print(f"[*] Consultando tendencias para la region: {geo}...")
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0'
        }
        req = urllib.request.Request(url, headers=headers)
        
        with urllib.request.urlopen(req) as response:
            xml_data = response.read()
            
        root = ET.fromstring(xml_data)
        items = root.findall('.//item')
        
        trends = []
        for i, item in enumerate(items[:10]):
            title = item.find('title').text
            # Manejo de namespaces en XML
            traffic = item.find('{https://trends.google.com/trends/trendingsearches/daily}approx_traffic')
            traffic_text = traffic.text if traffic is not None else "N/A"
            description = item.find('description').text if item.find('description') is not None else ""
            
            trends.append({
                "rank": i + 1,
                "topic": title,
                "traffic": traffic_text,
                "summary": description
            })
            
        return trends

    except Exception as e:
        print(f"Error al obtener tendencias: {e}")
        return []

if __name__ == "__main__":
    geo = sys.argv[1] if len(sys.argv) > 1 else "ES"
    trends = fetch_trends(geo)
    
    if not trends:
        print("No se pudieron encontrar tendencias en este momento.")
    else:
        print("\n=== TOP 10 TENDENCIAS DEL DIA ===\n")
        for t in trends:
            print(f"{t['rank']}. {t['topic']} ({t['traffic']} busquedas)")
            if t['summary']:
                print(f"   Contexto: {t['summary']}\n")
