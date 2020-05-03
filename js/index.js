var isDeveloper = true;
var mq = window.matchMedia( "screen and (max-device-width: 450px) and (max-device-height: 900px)" );

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
	if (mq.matches){
		document.getElementById("developer").style.marginLeft=`-80vw`;
		document.getElementById("architectTitle").style.opacity=`1`;
		document.getElementById("developerTitle").style.opacity=`0.5`;
		document.getElementById("slideRight").style.display=`none`;
		document.getElementById("slideLeft").style.display=`block`;
	}
	else {
		document.getElementById("developer").style.marginLeft=`-84vw`;
		document.getElementById("architectTitle").style.opacity=`1`;
		document.getElementById("developerTitle").style.opacity=`0.5`;
		document.getElementById("architectTitle").style.animation=`none`;
	}
}
function switchToDeveloper() {
	if (mq.matches){
		document.getElementById("developer").style.marginLeft=`0`;
		document.getElementById("developerTitle").style.opacity=`1`;
		document.getElementById("architectTitle").style.opacity=`0.5`;
		document.getElementById("slideLeft").style.display=`none`;
		document.getElementById("slideRight").style.display=`block`;
	}
	else {
		document.getElementById("developer").style.marginLeft=`0`;
		document.getElementById("developerTitle").style.opacity=`1`;
		document.getElementById("architectTitle").style.opacity=`0.5`;
		document.getElementById("developerTitle").style.animation=`none`;
	}
}

window.addEventListener("load", switchToDeveloper);
window.addEventListener("resize", switchToDeveloper);