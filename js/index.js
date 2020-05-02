function titleControl(){
	var scrollDist = $(window).scrollTop();
	if (scrollDist > $(window).width() * 0.5) {
		var dist = scrollDist - $(window).width()*0.5 - 50;
		if (dist < 100) {
			dist = 100;
		}
		document.getElementById("developerTitle").style.marginTop=`${dist}px`;
		document.getElementById("architectTitle").style.marginTop=`${dist}px`;
	}
	else {
		document.getElementById("developerTitle").style.marginTop=`100px`;
		document.getElementById("architectTitle").style.marginTop=`100px`;
	}
}

var isDeveloper = true;

function switchPage() {
	if (isDeveloper){
		switchToArchitect();
		isDeveloper = false;
	}
	else {
		switchToDeveloper();
		isDeveloper = true;
	}
}

function switchToArchitect() {
	document.getElementById("developer").style.marginLeft=`-90vw`;
	document.getElementById("architectTitle").style.opacity=`1`;
	document.getElementById("developerTitle").style.opacity=`0.5`;
	document.getElementById("slideRight").style.display=`none`;
	document.getElementById("slideLeft").style.display=`block`;
}
function switchToDeveloper() {
	document.getElementById("developer").style.marginLeft=`0`;
	document.getElementById("developerTitle").style.opacity=`1`;
	document.getElementById("architectTitle").style.opacity=`0.5`;
	document.getElementById("slideLeft").style.display=`none`;
	document.getElementById("slideRight").style.display=`block`;
}

window.addEventListener("scroll", titleControl);
window.addEventListener("load", titleControl);
window.addEventListener("load", switchToDeveloper);
window.addEventListener("resize", titleControl);
window.addEventListener("resize", switchToDeveloper);