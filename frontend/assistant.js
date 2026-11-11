/* =====================================================
   ShopSphere - assistant.js
   A chat widget you can add to any page with one line:
   <script src="assistant.js" defer></script>

   Everything is inside one function, so it cannot clash
   with the other scripts on the page.
   ===================================================== */

(() => {
    "use strict";

    /* Same backend address as the other scripts. Change all of them when we deploy. */
    const API_BASE = "http://127.0.0.1:8000/api";
    const CHAT_KEY = "shopsphere-chat";
    const MAX_SAVED = 30;
    const START_CHIPS = ["Headphones under ₹1,500", "Best rated products", "Any deals?", "Track my order"];

    const escapeHTML = (text) =>
        String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    const formatPrice = (number) => "₹" + Number(number).toLocaleString("en-IN");

    /* ---------- Load the stylesheet by itself ---------- */
    if (!document.querySelector('link[href$="assistant.css"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "assistant.css";
        document.head.appendChild(link);
    }

    /* ---------- Saved conversation (kept while the tab is open) ---------- */
    function loadHistory() {
        try {
            const saved = JSON.parse(sessionStorage.getItem(CHAT_KEY));
            return Array.isArray(saved) ? saved : [];
        } catch {
            return [];
        }
    }

    function saveHistory() {
        try {
            sessionStorage.setItem(CHAT_KEY, JSON.stringify(history.slice(-MAX_SAVED)));
        } catch {
            /* ignore */
        }
    }

    const history = loadHistory();

    /* ---------- Build the widget ---------- */
    const root = document.createElement("div");
    root.className = "assistant";
    root.innerHTML = `
        <button type="button" class="assistant__launcher" aria-expanded="false" aria-controls="assistantPanel">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>
            <span>Ask ShopSphere</span>
        </button>

        <section class="assistant__panel" id="assistantPanel" role="dialog" aria-label="ShopSphere shopping assistant" aria-hidden="true">
            <header class="assistant__head">
                <div>
                    <strong>Shopping assistant</strong>
                    <span>Ask about products, prices and deals</span>
                </div>
                <button type="button" class="assistant__close" aria-label="Close assistant">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
                </button>
            </header>

            <div class="assistant__messages" aria-live="polite"></div>
            <div class="assistant__chips"></div>

            <form class="assistant__form" autocomplete="off">
                <label class="visually-hidden" for="assistantInput">Your message</label>
                <input type="text" id="assistantInput" maxlength="300" placeholder="Try: headphones under ₹1,500">
                <button type="submit" aria-label="Send message">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                </button>
            </form>
        </section>`;
    document.body.appendChild(root);

    const launcher = root.querySelector(".assistant__launcher");
    const panel = root.querySelector(".assistant__panel");
    const closeBtn = root.querySelector(".assistant__close");
    const messages = root.querySelector(".assistant__messages");
    const chips = root.querySelector(".assistant__chips");
    const form = root.querySelector(".assistant__form");
    const input = root.querySelector("#assistantInput");
    const sendBtn = form.querySelector("button");

    /* ---------- Open and close ---------- */
    function setOpen(open) {
        root.classList.toggle("is-open", open);
        launcher.setAttribute("aria-expanded", open);
        panel.setAttribute("aria-hidden", !open);
        if (open) {
            input.focus();
            messages.scrollTop = messages.scrollHeight;
        } else {
            launcher.focus();
        }
    }

    launcher.addEventListener("click", () => setOpen(!root.classList.contains("is-open")));
    closeBtn.addEventListener("click", () => setOpen(false));
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && root.classList.contains("is-open")) setOpen(false);
    });

    /* ---------- Showing messages ---------- */
    function productCard(p) {
        const link = `product-detail.html?slug=${encodeURIComponent(p.slug)}`;
        const rating = p.review_count
            ? `<span class="assistant-card__rating">★ ${Number(p.rating).toFixed(1)} (${p.review_count})</span>`
            : "";
        const old =
            p.old_price && Number(p.old_price) > Number(p.price)
                ? `<s>${formatPrice(p.old_price)}</s>`
                : "";

        return `
        <a class="assistant-card" href="${link}">
            ${p.image ? `<img src="${escapeHTML(p.image)}" alt="" width="56" height="56" loading="lazy">` : '<span class="assistant-card__thumb"></span>'}
            <span class="assistant-card__info">
                <strong>${escapeHTML(p.name)}</strong>
                <span class="assistant-card__price">${formatPrice(p.price)} ${old}</span>
                ${rating}
            </span>
        </a>`;
    }

    function messageHTML(item) {
        const text = escapeHTML(item.text).replace(/\n/g, "<br>");
        const cards = (item.products || []).map(productCard).join("");
        return `
        <div class="assistant-msg assistant-msg--${item.role}">
            <p class="assistant-msg__bubble">${text}</p>
            ${cards ? `<div class="assistant-msg__cards">${cards}</div>` : ""}
        </div>`;
    }

    function scrollDown() {
        messages.scrollTop = messages.scrollHeight;
    }

    function addMessage(item) {
        history.push(item);
        saveHistory();
        messages.insertAdjacentHTML("beforeend", messageHTML(item));
        scrollDown();
    }

    function setChips(list) {
        chips.innerHTML = list
            .map((text) => `<button type="button" class="assistant__chip">${escapeHTML(text)}</button>`)
            .join("");
    }

    function showTyping() {
        messages.insertAdjacentHTML(
            "beforeend",
            '<div class="assistant-msg assistant-msg--bot" id="assistantTyping"><p class="assistant-msg__bubble assistant-typing"><span></span><span></span><span></span></p></div>'
        );
        scrollDown();
    }

    function hideTyping() {
        const typing = messages.querySelector("#assistantTyping");
        if (typing) typing.remove();
    }

    /* ---------- Talking to the API ---------- */
    let busy = false;

    async function ask(text) {
        const message = text.trim();
        if (!message || busy) return;

        busy = true;
        sendBtn.disabled = true;
        addMessage({ role: "user", text: message });
        input.value = "";
        showTyping();

        try {
            const response = await fetch(`${API_BASE}/assistant/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message }),
            });

            hideTyping();

            if (response.status === 429) {
                addMessage({ role: "bot", text: "You are sending messages very quickly. Please wait a moment and try again." });
                return;
            }
            if (!response.ok) throw new Error("Server answered with status " + response.status);

            const data = await response.json();
            addMessage({ role: "bot", text: data.reply, products: data.products });
            if (data.suggestions) setChips(data.suggestions);
        } catch (error) {
            hideTyping();
            console.error("Assistant request failed:", error);
            addMessage({ role: "bot", text: "I cannot reach the shop right now. Please try again in a moment." });
        } finally {
            busy = false;
            sendBtn.disabled = false;
            input.focus();
        }
    }

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        ask(input.value);
    });

    chips.addEventListener("click", (event) => {
        const chip = event.target.closest(".assistant__chip");
        if (chip) ask(chip.textContent);
    });

    /* ---------- Start ---------- */
    if (history.length === 0) {
        history.push({
            role: "bot",
            text: "Hi! I can help you find products. Tell me what you are looking for, and a budget if you have one.",
        });
    }

    messages.innerHTML = history.map(messageHTML).join("");
    setChips(START_CHIPS);
})();