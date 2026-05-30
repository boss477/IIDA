import os
import runpy
from pathlib import Path

ROOT = Path(__file__).resolve().parent

os.chdir(ROOT)
os.environ["PORT"] = "5180"

runpy.run_path(str(ROOT / "app.py"), run_name="__main__")
