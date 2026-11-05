import json
import re
import unicodedata
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).parent
RAW_PATH = ROOT / "data" / "raw" / "Chat de WhatsApp con 💩.txt"
OUTPUT_PATH = ROOT / "data" / "staging" / "conversaciones_caca.json"

MESSAGE_PATTERN = re.compile(
    r"^(?P<day>\d{1,2})/(?P<month>\d{1,2})/(?P<year>\d{2}), "
    r"(?P<hour>\d{1,2}):(?P<minute>\d{2}) - (?P<author>[^:]+): (?P<text>.*)$"
)
NAME_MAP = {
    "Elena Domingo": "Elena",
    "Sol Erasmus": "Sol",
    "Lucía Erasmus": "Lucía",
}

TOPIC_PATTERNS = {
    "Reglacaca": [r"reglacaca", r"regla\s+caca"],
    "Resacaca": [r"resacaca", r"resac[oó]n", r"resaca"],
    "Conversación sobre caca": [
        r"cag\w*",
        r"caca\w*",
        r"mierda\w*",
        r"diarrea\w*",
        r"\bculo\b",
        r"\bba[nñ]o\b",
    ],
}


def normalize(text):
    decomposed = unicodedata.normalize("NFKD", text.lower())
    return "".join(char for char in decomposed if not unicodedata.combining(char))


def classify(text):
    normalized = normalize(text)
    matches = []
    for topic, patterns in TOPIC_PATTERNS.items():
        if any(re.search(pattern, normalized) for pattern in patterns):
            matches.append(topic)
    if not matches:
        return None, []
    if "Reglacaca" in matches:
        primary = "Reglacaca"
    elif "Resacaca" in matches:
        primary = "Resacaca"
    else:
        primary = "Conversación sobre caca"
    return primary, matches


def parse_messages():
    messages = []
    current = None
    for line in RAW_PATH.read_text(encoding="utf-8-sig").splitlines():
        match = MESSAGE_PATTERN.match(line)
        if match:
            if current:
                messages.append(current)
            current = {
                "day": int(match.group("day")),
                "month": int(match.group("month")),
                "year": 2000 + int(match.group("year")),
                "hour": int(match.group("hour")),
                "minute": int(match.group("minute")),
                "author": match.group("author"),
                "text": match.group("text"),
            }
        elif current and line.strip():
            current["text"] += "\n" + line
    if current:
        messages.append(current)
    return messages


def main():
    topics = []
    for message in parse_messages():
        topic, related_topics = classify(message["text"])
        if not topic:
            continue
        timestamp = datetime(
            message["year"], message["month"], message["day"], message["hour"], message["minute"]
        )
        topics.append({
            "timestamp": timestamp.isoformat(timespec="minutes"),
            "year": message["year"],
            "person": NAME_MAP.get(message["author"], message["author"]),
            "topic": topic,
            "related_topics": related_topics,
            "text": message["text"],
        })
    topics.sort(key=lambda item: item["timestamp"], reverse=True)
    OUTPUT_PATH.write_text(json.dumps(topics, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {len(topics)} topic messages at {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
