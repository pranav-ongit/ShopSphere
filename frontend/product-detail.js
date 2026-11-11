/* =====================================================
   ShopSphere - product-detail.js
   Loads one product from GET /api/products/<slug>/
   and shows related products from the same category
   ===================================================== */

"use strict";

/* Same backend address as the other scripts. Change all of them when we deploy. */
const API_BASE = "http://127.0.0.1:8000/api";
const AUTH_KEY = "shopsphere-auth";
const CART_KEY = "shopsphere-cart-v2";
const WISHLIST_KEY = "shopsphere-wishlist";
const MAX_PER_PRODUCT = 20; /* the server allows at most 20 of one product per order */

/* ---------- Helpers ---------- */
const $ = (selector, scope = document) => scope.querySelector(selector);

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
const cartCount = $("#cartCount");
const toast = $("#toast");
const detailBox = $("#productDetail");
const breadcrumb = $("#breadcrumb");
const relatedSection = $("#related");
const relatedGrid = $("#relatedGrid");

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
   2. Cart and wishlist (same keys as the other pages)
   ===================================================== */
function updateCartCount() {
    const cart = store.get(CART_KEY, []);
    cartCount.textContent = cart.reduce((sum, item) => sum + item.qty, 0);
}

/* Returns true if the product was added */
function addToCart(product, quantity) {
    const id = String(product.id);
    const cart = store.get(CART_KEY, []);
    const existing = cart.find((item) => item.id === id);
    const alreadyInCart = existing ? existing.qty : 0;
    const limit = Math.min(product.stock, MAX_PER_PRODUCT);

    if (alreadyInCart + quantity > limit) {
        const room = Math.max(limit - alreadyInCart, 0);
        showToast(
            room === 0
                ? `You already have the maximum of ${product.name} in your cart`
                : `You can add only ${room} more of ${product.name}`
        );
        return false;
    }

    if (existing) {
        existing.qty += quantity;
    } else {
        cart.push({
            id,
            name: product.name,
            price: Number(product.price),
            image: product.image || "",
            qty: quantity,
        });
    }

    store.set(CART_KEY, cart);
    updateCartCount();

    cartCount.classList.remove("is-bump");
    void cartCount.offsetWidth;
    cartCount.classList.add("is-bump");

    showToast(`${quantity} × ${product.name} added to cart`);
    return true;
}

const wishlist = new Set(store.get(WISHLIST_KEY, []));

updateCartCount();

/* =====================================================
   3. Showing the product
   ===================================================== */
const heartIcon =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';

const tickIcon =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

function showNotFound(title, text) {
    document.title = "Product not found - ShopSphere";
    detailBox.innerHTML = `
        <section class="detail-empty">
            <h1>${escapeHTML(title)}</h1>
            <p>${escapeHTML(text)}</p>
            <a href="products.html" class="btn btn--primary">Browse all products</a>
        </section>`;
}

function renderProduct(p) {
    const price = Number(p.price);
    const oldPrice = p.old_price ? Number(p.old_price) : 0;
    const discount = oldPrice > price ? Math.round((1 - price / oldPrice) * 100) : 0;
    const soldOut = p.stock === 0;
    const maxQty = Math.min(p.stock, MAX_PER_PRODUCT);
    const category = p.category || { name: "", slug: "" };

    let stockClass = "";
    let stockText = "In stock";
    if (soldOut) {
        stockClass = "pd__stock--out";
        stockText = "Out of stock";
    } else if (p.stock <= 5) {
        stockClass = "pd__stock--low";
        stockText = `Only ${p.stock} left in stock`;
    }

    const description = p.description
        ? escapeHTML(p.description).replace(/\n/g, "<br>")
        : "More details about this product are coming soon.";

    const image = p.image
        ? `<img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}" width="720" height="720">`
        : "";

    detailBox.innerHTML = `
    <div class="pd">
        <div class="pd__media${soldOut ? " is-soldout" : ""}">${image}</div>

        <div class="pd__info">
            <a class="pd__category" href="products.html?category=${encodeURIComponent(category.slug)}">${escapeHTML(category.name)}</a>
            <h1 class="pd__name">${escapeHTML(p.name)}</h1>

            <p class="pd__price">
                <span class="pd__now">${formatPrice(price)}</span>
                ${oldPrice > price ? `<s class="pd__old">${formatPrice(oldPrice)}</s>` : ""}
                ${discount ? `<span class="pd__discount">${discount}% off</span>` : ""}
            </p>

            <p class="pd__stock ${stockClass}">${stockText}</p>
            <p class="pd__desc">${description}</p>

            <div class="pd__buy">
                <div class="qty" role="group" aria-label="Quantity">
                    <button type="button" data-act="minus" aria-label="Decrease quantity" disabled>−</button>
                    <output id="qtyValue" aria-live="polite">1</output>
                    <button type="button" data-act="plus" aria-label="Increase quantity" ${maxQty <= 1 ? "disabled" : ""}>+</button>
                </div>
                <button type="button" class="btn btn--primary" data-act="add" ${soldOut ? "disabled" : ""}>
                    ${soldOut ? "Out of stock" : "Add to cart"}
                </button>
            </div>

            <button type="button" class="btn btn--outline btn--block" data-act="buy" ${soldOut ? "disabled" : ""}>Buy now</button>

            <button type="button" class="pd__wish" data-act="wish" aria-pressed="${wishlist.has(String(p.id))}">
                ${heartIcon} <span>Save to wishlist</span>
            </button>

            <ul class="pd__perks">
                <li>${tickIcon} Free delivery on orders above ₹999</li>
                <li>${tickIcon} Easy 7-day returns</li>
                <li>${tickIcon} Secure checkout</li>
            </ul>
        </div>
    </div>`;

    /* Page title and breadcrumb */
    document.title = `${p.name} - ShopSphere`;
    breadcrumb.innerHTML = `
        <a href="index.html">Home</a><span aria-hidden="true">/</span>
        <a href="products.html">Products</a><span aria-hidden="true">/</span>
        <a href="products.html?category=${encodeURIComponent(category.slug)}">${escapeHTML(category.name)}</a><span aria-hidden="true">/</span>
        <span aria-current="page">${escapeHTML(p.name)}</span>`;

    /* Buttons: one listener for the whole product block */
    let quantity = 1;
    const qtyValue = $("#qtyValue");
    const minus = $('[data-act="minus"]', detailBox);
    const plus = $('[data-act="plus"]', detailBox);

    function setQuantity(value) {
        quantity = value;
        qtyValue.textContent = quantity;
        minus.disabled = quantity <= 1;
        plus.disabled = quantity >= maxQty;
    }

    detailBox.addEventListener("click", (event) => {
        const button = event.target.closest("[data-act]");
        if (!button) return;

        switch (button.dataset.act) {
            case "minus":
                setQuantity(quantity - 1);
                break;
            case "plus":
                setQuantity(quantity + 1);
                break;
            case "add":
                addToCart(p, quantity);
                break;
            case "buy":
                if (addToCart(p, quantity)) location.href = "checkout.html";
                break;
            case "wish": {
                const id = String(p.id);
                const added = !wishlist.has(id);
                added ? wishlist.add(id) : wishlist.delete(id);
                button.setAttribute("aria-pressed", added);
                store.set(WISHLIST_KEY, [...wishlist]);
                showToast(added ? `${p.name} saved to wishlist` : `${p.name} removed from wishlist`);
                break;
            }
        }
    });
}

/* =====================================================
   4. Related products (same category, not this one)
   ===================================================== */
function relatedCard(p, index) {
    const price = Number(p.price);
    const oldPrice = p.old_price ? Number(p.old_price) : 0;
    const link = `product-detail.html?slug=${encodeURIComponent(p.slug)}`;
    const name = escapeHTML(p.name);

    return `
    <article class="product" style="animation-delay: ${index * 70}ms">
        <div class="product__media">
            <a class="product__link" href="${link}" tabindex="-1" aria-hidden="true">
                ${p.image ? `<img src="${escapeHTML(p.image)}" alt="" loading="lazy" width="400" height="400">` : ""}
            </a>
        </div>
        <div class="product__body">
            <p class="product__category">${escapeHTML(p.category ? p.category.name : "")}</p>
            <h3 class="product__name"><a href="${link}">${name}</a></h3>
            <p class="product__price">
                <span class="price">${formatPrice(price)}</span>
                ${oldPrice > price ? `<s class="price price--old">${formatPrice(oldPrice)}</s>` : ""}
            </p>
        </div>
    </article>`;
}

async function loadRelated(product) {
    if (!product.category) return;

    try {
        const response = await fetch(
            `${API_BASE}/products/?category=${encodeURIComponent(product.category.slug)}&page_size=6`
        );
        if (!response.ok) return;

        const data = await response.json();
        const others = data.results.filter((item) => item.id !== product.id).slice(0, 4);
        if (!others.length) return;

        relatedGrid.innerHTML = others.map(relatedCard).join("");
        relatedSection.hidden = false;
    } catch (error) {
        console.error("Could not load related products:", error);
    }
}

/* =====================================================
   5. Start: read the slug from the address and load
   ===================================================== */
async function loadProduct() {
    const slug = new URLSearchParams(location.search).get("slug");

    if (!slug) {
        showNotFound("No product selected", "Choose a product from our shop to see its details.");
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/products/${encodeURIComponent(slug)}/`);

        if (response.status === 404) {
            showNotFound("Product not found", "This product may have been removed or the link is wrong.");
            return;
        }
        if (!response.ok) throw new Error("Server answered with status " + response.status);

        const product = await response.json();
        renderProduct(product);
        loadRelated(product);
    } catch (error) {
        console.error("Could not load the product:", error);
        detailBox.innerHTML =
            '<p class="grid-message">Cannot reach the server. Make sure the backend is running, then refresh this page.</p>';
    }
}

loadProduct();