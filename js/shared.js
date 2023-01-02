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

/* control the logo on top left of the page */
var isLogoOver = false;
var mq = window.matchMedia("screen and (max-device-width: 450px) and (max-device-height: 950px)");

function mouseEnterLogo() {
    isLogoOver = true;
    if (mq.matches) {
        mobileLogoControl();
    } else {
        logoControl();
    }
}

function logoControl() {}

window.addEventListener("scroll", coverScroll);