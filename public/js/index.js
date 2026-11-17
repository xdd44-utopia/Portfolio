/* index.js — Index page scripts */

(function () {
    var cover = document.getElementById("cover");
    if (!cover) return;

    var coverHeight = cover.parentElement.offsetHeight;
    var framePending = false;
    var lastOffset = -1;

    function updateCover() {
        framePending = false;
        var offset = Math.min(Math.max(window.scrollY, 0), coverHeight) / 2;
        if (offset === lastOffset) return;

        cover.style.transform = "translate3d(0, " + offset + "px, 0)";
        lastOffset = offset;
    }

    function coverScroll() {
        if (framePending) return;
        framePending = true;
        window.requestAnimationFrame(updateCover);
    }

    window.addEventListener("scroll", coverScroll, { passive: true });
    window.addEventListener("resize", function () {
        coverHeight = cover.parentElement.offsetHeight;
        coverScroll();
    });
    window.addEventListener("pageshow", coverScroll);
    updateCover();
}());

/* ── Smooth scroll for anchor links (# hrefs) ── */
document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
        anchor.addEventListener('click', function (e) {
            var target = document.querySelector(this.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
});
