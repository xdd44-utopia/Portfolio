/* shared.js — Shared scripts (mobile nav, logo) */

var menuOpen = false;
var mq = window.matchMedia("screen and (max-width: 450px)");

function toggleMenu() {
    if (!mq.matches) return;

    menuOpen = !menuOpen;

    /* Nav overlay */
    var nav = document.querySelector('nav');
    if (nav) {
        if (menuOpen) {
            nav.classList.add('menu-open');
        } else {
            nav.classList.remove('menu-open');
        }
    }

    /* Hamburger → × */
    var toggle = document.getElementById('menu-toggle');
    if (toggle) {
        if (menuOpen) {
            toggle.classList.add('menu-open-btn');
        } else {
            toggle.classList.remove('menu-open-btn');
        }
    }

    /* Logo: slides to center when menu is open */
    var logoa = document.getElementById('logoa');
    if (logoa) {
        if (menuOpen) {
            logoa.classList.add('logo-centered');
        } else {
            logoa.classList.remove('logo-centered');
        }
    }
}
