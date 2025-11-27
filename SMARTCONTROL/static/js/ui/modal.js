export function openModal(id) {
    document.getElementById(id)?.classList.remove("hidden");
}

export function closeModal(id) {
    document.getElementById(id)?.classList.add("hidden");
}

export function bindModals() {
    document.querySelectorAll("[data-open]").forEach(btn =>
        btn.addEventListener("click", () => openModal(btn.dataset.open))
    );

    document.querySelectorAll("[data-close]").forEach(btn =>
        btn.addEventListener("click", () => closeModal(btn.dataset.close))
    );
}
