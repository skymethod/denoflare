// deno-fmt-ignore-file
// deno-lint-ignore-file
// This code was bundled using `deno bundle` and it's not recommended to edit it manually

const directives = new WeakMap();
const isDirective = (o)=>{
    return typeof o === "function" && directives.has(o);
};
const isCEPolyfill = typeof window !== "undefined" && window.customElements != null && window.customElements.polyfillWrapFlushCallback !== void 0;
const reparentNodes = (container, start, end = null, before = null)=>{
    while(start !== end){
        const n = start.nextSibling;
        container.insertBefore(start, before);
        start = n;
    }
};
const removeNodes = (container, start, end = null)=>{
    while(start !== end){
        const n = start.nextSibling;
        container.removeChild(start);
        start = n;
    }
};
const noChange = {};
const nothing = {};
const marker = `{{lit-${String(Math.random()).slice(2)}}}`;
const nodeMarker = `<!--${marker}-->`;
const markerRegex = new RegExp(`${marker}|${nodeMarker}`);
const boundAttributeSuffix = "$lit$";
class Template {
    constructor(result, element){
        this.parts = [];
        this.element = element;
        const nodesToRemove = [];
        const stack = [];
        const walker = document.createTreeWalker(element.content, 133, null, false);
        let lastPartIndex = 0;
        let index = -1;
        let partIndex = 0;
        const { strings , values: { length  }  } = result;
        while(partIndex < length){
            const node = walker.nextNode();
            if (node === null) {
                walker.currentNode = stack.pop();
                continue;
            }
            index++;
            if (node.nodeType === 1) {
                if (node.hasAttributes()) {
                    const attributes = node.attributes;
                    const { length: length2  } = attributes;
                    let count = 0;
                    for(let i = 0; i < length2; i++){
                        if (endsWith(attributes[i].name, boundAttributeSuffix)) {
                            count++;
                        }
                    }
                    while(count-- > 0){
                        const stringForPart = strings[partIndex];
                        const name = lastAttributeNameRegex.exec(stringForPart)[2];
                        const attributeLookupName = name.toLowerCase() + boundAttributeSuffix;
                        const attributeValue = node.getAttribute(attributeLookupName);
                        node.removeAttribute(attributeLookupName);
                        const statics = attributeValue.split(markerRegex);
                        this.parts.push({
                            type: "attribute",
                            index,
                            name,
                            strings: statics
                        });
                        partIndex += statics.length - 1;
                    }
                }
                if (node.tagName === "TEMPLATE") {
                    stack.push(node);
                    walker.currentNode = node.content;
                }
            } else if (node.nodeType === 3) {
                const data = node.data;
                if (data.indexOf(marker) >= 0) {
                    const parent = node.parentNode;
                    const strings2 = data.split(markerRegex);
                    const lastIndex = strings2.length - 1;
                    for(let i1 = 0; i1 < lastIndex; i1++){
                        let insert;
                        let s = strings2[i1];
                        if (s === "") {
                            insert = createMarker();
                        } else {
                            const match = lastAttributeNameRegex.exec(s);
                            if (match !== null && endsWith(match[2], boundAttributeSuffix)) {
                                s = s.slice(0, match.index) + match[1] + match[2].slice(0, -boundAttributeSuffix.length) + match[3];
                            }
                            insert = document.createTextNode(s);
                        }
                        parent.insertBefore(insert, node);
                        this.parts.push({
                            type: "node",
                            index: ++index
                        });
                    }
                    if (strings2[lastIndex] === "") {
                        parent.insertBefore(createMarker(), node);
                        nodesToRemove.push(node);
                    } else {
                        node.data = strings2[lastIndex];
                    }
                    partIndex += lastIndex;
                }
            } else if (node.nodeType === 8) {
                if (node.data === marker) {
                    const parent1 = node.parentNode;
                    if (node.previousSibling === null || index === lastPartIndex) {
                        index++;
                        parent1.insertBefore(createMarker(), node);
                    }
                    lastPartIndex = index;
                    this.parts.push({
                        type: "node",
                        index
                    });
                    if (node.nextSibling === null) {
                        node.data = "";
                    } else {
                        nodesToRemove.push(node);
                        index--;
                    }
                    partIndex++;
                } else {
                    let i2 = -1;
                    while((i2 = node.data.indexOf(marker, i2 + 1)) !== -1){
                        this.parts.push({
                            type: "node",
                            index: -1
                        });
                        partIndex++;
                    }
                }
            }
        }
        for (const n of nodesToRemove){
            n.parentNode.removeChild(n);
        }
    }
}
const endsWith = (str, suffix)=>{
    const index = str.length - suffix.length;
    return index >= 0 && str.slice(index) === suffix;
};
const isTemplatePartActive = (part)=>part.index !== -1;
const createMarker = ()=>document.createComment("");
const lastAttributeNameRegex = /([ \x09\x0a\x0c\x0d])([^\0-\x1F\x7F-\x9F "'>=/]+)([ \x09\x0a\x0c\x0d]*=[ \x09\x0a\x0c\x0d]*(?:[^ \x09\x0a\x0c\x0d"'`<>=]*|"[^"]*|'[^']*))$/;
class TemplateInstance {
    constructor(template, processor, options){
        this.__parts = [];
        this.template = template;
        this.processor = processor;
        this.options = options;
    }
    update(values) {
        let i = 0;
        for (const part of this.__parts){
            if (part !== void 0) {
                part.setValue(values[i]);
            }
            i++;
        }
        for (const part1 of this.__parts){
            if (part1 !== void 0) {
                part1.commit();
            }
        }
    }
    _clone() {
        const fragment = isCEPolyfill ? this.template.element.content.cloneNode(true) : document.importNode(this.template.element.content, true);
        const stack = [];
        const parts2 = this.template.parts;
        const walker = document.createTreeWalker(fragment, 133, null, false);
        let partIndex = 0;
        let nodeIndex = 0;
        let part;
        let node = walker.nextNode();
        while(partIndex < parts2.length){
            part = parts2[partIndex];
            if (!isTemplatePartActive(part)) {
                this.__parts.push(void 0);
                partIndex++;
                continue;
            }
            while(nodeIndex < part.index){
                nodeIndex++;
                if (node.nodeName === "TEMPLATE") {
                    stack.push(node);
                    walker.currentNode = node.content;
                }
                if ((node = walker.nextNode()) === null) {
                    walker.currentNode = stack.pop();
                    node = walker.nextNode();
                }
            }
            if (part.type === "node") {
                const part2 = this.processor.handleTextExpression(this.options);
                part2.insertAfterNode(node.previousSibling);
                this.__parts.push(part2);
            } else {
                this.__parts.push(...this.processor.handleAttributeExpressions(node, part.name, part.strings, this.options));
            }
            partIndex++;
        }
        if (isCEPolyfill) {
            document.adoptNode(fragment);
            customElements.upgrade(fragment);
        }
        return fragment;
    }
}
const policy = window.trustedTypes && trustedTypes.createPolicy("lit-html", {
    createHTML: (s)=>s
});
const commentMarker = ` ${marker} `;
class TemplateResult {
    constructor(strings, values, type, processor){
        this.strings = strings;
        this.values = values;
        this.type = type;
        this.processor = processor;
    }
    getHTML() {
        const l = this.strings.length - 1;
        let html2 = "";
        let isCommentBinding = false;
        for(let i = 0; i < l; i++){
            const s = this.strings[i];
            const commentOpen = s.lastIndexOf("<!--");
            isCommentBinding = (commentOpen > -1 || isCommentBinding) && s.indexOf("-->", commentOpen + 1) === -1;
            const attributeMatch = lastAttributeNameRegex.exec(s);
            if (attributeMatch === null) {
                html2 += s + (isCommentBinding ? commentMarker : nodeMarker);
            } else {
                html2 += s.substr(0, attributeMatch.index) + attributeMatch[1] + attributeMatch[2] + boundAttributeSuffix + attributeMatch[3] + marker;
            }
        }
        html2 += this.strings[l];
        return html2;
    }
    getTemplateElement() {
        const template = document.createElement("template");
        let value = this.getHTML();
        if (policy !== void 0) {
            value = policy.createHTML(value);
        }
        template.innerHTML = value;
        return template;
    }
}
class SVGTemplateResult extends TemplateResult {
    getHTML() {
        return `<svg>${super.getHTML()}</svg>`;
    }
    getTemplateElement() {
        const template = super.getTemplateElement();
        const content = template.content;
        const svgElement = content.firstChild;
        content.removeChild(svgElement);
        reparentNodes(content, svgElement.firstChild);
        return template;
    }
}
const isPrimitive = (value)=>{
    return value === null || !(typeof value === "object" || typeof value === "function");
};
const isIterable = (value)=>{
    return Array.isArray(value) || !!(value && value[Symbol.iterator]);
};
class AttributeCommitter {
    constructor(element, name, strings){
        this.dirty = true;
        this.element = element;
        this.name = name;
        this.strings = strings;
        this.parts = [];
        for(let i = 0; i < strings.length - 1; i++){
            this.parts[i] = this._createPart();
        }
    }
    _createPart() {
        return new AttributePart(this);
    }
    _getValue() {
        const strings = this.strings;
        const l = strings.length - 1;
        const parts2 = this.parts;
        if (l === 1 && strings[0] === "" && strings[1] === "") {
            const v = parts2[0].value;
            if (typeof v === "symbol") {
                return String(v);
            }
            if (typeof v === "string" || !isIterable(v)) {
                return v;
            }
        }
        let text = "";
        for(let i = 0; i < l; i++){
            text += strings[i];
            const part = parts2[i];
            if (part !== void 0) {
                const v1 = part.value;
                if (isPrimitive(v1) || !isIterable(v1)) {
                    text += typeof v1 === "string" ? v1 : String(v1);
                } else {
                    for (const t of v1){
                        text += typeof t === "string" ? t : String(t);
                    }
                }
            }
        }
        text += strings[l];
        return text;
    }
    commit() {
        if (this.dirty) {
            this.dirty = false;
            this.element.setAttribute(this.name, this._getValue());
        }
    }
}
class AttributePart {
    constructor(committer){
        this.value = void 0;
        this.committer = committer;
    }
    setValue(value) {
        if (value !== noChange && (!isPrimitive(value) || value !== this.value)) {
            this.value = value;
            if (!isDirective(value)) {
                this.committer.dirty = true;
            }
        }
    }
    commit() {
        while(isDirective(this.value)){
            const directive2 = this.value;
            this.value = noChange;
            directive2(this);
        }
        if (this.value === noChange) {
            return;
        }
        this.committer.commit();
    }
}
class NodePart {
    constructor(options){
        this.value = void 0;
        this.__pendingValue = void 0;
        this.options = options;
    }
    appendInto(container) {
        this.startNode = container.appendChild(createMarker());
        this.endNode = container.appendChild(createMarker());
    }
    insertAfterNode(ref) {
        this.startNode = ref;
        this.endNode = ref.nextSibling;
    }
    appendIntoPart(part) {
        part.__insert(this.startNode = createMarker());
        part.__insert(this.endNode = createMarker());
    }
    insertAfterPart(ref) {
        ref.__insert(this.startNode = createMarker());
        this.endNode = ref.endNode;
        ref.endNode = this.startNode;
    }
    setValue(value) {
        this.__pendingValue = value;
    }
    commit() {
        if (this.startNode.parentNode === null) {
            return;
        }
        while(isDirective(this.__pendingValue)){
            const directive2 = this.__pendingValue;
            this.__pendingValue = noChange;
            directive2(this);
        }
        const value = this.__pendingValue;
        if (value === noChange) {
            return;
        }
        if (isPrimitive(value)) {
            if (value !== this.value) {
                this.__commitText(value);
            }
        } else if (value instanceof TemplateResult) {
            this.__commitTemplateResult(value);
        } else if (value instanceof Node) {
            this.__commitNode(value);
        } else if (isIterable(value)) {
            this.__commitIterable(value);
        } else if (value === nothing) {
            this.value = nothing;
            this.clear();
        } else {
            this.__commitText(value);
        }
    }
    __insert(node) {
        this.endNode.parentNode.insertBefore(node, this.endNode);
    }
    __commitNode(value) {
        if (this.value === value) {
            return;
        }
        this.clear();
        this.__insert(value);
        this.value = value;
    }
    __commitText(value) {
        const node = this.startNode.nextSibling;
        value = value == null ? "" : value;
        const valueAsString = typeof value === "string" ? value : String(value);
        if (node === this.endNode.previousSibling && node.nodeType === 3) {
            node.data = valueAsString;
        } else {
            this.__commitNode(document.createTextNode(valueAsString));
        }
        this.value = value;
    }
    __commitTemplateResult(value) {
        const template = this.options.templateFactory(value);
        if (this.value instanceof TemplateInstance && this.value.template === template) {
            this.value.update(value.values);
        } else {
            const instance = new TemplateInstance(template, value.processor, this.options);
            const fragment = instance._clone();
            instance.update(value.values);
            this.__commitNode(fragment);
            this.value = instance;
        }
    }
    __commitIterable(value) {
        if (!Array.isArray(this.value)) {
            this.value = [];
            this.clear();
        }
        const itemParts = this.value;
        let partIndex = 0;
        let itemPart;
        for (const item of value){
            itemPart = itemParts[partIndex];
            if (itemPart === void 0) {
                itemPart = new NodePart(this.options);
                itemParts.push(itemPart);
                if (partIndex === 0) {
                    itemPart.appendIntoPart(this);
                } else {
                    itemPart.insertAfterPart(itemParts[partIndex - 1]);
                }
            }
            itemPart.setValue(item);
            itemPart.commit();
            partIndex++;
        }
        if (partIndex < itemParts.length) {
            itemParts.length = partIndex;
            this.clear(itemPart && itemPart.endNode);
        }
    }
    clear(startNode = this.startNode) {
        removeNodes(this.startNode.parentNode, startNode.nextSibling, this.endNode);
    }
}
class BooleanAttributePart {
    constructor(element, name, strings){
        this.value = void 0;
        this.__pendingValue = void 0;
        if (strings.length !== 2 || strings[0] !== "" || strings[1] !== "") {
            throw new Error("Boolean attributes can only contain a single expression");
        }
        this.element = element;
        this.name = name;
        this.strings = strings;
    }
    setValue(value) {
        this.__pendingValue = value;
    }
    commit() {
        while(isDirective(this.__pendingValue)){
            const directive2 = this.__pendingValue;
            this.__pendingValue = noChange;
            directive2(this);
        }
        if (this.__pendingValue === noChange) {
            return;
        }
        const value = !!this.__pendingValue;
        if (this.value !== value) {
            if (value) {
                this.element.setAttribute(this.name, "");
            } else {
                this.element.removeAttribute(this.name);
            }
            this.value = value;
        }
        this.__pendingValue = noChange;
    }
}
class PropertyCommitter extends AttributeCommitter {
    constructor(element, name, strings){
        super(element, name, strings);
        this.single = strings.length === 2 && strings[0] === "" && strings[1] === "";
    }
    _createPart() {
        return new PropertyPart(this);
    }
    _getValue() {
        if (this.single) {
            return this.parts[0].value;
        }
        return super._getValue();
    }
    commit() {
        if (this.dirty) {
            this.dirty = false;
            this.element[this.name] = this._getValue();
        }
    }
}
class PropertyPart extends AttributePart {
}
let eventOptionsSupported = false;
(()=>{
    try {
        const options = {
            get capture () {
                eventOptionsSupported = true;
                return false;
            }
        };
        window.addEventListener("test", options, options);
        window.removeEventListener("test", options, options);
    } catch (_e) {}
})();
class EventPart {
    constructor(element, eventName, eventContext){
        this.value = void 0;
        this.__pendingValue = void 0;
        this.element = element;
        this.eventName = eventName;
        this.eventContext = eventContext;
        this.__boundHandleEvent = (e)=>this.handleEvent(e);
    }
    setValue(value) {
        this.__pendingValue = value;
    }
    commit() {
        while(isDirective(this.__pendingValue)){
            const directive2 = this.__pendingValue;
            this.__pendingValue = noChange;
            directive2(this);
        }
        if (this.__pendingValue === noChange) {
            return;
        }
        const newListener = this.__pendingValue;
        const oldListener = this.value;
        const shouldRemoveListener = newListener == null || oldListener != null && (newListener.capture !== oldListener.capture || newListener.once !== oldListener.once || newListener.passive !== oldListener.passive);
        const shouldAddListener = newListener != null && (oldListener == null || shouldRemoveListener);
        if (shouldRemoveListener) {
            this.element.removeEventListener(this.eventName, this.__boundHandleEvent, this.__options);
        }
        if (shouldAddListener) {
            this.__options = getOptions(newListener);
            this.element.addEventListener(this.eventName, this.__boundHandleEvent, this.__options);
        }
        this.value = newListener;
        this.__pendingValue = noChange;
    }
    handleEvent(event) {
        if (typeof this.value === "function") {
            this.value.call(this.eventContext || this.element, event);
        } else {
            this.value.handleEvent(event);
        }
    }
}
const getOptions = (o)=>o && (eventOptionsSupported ? {
        capture: o.capture,
        passive: o.passive,
        once: o.once
    } : o.capture);
class DefaultTemplateProcessor {
    handleAttributeExpressions(element, name, strings, options) {
        const prefix = name[0];
        if (prefix === ".") {
            const committer2 = new PropertyCommitter(element, name.slice(1), strings);
            return committer2.parts;
        }
        if (prefix === "@") {
            return [
                new EventPart(element, name.slice(1), options.eventContext)
            ];
        }
        if (prefix === "?") {
            return [
                new BooleanAttributePart(element, name.slice(1), strings)
            ];
        }
        const committer = new AttributeCommitter(element, name, strings);
        return committer.parts;
    }
    handleTextExpression(options) {
        return new NodePart(options);
    }
}
const defaultTemplateProcessor = new DefaultTemplateProcessor();
function templateFactory(result) {
    let templateCache = templateCaches.get(result.type);
    if (templateCache === void 0) {
        templateCache = {
            stringsArray: new WeakMap(),
            keyString: new Map()
        };
        templateCaches.set(result.type, templateCache);
    }
    let template = templateCache.stringsArray.get(result.strings);
    if (template !== void 0) {
        return template;
    }
    const key = result.strings.join(marker);
    template = templateCache.keyString.get(key);
    if (template === void 0) {
        template = new Template(result, result.getTemplateElement());
        templateCache.keyString.set(key, template);
    }
    templateCache.stringsArray.set(result.strings, template);
    return template;
}
const templateCaches = new Map();
const parts = new WeakMap();
const render = (result, container, options)=>{
    let part = parts.get(container);
    if (part === void 0) {
        removeNodes(container, container.firstChild);
        parts.set(container, part = new NodePart(Object.assign({
            templateFactory
        }, options)));
        part.appendInto(container);
    }
    part.setValue(result);
    part.commit();
};
if (typeof window !== "undefined") {
    (window["litHtmlVersions"] || (window["litHtmlVersions"] = [])).push("1.4.1");
}
const html = (strings, ...values)=>new TemplateResult(strings, values, "html", defaultTemplateProcessor);
const svg = (strings, ...values)=>new SVGTemplateResult(strings, values, "svg", defaultTemplateProcessor);
var _a;
window.JSCompiler_renameProperty = (prop, _obj)=>prop;
const defaultConverter = {
    toAttribute (value, type) {
        switch(type){
            case Boolean:
                return value ? "" : null;
            case Object:
            case Array:
                return value == null ? value : JSON.stringify(value);
        }
        return value;
    },
    fromAttribute (value, type) {
        switch(type){
            case Boolean:
                return value !== null;
            case Number:
                return value === null ? null : Number(value);
            case Object:
            case Array:
                return JSON.parse(value);
        }
        return value;
    }
};
const notEqual = (value, old)=>{
    return old !== value && (old === old || value === value);
};
const defaultPropertyDeclaration = {
    attribute: true,
    type: String,
    converter: defaultConverter,
    reflect: false,
    hasChanged: notEqual
};
const STATE_HAS_UPDATED = 1;
const STATE_UPDATE_REQUESTED = 1 << 2;
const STATE_IS_REFLECTING_TO_ATTRIBUTE = 1 << 3;
const STATE_IS_REFLECTING_TO_PROPERTY = 1 << 4;
const finalized = "finalized";
class UpdatingElement extends HTMLElement {
    constructor(){
        super();
        this.initialize();
    }
    static get observedAttributes() {
        this.finalize();
        const attributes = [];
        this._classProperties.forEach((v, p)=>{
            const attr = this._attributeNameForProperty(p, v);
            if (attr !== void 0) {
                this._attributeToPropertyMap.set(attr, p);
                attributes.push(attr);
            }
        });
        return attributes;
    }
    static _ensureClassProperties() {
        if (!this.hasOwnProperty(JSCompiler_renameProperty("_classProperties", this))) {
            this._classProperties = new Map();
            const superProperties = Object.getPrototypeOf(this)._classProperties;
            if (superProperties !== void 0) {
                superProperties.forEach((v, k)=>this._classProperties.set(k, v));
            }
        }
    }
    static createProperty(name, options = defaultPropertyDeclaration) {
        this._ensureClassProperties();
        this._classProperties.set(name, options);
        if (options.noAccessor || this.prototype.hasOwnProperty(name)) {
            return;
        }
        const key = typeof name === "symbol" ? Symbol() : `__${name}`;
        const descriptor = this.getPropertyDescriptor(name, key, options);
        if (descriptor !== void 0) {
            Object.defineProperty(this.prototype, name, descriptor);
        }
    }
    static getPropertyDescriptor(name, key, options) {
        return {
            get () {
                return this[key];
            },
            set (value) {
                const oldValue = this[name];
                this[key] = value;
                this.requestUpdateInternal(name, oldValue, options);
            },
            configurable: true,
            enumerable: true
        };
    }
    static getPropertyOptions(name) {
        return this._classProperties && this._classProperties.get(name) || defaultPropertyDeclaration;
    }
    static finalize() {
        const superCtor = Object.getPrototypeOf(this);
        if (!superCtor.hasOwnProperty(finalized)) {
            superCtor.finalize();
        }
        this[finalized] = true;
        this._ensureClassProperties();
        this._attributeToPropertyMap = new Map();
        if (this.hasOwnProperty(JSCompiler_renameProperty("properties", this))) {
            const props = this.properties;
            const propKeys = [
                ...Object.getOwnPropertyNames(props),
                ...typeof Object.getOwnPropertySymbols === "function" ? Object.getOwnPropertySymbols(props) : []
            ];
            for (const p of propKeys){
                this.createProperty(p, props[p]);
            }
        }
    }
    static _attributeNameForProperty(name, options) {
        const attribute = options.attribute;
        return attribute === false ? void 0 : typeof attribute === "string" ? attribute : typeof name === "string" ? name.toLowerCase() : void 0;
    }
    static _valueHasChanged(value, old, hasChanged = notEqual) {
        return hasChanged(value, old);
    }
    static _propertyValueFromAttribute(value, options) {
        const type = options.type;
        const converter = options.converter || defaultConverter;
        const fromAttribute = typeof converter === "function" ? converter : converter.fromAttribute;
        return fromAttribute ? fromAttribute(value, type) : value;
    }
    static _propertyValueToAttribute(value, options) {
        if (options.reflect === void 0) {
            return;
        }
        const type = options.type;
        const converter = options.converter;
        const toAttribute = converter && converter.toAttribute || defaultConverter.toAttribute;
        return toAttribute(value, type);
    }
    initialize() {
        this._updateState = 0;
        this._updatePromise = new Promise((res)=>this._enableUpdatingResolver = res);
        this._changedProperties = new Map();
        this._saveInstanceProperties();
        this.requestUpdateInternal();
    }
    _saveInstanceProperties() {
        this.constructor._classProperties.forEach((_v, p)=>{
            if (this.hasOwnProperty(p)) {
                const value = this[p];
                delete this[p];
                if (!this._instanceProperties) {
                    this._instanceProperties = new Map();
                }
                this._instanceProperties.set(p, value);
            }
        });
    }
    _applyInstanceProperties() {
        this._instanceProperties.forEach((v, p)=>this[p] = v);
        this._instanceProperties = void 0;
    }
    connectedCallback() {
        this.enableUpdating();
    }
    enableUpdating() {
        if (this._enableUpdatingResolver !== void 0) {
            this._enableUpdatingResolver();
            this._enableUpdatingResolver = void 0;
        }
    }
    disconnectedCallback() {}
    attributeChangedCallback(name, old, value) {
        if (old !== value) {
            this._attributeToProperty(name, value);
        }
    }
    _propertyToAttribute(name, value, options = defaultPropertyDeclaration) {
        const ctor = this.constructor;
        const attr = ctor._attributeNameForProperty(name, options);
        if (attr !== void 0) {
            const attrValue = ctor._propertyValueToAttribute(value, options);
            if (attrValue === void 0) {
                return;
            }
            this._updateState = this._updateState | STATE_IS_REFLECTING_TO_ATTRIBUTE;
            if (attrValue == null) {
                this.removeAttribute(attr);
            } else {
                this.setAttribute(attr, attrValue);
            }
            this._updateState = this._updateState & ~STATE_IS_REFLECTING_TO_ATTRIBUTE;
        }
    }
    _attributeToProperty(name, value) {
        if (this._updateState & STATE_IS_REFLECTING_TO_ATTRIBUTE) {
            return;
        }
        const ctor = this.constructor;
        const propName = ctor._attributeToPropertyMap.get(name);
        if (propName !== void 0) {
            const options = ctor.getPropertyOptions(propName);
            this._updateState = this._updateState | STATE_IS_REFLECTING_TO_PROPERTY;
            this[propName] = ctor._propertyValueFromAttribute(value, options);
            this._updateState = this._updateState & ~STATE_IS_REFLECTING_TO_PROPERTY;
        }
    }
    requestUpdateInternal(name, oldValue, options) {
        let shouldRequestUpdate = true;
        if (name !== void 0) {
            const ctor = this.constructor;
            options = options || ctor.getPropertyOptions(name);
            if (ctor._valueHasChanged(this[name], oldValue, options.hasChanged)) {
                if (!this._changedProperties.has(name)) {
                    this._changedProperties.set(name, oldValue);
                }
                if (options.reflect === true && !(this._updateState & STATE_IS_REFLECTING_TO_PROPERTY)) {
                    if (this._reflectingProperties === void 0) {
                        this._reflectingProperties = new Map();
                    }
                    this._reflectingProperties.set(name, options);
                }
            } else {
                shouldRequestUpdate = false;
            }
        }
        if (!this._hasRequestedUpdate && shouldRequestUpdate) {
            this._updatePromise = this._enqueueUpdate();
        }
    }
    requestUpdate(name, oldValue) {
        this.requestUpdateInternal(name, oldValue);
        return this.updateComplete;
    }
    async _enqueueUpdate() {
        this._updateState = this._updateState | STATE_UPDATE_REQUESTED;
        try {
            await this._updatePromise;
        } catch (e) {}
        const result = this.performUpdate();
        if (result != null) {
            await result;
        }
        return !this._hasRequestedUpdate;
    }
    get _hasRequestedUpdate() {
        return this._updateState & STATE_UPDATE_REQUESTED;
    }
    get hasUpdated() {
        return this._updateState & 1;
    }
    performUpdate() {
        if (!this._hasRequestedUpdate) {
            return;
        }
        if (this._instanceProperties) {
            this._applyInstanceProperties();
        }
        let shouldUpdate = false;
        const changedProperties = this._changedProperties;
        try {
            shouldUpdate = this.shouldUpdate(changedProperties);
            if (shouldUpdate) {
                this.update(changedProperties);
            } else {
                this._markUpdated();
            }
        } catch (e) {
            shouldUpdate = false;
            this._markUpdated();
            throw e;
        }
        if (shouldUpdate) {
            if (!(this._updateState & 1)) {
                this._updateState = this._updateState | STATE_HAS_UPDATED;
                this.firstUpdated(changedProperties);
            }
            this.updated(changedProperties);
        }
    }
    _markUpdated() {
        this._changedProperties = new Map();
        this._updateState = this._updateState & ~STATE_UPDATE_REQUESTED;
    }
    get updateComplete() {
        return this._getUpdateComplete();
    }
    _getUpdateComplete() {
        return this.getUpdateComplete();
    }
    getUpdateComplete() {
        return this._updatePromise;
    }
    shouldUpdate(_changedProperties) {
        return true;
    }
    update(_changedProperties) {
        if (this._reflectingProperties !== void 0 && this._reflectingProperties.size > 0) {
            this._reflectingProperties.forEach((v, k)=>this._propertyToAttribute(k, this[k], v));
            this._reflectingProperties = void 0;
        }
        this._markUpdated();
    }
    updated(_changedProperties) {}
    firstUpdated(_changedProperties) {}
}
_a = finalized;
UpdatingElement[_a] = true;
const ElementProto = Element.prototype;
ElementProto.msMatchesSelector || ElementProto.webkitMatchesSelector;
const supportsAdoptingStyleSheets = window.ShadowRoot && (window.ShadyCSS === void 0 || window.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype;
const constructionToken = Symbol();
class CSSResult {
    constructor(cssText, safeToken){
        if (safeToken !== constructionToken) {
            throw new Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
        }
        this.cssText = cssText;
    }
    get styleSheet() {
        if (this._styleSheet === void 0) {
            if (supportsAdoptingStyleSheets) {
                this._styleSheet = new CSSStyleSheet();
                this._styleSheet.replaceSync(this.cssText);
            } else {
                this._styleSheet = null;
            }
        }
        return this._styleSheet;
    }
    toString() {
        return this.cssText;
    }
}
const unsafeCSS = (value)=>{
    return new CSSResult(String(value), constructionToken);
};
const textFromCSSResult = (value)=>{
    if (value instanceof CSSResult) {
        return value.cssText;
    } else if (typeof value === "number") {
        return value;
    } else {
        throw new Error(`Value passed to 'css' function must be a 'css' function result: ${value}. Use 'unsafeCSS' to pass non-literal values, but
            take care to ensure page security.`);
    }
};
const css = (strings, ...values)=>{
    const cssText = values.reduce((acc, v, idx)=>acc + textFromCSSResult(v) + strings[idx + 1], strings[0]);
    return new CSSResult(cssText, constructionToken);
};
(window["litElementVersions"] || (window["litElementVersions"] = [])).push("2.5.1");
const renderNotImplemented = {};
class LitElement extends UpdatingElement {
    static getStyles() {
        return this.styles;
    }
    static _getUniqueStyles() {
        if (this.hasOwnProperty(JSCompiler_renameProperty("_styles", this))) {
            return;
        }
        const userStyles = this.getStyles();
        if (Array.isArray(userStyles)) {
            const addStyles = (styles2, set2)=>styles2.reduceRight((set3, s)=>Array.isArray(s) ? addStyles(s, set3) : (set3.add(s), set3), set2);
            const set = addStyles(userStyles, new Set());
            const styles = [];
            set.forEach((v)=>styles.unshift(v));
            this._styles = styles;
        } else {
            this._styles = userStyles === void 0 ? [] : [
                userStyles
            ];
        }
        this._styles = this._styles.map((s)=>{
            if (s instanceof CSSStyleSheet && !supportsAdoptingStyleSheets) {
                const cssText = Array.prototype.slice.call(s.cssRules).reduce((css2, rule)=>css2 + rule.cssText, "");
                return unsafeCSS(cssText);
            }
            return s;
        });
    }
    initialize() {
        super.initialize();
        this.constructor._getUniqueStyles();
        this.renderRoot = this.createRenderRoot();
        if (window.ShadowRoot && this.renderRoot instanceof window.ShadowRoot) {
            this.adoptStyles();
        }
    }
    createRenderRoot() {
        return this.attachShadow(this.constructor.shadowRootOptions);
    }
    adoptStyles() {
        const styles = this.constructor._styles;
        if (styles.length === 0) {
            return;
        }
        if (window.ShadyCSS !== void 0 && !window.ShadyCSS.nativeShadow) {
            window.ShadyCSS.ScopingShim.prepareAdoptedCssText(styles.map((s)=>s.cssText), this.localName);
        } else if (supportsAdoptingStyleSheets) {
            this.renderRoot.adoptedStyleSheets = styles.map((s)=>s instanceof CSSStyleSheet ? s : s.styleSheet);
        } else {
            this._needsShimAdoptedStyleSheets = true;
        }
    }
    connectedCallback() {
        super.connectedCallback();
        if (this.hasUpdated && window.ShadyCSS !== void 0) {
            window.ShadyCSS.styleElement(this);
        }
    }
    update(changedProperties) {
        const templateResult = this.render();
        super.update(changedProperties);
        if (templateResult !== renderNotImplemented) {
            this.constructor.render(templateResult, this.renderRoot, {
                scopeName: this.localName,
                eventContext: this
            });
        }
        if (this._needsShimAdoptedStyleSheets) {
            this._needsShimAdoptedStyleSheets = false;
            this.constructor._styles.forEach((s)=>{
                const style = document.createElement("style");
                style.textContent = s.cssText;
                this.renderRoot.appendChild(style);
            });
        }
    }
    render() {
        return renderNotImplemented;
    }
}
LitElement["finalized"] = true;
LitElement.render = render;
LitElement.shadowRootOptions = {
    mode: "open"
};
async function listDurableObjectsNamespaces(opts) {
    const { accountId , apiToken  } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/durable_objects/namespaces`;
    return (await execute('listDurableObjectsNamespaces', 'GET', url, apiToken)).result;
}
async function listScripts(opts) {
    const { accountId , apiToken  } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/scripts`;
    return (await execute('listScripts', 'GET', url, apiToken)).result;
}
async function listTails(opts) {
    const { accountId , apiToken , scriptName  } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/scripts/${scriptName}/tails`;
    return (await execute('listTails', 'GET', url, apiToken)).result;
}
async function createTail(opts) {
    const { accountId , apiToken , scriptName  } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/scripts/${scriptName}/tails`;
    return (await execute('createTail', 'POST', url, apiToken)).result;
}
class CloudflareApi {
    static DEBUG = false;
    static URL_TRANSFORMER = (v)=>v;
}
const APPLICATION_JSON = 'application/json';
const APPLICATION_JSON_UTF8 = 'application/json; charset=utf-8';
const APPLICATION_OCTET_STREAM = 'application/octet-stream';
const TEXT_PLAIN_UTF8 = 'text/plain; charset=utf-8';
function computeAccountBaseUrl(accountId) {
    return CloudflareApi.URL_TRANSFORMER(`https://api.cloudflare.com/client/v4/accounts/${accountId}`);
}
function isStringRecord(obj) {
    return typeof obj === 'object' && obj !== null && !Array.isArray(obj) && obj.constructor === Object;
}
async function execute(op, method, url, apiToken, body, responseType = 'json') {
    if (CloudflareApi.DEBUG) console.log(`${op}: ${method} ${url}`);
    const headers = new Headers({
        'Authorization': `Bearer ${apiToken}`
    });
    let bodyObj;
    if (typeof body === 'string') {
        headers.set('Content-Type', TEXT_PLAIN_UTF8);
    } else if (isStringRecord(body) || Array.isArray(body)) {
        headers.set('Content-Type', APPLICATION_JSON_UTF8);
        bodyObj = body;
        body = JSON.stringify(body, undefined, 2);
    }
    if (CloudflareApi.DEBUG) console.log([
        ...headers
    ].map((v)=>v.join(': ')).join('\n'));
    if (CloudflareApi.DEBUG && bodyObj) console.log(bodyObj);
    const fetchResponse = await fetch(url, {
        method,
        headers,
        body
    });
    if (CloudflareApi.DEBUG) console.log(`${fetchResponse.status} ${fetchResponse.url}`);
    if (CloudflareApi.DEBUG) console.log([
        ...fetchResponse.headers
    ].map((v)=>v.join(': ')).join('\n'));
    const contentType = fetchResponse.headers.get('Content-Type') || '';
    if (responseType === 'empty' && fetchResponse.status >= 200 && fetchResponse.status < 300) {
        if (contentType !== '') throw new Error(`Unexpected content-type (expected none): ${contentType}, fetchResponse=${fetchResponse}, body=${await fetchResponse.text()}`);
        const text = await fetchResponse.text();
        if (text !== '') throw new Error(`Unexpected body (expected none): ${text}, fetchResponse=${fetchResponse}, body=${text}`);
        return;
    }
    if ((responseType === 'bytes' || responseType === 'bytes?') && contentType === APPLICATION_OCTET_STREAM) {
        const buffer = await fetchResponse.arrayBuffer();
        return new Uint8Array(buffer);
    }
    if (responseType === 'text') {
        return await fetchResponse.text();
    }
    if (![
        APPLICATION_JSON_UTF8,
        APPLICATION_JSON
    ].includes(contentType.toLowerCase())) {
        throw new Error(`Unexpected content-type: ${contentType}, fetchResponse=${fetchResponse}, body=${await fetchResponse.text()}`);
    }
    const apiResponse = await fetchResponse.json();
    if (CloudflareApi.DEBUG) console.log(apiResponse);
    if (!apiResponse.success) {
        if (fetchResponse.status === 404 && [
            'bytes?',
            'json?'
        ].includes(responseType)) return undefined;
        throw new CloudflareApiError(`${op} failed: status=${fetchResponse.status}, errors=${apiResponse.errors.map((v)=>`${v.code} ${v.message}`).join(', ')}`, fetchResponse.status, apiResponse.errors);
    }
    return apiResponse;
}
class CloudflareApiError extends Error {
    status;
    errors;
    constructor(message, status, errors){
        super(message);
        this.status = status;
        this.errors = errors;
    }
}
function setSubtract(lhs, rhs) {
    const rt = new Set(lhs);
    for (const item of rhs){
        rt.delete(item);
    }
    return rt;
}
function setUnion(lhs, rhs) {
    const rt = new Set(lhs);
    for (const item of rhs){
        rt.add(item);
    }
    return rt;
}
function setIntersect(lhs, rhs) {
    const rt = new Set();
    for (const item of lhs){
        if (rhs.has(item)) rt.add(item);
    }
    for (const item1 of rhs){
        if (lhs.has(item1)) rt.add(item1);
    }
    return rt;
}
function setEqual(lhs, rhs) {
    return lhs.size === rhs.size && [
        ...lhs
    ].every((v)=>rhs.has(v));
}
function parseHeaderFilter(header) {
    const i = header.indexOf(':');
    if (i < 0) return {
        key: header
    };
    const key = header.substring(0, i).trim();
    const query = header.substring(i + 1).trim();
    return {
        key,
        query
    };
}
const REQUIRED_TAIL_MESSAGE_KEYS = new Set([
    'outcome',
    'scriptName',
    'exceptions',
    'logs',
    'eventTimestamp',
    'event'
]);
const KNOWN_OUTCOMES = new Set([
    'ok',
    'exception',
    'exceededCpu',
    'canceled',
    'unknown'
]);
function parseTailMessage(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessage: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_KEYS);
    const objAsAny = obj;
    const { outcome , scriptName , eventTimestamp  } = objAsAny;
    if (!KNOWN_OUTCOMES.has(outcome)) throw new Error(`Bad outcome: expected one of [${[
        ...KNOWN_OUTCOMES
    ].join(', ')}], found ${JSON.stringify(outcome)}`);
    if (scriptName !== null && typeof scriptName !== 'string') throw new Error(`Bad scriptName: expected string or null, found ${JSON.stringify(scriptName)}`);
    const logs = parseLogs(objAsAny.logs);
    const exceptions = parseExceptions(objAsAny.exceptions);
    if (eventTimestamp === null && objAsAny.event === null) {
        return {
            outcome,
            scriptName,
            exceptions,
            logs,
            eventTimestamp: Date.now(),
            event: null
        };
    }
    if (!(typeof eventTimestamp === 'number' && eventTimestamp > 0)) throw new Error(`Bad eventTimestamp: expected positive number, found ${JSON.stringify(eventTimestamp)}`);
    const event = objAsAny.event && objAsAny.event.request ? parseTailMessageRequestEvent(objAsAny.event) : objAsAny.event && objAsAny.event.queue ? parseTailMessageQueueEvent(objAsAny.event) : objAsAny.event && objAsAny.event.cron ? parseTailMessageCronEvent(objAsAny.event) : parseTailMessageAlarmEvent(objAsAny.event);
    return {
        outcome,
        scriptName,
        exceptions,
        logs,
        eventTimestamp,
        event
    };
}
function parseLogs(obj) {
    if (!Array.isArray(obj)) throw new Error(`Bad logs: expected array, found ${JSON.stringify(obj)}`);
    return [
        ...obj
    ].map(parseTailMessageLog);
}
function parseExceptions(obj) {
    if (!Array.isArray(obj)) throw new Error(`Bad exceptions: expected array, found ${JSON.stringify(obj)}`);
    return [
        ...obj
    ].map(parseTailMessageException);
}
function isLogMessagePart(value) {
    const t = typeof value;
    return t === 'string' || t === 'number' || t === 'boolean' || t === 'undefined' || t === 'object';
}
const REQUIRED_TAIL_MESSAGE_LOG_KEYS = new Set([
    'message',
    'level',
    'timestamp'
]);
function parseTailMessageLog(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessageLog: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_LOG_KEYS);
    const objAsAny = obj;
    const message = parseLogMessagePartArray(objAsAny.message, 'message');
    const { level , timestamp  } = objAsAny;
    if (!(typeof level === 'string')) throw new Error(`Bad level: expected string, found ${JSON.stringify(level)}`);
    if (!(typeof timestamp === 'number' && timestamp > 0)) throw new Error(`Bad timestamp: expected positive number, found ${JSON.stringify(timestamp)}`);
    return {
        message,
        level,
        timestamp
    };
}
const REQUIRED_TAIL_MESSAGE_EXCEPTION_KEYS = new Set([
    'name',
    'message',
    'timestamp'
]);
function parseTailMessageException(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessageException: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_EXCEPTION_KEYS);
    const objAsAny = obj;
    const { name , message , timestamp  } = objAsAny;
    if (!(typeof name === 'string')) throw new Error(`Bad name: expected string, found ${JSON.stringify(name)}`);
    if (!(typeof message === 'string')) throw new Error(`Bad message: expected string, found ${JSON.stringify(message)}`);
    if (!(typeof timestamp === 'number' && timestamp > 0)) throw new Error(`Bad timestamp: expected positive number, found ${JSON.stringify(timestamp)}`);
    return {
        name,
        message,
        timestamp
    };
}
const REQUIRED_TAIL_MESSAGE_QUEUE_EVENT_KEYS = new Set([
    'batchSize',
    'queue'
]);
function isTailMessageQueueEvent(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
    const keys = new Set(Object.keys(obj));
    return setEqual(keys, REQUIRED_TAIL_MESSAGE_QUEUE_EVENT_KEYS);
}
function parseTailMessageQueueEvent(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessageQueueEvent: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_QUEUE_EVENT_KEYS);
    const objAsAny = obj;
    const { batchSize , queue  } = objAsAny;
    if (!(typeof batchSize === 'number' && batchSize > 0)) throw new Error(`Bad batchSize: expected positive number, found ${JSON.stringify(batchSize)}`);
    if (!(typeof queue === 'string')) throw new Error(`Bad queue: expected string, found ${JSON.stringify(queue)}`);
    return {
        batchSize,
        queue
    };
}
const REQUIRED_TAIL_MESSAGE_ALARM_EVENT_KEYS = new Set([
    'scheduledTime'
]);
function isTailMessageAlarmEvent(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
    const keys = new Set(Object.keys(obj));
    return setEqual(keys, REQUIRED_TAIL_MESSAGE_ALARM_EVENT_KEYS);
}
function parseTailMessageAlarmEvent(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessageAlarmEvent: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_ALARM_EVENT_KEYS);
    const objAsAny = obj;
    const { scheduledTime  } = objAsAny;
    if (!(typeof scheduledTime === 'string')) throw new Error(`Bad scheduledTime: expected string, found ${JSON.stringify(scheduledTime)}`);
    return {
        scheduledTime
    };
}
const REQUIRED_TAIL_MESSAGE_CRON_EVENT_KEYS = new Set([
    'cron',
    'scheduledTime'
]);
function isTailMessageCronEvent(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
    const keys = new Set(Object.keys(obj));
    return setEqual(keys, REQUIRED_TAIL_MESSAGE_CRON_EVENT_KEYS);
}
function parseTailMessageCronEvent(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessageCronEvent: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_CRON_EVENT_KEYS);
    const objAsAny = obj;
    const { cron , scheduledTime  } = objAsAny;
    if (!(typeof cron === 'string')) throw new Error(`Bad cron: expected string, found ${JSON.stringify(cron)}`);
    if (!(typeof scheduledTime === 'number' && scheduledTime > 0)) throw new Error(`Bad scheduledTime: expected positive number, found ${JSON.stringify(scheduledTime)}`);
    return {
        cron,
        scheduledTime
    };
}
const REQUIRED_TAIL_MESSAGE_REQUEST_EVENT_KEYS = new Set([
    'request'
]);
const OPTIONAL_TAIL_MESSAGE_REQUEST_EVENT_KEYS = new Set([
    'response'
]);
const ALL_TAIL_MESSAGE_REQUEST_EVENT_KEYS = setUnion(REQUIRED_TAIL_MESSAGE_REQUEST_EVENT_KEYS, OPTIONAL_TAIL_MESSAGE_REQUEST_EVENT_KEYS);
function parseTailMessageRequestEvent(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessageRequestEvent: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_REQUEST_EVENT_KEYS, ALL_TAIL_MESSAGE_REQUEST_EVENT_KEYS);
    const objAsAny = obj;
    const request = parseTailMessageEventRequest(objAsAny.request);
    const response = parseTailMessageEventResponse(objAsAny.response);
    return {
        request,
        response
    };
}
const REQUIRED_TAIL_MESSAGE_EVENT_REQUEST_KEYS = new Set([
    'url',
    'method',
    'headers'
]);
const OPTIONAL_TAIL_MESSAGE_EVENT_REQUEST_KEYS = new Set([
    'cf'
]);
const ALL_TAIL_MESSAGE_EVENT_REQUEST_KEYS = setUnion(REQUIRED_TAIL_MESSAGE_EVENT_REQUEST_KEYS, OPTIONAL_TAIL_MESSAGE_EVENT_REQUEST_KEYS);
function parseTailMessageEventRequest(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessageEventRequest: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_EVENT_REQUEST_KEYS, ALL_TAIL_MESSAGE_EVENT_REQUEST_KEYS);
    const objAsAny = obj;
    const { url , method  } = objAsAny;
    if (!(typeof url === 'string')) throw new Error(`Bad url: expected string, found ${JSON.stringify(url)}`);
    if (!(typeof method === 'string')) throw new Error(`Bad method: expected string, found ${JSON.stringify(method)}`);
    const headers = parseStringRecord(objAsAny.headers, 'headers');
    const cf = objAsAny.cf === undefined ? undefined : parseIncomingRequestCfProperties(objAsAny.cf);
    return {
        url,
        method,
        headers,
        cf
    };
}
const REQUIRED_TAIL_MESSAGE_EVENT_RESPONSE_KEYS = new Set([
    'status'
]);
function parseTailMessageEventResponse(obj) {
    if (obj === undefined) return undefined;
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessageEventResponse: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_EVENT_RESPONSE_KEYS);
    const objAsAny = obj;
    const { status  } = objAsAny;
    if (!(typeof status === 'number')) throw new Error(`Bad status: expected number, found ${JSON.stringify(status)}`);
    return {
        status
    };
}
function checkKeys(obj, requiredKeys, allKeys) {
    const keys = new Set(Object.keys(obj));
    const missingKeys = setSubtract(requiredKeys, keys);
    if (missingKeys.size > 0) throw new Error(`Missing keys: ${[
        ...missingKeys
    ].join(', ')}`);
    const extraKeys = setSubtract(keys, allKeys || requiredKeys);
    if (extraKeys.size > 0) throw new Error(`Extra keys: ${[
        ...extraKeys
    ].join(', ')}`);
}
function parseStringRecord(obj, name) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad ${name}: Expected string record, found ${JSON.stringify(obj)}`);
    for (const [_, value] of Object.entries(obj)){
        if (typeof value !== 'string') throw new Error(`Bad ${name}: Expected string record, found ${JSON.stringify(obj)}`);
    }
    return obj;
}
function parseLogMessagePartArray(obj, name) {
    if (typeof obj !== 'object' || !Array.isArray(obj)) throw new Error(`Bad ${name}: Expected log message part array, found ${JSON.stringify(obj)}`);
    for (const value of obj){
        if (!isLogMessagePart(value)) throw new Error(`Bad ${name}: Expected log message part array, found ${JSON.stringify(obj)}`);
    }
    return obj;
}
function parseIncomingRequestCfProperties(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad cf: Expected object, found ${JSON.stringify(obj)}`);
    return obj;
}
function dumpMessagePretty(message, logger, additionalLogs = []) {
    const time = formatLocalYyyyMmDdHhMmSs(new Date(message.eventTimestamp));
    const outcome = PRETTY_OUTCOMES.get(message.outcome) || message.outcome;
    const outcomeColor = message.outcome === 'ok' ? 'green' : 'red';
    const { props , remainingLogs  } = parseLogProps(message.logs);
    if (isTailMessageCronEvent(message.event)) {
        const colo = props.colo || '???';
        logger(`[%c${time}%c] [%c${colo}%c] [%c${outcome}%c] %c${message.event.cron}`, 'color: gray', '', 'color: gray', '', `color: ${outcomeColor}`, '', 'color: red; font-style: bold;');
    } else if (isTailMessageAlarmEvent(message.event)) {
        const colo1 = props.colo || '???';
        logger(`[%c${time}%c] [%c${colo1}%c] [%c${outcome}%c] %c${message.event.scheduledTime}`, 'color: gray', '', 'color: gray', '', `color: ${outcomeColor}`, '', 'color: red; font-style: bold;');
    } else if (isTailMessageQueueEvent(message.event)) {
        const colo2 = props.colo || '???';
        const { queue , batchSize  } = message.event;
        logger(`[%c${time}%c] [%c${colo2}%c] [%c${outcome}%c] %c${queue} ${batchSize} message${batchSize === 1 ? '' : 's'}`, 'color: gray', '', 'color: gray', '', `color: ${outcomeColor}`, '', 'color: red; font-style: bold;');
    } else {
        const { method , url , cf  } = message.event === null || isTailMessageCronEvent(message.event) || isTailMessageAlarmEvent(message.event) || isTailMessageQueueEvent(message.event) ? {
            method: undefined,
            url: undefined,
            cf: undefined
        } : message.event.request;
        const unredactedUrl = typeof props.url === 'string' ? props.url : url;
        const colo3 = cf?.colo || props.colo || '???';
        if (cf === undefined) {
            const { durableObjectClass , durableObjectName , durableObjectId  } = computeDurableObjectInfo(props);
            const doTemplates = [];
            const doStyles = [];
            if (durableObjectClass) {
                doTemplates.push(`%c${durableObjectClass}%c`);
                doStyles.push(`color: gray; x-durable-object-class: '${durableObjectClass}'`, '');
            }
            if (durableObjectName) {
                doTemplates.push(`%c${durableObjectName}%c`);
                doStyles.push(`color: gray; x-durable-object-name: '${durableObjectName}'`, '');
            }
            if (durableObjectId) {
                doTemplates.push(`%c${computeShortDurableObjectId(durableObjectId)}%c`);
                doStyles.push(`color: gray; x-durable-object-id: '${durableObjectId}'`, '');
            }
            if (doTemplates.length === 0) {
                doTemplates.push(`%cDO%c`);
                doStyles.push('color: gray', '');
            }
            if (message.event === null) {
                logger(`[%c${time}%c] [%c${colo3}%c] [%c${outcome}%c] [${doTemplates.join(' ')}] ALARM`, 'color: gray', '', 'color: gray', '', `color: ${outcomeColor}`, '', ...doStyles);
            } else {
                logger(`[%c${time}%c] [%c${colo3}%c] [%c${outcome}%c] [${doTemplates.join(' ')}] ${method} %c${unredactedUrl}`, 'color: gray', '', 'color: gray', '', `color: ${outcomeColor}`, '', ...doStyles, 'color: red; font-style: bold;');
            }
        } else {
            logger(`[%c${time}%c] [%c${colo3}%c] [%c${outcome}%c] ${method} %c${unredactedUrl}`, 'color: gray', '', 'color: gray', '', `color: ${outcomeColor}`, '', 'color: red; font-style: bold;');
        }
    }
    for (const { data  } of additionalLogs){
        logger(...data);
    }
    for (const { level , message: logMessage  } of remainingLogs){
        const levelColor = LOG_LEVEL_COLORS.get(level) || 'gray';
        const logMessages = logMessage.map(formatLogMessagePart).join(', ');
        logger(` %c|%c [%c${level}%c] ${logMessages}`, 'color: gray', '', `color: ${levelColor}`, '');
    }
    for (const { name , message: exceptionMessage  } of message.exceptions){
        logger(` %c|%c [%c${name}%c] %c${exceptionMessage}`, 'color: gray', '', `color: red; font-style: bold`, '', 'color: red');
    }
    if (message.event) {
        if (isTailMessageCronEvent(message.event)) {
            const { scheduledTime , cron  } = message.event;
            const scheduledInstant = new Date(scheduledTime).toISOString();
            logger(` %c|%c [%ccron%c] %c${cron} ${scheduledInstant}`, 'color: gray', '', `color: gray`, '', 'color: gray');
        } else if (isTailMessageAlarmEvent(message.event)) {
            const { scheduledTime: scheduledTime1  } = message.event;
            logger(` %c|%c [%calarm%c] %c${scheduledTime1}`, 'color: gray', '', `color: gray`, '', 'color: gray');
        } else if (isTailMessageQueueEvent(message.event)) {
            const { batchSize: batchSize1 , queue: queue1  } = message.event;
            logger(` %c|%c [%cqueue%c] %c${queue1} ${batchSize1} message${batchSize1 === 1 ? '' : 's'}`, 'color: gray', '', `color: gray`, '', 'color: gray');
        } else {
            const response = message.event.response;
            if (response) {
                logger(` %c|%c [%cres%c] %c${response.status}`, 'color: gray', '', `color: gray`, '', 'color: gray');
            }
        }
    }
}
function formatLocalYyyyMmDdHhMmSs(date) {
    return [
        date.getFullYear(),
        '-',
        pad2(date.getMonth() + 1),
        '-',
        pad2(date.getDate()),
        ' ',
        pad2(date.getHours()),
        ':',
        pad2(date.getMinutes()),
        ':',
        pad2(date.getSeconds())
    ].join('');
}
function parseLogProps(logs) {
    const remainingLogs = [];
    const props = {};
    for (const log of logs){
        if (log.message.length > 0) {
            const msg = log.message[0];
            if (typeof msg === 'string' && msg.startsWith('logprops:')) {
                const trailer = msg.substring(msg.indexOf(':') + 1);
                const trailerProps = tryParsePropsFromJson(trailer);
                appendProps(trailerProps, props);
                for (const part of log.message.slice(1)){
                    const partProps = tryParsePropsFromPart(part);
                    appendProps(partProps, props);
                }
                continue;
            }
        }
        remainingLogs.push(log);
    }
    return {
        props,
        remainingLogs
    };
}
function computeDurableObjectInfo(props) {
    const durableObjectClass = undefinedIfEmpty((typeof props.durableObjectClass === 'string' ? props.durableObjectClass : '').trim());
    const durableObjectId = undefinedIfEmpty((typeof props.durableObjectId === 'string' ? props.durableObjectId : '').trim());
    const durableObjectName = undefinedIfEmpty((typeof props.durableObjectName === 'string' ? props.durableObjectName : '').trim());
    return {
        durableObjectClass,
        durableObjectId,
        durableObjectName
    };
}
function undefinedIfEmpty(str) {
    return str === '' ? undefined : str;
}
function computeShortDurableObjectId(id) {
    return /^[0-9a-fA-F]{5,}$/.test(id) ? `${id.substring(0, 4)}…` : id;
}
function appendProps(src, dst) {
    if (src) {
        for (const [key, value] of Object.entries(src)){
            dst[key] = value;
        }
    }
}
function tryParsePropsFromJson(value) {
    try {
        const props = JSON.parse(value.trim());
        if (typeof props === 'object' && props !== null && !Array.isArray(props)) {
            return props;
        }
    } catch  {}
    return undefined;
}
function tryParsePropsFromPart(part) {
    try {
        if (typeof part === 'object' && part !== null && !Array.isArray(part)) {
            return part;
        }
    } catch  {}
    return undefined;
}
function formatLogMessagePart(part) {
    if (typeof part === 'object') return JSON.stringify(part);
    return `${part}`;
}
function pad2(num) {
    return num.toString().padStart(2, '0');
}
const PRETTY_OUTCOMES = new Map([
    [
        'ok',
        'Ok'
    ],
    [
        'exception',
        'Error'
    ],
    [
        'exceededCpu',
        'Exceeded Limit'
    ],
    [
        'canceled',
        'Canceled'
    ],
    [
        'unknown',
        'Unknown'
    ]
]);
const LOG_LEVEL_COLORS = new Map([
    [
        'trace',
        'gray'
    ],
    [
        'debug',
        'purple'
    ],
    [
        'log',
        'gray'
    ],
    [
        'info',
        'gray'
    ],
    [
        'warn',
        'red'
    ],
    [
        'error',
        'red'
    ]
]);
class TailConnection {
    static VERBOSE = false;
    ws;
    callbacks;
    options;
    heartbeatId;
    constructor(webSocketUrl, callbacks, opts){
        this.ws = new WebSocket(webSocketUrl, 'trace-v1');
        this.callbacks = callbacks;
        const { websocketPingIntervalSeconds  } = opts;
        this.ws.addEventListener('open', (event)=>{
            const { timeStamp  } = event;
            this.sendOptionsIfOpen();
            if (callbacks.onOpen) {
                callbacks.onOpen(this, timeStamp);
            }
            if (websocketPingIntervalSeconds > 0) {
                if (TailConnection.VERBOSE) console.log(formatLocalYyyyMmDdHhMmSs(new Date()), `sending ws ping {} every ${websocketPingIntervalSeconds}`);
                this.heartbeatId = setInterval(()=>{
                    if (this.ws.readyState === WebSocket.OPEN) {
                        if (TailConnection.VERBOSE) console.log(formatLocalYyyyMmDdHhMmSs(new Date()), `sending ws ping {}`);
                        this.ws.send('{}');
                    }
                }, websocketPingIntervalSeconds * 1000);
            }
        });
        this.ws.addEventListener('close', (event)=>{
            const { code , reason , wasClean , timeStamp  } = event;
            if (TailConnection.VERBOSE) console.log(formatLocalYyyyMmDdHhMmSs(new Date()), 'TailConnection: ws close', {
                code,
                reason,
                wasClean,
                timeStamp
            });
            clearInterval(this.heartbeatId);
            if (callbacks.onClose) {
                callbacks.onClose(this, timeStamp, code, reason, wasClean);
            }
        });
        this.ws.addEventListener('error', (event)=>{
            const { timeStamp  } = event;
            const errorInfo = computeErrorInfo(event);
            if (TailConnection.VERBOSE) console.log(formatLocalYyyyMmDdHhMmSs(new Date()), 'TailConnection: ws error', errorInfo);
            if (callbacks.onError) {
                callbacks.onError(this, timeStamp, errorInfo);
            }
        });
        this.ws.addEventListener('message', async (event)=>{
            const { timeStamp  } = event;
            if (event.data instanceof Blob) {
                const text = await event.data.text();
                const obj = JSON.parse(text);
                let message;
                try {
                    message = parseTailMessage(obj);
                } catch (e) {
                    callbacks.onUnparsedMessage(this, timeStamp, obj, e);
                    return;
                }
                callbacks.onTailMessage(this, timeStamp, message);
            } else {
                callbacks.onUnparsedMessage(this, timeStamp, event.data, new Error(`Expected event.data to be Blob`));
            }
        });
    }
    setOptions(options) {
        this.options = options;
        this.sendOptionsIfOpen();
        return this;
    }
    close(code, reason) {
        this.ws.close(code, reason);
    }
    sendOptionsIfOpen() {
        if (this.options && this.ws.readyState === WebSocket.OPEN) {
            const payload = JSON.stringify(this.options);
            if (TailConnection.VERBOSE) console.log(`sendOptionsIfOpen: sending ${payload}`);
            this.ws.send(payload);
        }
    }
}
function computeErrorInfo(event) {
    if (event.type === 'error') {
        const { message , filename , lineno , colno , error  } = event;
        return {
            message,
            filename,
            lineno,
            colno,
            error
        };
    }
    return undefined;
}
function generateUuid() {
    const cryptoAsAny = crypto;
    if (typeof cryptoAsAny.randomUUID === 'function') {
        return cryptoAsAny.randomUUID();
    }
    const rnds = crypto.getRandomValues(new Uint8Array(16));
    rnds[6] = rnds[6] & 0x0f | 0x40;
    rnds[8] = rnds[8] & 0x3f | 0x80;
    return bytesToUuid(rnds);
}
function bytesToUuid(bytes) {
    const bits = [
        ...bytes
    ].map((bit)=>{
        const s = bit.toString(16);
        return bit < 0x10 ? "0" + s : s;
    });
    return [
        ...bits.slice(0, 4),
        "-",
        ...bits.slice(4, 6),
        "-",
        ...bits.slice(6, 8),
        "-",
        ...bits.slice(8, 10),
        "-",
        ...bits.slice(10, 16)
    ].join("");
}
function checkEqual(name, value, expected) {
    if (value !== expected) throw new Error(`Bad ${name}: expected ${expected}, found ${value}`);
}
function checkMatches(name, value, pattern) {
    if (!pattern.test(value)) throw new Error(`Bad ${name}: ${value}`);
    return value;
}
class GraphqlQuery {
    _parent;
    _nodes;
    _nodeOrder;
    _args;
    _argOrder;
    constructor(parent, nodes, nodeOrder, args, argOrder){
        this._parent = parent;
        this._nodes = nodes;
        this._nodeOrder = nodeOrder;
        this._args = args;
        this._argOrder = argOrder;
    }
    static create() {
        return new GraphqlQuery([], new Map(), [], new Map(), []);
    }
    scalar(name) {
        this.add(name, NodeKind.Scalar);
        return this;
    }
    object(name) {
        const node = this.add(name, NodeKind.Object);
        const rt = new GraphqlQuery([
            this
        ], new Map(), [], new Map(), []);
        node.query.push(rt);
        return rt;
    }
    objectQuery(name, query) {
        const node = this.add(name, NodeKind.Object);
        const q = query.copyWithParent(this);
        const rt = q;
        node.query.push(rt);
        return rt;
    }
    argRaw(name, rawValue) {
        return this.addArg(name, rawValue);
    }
    argBoolean(name, value) {
        return this.addArg(name, value ? 'true' : 'false');
    }
    argLong(name, value) {
        return this.addArg(name, `${value}`);
    }
    argString(name, value) {
        return this.addArg(name, `"${value.replaceAll('"', '\\"')}"`);
    }
    argObject(name, fieldName, fieldValue) {
        return this.addArg(name, `{${fieldName}:"${fieldValue.replaceAll('"', '\\"')}"}`);
    }
    argVariable(name, variableName) {
        checkMatches('variableName', variableName, /^[a-z]+$/);
        return this.addArg(name, `$${variableName}`);
    }
    end() {
        return this._parent.length > 0 ? this._parent[0] : this;
    }
    top() {
        let rt = this;
        while(rt._parent.length > 0){
            rt = rt._parent[0];
        }
        return rt;
    }
    toString() {
        const lines = [];
        lines.push('{');
        this.write(lines, 1);
        lines.push('}');
        return lines.join('\n');
    }
    addArg(name, value) {
        if (this._args.has(name)) throw new Error(`Duplicate arg: ${name}`);
        this._argOrder.push(name);
        this._args.set(name, value);
        return this;
    }
    write(lines, level) {
        const indent = '  '.repeat(level);
        for (const key of this._nodeOrder){
            const node = checkGet('_nodes', this._nodes, key);
            if (node.kind === NodeKind.Scalar) {
                lines.push(`${indent}${key}`);
            } else if (node.kind === NodeKind.Object) {
                const q = node.query[0];
                let line = `${indent}${key}`;
                if (q._argOrder.length > 0) {
                    line += '(';
                    let j = 0;
                    for (const argName of q._argOrder){
                        if (j > 0) line += ', ';
                        line += `${argName}: ${checkGet('q._args', q._args, argName)}`;
                        j++;
                    }
                    line += ')';
                }
                line += ' {';
                lines.push(line);
                node.query[0].write(lines, level + 1);
                lines.push(`${indent}}`);
            } else {
                throw new Error(`Implement node kind ${node.kind}`);
            }
        }
    }
    add(name, kind) {
        if (this._nodes.has(name)) throw new Error(`Duplicate field: ${name}`);
        const rt = new Node1(kind);
        this._nodes.set(name, rt);
        this._nodeOrder.push(name);
        return rt;
    }
    copyWithParent(parent) {
        const nodes = new Map();
        const nodeOrder = [
            ...this._nodeOrder
        ];
        const args = new Map();
        for (const [key, value] of this._args.entries()){
            args.set(key, value);
        }
        const argOrder = [
            ...this._argOrder
        ];
        const rt = new GraphqlQuery([
            parent
        ], nodes, nodeOrder, args, argOrder);
        for (const [key1, node] of this._nodes.entries()){
            const newNode = new Node1(node.kind);
            if (node.query.length > 0) {
                const newQuery = node.query[0].copyWithParent(rt);
                newNode.query.push(newQuery);
            }
            nodes.set(key1, newNode);
        }
        return rt;
    }
}
function checkGet(mapName, map, key) {
    const rt = map.get(key);
    if (!rt) throw new Error(`Bad ${mapName}.key: ${key}`);
    return rt;
}
var NodeKind;
(function(NodeKind) {
    NodeKind[NodeKind["Scalar"] = 1] = "Scalar";
    NodeKind[NodeKind["Object"] = 2] = "Object";
})(NodeKind || (NodeKind = {}));
class Node1 {
    kind;
    query = [];
    constructor(kind){
        this.kind = kind;
    }
}
class CfGqlClient {
    static DEBUG = false;
    static URL_TRANSFORMER = (v)=>v;
    profile;
    constructor(profile){
        this.profile = profile;
    }
    async getDurableObjectPeriodicMetricsByDate(startDateInclusive, endDateInclusive) {
        return await _getDurableObjectPeriodicMetricsByDate(this.profile, startDateInclusive, endDateInclusive);
    }
    async getDurableObjectStorageByDate(startDateInclusive, endDateInclusive) {
        return await _getDurableObjectStorageByDate(this.profile, startDateInclusive, endDateInclusive);
    }
    async getDurableObjectInvocationsByDate(startDateInclusive, endDateInclusive) {
        return await _getDurableObjectInvocationsByDate(this.profile, startDateInclusive, endDateInclusive);
    }
    async getR2StorageByDate(startDateInclusive, endDateInclusive) {
        return await _getR2StorageByDate(this.profile, startDateInclusive, endDateInclusive);
    }
    async getR2OperationsByDate(operationClass, startDateInclusive, endDateInclusive) {
        return await _getR2OperationsByDate(this.profile, operationClass, startDateInclusive, endDateInclusive);
    }
}
async function query(profile, queryFn, variables) {
    const { accountId , apiToken  } = profile;
    const q = GraphqlQuery.create().scalar('cost').object('viewer').scalar('budget').object('accounts').argObject('filter', 'accountTag', accountId).scalar('accountTag');
    queryFn(q);
    const query = q.top().toString();
    if (CfGqlClient.DEBUG) console.log(query);
    const reqObj = {
        query,
        variables
    };
    const body = JSON.stringify(reqObj);
    const start = Date.now();
    const url = CfGqlClient.URL_TRANSFORMER('https://api.cloudflare.com/client/v4/graphql');
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Authorization': `Bearer ${apiToken}`
        },
        body
    });
    const fetchMillis = Date.now() - start;
    if (CfGqlClient.DEBUG) console.log(res);
    if (res.status !== 200) throw new Error(`Bad res.status: ${res.status}, expected 200, text=${await res.text()}`);
    const contentType = res.headers.get('content-type');
    if (contentType !== 'application/json') throw new Error(`Bad res.contentType: ${contentType}, expected application/json, found ${contentType}, text=${await res.text()}`);
    const resObj = await res.json();
    resObj.fetchMillis = fetchMillis;
    if (CfGqlClient.DEBUG) console.log(JSON.stringify(resObj, undefined, 2));
    if (isGqlErrorResponse(resObj)) {
        throw new Error(resObj.errors.map(computeGqlErrorString).join(', '));
    }
    return resObj;
}
function isGqlErrorResponse(obj) {
    return typeof obj === 'object' && obj.data === null && Array.isArray(obj.errors);
}
function computeGqlErrorString(error) {
    const pieces = [
        error.message
    ];
    if (error.path) pieces.push(`(${error.path.join('/')})`);
    if (error.extensions.code) pieces.push(`(code=${error.extensions.code})`);
    return pieces.join(' ');
}
async function _getDurableObjectPeriodicMetricsByDate(profile, startDateInclusive, endDateInclusive) {
    const resObj = await query(profile, (q)=>q.object('durableObjectsPeriodicGroups').argLong('limit', 10000).argRaw('filter', `{date_geq: $start, date_leq: $end}`).argRaw('orderBy', `[date_ASC]`).object('dimensions').scalar('date').scalar('namespaceId').end().object('max').scalar('activeWebsocketConnections').end().object('sum').scalar('activeTime').scalar('cpuTime').scalar('exceededCpuErrors').scalar('exceededMemoryErrors').scalar('fatalInternalErrors').scalar('inboundWebsocketMsgCount').scalar('outboundWebsocketMsgCount').scalar('storageDeletes').scalar('storageReadUnits').scalar('storageWriteUnits').scalar('subrequests'), {
        start: startDateInclusive,
        end: endDateInclusive
    });
    const fetchMillis = resObj.fetchMillis;
    const res = resObj;
    const cost = res.data.cost;
    const budget = res.data.viewer.budget;
    const rows = [];
    for (const account of res.data.viewer.accounts){
        checkEqual('account.accountTag', account.accountTag, profile.accountId);
        for (const group of account.durableObjectsPeriodicGroups){
            const date = group.dimensions.date;
            const namespaceId = group.dimensions.namespaceId;
            const maxActiveWebsocketConnections = group.max.activeWebsocketConnections;
            const sumActiveTime = group.sum.activeTime;
            const sumCpuTime = group.sum.cpuTime;
            const sumExceededCpuErrors = group.sum.exceededCpuErrors;
            const sumExceededMemoryErrors = group.sum.exceededMemoryErrors;
            const sumFatalInternalErrors = group.sum.fatalInternalErrors;
            const sumInboundWebsocketMsgCount = group.sum.inboundWebsocketMsgCount;
            const sumOutboundWebsocketMsgCount = group.sum.outboundWebsocketMsgCount;
            const sumStorageDeletes = group.sum.storageDeletes;
            const sumStorageReadUnits = group.sum.storageReadUnits;
            const sumStorageWriteUnits = group.sum.storageWriteUnits;
            const sumSubrequests = group.sum.subrequests;
            rows.push({
                date,
                namespaceId,
                maxActiveWebsocketConnections,
                sumActiveTime,
                sumCpuTime,
                sumExceededCpuErrors,
                sumExceededMemoryErrors,
                sumFatalInternalErrors,
                sumInboundWebsocketMsgCount,
                sumOutboundWebsocketMsgCount,
                sumStorageDeletes,
                sumStorageReadUnits,
                sumStorageWriteUnits,
                sumSubrequests
            });
        }
    }
    return {
        info: {
            fetchMillis,
            cost,
            budget
        },
        rows
    };
}
async function _getDurableObjectStorageByDate(profile, startDateInclusive, endDateInclusive) {
    const resObj = await query(profile, (q)=>q.object('durableObjectsStorageGroups').argLong('limit', 10000).argRaw('filter', `{date_geq: $start, date_leq: $end}`).argRaw('orderBy', `[date_ASC]`).object('dimensions').scalar('date').end().object('max').scalar('storedBytes').end(), {
        start: startDateInclusive,
        end: endDateInclusive
    });
    const fetchMillis = resObj.fetchMillis;
    const res = resObj;
    const cost = res.data.cost;
    const budget = res.data.viewer.budget;
    const rows = [];
    for (const account of res.data.viewer.accounts){
        checkEqual('account.accountTag', account.accountTag, profile.accountId);
        for (const group of account.durableObjectsStorageGroups){
            const date = group.dimensions.date;
            const maxStoredBytes = group.max.storedBytes;
            rows.push({
                date,
                maxStoredBytes
            });
        }
    }
    return {
        info: {
            fetchMillis,
            cost,
            budget
        },
        rows
    };
}
async function _getDurableObjectInvocationsByDate(profile, startDateInclusive, endDateInclusive) {
    const resObj = await query(profile, (q)=>q.object('durableObjectsInvocationsAdaptiveGroups').argLong('limit', 10000).argRaw('filter', `{date_geq: $start, date_leq: $end}`).argRaw('orderBy', `[date_ASC]`).object('dimensions').scalar('date').scalar('namespaceId').end().object('avg').scalar('sampleInterval').end().object('sum').scalar('requests').end(), {
        start: startDateInclusive,
        end: endDateInclusive
    });
    const fetchMillis = resObj.fetchMillis;
    const res = resObj;
    const cost = res.data.cost;
    const budget = res.data.viewer.budget;
    const rows = [];
    for (const account of res.data.viewer.accounts){
        checkEqual('account.accountTag', account.accountTag, profile.accountId);
        for (const group of account.durableObjectsInvocationsAdaptiveGroups){
            const date = group.dimensions.date;
            const namespaceId = group.dimensions.namespaceId;
            const avgSampleInterval = group.avg.sampleInterval;
            const sumRequests = group.sum.requests;
            rows.push({
                date,
                namespaceId,
                avgSampleInterval,
                sumRequests
            });
        }
    }
    return {
        info: {
            fetchMillis,
            cost,
            budget
        },
        rows
    };
}
async function _getR2StorageByDate(profile, startDateInclusive, endDateInclusive) {
    const resObj = await query(profile, (q)=>q.object('r2StorageAdaptiveGroups').argLong('limit', 10000).argRaw('filter', `{date_geq: $start, date_leq: $end}`).argRaw('orderBy', `[date_ASC]`).object('dimensions').scalar('date').scalar('bucketName').end().object('max').scalar('metadataSize').scalar('payloadSize').scalar('objectCount').scalar('uploadCount').end(), {
        start: startDateInclusive,
        end: endDateInclusive
    });
    const fetchMillis = resObj.fetchMillis;
    const res = resObj;
    const cost = res.data.cost;
    const budget = res.data.viewer.budget;
    const rows = [];
    for (const account of res.data.viewer.accounts){
        checkEqual('account.accountTag', account.accountTag, profile.accountId);
        for (const group of account.r2StorageAdaptiveGroups){
            const date = group.dimensions.date;
            const bucketName = group.dimensions.bucketName;
            const maxMetadataSize = group.max.metadataSize;
            const maxPayloadSize = group.max.payloadSize;
            const maxObjectCount = group.max.objectCount;
            const maxUploadCount = group.max.uploadCount;
            rows.push({
                date,
                bucketName,
                maxMetadataSize,
                maxPayloadSize,
                maxObjectCount,
                maxUploadCount
            });
        }
    }
    return {
        info: {
            fetchMillis,
            cost,
            budget
        },
        rows
    };
}
async function _getR2OperationsByDate(profile, operationClass, startDateInclusive, endDateInclusive) {
    const actionTypes = operationClass === 'A' ? [
        'ListBuckets',
        'PutBucket',
        'ListObjects',
        'PutObject',
        'CopyObject',
        'CompleteMultipartUpload',
        'CreateMultipartUpload',
        'UploadPart',
        'UploadPartCopy',
        'PutBucketEncryption',
        'ListMultipartUploads'
    ] : [
        'HeadBucket',
        'HeadObject',
        'GetObject',
        'ReportUsageSummary',
        'GetBucketEncryption',
        'GetBucketLocation'
    ];
    const resObj = await query(profile, (q)=>q.object('r2OperationsAdaptiveGroups').argLong('limit', 10000).argRaw('filter', `{date_geq: $start, date_leq: $end, actionStatus: "success", actionType_in: ${JSON.stringify(actionTypes)}}`).argRaw('orderBy', `[date_ASC]`).object('dimensions').scalar('date').scalar('bucketName').end().object('sum').scalar('requests').scalar('responseObjectSize').end(), {
        start: startDateInclusive,
        end: endDateInclusive
    });
    const fetchMillis = resObj.fetchMillis;
    const res = resObj;
    const cost = res.data.cost;
    const budget = res.data.viewer.budget;
    const rows = [];
    for (const account of res.data.viewer.accounts){
        checkEqual('account.accountTag', account.accountTag, profile.accountId);
        for (const group of account.r2OperationsAdaptiveGroups){
            const date = group.dimensions.date;
            const bucketName = group.dimensions.bucketName;
            const sumSuccessfulRequests = group.sum.requests;
            const sumSuccessfulResponseObjectSize = group.sum.responseObjectSize;
            rows.push({
                date,
                bucketName,
                sumSuccessfulRequests,
                sumSuccessfulResponseObjectSize
            });
        }
    }
    return {
        info: {
            fetchMillis,
            cost,
            budget
        },
        rows
    };
}
async function computeDurableObjectsCostsTable(client, opts) {
    const { start , end  } = (()=>{
        if ('lookbackDays' in opts) {
            const end = utcCurrentDate();
            const start = addDaysToDate(end, -opts.lookbackDays);
            return {
                start,
                end
            };
        } else {
            const { start: start1 , end: end1  } = opts;
            return {
                start: start1,
                end: end1
            };
        }
    })();
    const [storage, periodic, invocations, namespaces] = await Promise.all([
        client.getDurableObjectStorageByDate(start, end),
        client.getDurableObjectPeriodicMetricsByDate(start, end),
        client.getDurableObjectInvocationsByDate(start, end),
        tryListDurableObjectsNamespaces(client.profile)
    ]);
    const gqlResultInfos = {
        'storage': storage.info,
        'periodic': periodic.info,
        'invocations': invocations.info
    };
    const rowsByNamespace = {};
    const rowsByDate = {};
    for (const pRow of periodic.rows){
        const { date , namespaceId , maxActiveWebsocketConnections , sumInboundWebsocketMsgCount , sumOutboundWebsocketMsgCount , sumSubrequests , sumActiveTime , sumStorageReadUnits , sumStorageWriteUnits , sumStorageDeletes  } = pRow;
        let rows = rowsByNamespace[namespaceId];
        if (!rows) {
            rows = [];
            rowsByNamespace[namespaceId] = rows;
        }
        let dateRows = rowsByDate[date];
        if (!dateRows) {
            dateRows = [];
            rowsByDate[date] = dateRows;
        }
        const { sumRequests  } = invocations.rows.filter((v)=>v.date === date && v.namespaceId === namespaceId)[0] || {
            sumRequests: 0
        };
        const { requestsCost , websocketsCost , subrequestsCost , activeCost , readUnitsCost , writeUnitsCost , deletesCost , totalCost , activeGbSeconds  } = computeCosts({
            sumRequests,
            sumInboundWebsocketMsgCount,
            sumSubrequests,
            sumActiveTime,
            sumStorageReadUnits,
            sumStorageWriteUnits,
            sumStorageDeletes,
            excludeFreeUsage: false,
            storageCost: 0
        });
        const row = {
            date,
            sumRequests,
            requestsCost,
            maxActiveWebsocketConnections,
            sumInboundWebsocketMsgCount,
            sumOutboundWebsocketMsgCount,
            websocketsCost,
            sumSubrequests,
            subrequestsCost,
            sumActiveTime,
            activeGbSeconds,
            activeCost,
            sumStorageReadUnits,
            readUnitsCost,
            sumStorageWriteUnits,
            writeUnitsCost,
            sumStorageDeletes,
            deletesCost,
            totalCost
        };
        rows.push(row);
        dateRows.push(row);
    }
    const namespaceTables = {};
    for (const [namespaceId1, rows1] of Object.entries(rowsByNamespace)){
        const estimated30DayRow = computeEstimated30DayRow(rows1, false);
        const namespace = namespaces.find((v)=>v.id === namespaceId1);
        namespaceTables[namespaceId1] = {
            rows: rows1,
            estimated30DayRow,
            namespace,
            estimated30DayRowMinusFree: undefined
        };
    }
    const accountRows = [];
    for (const [date1, dateRows1] of Object.entries(rowsByDate)){
        const { maxStoredBytes  } = storage.rows.filter((v)=>v.date === date1)[0] || {
            maxStoredBytes: 0
        };
        const storageGb = maxStoredBytes / 1024 / 1024 / 1024;
        const storageCost = storageGb * .20 / 30;
        accountRows.push(computeTotalRow(date1, dateRows1, {
            storageGb,
            storageCost
        }));
    }
    const storageCost1 = accountRows.length > 0 ? accountRows.map((v)=>v.storageCost || 0).reduce((a, b)=>a + b) : 0;
    const accountOpts = {
        storageGb: 0,
        storageCost: storageCost1
    };
    const estimated30DayRow1 = computeEstimated30DayRow(accountRows, false, accountOpts);
    const estimated30DayRowMinusFree = computeEstimated30DayRow(accountRows, true, accountOpts);
    const accountTable = {
        rows: accountRows,
        estimated30DayRow: estimated30DayRow1,
        estimated30DayRowMinusFree,
        namespace: undefined
    };
    return {
        accountTable,
        namespaceTables,
        gqlResultInfos
    };
}
function computeCosts(input) {
    const { sumActiveTime , sumStorageReadUnits , sumStorageWriteUnits , sumStorageDeletes , excludeFreeUsage , storageCost  } = input;
    const { sumRequests , sumInboundWebsocketMsgCount , sumSubrequests  } = function() {
        let { sumRequests , sumInboundWebsocketMsgCount , sumSubrequests  } = input;
        if (excludeFreeUsage) {
            let remaining = 1000000;
            let take = Math.min(remaining, sumRequests);
            if (take > 0) {
                sumRequests -= take;
                remaining -= take;
            }
            take = Math.min(remaining, sumInboundWebsocketMsgCount);
            if (take > 0) {
                sumInboundWebsocketMsgCount -= take;
                remaining -= take;
            }
            take = Math.min(remaining, sumSubrequests);
            if (take > 0) {
                sumSubrequests -= take;
                remaining -= take;
            }
        }
        return {
            sumRequests,
            sumInboundWebsocketMsgCount,
            sumSubrequests
        };
    }();
    const requestsCost = sumRequests / 1000000 * 0.15;
    const websocketsCost = sumInboundWebsocketMsgCount / 1000000 * 0.15;
    const subrequestsCost = sumSubrequests / 1000000 * 0.15;
    const activeTimeSeconds = sumActiveTime / 1000 / 1000;
    let activeGbSeconds = activeTimeSeconds * 128 / 1024;
    if (excludeFreeUsage) {
        activeGbSeconds = Math.max(0, activeGbSeconds - 400000);
    }
    const activeCost = activeGbSeconds / 400000 * 12.50;
    const readUnitsCost = (excludeFreeUsage ? Math.max(0, sumStorageReadUnits - 1000000) : sumStorageReadUnits) / 1000000 * .20;
    const writeUnitsCost = (excludeFreeUsage ? Math.max(0, sumStorageWriteUnits - 1000000) : sumStorageWriteUnits) / 1000000 * 1;
    const deletesCost = (excludeFreeUsage ? Math.max(0, sumStorageDeletes - 1000000) : sumStorageDeletes) / 1000000 * 1;
    let newStorageCost = storageCost || 0;
    if (excludeFreeUsage) newStorageCost = Math.max(0, newStorageCost - 0.20);
    const totalCost = requestsCost + websocketsCost + subrequestsCost + activeCost + readUnitsCost + writeUnitsCost + deletesCost + newStorageCost;
    return {
        requestsCost,
        websocketsCost,
        subrequestsCost,
        activeCost,
        readUnitsCost,
        writeUnitsCost,
        deletesCost,
        totalCost,
        activeGbSeconds,
        newStorageCost
    };
}
async function tryListDurableObjectsNamespaces(profile) {
    try {
        return await listDurableObjectsNamespaces(profile);
    } catch (e) {
        console.warn(e);
        return [];
    }
}
function computeTotalRow(date, rows, opts) {
    let computedStorageCost = false;
    const computeStorageCostOnce = ()=>{
        const rt = !computedStorageCost ? opts?.storageCost || 0 : 0;
        computedStorageCost = true;
        return rt;
    };
    return rows.reduce((lhs, rhs)=>({
            date,
            sumRequests: lhs.sumRequests + rhs.sumRequests,
            requestsCost: lhs.requestsCost + rhs.requestsCost,
            maxActiveWebsocketConnections: lhs.maxActiveWebsocketConnections + rhs.maxActiveWebsocketConnections,
            sumInboundWebsocketMsgCount: lhs.sumInboundWebsocketMsgCount + rhs.sumInboundWebsocketMsgCount,
            sumOutboundWebsocketMsgCount: lhs.sumOutboundWebsocketMsgCount + rhs.sumOutboundWebsocketMsgCount,
            websocketsCost: lhs.websocketsCost + rhs.websocketsCost,
            sumSubrequests: lhs.sumSubrequests + rhs.sumSubrequests,
            subrequestsCost: lhs.subrequestsCost + rhs.subrequestsCost,
            sumActiveTime: lhs.sumActiveTime + rhs.sumActiveTime,
            activeGbSeconds: lhs.activeGbSeconds + rhs.activeGbSeconds,
            activeCost: lhs.activeCost + rhs.activeCost,
            sumStorageReadUnits: lhs.sumStorageReadUnits + rhs.sumStorageReadUnits,
            readUnitsCost: lhs.readUnitsCost + rhs.readUnitsCost,
            sumStorageWriteUnits: lhs.sumStorageWriteUnits + rhs.sumStorageWriteUnits,
            writeUnitsCost: lhs.writeUnitsCost + rhs.writeUnitsCost,
            sumStorageDeletes: lhs.sumStorageDeletes + rhs.sumStorageDeletes,
            deletesCost: lhs.deletesCost + rhs.deletesCost,
            storageGb: opts?.storageGb,
            storageCost: opts?.storageCost,
            totalCost: lhs.totalCost + rhs.totalCost + computeStorageCostOnce()
        }));
}
function multiplyRow(row, multiplier) {
    return {
        date: '',
        sumRequests: row.sumRequests * multiplier,
        requestsCost: row.requestsCost * multiplier,
        maxActiveWebsocketConnections: row.maxActiveWebsocketConnections * multiplier,
        sumInboundWebsocketMsgCount: row.sumInboundWebsocketMsgCount * multiplier,
        sumOutboundWebsocketMsgCount: row.sumOutboundWebsocketMsgCount * multiplier,
        websocketsCost: row.websocketsCost * multiplier,
        sumSubrequests: row.sumSubrequests * multiplier,
        subrequestsCost: row.subrequestsCost * multiplier,
        sumActiveTime: row.sumActiveTime * multiplier,
        activeGbSeconds: row.activeGbSeconds * multiplier,
        activeCost: row.activeCost * multiplier,
        sumStorageReadUnits: row.sumStorageReadUnits * multiplier,
        readUnitsCost: row.readUnitsCost * multiplier,
        sumStorageWriteUnits: row.sumStorageWriteUnits * multiplier,
        writeUnitsCost: row.writeUnitsCost * multiplier,
        sumStorageDeletes: row.sumStorageDeletes * multiplier,
        deletesCost: row.deletesCost * multiplier,
        storageGb: row.storageGb === undefined ? undefined : row.storageGb * multiplier,
        storageCost: row.storageCost === undefined ? undefined : row.storageCost * multiplier,
        totalCost: row.totalCost * multiplier
    };
}
function computeEstimated30DayRow(rows, excludeFreeUsage, opts) {
    if (rows.length <= 1) return undefined;
    const sum = computeTotalRow('', rows.slice(0, -1), opts);
    const days = rows.length - 1;
    const estRow = multiplyRow(sum, 30 / days);
    const { sumRequests , sumInboundWebsocketMsgCount , sumSubrequests , sumStorageReadUnits , sumStorageWriteUnits , sumStorageDeletes , sumActiveTime , maxActiveWebsocketConnections , sumOutboundWebsocketMsgCount , storageGb , storageCost  } = estRow;
    const { requestsCost , websocketsCost , subrequestsCost , activeCost , readUnitsCost , writeUnitsCost , deletesCost , totalCost , activeGbSeconds , newStorageCost  } = computeCosts({
        sumRequests,
        sumInboundWebsocketMsgCount,
        sumSubrequests,
        sumActiveTime,
        sumStorageReadUnits,
        sumStorageWriteUnits,
        sumStorageDeletes,
        excludeFreeUsage,
        storageCost
    });
    return {
        date: '',
        sumRequests,
        requestsCost,
        maxActiveWebsocketConnections,
        sumInboundWebsocketMsgCount,
        sumOutboundWebsocketMsgCount,
        websocketsCost,
        sumSubrequests,
        subrequestsCost,
        sumActiveTime,
        activeGbSeconds,
        activeCost,
        sumStorageReadUnits,
        readUnitsCost,
        sumStorageWriteUnits,
        writeUnitsCost,
        sumStorageDeletes,
        deletesCost,
        storageGb,
        storageCost: newStorageCost,
        totalCost
    };
}
function utcCurrentDate() {
    return new Date().toISOString().substring(0, 10);
}
function addDaysToDate(date, days) {
    const d = new Date(`${date}T00:00:00Z`);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()).toISOString().substring(0, 10);
}
class Material {
    static highEmphasisTextColor = 'rgba(255, 255, 255, 0.87)';
    static mediumEmphasisTextColor = 'rgba(255, 255, 255, 0.60)';
}
const MATERIAL_CSS = css`

:root {
  --surface-01-background-color: rgb(30.75, 30.75, 30.75);
  --surface-04-background-color: rgb(40.95, 40.95, 40.95);
  --high-emphasis-text-color: rgba(255, 255, 255, 0.87);
  --medium-emphasis-text-color: rgba(255, 255, 255, 0.60);
  --disabled-text-color: rgba(255, 255, 255, 0.38);
  --button-border-radius: 0.25rem;
  --primary-color: #bb86fc;
  --background-color: #121212;
  --sans-serif-font-family: -apple-system, BlinkMacSystemFont, avenir next, avenir, helvetica neue, helvetica, Ubuntu, roboto, noto, segoe ui, arial, sans-serif;
  --monospace-font-family: Menlo, Consolas, ui-monospace, monospace;
}

/** text size classes */

.h6 {
    font-size: 1.25rem;
    letter-spacing: 0.00750rem;
    font-weight: bolder;
}

.body2, fieldset label, fieldset output, fieldset details {
    font-size: 0.875rem;
    letter-spacing: 0.01786rem;
    font-weight: normal;
    line-height: 1.25rem;
}

.button, button, .action-icon {
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.08929rem;
    font-weight: bolder;
}

.overline, th {
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.15000rem;
    font-weight: normal;
}

.caption {
    font-size: 0.75rem;
    letter-spacing: 0.03333rem;
    font-weight: normal;
}

/* light text on dark background colors */

.high-emphasis-text {
    color: var(--high-emphasis-text-color);
}

.medium-emphasis-text, fieldset label, th {
    color: var(--medium-emphasis-text-color);
}

.disabled-emphasis-text {
    color: var(--disabled-text-color);
}

/** elevation backgrounds */

.surface-01 {
    background-color: var(--surface-01-background-color);
}

.surface-04 {
    background-color: var(--surface-04-background-color);
}

/** action-icon */

.action-icon {
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 2rem;
    min-width: 2rem;
    border-radius: var(--button-border-radius);
    color: var(--high-emphasis-text-color);
    opacity: 0.69;  /** medium-emphasis / high-emphasis */
    user-select: none; -webkit-user-select: none;
}

@media (hover: hover) {
    .action-icon:hover {
        background-color: var(--surface-04-background-color);
        opacity: 1;
    }
}

/** button */

button {
    border: none;
    background-color: var(--surface-01-background-color);
    color: var(--medium-emphasis-text-color);
    padding: 0.5rem 1rem;
    text-align: center;
    text-decoration: none;
    cursor: pointer;
    user-select: none; -webkit-user-select: none;
    min-width: 8rem;
    border-radius: var(--button-border-radius);
}

button.selected {
    background-color: var(--surface-04-background-color);
    color: var(--high-emphasis-text-color);
}

@media (hover) {
    button:hover {
        background-color: var(--surface-04-background-color);
        color: var(--high-emphasis-text-color);
    }
}

button:disabled {
    color: var(--disabled-text-color);
}

@media (hover) {
    button:disabled:hover {
        background-color: var(--surface-01-background-color);
        cursor: default;
    }
}

/** anchors */

a {
    color: var(--primary-color);
    text-underline-offset: 0.2rem;
    text-decoration: none;
}

@media (hover: hover) {
    a:hover {
        text-decoration: underline;
    }
}

/** forms */

fieldset {
    border: solid 1px rgba(255, 255, 255, 0.60);
    border-radius: var(--button-border-radius);
    display: grid;
    grid-row-gap: 1rem;
    grid-column-gap: 1rem;
    padding: 1rem;
}

label {
    grid-column: 1;
    padding: 0.5rem 0;
}

.form-lhs {
    grid-column: 1;
}

input, .form-rhs {
    grid-column: 2;
    min-width: 0;
}

.form-row {
    grid-column: 1 / span 2;
}

fieldset input[type=text] {
    padding: 0.5rem;
    background-color: var(--surface-01-background-color);
    color: var(--high-emphasis-text-color);
    border: solid 1px var(--medium-emphasis-text-color);
    border-radius: var(--button-border-radius);
}

fieldset output {
    padding: 0.5rem 0;
    color: var(--medium-emphasis-text-color);
}

fieldset details {
    color: var(--medium-emphasis-text-color);
}

`;
const HEADER_HTML = html`
<header class="h6 high-emphasis-text">
    <div id="header-content">
        Webtail
        <span id="header-version" class="overline medium-emphasis-text"></span>
        <a href="https://github.com/skymethod/denoflare" target="_blank" id="github-logo-anchor"><img id="github-logo"></a>
    </div>
</header>
`;
const HEADER_CSS = css`
header {
    display: flex;
    padding: 1rem 0;
    user-select: none; -webkit-user-select: none;
}

#header-content {
    flex-grow: 1;
    display: flex;
    align-items: baseline;
    padding-right: 2.2rem;
}

#header-version {
    flex-grow: 1;
    text-align: center;
}

#github-logo-anchor {
    line-height: 0;
    opacity: 0.5;
}

@media (hover: hover) {
    #github-logo-anchor:hover {
        opacity: 0.75;
    }
}

#github-logo {
    width: 1rem;
    margin-bottom: -0.1rem;
}

`;
function initHeader(document1, vm, data) {
    const headerContentElement = document1.getElementById('header-content');
    if ((data.flags || '').includes('demo-toggle')) {
        headerContentElement.addEventListener('dblclick', (e)=>{
            e.preventDefault();
            vm.toggleDemoMode();
        });
    }
    const headerVersionSpan = document1.getElementById('header-version');
    const { version  } = data;
    headerVersionSpan.textContent = version ? `v${version}` : '';
    const githubLogoImg = document1.getElementById('github-logo');
    githubLogoImg.src = computeGithubLogoDataUrl();
    return ()=>{};
}
function computeGithubLogoDataUrl() {
    const svg = GITHUB_LOGO.replace('fill:white;', `fill:${Material.highEmphasisTextColor};`);
    return 'data:image/svg+xml;utf8,' + svg;
}
const GITHUB_LOGO = `<svg width="auto" height="auto" viewBox="0 0 136 133" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" xmlns:serif="http://www.serif.com/" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2;">
<g transform="matrix(4.16667,0,0,4.16667,-568,-1381.06)">
    <path d="M152.608,331.455C143.614,331.455 136.32,338.748 136.32,347.745C136.32,354.942 140.987,361.047 147.46,363.201C148.275,363.351 148.572,362.848 148.572,362.416C148.572,362.029 148.558,361.005 148.55,359.646C144.019,360.63 143.063,357.462 143.063,357.462C142.322,355.58 141.254,355.079 141.254,355.079C139.775,354.069 141.366,354.089 141.366,354.089C143.001,354.204 143.861,355.768 143.861,355.768C145.314,358.257 147.674,357.538 148.602,357.121C148.75,356.069 149.171,355.351 149.636,354.944C146.019,354.533 142.216,353.135 142.216,346.893C142.216,345.115 142.851,343.66 143.893,342.522C143.725,342.11 143.166,340.453 144.053,338.211C144.053,338.211 145.42,337.773 148.532,339.881C149.831,339.519 151.225,339.339 152.61,339.332C153.994,339.339 155.387,339.519 156.688,339.881C159.798,337.773 161.163,338.211 161.163,338.211C162.052,340.453 161.493,342.11 161.326,342.522C162.37,343.66 163,345.115 163,346.893C163,353.151 159.191,354.528 155.563,354.931C156.147,355.434 156.668,356.428 156.668,357.947C156.668,360.125 156.648,361.882 156.648,362.416C156.648,362.852 156.942,363.359 157.768,363.2C164.236,361.041 168.899,354.94 168.899,347.745C168.899,338.748 161.605,331.455 152.608,331.455Z" style="fill:white;"/>
</g>
</svg>`;
function actionIcon(icon, opts = {}) {
    const { text , onclick  } = opts;
    return html`<div class="action-icon" @click=${(e)=>{
        e.preventDefault();
        onclick && onclick();
    }}>${icon}${text || ''}</div>`;
}
const CLEAR_ICON = svg`<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="${Material.highEmphasisTextColor}"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M5 13h14v-2H5v2zm-2 4h14v-2H3v2zM7 7v2h14V7H7z"/></svg>`;
const EDIT_ICON = svg`<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="${Material.highEmphasisTextColor}"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06M17.66 3c-.25 0-.51.1-.7.29l-1.83 1.83 3.75 3.75 1.83-1.83c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.71-.29zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z"/></svg>`;
const ADD_ICON = svg`<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="${Material.highEmphasisTextColor}">><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`;
const CHECK_BOX_UNCHECKED_ICON = svg`<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="${Material.highEmphasisTextColor}"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>`;
const CHECK_BOX_CHECKED_ICON = svg`<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="${Material.highEmphasisTextColor}"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM17.99 9l-1.41-1.42-6.59 6.59-2.58-2.57-1.42 1.41 4 3.99z"/></svg>`;
const SIDEBAR_HTML = html`
<div id="sidebar">
    ${HEADER_HTML}
    <a id="sidebar-about" class="overline medium-emphasis-text" href="#">About</a>
    <div id="profiles"></div>
    <div id="sidebar-analytics"></div>
    <div id="scripts"></div>
</div>
`;
const SIDEBAR_CSS = css`

#sidebar {
    margin-left: 1rem;
    height: 100vh;
    min-width: 15rem;
}

#sidebar-about {
    display: block;
    margin-bottom: 1rem;
}

#sidebar .button-grid {
    display: grid;
    grid-template-columns: 1fr 2rem;
    grid-gap: 1px;
    margin-left: 1px;
    margin-top: 1rem;
}

#sidebar .button-grid-new {
    grid-column: 1;
    min-width: 8rem;
}

#sidebar button {
    grid-column: 1;
}

#sidebar .button-grid .hint {
    grid-column: 1; 
    text-align: center;
}

#scripts-scroller {
    height: calc(100vh - 28rem);
}

#sidebar .extra-top-margin {
    margin-top: 1rem;
}

`;
function initSidebar(document1, vm, data) {
    const updateHeader = initHeader(document1, vm, data);
    const aboutAnchor = document1.getElementById('sidebar-about');
    const profilesDiv = document1.getElementById('profiles');
    const analyticsDiv = document1.getElementById('sidebar-analytics');
    const scriptsDiv = document1.getElementById('scripts');
    aboutAnchor.onclick = (e)=>{
        e.preventDefault();
        vm.showAbout();
    };
    return ()=>{
        updateHeader();
        LitElement.render(PROFILES_HTML(vm), profilesDiv);
        LitElement.render(ANALYTICS_HTML(vm), analyticsDiv);
        LitElement.render(SCRIPTS_HTML(vm), scriptsDiv);
    };
}
const PROFILES_HTML = (vm)=>html`
    <div class="overline medium-emphasis-text">Profiles</div>
    <div class="button-grid">
        ${vm.profiles.map((profile)=>html`<button 
            class="${profile.id === vm.selectedProfileId ? 'selected' : ''}" 
            @click=${()=>{
            vm.selectedProfileId = profile.id;
        }}
            ?disabled="${vm.profileForm.showing}">${profile.text}</button>
        ${profile.id === vm.selectedProfileId ? html`${actionIcon(EDIT_ICON, {
            onclick: ()=>vm.editProfile(profile.id)
        })}` : ''}`)}
        <div class="button-grid-new">${actionIcon(ADD_ICON, {
        text: 'New',
        onclick: ()=>vm.newProfile()
    })}</div>
    </div>
`;
const ANALYTICS_HTML = (vm)=>html`
    <div class="overline medium-emphasis-text extra-top-margin">Analytics</div>
    <div class="button-grid">
        ${vm.analytics.map((analytic)=>html`<button
                class="${vm.selectedAnalyticId === analytic.id ? 'selected' : ''}" 
                @click=${()=>vm.showAnalytic(analytic.id)} 
                ?disabled="${vm.profileForm.showing}">${analytic.text}</button>
        `)}
    </div>
`;
const SCRIPTS_HTML = (vm)=>html`
    <div class="overline medium-emphasis-text extra-top-margin">Scripts</div>
    <div id="scripts-scroller" class="hidden-vertical-scroll">
        <div class="button-grid">
            ${vm.scripts.map((script)=>html`<button
                    class="${vm.selectedScriptIds.has(script.id) ? 'selected' : ''}" 
                    @click=${(e)=>handleScriptClick(e, script.id, vm)} 
                    ?disabled="${vm.profileForm.showing}">${script.text}</button>
            `)}
        </div>
    </div>
    <div class="button-grid">
        <div class="caption medium-emphasis-text hint">${computeMultiselectKeyChar()}-click to multiselect</div>
    </div>
`;
function computeMultiselectKeyChar() {
    return isMacintosh() ? '⌘' : 'ctrl';
}
function isMacintosh() {
    return navigator.platform.indexOf('Mac') > -1;
}
function handleScriptClick(e, scriptId, vm) {
    e.preventDefault();
    const newScriptIds = new Set([
        scriptId
    ]);
    const multi = isMacintosh() ? e.metaKey : e.ctrlKey;
    vm.selectedScriptIds = multi ? vm.selectedScriptIds.has(scriptId) ? setSubtract(vm.selectedScriptIds, newScriptIds) : setUnion(vm.selectedScriptIds, newScriptIds) : newScriptIds;
}
class AppConstants {
    static WEBSOCKET_PING_INTERVAL_SECONDS = 10;
    static INACTIVE_TAIL_SECONDS = 5;
}
class TailController {
    callbacks;
    records = new Map();
    websocketPingIntervalSeconds;
    inactiveTailSeconds;
    tailOptions = {
        filters: []
    };
    online;
    constructor(callbacks, opts){
        this.callbacks = callbacks;
        this.websocketPingIntervalSeconds = opts.websocketPingIntervalSeconds;
        this.inactiveTailSeconds = opts.inactiveTailSeconds;
        const navigatorAsAny = globalThis.navigator;
        if (typeof navigatorAsAny.onLine === 'boolean') {
            this.setOnline(navigatorAsAny.onLine);
        }
        globalThis.addEventListener('online', ()=>this.setOnline(true));
        globalThis.addEventListener('offline', ()=>this.setOnline(false));
    }
    setTailOptions(tailOptions) {
        console.log(`TailController.setTailOptions ${JSON.stringify(tailOptions)}`);
        this.tailOptions = tailOptions;
        for (const record of this.records.values()){
            if (record.connection) {
                record.connection.setOptions(tailOptions);
            }
        }
    }
    async setTails(accountId, apiToken, scriptIds) {
        const stopKeys = setSubtract(this.computeStartingOrStartedTailKeys(), new Set([
            ...scriptIds
        ].map((v)=>packTailKey(accountId, v))));
        for (const stopKey of stopKeys){
            const record = this.records.get(stopKey);
            record.state = 'inactive';
            record.stopRequestedTime = Date.now();
            setTimeout(()=>{
                if (record.state === 'inactive' && record.stopRequestedTime && Date.now() - record.stopRequestedTime >= this.inactiveTailSeconds) {
                    record.state = 'stopping';
                    console.log(`Stopping ${record.scriptId}, inactive for ${Date.now() - record.stopRequestedTime}ms`);
                    record.connection?.close(1000, 'no longer interested');
                    this.records.delete(record.tailKey);
                }
            }, this.inactiveTailSeconds * 1000);
        }
        if (stopKeys.size > 0) {
            this.dispatchTailsChanged();
        }
        for (const scriptId of scriptIds){
            const tailKey = packTailKey(accountId, scriptId);
            const existingRecord = this.records.get(tailKey);
            if (existingRecord) {
                if (existingRecord.state === 'inactive') {
                    console.log(`Reviving inactive ${scriptId}`);
                }
                existingRecord.state = 'started';
                existingRecord.stopRequestedTime = undefined;
            } else {
                const record1 = {
                    state: 'starting',
                    tailKey,
                    apiToken,
                    accountId,
                    scriptId,
                    retryCountAfterClose: 0
                };
                this.records.set(tailKey, record1);
                await this.startTailConnection(record1);
                record1.state = 'started';
            }
            this.dispatchTailsChanged();
        }
    }
    dispatchTailsChanged() {
        const tailKeys = new Set([
            ...this.records.values()
        ].filter((v)=>v.state === 'started').map((v)=>v.tailKey));
        this.callbacks.onTailsChanged(tailKeys);
    }
    computeStartingOrStartedTailKeys() {
        return new Set([
            ...this.records.values()
        ].filter((v)=>v.state === 'starting' || v.state === 'started').map((v)=>v.tailKey));
    }
    setOnline(online) {
        if (online === this.online) return;
        const oldOnline = this.online;
        this.online = online;
        this.callbacks.onNetworkStatusChanged(online);
        if (typeof oldOnline === 'boolean') {
            if (online) {
                for (const record of this.records.values()){
                    if (record.state === 'started') {
                        const { accountId , scriptId  } = record;
                        this.startTailConnection(record).catch((e)=>this.callbacks.onTailFailedToStart(accountId, scriptId, 'restart-after-coming-online', e));
                    }
                }
            } else {
                for (const record1 of this.records.values()){
                    record1.connection?.close(1000, 'offline');
                }
            }
        }
    }
    async startTailConnection(record) {
        const allowedToStart = record.state === 'starting' || record.state === 'started';
        if (!allowedToStart) return;
        const { accountId , scriptId  } = unpackTailKey(record.tailKey);
        const { apiToken  } = record;
        if (!record.tail || Date.now() > new Date(record.tail.expires_at).getTime() - 1000 * 60 * 5) {
            const tailCreatingTime = Date.now();
            this.callbacks.onTailCreating(accountId, scriptId);
            const tail = await createTail({
                accountId,
                scriptName: scriptId,
                apiToken
            });
            record.tail = tail;
            this.callbacks.onTailCreated(accountId, scriptId, Date.now() - tailCreatingTime, tail);
        }
        if (record.state === 'inactive') return;
        const { callbacks , websocketPingIntervalSeconds  } = this;
        const dis = this;
        const openingTime = Date.now();
        const tailConnectionCallbacks = {
            onOpen (_cn, timeStamp) {
                record.retryCountAfterClose = 0;
                callbacks.onTailConnectionOpen(accountId, scriptId, timeStamp, Date.now() - openingTime);
            },
            onClose (_cn, timeStamp, code, reason, wasClean) {
                callbacks.onTailConnectionClose(accountId, scriptId, timeStamp, code, reason, wasClean);
                record.closeTime = Date.now();
                if (record.state === 'started' && dis.online !== false) {
                    record.retryCountAfterClose++;
                    const delaySeconds = Math.min(record.retryCountAfterClose * 5, 60);
                    console.log(`Will attempt to restart ${scriptId} in ${delaySeconds} seconds`);
                    setTimeout(async function() {
                        if (record.state === 'started') {
                            await dis.startTailConnection(record);
                        }
                    }, delaySeconds * 1000);
                }
            },
            onError (_cn, timeStamp, errorInfo) {
                callbacks.onTailConnectionError(accountId, scriptId, timeStamp, errorInfo);
            },
            onTailMessage (_cn, timeStamp, message) {
                if (record.state !== 'started') return;
                callbacks.onTailConnectionMessage(accountId, scriptId, timeStamp, message);
            },
            onUnparsedMessage (_cn, timeStamp, message, parseError) {
                console.log('onUnparsedMessage', timeStamp, message, parseError);
                callbacks.onTailConnectionUnparsedMessage(accountId, scriptId, timeStamp, message, parseError);
            }
        };
        record.connection = new TailConnection(record.tail.url, tailConnectionCallbacks, {
            websocketPingIntervalSeconds
        }).setOptions(this.tailOptions);
    }
}
function unpackTailKey(tailKey) {
    const m = /^([^\s-]+)-([^\s]+)$/.exec(tailKey);
    if (!m) throw new Error(`Bad tailKey: ${tailKey}`);
    return {
        accountId: m[1],
        scriptId: m[2]
    };
}
function packTailKey(accountId, scriptId) {
    return `${accountId}-${scriptId}`;
}
class SwitchableTailControllerCallbacks {
    callbacks;
    enabledFn;
    constructor(callbacks, enabledFn){
        this.callbacks = callbacks;
        this.enabledFn = enabledFn;
    }
    onTailCreating(accountId, scriptId) {
        if (!this.enabledFn()) return;
        this.callbacks.onTailCreating(accountId, scriptId);
    }
    onTailCreated(accountId, scriptId, tookMillis, tail) {
        if (!this.enabledFn()) return;
        this.callbacks.onTailCreated(accountId, scriptId, tookMillis, tail);
    }
    onTailConnectionOpen(accountId, scriptId, timeStamp, tookMillis) {
        if (!this.enabledFn()) return;
        this.callbacks.onTailConnectionOpen(accountId, scriptId, timeStamp, tookMillis);
    }
    onTailConnectionClose(accountId, scriptId, timeStamp, code, reason, wasClean) {
        if (!this.enabledFn()) return;
        this.callbacks.onTailConnectionClose(accountId, scriptId, timeStamp, code, reason, wasClean);
    }
    onTailConnectionError(accountId, scriptId, timeStamp, errorInfo) {
        if (!this.enabledFn()) return;
        this.callbacks.onTailConnectionError(accountId, scriptId, timeStamp, errorInfo);
    }
    onTailConnectionMessage(accountId, scriptId, timeStamp, message) {
        if (!this.enabledFn()) return;
        this.callbacks.onTailConnectionMessage(accountId, scriptId, timeStamp, message);
    }
    onTailConnectionUnparsedMessage(accountId, scriptId, timeStamp, message, parseError) {
        if (!this.enabledFn()) return;
        this.callbacks.onTailConnectionUnparsedMessage(accountId, scriptId, timeStamp, message, parseError);
    }
    onTailsChanged(tails) {
        if (!this.enabledFn()) return;
        this.callbacks.onTailsChanged(tails);
    }
    onNetworkStatusChanged(online) {
        if (!this.enabledFn()) return;
        this.callbacks.onNetworkStatusChanged(online);
    }
    onTailFailedToStart(accountId, scriptId, trigger, error) {
        if (!this.enabledFn()) return;
        this.callbacks.onTailFailedToStart(accountId, scriptId, trigger, error);
    }
}
class DemoMode {
    static profiles = [
        {
            id: 'profile1',
            text: 'corp-profile'
        },
        {
            id: 'profile2',
            text: 'pers-profile'
        }
    ];
    static selectedProfileId = 'profile1';
    static setSelectedProfileId(_value) {}
    static scripts = [
        {
            id: 'script1',
            text: 'worker1-dev'
        },
        {
            id: 'script2',
            text: 'worker1-prod'
        },
        {
            id: 'script3',
            text: 'worker2-dev'
        },
        {
            id: 'script4',
            text: 'worker2-beta'
        },
        {
            id: 'script5',
            text: 'worker2-prod'
        },
        {
            id: 'script6',
            text: 'durable-object-demo'
        },
        {
            id: 'script7',
            text: 'secret-app'
        }
    ];
    static selectedScriptIds = new Set([
        'script7',
        'script4'
    ]);
    static setSelectedScriptIds(_scriptIds) {}
    static tails = new Set();
    static logFakeOutput(callbacks) {
        const accountId = '15a7fa3a37254fe4a7cadd1bb2762879';
        const scriptId = 'secret-app';
        callbacks.onTailCreating(accountId, scriptId);
        const tail = {
            id: 'db19eb8be9f4443aab91a9042c0d3517',
            url: 'wss://tail.developers.workers.dev/db19eb8be9f4443aab91a9042c0d3517',
            'expires_at': new Date().toISOString()
        };
        callbacks.onTailCreated(accountId, scriptId, 155, tail);
        callbacks.onTailsChanged(new Set([
            packTailKey(accountId, scriptId)
        ]));
        callbacks.onTailConnectionOpen(accountId, scriptId, Date.now(), 42);
        for(let i = 0; i < 2; i++){
            callbacks.onTailConnectionMessage(accountId, scriptId, Date.now(), computeFakeRequest());
            callbacks.onTailConnectionMessage(accountId, scriptId, Date.now(), computeFakeDoRequest());
            callbacks.onTailConnectionMessage(accountId, scriptId, Date.now(), computeFakeRequestWithLogs());
            callbacks.onTailConnectionMessage(accountId, scriptId, Date.now(), computeFakeRequestExceedingTimeLimit());
        }
    }
}
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:91.0) Gecko/20100101 Firefox/91.0';
function computeFakeRequest() {
    const rt = {
        event: {
            request: {
                url: 'https://example.com/endpoint',
                method: 'GET',
                headers: {
                    'cf-connecting-ip': '203.0.113.12',
                    'user-agent': USER_AGENT
                },
                cf: {
                    colo: 'DFW'
                }
            }
        },
        logs: [],
        exceptions: [],
        eventTimestamp: Date.now(),
        outcome: 'ok'
    };
    return rt;
}
function computeFakeDoRequest() {
    const rt = {
        event: {
            request: {
                url: 'https://fake-host/put',
                method: 'PUT',
                headers: {}
            }
        },
        logs: [
            {
                level: 'log',
                timestamp: Date.now(),
                message: [
                    'logprops:',
                    {
                        colo: 'EWR',
                        durableObjectClass: 'LoggerDO',
                        durableObjectId: '538fc7ce55b14e53b6b8552befeb9af4',
                        durableObjectName: 'log1'
                    }
                ]
            }
        ],
        exceptions: [],
        eventTimestamp: Date.now(),
        outcome: 'ok'
    };
    return rt;
}
function computeFakeRequestWithLogs() {
    const rt = {
        event: {
            request: {
                url: 'https://my-worker.subdomain.workers.dev/test?log=true',
                method: 'GET',
                headers: {
                    'cf-connecting-ip': '203.0.113.12',
                    'user-agent': USER_AGENT
                },
                cf: {
                    colo: 'DFW'
                }
            }
        },
        logs: [
            {
                level: 'log',
                timestamp: Date.now(),
                message: [
                    'Lorem ipsum dolor sit amet, consectetur adipiscing elit'
                ]
            },
            {
                level: 'error',
                timestamp: Date.now(),
                message: [
                    'Lorem ipsum dolor sit amet, consectetur adipiscing elit'
                ]
            },
            {
                level: 'info',
                timestamp: Date.now(),
                message: [
                    'Lorem ipsum dolor sit amet, consectetur adipiscing elit'
                ]
            },
            {
                level: 'warning',
                timestamp: Date.now(),
                message: [
                    'Lorem ipsum dolor sit amet, consectetur adipiscing elit'
                ]
            },
            {
                level: 'debug',
                timestamp: Date.now(),
                message: [
                    'Lorem ipsum dolor sit amet, consectetur adipiscing elit'
                ]
            }
        ],
        exceptions: [],
        eventTimestamp: Date.now(),
        outcome: 'ok'
    };
    return rt;
}
function computeFakeRequestExceedingTimeLimit() {
    const rt = {
        event: {
            request: {
                url: 'https://my-worker.subdomain.workers.dev/compute-digits-of-pi',
                method: 'GET',
                headers: {
                    'cf-connecting-ip': '203.0.113.12',
                    'user-agent': USER_AGENT
                },
                cf: {
                    colo: 'DFW'
                }
            }
        },
        logs: [
            {
                level: 'log',
                timestamp: Date.now(),
                message: [
                    'burning cpu'
                ]
            }
        ],
        exceptions: [
            {
                name: 'Error',
                timestamp: Date.now(),
                message: 'Worker exceeded CPU time limit.'
            }
        ],
        eventTimestamp: Date.now(),
        outcome: 'exceededCpu'
    };
    return rt;
}
class QpsController {
    sortedEventTimes = [];
    callbacks;
    n;
    _qps = 0;
    get qps() {
        return this._qps;
    }
    constructor(n, callbacks){
        this.callbacks = callbacks;
        this.n = n;
    }
    addEvent(eventTime) {
        const qps = computeQps(this.n, this.sortedEventTimes, eventTime);
        if (qps === this._qps) return;
        this._qps = qps;
        this.callbacks.onQpsChanged(qps);
    }
}
function computeQps(n, sortedEventTimes, eventTime) {
    add(eventTime, sortedEventTimes);
    while(sortedEventTimes.length > n){
        sortedEventTimes.shift();
    }
    const num = sortedEventTimes.length;
    if (num < 2) return 0;
    const timeDiffSeconds = (sortedEventTimes[sortedEventTimes.length - 1] - sortedEventTimes[0]) / 1000;
    return (num - 1) / timeDiffSeconds;
}
function add(el, arr) {
    arr.splice(findLoc(el, arr) + 1, 0, el);
    return arr;
}
function findLoc(el, arr, st, en) {
    st = st || 0;
    en = en || arr.length;
    for(let i = 0; i < arr.length; i++){
        if (arr[i] > el) {
            return i - 1;
        }
    }
    return en;
}
class WebtailAppVM {
    _profiles = [];
    get profiles() {
        return this.demoMode ? DemoMode.profiles : this._profiles;
    }
    get realProfiles() {
        return this._profiles;
    }
    _selectedProfileId;
    get selectedProfileId() {
        return this.demoMode ? DemoMode.selectedProfileId : this._selectedProfileId;
    }
    set selectedProfileId(value) {
        if (this.demoMode) {
            DemoMode.setSelectedProfileId(value);
            return;
        }
        if (this._selectedProfileId === value) return;
        this._selectedProfileId = value;
        this.onChange();
        this.state.selectedProfileId = value;
        saveState(this.state);
        this.findScripts();
    }
    _analytics = [
        {
            id: 'durable-objects',
            text: 'Durable Objects',
            description: 'Daily metrics and associated costs'
        }
    ];
    get analytics() {
        return this._analytics;
    }
    _selectedAnalyticId;
    get selectedAnalyticId() {
        return this._selectedAnalyticId;
    }
    analyticsState = {
        querying: false
    };
    _scripts = [];
    get scripts() {
        return this.demoMode ? DemoMode.scripts : this._scripts;
    }
    _selectedScriptIds = new Set();
    get selectedScriptIds() {
        return this.demoMode ? DemoMode.selectedScriptIds : this._selectedScriptIds;
    }
    set selectedScriptIds(scriptIds) {
        if (this._selectedAnalyticId !== undefined) {
            this._selectedAnalyticId = undefined;
            this.onChange();
        }
        if (this.demoMode) {
            DemoMode.setSelectedScriptIds(scriptIds);
            return;
        }
        if (setEqual(this._selectedScriptIds, scriptIds)) return;
        this._selectedScriptIds = new Set(scriptIds);
        this.onChange();
        const profile = this.selectedProfileId && this.state.profiles[this.selectedProfileId];
        if (profile) {
            profile.selectedScriptIds = [
                ...scriptIds
            ];
            saveState(this.state);
        }
        this.setTails();
    }
    profileForm = new ProfileFormVM();
    filterForm = new FilterFormVM();
    filter = {};
    extraFields = [];
    _tails = new Set();
    get tails() {
        return this.demoMode ? DemoMode.tails : this._tails;
    }
    set tails(tails) {
        if (this.demoMode) DemoMode.tails = tails;
        this._tails = tails;
    }
    welcomeShowing = false;
    aboutShowing = false;
    state = loadState();
    tailController;
    tailControllerCallbacks;
    qpsController;
    demoMode = false;
    onChange = ()=>{};
    logger = ()=>{};
    onResetOutput = ()=>{};
    onQpsChange = ()=>{};
    constructor(){
        const dis = this;
        this.qpsController = new QpsController(20, {
            onQpsChanged (qps) {
                if (dis.demoMode) return;
                dis.onQpsChange(qps);
            }
        });
        const logTailsChange = (action, tailKeys)=>{
            if (tailKeys.size > 0) this.logWithPrefix(`${action} ${[
                ...tailKeys
            ].map((v)=>unpackTailKey(v).scriptId).sort().join(', ')}`);
        };
        const logWithPrefix = this.logWithPrefix.bind(this);
        const verboseWithPrefix = this.verboseWithPrefix.bind(this);
        const callbacks = {
            onTailCreating (_accountId, scriptId) {
                verboseWithPrefix(`Creating tail for ${scriptId}...`);
            },
            onTailCreated (_accountId, scriptId, tookMillis, tail) {
                verboseWithPrefix(`Created tail for ${scriptId} in ${tookMillis}ms, ${JSON.stringify(tail)}`);
            },
            onTailConnectionOpen (_accountId, scriptId, _timeStamp, tookMillis) {
                verboseWithPrefix(`Opened tail for ${scriptId} in ${tookMillis}ms`);
            },
            onTailConnectionClose (accountId, scriptId, timeStamp, code, reason, wasClean) {
                console.log('onTailConnectionClose', {
                    accountId,
                    scriptId,
                    timeStamp,
                    code,
                    reason,
                    wasClean
                });
                verboseWithPrefix(`Closed tail for ${scriptId}, ${JSON.stringify({
                    code,
                    reason,
                    wasClean
                })}`);
            },
            onTailConnectionError (accountId, scriptId, timeStamp, errorInfo) {
                console.log('onTailConnectionError', {
                    accountId,
                    scriptId,
                    timeStamp,
                    errorInfo
                });
                logWithPrefix(`Error in tail for ${scriptId}`, {
                    errorInfo
                });
            },
            onTailConnectionMessage (_accountId, _scriptId, _timeStamp, message) {
                if (computeMessagePassesFilter(message, dis.filter)) {
                    dumpMessagePretty(message, dis.logger, dis.computeAdditionalLogs(message));
                }
                if (dis.demoMode) return;
                dis.qpsController.addEvent(message.eventTimestamp);
            },
            onTailConnectionUnparsedMessage (_accountId, scriptId, _timeStamp, message, parseError) {
                console.log(message);
                logWithPrefix(`Unparsed message in tail for ${scriptId}`, parseError.stack || parseError.message);
            },
            onTailsChanged (tails) {
                if (setEqual(dis.tails, tails)) return;
                const removed = setSubtract(dis.tails, tails);
                logTailsChange('Untailing', removed);
                const added = setSubtract(tails, dis.tails);
                logTailsChange('Tailing', added);
                dis.tails = tails;
                dis.onChange();
            },
            onNetworkStatusChanged (online) {
                if (online) {
                    logWithPrefix('%cONLINE%c', 'color: green');
                } else {
                    logWithPrefix('%cOFFLINE%c', 'color: red');
                }
            },
            onTailFailedToStart (_accountId, scriptId, trigger, error) {
                verboseWithPrefix(`Tail for ${scriptId} failed to start (${trigger}): ${error.name} ${error.message}`);
            }
        };
        const websocketPingIntervalSeconds = AppConstants.WEBSOCKET_PING_INTERVAL_SECONDS;
        const inactiveTailSeconds = AppConstants.INACTIVE_TAIL_SECONDS;
        this.tailController = new TailController(new SwitchableTailControllerCallbacks(callbacks, ()=>!this.demoMode), {
            websocketPingIntervalSeconds,
            inactiveTailSeconds
        });
        this.tailControllerCallbacks = callbacks;
        this.extraFields = [
            ...this.state.extraFields || []
        ];
        this.filter = this.state.filter || {};
        this.applyFilter({
            save: false
        });
    }
    start() {
        this.reloadProfiles();
        this.recomputeWelcomeShowing();
        this.performInitialSelection();
    }
    newProfile() {
        if (this.demoMode) {
            if (this.welcomeShowing) {} else {
                return;
            }
        }
        this.profileForm.profileId = generateUuid();
        this.profileForm.showing = true;
        this.profileForm.title = 'New Profile';
        this.profileForm.name = this._profiles.length === 0 ? 'default' : `profile${this._profiles.length + 1}`;
        this.profileForm.accountId = '';
        this.profileForm.apiToken = '';
        this.profileForm.deleteVisible = false;
        this.profileForm.enabled = true;
        this.profileForm.outputMessage = '';
        this.profileForm.computeSaveEnabled();
        this.onChange();
    }
    editProfile(profileId) {
        if (this.demoMode) return;
        const profile = this.state.profiles[profileId];
        if (!profile) throw new Error(`Profile ${profileId} not found`);
        this._selectedProfileId = profileId;
        const { name , accountId , apiToken  } = profile;
        this.profileForm.profileId = profileId;
        this.profileForm.showing = true;
        this.profileForm.title = 'Edit Profile';
        this.profileForm.name = name;
        this.profileForm.accountId = accountId;
        this.profileForm.apiToken = apiToken;
        this.profileForm.deleteVisible = true;
        this.profileForm.enabled = true;
        this.profileForm.outputMessage = '';
        this.profileForm.computeSaveEnabled();
        this.onChange();
    }
    deleteProfile(profileId) {
        console.log('delete profile', profileId);
        const profile = this.state.profiles[profileId];
        if (!profile) throw new Error(`Profile ${profileId} not found`);
        delete this.state.profiles[profileId];
        saveState(this.state);
        this.profileForm.showing = false;
        this.reloadProfiles();
        this.recomputeWelcomeShowing();
        this.performInitialSelection();
    }
    cancelProfile() {
        this.profileForm.showing = false;
        this.onChange();
    }
    setProfileName(name) {
        this.profileForm.name = name;
        this.profileForm.computeSaveEnabled();
        this.onChange();
    }
    setProfileAccountId(accountId) {
        this.profileForm.accountId = accountId;
        this.profileForm.computeSaveEnabled();
        this.onChange();
    }
    setProfileApiToken(apiToken) {
        this.profileForm.apiToken = apiToken;
        this.profileForm.computeSaveEnabled();
        this.onChange();
    }
    saveProfile() {
        const { profileForm  } = this;
        const { profileId  } = profileForm;
        const newProfile = {
            name: profileForm.name.trim(),
            accountId: profileForm.accountId.trim(),
            apiToken: profileForm.apiToken.trim()
        };
        this.trySaveProfile(profileId, newProfile);
    }
    editEventFilter() {
        if (this.demoMode) return;
        const { filter , filterForm  } = this;
        filterForm.showing = true;
        filterForm.enabled = true;
        filterForm.fieldName = 'Event type:';
        filterForm.fieldValueChoices = [
            {
                id: 'all',
                text: 'All'
            },
            {
                id: 'cron',
                text: 'CRON trigger'
            },
            {
                id: 'http',
                text: 'HTTP request'
            }
        ];
        filterForm.fieldValueOptions = [];
        filterForm.fieldValue = filter.event1 === 'http' ? 'http' : filter.event1 === 'cron' ? 'cron' : 'all';
        filterForm.helpText = 'Choose which types of events to show';
        filterForm.applyValue = ()=>{
            if (filter.event1 === filterForm.fieldValue) return;
            filter.event1 = filterForm.fieldValue;
            this.applyFilter({
                save: true
            });
            const selectedChoiceText = filterForm.fieldValueChoices.find((v)=>v.id === filterForm.fieldValue).text;
            this.logWithPrefix(`Event type filter changed to: ${selectedChoiceText}`);
        };
        this.onChange();
    }
    editStatusFilter() {
        if (this.demoMode) return;
        const { filter , filterForm  } = this;
        filterForm.showing = true;
        filterForm.enabled = true;
        filterForm.fieldName = 'Status:';
        filterForm.fieldValueChoices = [
            {
                id: 'all',
                text: 'All'
            },
            {
                id: 'success',
                text: 'Success'
            },
            {
                id: 'error',
                text: 'Error'
            }
        ];
        filterForm.fieldValueOptions = [];
        filterForm.fieldValue = filter.status1 === 'success' ? 'success' : filter.status1 === 'error' ? 'error' : 'all';
        filterForm.helpText = 'Show events this this status';
        filterForm.applyValue = ()=>{
            if (filter.status1 === filterForm.fieldValue) return;
            filter.status1 = filterForm.fieldValue;
            this.applyFilter({
                save: true
            });
            const selectedChoiceText = filterForm.fieldValueChoices.find((v)=>v.id === filterForm.fieldValue).text;
            this.logWithPrefix(`Status filter changed to: ${selectedChoiceText}`);
        };
        this.onChange();
    }
    editIpAddressFilter() {
        if (this.demoMode) return;
        const { filter , filterForm  } = this;
        const isValidIpAddress = (ipAddress)=>{
            return /^(self|[\d\.:a-f]{3,})$/.test(ipAddress);
        };
        const checkValidIpAddress = (ipAddress)=>{
            if (!isValidIpAddress(ipAddress)) throw new Error(`Bad ip address: ${ipAddress}`);
            return ipAddress;
        };
        const parseFilterIpAddressesFromFieldValue = ()=>{
            const { fieldValue  } = filterForm;
            const v = (fieldValue || '').trim();
            if (v === '') return [];
            return distinct(v.split(',').map((v)=>v.trim().toLowerCase()).filter((v)=>v !== '').map(checkValidIpAddress));
        };
        const computeFieldValueFromFilterIpAddresses = ()=>{
            return distinct(filter.ipAddress1 || []).join(', ');
        };
        filterForm.showing = true;
        filterForm.enabled = true;
        filterForm.fieldName = 'IP address(s):';
        filterForm.fieldValueChoices = [];
        filterForm.fieldValueOptions = [];
        filterForm.fieldValue = computeFieldValueFromFilterIpAddresses();
        filterForm.helpText = `'self' to filter your own address, comma-separated if multiple, e.g. self, 1.1.1.1`;
        filterForm.applyValue = ()=>{
            const newValue = parseFilterIpAddressesFromFieldValue();
            if (setEqual(new Set(filter.ipAddress1 || []), new Set(newValue))) return;
            filter.ipAddress1 = newValue;
            this.applyFilter({
                save: true
            });
            const text = newValue.length === 0 ? 'any IP address' : newValue.join(', ');
            this.logWithPrefix(`IP address filter changed to: ${text}`);
        };
        this.onChange();
    }
    editMethodFilter() {
        if (this.demoMode) return;
        const { filter , filterForm  } = this;
        const parseFilterMethodsFromFieldValue = ()=>{
            const { fieldValue  } = filterForm;
            const v = (fieldValue || '').trim();
            if (v === '') return [];
            return distinct(v.split(',').map((v)=>v.trim().toUpperCase()).filter((v)=>v !== ''));
        };
        const computeFieldValueFromFilterMethods = ()=>{
            return distinct(filter.method1 || []).map((v)=>v.toUpperCase()).join(', ');
        };
        filterForm.showing = true;
        filterForm.enabled = true;
        filterForm.fieldName = 'HTTP Method(s):';
        filterForm.fieldValueChoices = [];
        filterForm.fieldValueOptions = [];
        filterForm.fieldValue = computeFieldValueFromFilterMethods();
        filterForm.helpText = 'comma-separated if multiple, e.g. GET, POST';
        filterForm.applyValue = ()=>{
            const newValue = parseFilterMethodsFromFieldValue();
            if (setEqual(new Set(filter.method1 || []), new Set(newValue))) return;
            filter.method1 = newValue;
            this.applyFilter({
                save: true
            });
            const text = newValue.length === 0 ? 'any method' : newValue.join(', ');
            this.logWithPrefix(`Method filter changed to: ${text}`);
        };
        this.onChange();
    }
    editSamplingRateFilter() {
        if (this.demoMode) return;
        const parseSampleRateFromFieldValue = ()=>{
            const { fieldValue  } = filterForm;
            const v = (fieldValue || '').trim();
            if (v === '') return 1;
            const num = parseFloat(v);
            if (!isValidSamplingRate(num)) throw new Error(`Invalid rate: ${v}`);
            return num;
        };
        const { filter , filterForm  } = this;
        filterForm.showing = true;
        filterForm.enabled = true;
        filterForm.fieldName = 'Sampling rate:';
        filterForm.fieldValueChoices = [];
        filterForm.fieldValueOptions = [];
        filterForm.fieldValue = (typeof filter.samplingRate1 === 'number' && isValidSamplingRate(filter.samplingRate1) ? filter.samplingRate1 : 1).toFixed(2);
        filterForm.helpText = 'Can range from 0 (0%) to 1 (100%)';
        filterForm.applyValue = ()=>{
            const newValue = parseSampleRateFromFieldValue();
            if (filter.samplingRate1 === newValue) return;
            filter.samplingRate1 = newValue;
            this.applyFilter({
                save: true
            });
            const text = newValue === 1 ? 'no sampling' : `${newValue} (${(newValue * 100).toFixed(2)}%)`;
            this.logWithPrefix(`Sample rate filter changed to: ${text}`);
        };
        this.onChange();
    }
    editSearchFilter() {
        if (this.demoMode) return;
        const { filter , filterForm  } = this;
        filterForm.showing = true;
        filterForm.enabled = true;
        filterForm.fieldName = 'Search text:';
        filterForm.fieldValueChoices = [];
        filterForm.fieldValueOptions = [];
        filterForm.fieldValue = filter.search1 || '';
        filterForm.helpText = 'Filter by a text match in console.log messages';
        filterForm.applyValue = ()=>{
            if (filter.search1 === filterForm.fieldValue) return;
            filter.search1 = filterForm.fieldValue;
            this.applyFilter({
                save: true
            });
            const text = (filter.search1 || '').length === 0 ? 'no search filter' : `'${filter.search1}'`;
            this.logWithPrefix(`Search filter changed to: ${text}`);
        };
        this.onChange();
    }
    editHeaderFilter() {
        if (this.demoMode) return;
        const { filter , filterForm  } = this;
        const parseFilterHeadersFromFieldValue = ()=>{
            const { fieldValue  } = filterForm;
            const v = (fieldValue || '').trim();
            if (v === '') return [];
            return distinct(v.split(',').map((v)=>v.trim()).filter((v)=>v !== ''));
        };
        const computeFieldValueFromFilterHeaders = ()=>{
            return distinct(filter.header1 || []).join(', ');
        };
        filterForm.showing = true;
        filterForm.enabled = true;
        filterForm.fieldName = 'Header(s):';
        filterForm.fieldValueChoices = [];
        filterForm.fieldValueOptions = [];
        filterForm.fieldValue = computeFieldValueFromFilterHeaders();
        filterForm.helpText = `'key', or 'key:query', comma-separated if multiple`;
        filterForm.applyValue = ()=>{
            const newValue = parseFilterHeadersFromFieldValue();
            if (setEqual(new Set(filter.header1 || []), new Set(newValue))) return;
            filter.header1 = newValue;
            this.applyFilter({
                save: true
            });
            const text = newValue.length === 0 ? 'no header filter' : newValue.join(', ');
            this.logWithPrefix(`Header filter changed to: ${text}`);
        };
        this.onChange();
    }
    editLogpropFilter() {
        if (this.demoMode) return;
        const { filter , filterForm  } = this;
        const parseLogpropFiltersFromFieldValue = ()=>{
            const { fieldValue  } = filterForm;
            const v = (fieldValue || '').trim();
            if (v === '') return [];
            return distinct(v.split(',').map((v)=>v.trim()).filter((v)=>v !== ''));
        };
        const computeFieldValueFromLogPropFilters = ()=>{
            return distinct(filter.logprop1 || []).join(', ');
        };
        filterForm.showing = true;
        filterForm.enabled = true;
        filterForm.fieldName = 'Logprop(s):';
        filterForm.fieldValueChoices = [];
        filterForm.fieldValueOptions = [];
        filterForm.fieldValue = computeFieldValueFromLogPropFilters();
        filterForm.helpText = `'key', or 'key:value', comma-separated if multiple, value may include *`;
        filterForm.applyValue = ()=>{
            const newValue = parseLogpropFiltersFromFieldValue();
            this.setLogpropFilter(newValue);
        };
        this.onChange();
    }
    setLogpropFilter(logpropFilters) {
        const { filter  } = this;
        if (setEqual(new Set(filter.logprop1 || []), new Set(logpropFilters))) return;
        filter.logprop1 = logpropFilters;
        this.applyFilter({
            save: true
        });
        const text = logpropFilters.length === 0 ? 'no logprop filter' : logpropFilters.join(', ');
        this.logWithPrefix(`Logprop filter changed to: ${text}`);
    }
    hasAnyFilters() {
        const { filter  } = this;
        const { event1  } = filter;
        return computeTailOptionsForFilter(filter).filters.length > 0 || typeof event1 === 'string' && event1 !== '' && event1 !== 'all';
    }
    resetFilters() {
        if (this.demoMode) return;
        this.filter = {};
        this.applyFilter({
            save: true
        });
        this.logWithPrefix(`Filters reset`);
        this.onChange();
    }
    cancelFilter() {
        console.log('cancelFilter');
        this.filterForm.showing = false;
        this.onChange();
    }
    saveFilter() {
        console.log('saveFilter');
        const { filterForm  } = this;
        filterForm.enabled = false;
        filterForm.outputMessage = 'Checking filter...';
        this.onChange();
        try {
            filterForm.applyValue();
            filterForm.outputMessage = ``;
            filterForm.showing = false;
        } catch (e) {
            filterForm.outputMessage = `Error: ${e.message}`;
        } finally{
            filterForm.enabled = true;
            this.onChange();
        }
    }
    selectFilterChoice(id) {
        if (this.filterForm.fieldValue === id) return;
        this.filterForm.fieldValue = id;
        this.onChange();
    }
    editSelectionFields() {
        if (this.demoMode) return;
        const { filterForm  } = this;
        filterForm.showing = true;
        filterForm.enabled = true;
        filterForm.fieldName = 'Additional fields:';
        filterForm.fieldValueChoices = [];
        filterForm.fieldValueOptions = EXTRA_FIELDS_OPTIONS;
        filterForm.fieldValue = (this.extraFields || []).join(',');
        filterForm.helpText = 'Select additional fields to show in the output';
        filterForm.applyValue = ()=>{
            const newValues = distinct((filterForm.fieldValue || '').split(',').map((v)=>v.trim()).filter((v)=>v !== ''));
            if (setEqual(new Set(this.extraFields || []), new Set(newValues))) return;
            this.extraFields = newValues;
            this.applyFilter({
                save: true
            });
            const extraFieldsText = this.computeSelectionFieldsText();
            this.logWithPrefix(`Output fields changed to: ${extraFieldsText}`);
        };
        this.onChange();
    }
    computeSelectionFieldsText() {
        return [
            'standard fields',
            ...this.extraFields.map((id)=>EXTRA_FIELDS_OPTIONS.find((v)=>v.id === id)?.text || id)
        ].join(', ');
    }
    toggleFilterOption(id) {
        const extraFields = distinct((this.filterForm.fieldValue || '').split(',').map((v)=>v.trim()).filter((v)=>v !== ''));
        const i = extraFields.indexOf(id);
        if (i >= 0) {
            extraFields.splice(i, 1);
        } else {
            extraFields.push(id);
        }
        const fieldValue = extraFields.join(',');
        if (this.filterForm.fieldValue === fieldValue) return;
        this.filterForm.fieldValue = fieldValue;
        this.onChange();
    }
    toggleDemoMode() {
        this.setDemoMode(!this.demoMode);
        this.onChange();
    }
    resetOutput() {
        if (this.demoMode) return;
        this.onResetOutput();
    }
    showAbout() {
        if (this.demoMode) return;
        this.aboutShowing = true;
        this.onChange();
    }
    closeAbout() {
        this.aboutShowing = false;
        this.onChange();
    }
    showAnalytic(analyticId) {
        const analytic = this.analytics.find((v)=>v.id === analyticId);
        if (!analytic || analytic.id === this._selectedAnalyticId) return;
        if (this.selectedProfileId === undefined) return;
        const profile = this.state.profiles[this.selectedProfileId];
        if (profile === undefined) return;
        const { accountId , apiToken  } = profile;
        this._selectedAnalyticId = analyticId;
        this.analyticsState.querying = true;
        this.analyticsState.durableObjectsCosts = undefined;
        this.analyticsState.error = undefined;
        this.onChange();
        const client = new CfGqlClient({
            accountId,
            apiToken
        });
        this.queryDurableObjectsCosts(client);
    }
    setDemoMode(demoMode) {
        if (this.demoMode === demoMode) return;
        this.demoMode = demoMode;
        if (demoMode) {
            console.log('Enable demo mode');
            this.onQpsChange(12.34);
            this.onResetOutput();
            DemoMode.logFakeOutput(this.tailControllerCallbacks);
        } else {
            console.log('Disable demo mode');
            this.onQpsChange(this.qpsController.qps);
            this.onResetOutput();
        }
    }
    applyFilter(opts) {
        const { save  } = opts;
        this.state.filter = this.filter;
        this.state.extraFields = this.extraFields;
        if (save) saveState(this.state);
        const tailOptions = computeTailOptionsForFilter(this.filter);
        this.tailController.setTailOptions(tailOptions);
    }
    logWithPrefix(...data) {
        const time = formatLocalYyyyMmDdHhMmSs(new Date());
        if (data.length > 0 && typeof data[0] === 'string') {
            data = [
                `[%c${time}%c] ${data[0]}`,
                'color: gray',
                '',
                ...data.slice(1)
            ];
        }
        this.logger(...data);
    }
    verboseWithPrefix(message) {
        const time = formatLocalYyyyMmDdHhMmSs(new Date());
        this.logger(`[%c${time}%c] %c${message}%c`, 'color: gray', '', 'color: gray');
    }
    performInitialSelection() {
        const initiallySelectedProfileId = computeInitiallySelectedProfileId(this.state, this._profiles);
        if (initiallySelectedProfileId) {
            console.log(`Initially selecting profile: ${this.state.profiles[initiallySelectedProfileId].name}`);
            this.selectedProfileId = initiallySelectedProfileId;
        } else {
            this.onChange();
        }
    }
    async trySaveProfile(profileId, profile) {
        const { profileForm  } = this;
        profileForm.enabled = false;
        profileForm.progressVisible = true;
        profileForm.outputMessage = 'Checking profile...';
        this.onChange();
        try {
            const canListTails = await computeCanListTails(profile.accountId, profile.apiToken);
            if (canListTails) {
                this.state.profiles[profileId] = profile;
                saveState(this.state);
                profileForm.outputMessage = '';
                this.reloadProfiles();
                this.recomputeWelcomeShowing();
                profileForm.showing = false;
                this.selectedProfileId = profileId;
            } else {
                profileForm.outputMessage = `These credentials do not have permission to tail`;
            }
        } catch (e) {
            profileForm.outputMessage = `Error: ${e.message}`;
        } finally{
            profileForm.progressVisible = false;
            profileForm.enabled = true;
            this.onChange();
        }
    }
    reloadProfiles() {
        const { state  } = this;
        this._profiles.splice(0);
        for (const [profileId, profile] of Object.entries(state.profiles)){
            const name = profile.name || '(unnamed)';
            this._profiles.push({
                id: profileId,
                text: name
            });
        }
    }
    async findScripts() {
        try {
            if (this.selectedProfileId === undefined) return;
            const profile = this.state.profiles[this.selectedProfileId];
            if (profile === undefined) return;
            const { accountId , apiToken  } = profile;
            this.verboseWithPrefix(`Finding scripts for ${profile.name.toUpperCase()}...`);
            const start = Date.now();
            const scripts = await listScripts({
                accountId,
                apiToken
            });
            if (!this.demoMode) this.verboseWithPrefix(`Found ${scripts.length} scripts in ${Date.now() - start}ms`);
            this._scripts.splice(0);
            for (const script of scripts){
                this._scripts.push({
                    id: script.id,
                    text: script.id
                });
            }
            this._scripts.sort((lhs, rhs)=>lhs.text.localeCompare(rhs.text));
            const selectedScriptIds = this.computeSelectedScriptIdsAfterFindScripts();
            if (selectedScriptIds.size > 0) {
                this.selectedScriptIds = selectedScriptIds;
            }
            if (!this.demoMode) this.onChange();
        } catch (e) {
            if (!this.demoMode) this.logger(`Error in findScripts: ${e.stack}`);
        }
    }
    computeSelectedScriptIdsAfterFindScripts() {
        if (this._scripts.length === 0) {
            console.log('Initially selecting no scripts, no scripts to select');
            return new Set();
        }
        if (this.selectedProfileId && this.selectedProfileId && this.selectedProfileId === this.state.selectedProfileId) {
            const initialProfile = this.state.profiles[this.selectedProfileId];
            if (initialProfile && initialProfile.selectedScriptIds && initialProfile.selectedScriptIds.length > 0) {
                const currentScriptIds = new Set(this._scripts.map((v)=>v.id));
                const candidates = setIntersect(currentScriptIds, new Set(initialProfile.selectedScriptIds));
                if (candidates.size > 0) {
                    console.log(`Initially selecting script${candidates.size === 1 ? '' : 's'} ${[
                        ...candidates
                    ].sort().join(', ')}: remembered from last time`);
                    return candidates;
                }
            }
        }
        const firstScriptId = this._scripts[0].id;
        console.log(`Initially selecting script ${firstScriptId}: first one in the list`);
        return new Set([
            this._scripts[0].id
        ]);
    }
    async setTails() {
        if (this.selectedProfileId === undefined) return;
        const profile = this.state.profiles[this.selectedProfileId];
        if (profile === undefined) return;
        const { accountId , apiToken  } = profile;
        try {
            await this.tailController.setTails(accountId, apiToken, this._selectedScriptIds);
        } catch (e) {
            this.logger('Error in setTails', e.stack || e.message);
        }
    }
    computeAdditionalLogs(message) {
        const rt = [];
        const includeIpAddress = this.extraFields.includes('ip-address');
        const includeUserAgent = this.extraFields.includes('user-agent');
        const includeReferer = this.extraFields.includes('referer');
        if (includeIpAddress || includeUserAgent || includeReferer) {
            if (message.event !== null && !isTailMessageCronEvent(message.event) && !isTailMessageAlarmEvent(message.event) && !isTailMessageQueueEvent(message.event)) {
                if (includeIpAddress) {
                    const ipAddress = message.event.request.headers['cf-connecting-ip'] || undefined;
                    if (ipAddress) rt.push(computeAdditionalLogForExtraField('IP address', ipAddress));
                }
                if (includeUserAgent) {
                    const userAgent = message.event.request.headers['user-agent'] || undefined;
                    if (userAgent) rt.push(computeAdditionalLogForExtraField('User agent', userAgent));
                }
                if (includeReferer) {
                    const referer = message.event.request.headers['referer'] || undefined;
                    if (referer) {
                        const refererUrl = tryParseUrl(referer);
                        let log = true;
                        if (refererUrl !== undefined) {
                            const requestUrl = tryParseUrl(message.event.request.url);
                            if (requestUrl && requestUrl.origin === refererUrl.origin) {
                                log = false;
                            }
                        }
                        if (log) rt.push(computeAdditionalLogForExtraField('Referer', referer));
                    }
                }
            }
        }
        return rt;
    }
    recomputeWelcomeShowing() {
        const shouldShow = this.profiles.length === 0;
        if (shouldShow === this.welcomeShowing) return;
        this.setDemoMode(shouldShow);
        this.welcomeShowing = shouldShow;
    }
    async queryDurableObjectsCosts(client) {
        try {
            this.analyticsState.durableObjectsCosts = await computeDurableObjectsCostsTable(client, {
                lookbackDays: 28
            });
            if (this.analyticsState.durableObjectsCosts.accountTable.rows.length === 0) {
                this.analyticsState.durableObjectsCosts = undefined;
                throw new Error('No durable object analytics found');
            }
        } catch (e) {
            console.warn(e);
            let error = `${e}`;
            if (error.includes('(code=authz)')) {
                error = `The auth token for this profile does not have the Account Analytics:Read permission.`;
            }
            this.analyticsState.error = error;
        } finally{
            this.analyticsState.querying = false;
            this.onChange();
        }
    }
}
function computeAdditionalLogForExtraField(name, value) {
    return {
        data: [
            ` %c|%c [%c${name}%c] ${value}`,
            'color:gray',
            '',
            'color:gray'
        ]
    };
}
class ProfileFormVM {
    showing = false;
    enabled = false;
    name = '';
    accountId = '';
    apiToken = '';
    deleteVisible = false;
    saveEnabled = false;
    profileId = '';
    title = '';
    progressVisible = false;
    outputMessage = '';
    computeSaveEnabled() {
        this.saveEnabled = this.name.trim().length > 0 && this.apiToken.trim().length > 0 && this.accountId.trim().length > 0;
    }
}
class FilterFormVM {
    showing = false;
    enabled = false;
    fieldName = '';
    fieldValueChoices = [];
    fieldValueOptions = [];
    fieldValue;
    helpText = '';
    outputMessage = '';
    applyValue = ()=>{};
}
const EXTRA_FIELDS_OPTIONS = [
    {
        id: 'ip-address',
        text: 'IP address'
    },
    {
        id: 'user-agent',
        text: 'User agent'
    },
    {
        id: 'referer',
        text: 'Referer'
    }
];
const STATE_KEY = 'state1';
function loadState() {
    try {
        const json = localStorage.getItem(STATE_KEY) || undefined;
        if (json) {
            const obj = JSON.parse(json);
            const rt = parseState(obj);
            return rt;
        }
    } catch (e) {
        console.warn('loadState: Error loading state', e.stack || e);
    }
    console.log('loadState: returning new state');
    return {
        profiles: {}
    };
}
function parseState(parsed) {
    if (typeof parsed !== 'object') throw new Error(`Expected object`);
    const { profiles  } = parsed;
    if (typeof profiles !== 'object') throw new Error(`Expected profiles object`);
    for (const [profileId, profileState] of Object.entries(profiles)){
        if (typeof profileId !== 'string') throw new Error('Profile id must be string');
        parseProfileState(profileState);
    }
    return parsed;
}
function parseProfileState(parsed) {
    if (typeof parsed !== 'object' || parsed === null) throw new Error('Profile state must be object');
    const { name , accountId , apiToken  } = parsed;
    if (typeof name !== 'string' || name.trim().length === 0) throw new Error(`Profile state name must exist`);
    if (typeof accountId !== 'string' || accountId.trim().length === 0) throw new Error(`Profile state accountId must exist`);
    if (typeof apiToken !== 'string' || apiToken.trim().length === 0) throw new Error(`Profile state apiToken must exist`);
    return parsed;
}
function saveState(state) {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
}
async function computeCanListTails(accountId, apiToken) {
    try {
        await listTails({
            accountId,
            scriptName: '',
            apiToken
        });
        return true;
    } catch (e) {
        if (e instanceof CloudflareApiError && e.status === 404) {
            return true;
        } else {}
        return false;
    }
}
function isValidSamplingRate(samplingRate) {
    return !isNaN(samplingRate) && samplingRate >= 0 && samplingRate <= 1;
}
function computeInitiallySelectedProfileId(state, profiles) {
    if (state.selectedProfileId && state.profiles[state.selectedProfileId]) return state.selectedProfileId;
    if (profiles.length > 0) return profiles[0].id;
    return undefined;
}
function computeTailOptionsForFilter(filter) {
    const filters = [];
    if (filter.status1 === 'error') {
        filters.push({
            outcome: [
                'exception',
                'exceededCpu',
                'canceled',
                'unknown'
            ]
        });
    } else if (filter.status1 === 'success') {
        filters.push({
            outcome: [
                'ok'
            ]
        });
    }
    if (filter.samplingRate1 !== undefined && isValidSamplingRate(filter.samplingRate1) && filter.samplingRate1 < 1) {
        filters.push({
            sampling_rate: filter.samplingRate1
        });
    }
    if (filter.search1 !== undefined && filter.search1.length > 0) {
        filters.push({
            query: filter.search1
        });
    }
    if (filter.method1 && filter.method1.length > 0) {
        filters.push({
            method: filter.method1
        });
    }
    if (filter.ipAddress1 && filter.ipAddress1.length > 0) {
        filters.push({
            client_ip: filter.ipAddress1
        });
    }
    if (filter.header1 && filter.header1.length > 0) {
        for (const header of filter.header1){
            filters.push(parseHeaderFilter(header));
        }
    }
    return {
        filters
    };
}
function computeMessagePassesFilter(message, filter) {
    if (!computeMessagePassesLogPropFilter(message, filter.logprop1)) return false;
    if (filter.event1 === 'cron' || filter.event1 === 'http') {
        const isCron = isTailMessageCronEvent(message);
        return isCron && filter.event1 === 'cron' || !isCron && filter.event1 === 'http';
    }
    return true;
}
function computeMessagePassesLogPropFilter(message, logprop1) {
    if (logprop1 === undefined || logprop1.length === 0) return true;
    const logpropFilters = logprop1.map(parseHeaderFilter);
    const { props  } = parseLogProps(message.logs);
    for (const logpropFilter of logpropFilters){
        if (computePropsPassLogpropFilter(props, logpropFilter)) return true;
    }
    return false;
}
function computePropsPassLogpropFilter(props, logpropFilter) {
    const val = props[logpropFilter.key];
    if (val === undefined) return false;
    if (logpropFilter.query === undefined) return true;
    const q = logpropFilter.query.trim().replaceAll(/\*+/g, '*');
    if (!q.includes('*')) return q === val;
    if (q === '*') return true;
    if (typeof val !== 'string') return false;
    const pattern = '^' + escapeForRegex(q).replaceAll('\\*', '.*') + '$';
    return new RegExp(pattern).test(val);
}
function escapeForRegex(str) {
    return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}
function distinct(values) {
    const rt = [];
    for (const value of values){
        if (!rt.includes(value)) {
            rt.push(value);
        }
    }
    return rt;
}
function tryParseUrl(url) {
    try {
        return new URL(url);
    } catch  {
        return undefined;
    }
}
const FILTER_EDITOR_HTML = html`
<form id="filter-form" autocomplete="off">
<fieldset id="filter-fieldset">
  <div id="filter-form-title" class="h6 high-emphasis-text form-row">Edit filter</div>

  <label id="filter-field-label">Filter field:</label>
  <input id="filter-field-text" type="text">
  <div id="filter-field-choice"></div>
  <div id="filter-field-options"></div>

  <div id="filter-form-help" class="body2 medium-emphasis-text">
  </div>  

  <div id="filter-form-output-row" class="form-row">
    <output id="filter-form-output"></output>
  </div>

  <div id="filter-form-buttons" class="form-rhs">
    <button id="filter-apply" type="submit">Apply</button><!-- first so it is default button on return -->
    <button id="filter-cancel">Cancel</button>
  </div>
</fieldset>
</form>
`;
const FILTER_EDITOR_CSS = css`

    #filter-form-buttons {
        justify-self: end;
        display: flex;
        flex-direction: row-reverse;
        gap: 1rem;
    }

    #filter-field-choice {
        display: flex;
        gap: 1px;
    }

    #filter-field-options {
        display: flex;
        flex-wrap: wrap;
        gap: 1px;
    }

    #filter-field-options button {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    #filter-form-help {
        grid-column: 2;
    }

    #filter-form-output-row {
        display: flex;
        align-items: center;
        gap: 1rem;
        min-height: 2.5rem;
    }

    #filter-form-output-row output {
        flex-grow: 1;
    }

`;
function initFilterEditor(document1, vm) {
    const filterForm = document1.getElementById('filter-form');
    const filterFieldset = document1.getElementById('filter-fieldset');
    const filterFieldLabel = document1.getElementById('filter-field-label');
    const filterFieldTextInput = document1.getElementById('filter-field-text');
    const filterFieldChoiceDiv = document1.getElementById('filter-field-choice');
    const filterFieldOptionsDiv = document1.getElementById('filter-field-options');
    const filterCancelButton = document1.getElementById('filter-cancel');
    const filterApplyButton = document1.getElementById('filter-apply');
    const filterFormOutput = document1.getElementById('filter-form-output');
    const filterFormHelpDiv = document1.getElementById('filter-form-help');
    filterCancelButton.onclick = (e)=>{
        e.preventDefault();
        vm.cancelFilter();
    };
    filterApplyButton.onclick = (e)=>{
        e.preventDefault();
        const type = computeType(vm);
        if (type === 'text') {
            vm.filterForm.fieldValue = filterFieldTextInput.value;
        }
        vm.saveFilter();
    };
    return ()=>{
        const wasHidden = filterForm.style.display === 'none';
        filterForm.style.display = vm.filterForm.showing ? 'block' : 'none';
        filterFieldset.disabled = !vm.filterForm.enabled;
        const type = computeType(vm);
        filterFieldLabel.textContent = vm.filterForm.fieldName;
        filterFieldLabel.htmlFor = type == 'choice' ? filterFieldChoiceDiv.id : type == 'options' ? filterFieldOptionsDiv.id : filterFieldTextInput.id;
        filterFieldTextInput.style.display = type == 'text' ? 'block' : 'none';
        filterFieldChoiceDiv.style.display = type == 'choice' ? 'flex' : 'none';
        LitElement.render(CHOICES_HTML(vm), filterFieldChoiceDiv);
        filterFieldOptionsDiv.style.display = type == 'options' ? 'flex' : 'none';
        LitElement.render(OPTIONS_HTML(vm), filterFieldOptionsDiv);
        filterFormHelpDiv.textContent = vm.filterForm.helpText;
        filterFormOutput.textContent = vm.filterForm.outputMessage;
        if (wasHidden && vm.filterForm.showing) {
            console.log('filter form open');
            if (type === 'text' && vm.filterForm.fieldValue) filterFieldTextInput.value = vm.filterForm.fieldValue;
            setTimeout(()=>{
                filterFieldTextInput.focus();
                filterFieldTextInput.select();
            }, 0);
        }
    };
}
function computeType(vm) {
    return vm.filterForm.fieldValueChoices.length > 0 ? 'choice' : vm.filterForm.fieldValueOptions.length ? 'options' : 'text';
}
const CHOICES_HTML = (vm)=>{
    return vm.filterForm.fieldValueChoices.map((choice)=>html`<button class="${choice.id === vm.filterForm.fieldValue ? 'selected' : ''}" @click=${(e)=>{
            e.preventDefault();
            vm.selectFilterChoice(choice.id);
        }} ?disabled="${!vm.filterForm.showing}">${choice.text}</button>`);
};
const OPTIONS_HTML = (vm)=>{
    return vm.filterForm.fieldValueOptions.map((option)=>{
        const selected = fieldValueSet(vm).has(option.id);
        return html`<button class="${selected ? 'selected' : ''}" @click=${(e)=>{
            e.preventDefault();
            vm.toggleFilterOption(option.id);
        }} ?disabled="${!vm.filterForm.showing}">${selected ? CHECK_BOX_CHECKED_ICON : CHECK_BOX_UNCHECKED_ICON} ${option.text}</button>`;
    });
};
function fieldValueSet(vm) {
    return new Set((vm.filterForm.fieldValue || '').split(',').map((v)=>v.trim()).filter((v)=>v.length > 0));
}
const PROFILE_EDITOR_HTML = html`
<form id="profile-form" autocomplete="off">
<fieldset id="profile-fieldset">
  <div id="profile-form-title" class="h6 high-emphasis-text form-row">Profile</div>

  <label for="profile-name">Profile name:</label>
  <input id="profile-name" type="text">

  <label for="account-id">Cloudflare Account ID:</label>
  <input id="profile-account-id" type="text">

  <label for="api-token">Cloudflare API Token:</label>
  <input id="profile-api-token" type="text">

  <details id="profile-form-help-row" class="form-row">
    <summary>Use a <a href="https://en.wikipedia.org/wiki/Principle_of_least_privilege" target="_blank">least privilege</a> token with permission: <code>Account &gt; Workers Tail &gt; Read</code></summary>
    <ol>
        <li>Select <span class="cf-button">Create Token</span> on your Cloudflare <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank">API Tokens</a> page.</li>
        <li>Scroll down to <span class="cf-section">Create Custom Token</span>, then <span class="cf-button">Get started</span></li>
        <li>Under <span class="cf-section">Permissions</span>, grant your token <span class="cf-section">Account</span> <span class="cf-section">Workers Tail</span> <span class="cf-section">Read</span></li>
        <li>Also (for analytics), grant your token <span class="cf-section">Account</span> <span class="cf-section">Account Analytics</span> <span class="cf-section">Read</span></li>
        <li>Also (for DO names), grant your token <span class="cf-section">Account</span> <span class="cf-section">Worker Scripts</span> <span class="cf-section">Read</span></li>
    </ol>
  </details>  

  <div id="profile-form-output-row" class="form-row">
    <output id="profile-form-output"></output>
    <progress id="profile-form-progress" class="pure-material-progress-circular"></progress>
  </div>

  <div class="form-lhs">
    <button id="profile-delete">Delete</button>
  </div>
  <div id="profile-form-buttons" class="form-rhs">
    <button id="profile-cancel">Cancel</button>
    <button id="profile-save">Save</button>
  </div>
</fieldset>
</form>
`;
const PROFILE_EDITOR_CSS = css`

    #profile-form-buttons {
        justify-self: end;
        display: flex;
        gap: 1rem;
    }

    #profile-form-help-row {
        cursor: pointer;
    }

    #profile-form-help-row summary {
        user-select: none; -webkit-user-select: none;
    }

    #profile-form-help-row ol {
        cursor: default;
    }

    #profile-form-help-row li {
        padding: 0.5rem 0;
    }

    .cf-button {
        display: inline-block;
        background-color: blue;
        color: white;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
    }

    .cf-section {
        display: inline-block;
        background-color: white;
        color: black;
        padding: 0.25rem 0.5rem;
        outline: solid 1px gray;
    }

    #profile-form-output-row {
        display: flex;
        align-items: center;
        gap: 1rem;
        min-height: 2.5rem;
    }

    #profile-form-output-row output {
        flex-grow: 1;
    }

    #profile-form-progress {
        font-size: 0.5rem; /* default 3em => 1.5rem */
    }

`;
function initProfileEditor(document1, vm) {
    const profileForm = document1.getElementById('profile-form');
    const profileFormTitleDiv = document1.getElementById('profile-form-title');
    const profileFieldset = document1.getElementById('profile-fieldset');
    const profileNameInput = document1.getElementById('profile-name');
    const profileAccountIdInput = document1.getElementById('profile-account-id');
    const profileApiTokenInput = document1.getElementById('profile-api-token');
    const profileDeleteButton = document1.getElementById('profile-delete');
    const profileCancelButton = document1.getElementById('profile-cancel');
    const profileSaveButton = document1.getElementById('profile-save');
    const profileFormProgress = document1.getElementById('profile-form-progress');
    const profileFormOutput = document1.getElementById('profile-form-output');
    const profileFormHelpDetails = document1.getElementById('profile-form-help-row');
    profileCancelButton.onclick = (e)=>{
        e.preventDefault();
        vm.cancelProfile();
    };
    profileNameInput.oninput = ()=>{
        vm.setProfileName(profileNameInput.value);
    };
    profileAccountIdInput.oninput = ()=>{
        vm.setProfileAccountId(profileAccountIdInput.value);
    };
    profileApiTokenInput.oninput = ()=>{
        vm.setProfileApiToken(profileApiTokenInput.value);
    };
    profileSaveButton.onclick = (e)=>{
        e.preventDefault();
        vm.saveProfile();
    };
    profileDeleteButton.onclick = (e)=>{
        e.preventDefault();
        vm.deleteProfile(vm.profileForm.profileId);
    };
    return ()=>{
        const wasHidden = profileForm.style.display === 'none';
        profileForm.style.display = vm.profileForm.showing ? 'block' : 'none';
        profileFieldset.disabled = !vm.profileForm.enabled;
        profileFormTitleDiv.textContent = vm.profileForm.title;
        profileNameInput.value = vm.profileForm.name;
        profileAccountIdInput.value = vm.profileForm.accountId;
        profileApiTokenInput.value = vm.profileForm.apiToken;
        profileDeleteButton.style.display = vm.profileForm.deleteVisible ? 'inline-block' : 'none';
        profileSaveButton.disabled = !vm.profileForm.saveEnabled;
        profileFormProgress.style.display = vm.profileForm.progressVisible ? 'block' : 'none';
        profileFormOutput.textContent = vm.profileForm.outputMessage;
        if (wasHidden && vm.profileForm.showing) {
            const initialDetailsOpen = vm.realProfiles.length === 0;
            profileFormHelpDetails.open = initialDetailsOpen;
            setTimeout(()=>{
                profileNameInput.focus();
                profileNameInput.select();
            }, 0);
        }
    };
}
const WELCOME_PANEL_HTML = html`
<form id="welcome-panel" autocomplete="off">
<fieldset id="welcome-panel-fieldset">
  <div id="welcome-panel-form-title" class="h6 high-emphasis-text form-row">title</div>

  <div class="form-row body2 medium-emphasis-text">
    Welcome to <span class="high-emphasis-text">Webtail for Cloudflare Workers</span>!
    <p>View live requests and logs from <a href="https://workers.cloudflare.com/" target="_blank">Cloudflare Workers</a> from the comfort of your browser. 
    A few enhancements over what's provided <a href="https://blog.cloudflare.com/introducing-workers-dashboard-logs/" target="_blank">by default</a> in the Cloudflare dashboard:</p>
    <ul>
        <li>Tail multiple workers at the same time</li>
        <li>Advanced filtering and multi-color output similar to <a href="https://developers.cloudflare.com/workers/cli-wrangler/commands#tail" target="_blank">wrangler tail</a></li>
        <li>Durable object class/name/id and colo information can be surfaced with <a href="https://denoflare.dev/examples/webtail#logprops" target="_blank">logprops</a></li>
        <li>Multiple profiles, switch easily between multiple accounts</li>
        <li>No need to log in with your full Cloudflare credentials.  Profiles are stored locally in the browser, and can be permissioned only for tailing workers</li>
        <li>Implemented as <a href="https://github.com/skymethod/denoflare/tree/master/examples/webtail-worker" target="_blank">an open-source Cloudflare Worker</a>, 
           <a href="https://denoflare.dev/examples/webtail#deploy-it-to-your-own-account" target="_blank">deploy it to your own account</a>, 
            or <a href="https://denoflare.dev/examples/webtail#host-it-locally" target="_blank">host it locally</a> with <a href="https://github.com/skymethod/denoflare" target="_blank"><code>denoflare</code></a></li>
    </ul>
    <p id="welcome-panel-trailer">Create a new profile to get started!</p>
    <p id="about-panel-trailer">Head over to the <a href="https://github.com/skymethod/denoflare" target="_blank">Denoflare GitHub repo</a> to request features, report bugs, or check out the code!</p>
  </div>

  <div class="form-rhs">
    <button id="welcome-panel-new-profile" type="submit">New profile</button>
    <button id="welcome-panel-close" type="submit">Close</button>
  </div>
</fieldset>
</form>
`;
const WELCOME_PANEL_CSS = css`

    #welcome-panel-form-title {
        user-select: none; -webkit-user-select: none;
    }

`;
function initWelcomePanel(document1, vm) {
    const welcomePanelElement = document1.getElementById('welcome-panel');
    const titleElement = document1.getElementById('welcome-panel-form-title');
    const welcomeTrailerElement = document1.getElementById('welcome-panel-trailer');
    const aboutTrailerElement = document1.getElementById('about-panel-trailer');
    const newProfileButton = document1.getElementById('welcome-panel-new-profile');
    const closeButton = document1.getElementById('welcome-panel-close');
    newProfileButton.onclick = (e)=>{
        e.preventDefault();
        vm.newProfile();
    };
    closeButton.onclick = (e)=>{
        e.preventDefault();
        vm.closeAbout();
    };
    return ()=>{
        const wasHidden = welcomePanelElement.style.display === 'none';
        const show = vm.welcomeShowing && !vm.profileForm.showing || vm.aboutShowing;
        welcomePanelElement.style.display = show ? 'block' : 'none';
        const welcome = vm.welcomeShowing;
        titleElement.textContent = welcome ? 'Hello 👋' : 'About';
        welcomeTrailerElement.style.display = welcome ? 'block' : 'none';
        aboutTrailerElement.style.display = welcome ? 'none' : 'block';
        newProfileButton.style.display = welcome ? 'block' : 'none';
        closeButton.style.display = welcome ? 'none' : 'block';
        if (wasHidden && show) {
            console.log(`${welcome ? 'welcome' : 'about'} panel open`);
            setTimeout(()=>{
                (welcome ? newProfileButton : closeButton).focus();
            }, 0);
        }
    };
}
const MODAL_HTML = html`
<div id="modal" class="modal hidden-vertical-scroll">
    <div class="modal-content">
    ${WELCOME_PANEL_HTML}
    ${PROFILE_EDITOR_HTML}
    ${FILTER_EDITOR_HTML}
    </div>
</div>
`;
const MODAL_CSS = css`
.modal {
    display: none;
    position: fixed;
    z-index: 1;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.4);
}

.modal-content {
    margin: 10% auto;
    width: 80%;
    max-width: 40rem;
    background-color: var(--background-color);
}

@media screen and (max-width: 600px) {
    .modal-content {
        margin: 10% 0;
        width: 100%;
    }
}

`;
function initModal(document1, vm) {
    const modal = document1.getElementById('modal');
    const updateProfileEditor = initProfileEditor(document1, vm);
    const updateFilterEditor = initFilterEditor(document1, vm);
    const updateWelcomePanel = initWelcomePanel(document1, vm);
    const closeModal = ()=>{
        if (!vm.profileForm.showing && !vm.filterForm.showing && !vm.welcomeShowing && !vm.aboutShowing) return;
        if (vm.profileForm.progressVisible) return;
        vm.profileForm.showing = false;
        vm.filterForm.showing = false;
        vm.aboutShowing = false;
        vm.onChange();
    };
    window.addEventListener('click', (event)=>{
        if (event.target == modal) {
            closeModal();
        }
    });
    document1.addEventListener('keydown', (event)=>{
        event = event || window.event;
        if (event.key === 'Escape') {
            closeModal();
        }
    });
    return ()=>{
        updateProfileEditor();
        updateFilterEditor();
        updateWelcomePanel();
        modal.style.display = vm.profileForm.showing || vm.filterForm.showing || vm.welcomeShowing || vm.aboutShowing ? 'block' : 'none';
    };
}
const CIRCULAR_PROGRESS_CSS = css`
.pure-material-progress-circular {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    box-sizing: border-box;
    border: none;
    border-radius: 50%;
    padding: 0.25em;
    width: 3em;
    height: 3em;
    color: var(--pure-material-primary-rgb, rgb(33, 150, 243));
    background-color: transparent;
    font-size: 16px;
    overflow: hidden;
}

.pure-material-progress-circular::-webkit-progress-bar {
    background-color: transparent;
}

/* Indeterminate */
.pure-material-progress-circular:indeterminate {
    -webkit-mask-image: linear-gradient(transparent 50%, black 50%), linear-gradient(to right, transparent 50%, black 50%);
    mask-image: linear-gradient(transparent 50%, black 50%), linear-gradient(to right, transparent 50%, black 50%);
    animation: pure-material-progress-circular 6s infinite cubic-bezier(0.3, 0.6, 1, 1);
}

:-ms-lang(x), .pure-material-progress-circular:indeterminate {
    animation: none;
}

.pure-material-progress-circular:indeterminate::before,
.pure-material-progress-circular:indeterminate::-webkit-progress-value {
    content: "";
    display: block;
    box-sizing: border-box;
    margin-bottom: 0.25em;
    border: solid 0.25em transparent;
    border-top-color: currentColor;
    border-radius: 50%;
    width: 100% !important;
    height: 100%;
    background-color: transparent;
    animation: pure-material-progress-circular-pseudo 0.75s infinite linear alternate;
}

.pure-material-progress-circular:indeterminate::-moz-progress-bar {
    box-sizing: border-box;
    border: solid 0.25em transparent;
    border-top-color: currentColor;
    border-radius: 50%;
    width: 100%;
    height: 100%;
    background-color: transparent;
    animation: pure-material-progress-circular-pseudo 0.75s infinite linear alternate;
}

.pure-material-progress-circular:indeterminate::-ms-fill {
    animation-name: -ms-ring;
}

@keyframes pure-material-progress-circular {
    0% {
        transform: rotate(0deg);
    }
    12.5% {
        transform: rotate(180deg);
        animation-timing-function: linear;
    }
    25% {
        transform: rotate(630deg);
    }
    37.5% {
        transform: rotate(810deg);
        animation-timing-function: linear;
    }
    50% {
        transform: rotate(1260deg);
    }
    62.5% {
        transform: rotate(1440deg);
        animation-timing-function: linear;
    }
    75% {
        transform: rotate(1890deg);
    }
    87.5% {
        transform: rotate(2070deg);
        animation-timing-function: linear;
    }
    100% {
        transform: rotate(2520deg);
    }
}

@keyframes pure-material-progress-circular-pseudo {
    0% {
        transform: rotate(-30deg);
    }
    29.4% {
        border-left-color: transparent;
    }
    29.41% {
        border-left-color: currentColor;
    }
    64.7% {
        border-bottom-color: transparent;
    }
    64.71% {
        border-bottom-color: currentColor;
    }
    100% {
        border-left-color: currentColor;
        border-bottom-color: currentColor;
        transform: rotate(225deg);
    }
}
`;
const CONSOLE_HTML = html`
<div id="console">
    <div id="console-header">
        <div id="console-header-filters" class="body2"></div>
        <div id="console-header-status">
            <div id="console-header-tails" class="overline medium-emphasis-text"></div>
            <div id="console-header-qps" class="overline medium-emphasis-text"></div>
            <div id="console-header-clear"></div>
        </div>
    </div>
    <code id="console-last-line" class="line">spacer</code>
</div>
`;
const CONSOLE_CSS = css`

#console {
    color: var(--high-emphasis-text-color);
    height: 100vh;
    width: 100%;
    background-color: var(--background-color);
    overflow-y: scroll;
    overflow-x: hidden;
    flex-grow: 1;
}

#console::-webkit-scrollbar {
    width: 1rem;
    height: 3rem;
    background-color: var(--background-color);
}

#console::-webkit-scrollbar-thumb {
    background-color: var(--medium-emphasis-text-color);
}

#console-header {
    position: sticky;
    top: 0;
    height: 3.75rem;
    background-color: var(--background-color);
    display: flex;
    padding: 1.25rem 1rem 1rem 0;
}

#console-header-filters {
    flex-grow: 1;
    color: var(--medium-emphasis-text-color);
    font-family: var(--sans-serif-font-family);

    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;  
    overflow: hidden;
}

#console-header-status {
    height: 1rem;
    display: flex;
    flex-direction: column;
    min-width: 6rem;
    text-align: right;
    padding-top: 0.25rem;
    user-select: none; -webkit-user-select: none;
}

#console-header-tails {
    white-space: nowrap;
}

#console-header-clear {
    margin-right: -0.5rem;
    margin-left: 1rem;
    visibility: hidden;
}

#console-header-clear .action-icon {
    padding-right: 0.5rem;
    padding-left: 0.5rem;
}

#console .line {
    display: block;
    font-size: 0.75rem; /* 12px */
    line-height: 1.1rem;
    font-family: var(--monospace-font-family);
    white-space: pre-wrap;
}

#console-last-line {
    visibility: hidden;
}

`;
function initConsole(document1, vm) {
    const consoleDiv = document1.getElementById('console');
    const consoleHeaderFiltersDiv = document1.getElementById('console-header-filters');
    const consoleHeaderTailsElement = document1.getElementById('console-header-tails');
    const consoleHeaderQpsElement = document1.getElementById('console-header-qps');
    const consoleHeaderClearElement = document1.getElementById('console-header-clear');
    const consoleLastLineElement = document1.getElementById('console-last-line');
    let showingClearButton = false;
    vm.logger = (...data)=>{
        const lineElement = document1.createElement('code');
        lineElement.className = 'line';
        let pos = 0;
        while(pos < data.length){
            if (pos > 0) {
                lineElement.appendChild(document1.createTextNode(', '));
            }
            const msg = data[pos];
            if (typeof msg === 'string') {
                const tokens = msg.split('%c');
                for(let i = 0; i < tokens.length; i++){
                    const span = document1.createElement('span');
                    let rendered = false;
                    if (i > 0 && i < tokens.length - 1) {
                        const style = data[pos + i];
                        span.setAttribute('style', style);
                        if (typeof style === 'string') {
                            if (style.includes('x-')) {
                                const m = /x-durable-object-(class|name|id)\s*:\s*'(.*?)'/.exec(style);
                                if (m) {
                                    const type = m[1];
                                    const value = m[2];
                                    const logpropName = 'durableObject' + type.substring(0, 1).toUpperCase() + type.substring(1);
                                    const a = document1.createElement('a');
                                    a.href = '#';
                                    a.onclick = ()=>{
                                        vm.setLogpropFilter([
                                            logpropName + ':' + value
                                        ]);
                                        vm.onChange();
                                    };
                                    a.appendChild(document1.createTextNode(tokens[i]));
                                    span.appendChild(a);
                                    rendered = true;
                                }
                            }
                        }
                    }
                    if (!rendered) renderTextIntoSpan(tokens[i], span);
                    lineElement.appendChild(span);
                }
                pos += 1 + tokens.length - 1;
            } else {
                lineElement.appendChild(document1.createTextNode(JSON.stringify(msg)));
                pos++;
            }
        }
        consoleDiv.insertBefore(lineElement, consoleLastLineElement);
        const { scrollHeight , scrollTop , clientHeight  } = consoleDiv;
        const diff = scrollHeight - scrollTop;
        const autoscroll = diff - 16 * 4 <= clientHeight;
        if (autoscroll) {
            consoleLastLineElement.scrollIntoView(false);
        }
        if (!showingClearButton) {
            consoleHeaderClearElement.style.visibility = 'visible';
            showingClearButton = true;
        }
    };
    vm.onResetOutput = ()=>{
        const lines = consoleDiv.querySelectorAll('.line');
        lines.forEach((line)=>{
            if (line.id !== 'console-last-line') consoleDiv.removeChild(line);
        });
        consoleHeaderClearElement.style.visibility = 'hidden';
        showingClearButton = false;
    };
    consoleHeaderQpsElement.textContent = computeQpsText(0);
    vm.onQpsChange = (qps)=>{
        consoleHeaderQpsElement.textContent = computeQpsText(qps);
    };
    LitElement.render(actionIcon(CLEAR_ICON, {
        text: 'Clear',
        onclick: ()=>vm.resetOutput()
    }), consoleHeaderClearElement);
    return ()=>{
        consoleDiv.style.display = vm.selectedAnalyticId ? 'none' : 'block';
        consoleHeaderFiltersDiv.style.visibility = vm.profiles.length > 0 ? 'visible' : 'hidden';
        consoleHeaderTailsElement.textContent = computeTailsText(vm.tails.size);
        LitElement.render(FILTERS_HTML(vm), consoleHeaderFiltersDiv);
    };
}
const FILTERS_HTML = (vm)=>{
    return html`Showing <a href="#" @click=${(e)=>{
        e.preventDefault();
        vm.editSelectionFields();
    }}>${vm.computeSelectionFieldsText()}</a>
     for <a href="#" @click=${(e)=>{
        e.preventDefault();
        vm.editEventFilter();
    }}>${computeEventFilterText(vm.filter)}</a>
     with <a href="#" @click=${(e)=>{
        e.preventDefault();
        vm.editStatusFilter();
    }}>${computeStatusFilterText(vm.filter)}</a>,
     <a href="#" @click=${(e)=>{
        e.preventDefault();
        vm.editIpAddressFilter();
    }}>${computeIpAddressFilterText(vm.filter)}</a>,
     <a href="#" @click=${(e)=>{
        e.preventDefault();
        vm.editMethodFilter();
    }}>${computeMethodFilterText(vm.filter)}</a>,
     <a href="#" @click=${(e)=>{
        e.preventDefault();
        vm.editSamplingRateFilter();
    }}>${computeSamplingRateFilterText(vm.filter)}</a>, 
     <a href="#" @click=${(e)=>{
        e.preventDefault();
        vm.editSearchFilter();
    }}>${computeSearchFilterText(vm.filter)}</a>, 
    <a href="#" @click=${(e)=>{
        e.preventDefault();
        vm.editHeaderFilter();
    }}>${computeHeaderFilterText(vm.filter)}</a>,
     and <a href="#" @click=${(e)=>{
        e.preventDefault();
        vm.editLogpropFilter();
    }}>${computeLogpropFilterText(vm.filter)}</a>.
     ${vm.hasAnyFilters() ? html`(<a href="#" @click=${(e)=>{
        e.preventDefault();
        vm.resetFilters();
    }}>reset</a>)` : ''}`;
};
function computeEventFilterText(filter) {
    const { event1  } = filter;
    return event1 === 'cron' ? 'CRON trigger events' : event1 === 'http' ? 'HTTP request events' : 'all events';
}
function computeStatusFilterText(filter) {
    const { status1  } = filter;
    return status1 === 'error' ? 'error status' : status1 === 'success' ? 'success status' : 'any status';
}
function computeIpAddressFilterText(filter) {
    const ipAddress1 = filter.ipAddress1 || [];
    return ipAddress1.length === 0 ? 'any IP address' : ipAddress1.length === 1 ? `IP address of ${ipAddress1[0]}` : `IP address in [${ipAddress1.join(', ')}]`;
}
function computeMethodFilterText(filter) {
    const method1 = filter.method1 || [];
    return method1.length === 0 ? 'any method' : method1.length === 1 ? `method of ${method1[0]}` : `method in [${method1.join(', ')}]`;
}
function computeSamplingRateFilterText(filter) {
    const samplingRate1 = typeof filter.samplingRate1 === 'number' ? filter.samplingRate1 : 1;
    return samplingRate1 >= 1 ? 'no sampling' : `${(Math.max(0, samplingRate1) * 100).toFixed(2)}% sampling rate`;
}
function computeSearchFilterText(filter) {
    const { search1  } = filter;
    return typeof search1 === 'string' && search1.length > 0 ? `console logs containing "${search1}"` : 'no search filter';
}
function computeHeaderFilterText(filter) {
    const header1 = filter.header1 || [];
    return header1.length === 0 ? 'no header filter' : header1.length === 1 ? `header filter of ${header1[0]}` : `header filters of [${header1.join(', ')}]`;
}
function computeLogpropFilterText(filter) {
    const logprop1 = filter.logprop1 || [];
    return logprop1.length === 0 ? 'no logprop filter' : logprop1.length === 1 ? `logprop filter of ${logprop1[0]}` : `logprop filters of [${logprop1.join(', ')}]`;
}
function computeTailsText(tailCount) {
    return tailCount === 0 ? 'no tails' : tailCount === 1 ? '1 tail' : `${tailCount} tails`;
}
function computeQpsText(qps) {
    return `${qps.toFixed(2)} qps`;
}
function renderTextIntoSpan(text, span) {
    const pattern = /(https:\/\/[^\s)]+|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|[\d0-f]+(:([\d0-f]{0,4})?){5,7})/g;
    let m;
    let i = 0;
    while(null !== (m = pattern.exec(text))){
        if (m.index > i) {
            span.appendChild(document.createTextNode(text.substring(i, m.index)));
        }
        const urlOrIp = m[0];
        const a = document.createElement('a');
        a.href = urlOrIp.startsWith('https://') ? urlOrIp : `https://ipinfo.io/${urlOrIp}`;
        a.target = '_blank';
        a.rel = 'noreferrer noopener nofollow';
        a.appendChild(document.createTextNode(urlOrIp));
        span.appendChild(a);
        i = m.index + urlOrIp.length;
    }
    if (i < text.length) {
        span.appendChild(document.createTextNode(text.substring(i)));
    }
}
const ANALYTICS_HTML1 = html`
<div id="analytics">
    <div id="analytics-header">
        <div id="analytics-heading" class="h6 high-emphasis-text"></div>
        <div id="analytics-subheading" class="medium-emphasis-text"></div>
    </div>
    <div id="analytics-querying"><progress id="analytics-progress" class="pure-material-progress-circular"></progress><div class="medium-emphasis-text">Fetching analytics...</div></div>
    <div id="analytics-error" class="medium-emphasis-text"></div>
    <div id="analytics-table" class="medium-emphasis-text"></div>
    <div id="analytics-namespaces-table"  class="medium-emphasis-text"></div>
    <div id="analytics-footnote" class="medium-emphasis-text"><sup>*</sup> Estimated based on recent usage</div>
</div>
`;
const ANALYTICS_CSS = css`

#analytics {
    color: var(--high-emphasis-text-color);
    height: 100vh;
    width: 100%;
    background-color: var(--background-color);
    overflow-y: scroll;
    overflow-x: hidden;
    flex-grow: 1;
    display: none;
}

#analytics::-webkit-scrollbar {
    width: 1rem;
    height: 3rem;
    background-color: var(--background-color);
}

#analytics::-webkit-scrollbar-thumb {
    background-color: var(--medium-emphasis-text-color);
}

#analytics-header {
    position: sticky;
    top: 0;
    background-color: var(--background-color);
    padding: 1rem 0;
    height: 3rem;
}

#analytics-subheading {
    padding: 0.5rem 0;
}

#analytics-progress {
    font-size: 0.5rem; /* default 3em => 1.5rem */
}

#analytics-querying {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

#analytics table {
    text-align: right;
    border-spacing: 0.375rem;
    font-size: 0.75rem;
    white-space: nowrap;
}

#analytics th {
    text-align: center;
}

#analytics .spacer {
    width: 0.75rem;
}

#analytics-table .estimate td {
    padding-top: 1rem;
}

#analytics .mono {
    font-family: var(--monospace-font-family);
}

#analytics-namespaces-table {
    margin-top: 2rem;
}

#analytics-namespaces-table a.unselected {
    color: var(--medium-emphasis-text-color);
}

@media (hover: hover) {
    #analytics-namespaces-table a.unselected:hover {
        color: var(--primary-color);
    }
}

#analytics .left-aligned {
    text-align: left;
}

#analytics-footnote {
    margin-top: 1rem;
    font-size: 0.75rem;
    display: none;
}

`;
function initAnalytics(document1, vm) {
    const analyticsDiv = document1.getElementById('analytics');
    const analyticsHeading = document1.getElementById('analytics-heading');
    const analyticsSubheading = document1.getElementById('analytics-subheading');
    const analyticsQueryingElement = document1.getElementById('analytics-querying');
    const analyticsErrorElement = document1.getElementById('analytics-error');
    const analyticsTableElement = document1.getElementById('analytics-table');
    const analyticsNamespacesTableElement = document1.getElementById('analytics-namespaces-table');
    const analyticsFootnoteElement = document1.getElementById('analytics-footnote');
    return ()=>{
        analyticsDiv.style.display = vm.selectedAnalyticId ? 'block' : 'none';
        if (!vm.selectedAnalyticId) return;
        const selectedAnalytic = vm.analytics.find((v)=>v.id === vm.selectedAnalyticId);
        if (!selectedAnalytic) return;
        analyticsHeading.textContent = selectedAnalytic.text;
        analyticsSubheading.textContent = selectedAnalytic.description || '';
        const { durableObjectsCosts , querying , error  } = vm.analyticsState;
        analyticsQueryingElement.style.display = querying ? 'flex' : 'none';
        analyticsErrorElement.textContent = error || '';
        analyticsFootnoteElement.style.display = durableObjectsCosts ? 'block' : 'none';
        if (durableObjectsCosts) {
            const renderCosts = (namespaceId)=>{
                const table = durableObjectsCosts.namespaceTables[namespaceId || ''] || durableObjectsCosts.accountTable;
                LitElement.render(COSTS_HTML(table, namespaceId), analyticsTableElement);
            };
            renderCosts(undefined);
            LitElement.render(NAMESPACES_HTML(durableObjectsCosts, renderCosts), analyticsNamespacesTableElement);
        } else {
            LitElement.render(undefined, analyticsTableElement);
            LitElement.render(undefined, analyticsNamespacesTableElement);
        }
    };
}
const FIXED_1 = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1
});
const FIXED_2 = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
});
function format1(val) {
    if (val < 1000) return val.toString();
    return `${FIXED_1.format(val / 1000)}k`;
}
function format2(val) {
    if (val < 1000) return val.toFixed(2);
    return `${FIXED_2.format(val / 1000)}k`;
}
function formatGb(val) {
    if (val < 1) return `${format2(val * 1024)}mb`;
    return `${format2(val)}gb`;
}
function clickNamespace(e, renderCosts) {
    e.preventDefault();
    const text = e.target.textContent || '';
    console.log('clickNamespace', text);
    renderCosts(text.startsWith('All') ? undefined : text);
    const anchors = document.querySelectorAll('#analytics-namespaces-table a');
    anchors.forEach((a)=>{
        a.className = a === e.target ? '' : 'unselected';
    });
}
const NAMESPACES_HTML = (table, renderCosts)=>html`
    <table>
        <tr>
            <th>Namespace ID</th><th class="spacer"></th>
            <th>Script</th>
            <th>Class</th><th class="spacer"></th>
            <th>Total</th>
        </tr>
        <tr>
            <td class="left-aligned mono"><a href="#" @click=${(e)=>clickNamespace(e, renderCosts)}>All durable objects</a></td><td></td>
            <td></td>
            <td></td><td></td>
            <td>$${(table.accountTable.estimated30DayRow?.totalCost || 0).toFixed(2)}</td>
        </tr>
    ${[
        ...Object.entries(table.namespaceTables)
    ].sort((a, b)=>(b[1].estimated30DayRow?.totalCost || 0) - (a[1].estimated30DayRow?.totalCost || 0)).map((v)=>{
        const [namespaceId, t] = v;
        return html`<tr>
            <td class="left-aligned mono"><a href="#" @click=${(e)=>clickNamespace(e, renderCosts)} class="unselected">${namespaceId}</a></td><td></td>
            <td class="left-aligned">${t.namespace?.script || ''}</td>
            <td class="left-aligned">${t.namespace?.class || ''}</td><td></td>
            <td>$${(t.estimated30DayRow?.totalCost || 0).toFixed(2)}</td>
            </tr>`;
    })}
    </table>
`;
const COSTS_HTML = (table, _namespaceId)=>html`
    <table>
        <tr>
            <th>UTC Day</th><th class="spacer"></th>
            <th colspan="2">Requests</th><th class="spacer"></th>
            <th colspan="4">Websockets</th><th class="spacer"></th>
            <th colspan="2">Subrequests</th><th class="spacer"></th>
            <th colspan="2">Duration</th><th class="spacer"></th>
            <th colspan="2">Reads</th><th class="spacer"></th>
            <th colspan="2">Writes</th><th class="spacer"></th>
            <th colspan="2">Deletes</th><th class="spacer"></th>
            <th colspan="2">Storage</th><th class="spacer"></th>
            <th>Total</th>
        </tr>
        <tr>
            <th></th><th></th>
            <th colspan="2"></th><th></th>
            <th>Max</th>
            <th>In</th>
            <th>Out</th>
            <th></th><th></th>
            <th colspan="2"></th><th></th>
            <th>GB-sec</th>
            <th></th><th></th>
            <th colspan="2"></th><th></th>
            <th colspan="2"></th><th></th>
            <th colspan="2"></th><th></th>
            <th colspan="2"></th><th></th>
            <th></th>
        </tr>
        ${table.rows.map((v)=>html`<tr>
            <td>${v.date}</td><td></td>
            <td class="high-emphasis-text">${format1(v.sumRequests)}</td>
            <td>$${format2(v.requestsCost)}</td><td></td>
            <td class="high-emphasis-text">${format1(v.maxActiveWebsocketConnections)}</td>
            <td class="high-emphasis-text">${format1(v.sumInboundWebsocketMsgCount)}</td>
            <td class="high-emphasis-text">${format1(v.sumOutboundWebsocketMsgCount)}</td>
            <td>$${format2(v.websocketsCost)}</td><td></td>
            <td class="high-emphasis-text">${format1(v.sumSubrequests)}</td>
            <td>$${format2(v.subrequestsCost)}</td><td></td>
            <td class="high-emphasis-text">${format2(v.activeGbSeconds)}</td>
            <td>$${format2(v.activeCost)}</td><td></td>
            <td class="high-emphasis-text">${format1(v.sumStorageReadUnits)}</td>
            <td>$${format2(v.readUnitsCost)}</td><td></td>
            <td class="high-emphasis-text">${format1(v.sumStorageWriteUnits)}</td>
            <td>$${format2(v.writeUnitsCost)}</td><td></td>
            <td class="high-emphasis-text">${format1(v.sumStorageDeletes)}</td>
            <td>$${format2(v.deletesCost)}</td><td></td>
            <td class="high-emphasis-text">${v.storageGb === undefined ? '?' : formatGb(v.storageGb)}</td>
            <td>${v.storageCost === undefined ? '' : `$${format2(v.storageCost)}`}</td><td></td>
            <td>$${format2(v.totalCost)}</td>
        </tr>`)}

        ${table.estimated30DayRow ? html`<tr class="estimate">
            <td>30-day bill<sup>*</sup></td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRow.requestsCost)}</td><td></td>
            <td></td>
            <td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRow.websocketsCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRow.subrequestsCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRow.activeCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRow.readUnitsCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRow.writeUnitsCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRow.deletesCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRow.storageCost || 0)}</td><td></td>
            <td>$${format2(table.estimated30DayRow.totalCost)}</td>
        </tr>` : ''}
        ${table.estimated30DayRowMinusFree ? html`<tr>
            <td>− free usage</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRowMinusFree.requestsCost)}</td><td></td>
            <td></td>
            <td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRowMinusFree.websocketsCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRowMinusFree.subrequestsCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRowMinusFree.activeCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRowMinusFree.readUnitsCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRowMinusFree.writeUnitsCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRowMinusFree.deletesCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRowMinusFree.storageCost || 0)}</td><td></td>
            <td>$${format2(table.estimated30DayRowMinusFree.totalCost)}</td>
        </tr>` : ''}
    </table>
`;
const appModuleScript = document.getElementById('app-module-script');
function setAppState(appState) {
    appModuleScript.dataset.state = appState;
}
setAppState('starting');
const appCss = css`

main {
    display: flex;
    gap: 0.5rem;
}

:root {
    --pure-material-primary-rgb: rgb(187, 134, 252);
}

.hidden-vertical-scroll {
    scrollbar-width: none; -ms-overflow-style: none;
    overflow-y: scroll;
}

.hidden-vertical-scroll::-webkit-scrollbar {
    display: none; /* for Chrome, Safari, and Opera */
}

`;
const appHtml = html`
<main>
${SIDEBAR_HTML}
${CONSOLE_HTML}
${ANALYTICS_HTML1}
${MODAL_HTML}
</main>`;
function appendStylesheets(cssTexts) {
    const styleSheet = document.createElement('style');
    styleSheet.type = 'text/css';
    styleSheet.textContent = cssTexts.join('\n\n');
    document.head.appendChild(styleSheet);
}
appendStylesheets([
    MATERIAL_CSS.cssText,
    appCss.cssText,
    HEADER_CSS.cssText,
    SIDEBAR_CSS.cssText,
    CONSOLE_CSS.cssText,
    ANALYTICS_CSS.cssText,
    MODAL_CSS.cssText,
    WELCOME_PANEL_CSS.cssText,
    PROFILE_EDITOR_CSS.cssText,
    FILTER_EDITOR_CSS.cssText,
    CIRCULAR_PROGRESS_CSS.cssText
]);
LitElement.render(appHtml, document.body);
function parseStaticData() {
    const script = document.getElementById('static-data-script');
    const data = JSON.parse(script.text);
    const version = typeof data.version === 'string' ? data.version : undefined;
    const flags = typeof data.flags === 'string' ? data.flags : undefined;
    return {
        version,
        flags
    };
}
const data = parseStaticData();
const vm = new WebtailAppVM();
const updateSidebar = initSidebar(document, vm, data);
const updateConsole = initConsole(document, vm);
const updateAnalytics = initAnalytics(document, vm);
const updateModal = initModal(document, vm);
vm.onChange = ()=>{
    updateSidebar();
    updateConsole();
    updateAnalytics();
    updateModal();
};
CloudflareApi.URL_TRANSFORMER = CfGqlClient.URL_TRANSFORMER = (v)=>`/fetch/${v.substring('https://'.length)}`;
vm.start();
setAppState('started');
