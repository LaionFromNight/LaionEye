import json
import os
import re
import urllib.request

OPERATION_CODES_URL = (
    "https://raw.githubusercontent.com/Triky313/AlbionOnline-StatisticsAnalysis/"
    "bc4140880e25052d3359a529957a214556a06451/"
    "src/StatisticsAnalysisTool/Network/OperationCodes.cs"
)

EVENT_CODES_URL = (
    "https://raw.githubusercontent.com/Triky313/AlbionOnline-StatisticsAnalysis/"
    "bc4140880e25052d3359a529957a214556a06451/"
    "src/StatisticsAnalysisTool/Network/EventCodes.cs"
)

# Folder, w którym leży ten skrypt, np. laioneye/myscripts
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Katalog główny projektu, np. laioneye
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)

# Folder docelowy na wygenerowane pliki
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "src", "laioneye", "resources")

OPERATION_JSON_PATH = os.path.join(OUTPUT_DIR, "operation_code.json")
OPERATION_TXT_PATH = os.path.join(OUTPUT_DIR, "operation_code_string.txt")
EVENT_JSON_PATH = os.path.join(OUTPUT_DIR, "event_code.json")
EVENT_TXT_PATH = os.path.join(OUTPUT_DIR, "event_code_strings.txt")


def fetch_text(url: str) -> str:
    with urllib.request.urlopen(url, timeout=30) as response:
        return response.read().decode("utf-8")


def remove_block_comments(text: str) -> str:
    return re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)


def remove_line_comments(line: str) -> str:
    return line.split("//", 1)[0]


def to_snake_case(name: str) -> str:
    # Better handling for acronyms like GvG, HQ, PvP, etc.
    name = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", name)
    name = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1_\2", name)
    return name.upper()


def extract_enum_block(source: str, enum_name: str) -> str:
    """
    Extracts the content inside:
        public enum <enum_name>
        {
            ...
        }
    """
    pattern = rf"\benum\s+{re.escape(enum_name)}\s*\{{"
    match = re.search(pattern, source)
    if not match:
        raise ValueError(f"Enum '{enum_name}' not found")

    start_index = match.end()
    brace_depth = 1
    i = start_index

    while i < len(source):
        if source[i] == "{":
            brace_depth += 1
        elif source[i] == "}":
            brace_depth -= 1
            if brace_depth == 0:
                return source[start_index:i]
        i += 1

    raise ValueError(f"Could not parse enum block for '{enum_name}'")


def parse_enum_members(enum_block: str) -> list[tuple[int, str]]:
    """
    Parses enum members from a C# enum block.
    Supports:
      Name,
      Name = 21,
    Ignores attributes/comments/empty lines.
    """
    enum_block = remove_block_comments(enum_block)
    lines = enum_block.splitlines()

    members: list[tuple[int, str]] = []
    current_value = -1

    for raw_line in lines:
        line = remove_line_comments(raw_line).strip()

        if not line:
            continue

        # Remove trailing commas and surrounding whitespace
        line = line.rstrip(",").strip()

        if not line:
            continue

        # Ignore attributes or anything weird above enum values
        if line.startswith("[") and line.endswith("]"):
            continue

        # Match: Name = 21
        explicit_match = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(-?\d+)$", line)
        if explicit_match:
            name = explicit_match.group(1)
            value = int(explicit_match.group(2))
            members.append((value, name))
            current_value = value
            continue

        # Match: Name
        simple_match = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)$", line)
        if simple_match:
            name = simple_match.group(1)
            current_value += 1
            members.append((current_value, name))
            continue

        # Ignore lines that are not enum entries
        # If you prefer strict mode, replace with:
        # raise ValueError(f"Unrecognized enum line: {raw_line}")
        continue

    if not members:
        raise ValueError("No enum members parsed")

    return members


def build_outputs(members: list[tuple[int, str]]) -> tuple[dict[str, str], str]:
    json_output: dict[str, str] = {}
    text_lines: list[str] = []

    for value, name in members:
        snake_name = to_snake_case(name)
        json_output[str(value)] = snake_name
        text_lines.append(f"{snake_name} = {value}")

    return json_output, "\n".join(text_lines)


def write_json(path: str, data: dict) -> None:
    if os.path.exists(path):
        os.remove(path)
        print(f"Removed old file: {path}")

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

    print(f"Created: {path}")


def write_text(path: str, content: str) -> None:
    if os.path.exists(path):
        os.remove(path)
        print(f"Removed old file: {path}")

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"Created: {path}")


def process_enum_from_url(
    url: str,
    enum_name: str,
    json_output_path: str,
    text_output_path: str,
) -> None:
    print(f"Downloading: {url}")
    source = fetch_text(url)

    enum_block = extract_enum_block(source, enum_name)
    members = parse_enum_members(enum_block)
    json_output, text_output = build_outputs(members)

    write_json(json_output_path, json_output)
    write_text(text_output_path, text_output)

    print(f"Processed enum '{enum_name}' with {len(members)} entries")


if __name__ == "__main__":
    try:
        print("=== CODE ENUM UPDATE START ===")
        print(f"SCRIPT_DIR: {SCRIPT_DIR}")
        print(f"PROJECT_ROOT: {PROJECT_ROOT}")
        print(f"OUTPUT_DIR: {OUTPUT_DIR}")

        os.makedirs(OUTPUT_DIR, exist_ok=True)

        process_enum_from_url(
            url=OPERATION_CODES_URL,
            enum_name="OperationCodes",
            json_output_path=OPERATION_JSON_PATH,
            text_output_path=OPERATION_TXT_PATH,
        )

        process_enum_from_url(
            url=EVENT_CODES_URL,
            enum_name="EventCodes",
            json_output_path=EVENT_JSON_PATH,
            text_output_path=EVENT_TXT_PATH,
        )

        print("=== CODE ENUM UPDATE DONE ===")

    except Exception as e:
        print(f"Error: {e}")
        raise