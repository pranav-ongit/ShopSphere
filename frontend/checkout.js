/* =====================================================
   ShopSphere - checkout.js
   Reads the cart, collects the delivery address and
   places the order through the Django API
   ===================================================== */

"use strict";

/* Same backend address as the other scripts. Change all of them when we deploy. */
const API_BASE = "http://127.0.0.1:8000/api";
const AUTH_KEY = "shopsphere-auth";
const CART_KEY = "shopsphere-cart-v2";

const $ = (selector, scope = document) => scope.querySelector(selector);

const formatPrice = (number) => "₹" + Number(number).toLocaleString("en-IN");

const escapeHTML = (text) =>
    String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- Reading what the browser has saved ---------- */
function readStorage(key) {
    try {
        return JSON.parse(localStorage.getItem(key));
    } catch {
        return null;
    }
}

function removeStorage(key) {
    try {
        localStorage.removeItem(key);
    } catch {
        /* ignore */
    }
}

const auth = readStorage(AUTH_KEY);
const cart = readStorage(CART_KEY) || [];

/* ---------- Element references ---------- */
const checkoutView = $("#checkoutView");
const stateBox = $("#stateBox");
const confirmation = $("#confirmation");
const form = $("#checkoutForm");
const message = $("#checkoutMessage");
const placeOrderBtn = $("#placeOrderBtn");

/* =====================================================
   1. Which screen should we show?
   ===================================================== */
function showState(title, text, buttonText, buttonHref) {
    checkoutView.hidden = true;
    confirmation.hidden = true;
    stateBox.hidden = false;
    $("#stateTitle").textContent = title;
    $("#stateText").textContent = text;
    const button = $("#stateButton");
    button.textContent = buttonText;
    button.href = buttonHref;
}

function summaryRow(item) {
    const thumb = item.image
        ? `<img src="${escapeHTML(item.image)}" alt="" width="56" height="56">`
        : '<span class="summary__thumb"></span>';

    return `
        <li class="summary__item">
            ${thumb}
            <div>
                <p class="summary__name">${escapeHTML(item.name)}</p>
                <p class="summary__qty">Quantity: ${item.qty}</p>
            </div>
            <p class="summary__price">${formatPrice(item.price * item.qty)}</p>
        </li>`;
}

if (!auth || !auth.token) {
    showState(
        "Sign in to check out",
        "Please sign in or create an account so we can save your order.",
        "Sign in",
        "login.html"
    );
} else if (cart.length === 0) {
    showState(
        "Your cart is empty",
        "Add a few products to your cart, then come back here to check out.",
        "Browse products",
        "index.html#products"
    );
} else {
    checkoutView.hidden = false;
    $("#summaryItems").innerHTML = cart.map(summaryRow).join("");
    $("#summaryTotal").textContent = formatPrice(cart.reduce((sum, item) => sum + item.price * item.qty, 0));
    form.full_name.value = auth.user.name || "";
}

/* =====================================================
   2. Placing the order
   ===================================================== */
function setMessage(text, type) {
    message.textContent = text;
    message.classList.toggle("is-error", type === "error");
    message.classList.toggle("is-success", type === "success");
}

/* Collects every text message out of the API's error answer */
function flatten(value) {
    if (typeof value === "string") return [value];
    if (Array.isArray(value)) return value.flatMap(flatten);
    if (value && typeof value === "object") return Object.values(value).flatMap(flatten);
    return [];
}

function showConfirmation(order) {
    checkoutView.hidden = true;
    stateBox.hidden = true;
    confirmation.hidden = false;

    $("#confirmText").textContent = `Your order number is #${order.id}. We have saved it and will confirm it shortly.`;
    $("#confirmItems").innerHTML = order.items
        .map((item) =>
            summaryRow({ name: item.name, qty: item.quantity, price: Number(item.price), image: "" })
        )
        .join("");
    $("#confirmTotal").textContent = formatPrice(order.total);
    window.scrollTo({ top: 0, behavior: "smooth" });
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const data = {
        full_name: form.full_name.value.trim(),
        phone: form.phone.value.trim(),
        address: form.address.value.trim(),
        city: form.city.value.trim(),
        state: form.state.value.trim(),
        pincode: form.pincode.value.trim(),
    };

    /* Quick checks in the browser. The server checks everything again. */
    if (Object.values(data).some((value) => !value)) {
        setMessage("Please fill in all the delivery details.", "error");
        return;
    }
    if (!/^\+?\d{10,13}$/.test(data.phone)) {
        setMessage("Enter a valid phone number, for example 9876543210.", "error");
        form.phone.focus();
        return;
    }
    if (!/^\d{6}$/.test(data.pincode)) {
        setMessage("Enter a valid 6-digit pincode.", "error");
        form.pincode.focus();
        return;
    }

    /* Only product ids and quantities are sent. Never prices. */
    data.items = cart.map((item) => ({ product: Number(item.id), quantity: item.qty }));

    placeOrderBtn.disabled = true;
    placeOrderBtn.textContent = "Placing your order…";
    setMessage("", "");

    try {
        const response = await fetch(`${API_BASE}/orders/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Token ${auth.token}`,
            },
            body: JSON.stringify(data),
        });

        const result = await response.json().catch(() => null);

        if (response.status === 401) {
            removeStorage(AUTH_KEY);
            showState(
                "Please sign in again",
                "Your sign-in has expired. Sign in again and your cart will still be here.",
                "Sign in",
                "login.html"
            );
            return;
        }

        if (!response.ok) {
            const text = flatten(result).join(" ");
            setMessage(text || "Something went wrong. Please try again.", "error");
            return;
        }

        removeStorage(CART_KEY);
        showConfirmation(result);
    } catch (error) {
        console.error("Order request failed:", error);
        setMessage("Cannot reach the server. Is the backend running?", "error");
    } finally {
        placeOrderBtn.disabled = false;
        placeOrderBtn.textContent = "Place order";
    }
});