import json
import os
import urllib.request

ITEMS_URL = "https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.txt"
HARVESTABLES_URL = "https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/harvestables.json"
MOBS_URL = "https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/mobs.json"

# Folder, w którym leży ten skrypt, np. laioneye/myscripts
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Katalog główny projektu, np. laioneye
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)

# Główne resources
RESOURCES_DIR = os.path.join(PROJECT_ROOT, "src", "laioneye", "resources")

# Folder na surowe JSON-y z ao-bin-dumps
AO_BIN_DUMPS_JSON_DIR = os.path.join(RESOURCES_DIR, "ao-bin-dumps-json")

ITEMS_BY_ID_PATH = os.path.join(RESOURCES_DIR, "items_by_id.json")
ITEMS_BY_UNIQUE_NAME_PATH = os.path.join(RESOURCES_DIR, "items_by_unique_name.json")
HARVESTABLES_PATH = os.path.join(AO_BIN_DUMPS_JSON_DIR, "harvestables.json")
MOBS_PATH = os.path.join(AO_BIN_DUMPS_JSON_DIR, "mobs.json")


def fetch_text(url):
    with urllib.request.urlopen(url, timeout=30) as response:
        return response.read().decode("utf-8")


def fetch_json(url):
    text = fetch_text(url)
    return json.loads(text)


def load_items_from_text(text):
    items = []

    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue

        parts = line.split(":", 2)
        if len(parts) == 3:
            item_id = parts[0].strip()
            item_code = parts[1].strip()
            item_name = parts[2].strip()
            items.append((item_id, item_code, item_name))

    return items


def build_items_by_id(items):
    result = {
        "0": {
            "id": "0",
            "unique_name": "UNIQUE_HIDEOUT",
            "name": "Hideout Construction Kit"
        }
    }

    for item_id, unique_name, name in items:
        result[item_id] = {
            "id": item_id,
            "unique_name": unique_name,
            "name": name,
        }

    return result


def build_items_by_unique_name(items):
    result = {}

    for item_id, unique_name, name in items:
        result[unique_name] = {
            "id": item_id,
            "unique_name": unique_name,
            "name": name,
        }

    return result


def remove_file_if_exists(path):
    if os.path.exists(path):
        os.remove(path)
        print(f"Removed old file: {path}")


def write_json(path, data):
    with open(path, "w", encoding="utf-8") as json_file:
        json.dump(data, json_file, indent=4, ensure_ascii=False)
    print(f"Created: {path}")


if __name__ == "__main__":
    try:
        print("=== FULL AO DATA UPDATE START ===")
        print(f"SCRIPT_DIR: {SCRIPT_DIR}")
        print(f"PROJECT_ROOT: {PROJECT_ROOT}")
        print(f"RESOURCES_DIR: {RESOURCES_DIR}")
        print(f"AO_BIN_DUMPS_JSON_DIR: {AO_BIN_DUMPS_JSON_DIR}")

        # Create directories if missing
        os.makedirs(RESOURCES_DIR, exist_ok=True)
        os.makedirs(AO_BIN_DUMPS_JSON_DIR, exist_ok=True)

        # 1. Download and process items.txt
        print(f"Downloading items from: {ITEMS_URL}")
        items_text = fetch_text(ITEMS_URL)
        items = load_items_from_text(items_text)

        if not items:
            raise ValueError("Downloaded items list is empty")

        items_by_id = build_items_by_id(items)
        items_by_unique_name = build_items_by_unique_name(items)

        # 2. Download raw JSON files
        print(f"Downloading harvestables from: {HARVESTABLES_URL}")
        harvestables_data = fetch_json(HARVESTABLES_URL)

        print(f"Downloading mobs from: {MOBS_URL}")
        mobs_data = fetch_json(MOBS_URL)

        # 3. Remove old files if they exist
        remove_file_if_exists(ITEMS_BY_ID_PATH)
        remove_file_if_exists(ITEMS_BY_UNIQUE_NAME_PATH)
        remove_file_if_exists(HARVESTABLES_PATH)
        remove_file_if_exists(MOBS_PATH)

        # 4. Write new files
        write_json(ITEMS_BY_ID_PATH, items_by_id)
        write_json(ITEMS_BY_UNIQUE_NAME_PATH, items_by_unique_name)
        write_json(HARVESTABLES_PATH, harvestables_data)
        write_json(MOBS_PATH, mobs_data)

        print("=== FULL AO DATA UPDATE DONE ===")

    except Exception as e:
        print(f"Error: {e}")
        raise