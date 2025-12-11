// Legacy Viewer Scroll to Top Button
document.addEventListener('DOMContentLoaded', function() {
    const scrollBtn = document.getElementById('scrollToTop');
    if (scrollBtn) {
        scrollBtn.addEventListener("click", () => {
            if (window.scrollY > 300) {
                window.scrollTo({ top: 0, behavior: "smooth" });
            } else {
                window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
            }
        });
        
        window.addEventListener("scroll", () => {
            if (window.scrollY > 300) {
                scrollBtn.classList.add("scrolled-down");
                scrollBtn.setAttribute("aria-label", "Scroll to top");
            } else {
                scrollBtn.classList.remove("scrolled-down");
                scrollBtn.setAttribute("aria-label", "Scroll to bottom");
            }
        });
    }
});
