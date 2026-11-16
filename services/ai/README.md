# AI service (Python)

FastAPI service for ultrasound plane classification, biometry landmarking and
(later) the LLM tutor. It isn't part of the pnpm workspace.

```bash
cd services/ai
python3 -m venv .venv && source .venv/bin/activate
pip install -e '.[dev]'
pytest
uvicorn app.main:app --reload --port 8000
```

`app/labels.py` refuses to load if any model label could identify fetal sex (PC-PNDT).
