/* =====================================================
   ShopSphere - product-detail.js
   One product page: details, quantity, cart, wishlist,
   reviews (read and write) and related products
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
    remove(key) {
        try {
            localStorage.removeItem(key);
        } catch {
            /* ignore */
        }
    },
};

/* Collects every text message out of an API error answer */
function flatten(value) {
    if (typeof value === "string") return [value];
    if (Array.isArray(value)) return value.flatMap(flatten);
    if (value && typeof value === "object") return Object.values(value).flatMap(flatten);
    return [];
}

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
const reviewsSection = $("#reviews");
const reviewList = $("#reviewList");
const reviewFormBox = $("#reviewFormBox");
const loadMoreReviews = $("#loadMoreReviews");

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

/* Five stars, filled up to the rating (works for 4.3 as well as 4) */
function starsHTML(rating) {
    return `<span class="stars" style="--rating:${Number(rating)}" role="img" aria-label="${Number(rating)} out of 5 stars">★★★★★</span>`;
}

function ratingSummary(p) {
    if (!p.review_count) {
        return '<a href="#reviews" class="pd__rating">No reviews yet</a>';
    }
    const word = p.review_count === 1 ? "review" : "reviews";
    return `<a href="#reviews" class="pd__rating">
        ${starsHTML(p.rating)} <strong>${Number(p.rating).toFixed(1)}</strong> <span>(${p.review_count} ${word})</span>
    </a>`;
}

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
            <div id="ratingSummary">${ratingSummary(p)}</div>

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
   4. Reviews: reading, writing and the form
   ===================================================== */
let currentSlug = "";
let reviewPage = 1;

function reviewItem(r, index) {
    const date = new Date(r.created_at).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });

    const comment = r.comment
        ? `<p class="review-item__text">${escapeHTML(r.comment).replace(/\n/g, "<br>")}</p>`
        : "";

    return `
    <li class="review-item" style="animation-delay: ${index * 60}ms">
        <div class="review-item__head">
            ${starsHTML(r.rating)}
            <span class="review-item__name">${escapeHTML(r.name)}</span>
            ${r.verified ? `<span class="verified">${tickIcon.replace('width="20" height="20"', 'width="12" height="12"')} Verified purchase</span>` : ""}
            <span class="review-item__date">${date}</span>
        </div>
        ${comment}
    </li>`;
}

async function loadReviews(append = false) {
    if (!append) reviewPage = 1;

    try {
        const response = await fetch(
            `${API_BASE}/products/${encodeURIComponent(currentSlug)}/reviews/?page=${reviewPage}&page_size=5`
        );
        if (!response.ok) throw new Error("Server answered with status " + response.status);

        const data = await response.json();

        if (!append) reviewList.innerHTML = "";

        if (!data.results.length && !append) {
            reviewList.innerHTML = '<li class="review-empty">No reviews yet. Be the first to share your thoughts.</li>';
            loadMoreReviews.hidden = true;
            return;
        }

        reviewList.insertAdjacentHTML("beforeend", data.results.map(reviewItem).join(""));
        loadMoreReviews.hidden = !data.next;
    } catch (error) {
        console.error("Could not load reviews:", error);
        if (append) {
            reviewPage -= 1;
            showToast("Could not load more reviews. Please try again.");
        } else {
            reviewList.innerHTML = '<li class="review-empty">Could not load reviews right now.</li>';
        }
    }
}

loadMoreReviews.addEventListener("click", () => {
    reviewPage += 1;
    loadReviews(true);
});

/* After a new review, refresh the average rating under the title */
async function refreshSummary() {
    try {
        const response = await fetch(`${API_BASE}/products/${encodeURIComponent(currentSlug)}/`);
        if (!response.ok) return;
        const product = await response.json();
        const box = $("#ratingSummary");
        if (box) box.innerHTML = ratingSummary(product);
    } catch {
        /* the old summary stays */
    }
}

function renderReviewForm() {
    if (!auth || !auth.token) {
        reviewFormBox.innerHTML = `
            <h3>Write a review</h3>
            <p>Sign in to share your rating and thoughts about this product.</p>
            <a href="login.html" class="btn btn--primary btn--block">Sign in to review</a>`;
        return;
    }

    reviewFormBox.innerHTML = `
        <h3>Write a review</h3>
        <form class="review-form" id="reviewForm" novalidate>
            <fieldset class="star-input">
                <legend>Your rating</legend>
                <div class="star-input__row">
                    <input type="radio" name="rating" id="star5" value="5"><label for="star5" title="5 stars">★<span class="visually-hidden">5 stars</span></label>
                    <input type="radio" name="rating" id="star4" value="4"><label for="star4" title="4 stars">★<span class="visually-hidden">4 stars</span></label>
                    <input type="radio" name="rating" id="star3" value="3"><label for="star3" title="3 stars">★<span class="visually-hidden">3 stars</span></label>
                    <input type="radio" name="rating" id="star2" value="2"><label for="star2" title="2 stars">★<span class="visually-hidden">2 stars</span></label>
                    <input type="radio" name="rating" id="star1" value="1"><label for="star1" title="1 star">★<span class="visually-hidden">1 star</span></label>
                </div>
            </fieldset>

            <label class="field-label" for="reviewComment">Your review (optional)</label>
            <textarea id="reviewComment" name="comment" maxlength="1000" placeholder="What did you like or dislike?"></textarea>

            <button type="submit" class="btn btn--primary btn--block">Submit review</button>
            <p class="form-message" id="reviewMessage" role="status" aria-live="polite"></p>
            <p class="review-form__hint">You can change your review later by submitting this form again.</p>
        </form>`;
}

function setReviewMessage(text, type) {
    const box = $("#reviewMessage");
    if (!box) return;
    box.textContent = text;
    box.classList.toggle("is-error", type === "error");
    box.classList.toggle("is-success", type === "success");
}

reviewFormBox.addEventListener("submit", async (event) => {
    if (!event.target.matches("#reviewForm")) return;
    event.preventDefault();

    const form = event.target;
    const rating = form.rating.value;
    const comment = form.comment.value.trim();

    if (!rating) {
        setReviewMessage("Please choose a star rating.", "error");
        return;
    }

    const button = $('button[type="submit"]', form);
    button.disabled = true;
    button.textContent = "Saving…";
    setReviewMessage("", "");

    try {
        const response = await fetch(`${API_BASE}/products/${encodeURIComponent(currentSlug)}/reviews/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Token ${auth.token}`,
            },
            body: JSON.stringify({ rating: Number(rating), comment }),
        });

        const result = await response.json().catch(() => null);

        if (response.status === 401) {
            store.remove(AUTH_KEY);
            setReviewMessage("Your sign-in has expired. Please sign in again.", "error");
            return;
        }

        if (!response.ok) {
            setReviewMessage(flatten(result).join(" ") || "Something went wrong. Please try again.", "error");
            return;
        }

        setReviewMessage(response.status === 201 ? "Thank you! Your review has been added." : "Your review has been updated.", "success");
        await loadReviews();
        refreshSummary();
    } catch (error) {
        console.error("Review request failed:", error);
        setReviewMessage("Cannot reach the server. Is the backend running?", "error");
    } finally {
        button.disabled = false;
        button.textContent = "Submit review";
    }
});

function initReviews(slug) {
    currentSlug = slug;
    reviewsSection.hidden = false;
    renderReviewForm();
    loadReviews();
}

/* =====================================================
   5. Related products (same category, not this one)
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
            ${p.review_count ? `<p class="rating"><span class="rating__stars" aria-hidden="true">★</span> ${Number(p.rating).toFixed(1)} <span class="rating__count">(${p.review_count})</span></p>` : ""}
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
   6. Start: read the slug from the address and load
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
        initReviews(slug);
        loadRelated(product);
    } catch (error) {
        console.error("Could not load the product:", error);
        detailBox.innerHTML =
            '<p class="grid-message">Cannot reach the server. Make sure the backend is running, then refresh this page.</p>';
    }
}

loadProduct();