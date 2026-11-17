/* index.js — Index page scripts */

/* ── Parallax: cover image scrolls at half speed ── */
function coverScroll() {
    var cover = document.getElementById("cover");
    if (cover) {
        var scrollY = window.pageYOffset || document.documentElement.scrollTop;
        cover.style.marginTop = (scrollY / 2) + "px";
    }
}

window.addEventListener("scroll", coverScroll, { passive: true });

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
