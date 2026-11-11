/* =====================================================
   ShopSphere - wishlist.js
   Shows the products saved with the heart button.
   The saved ids live in the browser; the product details
   are loaded from the API with GET /api/products/?ids=1,2,3
   ===================================================== */

"use strict";

/* Same backend address as the other scripts. Change all of them when we deploy. */
const API_BASE = "http://127.0.0.1:8000/api";
const AUTH_KEY = "shopsphere-auth";
const CART_KEY = "shopsphere-cart-v2";
const WISHLIST_KEY = "shopsphere-wishlist";

/* ---------- Helpers ---------- */
const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const formatPrice = (number) => "₹" + Number(number).toLocaleString("en-IN");

const escapeHTML = (text) =>
    String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const store = {
    get(key, fallback) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : fallback;
        } catch {
            return fallback;
        }
    },
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch {
            /* ignore */
        }
    },
};

/* ---------- Element references ---------- */
const header = $("#header");
const nav = $("#nav");
const menuToggle = $("#menuToggle");
const grid = $("#productGrid");
const countText = $("#wishCount");
const clearBtn = $("#clearWishlist");
const cartCount = $("#cartCount");
const toast = $("#toast");

/* =====================================================
   1. Toast, header, menu and account icon
   ===================================================== */
let toastTimer;

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-show"), 2400);
}

window.addEventListener(
    "scroll",
    () => header.classList.toggle("is-scrolled", window.scrollY > 10),
    { passive: true }
);

function setMenu(open) {
    nav.classList.toggle("is-open", open);
    menuToggle.classList.toggle("is-open", open);
    menuToggle.setAttribute("aria-expanded", open);
    menuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
}

menuToggle.addEventListener("click", () => setMenu(!nav.classList.contains("is-open")));
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setMenu(false);
});

const auth = store.get(AUTH_KEY, null);

if (auth && auth.token) {
    const initial = (auth.user.name || "A").trim().charAt(0).toUpperCase();
    $("#accountSlot").innerHTML = `
        <a href="orders.html" class="icon-btn" aria-label="My orders" title="My orders">
            <span class="account__avatar">${escapeHTML(initial)}</span>
        </a>`;
}

/* =====================================================
   2. Cart (same key as the other pages)
   ===================================================== */
function updateCartCount() {
    const cart = store.get(CART_KEY, []);
    cartCount.textContent = cart.reduce((sum, item) => sum + item.qty, 0);
}

function addToCart(card) {
    const id = card.dataset.id;
    const name = card.dataset.name;
    const stock = Number(card.dataset.stock);
    const cart = store.get(CART_KEY, []);
    const existing = cart.find((item) => item.id === id);

    if (existing && existing.qty >= stock) {
        showToast(`Only ${stock} of ${name} available`);
        return;
    }

    if (existing) {
        existing.qty += 1;
    } else {
        cart.push({
            id,
            name,
            price: Number(card.dataset.price),
            image: card.dataset.image,
            qty: 1,
        });
    }

    store.set(CART_KEY, cart);
    updateCartCount();

    cartCount.classList.remove("is-bump");
    void cartCount.offsetWidth;
    cartCount.classList.add("is-bump");

    showToast(`${name} added to cart`);
}

updateCartCount();

/* =====================================================
   3. The wishlist (a list of product ids in the browser)
   ===================================================== */
const wishlist = new Set(store.get(WISHLIST_KEY, []).map(String));

function saveWishlist() {
    store.set(WISHLIST_KEY, [...wishlist]);
}

function updateCount() {
    const total = $$(".product", grid).length;
    countText.textContent = total ? `${total} saved product${total === 1 ? "" : "s"}` : "";
    clearBtn.hidden = total === 0;
}

function showEmpty() {
    grid.innerHTML = `
        <p class="grid-message">
            Your wishlist is empty.<br>
            Tap the heart on any product to save it here.<br>
            <a href="products.html" class="btn btn--primary">Browse products</a>
        </p>`;
    updateCount();
}

/* =====================================================
   4. The product card (the heart is already filled in)
   ===================================================== */
function productCard(p, index) {
    const price = Number(p.price);
    const oldPrice = p.old_price ? Number(p.old_price) : 0;
    const discount = oldPrice > price ? Math.round((1 - price / oldPrice) * 100) : 0;
    const soldOut = p.stock === 0;
    const name = escapeHTML(p.name);
    const category = p.category || { name: "", slug: "" };
    const link = `product-detail.html?slug=${encodeURIComponent(p.slug)}`;

    let badge = "";
    if (soldOut) badge = '<span class="badge badge--sold">Sold out</span>';
    else if (discount) badge = `<span class="badge badge--sale">-${discount}%</span>`;

    return `
    <article class="product${soldOut ? " is-soldout" : ""}"
        data-id="${p.id}" data-name="${name}" data-price="${price}"
        data-stock="${p.stock}" data-image="${escapeHTML(p.image || "")}"
        style="animation-delay: ${index * 60}ms">
        <div class="product__media">
            ${badge}
            <button class="wishlist" aria-label="Remove ${name} from wishlist" aria-pressed="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>
            </button>
            ${p.image ? `<a class="product__link" href="${link}" tabindex="-1" aria-hidden="true"><img src="${escapeHTML(p.image)}" alt="${name}" loading="lazy" width="400" height="400"></a>` : ""}
            <button class="btn btn--primary product__quick" data-add ${soldOut ? "disabled" : ""}>${soldOut ? "Sold out" : "Add to cart"}</button>
        </div>
        <div class="product__body">
            <p class="product__category">${escapeHTML(category.name)}</p>
            <h3 class="product__name"><a href="${link}">${name}</a></h3>
            <p class="product__price">
                <span class="price">${formatPrice(price)}</span>
                ${oldPrice > price ? `<s class="price price--old">${formatPrice(oldPrice)}</s>` : ""}
            </p>
        </div>
    </article>`;
}

/* =====================================================
   5. Removing items and adding them to the cart
   ===================================================== */
function removeCard(card) {
    wishlist.delete(card.dataset.id);
    saveWishlist();
    showToast(`${card.dataset.name} removed from wishlist`);

    /* fade the card out, then take it off the page */
    card.style.animation = "none";
    void card.offsetWidth;
    card.classList.add("is-removing");

    setTimeout(() => {
        card.remove();
        if ($$(".product", grid).length === 0) showEmpty();
        else updateCount();
    }, 300);
}

grid.addEventListener("click", (event) => {
    const card = event.target.closest(".product");
    if (!card) return;

    if (event.target.closest(".wishlist")) removeCard(card);
    else if (event.target.closest("[data-add]")) addToCart(card);
});

clearBtn.addEventListener("click", () => {
    wishlist.clear();
    saveWishlist();
    showEmpty();
    showToast("Wishlist cleared");
});

/* =====================================================
   6. Load the saved products from the API
   ===================================================== */
async function loadWishlist() {
    const ids = [...wishlist];

    if (!ids.length) {
        showEmpty();
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/products/?ids=${ids.join(",")}&page_size=24`);
        if (!response.ok) throw new Error("Server answered with status " + response.status);

        const data = await response.json();
        const products = data.results;

        /* Forget saved ids whose product no longer exists */
        const found = new Set(products.map((p) => String(p.id)));
        ids.forEach((id) => {
            if (!found.has(id)) wishlist.delete(id);
        });
        saveWishlist();

        if (!products.length) {
            showEmpty();
            return;
        }

        grid.innerHTML = products.map((p, i) => productCard(p, i)).join("");
        updateCount();
    } catch (error) {
        console.error("Could not load the wishlist:", error);
        grid.innerHTML =
            '<p class="grid-message">Cannot reach the server. Make sure the backend is running, then refresh this page.</p>';
    }
}

loadWishlist();