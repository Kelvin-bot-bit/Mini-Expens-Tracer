# Mini Expense Tracker

React + Vite frontend, Flask REST API, PostgreSQL, SQLAlchemy, Flask-Migrate and JWT authentication.

## Features
- Register and log in
- JWT-protected API routes
- Per-user transactions (income/expense)
- Create, edit, delete and filter transactions
- Dashboard totals and monthly expense chart
- PostgreSQL locally and in production
- Database migrations with Flask-Migrate

## Prerequisites
- Python 3.10+
- Node.js 20+
- PostgreSQL 14+
- Git

## 1. PostgreSQL setup (Kali/Linux)
Make sure PostgreSQL is running:
```bash
sudo systemctl start postgresql
sudo -u postgres psql
```
Inside `psql`, create a dedicated local database user and database (replace the password):
```sql
CREATE USER expense_user WITH PASSWORD 'replace-with-a-strong-local-password';
CREATE DATABASE expense_tracker OWNER expense_user;
\q
```

If you already have a database/user with these names, don't recreate them; choose different names or reuse your existing setup.

## 2. Configure the backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```
Edit `backend/.env` and set `DATABASE_URL`. URL-encode special characters in the password (for example `@` becomes `%40`).

Example:
```env
DATABASE_URL=postgresql+psycopg://expense_user:YOUR_URL_ENCODED_PASSWORD@localhost:5432/expense_tracker
JWT_SECRET_KEY=replace-with-a-long-random-secret
FRONTEND_ORIGINS=http://localhost:5173
FLASK_DEBUG=1
```

Generate a secret with:
```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Initialize migrations once:
```bash
flask --app run.py db init
flask --app run.py db migrate -m "Initial schema"
flask --app run.py db upgrade
```
`db init` is only for the first setup and creates `migrations/`. If that folder already exists, skip `db init`. Review generated migrations before applying them.

Start Flask:
```bash
python run.py
```
API base URL: `http://127.0.0.1:5000/api`

## 3. Configure the frontend
In another terminal:
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```
Open the Vite URL shown in the terminal, normally `http://localhost:5173`.

## 4. Run locally
- Backend: `http://127.0.0.1:5000`
- Health check: `http://127.0.0.1:5000/api/health`
- Frontend: `http://localhost:5173`

## 5. GitHub
From the project root:
```bash
git init
git add .
git status
```
Check that `.env` files are not staged. Then:
```bash
git commit -m "Build mini expense tracker"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/mini-expense-tracker.git
git push -u origin main
```

## 6. Deploy PostgreSQL and Flask on Render
1. Push the project to GitHub.
2. In Render, create a managed PostgreSQL database.
3. Copy its **internal** database URL for use by a Render web service in the same region. If using an external URL from outside Render, use the external URL instead.
4. Create a Render Web Service from the same repository.
5. Set **Root Directory** to `backend`.
6. Build command:
   ```bash
   pip install -r requirements.txt
   ```
7. Start command:
   ```bash
   flask --app run.py db upgrade && gunicorn -w 2 -b 0.0.0.0:$PORT run:app
   ```
8. Add environment variables:
   - `DATABASE_URL` = Render PostgreSQL URL
   - `JWT_SECRET_KEY` = a newly generated strong secret
   - `FRONTEND_ORIGINS` = your deployed Vercel URL, e.g. `https://your-app.vercel.app`
   - `FLASK_DEBUG` = `0`
9. Deploy and test `https://YOUR-RENDER-SERVICE.onrender.com/api/health`.

Important: commit the `migrations/` directory. The startup command applies existing migrations; don't use `db init` in production and don't delete/recreate a production database to fix a migration issue.

## 7. Deploy React on Vercel
1. Import the same GitHub repository into Vercel.
2. Set **Root Directory** to `frontend`.
3. Framework preset: Vite.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Add environment variable:
   - `VITE_API_URL` = `https://YOUR-RENDER-SERVICE.onrender.com/api`
7. Deploy.
8. Add the exact Vercel production URL to Render's `FRONTEND_ORIGINS` variable and redeploy the backend if needed.

## 8. Production verification checklist
- Register a new account.
- Log out and log in again.
- Create, edit and delete a transaction.
- Check that one user cannot see another user's transactions.
- Refresh the page and verify data persists.
- Check `/api/health`.
- Confirm no `.env` file or secret is in GitHub.
- Confirm migrations run successfully before Gunicorn starts.

## API routes
- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/transactions`
- `POST /api/transactions`
- `GET /api/transactions/<id>`
- `PUT /api/transactions/<id>`
- `DELETE /api/transactions/<id>`
- `GET /api/dashboard/summary`
## Troubleshooting: JWT 401/422 errors

If protected requests return `401` or `422` after changing the JWT secret or updating the backend, clear the old browser session and sign in again. In the browser console at the frontend origin, run:

```js
localStorage.removeItem('expense_token');
localStorage.removeItem('expense_user');
location.reload();
```

The API now returns consistent `401` JSON responses for missing, invalid, and expired JWTs. Do not share access tokens in screenshots or chat.

