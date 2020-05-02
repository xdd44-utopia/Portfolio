/*cover page scroll effect*/

function coverScroll(){
	document.getElementById("cover").style.marginTop=$(window).scrollTop()/2+"px";
}

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();

        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

/* control the logo on top left of the page */
var isLogoOver = false;

function mouseEnterLogo() {
	isLogoOver = true;
	logoControl();
}

function mouseLeaveLogo() {
	isLogoOver = false;
	logoControl();
}

function logoControl(){
	var scrollDist = $(window).scrollTop();
	if (scrollDist > $(window).width() * 0.6 && !isLogoOver) {
		document.getElementsByClassName("LogoDsc")[0].style.color="rgba(204, 204, 204, 0)";
		document.getElementsByClassName("LogoDsc")[0].style.display="none";
		document.getElementsByClassName("MyLogo")[0].style.width="5vw";
	}
	else {
		document.getElementsByClassName("MyLogo")[0].style.width="10vw";
		document.getElementsByClassName("LogoDsc")[0].style.color="rgba(204, 204, 204, 1)";
		document.getElementsByClassName("LogoDsc")[0].style.display="block";
	}
}

window.addEventListener("scroll", coverScroll);
window.addEventListener("scroll", logoControl);
window.addEventListener("load", logoControl);