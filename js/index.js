function titleControl(){
	var scrollDist = $(window).scrollTop();
	if (scrollDist > $(window).width() * 0.6) {
		var dist = scrollDist - $(window).width() * 0.6 - 100;
		if (dist < 25) {
			dist = 25;
		}
		document.getElementById("developerTitle").style.marginTop=`${dist}px`;
		document.getElementById("architectTitle").style.marginTop=`${dist}px`;
	}
	else {
		document.getElementById("developerTitle").style.marginTop=`25px`;
		document.getElementById("architectTitle").style.marginTop=`25px`;
	}
}

window.addEventListener("scroll", titleControl);
window.addEventListener("load", titleControl);