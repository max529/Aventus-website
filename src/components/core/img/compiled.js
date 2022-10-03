class AvImg extends Aventus.WebComponent {
    static get observedAttributes() {return ["src", "mode"].concat(super.observedAttributes).filter((v, i, a) => a.indexOf(v) === i);}
    get 'src'() {
                        return this.getAttribute('src');
                    }
                    set 'src'(val) {
						if(val === undefined || val === null){this.removeAttribute('src')}
						else{this.setAttribute('src',val)}
                    }get 'display_bigger'() {
                        return this.hasAttribute('display_bigger');
                    }
                    set 'display_bigger'(val) {
                        if(val === 1 || val === 'true' || val === ''){
                            val = true;
                        }
                        else if(val === 0 || val === 'false' || val === null || val === undefined){
                            val = false;
                        }
                        if(val !== false && val !== true){
                            console.error("error setting boolean in display_bigger");
                            val = false;
                        }
                        if (val) {
                            this.setAttribute('display_bigger', 'true');
                        } else{
                            this.removeAttribute('display_bigger');
                        }
                    }get 'mode'() {
                        return this.getAttribute('mode');
                    }
                    set 'mode'(val) {
						if(val === undefined || val === null){this.removeAttribute('mode')}
						else{this.setAttribute('mode',val)}
                    }    __prepareVariables() { super.__prepareVariables(); if(this.bigImg === undefined) {this.bigImg = "undefined";}if(this.ratio === undefined) {this.ratio = 1;}if(this._maxCalculateSize === undefined) {this._maxCalculateSize = 10;}if(this._isCalculing === undefined) {this._isCalculing = false;}if(this.checkCloseBinded === undefined) {this.checkCloseBinded = undefined;} }
    __getStyle() {
        let arrStyle = super.__getStyle();
        arrStyle.push(`:host{--internal-img-color: var(--img-color);--internal-img-stroke-color: var(--img-stroke-color, var(--internal-img-color));--internal-img-fill-color: var(--img-fill-color, var(--internal-img-color));--internal-img-color-transition: var(--img-color-transition, none)}:host{display:inline-block;overflow:hidden;font-size:0;height:100%}:host *{box-sizing:border-box}:host img{opacity:0;transition:filter .3s linear}:host .svg{display:none;height:100%;width:100%}:host .svg svg{height:100%;width:100%}:host([src$=".svg"]) img{display:none}:host([src$=".svg"]) .svg{display:flex}:host([src$=".svg"]) .svg svg{transition:var(--internal-img-color-transition);stroke:var(--internal-img-stroke-color);fill:var(--internal-img-fill-color)}:host([display_bigger=true]) img{cursor:pointer}:host([display_bigger=true]) img:hover{filter:brightness(50%)}`);
        return arrStyle;
    }
    __getHtml() {
        let parentInfo = super.__getHtml();
        let info = {
            html: `<img _id="avimg_0">
<div class="svg" _id="avimg_1"></div>`,
            slots: {
            },
            blocks: {
                'default':`<img _id="avimg_0">
<div class="svg" _id="avimg_1"></div>`
            }
        }
        return info;
    }
    __getMaxId() {
        let temp = super.__getMaxId();
        temp.push(["AvImg", 2])
        return temp;
    }
    __mapSelectedElement() { super.__mapSelectedElement(); this.imgEl = this.shadowRoot.querySelector('[_id="avimg_0"]');this.svgEl = this.shadowRoot.querySelector('[_id="avimg_1"]');}
    __registerOnChange() { super.__registerOnChange(); this.__onChangeFct['src'] = []this.__onChangeFct['src'].push((path) => {((target) => {    if (target.src.endsWith(".svg")) {        AvRessourceManager.get(target.src).then((svgContent) => {            target.svgEl.innerHTML = svgContent;            target.calculateSize();        });    }    else if (target.src != "") {        AvRessourceManager.get(target.src).then((base64) => {            target.imgEl.setAttribute("src", base64);            target.calculateSize();        });    }})(this);})this.__onChangeFct['mode'] = []this.__onChangeFct['mode'].push((path) => {((target) => {    if (target.src != "") {        target.calculateSize();    }})(this);}) }
    __endConstructor() { super.__endConstructor(); (() => {    this.checkCloseBinded = this.checkClose.bind(this);})() }
    getClassName() {
        return "AvImg";
    }
    __defaultValue() { super.__defaultValue(); if(!this.hasAttribute('display_bigger')) { this.attributeChangedCallback('display_bigger', false, false); }if(!this.hasAttribute('mode')){ this['mode'] = 'contains'; } }
    __upgradeAttributes() { super.__upgradeAttributes(); this.__upgradeProperty('src');this.__upgradeProperty('mode'); }
    __listBoolProps() { return ["display_bigger"].concat(super.__listBoolProps()).filter((v, i, a) => a.indexOf(v) === i); }
     checkClose(e){if (e instanceof KeyboardEvent) {    if (e.key == 'Escape') {        this.close();    }}else {    let realTargetEl = e.realTarget();    if (realTargetEl != this.bigImg) {        this.close();    }}} close(){this.bigImg.style.opacity = '0';document.body.removeEventListener('click', this.checkCloseBinded);setTimeout(() => {    this.bigImg.remove();}, 710);} calculateSize(attempt){if (this._isCalculing) {    return;}if (this.src == "") {    return;}this._isCalculing = true;if (getComputedStyle(this).display == 'none') {    return;}if (attempt == this._maxCalculateSize) {    this._isCalculing = false;    return;}let element = this.imgEl;if (this.src.endsWith(".svg")) {    element = this.svgEl;}this.style.width = '';this.style.height = '';element.style.width = '';element.style.height = '';if (element.offsetWidth == 0 && element.offsetHeight == 0) {    setTimeout(() => {        this._isCalculing = false;        this.calculateSize(attempt + 1);    }, 100);    return;}let style = getComputedStyle(this);let addedY = Number(style.paddingTop.replace("px", "")) + Number(style.paddingBottom.replace("px", "")) + Number(style.borderTopWidth.replace("px", "")) + Number(style.borderBottomWidth.replace("px", ""));let addedX = Number(style.paddingLeft.replace("px", "")) + Number(style.paddingRight.replace("px", "")) + Number(style.borderLeftWidth.replace("px", "")) + Number(style.borderRightWidth.replace("px", ""));let availableHeight = this.offsetHeight - addedY;let availableWidth = this.offsetWidth - addedX;let sameWidth = (element.offsetWidth == availableWidth);let sameHeight = (element.offsetHeight == availableHeight);this.ratio = element.offsetWidth / element.offsetHeight;if (sameWidth && !sameHeight) {    element.style.width = (availableHeight * this.ratio) + 'px';    element.style.height = availableHeight + 'px';}else if (!sameWidth && sameHeight) {    element.style.width = availableWidth + 'px';    element.style.height = (availableWidth / this.ratio) + 'px';}else if (!sameWidth && !sameHeight) {    if (this.mode == "stretch") {        element.style.width = '100%';        element.style.height = '100%';    }    else if (this.mode == "contains") {        let newWidth = (availableHeight * this.ratio);        if (newWidth <= availableWidth) {            element.style.width = newWidth + 'px';            element.style.height = availableHeight + 'px';        }        else {            element.style.width = availableWidth + 'px';            element.style.height = (availableWidth / this.ratio) + 'px';        }    }    else if (this.mode == "cover") {        let newWidth = (availableHeight * this.ratio);        if (newWidth >= availableWidth) {            element.style.width = newWidth + 'px';            element.style.height = availableHeight + 'px';        }        else {            element.style.width = availableWidth + 'px';            element.style.height = (availableWidth / this.ratio) + 'px';        }    }}let diffTop = (this.offsetHeight - element.offsetHeight - addedY) / 2;let diffLeft = (this.offsetWidth - element.offsetWidth - addedX) / 2;element.style.transform = "translate(" + diffLeft + "px, " + diffTop + "px)";element.style.opacity = '1';this._isCalculing = false;} showImg(e){if (this.display_bigger) {    let target = e.currentTarget;    let position = target.getPositionOnScreen();    let div = document.createElement("DIV");    div.style.position = 'absolute';    div.style.top = position.y + 'px';    div.style.left = position.x + 'px';    div.style.width = target.offsetWidth + 'px';    div.style.height = target.offsetHeight + 'px';    div.style.backgroundImage = 'url(' + this.src + ')';    div.style.backgroundSize = 'contain';    div.style.backgroundRepeat = 'no-repeat';    div.style.zIndex = '502';    div.style.transition = 'all 0.7s cubic-bezier(0.65, 0, 0.15, 1)';    div.style.backgroundPosition = 'center';    div.style.backgroundColor = 'black';    this.bigImg = div;    document.body.appendChild(div);    setTimeout(() => {        div.style.top = '50px';        div.style.left = '50px';        div.style.width = 'calc(100% - 100px)';        div.style.height = 'calc(100% - 100px)';        document.body.addEventListener('click', this.checkCloseBinded);        document.body.addEventListener('keydown', this.checkCloseBinded);    }, 100);}} postCreation(){this.addEventListener("click", (e) => { this.showImg(e); });new ResizeObserver(() => {    this.calculateSize();}).observe(this);}}
window.customElements.define('av-img', AvImg);