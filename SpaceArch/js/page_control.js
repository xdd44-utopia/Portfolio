var currentPage = 0;
var num = 0;
var lastScroll = 0;
var scrollTimer = 0;

document.onkeydown = onKeyDown;
window.onload = setUp();

function setUp() {
    num = document.getElementsByClassName('page').length;
    setInterval(checkScroll, 20);
    currentPage = 0;
}

function onKeyDown(event) {
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(event.code) > -1) {
        event.preventDefault();
    }
    var event = event || window.event;
    switch (true) {
        case (event.keyCode == 37 || event.keyCode == 38 || event.keyCode == 65 || event.keyCode == 87):
            scrollUp();
            break;
        case (event.keyCode == 32 || event.keyCode == 39 || event.keyCode == 40 || event.keyCode == 68 || event.keyCode== 83):
            scrollDown();
            break;
    }
}

function scrollUp() {
    if (currentPage > 0) {
        currentPage--;
        scroll(currentPage);
    }
}

function scrollDown() {
    if (currentPage < num - 1) {
        currentPage++;
        scroll(currentPage);
    }
}

function scroll(index) {
    scrollTimer = Date.now();
    document.getElementsByClassName('page')[index].scrollIntoView();
}

function checkScroll() {
    if (Date.now() - scrollTimer < 500) {
        return;
    }
    for (let i = 0; i < num; i++) {
        if (document.getElementsByClassName('page')[i].getBoundingClientRect().y >= -10) {
            currentPage = i >= 0 ? i : 0;
            scroll(currentPage);
            break;
        }
    }
}