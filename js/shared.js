/*small screen navigator bar fold*/

var menuOn = false;
var mq = window.matchMedia( "screen and (max-device-width: 450px) and (max-device-height: 950px)" );

function toggleMenu() {
    if (!mq.matches) {
        return;
    }
    menuOn = !menuOn;
    document.getElementById("logo_show").style.width = menuOn ? "160px" : "100px";
    document.getElementById("logo_show").style.height = menuOn ? "160px" : "100px";
    document.getElementById("logoa").style.left = menuOn ? "calc(50vw - 80px)" : "20px";
    document.getElementById("logoa").style.top = menuOn ? "200px" : "20px";
    document.getElementById("icon_menu").style.opacity = menuOn ? "0" : "100%";
    document.getElementById("icon_close").style.opacity = menuOn ? "100%" : "0";
    document.getElementsByTagName('nav')[0].style.marginLeft = menuOn ? "0" : "-100vw";
}

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