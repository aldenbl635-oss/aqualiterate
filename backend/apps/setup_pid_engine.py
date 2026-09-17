import os

app_dir = r"c:\Users\Alden\projects\aqualerate\backend\apps\pid_engine"
os.makedirs(app_dir, exist_ok=True)

dirs_to_create = [
    "ingestion", "preprocessing", "detection", "ocr", "rules",
    "graph", "reasoning", "validation", "optimization", "provenance"
]

for d in dirs_to_create:
    os.makedirs(os.path.join(app_dir, d), exist_ok=True)
    with open(os.path.join(app_dir, d, "__init__.py"), "w") as f:
        pass

with open(os.path.join(app_dir, "__init__.py"), "w") as f:
    pass

print("Generated pid_engine directories successfully.")
