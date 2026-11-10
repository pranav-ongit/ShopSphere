/* =====================================================
   ShopSphere - orders.js
   Shows the signed-in customer's order history,
   loaded from GET /api/orders/
   ===================================================== */

"use strict";

/* Same backend address as the other scripts. Change all of them when we deploy. */
const API_BASE = "http://127.0.0.1:8000/api";
const AUTH_KEY = "shopsphere-auth";

const $ = (selector, scope = document) => scope.querySelector(selector);

const formatPrice = (number) => "₹" + Number(number).toLocaleString("en-IN");

const escapeHTML = (text) =>
    String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

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

const ordersView = $("#ordersView");
const ordersList = $("#ordersList");
const ordersLoading = $("#ordersLoading");
const stateBox = $("#stateBox");

/* A full-page message: signed out, no orders, or an error */
function showState(title, text, buttonText, buttonHref) {
    ordersView.hidden = true;
    stateBox.hidden = false;
    $("#stateTitle").textContent = title;
    $("#stateText").textContent = text;
    const button = $("#stateButton");
    button.textContent = buttonText;
    button.href = buttonHref;
}

/* Builds the HTML of one order card */
function orderCard(order, index) {
    const date = new Date(order.created_at).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });

    const status = order.status.charAt(0).toUpperCase() + order.status.slice(1);

    const lines = order.items
        .map(
            (item) => `
            <li class="order-line">
                <span>${escapeHTML(item.name)} <small>× ${item.quantity}</small></span>
                <span>${formatPrice(Number(item.price) * item.quantity)}</span>
            </li>`
        )
        .join("");

    const address = [order.address, order.city, order.state].map(escapeHTML).join(", ") + " - " + escapeHTML(order.pincode);

    return `
    <article class="order-card" style="animation-delay: ${index * 80}ms">
        <div class="order-card__head">
            <div>
                <p class="order-card__number">Order #${order.id}</p>
                <p class="order-card__date">Placed on ${date}</p>
            </div>
            <span class="status status--${escapeHTML(order.status)}">${escapeHTML(status)}</span>
        </div>

        <ul class="order-lines">${lines}</ul>

        <div class="order-card__foot">
            <p class="order-card__address">
                <strong>Delivering to ${escapeHTML(order.full_name)}</strong>
                ${address}
            </p>
            <p class="order-card__total">Total <strong>${formatPrice(order.total)}</strong></p>
        </div>
    </article>`;
}

async function loadOrders() {
    try {
        const response = await fetch(`${API_BASE}/orders/`, {
            headers: { Authorization: `Token ${auth.token}` },
        });

        if (response.status === 401) {
            removeStorage(AUTH_KEY);
            showState(
                "Please sign in again",
                "Your sign-in has expired. Sign in to see your orders.",
                "Sign in",
                "login.html"
            );
            return;
        }

        if (!response.ok) throw new Error("Server answered with status " + response.status);

        const data = await response.json();
        const orders = Array.isArray(data) ? data : data.results;

        if (!orders.length) {
            showState(
                "No orders yet",
                "When you place an order, it will appear here.",
                "Start shopping",
                "index.html#products"
            );
            return;
        }

        ordersLoading.hidden = true;
        ordersList.innerHTML = orders.map(orderCard).join("");
    } catch (error) {
        console.error("Could not load orders:", error);
        showState(
            "Cannot reach the server",
            "Make sure the backend is running, then try again.",
            "Try again",
            "orders.html"
        );
    }
}

if (!auth || !auth.token) {
    showState("Sign in to see your orders", "Your orders are saved to your account.", "Sign in", "login.html");
} else {
    loadOrders();
}