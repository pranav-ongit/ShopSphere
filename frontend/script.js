/* =====================================================
   ShopSphere - script.js  (Day 9: connected to Django API)
   Handles: header, menu, search, products from API, cart,
   filters, wishlist, countdown, newsletter, scroll helpers
   ===================================================== */

"use strict";

/* The address of our Django backend.
   When we deploy, we will change only this one line. */
const API_BASE = "http://127.0.0.1:8000/api";

/* ---------- Helpers ---------- */
const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const formatPrice = (number) => "₹" + number.toLocaleString("en-IN");

const escapeHTML = (text) =>
    String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* Safe wrappers around localStorage (it can fail in private mode) */
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
const searchToggle = $("#searchToggle");
const searchPanel = $("#searchPanel");
const searchInput = $("#searchInput");
const searchForm = $(".search-form");
const cartToggle = $("#cartToggle");
const cartClose = $("#cartClose");
const cartDrawer = $("#cartDrawer");
const cartItemsBox = $("#cartItems");
const cartCount = $("#cartCount");
const cartTotal = $("#cartTotal");
const overlay = $("#overlay");
const toast = $("#toast");
const toTop = $("#toTop");
const productGrid = $("#productGrid");

/* =====================================================
   1. Toast message
   ===================================================== */
let toastTimer;

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-show"), 2400);
}

/* =====================================================
   2. Header: shadow on scroll and back-to-top button
   ===================================================== */
function onScroll() {
    header.classList.toggle("is-scrolled", window.scrollY > 10);
    toTop.classList.toggle("is-visible", window.scrollY > 600);
}

window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

/* =====================================================
   3. Mobile menu
   ===================================================== */
function setMenu(open) {
    nav.classList.toggle("is-open", open);
    menuToggle.classList.toggle("is-open", open);
    menuToggle.setAttribute("aria-expanded", open);
    menuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
}

menuToggle.addEventListener("click", () => setMenu(!nav.classList.contains("is-open")));

$$(".nav__link").forEach((link) => link.addEventListener("click", () => setMenu(false)));

/* =====================================================
   4. Highlight the current section in the navigation
   ===================================================== */
const navLinks = $$(".nav__link");
const sectionIds = navLinks.map((link) => link.getAttribute("href").slice(1));

const sectionObserver = new IntersectionObserver(
    (entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            navLinks.forEach((link) =>
                link.classList.toggle("is-active", link.getAttribute("href") === "#" + entry.target.id)
            );
        });
    },
    { rootMargin: "-40% 0px -55% 0px" }
);

sectionIds.forEach((id) => {
    const section = document.getElementById(id);
    if (section) sectionObserver.observe(section);
});

/* =====================================================
   5. Search panel and product search
   ===================================================== */
function setSearch(open) {
    searchPanel.hidden = !open;
    searchToggle.setAttribute("aria-expanded", open);
    if (open) searchInput.focus();
}

searchToggle.addEventListener("click", () => setSearch(searchPanel.hidden));

searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const term = searchInput.value.trim().toLowerCase();
    if (!term) return;

    let matches = 0;
    $$(".product", productGrid).forEach((product) => {
        const text = (product.dataset.category + " " + $(".product__name", product).textContent).toLowerCase();
        const show = text.includes(term);
        product.classList.toggle("is-hidden", !show);
        if (show) matches++;
    });

    $$(".filter").forEach((btn) => btn.classList.remove("is-active"));

    setSearch(false);
    $("#products").scrollIntoView({ behavior: "smooth" });
    showToast(matches ? `${matches} product${matches > 1 ? "s" : ""} found` : `No products found for "${searchInput.value.trim()}"`);
});

/* =====================================================
   6. Category filters
   ===================================================== */
function applyFilter(category) {
    $$(".filter").forEach((btn) => btn.classList.toggle("is-active", btn.dataset.filter === category));
    $$(".product", productGrid).forEach((product) => {
        const show = category === "all" || product.dataset.category === category;
        product.classList.toggle("is-hidden", !show);
    });
}

$$(".filter").forEach((btn) => btn.addEventListener("click", () => applyFilter(btn.dataset.filter)));

/* Clicking a category card filters the products below */
$$(".category").forEach((card) => card.addEventListener("click", () => applyFilter(card.dataset.category)));

/* =====================================================
   7. Wishlist
   ===================================================== */
const wishlist = new Set(store.get("shopsphere-wishlist", []));

/* Show the correct heart state on whatever cards are on the page */
function syncWishlistButtons() {
    $$(".product", productGrid).forEach((product) => {
        $(".wishlist", product).setAttribute("aria-pressed", wishlist.has(product.dataset.id));
    });
}

function toggleWishlist(product) {
    const id = product.dataset.id;
    const name = $(".product__name", product).textContent;
    const added = !wishlist.has(id);

    added ? wishlist.add(id) : wishlist.delete(id);
    $(".wishlist", product).setAttribute("aria-pressed", added);
    store.set("shopsphere-wishlist", [...wishlist]);
    showToast(added ? `${name} saved to wishlist` : `${name} removed from wishlist`);
}

/* =====================================================
   8. Shopping cart
   ===================================================== */
/* The "-v2" in the name starts a fresh cart, because product ids now
   come from the database instead of from the HTML. */
let cart = store.get("shopsphere-cart-v2", []);
let lastFocused = null;

function saveCart() {
    store.set("shopsphere-cart-v2", cart);
}

function renderCart() {
    if (cart.length === 0) {
        cartItemsBox.innerHTML = '<p class="cart-empty">Your cart is empty. Add a product to get started.</p>';
    } else {
        cartItemsBox.innerHTML = cart
            .map(
                (item) => `
            <div class="cart-item" data-id="${item.id}">
                ${item.image ? `<img class="cart-item__img" src="${escapeHTML(item.image)}" alt="" width="72" height="72">` : '<span class="cart-item__img"></span>'}
                <div class="cart-item__info">
                    <h3 class="cart-item__name">${escapeHTML(item.name)}</h3>
                    <p class="cart-item__price">${formatPrice(item.price)}</p>
                    <div class="cart-item__qty">
                        <button type="button" data-action="decrease" aria-label="Decrease quantity of ${escapeHTML(item.name)}">−</button>
                        <span aria-live="polite">${item.qty}</span>
                        <button type="button" data-action="increase" aria-label="Increase quantity of ${escapeHTML(item.name)}">+</button>
                    </div>
                </div>
                <button type="button" class="cart-item__remove" data-action="remove" aria-label="Remove ${escapeHTML(item.name)}">Remove</button>
            </div>`
            )
            .join("");
    }

    const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
    const totalPrice = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    cartCount.textContent = totalQty;
    cartTotal.textContent = formatPrice(totalPrice);
}

function addToCart(product) {
    const id = product.dataset.id;
    const name = $(".product__name", product).textContent.trim();
    const price = parseInt($(".price", product).textContent.replace(/[^\d]/g, ""), 10);
    const img = $(".product__media img", product);
    const image = img ? img.getAttribute("src") : "";

    const existing = cart.find((item) => item.id === id);
    if (existing) {
        existing.qty += 1;
    } else {
        cart.push({ id, name, price, image, qty: 1 });
    }

    saveCart();
    renderCart();

    cartCount.classList.remove("is-bump");
    void cartCount.offsetWidth;
    cartCount.classList.add("is-bump");

    showToast(`${name} added to cart`);
}

/* One click listener for the whole product grid (event delegation).
   It keeps working even when the cards are created by JavaScript. */
productGrid.addEventListener("click", (event) => {
    const product = event.target.closest(".product");
    if (!product) return;

    if (event.target.closest(".wishlist")) {
        toggleWishlist(product);
    } else if (event.target.closest("[data-add]")) {
        addToCart(product);
    }
});

/* Quantity and remove buttons inside the cart */
cartItemsBox.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const row = button.closest(".cart-item");
    const item = cart.find((i) => i.id === row.dataset.id);
    if (!item) return;

    const action = button.dataset.action;
    if (action === "increase") item.qty += 1;
    if (action === "decrease") item.qty -= 1;
    if (action === "remove" || item.qty <= 0) cart = cart.filter((i) => i.id !== item.id);

    saveCart();
    renderCart();
});

function setCart(open) {
    cartDrawer.classList.toggle("is-open", open);
    cartDrawer.setAttribute("aria-hidden", !open);
    cartToggle.setAttribute("aria-expanded", open);
    overlay.hidden = !open;
    document.body.style.overflow = open ? "hidden" : "";

    if (open) {
        lastFocused = document.activeElement;
        cartClose.focus();
    } else if (lastFocused) {
        lastFocused.focus();
    }
}

cartToggle.addEventListener("click", () => setCart(true));
cartClose.addEventListener("click", () => setCart(false));
overlay.addEventListener("click", () => setCart(false));

document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (cartDrawer.classList.contains("is-open")) setCart(false);
    if (!searchPanel.hidden) setSearch(false);
    if (nav.classList.contains("is-open")) setMenu(false);
});

renderCart();

/* =====================================================
   9. Products from the Django API  (the new part)
   ===================================================== */

/* Turns one product object from the API into the HTML of one card */
function productCard(p) {
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
    <article class="product${soldOut ? " is-soldout" : ""}" data-category="${escapeHTML(category.slug)}" data-id="${p.id}">
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
            <p class="product__price">
                <span class="price">${formatPrice(price)}</span>
                ${oldPrice > price ? `<s class="price price--old">${formatPrice(oldPrice)}</s>` : ""}
            </p>
        </div>
    </article>`;
}

/* Asks the backend for the featured products and shows them */
async function loadProducts() {
    /* Keep the sample cards from index.html as a backup */
    const backupHTML = productGrid.innerHTML;
    productGrid.innerHTML = '<p class="grid-message">Loading products…</p>';

    try {
        const response = await fetch(`${API_BASE}/products/?featured=true`);
        if (!response.ok) throw new Error("Server answered with status " + response.status);

        const data = await response.json();
        const products = Array.isArray(data) ? data : data.results;

        if (!products.length) {
            productGrid.innerHTML = '<p class="grid-message">No products yet. Add some in the admin panel.</p>';
            return;
        }

        productGrid.innerHTML = products.map(productCard).join("");
        console.log(`Loaded ${products.length} products from the API`, products);
    } catch (error) {
        console.error("Could not load products from the API:", error);
        productGrid.innerHTML = backupHTML;
        syncWishlistButtons();
        showToast("Server not reachable. Showing sample products.");
    }
}

loadProducts();

/* =====================================================
   10. Sale countdown
   ===================================================== */
const DAY = 24 * 60 * 60 * 1000;
let saleEnd = store.get("shopsphere-sale-end", 0);

if (!saleEnd || saleEnd < Date.now()) {
    saleEnd = Date.now() + 5 * DAY;
    store.set("shopsphere-sale-end", saleEnd);
}

const cdParts = {
    days: $("#cdDays"),
    hours: $("#cdHours"),
    mins: $("#cdMins"),
    secs: $("#cdSecs"),
};

const pad = (n) => String(n).padStart(2, "0");

function tickCountdown() {
    let left = Math.max(0, saleEnd - Date.now());

    if (left === 0) {
        saleEnd = Date.now() + 5 * DAY;
        store.set("shopsphere-sale-end", saleEnd);
        left = saleEnd - Date.now();
    }

    cdParts.days.textContent = pad(Math.floor(left / DAY));
    cdParts.hours.textContent = pad(Math.floor((left % DAY) / 3600000));
    cdParts.mins.textContent = pad(Math.floor((left % 3600000) / 60000));
    cdParts.secs.textContent = pad(Math.floor((left % 60000) / 1000));
}

tickCountdown();
setInterval(tickCountdown, 1000);

/* =====================================================
   11. Newsletter form
   ===================================================== */
const newsletterForm = $("#newsletterForm");
const newsletterEmail = $("#newsletterEmail");
const newsletterMessage = $("#newsletterMessage");

newsletterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = newsletterEmail.value.trim();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

    newsletterMessage.classList.toggle("is-error", !valid);
    newsletterMessage.classList.toggle("is-success", valid);

    if (!valid) {
        newsletterMessage.textContent = "Enter a valid email address, like name@example.com.";
        newsletterEmail.focus();
        return;
    }

    newsletterMessage.textContent = "Thanks for subscribing. Check your inbox for your 10% code.";
    newsletterForm.reset();
});

/* =====================================================
   12. Hero numbers count up once
   ===================================================== */
$$("[data-count]").forEach((el) => {
    const target = Number(el.dataset.count);
    const duration = 1600;
    const start = performance.now();

    function step(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(target * eased).toLocaleString("en-IN") + (progress === 1 ? "+" : "");
        if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
});

/* =====================================================
   13. Header account menu (shows the signed-in user)
   ===================================================== */
const AUTH_KEY = "shopsphere-auth";

function getAuth() {
    try {
        return JSON.parse(localStorage.getItem(AUTH_KEY));
    } catch {
        return null;
    }
}

function clearAuth() {
    try {
        localStorage.removeItem(AUTH_KEY);
    } catch {
        /* ignore */
    }
}

function setupAccount() {
    const accountLink = $('.header__actions a[href="login.html"]');
    const auth = getAuth();
    if (!accountLink || !auth || !auth.token) return;

    const name = auth.user.name || "Account";
    const initial = name.trim().charAt(0).toUpperCase();

    const wrap = document.createElement("div");
    wrap.className = "account";
    wrap.innerHTML = `
        <button type="button" class="account__btn" id="accountBtn" aria-haspopup="true" aria-expanded="false" aria-label="Account menu for ${escapeHTML(name)}">
            <span class="account__avatar">${escapeHTML(initial)}</span>
        </button>
              <div class="account__menu" id="accountMenu" hidden>
            <p class="account__name">${escapeHTML(name)}</p>
            <p class="account__email">${escapeHTML(auth.user.email)}</p>
            <a class="account__link" href="orders.html">My orders</a> 
            <a class="account__link" href="wishlist.html">Wishlist</a>
            <button type="button" class="account__logout" id="accountLogout">Log out</button>
        </div>`;
    accountLink.replaceWith(wrap);

    const button = $("#accountBtn");
    const menu = $("#accountMenu");

    function setMenuOpen(open) {
        menu.hidden = !open;
        button.setAttribute("aria-expanded", open);
    }

    button.addEventListener("click", () => setMenuOpen(menu.hidden));

    /* Click outside, or press Escape, to close the menu */
    document.addEventListener("click", (event) => {
        if (!wrap.contains(event.target)) setMenuOpen(false);
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") setMenuOpen(false);
    });

    $("#accountLogout").addEventListener("click", () => {
        clearAuth();
        location.reload();
    });

    /* Ask the server if the token is still valid. If it is not, sign out. */
    fetch(`${API_BASE}/auth/me/`, { headers: { Authorization: `Token ${auth.token}` } })
        .then((response) => {
            if (response.status === 401) {
                clearAuth();
                location.reload();
            }
        })
        .catch(() => {
            /* server not running: keep the saved login for now */
        });
}

setupAccount();