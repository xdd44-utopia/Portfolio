function addFooter() {
    document.querySelector('footer').innerHTML = `
    <div class="footer" id="Links">
        <div><img src="../image/logo 3.1.png" alt="xdd44"></div>
        <hr>
        <div>
            <h2>Contact & Connect</h2>
            <ul class="contact">
                <li>
                    <img src="../image/icons/email.png"><a href="mailto: xdd44.utopia@gmail.com" target="_blank">xdd44.utopia@gmail.com</a>
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
        <div class="statement">All materials contained on this website, unless noted otherwise, are works of Chenyue &quot;xdd44&quot; DAI protected by Copyright law of Hong Kong and may not be reproduced, distributed, transmitted, displayed, published or broadcast without
            the prior written permission of Chenyue &quot;xdd44&quot; DAI.<br><br>Please email me at xdd44.utopia@gmail.com for any request of use permission and other enquiries.<br><br></div>
        <div class="copyright">Copyright © 2022 Chenyue &quot;xdd44&quot; DAI &nbsp;&nbsp;All Rights Reserved</div>
    </div>
    `;
}

function addNavigator(pageType) {
    // 0: index  1: pages  2: subpages
    switch (pageType) {
        case 0:
            document.querySelector('nav').innerHTML = `
            <div id="logo">
                <a href="#Top">
                    <img id="logo_hide" src="../image/Others/Logo/logo_black.png" alt="Logo">
                    <img id="logo_show" src="../image/Others/Logo/logo_white.png" alt="Logo">
                </a>
            </div>
            <ul>
                <li><a href="#Bio">Bio</a></li>
                <li><a href="#Photography">Photography</a></li>
                <li><a href="#Programming">Computing</a></li>
                <li><a href="#Architecture">Architecture</a></li>
                <li><a href="#Other">Art & Design</a></li>
                <li><a href="#Links">Links</a></li>
            </ul>
            `;
            break;
        case 1:
            document.querySelector('nav').innerHTML = `
            <div id="logo">
                <a href="index.html">
                    <img id="logo_hide" src="../image/Others/Logo/logo_black.png" alt="Logo">
                    <img id="logo_show" src="../image/Others/Logo/logo_white.png" alt="Logo">
                </a>
            </div>
            <ul>
                <li><a href="index.html#Bio">Bio</a></li>
                <li><a href="index.html#Photography">Photography</a></li>
                <li><a href="index.html#Programming">Computing</a></li>
                <li><a href="index.html#Architecture">Architecture</a></li>
                <li><a href="index.html#Other">Art & Design</a></li>
                <li><a href="index.html#Links">Links</a></li>
            </ul>
            `;
            break;
        case 2:
            document.querySelector('nav').innerHTML = `
            <div id="logo">
                <a href="../index.html">
                    <img id="logo_hide" src="../../image/Others/Logo/logo_black.png" alt="Logo">
                    <img id="logo_show" src="../../image/Others/Logo/logo_white.png" alt="Logo">
                </a>
            </div>
            <ul>
                <li><a href="../index.html#Bio">Bio</a></li>
                <li><a href="../index.html#Photography">Photography</a></li>
                <li><a href="../index.html#Programming">Computing</a></li>
                <li><a href="../index.html#Architecture">Architecture</a></li>
                <li><a href="../index.html#Other">Art & Design</a></li>
                <li><a href="../index.html#Links">Links</a></li>
            </ul>
            `;
            braek;
    }
}