var currentPage = 0;
var num = 0;
var lastScroll = 0;


document.onkeydown = onKeyDown;
window.onload = setUp();

function setUp() {
    num = document.getElementsByClassName('container').length;
    document.getElementById('upArrow').onclick = scrollUp;
    document.getElementById('downArrow').onclick = scrollDown;
    setInterval(checkScroll, 20);
    currentPage = 0;
}

function onKeyDown(event) {
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(event.code) > -1) {
        event.preventDefault();
    }
    var event = event || window.event;
    switch (event.keyCode) {
        case 38:
            scrollUp();
            break;
        case 87:
            scrollUp();
            break;
        case 40:
            scrollDown();
            break;
        case 83:
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
    console.log(index);
    document.getElementsByClassName('container')[index].scrollIntoView();
}

function checkScroll() {
    for (let i = 0; i < num; i++) {
        if (document.getElementsByClassName('container')[i].getBoundingClientRect().y >= -10) {
            currentPage = i;
            break;
        }
    }
    document.getElementById('upArrowImg').style.display = "block";
    document.getElementById('downArrowImg').style.display = "block";
    if (currentPage == 0) {
        document.getElementById('upArrowImg').style.display = "none";
    } else if (currentPage == num - 1) {
        document.getElementById('downArrowImg').style.display = "none";
    }
}