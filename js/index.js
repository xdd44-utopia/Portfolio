/*cover page scroll effect*/

function coverScroll() {
    document.getElementById("cover").style.marginTop = $(window).scrollTop() / 2 + "px";
}

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();

        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

window.addEventListener("scroll", coverScroll);