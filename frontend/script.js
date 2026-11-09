/* =====================================================
   ShopSphere - script.js
   Handles: header, menu, search, cart, filters,
   wishlist, countdown, newsletter, scroll helpers
   ===================================================== */

"use strict";

/* ---------- Helpers ---------- */
const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const formatPrice = (number) => "₹" + number.toLocaleString("en-IN");

const escapeHTML = (text) =>
    text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

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

/* Close the menu after choosing a link */
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

    /* Reset filter buttons so the user sees search results, not a filter */
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
   7. Wishlist hearts
   ===================================================== */
const wishlist = new Set(store.get("shopsphere-wishlist", []));

$$(".product").forEach((product) => {
    const button = $(".wishlist", product);
    const id = product.dataset.id;
    const name = $(".product__name", product).textContent;

    button.setAttribute("aria-pressed", wishlist.has(id));

    button.addEventListener("click", () => {
        const added = !wishlist.has(id);
        added ? wishlist.add(id) : wishlist.delete(id);
        button.setAttribute("aria-pressed", added);
        store.set("shopsphere-wishlist", [...wishlist]);
        showToast(added ? `${name} saved to wishlist` : `${name} removed from wishlist`);
    });
});

/* =====================================================
   8. Shopping cart
   ===================================================== */
let cart = store.get("shopsphere-cart", []);
let lastFocused = null;

function saveCart() {
    store.set("shopsphere-cart", cart);
}

function renderCart() {
    /* Items */
    if (cart.length === 0) {
        cartItemsBox.innerHTML = '<p class="cart-empty">Your cart is empty. Add a product to get started.</p>';
    } else {
        cartItemsBox.innerHTML = cart
            .map(
                (item) => `
            <div class="cart-item" data-id="${item.id}">
                <img class="cart-item__img" src="${escapeHTML(item.image)}" alt="" width="72" height="72">
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

    /* Totals */
    const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
    const totalPrice = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    cartCount.textContent = totalQty;
    cartTotal.textContent = formatPrice(totalPrice);
}

function addToCart(product) {
    const id = product.dataset.id;
    const name = $(".product__name", product).textContent.trim();
    const price = parseInt($(".price", product).textContent.replace(/[^\d]/g, ""), 10);
    const image = $(".product__media img", product).getAttribute("src");

    const existing = cart.find((item) => item.id === id);
    if (existing) {
        existing.qty += 1;
    } else {
        cart.push({ id, name, price, image, qty: 1 });
    }

    saveCart();
    renderCart();

    /* Little bounce on the cart badge */
    cartCount.classList.remove("is-bump");
    void cartCount.offsetWidth; /* restart the animation */
    cartCount.classList.add("is-bump");

    showToast(`${name} added to cart`);
}

/* Add to cart buttons */
$$("[data-add]").forEach((button) =>
    button.addEventListener("click", () => addToCart(button.closest(".product")))
);

/* Quantity and remove buttons (event delegation) */
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

/* Open and close the drawer */
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

/* Escape key closes the drawer, search and menu */
document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (cartDrawer.classList.contains("is-open")) setCart(false);
    if (!searchPanel.hidden) setSearch(false);
    if (nav.classList.contains("is-open")) setMenu(false);
});

renderCart();

/* =====================================================
   9. Sale countdown
   ===================================================== */
const DAY = 24 * 60 * 60 * 1000;
let saleEnd = store.get("shopsphere-sale-end", 0);

/* Start a 5-day sale the first time, and restart it when it ends */
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
   10. Newsletter form
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
   11. Hero numbers count up once
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