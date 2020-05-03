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
var mq = window.matchMedia( "screen and (max-device-width: 450px) and (max-device-height: 900px)" );

function mouseEnterLogo() {
	isLogoOver = true;
	if(mq.matches) {
		mobileLogoControl();
	}
	else {
		logoControl();
	}
}

function mouseLeaveLogo() {
	isLogoOver = false;
	if(mq.matches) {
		mobileLogoControl();
	}
	else {
		logoControl();
	}
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

function mobileLogoControl(){
	var scrollDist = $(window).scrollTop();
	if (scrollDist > $(window).width() * 1.5 && !isLogoOver) {
		document.getElementsByClassName("LogoDsc")[0].style.color="rgba(204, 204, 204, 0)";
		document.getElementsByClassName("LogoDsc")[0].style.display="none";
		document.getElementsByClassName("MyLogo")[0].style.width="15vw";
	}
	else {
		document.getElementsByClassName("MyLogo")[0].style.width="25vw";
		document.getElementsByClassName("LogoDsc")[0].style.color="rgba(204, 204, 204, 1)";
		document.getElementsByClassName("LogoDsc")[0].style.display="block";
	}
}

window.addEventListener("scroll", coverScroll);
window.addEventListener("scroll", function(){
	if(mq.matches) {
		mobileLogoControl();
	}
	else {
		logoControl();
	}
});
window.addEventListener("load", function(){
	if(mq.matches) {
		mobileLogoControl();
	}
	else {
		logoControl();
	}
});