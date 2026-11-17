isPhone = window.matchMedia('screen and (max-device-width: 450px) and (max-device-height: 950px)').matches;

window.onload = init;
window.addEventListener("touchmove", show, false);
document.onwheel = show;

window.addEventListener('resize', adjustDynamicValue);

var hasShown = false;

var isContributor = false;
var mainLeft;
var mainRight;
var contributorLeft;
var contributorRight;

function init() {

	mainLeft = document.getElementById('mainLeft').innerHTML;
	mainRight = document.getElementById('mainRight').innerHTML;
	contributorLeft = document.getElementById('contributorLeft').innerHTML;
	contributorRight = document.getElementById('contributorRight').innerHTML;

	adjustDynamicValue();

	if (isPhone) {
		switchEN();
	}
}

function show() {

	document.getElementById('scrollArrow').style.marginTop = "-10vh";

	if (!hasShown) {
		hasShown = true;
		adjustDynamicValue();
	}
}

function switchContributor() {
	if (isContributor) {
		document.getElementById('mainText').style.fontSize = "small";
		document.getElementById('mainLeft').innerHTML = mainLeft;
		document.getElementById('mainRight').innerHTML = mainRight;
		document.getElementById('contributor').innerHTML = "CONTRIBUTORS";
		document.getElementById('contributorEN').innerHTML = "CONTRIBUTORS";
		document.getElementById('contributorAR').innerHTML = "المساهمون";
	}
	else {
		document.getElementById('mainText').style.fontSize = "small";
		document.getElementById('mainLeft').innerHTML = contributorLeft;
		document.getElementById('mainRight').innerHTML = contributorRight;
		document.getElementById('contributor').innerHTML = "CURATIORIAL STATEMENT";
		document.getElementById('contributorEN').innerHTML = "CURATIORIAL STATEMENT";
		document.getElementById('contributorAR').innerHTML = "البيان الفني";
	}
	isContributor = !isContributor;
}

function switchAR() {

	document.getElementById('contributorEN').style.fontSize = "0";
	document.getElementById('contributorAR').style.fontSize = "1.5vh";

	document.getElementById('switchEN').style.display = "block";
	document.getElementById('switchAR').style.display = "none";

	document.getElementById('mobileEnglishTitle').style.display = "none";
	document.getElementById('mobileArabicTitle').style.display = "block";

	document.getElementById('mainRight').style.display = "block";
	document.getElementById('mainLeft').style.display = "none";

	document.getElementById('mobileInfoSignature').style.fontFamily = "Graphik Arabic Web Regular";
	document.getElementById('mobileLeftLeft').innerText = "مايو - 16 نوفمبر 2023";
	document.getElementById('mobileLeftRight').innerText = " 20";
	document.getElementById('mobileRightSignature').innerText = "جناح البحرين الوطني";

}

function switchEN() {

	document.getElementById('contributorEN').style.fontSize = "1.5vh";
	document.getElementById('contributorAR').style.fontSize = "0";

	document.getElementById('switchEN').style.display = "none";
	document.getElementById('switchAR').style.display = "block";

	document.getElementById('mobileEnglishTitle').style.display = "block";
	document.getElementById('mobileArabicTitle').style.display = "none";

	document.getElementById('mainLeft').style.display = "block";
	document.getElementById('mainRight').style.display = "none";

	document.getElementById('mobileInfoSignature').style.fontFamily = "Graphik Web";
	document.getElementById('mobileLeftLeft').innerText = "BAHRAIN NATIONAL PAVILION";
	document.getElementById('mobileLeftRight').innerText = "";
	document.getElementById('mobileRightSignature').innerText = "May 20 - November 16 2023";

}

function adjustDynamicValue() {
	var foregroundHolder = document.getElementsByClassName('foregroundHolder');
	for (var i = 0; i < foregroundHolder.length; i++) {
		foregroundHolder.item(i).style.marginTop = (document.documentElement.clientHeight * 0.25) + 'px';
	}
	if (hasShown) {
		if (isPhone) {
			document.getElementById('contributorHolder').style.marginTop = "5%";
		}
		document.getElementById("background").style.height= (document.documentElement.clientHeight * 1.2) + 'px';
		document.getElementById("mainHolder").style.marginTop = (document.documentElement.clientHeight * 0.1) + 'px';
		document.getElementById("mainHolder").style.height = (document.documentElement.clientHeight * 0.8) + 'px';
		document.getElementById('logo').style.marginTop = (isPhone ? (document.documentElement.clientHeight * 0.90) + 'px' : (document.documentElement.clientHeight * 0.90) + 'px');
	}
	else {
		document.getElementById('scrollArrow').style.marginTop = (isPhone ? (document.documentElement.clientHeight * 0.90) + 'px' : (document.documentElement.clientHeight * 0.90) + 'px');
	}
}