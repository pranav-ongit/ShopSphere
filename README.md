# ShopSphere

A full-stack e-commerce website built step by step to learn how the frontend, backend, database and API fit together.

**Stack:** HTML, CSS and JavaScript on the frontend. Python, Django and Django REST Framework on the backend. SQLite for development.

## Features

**Customers**
- Browse products, search, filter by category, sort by price or name, and load more
- Product pages with images, stock status, quantity picker, reviews and related products
- Register and log in with token authentication
- Cart, checkout with delivery details, and order history
- Wishlist and star ratings with written reviews (with a "verified purchase" badge)

**Store owner (Django admin)**
- Add, edit and delete products and categories
- See orders and update their status (pending, paid, shipped, delivered, cancelled)
- Moderate reviews

**Safety built in**
- Prices and totals are always calculated on the server, never taken from the browser
- Orders check stock and are saved all-or-nothing in one database transaction
- Passwords are hashed, and customers can only see their own orders

## Project structure

```
ShopSphere/
├── frontend/     HTML, CSS and JavaScript pages
└── backend/      Django project (config) and the store app
```

## Run it on your computer

You need Python 3.11 or newer and Git.

**1. Backend**

```
cd backend
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

The API runs at `http://127.0.0.1:8000/api/` and the admin panel at `http://127.0.0.1:8000/admin`. Add categories and products in the admin panel first.

**2. Frontend**

Serve the `frontend` folder on port 5500, for example with the VS Code Live Server extension, or:

```
python -m http.server 5500 --directory frontend
```

Then open `http://127.0.0.1:5500`.

**3. Settings**

Copy `backend/.env.example` to `backend/.env` and fill in your values. The `.env` file is never uploaded to GitHub.

## API overview

| Method | Address | What it does |
|---|---|---|
| GET | `/api/products/` | List products. Supports `search`, `category`, `featured`, `ids`, `sort`, `page` and `page_size` |
| GET | `/api/products/<slug>/` | One product with its average rating |
| GET | `/api/categories/` | List categories |
| GET, POST | `/api/products/<slug>/reviews/` | Read reviews, or write one (sign-in required) |
| POST | `/api/auth/register/` | Create an account and get a token |
| POST | `/api/auth/login/` | Log in and get a token |
| GET | `/api/auth/me/` | The signed-in user |
| GET, POST | `/api/orders/` | List your orders, or place an order |
| GET | `/api/orders/<id>/` | One of your orders |

## Roadmap

- [x] Frontend pages
- [x] Products API, accounts, orders, reviews
- [ ] AI shopping assistant
- [ ] Deployment