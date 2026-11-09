/* =====================================================
   ShopSphere - auth.js
   Sign in and create account, using the Django API
   ===================================================== */

"use strict";

/* Same backend address as script.js. Change both when we deploy. */
const API_BASE = "http://127.0.0.1:8000/api";
const AUTH_KEY = "shopsphere-auth";

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

/* ---------- Saved login (token + user) in the browser ---------- */
function getAuth() {
    try {
        return JSON.parse(localStorage.getItem(AUTH_KEY));
    } catch {
        return null;
    }
}

function saveAuth(data) {
    try {
        localStorage.setItem(AUTH_KEY, JSON.stringify({ token: data.token, user: data.user }));
    } catch {
        /* ignore */
    }
}

function clearAuth() {
    try {
        localStorage.removeItem(AUTH_KEY);
    } catch {
        /* ignore */
    }
}

/* ---------- Element references ---------- */
const authForms = $("#authForms");
const signedIn = $("#signedIn");
const loginForm = $("#loginForm");
const registerForm = $("#registerForm");
const authTitle = $("#authTitle");
const authSub = $("#authSub");
const tabs = $$("[data-tab]");

/* =====================================================
   1. Already signed in? Show a small panel instead
   ===================================================== */
const existing = getAuth();

if (existing && existing.token) {
    authForms.hidden = true;
    signedIn.hidden = false;
    $("#signedInText").textContent = `Signed in as ${existing.user.name} (${existing.user.email}).`;
}

$("#logoutBtn").addEventListener("click", () => {
    clearAuth();
    location.reload();
});

/* =====================================================
   2. Switch between Sign in and Create account
   ===================================================== */
const texts = {
    login: ["Welcome back", "Sign in to see your orders and check out faster."],
    register: ["Create your account", "It takes less than a minute."],
};

function setTab(name) {
    tabs.forEach((tab) => tab.setAttribute("aria-selected", tab.dataset.tab === name));
    loginForm.hidden = name !== "login";
    registerForm.hidden = name !== "register";
    authTitle.textContent = texts[name][0];
    authSub.textContent = texts[name][1];
    document.title = (name === "login" ? "Sign in" : "Create account") + " - ShopSphere";
}

tabs.forEach((tab) => tab.addEventListener("click", () => setTab(tab.dataset.tab)));

/* login.html#register opens the Create account tab directly */
setTab(location.hash === "#register" ? "register" : "login");

/* =====================================================
   3. Show / hide password
   ===================================================== */
$$("[data-show-password]").forEach((box) => {
    box.addEventListener("change", () => {
        const field = box.closest("form").querySelector("[name='password']");
        field.type = box.checked ? "text" : "password";
    });
});

/* =====================================================
   4. Sending the form to the API
   ===================================================== */
const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

/* Turns the API's error answer into one readable sentence */
function errorText(data) {
    if (!data) return "Something went wrong. Please try again.";
    if (typeof data.detail === "string") return data.detail;
    const messages = Object.values(data).flat().filter((m) => typeof m === "string");
    return messages.length ? messages.join(" ") : "Something went wrong. Please try again.";
}

function setMessage(form, text, type) {
    const box = $(".form-message", form);
    box.textContent = text;
    box.classList.toggle("is-error", type === "error");
    box.classList.toggle("is-success", type === "success");
}

async function submitAuth(form, endpoint, payload) {
    const button = $('button[type="submit"]', form);
    const label = button.textContent;

    button.disabled = true;
    button.textContent = "Please wait…";
    setMessage(form, "", "");

    try {
        const response = await fetch(`${API_BASE}/auth/${endpoint}/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
            setMessage(form, errorText(data), "error");
            return;
        }

        saveAuth(data);
        setMessage(form, `Welcome, ${data.user.name}. Taking you to the shop…`, "success");
        setTimeout(() => (location.href = "index.html"), 900);
    } catch (error) {
        console.error("Auth request failed:", error);
        setMessage(form, "Cannot reach the server. Is the backend running?", "error");
    } finally {
        button.disabled = false;
        button.textContent = label;
    }
}

/* Sign in */
loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = loginForm.email.value.trim();
    const password = loginForm.password.value;

    if (!validEmail(email)) {
        setMessage(loginForm, "Enter a valid email address.", "error");
        loginForm.email.focus();
        return;
    }
    if (!password) {
        setMessage(loginForm, "Enter your password.", "error");
        loginForm.password.focus();
        return;
    }

    submitAuth(loginForm, "login", { email, password });
});

/* Create account */
registerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = registerForm.name.value.trim();
    const email = registerForm.email.value.trim();
    const password = registerForm.password.value;

    if (!name) {
        setMessage(registerForm, "Enter your name.", "error");
        registerForm.name.focus();
        return;
    }
    if (!validEmail(email)) {
        setMessage(registerForm, "Enter a valid email address.", "error");
        registerForm.email.focus();
        return;
    }
    if (password.length < 8) {
        setMessage(registerForm, "Your password needs at least 8 characters.", "error");
        registerForm.password.focus();
        return;
    }

    submitAuth(registerForm, "register", { name, email, password });
});