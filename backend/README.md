# MedRelease backend

FastAPI service. See the root `README.md` for full setup and deployment
instructions. Quick reference:

```bash
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

- API docs: http://localhost:8000/docs
- Run migrations manually: `alembic upgrade head`
- Re-seed sample data: `python -m app.seed` (no-ops if data already exists)
