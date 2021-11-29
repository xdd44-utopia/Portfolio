var currentPage = 0;
var num = 0;
var lastScroll = 0;


document.onkeydown = onKeyDown;
window.onload = setUp();

function setUp() {
    num = document.getElementsByClassName('container').length;
    setInterval(checkScroll, 1000);
    currentPage = 0;
}

function onKeyDown(event) {
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(event.code) > -1) {
        event.preventDefault();
    }
    var event = event || window.event;
    switch (event.keyCode) {
        case 38:
            if (currentPage > 0) {
                currentPage--;
                scroll(currentPage);
            }
            break;
        case 87:
            if (currentPage > 0) {
                currentPage--;
                scroll(currentPage);
            }
            break;
        case 40:
            if (currentPage < num - 1) {
                currentPage++;
                scroll(currentPage);
            }
            break;
        case 83:
            if (currentPage < num - 1) {
                currentPage++;
                scroll(currentPage);
            }
            break;
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
}