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

function addFooter(pageType) {
    // 0: index  1: pages  2: subpages
    switch (pageType) {
        case 1:
            document.querySelector('footer').innerHTML = `
    <div class="footer" id="Links">
        <div><img src="../image/logo 3.1.png" alt="xdd44"></div>
        <hr>
        <div>
            <h2>Contact & Connect</h2>
            <ul class="contact">
                <li>
                    <img src="../image/icons/email.png"><a href="mailto: cyleodai@gmail.com" target="_blank">xdd44.utopia@gmail.com</a>
                </li>
                <li>
                    <img src="../image/icons/linkedin.png"><a href="https://www.linkedin.com/in/cyleodai" target="_blank">Chenyue DAI</a>
                </li>
                <li>
                    <img src="../image/icons/github.png"><a href="https://github.com/xdd44-utopia" target="_blank">xdd44-utopia</a>
                </li>
                <li>
                    <img src="../image/icons/instagram.png"><a href="https://www.instagram.com/realxdd44" target="_blank">realxdd44</a>
                </li>
                <li>
                    <img src="../image/icons/youtube.png"><a href="https://www.youtube.com/channel/UCuLjsKUCwts0mB72BVh3ZJg" target="_blank">xdd44</a>
                </li>
                <li>
                    <img src="../image/icons/bilibili.png"><a href="https://space.bilibili.com/22729170" target="_blank">realxdd44</a>
                </li>
            </ul>
        </div>
        <hr>
        <div>
            <h2><a href="https://github.com/xdd44-utopia/Portfolio">See this website on GitHub</a></h2>
        </div>
        <hr>
        <div class="statement">All materials contained on this website, unless noted otherwise, are works of Chenyue &quot;xdd44&quot; DAI and may not be reproduced, distributed, transmitted, displayed, published or broadcast without
            the prior written permission of Chenyue &quot;xdd44&quot; DAI.<br><br>Please email me at cyleodai@gmail.com for any request of use permission and other enquiries.<br><br></div>
        <div class="copyright">Copyright © 2019 - 2023 Chenyue &quot;xdd44&quot; DAI &nbsp;&nbsp;All Rights Reserved</div>
    </div>
    `;
            break;
        case 2:
            document.querySelector('footer').innerHTML = `
        <div class="footer" id="Links">
            <div><img src="../../image/logo 3.1.png" alt="xdd44"></div>
            <hr>
            <div>
                <h2>Contact & Connect</h2>
                <ul class="contact">
                    <li>
                        <img src="../../image/icons/email.png"><a href="mailto: cyleodai@gmail.com" target="_blank">xdd44.utopia@gmail.com</a>
                    </li>
                    <li>
                        <img src="../../image/icons/linkedin.png"><a href="https://www.linkedin.com/in/cyleodai" target="_blank">Chenyue DAI</a>
                    </li>
                    <li>
                        <img src="../../image/icons/github.png"><a href="https://github.com/xdd44-utopia" target="_blank">xdd44-utopia</a>
                    </li>
                    <li>
                        <img src="../../image/icons/instagram.png"><a href="https://www.instagram.com/realxdd44" target="_blank">realxdd44</a>
                    </li>
                    <li>
                        <img src="../../image/icons/youtube.png"><a href="https://www.youtube.com/channel/UCuLjsKUCwts0mB72BVh3ZJg" target="_blank">xdd44</a>
                    </li>
                    <li>
                        <img src="../../image/icons/bilibili.png"><a href="https://space.bilibili.com/22729170" target="_blank">realxdd44</a>
                    </li>
                </ul>
            </div>
            <hr>
            <div>
                <h2><a href="https://github.com/xdd44-utopia/Portfolio">See this website on GitHub</a></h2>
            </div>
            <hr>
            <div class="statement">All materials contained on this website, unless noted otherwise, are works of Chenyue &quot;xdd44&quot; DAI and may not be reproduced, distributed, transmitted, displayed, published or broadcast without
                the prior written permission of Chenyue &quot;xdd44&quot; DAI.<br><br>Please email me at cyleodai@gmail.com for any request of use permission and other enquiries.<br><br></div>
            <div class="copyright">Copyright © 2022 Chenyue &quot;xdd44&quot; DAI &nbsp;&nbsp;All Rights Reserved</div>
        </div>
        `;
            break;
    }
}

function addNavigator(pageType) {
    // 0: index  1: pages  2: subpages
    switch (pageType) {
        case 0:
            document.querySelector('nav').innerHTML = `
            <div id="logo">
                <a id="logoa" href="#Top">
                    <img id="logo_hide" src="../image/Others/Logo/logo_black.png" alt="Logo">
                    <img id="logo_show" src="../image/icons/logo_blackback.png" alt="Logo">
                </a>
                <div onclick="toggleMenu()">
                    <img id="icon_menu" src="../image/icons/menu.png" alt="Menu">
                    <img id="icon_close" src="../image/icons/close.png" alt="Close">
                </div>
                <div id="navbar"></div>
            </div>
            <ul>
                <li><a href="bio.html">Bio</a></li>
                <li><a onclick="toggleMenu()" href="#Architecture">Architecture</a></li>
                <li><a onclick="toggleMenu()" href="#Other">Art & Design</a></li>
                <li><a onclick="toggleMenu()" href="#Programming">Computing</a></li>
                <li><a onclick="toggleMenu()" href="#Photography">Photo Essay</a></li>
                <li><a onclick="toggleMenu()" href="#Traveling">Traveling</a></li>
                <li><a onclick="toggleMenu()" href="#Links">Links</a></li>
            </ul>
            `;
            break;
        case 1:
            document.querySelector('nav').innerHTML = `
            <div id="logo">
                <a id="logoa" href="index.html">
                    <img id="logo_hide" src="../image/Others/Logo/logo_black.png" alt="Logo">
                    <img id="logo_show" src="../image/Others/Logo/logo_white.png" alt="Logo">
                </a>
                <div onclick="toggleMenu()">
                    <img id="icon_menu" src="../image/icons/menu.png" alt="Menu">
                    <img id="icon_close" src="../image/icons/close.png" alt="Close">
                </div>
                <div id="navbar"></div>
            </div>
            <ul>
                <li><a href="index.html">Home</a></li>
                <li><a href="bio.html">Bio</a></li>
                <li><a href="index.html#Architecture">Architecture</a></li>
                <li><a href="index.html#Other">Art & Design</a></li>
                <li><a href="index.html#Programming">Computing</a></li>
                <li><a href="index.html#Photography">Photo Essay</a></li>
                <li><a href="index.html#Traveling">Traveling</a></li>
                <li><a href="index.html#Links">Links</a></li>
            </ul>
            `;
            break;
        case 2:
            document.querySelector('nav').innerHTML = `
            <div id="logo">
                <a id="logoa" href="../index.html">
                    <img id="logo_hide" src="../../image/Others/Logo/logo_black.png" alt="Logo">
                    <img id="logo_show" src="../../image/Others/Logo/logo_white.png" alt="Logo">
                </a>
                <div onclick="toggleMenu()">
                    <img id="icon_menu" src="../../image/icons/menu.png" alt="Menu">
                    <img id="icon_close" src="../../image/icons/close.png" alt="Close">
                </div>
                <div id="navbar"></div>
            </div>
            <ul>
                <li><a href="../index.html">Home</a></li>
                <li><a href="../bio.html#Bio">Bio</a></li>
                <li><a href="../index.html#Architecture">Architecture</a></li>
                <li><a href="../index.html#Other">Art & Design</a></li>
                <li><a href="../index.html#Programming">Computing</a></li>
                <li><a href="../index.html#Photography">Photography</a></li>
                <li><a href="../index.html#Links">Links</a></li>
            </ul>
            `;
            break;
    }
}