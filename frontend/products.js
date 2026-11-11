/* =====================================================
   ShopSphere - products.js
   All products page: search, category filter, sorting
   and "load more", all done by the Django API
   ===================================================== */

"use strict";

/* Same backend address as the other scripts. Change all of them when we deploy. */
const API_BASE = "http://127.0.0.1:8000/api";
const AUTH_KEY = "shopsphere-auth";
const CART_KEY = "shopsphere-cart-v2";
const WISHLIST_KEY = "shopsphere-wishlist";
const PAGE_SIZE = 8;
const SORTS = ["newest", "price_asc", "price_desc", "name"];

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
const resultCount = $("#resultCount");
const loadMoreBtn = $("#loadMore");
const searchForm = $("#searchForm");
const searchInput = $("#searchInput");
const sortSelect = $("#sortSelect");
const filterBox = $("#categoryFilters");
const cartCount = $("#cartCount");
const toast = $("#toast");

/* =====================================================
   1. Toast, header and menu
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

/* Signed in? Show the first letter of the name, linking to My orders */
const auth = store.get(AUTH_KEY, null);

if (auth && auth.token) {
    const initial = (auth.user.name || "A").trim().charAt(0).toUpperCase();
    $("#accountSlot").innerHTML = `
        <a href="orders.html" class="icon-btn" aria-label="My orders" title="My orders">
            <span class="account__avatar">${escapeHTML(initial)}</span>
        </a>`;
}

/* =====================================================
   2. Cart and wishlist (saved in the browser, same keys
      as the homepage, so everything stays in sync)
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

const wishlist = new Set(store.get(WISHLIST_KEY, []));

function toggleWishlist(card) {
    const id = card.dataset.id;
    const added = !wishlist.has(id);

    added ? wishlist.add(id) : wishlist.delete(id);
    $(".wishlist", card).setAttribute("aria-pressed", added);
    store.set(WISHLIST_KEY, [...wishlist]);
    showToast(added ? `${card.dataset.name} saved to wishlist` : `${card.dataset.name} removed from wishlist`);
}

/* One click listener for the whole grid (event delegation) */
grid.addEventListener("click", (event) => {
    const clear = event.target.closest("[data-clear]");
    if (clear) {
        clearFilters();
        return;
    }

    const card = event.target.closest(".product");
    if (!card) return;

    if (event.target.closest(".wishlist")) toggleWishlist(card);
    else if (event.target.closest("[data-add]")) addToCart(card);
});

updateCartCount();

/* =====================================================
   3. The product card
   ===================================================== */
function productCard(p, index) {
    const price = Number(p.price);
    const oldPrice = p.old_price ? Number(p.old_price) : 0;
    const discount = oldPrice > price ? Math.round((1 - price / oldPrice) * 100) : 0;
    const soldOut = p.stock === 0;
    const name = escapeHTML(p.name);
    const category = p.category || { name: "", slug: "" };

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
            <button class="wishlist" aria-label="Add ${name} to wishlist" aria-pressed="${wishlist.has(String(p.id))}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>
            </button>
                        ${p.image ? `<a class="product__link" href="product-detail.html?slug=${encodeURIComponent(p.slug)}" tabindex="-1" aria-hidden="true"><img src="${escapeHTML(p.image)}" alt="${name}" loading="lazy" width="400" height="400"></a>` : ""}
            <button class="btn btn--primary product__quick" data-add ${soldOut ? "disabled" : ""}>${soldOut ? "Sold out" : "Add to cart"}</button>
        </div>
        <div class="product__body">
            <p class="product__category">${escapeHTML(category.name)}</p>
            <h3 class="product__name"><a href="product-detail.html?slug=${encodeURIComponent(p.slug)}">${name}</a></h3>
            ${p.review_count ? `<p class="rating"><span class="rating__stars" aria-hidden="true">★</span> ${Number(p.rating).toFixed(1)} <span class="rating__count">(${p.review_count})</span></p>` : ""}
            <p class="product__price">
                <span class="price">${formatPrice(price)}</span>
                ${oldPrice > price ? `<s class="price price--old">${formatPrice(oldPrice)}</s>` : ""}
            </p>
        </div>
    </article>`;
}

/* =====================================================
   4. State: what the person is looking for
   ===================================================== */
const params = new URLSearchParams(location.search);

const state = {
    category: params.get("category") || "",
    search: params.get("search") || "",
    sort: SORTS.includes(params.get("sort")) ? params.get("sort") : "newest",
    page: 1,
};

let shown = 0;
let requestId = 0;

/* Keep the address bar in step, so the page can be shared or bookmarked */
function syncUrl() {
    const query = new URLSearchParams();
    if (state.category) query.set("category", state.category);
    if (state.search) query.set("search", state.search);
    if (state.sort !== "newest") query.set("sort", state.sort);
    const text = query.toString();
    history.replaceState(null, "", text ? `?${text}` : location.pathname);
}

/* =====================================================
   5. Asking the API for products
   ===================================================== */
async function loadProducts(append = false) {
    const id = ++requestId;

    if (!append) {
        state.page = 1;
        shown = 0;
        grid.innerHTML = '<p class="grid-message">Loading products…</p>';
        loadMoreBtn.hidden = true;
        resultCount.textContent = "";
    } else {
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = "Loading…";
    }

    const query = new URLSearchParams({ page: state.page, page_size: PAGE_SIZE, sort: state.sort });
    if (state.category) query.set("category", state.category);
    if (state.search) query.set("search", state.search);

    try {
        const response = await fetch(`${API_BASE}/products/?${query}`);
        if (!response.ok) throw new Error("Server answered with status " + response.status);

        const data = await response.json();
        if (id !== requestId) return; /* a newer search has started, ignore this answer */

        const products = data.results;

        if (!append) grid.innerHTML = "";

        if (!products.length && !append) {
            grid.innerHTML = `
                <p class="grid-message">
                    No products match your search.<br>
                    <button type="button" class="btn btn--outline" data-clear>Clear filters</button>
                </p>`;
            resultCount.textContent = "No products found";
            return;
        }

        grid.insertAdjacentHTML("beforeend", products.map((p, i) => productCard(p, i)).join(""));
        shown += products.length;
        resultCount.textContent = `Showing ${shown} of ${data.count} product${data.count === 1 ? "" : "s"}`;
        loadMoreBtn.hidden = !data.next;
    } catch (error) {
        if (id !== requestId) return;
        console.error("Could not load products:", error);

        if (append) {
            state.page -= 1;
            showToast("Could not load more products. Please try again.");
        } else {
            grid.innerHTML = '<p class="grid-message">Cannot reach the server. Make sure the backend is running, then refresh this page.</p>';
        }
    } finally {
        if (id === requestId) {
            loadMoreBtn.disabled = false;
            loadMoreBtn.textContent = "Load more products";
        }
    }
}

/* =====================================================
   6. Search, sort, category chips, load more
   ===================================================== */
function applyChange() {
    syncUrl();
    loadProducts();
}

/* Search while typing, after a short pause */
let searchTimer;
searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        const value = searchInput.value.trim();
        if (value === state.search) return;
        state.search = value;
        applyChange();
    }, 350);
});

searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    clearTimeout(searchTimer);
    state.search = searchInput.value.trim();
    applyChange();
});

sortSelect.addEventListener("change", () => {
    state.sort = sortSelect.value;
    applyChange();
});

function setActiveChip() {
    $$(".filter", filterBox).forEach((chip) =>
        chip.classList.toggle("is-active", chip.dataset.category === state.category)
    );
}

filterBox.addEventListener("click", (event) => {
    const chip = event.target.closest(".filter");
    if (!chip) return;
    state.category = chip.dataset.category;
    setActiveChip();
    applyChange();
});

loadMoreBtn.addEventListener("click", () => {
    state.page += 1;
    loadProducts(true);
});

function clearFilters() {
    state.category = "";
    state.search = "";
    state.sort = "newest";
    searchInput.value = "";
    sortSelect.value = "newest";
    setActiveChip();
    applyChange();
}

/* =====================================================
   7. Category chips come from the API too
   ===================================================== */
async function loadCategories() {
    try {
        const response = await fetch(`${API_BASE}/categories/`);
        if (!response.ok) throw new Error("Status " + response.status);

        const data = await response.json();
        const categories = Array.isArray(data) ? data : data.results;

        filterBox.innerHTML =
            '<button type="button" class="filter" data-category="">All</button>' +
            categories
                .map(
                    (c) =>
                        `<button type="button" class="filter" data-category="${escapeHTML(c.slug)}">${escapeHTML(c.name)}</button>`
                )
                .join("");
        setActiveChip();
    } catch (error) {
        console.error("Could not load categories:", error);
    }
}

/* =====================================================
   8. Start
   ===================================================== */
searchInput.value = state.search;
sortSelect.value = state.sort;
loadCategories();
loadProducts();