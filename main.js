class AvGenericRAMManager {    static allRams = {};    static _getInstance() {        if (!this.allRams.hasOwnProperty(this.name)) {            let temp = { class: this };            this.allRams[this.name] = new temp["class"]();        }        return this.allRams[this.name];    }    records;    getId(item) {        if (item[this.getPrimaryKey()] !== undefined) {            return item[this.getPrimaryKey()];        }        console.error("can't found key " + this.getPrimaryKey() + " inside ", item);        return undefined;    }    constructor() {        if (this.constructor == AvGenericRAMManager) {            throw "can't instanciate an abstract class";        }        this.records = {};    }    async createList(list) {        let result = [];        list = await this.beforeCreateList(list);        for (let item of list) {            let resultItem = await this._create(item, true);            if (resultItem) {                result.push(resultItem);            }        }        result = await this.afterCreateList(result);        return result;    }    async create(item, ...args) {        return await this._create(item, false);    }    async _create(item, fromList) {        let key = this.getId(item);        if (key) {            item = await this.beforeCreateItem(item, fromList);            let createdItem = this.transformElementInStorable(item);            this.records[key] = createdItem;            this.records[key] = await this.afterCreateItem(createdItem, fromList);            return this.records[key];        }        return undefined;    }    async beforeCreateList(list) {        return list;    }    async beforeCreateItem(item, fromList) {        return item;    }    async afterCreateItem(item, fromList) {        return item;    }    async afterCreateList(list) {        return list;    }    async updateList(list) {        let result = [];        list = await this.beforeUpdateList(list);        for (let item of list) {            let resultItem = await this._update(item, true);            if (resultItem) {                result.push(resultItem);            }        }        result = await this.afterUpdateList(result);        return result;    }    async update(item, ...args) {        return await this._update(item, false);    }    async _update(item, fromList) {        let key = await this.getId(item);        if (key) {            if (this.records[key]) {                item = await this.beforeUpdateItem(item, fromList);                this.updateDataInRAM(item);                this.records[key] = await this.afterUpdateItem(this.records[key], fromList);                return this.records[key];            }            else {                console.error("can't update the item " + key + " because it wasn't found inside ram");            }        }        return undefined;    }    async beforeUpdateList(list) {        return list;    }    async beforeUpdateItem(item, fromList) {        return item;    }    async afterUpdateItem(item, fromList) {        return item;    }    async afterUpdateList(list) {        return list;    }    updateDataInRAM(newData) {        let dataInRAM = this.records[this.getId(newData)];        let oldKeys = {};        for (let key in dataInRAM) {            oldKeys[key] = key;        }        for (const [key, value] of Object.entries(newData)) {            dataInRAM[key] = value;            delete oldKeys[key];        }        for (let keyMissing of Object.keys(oldKeys)) {            delete dataInRAM[keyMissing];        }    }    async deleteList(list) {        await this.beforeDeleteList(list);        for (let item of list) {            await this._delete(item, true);        }        await this.afterDeleteList(list);    }    async delete(item, ...args) {        return await this._delete(item, false);    }    async deleteById(id) {        let item = this.records[id];        if (item) {            return await this._delete(item, false);        }    }    async _delete(item, fromList) {        let key = await this.getId(item);        if (key && this.records[key]) {            let oldItem = this.records[key];            await this.beforeDeleteItem(oldItem, fromList);            delete this.records[key];            await this.afterDeleteItem(oldItem, fromList);        }    }    async beforeDeleteList(list) { }    async beforeDeleteItem(item, fromList) { }    async afterDeleteItem(item, fromList) { }    async afterDeleteList(list) { }    async get(id) {        return await this.getById(id);    }    async getById(id) {        await this.beforeGetById(id);        if (this.records[id]) {            let result = this.records[id];            await this.afterGetById(result);            return result;        }        return undefined;    }    async beforeGetById(id) { }    async afterGetById(item) { }    async getByIds(ids) {        let result = [];        await this.beforeGetByIds(ids);        for (let id of ids) {            if (this.records[id]) {                result.push(this.records[id]);            }        }        await this.afterGetByIds(result);        return result;    }    async beforeGetByIds(ids) { }    async afterGetByIds(items) { }    async getAll() {        await this.beforeGetAll();        await this.afterGetAll(this.records);        return this.records;    }    async beforeGetAll() { }    async afterGetAll(result) { }    async getList() {        let data = await this.getAll();        return Object.values(data);    }}class AvRAMManager extends AvGenericRAMManager {    transformElementInStorable(item) {        return item;    }}
class GenericSocketRAMManager extends AvGenericRAMManager {    socketActions;    gotAllRecords = false;    subscribers;    recordsSubscribers = {};    socketRoutes;    static defaultSocketName = undefined;    constructor() {        super();        if (this.constructor == GenericSocketRAMManager) {            throw "can't instanciate an abstract class";        }        this.init();    }    getPrimaryKey() {        return 'id';    }    getSocket() {        return Socket.getInstance(this._getSocketName());    }    _getSocketName() {        return GenericSocketRAMManager.defaultSocketName;    }    init() {        this.initVariables();        this.initSocket();    }    initVariables() {        this.socketActions = {            get: "get",            getAll: "get/all",            create: "create",            created: "created",            update: "update",            updated: "updated",            delete: "delete",            deleted: "deleted"        };        this.subscribers = {            created: [],            updated: [],            deleted: [],        };        let temp = {};        for (const [key, name] of Object.entries(this.socketActions)) {            temp[key] = {                request: `${this.getObjectName()}/${name}`,                multiple: `${this.getObjectName()}/${name}/multiple`,                success: `${this.getObjectName()}/${name}/success`,                error: `${this.getObjectName()}/${name}/error`            };        }        this.socketRoutes = temp;    }    initSocket() {        let createdRoute = {            channel: this.getObjectName() + "/" + this.socketActions.created,            callback: response => {                if (response.data) {                    for (let key in response.data) {                        let obj = response.data[key];                        let id = this.getId(obj);                        if (id !== undefined) {                            this.records[id] = this.transformElementInStorable(obj);                            this.publish(this.socketActions.created, this.records[id]);                        }                    }                }            }        };        Socket.getInstance(this._getSocketName()).addRoute(createdRoute);        let updatedRoute = {            channel: this.getObjectName() + "/" + this.socketActions.updated,            callback: response => {                if (response.data) {                    for (let key in response.data) {                        const newData = response.data[key];                        let id = this.getId(newData);                        if (id !== undefined) {                            if (this.records[id] !== undefined) {                                this.updateDataInRAM(newData);                                this.publish(this.socketActions.updated, this.records[id]);                            }                            else {                                this.records[id] = this.transformElementInStorable(newData);                                this.publish(this.socketActions.created, this.records[id]);                            }                        }                    }                }            }        };        Socket.getInstance(this._getSocketName()).addRoute(updatedRoute);        let deletedRoute = {            channel: this.getObjectName() + "/" + this.socketActions.deleted,            callback: response => {                if (response.data) {                    for (let data of response.data) {                        let id = this.getId(data);                        if (this.records[id] !== undefined) {                            let oldData = this.records[id];                            delete this.records[id];                            this.publish(this.socketActions.deleted, oldData);                        }                    }                }            }        };        Socket.getInstance(this._getSocketName()).addRoute(deletedRoute);    }    async create(item, cbError) {        try {            return await super.create(item);        }        catch (e) {            if (cbError) {                cbError(e);            }        }        return undefined;    }    beforeCreateItem(item, fromList) {        return new Promise((resolve, reject) => {            if (!fromList) {                Socket.getInstance(this._getSocketName()).sendMessageAndWait(this.socketRoutes.create.request, item, {                    [this.socketRoutes.create.success]: response => {                        let element = response.created[0];                        resolve(element);                    },                    [this.socketRoutes.create.error]: response => {                        reject(response);                    }                });            }            else {                resolve(item);            }        });    }    beforeCreateList(list) {        return new Promise((resolve, reject) => {            Socket.getInstance(this._getSocketName()).sendMessageAndWait(this.socketRoutes.create.multiple, list, {                [this.socketRoutes.create.success]: response => {                    resolve(response.created);                },                [this.socketRoutes.create.error]: response => {                    reject(response);                }            });        });    }    async update(item, cbError) {        try {            return await super.update(item);        }        catch (e) {            if (cbError) {                cbError(e);            }        }        return undefined;    }    beforeUpdateItem(item, fromList) {        return new Promise((resolve, reject) => {            if (!fromList) {                Socket.getInstance(this._getSocketName()).sendMessageAndWait(this.socketRoutes.update.request, item, {                    [this.socketRoutes.update.success]: response => {                        let element = response.updated[0];                        resolve(element);                    },                    [this.socketRoutes.update.error]: response => {                        reject(response);                    }                });            }            else {                resolve(item);            }        });    }    beforeUpdateList(list) {        return new Promise((resolve, reject) => {            Socket.getInstance(this._getSocketName()).sendMessageAndWait(this.socketRoutes.update.multiple, list, {                [this.socketRoutes.update.success]: response => {                    resolve(response.updated);                },                [this.socketRoutes.update.error]: response => {                    reject(response);                }            });        });    }    async internalUpdate(id, newData) {        let oldData = this.records[id];        if (oldData) {            let mergedData = {                ...oldData,                ...newData            };            let result = await this.update(mergedData);            return result;        }        return undefined;    }    async delete(item, cbError) {        try {            await super.delete(item);        }        catch (e) {            if (cbError) {                cbError(e);            }        }        return undefined;    }    beforeDeleteItem(item, fromList) {        return new Promise((resolve, reject) => {            if (!fromList) {                Socket.getInstance(this._getSocketName()).sendMessageAndWait(this.socketRoutes.delete.request, item, {                    [this.socketRoutes.delete.success]: response => {                        resolve();                    },                    [this.socketRoutes.delete.error]: response => {                        reject(response);                    }                });            }            else {                resolve();            }        });    }    beforeDeleteList(list) {        return new Promise((resolve, reject) => {            Socket.getInstance(this._getSocketName()).sendMessageAndWait(this.socketRoutes.delete.multiple, list, {                [this.socketRoutes.delete.success]: response => {                    resolve();                },                [this.socketRoutes.delete.error]: response => {                    reject(response);                }            });        });    }    beforeGetById(id) {        return new Promise((resolve, reject) => {            if (this.records[id]) {                resolve();            }            else {                Socket.getInstance(this._getSocketName()).sendMessageAndWait(this.socketRoutes.get.request, {                    [this.getPrimaryKey()]: id                }, {                    [this.socketRoutes.get.success]: response => {                        if (response.data) {                            this.records[id] = this.transformElementInStorable(response.data);                        }                        resolve();                    },                    [this.socketRoutes.get.error]: response => {                        this.printErrors(response, "getById");                        reject();                    }                });            }        });    }    beforeGetByIds(ids) {        return new Promise((resolve, reject) => {            let missingIds = [];            for (let id of ids) {                if (!this.records[id]) {                    missingIds.push(id);                }            }            if (missingIds.length > 0) {                Socket.getInstance(this._getSocketName()).sendMessageAndWait(this.socketRoutes.get.multiple, {                    [this.getPrimaryKey()]: ids                }, {                    [this.socketRoutes.get.success]: response => {                        if (response.data) {                            for (let item of Object.values(response.data)) {                                this.records[this.getId(item)] = this.transformElementInStorable(item);                            }                        }                        resolve();                    },                    [this.socketRoutes.get.error]: response => {                        this.printErrors(response, "getMultiple");                        reject(response);                    }                });            }            else {                resolve();            }        });    }    beforeGetAll() {        return new Promise((resolve, reject) => {            if (this.gotAllRecords) {                resolve();            }            else {                Socket.getInstance(this._getSocketName()).sendMessageAndWait(this.socketRoutes.getAll.request, {}, {                    [this.socketRoutes.getAll.success]: response => {                        if (response.data) {                            this.gotAllRecords = true;                            for (let item of Object.values(response.data)) {                                this.records[this.getId(item)] = this.transformElementInStorable(item);                            }                        }                        resolve();                    },                    [this.socketRoutes.getAll.error]: response => {                        this.printErrors(response, "getAll");                        reject();                    }                });            }        });    }    transformElementInStorable(item) {        let id = this.getId(item);        let addedType = {            update: async (newData = {}) => {                return await this.internalUpdate(id, newData);            },            onUpdate: (callback) => {                if (!this.recordsSubscribers.hasOwnProperty(id)) {                    this.recordsSubscribers[id] = {                        created: [],                        updated: [],                        deleted: []                    };                }                this.recordsSubscribers[id].updated.push(callback);            },            offUpdate: (callback) => {                if (this.recordsSubscribers[id]) {                    let index = this.recordsSubscribers[id].updated.indexOf(callback);                    if (index != -1) {                        this.recordsSubscribers[id].updated.splice(index, 1);                    }                }            },            delete: async () => {                return await this.deleteById(id);            },            onDelete: (callback) => {                if (!this.recordsSubscribers.hasOwnProperty(id)) {                    this.recordsSubscribers[id] = {                        created: [],                        updated: [],                        deleted: []                    };                }                this.recordsSubscribers[id].deleted.push(callback);            },            offDelete: (callback) => {                if (this.recordsSubscribers[id]) {                    let index = this.recordsSubscribers[id].deleted.indexOf(callback);                    if (index != -1) {                        this.recordsSubscribers[id].deleted.splice(index, 1);                    }                }            },        };        let socketObj = {            ...item,            ...addedType        };        return this.addCustomFunctions(socketObj);    }    publish(type, data) {        [...this.subscribers[type]].forEach(callback => callback(data));    }    printErrors(data, action) {        console.error(data, action);    }}class SocketRAMManager extends GenericSocketRAMManager {    addCustomFunctions(item) {        return item;    }}
class AvUtils {    static sleep(ms) {        return new Promise(resolve => setTimeout(resolve, ms));    }}
class StateManager {    logLevel = 0;    _activeState = undefined;    _activeParams = undefined;    _activeSlug = undefined;    _callbackList = {};    _subscribersMutliple = {};    _subscribers = {};    _isNumberRegex = /^-?\d+$/;    _callbackFunctions = {};    constructor() {    }    static __instances = {};    static getInstance(name) {        if (!name) {            name = "";        }        if (!this.__instances.hasOwnProperty(name)) {            this.__instances[name] = new StateManager();        }        return this.__instances[name];    }    subscribe(state, callbacks) {        if (!callbacks.hasOwnProperty("active") && !callbacks.hasOwnProperty("inactive") && callbacks.hasOwnProperty("askChange")) {            this._log(`Trying to subscribe to state : ${state} with no callbacks !`, "warning");            return;        }        if (!Array.isArray(state)) {            state = [state];        }        for (let i = 0; i < state.length; i++) {            let _state = state[i];            let res = this._prepareStateString(_state);            _state = res["state"];            if (!this._subscribers.hasOwnProperty(_state)) {                let regex = new RegExp(_state);                let isActive = this._activeState !== undefined && regex.test(this._activeState);                this._subscribers[_state] = {                    "regex": regex,                    "callbacks": {                        "active": [],                        "inactive": [],                        "askChange": [],                    },                    "isActive": isActive,                    "testRegex": (string) => {                        if (!string) {                            string = this.getActiveState();                        }                        return this._subscribers[_state].regex.test(string);                    }                };            }            if (callbacks.hasOwnProperty("active")) {                this._subscribers[_state].callbacks.active.push(callbacks.active);                if (this._subscribers[_state].isActive) {                    callbacks.active(this._activeState);                }            }            if (callbacks.hasOwnProperty("inactive")) {                this._subscribers[_state].callbacks.inactive.push(callbacks.inactive);            }            if (callbacks.hasOwnProperty("askChange")) {                this._subscribers[_state].callbacks.askChange.push(callbacks.askChange);            }        }    }    /**     *     * @param {string|Array} state - The state(s) to unsubscribe from     * @param {Object} callbacks     * @param {activeCallback} [callbacks.active]     * @param {incativeCallback} [callbacks.inactive]     * @param {askChangeCallback} [callbacks.askChange]     */    unsubscribe(state, callbacks) {        if (!Array.isArray(state)) {            state = [state];        }        for (let i = 0; i < state.length; i++) {            let _state = state[i];            let res = this._prepareStateString(_state);            _state = res["state"];            if (this._subscribers.hasOwnProperty(_state)) {                let modifications = false;                if (callbacks.hasOwnProperty("active")) {                    let index = this._subscribers[_state].callbacks.active.indexOf(callbacks["active"]);                    if (index !== -1) {                        this._subscribers[_state].callbacks.active.splice(index, 1);                        modifications = true;                    }                }                if (callbacks.hasOwnProperty("inactive")) {                    let index = this._subscribers[_state].callbacks.inactive.indexOf(callbacks["inactive"]);                    if (index !== -1) {                        this._subscribers[_state].callbacks.inactive.splice(index, 1);                        modifications = true;                    }                }                if (callbacks.hasOwnProperty("askChange")) {                    let index = this._subscribers[_state].callbacks.askChange.indexOf(callbacks["askChange"]);                    if (index !== -1) {                        this._subscribers[_state].callbacks.askChange.splice(index, 1);                        modifications = true;                    }                }                if (modifications &&                    this._subscribers[_state].callbacks.active.length === 0 &&                    this._subscribers[_state].callbacks.inactive.length === 0 &&                    this._subscribers[_state].callbacks.askChange.length === 0) {                    delete this._subscribers[_state];                }            }            return;        }    }    /**     * Format a state and return if you need to bypass the test or not     * @param {string} string - The state to format     * @returns {Object} - The state, the formated state and if it's a regex state or not     */    _prepareStateString(string) {        let _state = string;        let stateToTest = _state;        let bypassTest = false;        if (_state.startsWith("^") && _state.endsWith("$")) {            bypassTest = true;        }        else {            if (_state.endsWith("/*")) {                _state = "^" + this._escapeRegExp(_state).replace("\*", "-?\\d+$");            }            else {                let splittedState = _state.split("/");                let slug = splittedState.pop();                if (this._isNumberRegex.test(slug)) {                    stateToTest = splittedState.join("/") + "/*";                }                _state = "^" + this._escapeRegExp(_state) + "$";            }        }        return { "state": _state, "stateToTest": stateToTest, "bypassTest": bypassTest };    }    /**     * Escape a string to be regex-compatible ()     * @param {string} string The string to escape     * @returns An escaped string     */    _escapeRegExp(string) {        return string.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');    }    /**     * Get the slug from a state string     * @param {string} state The state to extract the slug from     * @returns {string|undefined} The slug of the state or undefined if the state don't have one     */    _getSlugFromState(state) {        let slug = state.split("/").pop();        if (this._isNumberRegex.test(slug)) {            return parseInt(slug);        }        else {            return undefined;        }    }    /**     * Save the current info (state/params) in cache     */    _saveDataInCache() {        if (!this._activeParams || Object.keys(this._activeParams).length == 0) {            if (localStorage["disableStorage"] == null) {                localStorage["state"] = this._activeState;            }        }    }    /**     * Add a callback to a key     * @param {string} key - The key to trigger to trigger the function     * @param {function} callback - The function to trigger     */    addFunction(key, callback) {        if (!this._callbackFunctions.hasOwnProperty(key)) {            this._callbackFunctions[key] = [];        }        this._callbackFunctions[key].push(callback);    }    /**     * Remove a function from a key     * @param {string} key - The key to remove the function from     * @param {function} callback - The function to remove     */    removeFunction(key, callback) {        if (this._callbackFunctions.hasOwnProperty(key)) {            const index = this._callbackFunctions[key].indexOf(callback);            if (index !== -1) {                this._callbackFunctions[key].splice(index, 1);                if (this._callbackFunctions[key].length === 0) {                    delete this._callbackFunctions[key];                }            }            else {                console.warn("Couldn't find callback in list " + key);            }        }        else {            console.warn("Couldn't find " + key + " in callback array");        }    }    /**     * Trigger all the functions added under a key     * @param {string} key - The key to trigger     * @param {*} [params] - The params to pass to the functions (optional)     */    triggerFunction(key, params = {}) {        if (this._callbackFunctions.hasOwnProperty(key)) {            const copy = [...this._callbackFunctions[key]];            copy.forEach(callback => {                callback(params);            });        }        else {            console.warn("Trying to trigger non existent key : " + key);        }    }    /**     * Remove all the function added under all keys     */    clearFunctions() {        this._callbackFunctions = {};    }    /**     * Set the current active state     * @param {string} state - The state to set to active     * @param {number} slug - The slug of the active state (Only work if the state ends with "*")     * @param {Object} params - The params of the active state     */    setActiveState(state, params = {}) {        if (this._activeState !== undefined && state === this._activeState) {            this._log("Trying to set a state that was already active. state : " + state + " activeState : " + this._activeState, "warning");            return;        }        let canChange = true;        if (this._activeState) {            let activeToInactive = [];            let inactiveToActive = [];            let triggerActive = [];            for (let key in this._subscribers) {                let current = this._subscribers[key];                if (current.isActive) {                    if (!current.regex.test(state)) {                        let clone = [...current.callbacks["askChange"]];                        for (let i = 0; i < clone.length; i++) {                            let callback = clone[i];                            if (!callback(this._activeState, state)) {                                canChange = false;                            }                        }                        activeToInactive.push(current);                    }                    else {                        triggerActive.push(current);                    }                }                else {                    if (current.regex.test(state)) {                        inactiveToActive.push(current);                    }                }            }            if (canChange) {                const oldState = this._activeState;                this._activeState = state;                this._activeSlug = this._getSlugFromState(state);                this._activeParams = params;                activeToInactive.forEach(route => {                    route.isActive = false;                    [...route.callbacks.inactive].forEach(callback => {                        callback(oldState, state);                    });                });                this.clearFunctions();                triggerActive.forEach(route => {                    [...route.callbacks.active].forEach(callback => {                        callback(state);                    });                });                inactiveToActive.forEach(route => {                    route.isActive = true;                    [...route.callbacks.active].forEach(callback => {                        callback(state);                    });                });            }        }        else {            this._activeState = state;            this._activeSlug = this._getSlugFromState(state);            this._activeParams = params;            this.clearFunctions();            for (let key in this._subscribers) {                if (this._subscribers[key].regex.test(state)) {                    this._subscribers[key].isActive = true;                    [...this._subscribers[key].callbacks.active].forEach(callback => {                        callback(state);                    });                }            }        }        this._saveDataInCache();        return;    }    /**     * Get the active state     * @returns {string} - The active state     */    getActiveState() {        return this._activeState;    }    /**     * Get the active params     * @returns {Object} - The active params     */    getActiveParams() {        return this._activeParams;    }    /**     * Get the active slug     * @returns {int} - The active slug     */    getActiveSlug() {        return this._activeSlug;    }    /**     * Check if a state is in the subscribers and active, return true if it is, false otherwise     * @param {string} state - The state to test     * @returns {boolean} - True if the state is in the subscription list and active, false otherwise     */    isStateActive(state) {        state = this._prepareStateString(state).state;        if (this._subscribers[state] && this._subscribers[state].isActive) {            return true;        }        return false;    }    _log(logMessage, type) {        if (type === "error") {            console.error(logMessage);        }        else if (type === "warning" && this.logLevel > 0) {            console.warn(logMessage);        }        else if (type === "info" && this.logLevel > 1) {            console.log(logMessage);        }    }}
class Socket {    options;    waitingList = {};    multipltWaitingList = {};    onDone;    timeoutError;    memoryBeforeOpen = [];    nbClose = 0;    socket;    constructor() {    }    init(options = {}) {        if (!options.port) {            options.port = parseInt(window.location.port);        }        if (!options.ip) {            options.ip = window.location.hostname;        }        if (!options.hasOwnProperty('useHttps')) {            options.useHttps = window.location.protocol == "https:";        }        if (!options.routes) {            options.routes = {};        }        if (!options.socketName) {            options.socketName = this.getSocketName();        }        this.options = options;    }    static __instances = {};    static getInstance(name) {        if (!name) {            name = "";        }        if (!this.__instances.hasOwnProperty(name)) {            let temp = { class: this };            this.__instances[name] = new temp["class"]();            this.__instances[name].init({ log: true });        }        return this.__instances[name];    }    getSocketName() {        return "";    }    addRoute(newRoute) {        if (!this.options.routes.hasOwnProperty(newRoute.channel)) {            this.options.routes[newRoute.channel] = [];        }        this.options.routes[newRoute.channel].push(newRoute);    }    /**     * The route to remove     * @param route - The route to remove     */    removeRoute(route) {        let index = this.options.routes[route.channel].indexOf(route);        if (index != -1) {            this.options.routes[route.channel].splice(index, 1);        }    }    open(done = () => { }, error = () => { }) {        if (this.socket) {            this.socket.close();        }        let protocol = "ws";        if (this.options.useHttps) {            protocol = "wss";        }        let url = protocol + "://" + this.options.ip + ":" + this.options.port + "/ws/" + this.options.socketName;        this.log(url);        this.socket = new WebSocket(url);        this.timeoutError = setTimeout(() => {            if (this.socket &&                this.socket.readyState != 1) {                delete this.socket;                this.socket = null;                console.error('Timeout on socket open');                error();            }        }, 3000);        this.socket.onopen = this.onOpen.bind(this);        this.socket.onclose = this.onClose.bind(this);        this.socket.onerror = this.onError.bind(this);        this.socket.onmessage = this.onMessage.bind(this);        this.onDone = done;    }    /**     *     * @param channelName The channel on which the message is sent     * @param data The data to send     * @param options the options to add to the message (typically the uid)     */    sendMessage(channelName, data = null, options = {}) {        if (this.socket && this.socket.readyState == 1) {            let message = {                channel: channelName,            };            for (let key in options) {                message[key] = options[key];            }            if (data) {                message.data = data;                this.log(message);                message.data = JSON.stringify(data);            }            else {                this.log(message);            }            this.socket.send(JSON.stringify(message));        }        else {            this.log('Socket not ready ! Please ensure that it is open and ready to send message');            this.memoryBeforeOpen.push({                channelName: channelName,                data: data,                options: options            });        }    }    /**     *     * @param channelName The channel on which the message is sent     * @param data The data to send     * @param callbacks The callbacks to call. With the channel as key and the callback function as value     */    sendMessageAndWait(channelName, data, callbacks) {        let uid = '_' + Math.random().toString(36).substr(2, 9);        this.waitingList[uid] = callbacks;        this.sendMessage(channelName, data, {            uid: uid        });    }    ;    /**     *     * @param channelName The channel on which the message is sent     * @param data The data to send     * @param callbacks The callbacks to call. With the channel as key and the callback function as value     */    sendMessageAndWaitMultiple(channelName, data, callbacks) {        let uid = '_' + Math.random().toString(36).substr(2, 9);        this.multipltWaitingList[uid] = callbacks;        this.sendMessage(channelName, data, {            uid: uid        });    }    isReady() {        if (this.socket && this.socket.readyState == 1) {            return true;        }        return false;    }    onOpen() {        if (this.socket && this.socket.readyState == 1) {            this.log('Connection successfully established !' + this.options.ip + ":" + this.options.port);            window.clearTimeout(this.timeoutError);            this.onDone();            if (this.options.hasOwnProperty("onOpen")) {                this.options.onOpen();            }            for (let i = 0; i < this.memoryBeforeOpen.length; i++) {                this.sendMessage(this.memoryBeforeOpen[i].channelName, this.memoryBeforeOpen[i].data, this.memoryBeforeOpen[i].options);            }            this.memoryBeforeOpen = [];        }        else {            console.error("open with error " + this.options.ip + ":" + this.options.port + "(" + (this.socket ? this.socket.readyState : "unknown") + ")");            setTimeout(() => this.open(), 2000);        }    }    onError(event) {        this.log('An error has occured');        if (this.options.hasOwnProperty("onError")) {            this.options.onError();        }    }    onClose(event) {        this.log('Closing connection');        if (this.options.hasOwnProperty("onClose")) {            this.options.onClose();        }        else {            if (window.location.pathname == '/') {                this.nbClose++;                if (this.nbClose == 2) {                    window.location.href = '/login/logout';                }                else {                    console.warn("try reopen socket ");                    let reopenInterval = setTimeout(() => {                        this.open(() => {                            clearInterval(reopenInterval);                        }, () => { });                    }, 5000);                }            }            else {                console.warn("try reopen socket ");                let reopenInterval = setTimeout(() => {                    this.open(() => {                        clearInterval(reopenInterval);                    }, () => { });                }, 5000);            }        }    }    onMessage(event) {        let response = JSON.parse(event.data);        this.log(response);        response.data = JSON.parse(response.data);        if (this.options.routes.hasOwnProperty(response.channel)) {            this.options.routes[response.channel].forEach(element => {                element.callback(response.data);            });        }        if (response.uid) {            if (this.waitingList.hasOwnProperty(response.uid)) {                let group = this.waitingList[response.uid];                if (group.hasOwnProperty(response.channel)) {                    group[response.channel](response.data);                }                delete this.waitingList[response.uid];            }            else if (this.multipltWaitingList.hasOwnProperty(response.uid)) {                let group = this.multipltWaitingList[response.uid];                if (group.hasOwnProperty(response.channel)) {                    try {                        if (!group[response.channel](response.data)) {                            delete this.multipltWaitingList[response.uid];                        }                    }                    catch (e) {                        console.error(e);                        delete this.multipltWaitingList[response.uid];                    }                }            }        }    }    log(message) {        if (this.options.log) {            const now = new Date();            const hours = (now.getHours()).toLocaleString(undefined, { minimumIntegerDigits: 2 });            const minutes = (now.getMinutes()).toLocaleString(undefined, { minimumIntegerDigits: 2 });            const seconds = (now.getSeconds()).toLocaleString(undefined, { minimumIntegerDigits: 2 });            console.log(`[WEBSOCKET] [${hours}:${minutes}:${seconds}]: `, JSON.parse(JSON.stringify(message)));        }    }}
class ResourceLoader {    static waitingResources = {};    static load(options, preventCache = false) {        let resourceData = localStorage.getItem("resource:" + options.url);        if (resourceData) {            options.success(resourceData);        }        else {            if (!this.waitingResources.hasOwnProperty(options.url)) {                this.waitingResources[options.url] = [options.success];                fetch(options.url)                    .then(async (response) => {                    let html = await response.text();                    if (preventCache) {                        localStorage.setItem("resource:" + options.url, html);                    }                    for (let i = 0; i < this.waitingResources[options.url].length; i++) {                        this.waitingResources[options.url][i](html);                    }                    delete this.waitingResources[options.url];                });            }            else {                this.waitingResources[options.url].push(options.success);            }        }    }}
class AvResizeObserver {    callback;    targets;    fpsInterval;    nextFrame;    entriesChangedEvent;    willTrigger;    static resizeObserverClassByObject = {};    static uniqueInstance;    static getUniqueInstance() {        if (!AvResizeObserver.uniqueInstance) {            AvResizeObserver.uniqueInstance = new ResizeObserver(entries => {                let allClasses = [];                for (let j = 0; j < entries.length; j++) {                    let entry = entries[j];                    let index = entry.target['sourceIndex'];                    if (AvResizeObserver.resizeObserverClassByObject[index]) {                        for (let i = 0; i < AvResizeObserver.resizeObserverClassByObject[index].length; i++) {                            let classTemp = AvResizeObserver.resizeObserverClassByObject[index][i];                            classTemp.entryChanged(entry);                            if (allClasses.indexOf(classTemp) == -1) {                                allClasses.push(classTemp);                            }                        }                    }                }                for (let i = 0; i < allClasses.length; i++) {                    allClasses[i].triggerCb();                }            });        }        return AvResizeObserver.uniqueInstance;    }    constructor(options) {        let realOption;        if (options instanceof Function) {            realOption = {                callback: options,            };        }        else {            realOption = options;        }        this.callback = realOption.callback;        this.targets = [];        if (!realOption.fps) {            realOption.fps = 60;        }        if (realOption.fps != -1) {            this.fpsInterval = 1000 / realOption.fps;        }        this.nextFrame = 0;        this.entriesChangedEvent = {};        this.willTrigger = false;    }    observe(target) {        if (!target["sourceIndex"]) {            target["sourceIndex"] = Math.random().toString(36);            this.targets.push(target);            AvResizeObserver.resizeObserverClassByObject[target["sourceIndex"]] = [];            AvResizeObserver.getUniqueInstance().observe(target);        }        if (AvResizeObserver.resizeObserverClassByObject[target["sourceIndex"]].indexOf(this) == -1) {            AvResizeObserver.resizeObserverClassByObject[target["sourceIndex"]].push(this);        }    }    unobserve(target) {        for (let i = 0; this.targets.length; i++) {            let tempTarget = this.targets[i];            if (tempTarget == target) {                let position = AvResizeObserver.resizeObserverClassByObject[target['sourceIndex']].indexOf(this);                if (position != -1) {                    AvResizeObserver.resizeObserverClassByObject[target['sourceIndex']].splice(position, 1);                }                if (AvResizeObserver.resizeObserverClassByObject[target['sourceIndex']].length == 0) {                    delete AvResizeObserver.resizeObserverClassByObject[target['sourceIndex']];                }                AvResizeObserver.getUniqueInstance().unobserve(target);                this.targets.splice(i, 1);                return;            }        }    }    disconnect() {        for (let i = 0; this.targets.length; i++) {            this.unobserve(this.targets[i]);        }    }    entryChanged(entry) {        let index = entry.target.sourceIndex;        this.entriesChangedEvent[index] = entry;    }    triggerCb() {        if (!this.willTrigger) {            this.willTrigger = true;            this._triggerCb();        }    }    _triggerCb() {        let now = window.performance.now();        let elapsed = now - this.nextFrame;        if (this.fpsInterval != -1 && elapsed <= this.fpsInterval) {            requestAnimationFrame(() => {                this._triggerCb();            });            return;        }        this.nextFrame = now - (elapsed % this.fpsInterval);        let changed = Object.values(this.entriesChangedEvent);        this.entriesChangedEvent = {};        this.willTrigger = false;        setTimeout(() => {            this.callback(changed);        }, 0);    }}
class PressManager {    options;    element;    subPressManager = [];    delayDblPress = 150;    delayLongPress = 700;    nbPress = 0;    offsetDrag = 20;    state = {        oneActionTriggered: false,        isMoving: false,    };    startPosition = { x: 0, y: 0 };    customFcts = {};    timeoutDblPress = 0;    timeoutLongPress = 0;    downEventSaved;    actionsName = {        press: "press",        longPress: "longPress",        dblPress: "dblPress",        drag: "drag"    };    useDblPress = false;    forceDblPress = false;    functionsBinded = {        downAction: (e) => { },        upAction: (e) => { },        moveAction: (e) => { },        childPress: (e) => { },        childDblPress: (e) => { },        childLongPress: (e) => { },        childDragStart: (e) => { },    };    /**     * @param {*} options - The options     * @param {HTMLElement | HTMLElement[]} options.element - The element to manage     */    constructor(options) {        if (options.element === void 0) {            throw 'You must provide an element';        }        if (Array.isArray(options.element)) {            for (let el of options.element) {                let cloneOpt = { ...options };                cloneOpt.element = el;                this.subPressManager.push(new PressManager(cloneOpt));            }        }        else {            this.element = options.element;            this.checkDragConstraint(options);            this.assignValueOption(options);            this.options = options;            this.init();        }    }    getElement() {        return this.element;    }    checkDragConstraint(options) {        if (options.onDrag !== void 0) {            if (options.onDragStart === void 0) {                options.onDragStart = (e) => { };            }            if (options.onDragEnd === void 0) {                options.onDragEnd = (e) => { };            }        }        if (options.onDragStart !== void 0) {            if (options.onDrag === void 0) {                options.onDrag = (e) => { };            }            if (options.onDragEnd === void 0) {                options.onDragEnd = (e) => { };            }        }        if (options.onDragEnd !== void 0) {            if (options.onDragStart === void 0) {                options.onDragStart = (e) => { };            }            if (options.onDrag === void 0) {                options.onDrag = (e) => { };            }        }    }    assignValueOption(options) {        if (options.delayDblPress !== undefined) {            this.delayDblPress = options.delayDblPress;        }        if (options.delayLongPress !== undefined) {            this.delayLongPress = options.delayLongPress;        }        if (options.offsetDrag !== undefined) {            this.offsetDrag = options.offsetDrag;        }        if (options.onDblPress !== undefined) {            this.useDblPress = true;        }        if (options.forceDblPress) {            this.useDblPress = true;        }    }    bindAllFunction() {        this.functionsBinded.downAction = this.downAction.bind(this);        this.functionsBinded.moveAction = this.moveAction.bind(this);        this.functionsBinded.upAction = this.upAction.bind(this);        this.functionsBinded.childDblPress = this.childDblPress.bind(this);        this.functionsBinded.childDragStart = this.childDragStart.bind(this);        this.functionsBinded.childLongPress = this.childLongPress.bind(this);        this.functionsBinded.childPress = this.childPress.bind(this);    }    init() {        this.bindAllFunction();        this.element.addEventListener("pointerdown", this.functionsBinded.downAction);        this.element.addEventListener("trigger_pointer_press", this.functionsBinded.childPress);        this.element.addEventListener("trigger_pointer_dblpress", this.functionsBinded.childDblPress);        this.element.addEventListener("trigger_pointer_longpress", this.functionsBinded.childLongPress);        this.element.addEventListener("trigger_pointer_dragstart", this.functionsBinded.childDragStart);    }    downAction(e) {        this.downEventSaved = e;        e.stopPropagation();        this.customFcts = {};        if (this.nbPress == 0) {            this.state.oneActionTriggered = false;            clearTimeout(this.timeoutDblPress);        }        this.startPosition = { x: e.pageX, y: e.pageY };        document.addEventListener("pointerup", this.functionsBinded.upAction);        document.addEventListener("pointermove", this.functionsBinded.moveAction);        this.timeoutLongPress = setTimeout(() => {            if (!this.state.oneActionTriggered) {                if (this.options.onLongPress) {                    this.state.oneActionTriggered = true;                    this.options.onLongPress(e, this);                    this.triggerEventToParent(this.actionsName.longPress, e);                }                else {                    this.emitTriggerFunction("longpress", e);                }            }        }, this.delayLongPress);        if (this.options.onPressStart) {            this.options.onPressStart(e, this);        }    }    upAction(e) {        e.stopPropagation();        document.removeEventListener("pointerup", this.functionsBinded.downAction);        document.removeEventListener("pointermove", this.functionsBinded.moveAction);        clearTimeout(this.timeoutLongPress);        if (this.state.isMoving) {            this.state.isMoving = false;            if (this.options.onDragEnd) {                this.options.onDragEnd(e, this);            }            else if (this.customFcts.src && this.customFcts.onDragEnd) {                this.customFcts.onDragEnd(e, this.customFcts.src);            }        }        else {            if (this.useDblPress) {                this.nbPress++;                if (this.nbPress == 2) {                    if (!this.state.oneActionTriggered) {                        this.state.oneActionTriggered = true;                        this.nbPress = 0;                        if (this.options.onDblPress) {                            this.options.onDblPress(e, this);                            this.triggerEventToParent(this.actionsName.dblPress, e);                        }                        else {                            this.emitTriggerFunction("dblpress", e);                        }                    }                }                else if (this.nbPress == 1) {                    this.timeoutDblPress = setTimeout(() => {                        this.nbPress = 0;                        if (!this.state.oneActionTriggered) {                            if (this.options.onPress) {                                this.state.oneActionTriggered = true;                                this.options.onPress(e, this);                                this.triggerEventToParent(this.actionsName.press, e);                            }                            else {                                this.emitTriggerFunction("press", e);                            }                        }                    }, this.delayDblPress);                }            }            else {                if (!this.state.oneActionTriggered) {                    if (this.options.onPress) {                        this.state.oneActionTriggered = true;                        this.options.onPress(e, this);                        this.triggerEventToParent(this.actionsName.press, e);                    }                    else {                        this.emitTriggerFunction("press", e);                    }                }            }        }        if (this.options.onPressEnd) {            this.options.onPressEnd(e, this);        }    }    moveAction(e) {        if (!this.state.isMoving && !this.state.oneActionTriggered) {            e.stopPropagation();            let xDist = e.pageX - this.startPosition.x;            let yDist = e.pageY - this.startPosition.y;            let distance = Math.sqrt(xDist * xDist + yDist * yDist);            if (distance > this.offsetDrag) {                this.state.oneActionTriggered = true;                if (this.options.onDragStart) {                    this.state.isMoving = true;                    if (this.options.onDragStart) {                        this.options.onDragStart(this.downEventSaved, this);                        this.triggerEventToParent(this.actionsName.drag, e);                    }                    else {                        this.emitTriggerFunction("dragstart", this.downEventSaved);                    }                }            }        }        else if (this.state.isMoving) {            if (this.options.onDrag) {                this.options.onDrag(e, this);            }            else if (this.customFcts.src && this.customFcts.onDrag) {                this.customFcts.onDrag(e, this.customFcts.src);            }        }    }    triggerEventToParent(eventName, pointerEvent) {        if (this.element.parentNode) {            this.element.parentNode.dispatchEvent(new CustomEvent("pressaction_trigger", {                bubbles: true,                cancelable: false,                composed: true,                detail: {                    target: this.element,                    eventName: eventName,                    realEvent: pointerEvent                }            }));        }    }    childPress(e) {        if (this.options.onPress) {            e.stopPropagation();            e.detail.state.oneActionTriggered = true;            this.options.onPress(e.detail.realEvent, this);            this.triggerEventToParent(this.actionsName.press, e.detail.realEvent);        }    }    childDblPress(e) {        if (this.options.onDblPress) {            e.stopPropagation();            if (e.detail.state) {                e.detail.state.oneActionTriggered = true;            }            this.options.onDblPress(e.detail.realEvent, this);            this.triggerEventToParent(this.actionsName.dblPress, e.detail.realEvent);        }    }    childLongPress(e) {        if (this.options.onLongPress) {            e.stopPropagation();            e.detail.state.oneActionTriggered = true;            this.options.onLongPress(e.detail.realEvent, this);            this.triggerEventToParent(this.actionsName.longPress, e.detail.realEvent);        }    }    childDragStart(e) {        if (this.options.onDragStart) {            e.stopPropagation();            e.detail.state.isMoving = true;            e.detail.customFcts.src = this;            e.detail.customFcts.onDrag = this.options.onDrag;            e.detail.customFcts.onDragEnd = this.options.onDragEnd;            this.options.onDragStart(e.detail.realEvent, this);            this.triggerEventToParent(this.actionsName.drag, e.detail.realEvent);        }    }    emitTriggerFunction(action, e) {        this.element.dispatchEvent(new CustomEvent("trigger_pointer_" + action, {            bubbles: true,            cancelable: true,            composed: true,            detail: {                state: this.state,                customFcts: this.customFcts,                realEvent: e            }        }));    }    destroy() {        for (let sub of this.subPressManager) {            sub.destroy();        }        if (this.element) {            this.element.removeEventListener("pointerdown", this.functionsBinded.downAction);            this.element.removeEventListener("trigger_pointer_press", this.functionsBinded.childPress);            this.element.removeEventListener("trigger_pointer_dblpress", this.functionsBinded.childDblPress);            this.element.removeEventListener("trigger_pointer_longpress", this.functionsBinded.childLongPress);            this.element.removeEventListener("trigger_pointer_dragstart", this.functionsBinded.childDragStart);        }    }}
class Pointer {    id;    clientX;    clientY;    nativePointer;    pageX;    pageY;    constructor(nativePointer) {        this.id = -1;        this.nativePointer = nativePointer;        this.pageX = nativePointer.pageX;        this.pageY = nativePointer.pageY;        this.clientX = nativePointer.clientX;        this.clientY = nativePointer.clientY;        if (self.Touch && nativePointer instanceof Touch) {            this.id = nativePointer.identifier;        }        else if (self.PointerEvent && nativePointer instanceof PointerEvent) {            this.id = nativePointer.pointerId;        }    }}class PointerTracker {    element;    currentPointers;    startCallback;    moveCallback;    endCallback;    lastEvent;    constructor(element, callbacks) {        this.element = element;        this.currentPointers = [];        const { start = () => true, move = () => { }, end = () => { } } = callbacks;        this.startCallback = start;        this.moveCallback = move;        this.endCallback = end;        this.pointerStart = this.pointerStart.bind(this);        this.touchStart = this.touchStart.bind(this);        this.triggerPointerStart = this.triggerPointerStart.bind(this);        this.move = this.move.bind(this);        this.triggerPointerEnd = this.triggerPointerEnd.bind(this);        this.pointerEnd = this.pointerEnd.bind(this);        this.touchEnd = this.touchEnd.bind(this);        this.lastEvent = new Date();        this.element.addEventListener('mousedown', this.pointerStart);        this.element.addEventListener('touchstart', this.touchStart);    }    reset() {        this.currentPointers = [];        window.removeEventListener('mousemove', this.move);        window.removeEventListener('mouseup', this.pointerEnd);        window.removeEventListener('touchmove', this.move);        window.removeEventListener('touchend', this.touchEnd);    }    getCurrentPointers() {        return this.currentPointers;    }    triggerPointerStart(pointer, event) {        if (this.isTooOld()) {            this.currentPointers = [];        }        if (!this.startCallback(pointer, event))            return false;        this.currentPointers.push(pointer);        return true;    }    pointerStart(event) {        if (event.button !== 0)            return;        const oldPointersLength = this.currentPointers.length;        if (!this.triggerPointerStart(new Pointer(event), event))            return;        event.preventDefault();        if (oldPointersLength === 0) {            window.addEventListener('mousemove', this.move);            window.addEventListener('mouseup', this.pointerEnd);        }    }    touchStart(event) {        /* if (window.currentDropdownOpen) {             window.currentDropdownOpen.expanded = false;         }*/        const oldPointersLength = this.currentPointers.length;        for (const touch of Array.from(event.changedTouches)) {            this.triggerPointerStart(new Pointer(touch), event);        }        event.preventDefault();        if (oldPointersLength === 0) {            window.removeEventListener('touchmove', this.move);            window.removeEventListener('touchend', this.touchEnd);            window.addEventListener('touchmove', this.move);            window.addEventListener('touchend', this.touchEnd);        }    }    move(event) {        setTimeout(() => {            this.lastEvent = new Date();            const previousPointers = this.currentPointers.slice();            const changedPointers = ('changedTouches' in event) ? Array.from(event.changedTouches).map(t => new Pointer(t)) : [new Pointer(event)];            const trackedChangedPointers = [];            for (const pointer of changedPointers) {                const index = this.currentPointers.findIndex(p => p.id === pointer.id);                if (index === -1)                    continue;                trackedChangedPointers.push(pointer);                this.currentPointers[index] = pointer;            }            if (trackedChangedPointers.length === 0)                return;            this.moveCallback(previousPointers, trackedChangedPointers, event);        });    }    triggerPointerEnd(pointer, event) {        const index = this.currentPointers.findIndex(p => p.id === pointer.id);        if (index === -1)            return false;        this.currentPointers.splice(index, 1);        this.endCallback(pointer, event);        return true;    }    pointerEnd(event) {        event.preventDefault();        if (this.currentPointers.length === 0) {            window.removeEventListener('mousemove', this.move);            window.removeEventListener('mouseup', this.pointerEnd);        }        if (!this.triggerPointerEnd(new Pointer(event), event))            return;    }    touchEnd(event) {        for (const touch of Array.from(event.changedTouches)) {            this.triggerPointerEnd(new Pointer(touch), event);        }        event.preventDefault();        if (this.currentPointers.length === 0) {            window.removeEventListener('touchmove', this.move);            window.removeEventListener('touchend', this.touchEnd);        }    }    isTooOld() {        let d = new Date();        let diff = d.getTime() - this.lastEvent.getTime();        if (diff > 2000) {            return true;        }        return false;    }}
var luxon = (function (exports) {
    'use strict';
  
    function _defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
      }
    }
  
    function _createClass(Constructor, protoProps, staticProps) {
      if (protoProps) _defineProperties(Constructor.prototype, protoProps);
      if (staticProps) _defineProperties(Constructor, staticProps);
      return Constructor;
    }
  
    function _extends() {
      _extends = Object.assign || function (target) {
        for (var i = 1; i < arguments.length; i++) {
          var source = arguments[i];
  
          for (var key in source) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
              target[key] = source[key];
            }
          }
        }
  
        return target;
      };
  
      return _extends.apply(this, arguments);
    }
  
    function _inheritsLoose(subClass, superClass) {
      subClass.prototype = Object.create(superClass.prototype);
      subClass.prototype.constructor = subClass;
  
      _setPrototypeOf(subClass, superClass);
    }
  
    function _getPrototypeOf(o) {
      _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) {
        return o.__proto__ || Object.getPrototypeOf(o);
      };
      return _getPrototypeOf(o);
    }
  
    function _setPrototypeOf(o, p) {
      _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) {
        o.__proto__ = p;
        return o;
      };
  
      return _setPrototypeOf(o, p);
    }
  
    function _isNativeReflectConstruct() {
      if (typeof Reflect === "undefined" || !Reflect.construct) return false;
      if (Reflect.construct.sham) return false;
      if (typeof Proxy === "function") return true;
  
      try {
        Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {}));
        return true;
      } catch (e) {
        return false;
      }
    }
  
    function _construct(Parent, args, Class) {
      if (_isNativeReflectConstruct()) {
        _construct = Reflect.construct;
      } else {
        _construct = function _construct(Parent, args, Class) {
          var a = [null];
          a.push.apply(a, args);
          var Constructor = Function.bind.apply(Parent, a);
          var instance = new Constructor();
          if (Class) _setPrototypeOf(instance, Class.prototype);
          return instance;
        };
      }
  
      return _construct.apply(null, arguments);
    }
  
    function _isNativeFunction(fn) {
      return Function.toString.call(fn).indexOf("[native code]") !== -1;
    }
  
    function _wrapNativeSuper(Class) {
      var _cache = typeof Map === "function" ? new Map() : undefined;
  
      _wrapNativeSuper = function _wrapNativeSuper(Class) {
        if (Class === null || !_isNativeFunction(Class)) return Class;
  
        if (typeof Class !== "function") {
          throw new TypeError("Super expression must either be null or a function");
        }
  
        if (typeof _cache !== "undefined") {
          if (_cache.has(Class)) return _cache.get(Class);
  
          _cache.set(Class, Wrapper);
        }
  
        function Wrapper() {
          return _construct(Class, arguments, _getPrototypeOf(this).constructor);
        }
  
        Wrapper.prototype = Object.create(Class.prototype, {
          constructor: {
            value: Wrapper,
            enumerable: false,
            writable: true,
            configurable: true
          }
        });
        return _setPrototypeOf(Wrapper, Class);
      };
  
      return _wrapNativeSuper(Class);
    }
  
    function _objectWithoutPropertiesLoose(source, excluded) {
      if (source == null) return {};
      var target = {};
      var sourceKeys = Object.keys(source);
      var key, i;
  
      for (i = 0; i < sourceKeys.length; i++) {
        key = sourceKeys[i];
        if (excluded.indexOf(key) >= 0) continue;
        target[key] = source[key];
      }
  
      return target;
    }
  
    function _unsupportedIterableToArray(o, minLen) {
      if (!o) return;
      if (typeof o === "string") return _arrayLikeToArray(o, minLen);
      var n = Object.prototype.toString.call(o).slice(8, -1);
      if (n === "Object" && o.constructor) n = o.constructor.name;
      if (n === "Map" || n === "Set") return Array.from(o);
      if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen);
    }
  
    function _arrayLikeToArray(arr, len) {
      if (len == null || len > arr.length) len = arr.length;
  
      for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i];
  
      return arr2;
    }
  
    function _createForOfIteratorHelperLoose(o, allowArrayLike) {
      var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"];
      if (it) return (it = it.call(o)).next.bind(it);
  
      if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") {
        if (it) o = it;
        var i = 0;
        return function () {
          if (i >= o.length) return {
            done: true
          };
          return {
            done: false,
            value: o[i++]
          };
        };
      }
  
      throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
    }
  
    // these aren't really private, but nor are they really useful to document
  
    /**
     * @private
     */
    var LuxonError = /*#__PURE__*/function (_Error) {
      _inheritsLoose(LuxonError, _Error);
  
      function LuxonError() {
        return _Error.apply(this, arguments) || this;
      }
  
      return LuxonError;
    }( /*#__PURE__*/_wrapNativeSuper(Error));
    /**
     * @private
     */
  
  
    var InvalidDateTimeError = /*#__PURE__*/function (_LuxonError) {
      _inheritsLoose(InvalidDateTimeError, _LuxonError);
  
      function InvalidDateTimeError(reason) {
        return _LuxonError.call(this, "Invalid DateTime: " + reason.toMessage()) || this;
      }
  
      return InvalidDateTimeError;
    }(LuxonError);
    /**
     * @private
     */
  
    var InvalidIntervalError = /*#__PURE__*/function (_LuxonError2) {
      _inheritsLoose(InvalidIntervalError, _LuxonError2);
  
      function InvalidIntervalError(reason) {
        return _LuxonError2.call(this, "Invalid Interval: " + reason.toMessage()) || this;
      }
  
      return InvalidIntervalError;
    }(LuxonError);
    /**
     * @private
     */
  
    var InvalidDurationError = /*#__PURE__*/function (_LuxonError3) {
      _inheritsLoose(InvalidDurationError, _LuxonError3);
  
      function InvalidDurationError(reason) {
        return _LuxonError3.call(this, "Invalid Duration: " + reason.toMessage()) || this;
      }
  
      return InvalidDurationError;
    }(LuxonError);
    /**
     * @private
     */
  
    var ConflictingSpecificationError = /*#__PURE__*/function (_LuxonError4) {
      _inheritsLoose(ConflictingSpecificationError, _LuxonError4);
  
      function ConflictingSpecificationError() {
        return _LuxonError4.apply(this, arguments) || this;
      }
  
      return ConflictingSpecificationError;
    }(LuxonError);
    /**
     * @private
     */
  
    var InvalidUnitError = /*#__PURE__*/function (_LuxonError5) {
      _inheritsLoose(InvalidUnitError, _LuxonError5);
  
      function InvalidUnitError(unit) {
        return _LuxonError5.call(this, "Invalid unit " + unit) || this;
      }
  
      return InvalidUnitError;
    }(LuxonError);
    /**
     * @private
     */
  
    var InvalidArgumentError = /*#__PURE__*/function (_LuxonError6) {
      _inheritsLoose(InvalidArgumentError, _LuxonError6);
  
      function InvalidArgumentError() {
        return _LuxonError6.apply(this, arguments) || this;
      }
  
      return InvalidArgumentError;
    }(LuxonError);
    /**
     * @private
     */
  
    var ZoneIsAbstractError = /*#__PURE__*/function (_LuxonError7) {
      _inheritsLoose(ZoneIsAbstractError, _LuxonError7);
  
      function ZoneIsAbstractError() {
        return _LuxonError7.call(this, "Zone is an abstract class") || this;
      }
  
      return ZoneIsAbstractError;
    }(LuxonError);
  
    /**
     * @private
     */
    var n = "numeric",
        s = "short",
        l = "long";
    var DATE_SHORT = {
      year: n,
      month: n,
      day: n
    };
    var DATE_MED = {
      year: n,
      month: s,
      day: n
    };
    var DATE_MED_WITH_WEEKDAY = {
      year: n,
      month: s,
      day: n,
      weekday: s
    };
    var DATE_FULL = {
      year: n,
      month: l,
      day: n
    };
    var DATE_HUGE = {
      year: n,
      month: l,
      day: n,
      weekday: l
    };
    var TIME_SIMPLE = {
      hour: n,
      minute: n
    };
    var TIME_WITH_SECONDS = {
      hour: n,
      minute: n,
      second: n
    };
    var TIME_WITH_SHORT_OFFSET = {
      hour: n,
      minute: n,
      second: n,
      timeZoneName: s
    };
    var TIME_WITH_LONG_OFFSET = {
      hour: n,
      minute: n,
      second: n,
      timeZoneName: l
    };
    var TIME_24_SIMPLE = {
      hour: n,
      minute: n,
      hourCycle: "h23"
    };
    var TIME_24_WITH_SECONDS = {
      hour: n,
      minute: n,
      second: n,
      hourCycle: "h23"
    };
    var TIME_24_WITH_SHORT_OFFSET = {
      hour: n,
      minute: n,
      second: n,
      hourCycle: "h23",
      timeZoneName: s
    };
    var TIME_24_WITH_LONG_OFFSET = {
      hour: n,
      minute: n,
      second: n,
      hourCycle: "h23",
      timeZoneName: l
    };
    var DATETIME_SHORT = {
      year: n,
      month: n,
      day: n,
      hour: n,
      minute: n
    };
    var DATETIME_SHORT_WITH_SECONDS = {
      year: n,
      month: n,
      day: n,
      hour: n,
      minute: n,
      second: n
    };
    var DATETIME_MED = {
      year: n,
      month: s,
      day: n,
      hour: n,
      minute: n
    };
    var DATETIME_MED_WITH_SECONDS = {
      year: n,
      month: s,
      day: n,
      hour: n,
      minute: n,
      second: n
    };
    var DATETIME_MED_WITH_WEEKDAY = {
      year: n,
      month: s,
      day: n,
      weekday: s,
      hour: n,
      minute: n
    };
    var DATETIME_FULL = {
      year: n,
      month: l,
      day: n,
      hour: n,
      minute: n,
      timeZoneName: s
    };
    var DATETIME_FULL_WITH_SECONDS = {
      year: n,
      month: l,
      day: n,
      hour: n,
      minute: n,
      second: n,
      timeZoneName: s
    };
    var DATETIME_HUGE = {
      year: n,
      month: l,
      day: n,
      weekday: l,
      hour: n,
      minute: n,
      timeZoneName: l
    };
    var DATETIME_HUGE_WITH_SECONDS = {
      year: n,
      month: l,
      day: n,
      weekday: l,
      hour: n,
      minute: n,
      second: n,
      timeZoneName: l
    };
  
    /**
     * @private
     */
    // TYPES
  
    function isUndefined(o) {
      return typeof o === "undefined";
    }
    function isNumber(o) {
      return typeof o === "number";
    }
    function isInteger(o) {
      return typeof o === "number" && o % 1 === 0;
    }
    function isString(o) {
      return typeof o === "string";
    }
    function isDate(o) {
      return Object.prototype.toString.call(o) === "[object Date]";
    } // CAPABILITIES
  
    function hasRelative() {
      try {
        return typeof Intl !== "undefined" && !!Intl.RelativeTimeFormat;
      } catch (e) {
        return false;
      }
    } // OBJECTS AND ARRAYS
  
    function maybeArray(thing) {
      return Array.isArray(thing) ? thing : [thing];
    }
    function bestBy(arr, by, compare) {
      if (arr.length === 0) {
        return undefined;
      }
  
      return arr.reduce(function (best, next) {
        var pair = [by(next), next];
  
        if (!best) {
          return pair;
        } else if (compare(best[0], pair[0]) === best[0]) {
          return best;
        } else {
          return pair;
        }
      }, null)[1];
    }
    function pick(obj, keys) {
      return keys.reduce(function (a, k) {
        a[k] = obj[k];
        return a;
      }, {});
    }
    function hasOwnProperty(obj, prop) {
      return Object.prototype.hasOwnProperty.call(obj, prop);
    } // NUMBERS AND STRINGS
  
    function integerBetween(thing, bottom, top) {
      return isInteger(thing) && thing >= bottom && thing <= top;
    } // x % n but takes the sign of n instead of x
  
    function floorMod(x, n) {
      return x - n * Math.floor(x / n);
    }
    function padStart(input, n) {
      if (n === void 0) {
        n = 2;
      }
  
      var isNeg = input < 0;
      var padded;
  
      if (isNeg) {
        padded = "-" + ("" + -input).padStart(n, "0");
      } else {
        padded = ("" + input).padStart(n, "0");
      }
  
      return padded;
    }
    function parseInteger(string) {
      if (isUndefined(string) || string === null || string === "") {
        return undefined;
      } else {
        return parseInt(string, 10);
      }
    }
    function parseFloating(string) {
      if (isUndefined(string) || string === null || string === "") {
        return undefined;
      } else {
        return parseFloat(string);
      }
    }
    function parseMillis(fraction) {
      // Return undefined (instead of 0) in these cases, where fraction is not set
      if (isUndefined(fraction) || fraction === null || fraction === "") {
        return undefined;
      } else {
        var f = parseFloat("0." + fraction) * 1000;
        return Math.floor(f);
      }
    }
    function roundTo(number, digits, towardZero) {
      if (towardZero === void 0) {
        towardZero = false;
      }
  
      var factor = Math.pow(10, digits),
          rounder = towardZero ? Math.trunc : Math.round;
      return rounder(number * factor) / factor;
    } // DATE BASICS
  
    function isLeapYear(year) {
      return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    }
    function daysInYear(year) {
      return isLeapYear(year) ? 366 : 365;
    }
    function daysInMonth(year, month) {
      var modMonth = floorMod(month - 1, 12) + 1,
          modYear = year + (month - modMonth) / 12;
  
      if (modMonth === 2) {
        return isLeapYear(modYear) ? 29 : 28;
      } else {
        return [31, null, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][modMonth - 1];
      }
    } // covert a calendar object to a local timestamp (epoch, but with the offset baked in)
  
    function objToLocalTS(obj) {
      var d = Date.UTC(obj.year, obj.month - 1, obj.day, obj.hour, obj.minute, obj.second, obj.millisecond); // for legacy reasons, years between 0 and 99 are interpreted as 19XX; revert that
  
      if (obj.year < 100 && obj.year >= 0) {
        d = new Date(d);
        d.setUTCFullYear(d.getUTCFullYear() - 1900);
      }
  
      return +d;
    }
    function weeksInWeekYear(weekYear) {
      var p1 = (weekYear + Math.floor(weekYear / 4) - Math.floor(weekYear / 100) + Math.floor(weekYear / 400)) % 7,
          last = weekYear - 1,
          p2 = (last + Math.floor(last / 4) - Math.floor(last / 100) + Math.floor(last / 400)) % 7;
      return p1 === 4 || p2 === 3 ? 53 : 52;
    }
    function untruncateYear(year) {
      if (year > 99) {
        return year;
      } else return year > 60 ? 1900 + year : 2000 + year;
    } // PARSING
  
    function parseZoneInfo(ts, offsetFormat, locale, timeZone) {
      if (timeZone === void 0) {
        timeZone = null;
      }
  
      var date = new Date(ts),
          intlOpts = {
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      };
  
      if (timeZone) {
        intlOpts.timeZone = timeZone;
      }
  
      var modified = _extends({
        timeZoneName: offsetFormat
      }, intlOpts);
  
      var parsed = new Intl.DateTimeFormat(locale, modified).formatToParts(date).find(function (m) {
        return m.type.toLowerCase() === "timezonename";
      });
      return parsed ? parsed.value : null;
    } // signedOffset('-5', '30') -> -330
  
    function signedOffset(offHourStr, offMinuteStr) {
      var offHour = parseInt(offHourStr, 10); // don't || this because we want to preserve -0
  
      if (Number.isNaN(offHour)) {
        offHour = 0;
      }
  
      var offMin = parseInt(offMinuteStr, 10) || 0,
          offMinSigned = offHour < 0 || Object.is(offHour, -0) ? -offMin : offMin;
      return offHour * 60 + offMinSigned;
    } // COERCION
  
    function asNumber(value) {
      var numericValue = Number(value);
      if (typeof value === "boolean" || value === "" || Number.isNaN(numericValue)) throw new InvalidArgumentError("Invalid unit value " + value);
      return numericValue;
    }
    function normalizeObject(obj, normalizer) {
      var normalized = {};
  
      for (var u in obj) {
        if (hasOwnProperty(obj, u)) {
          var v = obj[u];
          if (v === undefined || v === null) continue;
          normalized[normalizer(u)] = asNumber(v);
        }
      }
  
      return normalized;
    }
    function formatOffset(offset, format) {
      var hours = Math.trunc(Math.abs(offset / 60)),
          minutes = Math.trunc(Math.abs(offset % 60)),
          sign = offset >= 0 ? "+" : "-";
  
      switch (format) {
        case "short":
          return "" + sign + padStart(hours, 2) + ":" + padStart(minutes, 2);
  
        case "narrow":
          return "" + sign + hours + (minutes > 0 ? ":" + minutes : "");
  
        case "techie":
          return "" + sign + padStart(hours, 2) + padStart(minutes, 2);
  
        default:
          throw new RangeError("Value format " + format + " is out of range for property format");
      }
    }
    function timeObject(obj) {
      return pick(obj, ["hour", "minute", "second", "millisecond"]);
    }
    var ianaRegex = /[A-Za-z_+-]{1,256}(:?\/[A-Za-z0-9_+-]{1,256}(\/[A-Za-z0-9_+-]{1,256})?)?/;
  
    /**
     * @private
     */
  
  
    var monthsLong = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    var monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var monthsNarrow = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
    function months(length) {
      switch (length) {
        case "narrow":
          return [].concat(monthsNarrow);
  
        case "short":
          return [].concat(monthsShort);
  
        case "long":
          return [].concat(monthsLong);
  
        case "numeric":
          return ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
  
        case "2-digit":
          return ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
  
        default:
          return null;
      }
    }
    var weekdaysLong = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    var weekdaysShort = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    var weekdaysNarrow = ["M", "T", "W", "T", "F", "S", "S"];
    function weekdays(length) {
      switch (length) {
        case "narrow":
          return [].concat(weekdaysNarrow);
  
        case "short":
          return [].concat(weekdaysShort);
  
        case "long":
          return [].concat(weekdaysLong);
  
        case "numeric":
          return ["1", "2", "3", "4", "5", "6", "7"];
  
        default:
          return null;
      }
    }
    var meridiems = ["AM", "PM"];
    var erasLong = ["Before Christ", "Anno Domini"];
    var erasShort = ["BC", "AD"];
    var erasNarrow = ["B", "A"];
    function eras(length) {
      switch (length) {
        case "narrow":
          return [].concat(erasNarrow);
  
        case "short":
          return [].concat(erasShort);
  
        case "long":
          return [].concat(erasLong);
  
        default:
          return null;
      }
    }
    function meridiemForDateTime(dt) {
      return meridiems[dt.hour < 12 ? 0 : 1];
    }
    function weekdayForDateTime(dt, length) {
      return weekdays(length)[dt.weekday - 1];
    }
    function monthForDateTime(dt, length) {
      return months(length)[dt.month - 1];
    }
    function eraForDateTime(dt, length) {
      return eras(length)[dt.year < 0 ? 0 : 1];
    }
    function formatRelativeTime(unit, count, numeric, narrow) {
      if (numeric === void 0) {
        numeric = "always";
      }
  
      if (narrow === void 0) {
        narrow = false;
      }
  
      var units = {
        years: ["year", "yr."],
        quarters: ["quarter", "qtr."],
        months: ["month", "mo."],
        weeks: ["week", "wk."],
        days: ["day", "day", "days"],
        hours: ["hour", "hr."],
        minutes: ["minute", "min."],
        seconds: ["second", "sec."]
      };
      var lastable = ["hours", "minutes", "seconds"].indexOf(unit) === -1;
  
      if (numeric === "auto" && lastable) {
        var isDay = unit === "days";
  
        switch (count) {
          case 1:
            return isDay ? "tomorrow" : "next " + units[unit][0];
  
          case -1:
            return isDay ? "yesterday" : "last " + units[unit][0];
  
          case 0:
            return isDay ? "today" : "this " + units[unit][0];
  
        }
      }
  
      var isInPast = Object.is(count, -0) || count < 0,
          fmtValue = Math.abs(count),
          singular = fmtValue === 1,
          lilUnits = units[unit],
          fmtUnit = narrow ? singular ? lilUnits[1] : lilUnits[2] || lilUnits[1] : singular ? units[unit][0] : unit;
      return isInPast ? fmtValue + " " + fmtUnit + " ago" : "in " + fmtValue + " " + fmtUnit;
    }
  
    function stringifyTokens(splits, tokenToString) {
      var s = "";
  
      for (var _iterator = _createForOfIteratorHelperLoose(splits), _step; !(_step = _iterator()).done;) {
        var token = _step.value;
  
        if (token.literal) {
          s += token.val;
        } else {
          s += tokenToString(token.val);
        }
      }
  
      return s;
    }
  
    var _macroTokenToFormatOpts = {
      D: DATE_SHORT,
      DD: DATE_MED,
      DDD: DATE_FULL,
      DDDD: DATE_HUGE,
      t: TIME_SIMPLE,
      tt: TIME_WITH_SECONDS,
      ttt: TIME_WITH_SHORT_OFFSET,
      tttt: TIME_WITH_LONG_OFFSET,
      T: TIME_24_SIMPLE,
      TT: TIME_24_WITH_SECONDS,
      TTT: TIME_24_WITH_SHORT_OFFSET,
      TTTT: TIME_24_WITH_LONG_OFFSET,
      f: DATETIME_SHORT,
      ff: DATETIME_MED,
      fff: DATETIME_FULL,
      ffff: DATETIME_HUGE,
      F: DATETIME_SHORT_WITH_SECONDS,
      FF: DATETIME_MED_WITH_SECONDS,
      FFF: DATETIME_FULL_WITH_SECONDS,
      FFFF: DATETIME_HUGE_WITH_SECONDS
    };
    /**
     * @private
     */
  
    var Formatter = /*#__PURE__*/function () {
      Formatter.create = function create(locale, opts) {
        if (opts === void 0) {
          opts = {};
        }
  
        return new Formatter(locale, opts);
      };
  
      Formatter.parseFormat = function parseFormat(fmt) {
        var current = null,
            currentFull = "",
            bracketed = false;
        var splits = [];
  
        for (var i = 0; i < fmt.length; i++) {
          var c = fmt.charAt(i);
  
          if (c === "'") {
            if (currentFull.length > 0) {
              splits.push({
                literal: bracketed,
                val: currentFull
              });
            }
  
            current = null;
            currentFull = "";
            bracketed = !bracketed;
          } else if (bracketed) {
            currentFull += c;
          } else if (c === current) {
            currentFull += c;
          } else {
            if (currentFull.length > 0) {
              splits.push({
                literal: false,
                val: currentFull
              });
            }
  
            currentFull = c;
            current = c;
          }
        }
  
        if (currentFull.length > 0) {
          splits.push({
            literal: bracketed,
            val: currentFull
          });
        }
  
        return splits;
      };
  
      Formatter.macroTokenToFormatOpts = function macroTokenToFormatOpts(token) {
        return _macroTokenToFormatOpts[token];
      };
  
      function Formatter(locale, formatOpts) {
        this.opts = formatOpts;
        this.loc = locale;
        this.systemLoc = null;
      }
  
      var _proto = Formatter.prototype;
  
      _proto.formatWithSystemDefault = function formatWithSystemDefault(dt, opts) {
        if (this.systemLoc === null) {
          this.systemLoc = this.loc.redefaultToSystem();
        }
  
        var df = this.systemLoc.dtFormatter(dt, _extends({}, this.opts, opts));
        return df.format();
      };
  
      _proto.formatDateTime = function formatDateTime(dt, opts) {
        if (opts === void 0) {
          opts = {};
        }
  
        var df = this.loc.dtFormatter(dt, _extends({}, this.opts, opts));
        return df.format();
      };
  
      _proto.formatDateTimeParts = function formatDateTimeParts(dt, opts) {
        if (opts === void 0) {
          opts = {};
        }
  
        var df = this.loc.dtFormatter(dt, _extends({}, this.opts, opts));
        return df.formatToParts();
      };
  
      _proto.resolvedOptions = function resolvedOptions(dt, opts) {
        if (opts === void 0) {
          opts = {};
        }
  
        var df = this.loc.dtFormatter(dt, _extends({}, this.opts, opts));
        return df.resolvedOptions();
      };
  
      _proto.num = function num(n, p) {
        if (p === void 0) {
          p = 0;
        }
  
        // we get some perf out of doing this here, annoyingly
        if (this.opts.forceSimple) {
          return padStart(n, p);
        }
  
        var opts = _extends({}, this.opts);
  
        if (p > 0) {
          opts.padTo = p;
        }
  
        return this.loc.numberFormatter(opts).format(n);
      };
  
      _proto.formatDateTimeFromString = function formatDateTimeFromString(dt, fmt) {
        var _this = this;
  
        var knownEnglish = this.loc.listingMode() === "en",
            useDateTimeFormatter = this.loc.outputCalendar && this.loc.outputCalendar !== "gregory",
            string = function string(opts, extract) {
          return _this.loc.extract(dt, opts, extract);
        },
            formatOffset = function formatOffset(opts) {
          if (dt.isOffsetFixed && dt.offset === 0 && opts.allowZ) {
            return "Z";
          }
  
          return dt.isValid ? dt.zone.formatOffset(dt.ts, opts.format) : "";
        },
            meridiem = function meridiem() {
          return knownEnglish ? meridiemForDateTime(dt) : string({
            hour: "numeric",
            hourCycle: "h12"
          }, "dayperiod");
        },
            month = function month(length, standalone) {
          return knownEnglish ? monthForDateTime(dt, length) : string(standalone ? {
            month: length
          } : {
            month: length,
            day: "numeric"
          }, "month");
        },
            weekday = function weekday(length, standalone) {
          return knownEnglish ? weekdayForDateTime(dt, length) : string(standalone ? {
            weekday: length
          } : {
            weekday: length,
            month: "long",
            day: "numeric"
          }, "weekday");
        },
            maybeMacro = function maybeMacro(token) {
          var formatOpts = Formatter.macroTokenToFormatOpts(token);
  
          if (formatOpts) {
            return _this.formatWithSystemDefault(dt, formatOpts);
          } else {
            return token;
          }
        },
            era = function era(length) {
          return knownEnglish ? eraForDateTime(dt, length) : string({
            era: length
          }, "era");
        },
            tokenToString = function tokenToString(token) {
          // Where possible: http://cldr.unicode.org/translation/date-time-1/date-time#TOC-Standalone-vs.-Format-Styles
          switch (token) {
            // ms
            case "S":
              return _this.num(dt.millisecond);
  
            case "u": // falls through
  
            case "SSS":
              return _this.num(dt.millisecond, 3);
            // seconds
  
            case "s":
              return _this.num(dt.second);
  
            case "ss":
              return _this.num(dt.second, 2);
            // fractional seconds
  
            case "uu":
              return _this.num(Math.floor(dt.millisecond / 10), 2);
  
            case "uuu":
              return _this.num(Math.floor(dt.millisecond / 100));
            // minutes
  
            case "m":
              return _this.num(dt.minute);
  
            case "mm":
              return _this.num(dt.minute, 2);
            // hours
  
            case "h":
              return _this.num(dt.hour % 12 === 0 ? 12 : dt.hour % 12);
  
            case "hh":
              return _this.num(dt.hour % 12 === 0 ? 12 : dt.hour % 12, 2);
  
            case "H":
              return _this.num(dt.hour);
  
            case "HH":
              return _this.num(dt.hour, 2);
            // offset
  
            case "Z":
              // like +6
              return formatOffset({
                format: "narrow",
                allowZ: _this.opts.allowZ
              });
  
            case "ZZ":
              // like +06:00
              return formatOffset({
                format: "short",
                allowZ: _this.opts.allowZ
              });
  
            case "ZZZ":
              // like +0600
              return formatOffset({
                format: "techie",
                allowZ: _this.opts.allowZ
              });
  
            case "ZZZZ":
              // like EST
              return dt.zone.offsetName(dt.ts, {
                format: "short",
                locale: _this.loc.locale
              });
  
            case "ZZZZZ":
              // like Eastern Standard Time
              return dt.zone.offsetName(dt.ts, {
                format: "long",
                locale: _this.loc.locale
              });
            // zone
  
            case "z":
              // like America/New_York
              return dt.zoneName;
            // meridiems
  
            case "a":
              return meridiem();
            // dates
  
            case "d":
              return useDateTimeFormatter ? string({
                day: "numeric"
              }, "day") : _this.num(dt.day);
  
            case "dd":
              return useDateTimeFormatter ? string({
                day: "2-digit"
              }, "day") : _this.num(dt.day, 2);
            // weekdays - standalone
  
            case "c":
              // like 1
              return _this.num(dt.weekday);
  
            case "ccc":
              // like 'Tues'
              return weekday("short", true);
  
            case "cccc":
              // like 'Tuesday'
              return weekday("long", true);
  
            case "ccccc":
              // like 'T'
              return weekday("narrow", true);
            // weekdays - format
  
            case "E":
              // like 1
              return _this.num(dt.weekday);
  
            case "EEE":
              // like 'Tues'
              return weekday("short", false);
  
            case "EEEE":
              // like 'Tuesday'
              return weekday("long", false);
  
            case "EEEEE":
              // like 'T'
              return weekday("narrow", false);
            // months - standalone
  
            case "L":
              // like 1
              return useDateTimeFormatter ? string({
                month: "numeric",
                day: "numeric"
              }, "month") : _this.num(dt.month);
  
            case "LL":
              // like 01, doesn't seem to work
              return useDateTimeFormatter ? string({
                month: "2-digit",
                day: "numeric"
              }, "month") : _this.num(dt.month, 2);
  
            case "LLL":
              // like Jan
              return month("short", true);
  
            case "LLLL":
              // like January
              return month("long", true);
  
            case "LLLLL":
              // like J
              return month("narrow", true);
            // months - format
  
            case "M":
              // like 1
              return useDateTimeFormatter ? string({
                month: "numeric"
              }, "month") : _this.num(dt.month);
  
            case "MM":
              // like 01
              return useDateTimeFormatter ? string({
                month: "2-digit"
              }, "month") : _this.num(dt.month, 2);
  
            case "MMM":
              // like Jan
              return month("short", false);
  
            case "MMMM":
              // like January
              return month("long", false);
  
            case "MMMMM":
              // like J
              return month("narrow", false);
            // years
  
            case "y":
              // like 2014
              return useDateTimeFormatter ? string({
                year: "numeric"
              }, "year") : _this.num(dt.year);
  
            case "yy":
              // like 14
              return useDateTimeFormatter ? string({
                year: "2-digit"
              }, "year") : _this.num(dt.year.toString().slice(-2), 2);
  
            case "yyyy":
              // like 0012
              return useDateTimeFormatter ? string({
                year: "numeric"
              }, "year") : _this.num(dt.year, 4);
  
            case "yyyyyy":
              // like 000012
              return useDateTimeFormatter ? string({
                year: "numeric"
              }, "year") : _this.num(dt.year, 6);
            // eras
  
            case "G":
              // like AD
              return era("short");
  
            case "GG":
              // like Anno Domini
              return era("long");
  
            case "GGGGG":
              return era("narrow");
  
            case "kk":
              return _this.num(dt.weekYear.toString().slice(-2), 2);
  
            case "kkkk":
              return _this.num(dt.weekYear, 4);
  
            case "W":
              return _this.num(dt.weekNumber);
  
            case "WW":
              return _this.num(dt.weekNumber, 2);
  
            case "o":
              return _this.num(dt.ordinal);
  
            case "ooo":
              return _this.num(dt.ordinal, 3);
  
            case "q":
              // like 1
              return _this.num(dt.quarter);
  
            case "qq":
              // like 01
              return _this.num(dt.quarter, 2);
  
            case "X":
              return _this.num(Math.floor(dt.ts / 1000));
  
            case "x":
              return _this.num(dt.ts);
  
            default:
              return maybeMacro(token);
          }
        };
  
        return stringifyTokens(Formatter.parseFormat(fmt), tokenToString);
      };
  
      _proto.formatDurationFromString = function formatDurationFromString(dur, fmt) {
        var _this2 = this;
  
        var tokenToField = function tokenToField(token) {
          switch (token[0]) {
            case "S":
              return "millisecond";
  
            case "s":
              return "second";
  
            case "m":
              return "minute";
  
            case "h":
              return "hour";
  
            case "d":
              return "day";
  
            case "w":
              return "week";
  
            case "M":
              return "month";
  
            case "y":
              return "year";
  
            default:
              return null;
          }
        },
            tokenToString = function tokenToString(lildur) {
          return function (token) {
            var mapped = tokenToField(token);
  
            if (mapped) {
              return _this2.num(lildur.get(mapped), token.length);
            } else {
              return token;
            }
          };
        },
            tokens = Formatter.parseFormat(fmt),
            realTokens = tokens.reduce(function (found, _ref) {
          var literal = _ref.literal,
              val = _ref.val;
          return literal ? found : found.concat(val);
        }, []),
            collapsed = dur.shiftTo.apply(dur, realTokens.map(tokenToField).filter(function (t) {
          return t;
        }));
  
        return stringifyTokens(tokens, tokenToString(collapsed));
      };
  
      return Formatter;
    }();
  
    var Invalid = /*#__PURE__*/function () {
      function Invalid(reason, explanation) {
        this.reason = reason;
        this.explanation = explanation;
      }
  
      var _proto = Invalid.prototype;
  
      _proto.toMessage = function toMessage() {
        if (this.explanation) {
          return this.reason + ": " + this.explanation;
        } else {
          return this.reason;
        }
      };
  
      return Invalid;
    }();
  
    /**
     * @interface
     */
  
    var Zone = /*#__PURE__*/function () {
      function Zone() {}
  
      var _proto = Zone.prototype;
  
      /**
       * Returns the offset's common name (such as EST) at the specified timestamp
       * @abstract
       * @param {number} ts - Epoch milliseconds for which to get the name
       * @param {Object} opts - Options to affect the format
       * @param {string} opts.format - What style of offset to return. Accepts 'long' or 'short'.
       * @param {string} opts.locale - What locale to return the offset name in.
       * @return {string}
       */
      _proto.offsetName = function offsetName(ts, opts) {
        throw new ZoneIsAbstractError();
      }
      /**
       * Returns the offset's value as a string
       * @abstract
       * @param {number} ts - Epoch milliseconds for which to get the offset
       * @param {string} format - What style of offset to return.
       *                          Accepts 'narrow', 'short', or 'techie'. Returning '+6', '+06:00', or '+0600' respectively
       * @return {string}
       */
      ;
  
      _proto.formatOffset = function formatOffset(ts, format) {
        throw new ZoneIsAbstractError();
      }
      /**
       * Return the offset in minutes for this zone at the specified timestamp.
       * @abstract
       * @param {number} ts - Epoch milliseconds for which to compute the offset
       * @return {number}
       */
      ;
  
      _proto.offset = function offset(ts) {
        throw new ZoneIsAbstractError();
      }
      /**
       * Return whether this Zone is equal to another zone
       * @abstract
       * @param {Zone} otherZone - the zone to compare
       * @return {boolean}
       */
      ;
  
      _proto.equals = function equals(otherZone) {
        throw new ZoneIsAbstractError();
      }
      /**
       * Return whether this Zone is valid.
       * @abstract
       * @type {boolean}
       */
      ;
  
      _createClass(Zone, [{
        key: "type",
        get:
        /**
         * The type of zone
         * @abstract
         * @type {string}
         */
        function get() {
          throw new ZoneIsAbstractError();
        }
        /**
         * The name of this zone.
         * @abstract
         * @type {string}
         */
  
      }, {
        key: "name",
        get: function get() {
          throw new ZoneIsAbstractError();
        }
        /**
         * Returns whether the offset is known to be fixed for the whole year.
         * @abstract
         * @type {boolean}
         */
  
      }, {
        key: "isUniversal",
        get: function get() {
          throw new ZoneIsAbstractError();
        }
      }, {
        key: "isValid",
        get: function get() {
          throw new ZoneIsAbstractError();
        }
      }]);
  
      return Zone;
    }();
  
    var singleton$1 = null;
    /**
     * Represents the local zone for this JavaScript environment.
     * @implements {Zone}
     */
  
    var SystemZone = /*#__PURE__*/function (_Zone) {
      _inheritsLoose(SystemZone, _Zone);
  
      function SystemZone() {
        return _Zone.apply(this, arguments) || this;
      }
  
      var _proto = SystemZone.prototype;
  
      /** @override **/
      _proto.offsetName = function offsetName(ts, _ref) {
        var format = _ref.format,
            locale = _ref.locale;
        return parseZoneInfo(ts, format, locale);
      }
      /** @override **/
      ;
  
      _proto.formatOffset = function formatOffset$1(ts, format) {
        return formatOffset(this.offset(ts), format);
      }
      /** @override **/
      ;
  
      _proto.offset = function offset(ts) {
        return -new Date(ts).getTimezoneOffset();
      }
      /** @override **/
      ;
  
      _proto.equals = function equals(otherZone) {
        return otherZone.type === "system";
      }
      /** @override **/
      ;
  
      _createClass(SystemZone, [{
        key: "type",
        get:
        /** @override **/
        function get() {
          return "system";
        }
        /** @override **/
  
      }, {
        key: "name",
        get: function get() {
          return new Intl.DateTimeFormat().resolvedOptions().timeZone;
        }
        /** @override **/
  
      }, {
        key: "isUniversal",
        get: function get() {
          return false;
        }
      }, {
        key: "isValid",
        get: function get() {
          return true;
        }
      }], [{
        key: "instance",
        get:
        /**
         * Get a singleton instance of the local zone
         * @return {SystemZone}
         */
        function get() {
          if (singleton$1 === null) {
            singleton$1 = new SystemZone();
          }
  
          return singleton$1;
        }
      }]);
  
      return SystemZone;
    }(Zone);
  
    var dtfCache = {};
  
    function makeDTF(zone) {
      if (!dtfCache[zone]) {
        dtfCache[zone] = new Intl.DateTimeFormat("en-US", {
          hour12: false,
          timeZone: zone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          era: "short"
        });
      }
  
      return dtfCache[zone];
    }
  
    var typeToPos = {
      year: 0,
      month: 1,
      day: 2,
      era: 3,
      hour: 4,
      minute: 5,
      second: 6
    };
  
    function hackyOffset(dtf, date) {
      var formatted = dtf.format(date).replace(/\u200E/g, ""),
          parsed = /(\d+)\/(\d+)\/(\d+) (AD|BC),? (\d+):(\d+):(\d+)/.exec(formatted),
          fMonth = parsed[1],
          fDay = parsed[2],
          fYear = parsed[3],
          fadOrBc = parsed[4],
          fHour = parsed[5],
          fMinute = parsed[6],
          fSecond = parsed[7];
      return [fYear, fMonth, fDay, fadOrBc, fHour, fMinute, fSecond];
    }
  
    function partsOffset(dtf, date) {
      var formatted = dtf.formatToParts(date);
      var filled = [];
  
      for (var i = 0; i < formatted.length; i++) {
        var _formatted$i = formatted[i],
            type = _formatted$i.type,
            value = _formatted$i.value;
        var pos = typeToPos[type];
  
        if (type === "era") {
          filled[pos] = value;
        } else if (!isUndefined(pos)) {
          filled[pos] = parseInt(value, 10);
        }
      }
  
      return filled;
    }
  
    var ianaZoneCache = {};
    /**
     * A zone identified by an IANA identifier, like America/New_York
     * @implements {Zone}
     */
  
    var IANAZone = /*#__PURE__*/function (_Zone) {
      _inheritsLoose(IANAZone, _Zone);
  
      /**
       * @param {string} name - Zone name
       * @return {IANAZone}
       */
      IANAZone.create = function create(name) {
        if (!ianaZoneCache[name]) {
          ianaZoneCache[name] = new IANAZone(name);
        }
  
        return ianaZoneCache[name];
      }
      /**
       * Reset local caches. Should only be necessary in testing scenarios.
       * @return {void}
       */
      ;
  
      IANAZone.resetCache = function resetCache() {
        ianaZoneCache = {};
        dtfCache = {};
      }
      /**
       * Returns whether the provided string is a valid specifier. This only checks the string's format, not that the specifier identifies a known zone; see isValidZone for that.
       * @param {string} s - The string to check validity on
       * @example IANAZone.isValidSpecifier("America/New_York") //=> true
       * @example IANAZone.isValidSpecifier("Sport~~blorp") //=> false
       * @deprecated This method returns false for some valid IANA names. Use isValidZone instead.
       * @return {boolean}
       */
      ;
  
      IANAZone.isValidSpecifier = function isValidSpecifier(s) {
        return this.isValidZone(s);
      }
      /**
       * Returns whether the provided string identifies a real zone
       * @param {string} zone - The string to check
       * @example IANAZone.isValidZone("America/New_York") //=> true
       * @example IANAZone.isValidZone("Fantasia/Castle") //=> false
       * @example IANAZone.isValidZone("Sport~~blorp") //=> false
       * @return {boolean}
       */
      ;
  
      IANAZone.isValidZone = function isValidZone(zone) {
        if (!zone) {
          return false;
        }
  
        try {
          new Intl.DateTimeFormat("en-US", {
            timeZone: zone
          }).format();
          return true;
        } catch (e) {
          return false;
        }
      };
  
      function IANAZone(name) {
        var _this;
  
        _this = _Zone.call(this) || this;
        /** @private **/
  
        _this.zoneName = name;
        /** @private **/
  
        _this.valid = IANAZone.isValidZone(name);
        return _this;
      }
      /** @override **/
  
  
      var _proto = IANAZone.prototype;
  
      /** @override **/
      _proto.offsetName = function offsetName(ts, _ref) {
        var format = _ref.format,
            locale = _ref.locale;
        return parseZoneInfo(ts, format, locale, this.name);
      }
      /** @override **/
      ;
  
      _proto.formatOffset = function formatOffset$1(ts, format) {
        return formatOffset(this.offset(ts), format);
      }
      /** @override **/
      ;
  
      _proto.offset = function offset(ts) {
        var date = new Date(ts);
        if (isNaN(date)) return NaN;
        var dtf = makeDTF(this.name);
  
        var _ref2 = dtf.formatToParts ? partsOffset(dtf, date) : hackyOffset(dtf, date),
            year = _ref2[0],
            month = _ref2[1],
            day = _ref2[2],
            adOrBc = _ref2[3],
            hour = _ref2[4],
            minute = _ref2[5],
            second = _ref2[6];
  
        if (adOrBc === "BC") {
          year = -Math.abs(year) + 1;
        } // because we're using hour12 and https://bugs.chromium.org/p/chromium/issues/detail?id=1025564&can=2&q=%2224%3A00%22%20datetimeformat
  
  
        var adjustedHour = hour === 24 ? 0 : hour;
        var asUTC = objToLocalTS({
          year: year,
          month: month,
          day: day,
          hour: adjustedHour,
          minute: minute,
          second: second,
          millisecond: 0
        });
        var asTS = +date;
        var over = asTS % 1000;
        asTS -= over >= 0 ? over : 1000 + over;
        return (asUTC - asTS) / (60 * 1000);
      }
      /** @override **/
      ;
  
      _proto.equals = function equals(otherZone) {
        return otherZone.type === "iana" && otherZone.name === this.name;
      }
      /** @override **/
      ;
  
      _createClass(IANAZone, [{
        key: "type",
        get: function get() {
          return "iana";
        }
        /** @override **/
  
      }, {
        key: "name",
        get: function get() {
          return this.zoneName;
        }
        /** @override **/
  
      }, {
        key: "isUniversal",
        get: function get() {
          return false;
        }
      }, {
        key: "isValid",
        get: function get() {
          return this.valid;
        }
      }]);
  
      return IANAZone;
    }(Zone);
  
    var singleton = null;
    /**
     * A zone with a fixed offset (meaning no DST)
     * @implements {Zone}
     */
  
    var FixedOffsetZone = /*#__PURE__*/function (_Zone) {
      _inheritsLoose(FixedOffsetZone, _Zone);
  
      /**
       * Get an instance with a specified offset
       * @param {number} offset - The offset in minutes
       * @return {FixedOffsetZone}
       */
      FixedOffsetZone.instance = function instance(offset) {
        return offset === 0 ? FixedOffsetZone.utcInstance : new FixedOffsetZone(offset);
      }
      /**
       * Get an instance of FixedOffsetZone from a UTC offset string, like "UTC+6"
       * @param {string} s - The offset string to parse
       * @example FixedOffsetZone.parseSpecifier("UTC+6")
       * @example FixedOffsetZone.parseSpecifier("UTC+06")
       * @example FixedOffsetZone.parseSpecifier("UTC-6:00")
       * @return {FixedOffsetZone}
       */
      ;
  
      FixedOffsetZone.parseSpecifier = function parseSpecifier(s) {
        if (s) {
          var r = s.match(/^utc(?:([+-]\d{1,2})(?::(\d{2}))?)?$/i);
  
          if (r) {
            return new FixedOffsetZone(signedOffset(r[1], r[2]));
          }
        }
  
        return null;
      };
  
      function FixedOffsetZone(offset) {
        var _this;
  
        _this = _Zone.call(this) || this;
        /** @private **/
  
        _this.fixed = offset;
        return _this;
      }
      /** @override **/
  
  
      var _proto = FixedOffsetZone.prototype;
  
      /** @override **/
      _proto.offsetName = function offsetName() {
        return this.name;
      }
      /** @override **/
      ;
  
      _proto.formatOffset = function formatOffset$1(ts, format) {
        return formatOffset(this.fixed, format);
      }
      /** @override **/
      ;
  
      /** @override **/
      _proto.offset = function offset() {
        return this.fixed;
      }
      /** @override **/
      ;
  
      _proto.equals = function equals(otherZone) {
        return otherZone.type === "fixed" && otherZone.fixed === this.fixed;
      }
      /** @override **/
      ;
  
      _createClass(FixedOffsetZone, [{
        key: "type",
        get: function get() {
          return "fixed";
        }
        /** @override **/
  
      }, {
        key: "name",
        get: function get() {
          return this.fixed === 0 ? "UTC" : "UTC" + formatOffset(this.fixed, "narrow");
        }
      }, {
        key: "isUniversal",
        get: function get() {
          return true;
        }
      }, {
        key: "isValid",
        get: function get() {
          return true;
        }
      }], [{
        key: "utcInstance",
        get:
        /**
         * Get a singleton instance of UTC
         * @return {FixedOffsetZone}
         */
        function get() {
          if (singleton === null) {
            singleton = new FixedOffsetZone(0);
          }
  
          return singleton;
        }
      }]);
  
      return FixedOffsetZone;
    }(Zone);
  
    /**
     * A zone that failed to parse. You should never need to instantiate this.
     * @implements {Zone}
     */
  
    var InvalidZone = /*#__PURE__*/function (_Zone) {
      _inheritsLoose(InvalidZone, _Zone);
  
      function InvalidZone(zoneName) {
        var _this;
  
        _this = _Zone.call(this) || this;
        /**  @private */
  
        _this.zoneName = zoneName;
        return _this;
      }
      /** @override **/
  
  
      var _proto = InvalidZone.prototype;
  
      /** @override **/
      _proto.offsetName = function offsetName() {
        return null;
      }
      /** @override **/
      ;
  
      _proto.formatOffset = function formatOffset() {
        return "";
      }
      /** @override **/
      ;
  
      _proto.offset = function offset() {
        return NaN;
      }
      /** @override **/
      ;
  
      _proto.equals = function equals() {
        return false;
      }
      /** @override **/
      ;
  
      _createClass(InvalidZone, [{
        key: "type",
        get: function get() {
          return "invalid";
        }
        /** @override **/
  
      }, {
        key: "name",
        get: function get() {
          return this.zoneName;
        }
        /** @override **/
  
      }, {
        key: "isUniversal",
        get: function get() {
          return false;
        }
      }, {
        key: "isValid",
        get: function get() {
          return false;
        }
      }]);
  
      return InvalidZone;
    }(Zone);
  
    /**
     * @private
     */
    function normalizeZone(input, defaultZone) {
  
      if (isUndefined(input) || input === null) {
        return defaultZone;
      } else if (input instanceof Zone) {
        return input;
      } else if (isString(input)) {
        var lowered = input.toLowerCase();
        if (lowered === "local" || lowered === "system") return defaultZone;else if (lowered === "utc" || lowered === "gmt") return FixedOffsetZone.utcInstance;else return FixedOffsetZone.parseSpecifier(lowered) || IANAZone.create(input);
      } else if (isNumber(input)) {
        return FixedOffsetZone.instance(input);
      } else if (typeof input === "object" && input.offset && typeof input.offset === "number") {
        // This is dumb, but the instanceof check above doesn't seem to really work
        // so we're duck checking it
        return input;
      } else {
        return new InvalidZone(input);
      }
    }
  
    var now = function now() {
      return Date.now();
    },
        defaultZone = "system",
        defaultLocale = null,
        defaultNumberingSystem = null,
        defaultOutputCalendar = null,
        throwOnInvalid;
    /**
     * Settings contains static getters and setters that control Luxon's overall behavior. Luxon is a simple library with few options, but the ones it does have live here.
     */
  
  
    var Settings = /*#__PURE__*/function () {
      function Settings() {}
  
      /**
       * Reset Luxon's global caches. Should only be necessary in testing scenarios.
       * @return {void}
       */
      Settings.resetCaches = function resetCaches() {
        Locale.resetCache();
        IANAZone.resetCache();
      };
  
      _createClass(Settings, null, [{
        key: "now",
        get:
        /**
         * Get the callback for returning the current timestamp.
         * @type {function}
         */
        function get() {
          return now;
        }
        /**
         * Set the callback for returning the current timestamp.
         * The function should return a number, which will be interpreted as an Epoch millisecond count
         * @type {function}
         * @example Settings.now = () => Date.now() + 3000 // pretend it is 3 seconds in the future
         * @example Settings.now = () => 0 // always pretend it's Jan 1, 1970 at midnight in UTC time
         */
        ,
        set: function set(n) {
          now = n;
        }
        /**
         * Set the default time zone to create DateTimes in. Does not affect existing instances.
         * Use the value "system" to reset this value to the system's time zone.
         * @type {string}
         */
  
      }, {
        key: "defaultZone",
        get:
        /**
         * Get the default time zone object currently used to create DateTimes. Does not affect existing instances.
         * The default value is the system's time zone (the one set on the machine that runs this code).
         * @type {Zone}
         */
        function get() {
          return normalizeZone(defaultZone, SystemZone.instance);
        }
        /**
         * Get the default locale to create DateTimes with. Does not affect existing instances.
         * @type {string}
         */
        ,
        set: function set(zone) {
          defaultZone = zone;
        }
      }, {
        key: "defaultLocale",
        get: function get() {
          return defaultLocale;
        }
        /**
         * Set the default locale to create DateTimes with. Does not affect existing instances.
         * @type {string}
         */
        ,
        set: function set(locale) {
          defaultLocale = locale;
        }
        /**
         * Get the default numbering system to create DateTimes with. Does not affect existing instances.
         * @type {string}
         */
  
      }, {
        key: "defaultNumberingSystem",
        get: function get() {
          return defaultNumberingSystem;
        }
        /**
         * Set the default numbering system to create DateTimes with. Does not affect existing instances.
         * @type {string}
         */
        ,
        set: function set(numberingSystem) {
          defaultNumberingSystem = numberingSystem;
        }
        /**
         * Get the default output calendar to create DateTimes with. Does not affect existing instances.
         * @type {string}
         */
  
      }, {
        key: "defaultOutputCalendar",
        get: function get() {
          return defaultOutputCalendar;
        }
        /**
         * Set the default output calendar to create DateTimes with. Does not affect existing instances.
         * @type {string}
         */
        ,
        set: function set(outputCalendar) {
          defaultOutputCalendar = outputCalendar;
        }
        /**
         * Get whether Luxon will throw when it encounters invalid DateTimes, Durations, or Intervals
         * @type {boolean}
         */
  
      }, {
        key: "throwOnInvalid",
        get: function get() {
          return throwOnInvalid;
        }
        /**
         * Set whether Luxon will throw when it encounters invalid DateTimes, Durations, or Intervals
         * @type {boolean}
         */
        ,
        set: function set(t) {
          throwOnInvalid = t;
        }
      }]);
  
      return Settings;
    }();
  
    var _excluded = ["base"],
        _excluded2 = ["padTo", "floor"];
  
    var intlLFCache = {};
  
    function getCachedLF(locString, opts) {
      if (opts === void 0) {
        opts = {};
      }
  
      var key = JSON.stringify([locString, opts]);
      var dtf = intlLFCache[key];
  
      if (!dtf) {
        dtf = new Intl.ListFormat(locString, opts);
        intlLFCache[key] = dtf;
      }
  
      return dtf;
    }
  
    var intlDTCache = {};
  
    function getCachedDTF(locString, opts) {
      if (opts === void 0) {
        opts = {};
      }
  
      var key = JSON.stringify([locString, opts]);
      var dtf = intlDTCache[key];
  
      if (!dtf) {
        dtf = new Intl.DateTimeFormat(locString, opts);
        intlDTCache[key] = dtf;
      }
  
      return dtf;
    }
  
    var intlNumCache = {};
  
    function getCachedINF(locString, opts) {
      if (opts === void 0) {
        opts = {};
      }
  
      var key = JSON.stringify([locString, opts]);
      var inf = intlNumCache[key];
  
      if (!inf) {
        inf = new Intl.NumberFormat(locString, opts);
        intlNumCache[key] = inf;
      }
  
      return inf;
    }
  
    var intlRelCache = {};
  
    function getCachedRTF(locString, opts) {
      if (opts === void 0) {
        opts = {};
      }
  
      var _opts = opts;
          _opts.base;
          var cacheKeyOpts = _objectWithoutPropertiesLoose(_opts, _excluded); // exclude `base` from the options
  
  
      var key = JSON.stringify([locString, cacheKeyOpts]);
      var inf = intlRelCache[key];
  
      if (!inf) {
        inf = new Intl.RelativeTimeFormat(locString, opts);
        intlRelCache[key] = inf;
      }
  
      return inf;
    }
  
    var sysLocaleCache = null;
  
    function systemLocale() {
      if (sysLocaleCache) {
        return sysLocaleCache;
      } else {
        sysLocaleCache = new Intl.DateTimeFormat().resolvedOptions().locale;
        return sysLocaleCache;
      }
    }
  
    function parseLocaleString(localeStr) {
      // I really want to avoid writing a BCP 47 parser
      // see, e.g. https://github.com/wooorm/bcp-47
      // Instead, we'll do this:
      // a) if the string has no -u extensions, just leave it alone
      // b) if it does, use Intl to resolve everything
      // c) if Intl fails, try again without the -u
      var uIndex = localeStr.indexOf("-u-");
  
      if (uIndex === -1) {
        return [localeStr];
      } else {
        var options;
        var smaller = localeStr.substring(0, uIndex);
  
        try {
          options = getCachedDTF(localeStr).resolvedOptions();
        } catch (e) {
          options = getCachedDTF(smaller).resolvedOptions();
        }
  
        var _options = options,
            numberingSystem = _options.numberingSystem,
            calendar = _options.calendar; // return the smaller one so that we can append the calendar and numbering overrides to it
  
        return [smaller, numberingSystem, calendar];
      }
    }
  
    function intlConfigString(localeStr, numberingSystem, outputCalendar) {
      if (outputCalendar || numberingSystem) {
        localeStr += "-u";
  
        if (outputCalendar) {
          localeStr += "-ca-" + outputCalendar;
        }
  
        if (numberingSystem) {
          localeStr += "-nu-" + numberingSystem;
        }
  
        return localeStr;
      } else {
        return localeStr;
      }
    }
  
    function mapMonths(f) {
      var ms = [];
  
      for (var i = 1; i <= 12; i++) {
        var dt = DateTime.utc(2016, i, 1);
        ms.push(f(dt));
      }
  
      return ms;
    }
  
    function mapWeekdays(f) {
      var ms = [];
  
      for (var i = 1; i <= 7; i++) {
        var dt = DateTime.utc(2016, 11, 13 + i);
        ms.push(f(dt));
      }
  
      return ms;
    }
  
    function listStuff(loc, length, defaultOK, englishFn, intlFn) {
      var mode = loc.listingMode(defaultOK);
  
      if (mode === "error") {
        return null;
      } else if (mode === "en") {
        return englishFn(length);
      } else {
        return intlFn(length);
      }
    }
  
    function supportsFastNumbers(loc) {
      if (loc.numberingSystem && loc.numberingSystem !== "latn") {
        return false;
      } else {
        return loc.numberingSystem === "latn" || !loc.locale || loc.locale.startsWith("en") || new Intl.DateTimeFormat(loc.intl).resolvedOptions().numberingSystem === "latn";
      }
    }
    /**
     * @private
     */
  
  
    var PolyNumberFormatter = /*#__PURE__*/function () {
      function PolyNumberFormatter(intl, forceSimple, opts) {
        this.padTo = opts.padTo || 0;
        this.floor = opts.floor || false;
  
        opts.padTo;
            opts.floor;
            var otherOpts = _objectWithoutPropertiesLoose(opts, _excluded2);
  
        if (!forceSimple || Object.keys(otherOpts).length > 0) {
          var intlOpts = _extends({
            useGrouping: false
          }, opts);
  
          if (opts.padTo > 0) intlOpts.minimumIntegerDigits = opts.padTo;
          this.inf = getCachedINF(intl, intlOpts);
        }
      }
  
      var _proto = PolyNumberFormatter.prototype;
  
      _proto.format = function format(i) {
        if (this.inf) {
          var fixed = this.floor ? Math.floor(i) : i;
          return this.inf.format(fixed);
        } else {
          // to match the browser's numberformatter defaults
          var _fixed = this.floor ? Math.floor(i) : roundTo(i, 3);
  
          return padStart(_fixed, this.padTo);
        }
      };
  
      return PolyNumberFormatter;
    }();
    /**
     * @private
     */
  
  
    var PolyDateFormatter = /*#__PURE__*/function () {
      function PolyDateFormatter(dt, intl, opts) {
        this.opts = opts;
        var z;
  
        if (dt.zone.isUniversal) {
          // UTC-8 or Etc/UTC-8 are not part of tzdata, only Etc/GMT+8 and the like.
          // That is why fixed-offset TZ is set to that unless it is:
          // 1. Representing offset 0 when UTC is used to maintain previous behavior and does not become GMT.
          // 2. Unsupported by the browser:
          //    - some do not support Etc/
          //    - < Etc/GMT-14, > Etc/GMT+12, and 30-minute or 45-minute offsets are not part of tzdata
          var gmtOffset = -1 * (dt.offset / 60);
          var offsetZ = gmtOffset >= 0 ? "Etc/GMT+" + gmtOffset : "Etc/GMT" + gmtOffset;
  
          if (dt.offset !== 0 && IANAZone.create(offsetZ).valid) {
            z = offsetZ;
            this.dt = dt;
          } else {
            // Not all fixed-offset zones like Etc/+4:30 are present in tzdata.
            // So we have to make do. Two cases:
            // 1. The format options tell us to show the zone. We can't do that, so the best
            // we can do is format the date in UTC.
            // 2. The format options don't tell us to show the zone. Then we can adjust them
            // the time and tell the formatter to show it to us in UTC, so that the time is right
            // and the bad zone doesn't show up.
            z = "UTC";
  
            if (opts.timeZoneName) {
              this.dt = dt;
            } else {
              this.dt = dt.offset === 0 ? dt : DateTime.fromMillis(dt.ts + dt.offset * 60 * 1000);
            }
          }
        } else if (dt.zone.type === "system") {
          this.dt = dt;
        } else {
          this.dt = dt;
          z = dt.zone.name;
        }
  
        var intlOpts = _extends({}, this.opts);
  
        if (z) {
          intlOpts.timeZone = z;
        }
  
        this.dtf = getCachedDTF(intl, intlOpts);
      }
  
      var _proto2 = PolyDateFormatter.prototype;
  
      _proto2.format = function format() {
        return this.dtf.format(this.dt.toJSDate());
      };
  
      _proto2.formatToParts = function formatToParts() {
        return this.dtf.formatToParts(this.dt.toJSDate());
      };
  
      _proto2.resolvedOptions = function resolvedOptions() {
        return this.dtf.resolvedOptions();
      };
  
      return PolyDateFormatter;
    }();
    /**
     * @private
     */
  
  
    var PolyRelFormatter = /*#__PURE__*/function () {
      function PolyRelFormatter(intl, isEnglish, opts) {
        this.opts = _extends({
          style: "long"
        }, opts);
  
        if (!isEnglish && hasRelative()) {
          this.rtf = getCachedRTF(intl, opts);
        }
      }
  
      var _proto3 = PolyRelFormatter.prototype;
  
      _proto3.format = function format(count, unit) {
        if (this.rtf) {
          return this.rtf.format(count, unit);
        } else {
          return formatRelativeTime(unit, count, this.opts.numeric, this.opts.style !== "long");
        }
      };
  
      _proto3.formatToParts = function formatToParts(count, unit) {
        if (this.rtf) {
          return this.rtf.formatToParts(count, unit);
        } else {
          return [];
        }
      };
  
      return PolyRelFormatter;
    }();
    /**
     * @private
     */
  
  
    var Locale = /*#__PURE__*/function () {
      Locale.fromOpts = function fromOpts(opts) {
        return Locale.create(opts.locale, opts.numberingSystem, opts.outputCalendar, opts.defaultToEN);
      };
  
      Locale.create = function create(locale, numberingSystem, outputCalendar, defaultToEN) {
        if (defaultToEN === void 0) {
          defaultToEN = false;
        }
  
        var specifiedLocale = locale || Settings.defaultLocale; // the system locale is useful for human readable strings but annoying for parsing/formatting known formats
  
        var localeR = specifiedLocale || (defaultToEN ? "en-US" : systemLocale());
        var numberingSystemR = numberingSystem || Settings.defaultNumberingSystem;
        var outputCalendarR = outputCalendar || Settings.defaultOutputCalendar;
        return new Locale(localeR, numberingSystemR, outputCalendarR, specifiedLocale);
      };
  
      Locale.resetCache = function resetCache() {
        sysLocaleCache = null;
        intlDTCache = {};
        intlNumCache = {};
        intlRelCache = {};
      };
  
      Locale.fromObject = function fromObject(_temp) {
        var _ref = _temp === void 0 ? {} : _temp,
            locale = _ref.locale,
            numberingSystem = _ref.numberingSystem,
            outputCalendar = _ref.outputCalendar;
  
        return Locale.create(locale, numberingSystem, outputCalendar);
      };
  
      function Locale(locale, numbering, outputCalendar, specifiedLocale) {
        var _parseLocaleString = parseLocaleString(locale),
            parsedLocale = _parseLocaleString[0],
            parsedNumberingSystem = _parseLocaleString[1],
            parsedOutputCalendar = _parseLocaleString[2];
  
        this.locale = parsedLocale;
        this.numberingSystem = numbering || parsedNumberingSystem || null;
        this.outputCalendar = outputCalendar || parsedOutputCalendar || null;
        this.intl = intlConfigString(this.locale, this.numberingSystem, this.outputCalendar);
        this.weekdaysCache = {
          format: {},
          standalone: {}
        };
        this.monthsCache = {
          format: {},
          standalone: {}
        };
        this.meridiemCache = null;
        this.eraCache = {};
        this.specifiedLocale = specifiedLocale;
        this.fastNumbersCached = null;
      }
  
      var _proto4 = Locale.prototype;
  
      _proto4.listingMode = function listingMode() {
        var isActuallyEn = this.isEnglish();
        var hasNoWeirdness = (this.numberingSystem === null || this.numberingSystem === "latn") && (this.outputCalendar === null || this.outputCalendar === "gregory");
        return isActuallyEn && hasNoWeirdness ? "en" : "intl";
      };
  
      _proto4.clone = function clone(alts) {
        if (!alts || Object.getOwnPropertyNames(alts).length === 0) {
          return this;
        } else {
          return Locale.create(alts.locale || this.specifiedLocale, alts.numberingSystem || this.numberingSystem, alts.outputCalendar || this.outputCalendar, alts.defaultToEN || false);
        }
      };
  
      _proto4.redefaultToEN = function redefaultToEN(alts) {
        if (alts === void 0) {
          alts = {};
        }
  
        return this.clone(_extends({}, alts, {
          defaultToEN: true
        }));
      };
  
      _proto4.redefaultToSystem = function redefaultToSystem(alts) {
        if (alts === void 0) {
          alts = {};
        }
  
        return this.clone(_extends({}, alts, {
          defaultToEN: false
        }));
      };
  
      _proto4.months = function months$1(length, format, defaultOK) {
        var _this = this;
  
        if (format === void 0) {
          format = false;
        }
  
        if (defaultOK === void 0) {
          defaultOK = true;
        }
  
        return listStuff(this, length, defaultOK, months, function () {
          var intl = format ? {
            month: length,
            day: "numeric"
          } : {
            month: length
          },
              formatStr = format ? "format" : "standalone";
  
          if (!_this.monthsCache[formatStr][length]) {
            _this.monthsCache[formatStr][length] = mapMonths(function (dt) {
              return _this.extract(dt, intl, "month");
            });
          }
  
          return _this.monthsCache[formatStr][length];
        });
      };
  
      _proto4.weekdays = function weekdays$1(length, format, defaultOK) {
        var _this2 = this;
  
        if (format === void 0) {
          format = false;
        }
  
        if (defaultOK === void 0) {
          defaultOK = true;
        }
  
        return listStuff(this, length, defaultOK, weekdays, function () {
          var intl = format ? {
            weekday: length,
            year: "numeric",
            month: "long",
            day: "numeric"
          } : {
            weekday: length
          },
              formatStr = format ? "format" : "standalone";
  
          if (!_this2.weekdaysCache[formatStr][length]) {
            _this2.weekdaysCache[formatStr][length] = mapWeekdays(function (dt) {
              return _this2.extract(dt, intl, "weekday");
            });
          }
  
          return _this2.weekdaysCache[formatStr][length];
        });
      };
  
      _proto4.meridiems = function meridiems$1(defaultOK) {
        var _this3 = this;
  
        if (defaultOK === void 0) {
          defaultOK = true;
        }
  
        return listStuff(this, undefined, defaultOK, function () {
          return meridiems;
        }, function () {
          // In theory there could be aribitrary day periods. We're gonna assume there are exactly two
          // for AM and PM. This is probably wrong, but it's makes parsing way easier.
          if (!_this3.meridiemCache) {
            var intl = {
              hour: "numeric",
              hourCycle: "h12"
            };
            _this3.meridiemCache = [DateTime.utc(2016, 11, 13, 9), DateTime.utc(2016, 11, 13, 19)].map(function (dt) {
              return _this3.extract(dt, intl, "dayperiod");
            });
          }
  
          return _this3.meridiemCache;
        });
      };
  
      _proto4.eras = function eras$1(length, defaultOK) {
        var _this4 = this;
  
        if (defaultOK === void 0) {
          defaultOK = true;
        }
  
        return listStuff(this, length, defaultOK, eras, function () {
          var intl = {
            era: length
          }; // This is problematic. Different calendars are going to define eras totally differently. What I need is the minimum set of dates
          // to definitely enumerate them.
  
          if (!_this4.eraCache[length]) {
            _this4.eraCache[length] = [DateTime.utc(-40, 1, 1), DateTime.utc(2017, 1, 1)].map(function (dt) {
              return _this4.extract(dt, intl, "era");
            });
          }
  
          return _this4.eraCache[length];
        });
      };
  
      _proto4.extract = function extract(dt, intlOpts, field) {
        var df = this.dtFormatter(dt, intlOpts),
            results = df.formatToParts(),
            matching = results.find(function (m) {
          return m.type.toLowerCase() === field;
        });
        return matching ? matching.value : null;
      };
  
      _proto4.numberFormatter = function numberFormatter(opts) {
        if (opts === void 0) {
          opts = {};
        }
  
        // this forcesimple option is never used (the only caller short-circuits on it, but it seems safer to leave)
        // (in contrast, the rest of the condition is used heavily)
        return new PolyNumberFormatter(this.intl, opts.forceSimple || this.fastNumbers, opts);
      };
  
      _proto4.dtFormatter = function dtFormatter(dt, intlOpts) {
        if (intlOpts === void 0) {
          intlOpts = {};
        }
  
        return new PolyDateFormatter(dt, this.intl, intlOpts);
      };
  
      _proto4.relFormatter = function relFormatter(opts) {
        if (opts === void 0) {
          opts = {};
        }
  
        return new PolyRelFormatter(this.intl, this.isEnglish(), opts);
      };
  
      _proto4.listFormatter = function listFormatter(opts) {
        if (opts === void 0) {
          opts = {};
        }
  
        return getCachedLF(this.intl, opts);
      };
  
      _proto4.isEnglish = function isEnglish() {
        return this.locale === "en" || this.locale.toLowerCase() === "en-us" || new Intl.DateTimeFormat(this.intl).resolvedOptions().locale.startsWith("en-us");
      };
  
      _proto4.equals = function equals(other) {
        return this.locale === other.locale && this.numberingSystem === other.numberingSystem && this.outputCalendar === other.outputCalendar;
      };
  
      _createClass(Locale, [{
        key: "fastNumbers",
        get: function get() {
          if (this.fastNumbersCached == null) {
            this.fastNumbersCached = supportsFastNumbers(this);
          }
  
          return this.fastNumbersCached;
        }
      }]);
  
      return Locale;
    }();
  
    /*
     * This file handles parsing for well-specified formats. Here's how it works:
     * Two things go into parsing: a regex to match with and an extractor to take apart the groups in the match.
     * An extractor is just a function that takes a regex match array and returns a { year: ..., month: ... } object
     * parse() does the work of executing the regex and applying the extractor. It takes multiple regex/extractor pairs to try in sequence.
     * Extractors can take a "cursor" representing the offset in the match to look at. This makes it easy to combine extractors.
     * combineExtractors() does the work of combining them, keeping track of the cursor through multiple extractions.
     * Some extractions are super dumb and simpleParse and fromStrings help DRY them.
     */
  
    function combineRegexes() {
      for (var _len = arguments.length, regexes = new Array(_len), _key = 0; _key < _len; _key++) {
        regexes[_key] = arguments[_key];
      }
  
      var full = regexes.reduce(function (f, r) {
        return f + r.source;
      }, "");
      return RegExp("^" + full + "$");
    }
  
    function combineExtractors() {
      for (var _len2 = arguments.length, extractors = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        extractors[_key2] = arguments[_key2];
      }
  
      return function (m) {
        return extractors.reduce(function (_ref, ex) {
          var mergedVals = _ref[0],
              mergedZone = _ref[1],
              cursor = _ref[2];
  
          var _ex = ex(m, cursor),
              val = _ex[0],
              zone = _ex[1],
              next = _ex[2];
  
          return [_extends({}, mergedVals, val), mergedZone || zone, next];
        }, [{}, null, 1]).slice(0, 2);
      };
    }
  
    function parse(s) {
      if (s == null) {
        return [null, null];
      }
  
      for (var _len3 = arguments.length, patterns = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
        patterns[_key3 - 1] = arguments[_key3];
      }
  
      for (var _i = 0, _patterns = patterns; _i < _patterns.length; _i++) {
        var _patterns$_i = _patterns[_i],
            regex = _patterns$_i[0],
            extractor = _patterns$_i[1];
        var m = regex.exec(s);
  
        if (m) {
          return extractor(m);
        }
      }
  
      return [null, null];
    }
  
    function simpleParse() {
      for (var _len4 = arguments.length, keys = new Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
        keys[_key4] = arguments[_key4];
      }
  
      return function (match, cursor) {
        var ret = {};
        var i;
  
        for (i = 0; i < keys.length; i++) {
          ret[keys[i]] = parseInteger(match[cursor + i]);
        }
  
        return [ret, null, cursor + i];
      };
    } // ISO and SQL parsing
  
  
    var offsetRegex = /(?:(Z)|([+-]\d\d)(?::?(\d\d))?)/,
        isoTimeBaseRegex = /(\d\d)(?::?(\d\d)(?::?(\d\d)(?:[.,](\d{1,30}))?)?)?/,
        isoTimeRegex = RegExp("" + isoTimeBaseRegex.source + offsetRegex.source + "?"),
        isoTimeExtensionRegex = RegExp("(?:T" + isoTimeRegex.source + ")?"),
        isoYmdRegex = /([+-]\d{6}|\d{4})(?:-?(\d\d)(?:-?(\d\d))?)?/,
        isoWeekRegex = /(\d{4})-?W(\d\d)(?:-?(\d))?/,
        isoOrdinalRegex = /(\d{4})-?(\d{3})/,
        extractISOWeekData = simpleParse("weekYear", "weekNumber", "weekDay"),
        extractISOOrdinalData = simpleParse("year", "ordinal"),
        sqlYmdRegex = /(\d{4})-(\d\d)-(\d\d)/,
        // dumbed-down version of the ISO one
    sqlTimeRegex = RegExp(isoTimeBaseRegex.source + " ?(?:" + offsetRegex.source + "|(" + ianaRegex.source + "))?"),
        sqlTimeExtensionRegex = RegExp("(?: " + sqlTimeRegex.source + ")?");
  
    function int(match, pos, fallback) {
      var m = match[pos];
      return isUndefined(m) ? fallback : parseInteger(m);
    }
  
    function extractISOYmd(match, cursor) {
      var item = {
        year: int(match, cursor),
        month: int(match, cursor + 1, 1),
        day: int(match, cursor + 2, 1)
      };
      return [item, null, cursor + 3];
    }
  
    function extractISOTime(match, cursor) {
      var item = {
        hours: int(match, cursor, 0),
        minutes: int(match, cursor + 1, 0),
        seconds: int(match, cursor + 2, 0),
        milliseconds: parseMillis(match[cursor + 3])
      };
      return [item, null, cursor + 4];
    }
  
    function extractISOOffset(match, cursor) {
      var local = !match[cursor] && !match[cursor + 1],
          fullOffset = signedOffset(match[cursor + 1], match[cursor + 2]),
          zone = local ? null : FixedOffsetZone.instance(fullOffset);
      return [{}, zone, cursor + 3];
    }
  
    function extractIANAZone(match, cursor) {
      var zone = match[cursor] ? IANAZone.create(match[cursor]) : null;
      return [{}, zone, cursor + 1];
    } // ISO time parsing
  
  
    var isoTimeOnly = RegExp("^T?" + isoTimeBaseRegex.source + "$"); // ISO duration parsing
  
    var isoDuration = /^-?P(?:(?:(-?\d{1,9}(?:\.\d{1,9})?)Y)?(?:(-?\d{1,9}(?:\.\d{1,9})?)M)?(?:(-?\d{1,9}(?:\.\d{1,9})?)W)?(?:(-?\d{1,9}(?:\.\d{1,9})?)D)?(?:T(?:(-?\d{1,9}(?:\.\d{1,9})?)H)?(?:(-?\d{1,9}(?:\.\d{1,9})?)M)?(?:(-?\d{1,20})(?:[.,](-?\d{1,9}))?S)?)?)$/;
  
    function extractISODuration(match) {
      var s = match[0],
          yearStr = match[1],
          monthStr = match[2],
          weekStr = match[3],
          dayStr = match[4],
          hourStr = match[5],
          minuteStr = match[6],
          secondStr = match[7],
          millisecondsStr = match[8];
      var hasNegativePrefix = s[0] === "-";
      var negativeSeconds = secondStr && secondStr[0] === "-";
  
      var maybeNegate = function maybeNegate(num, force) {
        if (force === void 0) {
          force = false;
        }
  
        return num !== undefined && (force || num && hasNegativePrefix) ? -num : num;
      };
  
      return [{
        years: maybeNegate(parseFloating(yearStr)),
        months: maybeNegate(parseFloating(monthStr)),
        weeks: maybeNegate(parseFloating(weekStr)),
        days: maybeNegate(parseFloating(dayStr)),
        hours: maybeNegate(parseFloating(hourStr)),
        minutes: maybeNegate(parseFloating(minuteStr)),
        seconds: maybeNegate(parseFloating(secondStr), secondStr === "-0"),
        milliseconds: maybeNegate(parseMillis(millisecondsStr), negativeSeconds)
      }];
    } // These are a little braindead. EDT *should* tell us that we're in, say, America/New_York
    // and not just that we're in -240 *right now*. But since I don't think these are used that often
    // I'm just going to ignore that
  
  
    var obsOffsets = {
      GMT: 0,
      EDT: -4 * 60,
      EST: -5 * 60,
      CDT: -5 * 60,
      CST: -6 * 60,
      MDT: -6 * 60,
      MST: -7 * 60,
      PDT: -7 * 60,
      PST: -8 * 60
    };
  
    function fromStrings(weekdayStr, yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr) {
      var result = {
        year: yearStr.length === 2 ? untruncateYear(parseInteger(yearStr)) : parseInteger(yearStr),
        month: monthsShort.indexOf(monthStr) + 1,
        day: parseInteger(dayStr),
        hour: parseInteger(hourStr),
        minute: parseInteger(minuteStr)
      };
      if (secondStr) result.second = parseInteger(secondStr);
  
      if (weekdayStr) {
        result.weekday = weekdayStr.length > 3 ? weekdaysLong.indexOf(weekdayStr) + 1 : weekdaysShort.indexOf(weekdayStr) + 1;
      }
  
      return result;
    } // RFC 2822/5322
  
  
    var rfc2822 = /^(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s)?(\d{1,2})\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s(\d{2,4})\s(\d\d):(\d\d)(?::(\d\d))?\s(?:(UT|GMT|[ECMP][SD]T)|([Zz])|(?:([+-]\d\d)(\d\d)))$/;
  
    function extractRFC2822(match) {
      var weekdayStr = match[1],
          dayStr = match[2],
          monthStr = match[3],
          yearStr = match[4],
          hourStr = match[5],
          minuteStr = match[6],
          secondStr = match[7],
          obsOffset = match[8],
          milOffset = match[9],
          offHourStr = match[10],
          offMinuteStr = match[11],
          result = fromStrings(weekdayStr, yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr);
      var offset;
  
      if (obsOffset) {
        offset = obsOffsets[obsOffset];
      } else if (milOffset) {
        offset = 0;
      } else {
        offset = signedOffset(offHourStr, offMinuteStr);
      }
  
      return [result, new FixedOffsetZone(offset)];
    }
  
    function preprocessRFC2822(s) {
      // Remove comments and folding whitespace and replace multiple-spaces with a single space
      return s.replace(/\([^)]*\)|[\n\t]/g, " ").replace(/(\s\s+)/g, " ").trim();
    } // http date
  
  
    var rfc1123 = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), (\d\d) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d\d):(\d\d):(\d\d) GMT$/,
        rfc850 = /^(Monday|Tuesday|Wedsday|Thursday|Friday|Saturday|Sunday), (\d\d)-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d\d) (\d\d):(\d\d):(\d\d) GMT$/,
        ascii = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) ( \d|\d\d) (\d\d):(\d\d):(\d\d) (\d{4})$/;
  
    function extractRFC1123Or850(match) {
      var weekdayStr = match[1],
          dayStr = match[2],
          monthStr = match[3],
          yearStr = match[4],
          hourStr = match[5],
          minuteStr = match[6],
          secondStr = match[7],
          result = fromStrings(weekdayStr, yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr);
      return [result, FixedOffsetZone.utcInstance];
    }
  
    function extractASCII(match) {
      var weekdayStr = match[1],
          monthStr = match[2],
          dayStr = match[3],
          hourStr = match[4],
          minuteStr = match[5],
          secondStr = match[6],
          yearStr = match[7],
          result = fromStrings(weekdayStr, yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr);
      return [result, FixedOffsetZone.utcInstance];
    }
  
    var isoYmdWithTimeExtensionRegex = combineRegexes(isoYmdRegex, isoTimeExtensionRegex);
    var isoWeekWithTimeExtensionRegex = combineRegexes(isoWeekRegex, isoTimeExtensionRegex);
    var isoOrdinalWithTimeExtensionRegex = combineRegexes(isoOrdinalRegex, isoTimeExtensionRegex);
    var isoTimeCombinedRegex = combineRegexes(isoTimeRegex);
    var extractISOYmdTimeAndOffset = combineExtractors(extractISOYmd, extractISOTime, extractISOOffset);
    var extractISOWeekTimeAndOffset = combineExtractors(extractISOWeekData, extractISOTime, extractISOOffset);
    var extractISOOrdinalDateAndTime = combineExtractors(extractISOOrdinalData, extractISOTime, extractISOOffset);
    var extractISOTimeAndOffset = combineExtractors(extractISOTime, extractISOOffset);
    /**
     * @private
     */
  
    function parseISODate(s) {
      return parse(s, [isoYmdWithTimeExtensionRegex, extractISOYmdTimeAndOffset], [isoWeekWithTimeExtensionRegex, extractISOWeekTimeAndOffset], [isoOrdinalWithTimeExtensionRegex, extractISOOrdinalDateAndTime], [isoTimeCombinedRegex, extractISOTimeAndOffset]);
    }
    function parseRFC2822Date(s) {
      return parse(preprocessRFC2822(s), [rfc2822, extractRFC2822]);
    }
    function parseHTTPDate(s) {
      return parse(s, [rfc1123, extractRFC1123Or850], [rfc850, extractRFC1123Or850], [ascii, extractASCII]);
    }
    function parseISODuration(s) {
      return parse(s, [isoDuration, extractISODuration]);
    }
    var extractISOTimeOnly = combineExtractors(extractISOTime);
    function parseISOTimeOnly(s) {
      return parse(s, [isoTimeOnly, extractISOTimeOnly]);
    }
    var sqlYmdWithTimeExtensionRegex = combineRegexes(sqlYmdRegex, sqlTimeExtensionRegex);
    var sqlTimeCombinedRegex = combineRegexes(sqlTimeRegex);
    var extractISOYmdTimeOffsetAndIANAZone = combineExtractors(extractISOYmd, extractISOTime, extractISOOffset, extractIANAZone);
    var extractISOTimeOffsetAndIANAZone = combineExtractors(extractISOTime, extractISOOffset, extractIANAZone);
    function parseSQL(s) {
      return parse(s, [sqlYmdWithTimeExtensionRegex, extractISOYmdTimeOffsetAndIANAZone], [sqlTimeCombinedRegex, extractISOTimeOffsetAndIANAZone]);
    }
  
    var INVALID$2 = "Invalid Duration"; // unit conversion constants
  
    var lowOrderMatrix = {
      weeks: {
        days: 7,
        hours: 7 * 24,
        minutes: 7 * 24 * 60,
        seconds: 7 * 24 * 60 * 60,
        milliseconds: 7 * 24 * 60 * 60 * 1000
      },
      days: {
        hours: 24,
        minutes: 24 * 60,
        seconds: 24 * 60 * 60,
        milliseconds: 24 * 60 * 60 * 1000
      },
      hours: {
        minutes: 60,
        seconds: 60 * 60,
        milliseconds: 60 * 60 * 1000
      },
      minutes: {
        seconds: 60,
        milliseconds: 60 * 1000
      },
      seconds: {
        milliseconds: 1000
      }
    },
        casualMatrix = _extends({
      years: {
        quarters: 4,
        months: 12,
        weeks: 52,
        days: 365,
        hours: 365 * 24,
        minutes: 365 * 24 * 60,
        seconds: 365 * 24 * 60 * 60,
        milliseconds: 365 * 24 * 60 * 60 * 1000
      },
      quarters: {
        months: 3,
        weeks: 13,
        days: 91,
        hours: 91 * 24,
        minutes: 91 * 24 * 60,
        seconds: 91 * 24 * 60 * 60,
        milliseconds: 91 * 24 * 60 * 60 * 1000
      },
      months: {
        weeks: 4,
        days: 30,
        hours: 30 * 24,
        minutes: 30 * 24 * 60,
        seconds: 30 * 24 * 60 * 60,
        milliseconds: 30 * 24 * 60 * 60 * 1000
      }
    }, lowOrderMatrix),
        daysInYearAccurate = 146097.0 / 400,
        daysInMonthAccurate = 146097.0 / 4800,
        accurateMatrix = _extends({
      years: {
        quarters: 4,
        months: 12,
        weeks: daysInYearAccurate / 7,
        days: daysInYearAccurate,
        hours: daysInYearAccurate * 24,
        minutes: daysInYearAccurate * 24 * 60,
        seconds: daysInYearAccurate * 24 * 60 * 60,
        milliseconds: daysInYearAccurate * 24 * 60 * 60 * 1000
      },
      quarters: {
        months: 3,
        weeks: daysInYearAccurate / 28,
        days: daysInYearAccurate / 4,
        hours: daysInYearAccurate * 24 / 4,
        minutes: daysInYearAccurate * 24 * 60 / 4,
        seconds: daysInYearAccurate * 24 * 60 * 60 / 4,
        milliseconds: daysInYearAccurate * 24 * 60 * 60 * 1000 / 4
      },
      months: {
        weeks: daysInMonthAccurate / 7,
        days: daysInMonthAccurate,
        hours: daysInMonthAccurate * 24,
        minutes: daysInMonthAccurate * 24 * 60,
        seconds: daysInMonthAccurate * 24 * 60 * 60,
        milliseconds: daysInMonthAccurate * 24 * 60 * 60 * 1000
      }
    }, lowOrderMatrix); // units ordered by size
  
    var orderedUnits$1 = ["years", "quarters", "months", "weeks", "days", "hours", "minutes", "seconds", "milliseconds"];
    var reverseUnits = orderedUnits$1.slice(0).reverse(); // clone really means "create another instance just like this one, but with these changes"
  
    function clone$1(dur, alts, clear) {
      if (clear === void 0) {
        clear = false;
      }
  
      // deep merge for vals
      var conf = {
        values: clear ? alts.values : _extends({}, dur.values, alts.values || {}),
        loc: dur.loc.clone(alts.loc),
        conversionAccuracy: alts.conversionAccuracy || dur.conversionAccuracy
      };
      return new Duration(conf);
    }
  
    function antiTrunc(n) {
      return n < 0 ? Math.floor(n) : Math.ceil(n);
    } // NB: mutates parameters
  
  
    function convert(matrix, fromMap, fromUnit, toMap, toUnit) {
      var conv = matrix[toUnit][fromUnit],
          raw = fromMap[fromUnit] / conv,
          sameSign = Math.sign(raw) === Math.sign(toMap[toUnit]),
          // ok, so this is wild, but see the matrix in the tests
      added = !sameSign && toMap[toUnit] !== 0 && Math.abs(raw) <= 1 ? antiTrunc(raw) : Math.trunc(raw);
      toMap[toUnit] += added;
      fromMap[fromUnit] -= added * conv;
    } // NB: mutates parameters
  
  
    function normalizeValues(matrix, vals) {
      reverseUnits.reduce(function (previous, current) {
        if (!isUndefined(vals[current])) {
          if (previous) {
            convert(matrix, vals, previous, vals, current);
          }
  
          return current;
        } else {
          return previous;
        }
      }, null);
    }
    /**
     * A Duration object represents a period of time, like "2 months" or "1 day, 1 hour". Conceptually, it's just a map of units to their quantities, accompanied by some additional configuration and methods for creating, parsing, interrogating, transforming, and formatting them. They can be used on their own or in conjunction with other Luxon types; for example, you can use {@link DateTime#plus} to add a Duration object to a DateTime, producing another DateTime.
     *
     * Here is a brief overview of commonly used methods and getters in Duration:
     *
     * * **Creation** To create a Duration, use {@link Duration#fromMillis}, {@link Duration#fromObject}, or {@link Duration#fromISO}.
     * * **Unit values** See the {@link Duration#years}, {@link Duration.months}, {@link Duration#weeks}, {@link Duration#days}, {@link Duration#hours}, {@link Duration#minutes}, {@link Duration#seconds}, {@link Duration#milliseconds} accessors.
     * * **Configuration** See  {@link Duration#locale} and {@link Duration#numberingSystem} accessors.
     * * **Transformation** To create new Durations out of old ones use {@link Duration#plus}, {@link Duration#minus}, {@link Duration#normalize}, {@link Duration#set}, {@link Duration#reconfigure}, {@link Duration#shiftTo}, and {@link Duration#negate}.
     * * **Output** To convert the Duration into other representations, see {@link Duration#as}, {@link Duration#toISO}, {@link Duration#toFormat}, and {@link Duration#toJSON}
     *
     * There's are more methods documented below. In addition, for more information on subtler topics like internationalization and validity, see the external documentation.
     */
  
  
    var Duration = /*#__PURE__*/function () {
      /**
       * @private
       */
      function Duration(config) {
        var accurate = config.conversionAccuracy === "longterm" || false;
        /**
         * @access private
         */
  
        this.values = config.values;
        /**
         * @access private
         */
  
        this.loc = config.loc || Locale.create();
        /**
         * @access private
         */
  
        this.conversionAccuracy = accurate ? "longterm" : "casual";
        /**
         * @access private
         */
  
        this.invalid = config.invalid || null;
        /**
         * @access private
         */
  
        this.matrix = accurate ? accurateMatrix : casualMatrix;
        /**
         * @access private
         */
  
        this.isLuxonDuration = true;
      }
      /**
       * Create Duration from a number of milliseconds.
       * @param {number} count of milliseconds
       * @param {Object} opts - options for parsing
       * @param {string} [opts.locale='en-US'] - the locale to use
       * @param {string} opts.numberingSystem - the numbering system to use
       * @param {string} [opts.conversionAccuracy='casual'] - the conversion system to use
       * @return {Duration}
       */
  
  
      Duration.fromMillis = function fromMillis(count, opts) {
        return Duration.fromObject({
          milliseconds: count
        }, opts);
      }
      /**
       * Create a Duration from a JavaScript object with keys like 'years' and 'hours'.
       * If this object is empty then a zero milliseconds duration is returned.
       * @param {Object} obj - the object to create the DateTime from
       * @param {number} obj.years
       * @param {number} obj.quarters
       * @param {number} obj.months
       * @param {number} obj.weeks
       * @param {number} obj.days
       * @param {number} obj.hours
       * @param {number} obj.minutes
       * @param {number} obj.seconds
       * @param {number} obj.milliseconds
       * @param {Object} [opts=[]] - options for creating this Duration
       * @param {string} [opts.locale='en-US'] - the locale to use
       * @param {string} opts.numberingSystem - the numbering system to use
       * @param {string} [opts.conversionAccuracy='casual'] - the conversion system to use
       * @return {Duration}
       */
      ;
  
      Duration.fromObject = function fromObject(obj, opts) {
        if (opts === void 0) {
          opts = {};
        }
  
        if (obj == null || typeof obj !== "object") {
          throw new InvalidArgumentError("Duration.fromObject: argument expected to be an object, got " + (obj === null ? "null" : typeof obj));
        }
  
        return new Duration({
          values: normalizeObject(obj, Duration.normalizeUnit),
          loc: Locale.fromObject(opts),
          conversionAccuracy: opts.conversionAccuracy
        });
      }
      /**
       * Create a Duration from DurationLike.
       *
       * @param {Object | number | Duration} durationLike
       * One of:
       * - object with keys like 'years' and 'hours'.
       * - number representing milliseconds
       * - Duration instance
       * @return {Duration}
       */
      ;
  
      Duration.fromDurationLike = function fromDurationLike(durationLike) {
        if (isNumber(durationLike)) {
          return Duration.fromMillis(durationLike);
        } else if (Duration.isDuration(durationLike)) {
          return durationLike;
        } else if (typeof durationLike === "object") {
          return Duration.fromObject(durationLike);
        } else {
          throw new InvalidArgumentError("Unknown duration argument " + durationLike + " of type " + typeof durationLike);
        }
      }
      /**
       * Create a Duration from an ISO 8601 duration string.
       * @param {string} text - text to parse
       * @param {Object} opts - options for parsing
       * @param {string} [opts.locale='en-US'] - the locale to use
       * @param {string} opts.numberingSystem - the numbering system to use
       * @param {string} [opts.conversionAccuracy='casual'] - the conversion system to use
       * @see https://en.wikipedia.org/wiki/ISO_8601#Durations
       * @example Duration.fromISO('P3Y6M1W4DT12H30M5S').toObject() //=> { years: 3, months: 6, weeks: 1, days: 4, hours: 12, minutes: 30, seconds: 5 }
       * @example Duration.fromISO('PT23H').toObject() //=> { hours: 23 }
       * @example Duration.fromISO('P5Y3M').toObject() //=> { years: 5, months: 3 }
       * @return {Duration}
       */
      ;
  
      Duration.fromISO = function fromISO(text, opts) {
        var _parseISODuration = parseISODuration(text),
            parsed = _parseISODuration[0];
  
        if (parsed) {
          return Duration.fromObject(parsed, opts);
        } else {
          return Duration.invalid("unparsable", "the input \"" + text + "\" can't be parsed as ISO 8601");
        }
      }
      /**
       * Create a Duration from an ISO 8601 time string.
       * @param {string} text - text to parse
       * @param {Object} opts - options for parsing
       * @param {string} [opts.locale='en-US'] - the locale to use
       * @param {string} opts.numberingSystem - the numbering system to use
       * @param {string} [opts.conversionAccuracy='casual'] - the conversion system to use
       * @see https://en.wikipedia.org/wiki/ISO_8601#Times
       * @example Duration.fromISOTime('11:22:33.444').toObject() //=> { hours: 11, minutes: 22, seconds: 33, milliseconds: 444 }
       * @example Duration.fromISOTime('11:00').toObject() //=> { hours: 11, minutes: 0, seconds: 0 }
       * @example Duration.fromISOTime('T11:00').toObject() //=> { hours: 11, minutes: 0, seconds: 0 }
       * @example Duration.fromISOTime('1100').toObject() //=> { hours: 11, minutes: 0, seconds: 0 }
       * @example Duration.fromISOTime('T1100').toObject() //=> { hours: 11, minutes: 0, seconds: 0 }
       * @return {Duration}
       */
      ;
  
      Duration.fromISOTime = function fromISOTime(text, opts) {
        var _parseISOTimeOnly = parseISOTimeOnly(text),
            parsed = _parseISOTimeOnly[0];
  
        if (parsed) {
          return Duration.fromObject(parsed, opts);
        } else {
          return Duration.invalid("unparsable", "the input \"" + text + "\" can't be parsed as ISO 8601");
        }
      }
      /**
       * Create an invalid Duration.
       * @param {string} reason - simple string of why this datetime is invalid. Should not contain parameters or anything else data-dependent
       * @param {string} [explanation=null] - longer explanation, may include parameters and other useful debugging information
       * @return {Duration}
       */
      ;
  
      Duration.invalid = function invalid(reason, explanation) {
        if (explanation === void 0) {
          explanation = null;
        }
  
        if (!reason) {
          throw new InvalidArgumentError("need to specify a reason the Duration is invalid");
        }
  
        var invalid = reason instanceof Invalid ? reason : new Invalid(reason, explanation);
  
        if (Settings.throwOnInvalid) {
          throw new InvalidDurationError(invalid);
        } else {
          return new Duration({
            invalid: invalid
          });
        }
      }
      /**
       * @private
       */
      ;
  
      Duration.normalizeUnit = function normalizeUnit(unit) {
        var normalized = {
          year: "years",
          years: "years",
          quarter: "quarters",
          quarters: "quarters",
          month: "months",
          months: "months",
          week: "weeks",
          weeks: "weeks",
          day: "days",
          days: "days",
          hour: "hours",
          hours: "hours",
          minute: "minutes",
          minutes: "minutes",
          second: "seconds",
          seconds: "seconds",
          millisecond: "milliseconds",
          milliseconds: "milliseconds"
        }[unit ? unit.toLowerCase() : unit];
        if (!normalized) throw new InvalidUnitError(unit);
        return normalized;
      }
      /**
       * Check if an object is a Duration. Works across context boundaries
       * @param {object} o
       * @return {boolean}
       */
      ;
  
      Duration.isDuration = function isDuration(o) {
        return o && o.isLuxonDuration || false;
      }
      /**
       * Get  the locale of a Duration, such 'en-GB'
       * @type {string}
       */
      ;
  
      var _proto = Duration.prototype;
  
      /**
       * Returns a string representation of this Duration formatted according to the specified format string. You may use these tokens:
       * * `S` for milliseconds
       * * `s` for seconds
       * * `m` for minutes
       * * `h` for hours
       * * `d` for days
       * * `w` for weeks
       * * `M` for months
       * * `y` for years
       * Notes:
       * * Add padding by repeating the token, e.g. "yy" pads the years to two digits, "hhhh" pads the hours out to four digits
       * * The duration will be converted to the set of units in the format string using {@link Duration#shiftTo} and the Durations's conversion accuracy setting.
       * @param {string} fmt - the format string
       * @param {Object} opts - options
       * @param {boolean} [opts.floor=true] - floor numerical values
       * @example Duration.fromObject({ years: 1, days: 6, seconds: 2 }).toFormat("y d s") //=> "1 6 2"
       * @example Duration.fromObject({ years: 1, days: 6, seconds: 2 }).toFormat("yy dd sss") //=> "01 06 002"
       * @example Duration.fromObject({ years: 1, days: 6, seconds: 2 }).toFormat("M S") //=> "12 518402000"
       * @return {string}
       */
      _proto.toFormat = function toFormat(fmt, opts) {
        if (opts === void 0) {
          opts = {};
        }
  
        // reverse-compat since 1.2; we always round down now, never up, and we do it by default
        var fmtOpts = _extends({}, opts, {
          floor: opts.round !== false && opts.floor !== false
        });
  
        return this.isValid ? Formatter.create(this.loc, fmtOpts).formatDurationFromString(this, fmt) : INVALID$2;
      }
      /**
       * Returns a string representation of a Duration with all units included.
       * To modify its behavior use the `listStyle` and any Intl.NumberFormat option, though `unitDisplay` is especially relevant.
       * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat
       * @param opts - On option object to override the formatting. Accepts the same keys as the options parameter of the native `Int.NumberFormat` constructor, as well as `listStyle`.
       * @example
       * ```js
       * var dur = Duration.fromObject({ days: 1, hours: 5, minutes: 6 })
       * dur.toHuman() //=> '1 day, 5 hours, 6 minutes'
       * dur.toHuman({ listStyle: "long" }) //=> '1 day, 5 hours, and 6 minutes'
       * dur.toHuman({ unitDisplay: "short" }) //=> '1 day, 5 hr, 6 min'
       * ```
       */
      ;
  
      _proto.toHuman = function toHuman(opts) {
        var _this = this;
  
        if (opts === void 0) {
          opts = {};
        }
  
        var l = orderedUnits$1.map(function (unit) {
          var val = _this.values[unit];
  
          if (isUndefined(val)) {
            return null;
          }
  
          return _this.loc.numberFormatter(_extends({
            style: "unit",
            unitDisplay: "long"
          }, opts, {
            unit: unit.slice(0, -1)
          })).format(val);
        }).filter(function (n) {
          return n;
        });
        return this.loc.listFormatter(_extends({
          type: "conjunction",
          style: opts.listStyle || "narrow"
        }, opts)).format(l);
      }
      /**
       * Returns a JavaScript object with this Duration's values.
       * @example Duration.fromObject({ years: 1, days: 6, seconds: 2 }).toObject() //=> { years: 1, days: 6, seconds: 2 }
       * @return {Object}
       */
      ;
  
      _proto.toObject = function toObject() {
        if (!this.isValid) return {};
        return _extends({}, this.values);
      }
      /**
       * Returns an ISO 8601-compliant string representation of this Duration.
       * @see https://en.wikipedia.org/wiki/ISO_8601#Durations
       * @example Duration.fromObject({ years: 3, seconds: 45 }).toISO() //=> 'P3YT45S'
       * @example Duration.fromObject({ months: 4, seconds: 45 }).toISO() //=> 'P4MT45S'
       * @example Duration.fromObject({ months: 5 }).toISO() //=> 'P5M'
       * @example Duration.fromObject({ minutes: 5 }).toISO() //=> 'PT5M'
       * @example Duration.fromObject({ milliseconds: 6 }).toISO() //=> 'PT0.006S'
       * @return {string}
       */
      ;
  
      _proto.toISO = function toISO() {
        // we could use the formatter, but this is an easier way to get the minimum string
        if (!this.isValid) return null;
        var s = "P";
        if (this.years !== 0) s += this.years + "Y";
        if (this.months !== 0 || this.quarters !== 0) s += this.months + this.quarters * 3 + "M";
        if (this.weeks !== 0) s += this.weeks + "W";
        if (this.days !== 0) s += this.days + "D";
        if (this.hours !== 0 || this.minutes !== 0 || this.seconds !== 0 || this.milliseconds !== 0) s += "T";
        if (this.hours !== 0) s += this.hours + "H";
        if (this.minutes !== 0) s += this.minutes + "M";
        if (this.seconds !== 0 || this.milliseconds !== 0) // this will handle "floating point madness" by removing extra decimal places
          // https://stackoverflow.com/questions/588004/is-floating-point-math-broken
          s += roundTo(this.seconds + this.milliseconds / 1000, 3) + "S";
        if (s === "P") s += "T0S";
        return s;
      }
      /**
       * Returns an ISO 8601-compliant string representation of this Duration, formatted as a time of day.
       * Note that this will return null if the duration is invalid, negative, or equal to or greater than 24 hours.
       * @see https://en.wikipedia.org/wiki/ISO_8601#Times
       * @param {Object} opts - options
       * @param {boolean} [opts.suppressMilliseconds=false] - exclude milliseconds from the format if they're 0
       * @param {boolean} [opts.suppressSeconds=false] - exclude seconds from the format if they're 0
       * @param {boolean} [opts.includePrefix=false] - include the `T` prefix
       * @param {string} [opts.format='extended'] - choose between the basic and extended format
       * @example Duration.fromObject({ hours: 11 }).toISOTime() //=> '11:00:00.000'
       * @example Duration.fromObject({ hours: 11 }).toISOTime({ suppressMilliseconds: true }) //=> '11:00:00'
       * @example Duration.fromObject({ hours: 11 }).toISOTime({ suppressSeconds: true }) //=> '11:00'
       * @example Duration.fromObject({ hours: 11 }).toISOTime({ includePrefix: true }) //=> 'T11:00:00.000'
       * @example Duration.fromObject({ hours: 11 }).toISOTime({ format: 'basic' }) //=> '110000.000'
       * @return {string}
       */
      ;
  
      _proto.toISOTime = function toISOTime(opts) {
        if (opts === void 0) {
          opts = {};
        }
  
        if (!this.isValid) return null;
        var millis = this.toMillis();
        if (millis < 0 || millis >= 86400000) return null;
        opts = _extends({
          suppressMilliseconds: false,
          suppressSeconds: false,
          includePrefix: false,
          format: "extended"
        }, opts);
        var value = this.shiftTo("hours", "minutes", "seconds", "milliseconds");
        var fmt = opts.format === "basic" ? "hhmm" : "hh:mm";
  
        if (!opts.suppressSeconds || value.seconds !== 0 || value.milliseconds !== 0) {
          fmt += opts.format === "basic" ? "ss" : ":ss";
  
          if (!opts.suppressMilliseconds || value.milliseconds !== 0) {
            fmt += ".SSS";
          }
        }
  
        var str = value.toFormat(fmt);
  
        if (opts.includePrefix) {
          str = "T" + str;
        }
  
        return str;
      }
      /**
       * Returns an ISO 8601 representation of this Duration appropriate for use in JSON.
       * @return {string}
       */
      ;
  
      _proto.toJSON = function toJSON() {
        return this.toISO();
      }
      /**
       * Returns an ISO 8601 representation of this Duration appropriate for use in debugging.
       * @return {string}
       */
      ;
  
      _proto.toString = function toString() {
        return this.toISO();
      }
      /**
       * Returns an milliseconds value of this Duration.
       * @return {number}
       */
      ;
  
      _proto.toMillis = function toMillis() {
        return this.as("milliseconds");
      }
      /**
       * Returns an milliseconds value of this Duration. Alias of {@link toMillis}
       * @return {number}
       */
      ;
  
      _proto.valueOf = function valueOf() {
        return this.toMillis();
      }
      /**
       * Make this Duration longer by the specified amount. Return a newly-constructed Duration.
       * @param {Duration|Object|number} duration - The amount to add. Either a Luxon Duration, a number of milliseconds, the object argument to Duration.fromObject()
       * @return {Duration}
       */
      ;
  
      _proto.plus = function plus(duration) {
        if (!this.isValid) return this;
        var dur = Duration.fromDurationLike(duration),
            result = {};
  
        for (var _iterator = _createForOfIteratorHelperLoose(orderedUnits$1), _step; !(_step = _iterator()).done;) {
          var k = _step.value;
  
          if (hasOwnProperty(dur.values, k) || hasOwnProperty(this.values, k)) {
            result[k] = dur.get(k) + this.get(k);
          }
        }
  
        return clone$1(this, {
          values: result
        }, true);
      }
      /**
       * Make this Duration shorter by the specified amount. Return a newly-constructed Duration.
       * @param {Duration|Object|number} duration - The amount to subtract. Either a Luxon Duration, a number of milliseconds, the object argument to Duration.fromObject()
       * @return {Duration}
       */
      ;
  
      _proto.minus = function minus(duration) {
        if (!this.isValid) return this;
        var dur = Duration.fromDurationLike(duration);
        return this.plus(dur.negate());
      }
      /**
       * Scale this Duration by the specified amount. Return a newly-constructed Duration.
       * @param {function} fn - The function to apply to each unit. Arity is 1 or 2: the value of the unit and, optionally, the unit name. Must return a number.
       * @example Duration.fromObject({ hours: 1, minutes: 30 }).mapUnits(x => x * 2) //=> { hours: 2, minutes: 60 }
       * @example Duration.fromObject({ hours: 1, minutes: 30 }).mapUnits((x, u) => u === "hour" ? x * 2 : x) //=> { hours: 2, minutes: 30 }
       * @return {Duration}
       */
      ;
  
      _proto.mapUnits = function mapUnits(fn) {
        if (!this.isValid) return this;
        var result = {};
  
        for (var _i = 0, _Object$keys = Object.keys(this.values); _i < _Object$keys.length; _i++) {
          var k = _Object$keys[_i];
          result[k] = asNumber(fn(this.values[k], k));
        }
  
        return clone$1(this, {
          values: result
        }, true);
      }
      /**
       * Get the value of unit.
       * @param {string} unit - a unit such as 'minute' or 'day'
       * @example Duration.fromObject({years: 2, days: 3}).get('years') //=> 2
       * @example Duration.fromObject({years: 2, days: 3}).get('months') //=> 0
       * @example Duration.fromObject({years: 2, days: 3}).get('days') //=> 3
       * @return {number}
       */
      ;
  
      _proto.get = function get(unit) {
        return this[Duration.normalizeUnit(unit)];
      }
      /**
       * "Set" the values of specified units. Return a newly-constructed Duration.
       * @param {Object} values - a mapping of units to numbers
       * @example dur.set({ years: 2017 })
       * @example dur.set({ hours: 8, minutes: 30 })
       * @return {Duration}
       */
      ;
  
      _proto.set = function set(values) {
        if (!this.isValid) return this;
  
        var mixed = _extends({}, this.values, normalizeObject(values, Duration.normalizeUnit));
  
        return clone$1(this, {
          values: mixed
        });
      }
      /**
       * "Set" the locale and/or numberingSystem.  Returns a newly-constructed Duration.
       * @example dur.reconfigure({ locale: 'en-GB' })
       * @return {Duration}
       */
      ;
  
      _proto.reconfigure = function reconfigure(_temp) {
        var _ref = _temp === void 0 ? {} : _temp,
            locale = _ref.locale,
            numberingSystem = _ref.numberingSystem,
            conversionAccuracy = _ref.conversionAccuracy;
  
        var loc = this.loc.clone({
          locale: locale,
          numberingSystem: numberingSystem
        }),
            opts = {
          loc: loc
        };
  
        if (conversionAccuracy) {
          opts.conversionAccuracy = conversionAccuracy;
        }
  
        return clone$1(this, opts);
      }
      /**
       * Return the length of the duration in the specified unit.
       * @param {string} unit - a unit such as 'minutes' or 'days'
       * @example Duration.fromObject({years: 1}).as('days') //=> 365
       * @example Duration.fromObject({years: 1}).as('months') //=> 12
       * @example Duration.fromObject({hours: 60}).as('days') //=> 2.5
       * @return {number}
       */
      ;
  
      _proto.as = function as(unit) {
        return this.isValid ? this.shiftTo(unit).get(unit) : NaN;
      }
      /**
       * Reduce this Duration to its canonical representation in its current units.
       * @example Duration.fromObject({ years: 2, days: 5000 }).normalize().toObject() //=> { years: 15, days: 255 }
       * @example Duration.fromObject({ hours: 12, minutes: -45 }).normalize().toObject() //=> { hours: 11, minutes: 15 }
       * @return {Duration}
       */
      ;
  
      _proto.normalize = function normalize() {
        if (!this.isValid) return this;
        var vals = this.toObject();
        normalizeValues(this.matrix, vals);
        return clone$1(this, {
          values: vals
        }, true);
      }
      /**
       * Convert this Duration into its representation in a different set of units.
       * @example Duration.fromObject({ hours: 1, seconds: 30 }).shiftTo('minutes', 'milliseconds').toObject() //=> { minutes: 60, milliseconds: 30000 }
       * @return {Duration}
       */
      ;
  
      _proto.shiftTo = function shiftTo() {
        for (var _len = arguments.length, units = new Array(_len), _key = 0; _key < _len; _key++) {
          units[_key] = arguments[_key];
        }
  
        if (!this.isValid) return this;
  
        if (units.length === 0) {
          return this;
        }
  
        units = units.map(function (u) {
          return Duration.normalizeUnit(u);
        });
        var built = {},
            accumulated = {},
            vals = this.toObject();
        var lastUnit;
  
        for (var _iterator2 = _createForOfIteratorHelperLoose(orderedUnits$1), _step2; !(_step2 = _iterator2()).done;) {
          var k = _step2.value;
  
          if (units.indexOf(k) >= 0) {
            lastUnit = k;
            var own = 0; // anything we haven't boiled down yet should get boiled to this unit
  
            for (var ak in accumulated) {
              own += this.matrix[ak][k] * accumulated[ak];
              accumulated[ak] = 0;
            } // plus anything that's already in this unit
  
  
            if (isNumber(vals[k])) {
              own += vals[k];
            }
  
            var i = Math.trunc(own);
            built[k] = i;
            accumulated[k] = (own * 1000 - i * 1000) / 1000; // plus anything further down the chain that should be rolled up in to this
  
            for (var down in vals) {
              if (orderedUnits$1.indexOf(down) > orderedUnits$1.indexOf(k)) {
                convert(this.matrix, vals, down, built, k);
              }
            } // otherwise, keep it in the wings to boil it later
  
          } else if (isNumber(vals[k])) {
            accumulated[k] = vals[k];
          }
        } // anything leftover becomes the decimal for the last unit
        // lastUnit must be defined since units is not empty
  
  
        for (var key in accumulated) {
          if (accumulated[key] !== 0) {
            built[lastUnit] += key === lastUnit ? accumulated[key] : accumulated[key] / this.matrix[lastUnit][key];
          }
        }
  
        return clone$1(this, {
          values: built
        }, true).normalize();
      }
      /**
       * Return the negative of this Duration.
       * @example Duration.fromObject({ hours: 1, seconds: 30 }).negate().toObject() //=> { hours: -1, seconds: -30 }
       * @return {Duration}
       */
      ;
  
      _proto.negate = function negate() {
        if (!this.isValid) return this;
        var negated = {};
  
        for (var _i2 = 0, _Object$keys2 = Object.keys(this.values); _i2 < _Object$keys2.length; _i2++) {
          var k = _Object$keys2[_i2];
          negated[k] = this.values[k] === 0 ? 0 : -this.values[k];
        }
  
        return clone$1(this, {
          values: negated
        }, true);
      }
      /**
       * Get the years.
       * @type {number}
       */
      ;
  
      /**
       * Equality check
       * Two Durations are equal iff they have the same units and the same values for each unit.
       * @param {Duration} other
       * @return {boolean}
       */
      _proto.equals = function equals(other) {
        if (!this.isValid || !other.isValid) {
          return false;
        }
  
        if (!this.loc.equals(other.loc)) {
          return false;
        }
  
        function eq(v1, v2) {
          // Consider 0 and undefined as equal
          if (v1 === undefined || v1 === 0) return v2 === undefined || v2 === 0;
          return v1 === v2;
        }
  
        for (var _iterator3 = _createForOfIteratorHelperLoose(orderedUnits$1), _step3; !(_step3 = _iterator3()).done;) {
          var u = _step3.value;
  
          if (!eq(this.values[u], other.values[u])) {
            return false;
          }
        }
  
        return true;
      };
  
      _createClass(Duration, [{
        key: "locale",
        get: function get() {
          return this.isValid ? this.loc.locale : null;
        }
        /**
         * Get the numbering system of a Duration, such 'beng'. The numbering system is used when formatting the Duration
         *
         * @type {string}
         */
  
      }, {
        key: "numberingSystem",
        get: function get() {
          return this.isValid ? this.loc.numberingSystem : null;
        }
      }, {
        key: "years",
        get: function get() {
          return this.isValid ? this.values.years || 0 : NaN;
        }
        /**
         * Get the quarters.
         * @type {number}
         */
  
      }, {
        key: "quarters",
        get: function get() {
          return this.isValid ? this.values.quarters || 0 : NaN;
        }
        /**
         * Get the months.
         * @type {number}
         */
  
      }, {
        key: "months",
        get: function get() {
          return this.isValid ? this.values.months || 0 : NaN;
        }
        /**
         * Get the weeks
         * @type {number}
         */
  
      }, {
        key: "weeks",
        get: function get() {
          return this.isValid ? this.values.weeks || 0 : NaN;
        }
        /**
         * Get the days.
         * @type {number}
         */
  
      }, {
        key: "days",
        get: function get() {
          return this.isValid ? this.values.days || 0 : NaN;
        }
        /**
         * Get the hours.
         * @type {number}
         */
  
      }, {
        key: "hours",
        get: function get() {
          return this.isValid ? this.values.hours || 0 : NaN;
        }
        /**
         * Get the minutes.
         * @type {number}
         */
  
      }, {
        key: "minutes",
        get: function get() {
          return this.isValid ? this.values.minutes || 0 : NaN;
        }
        /**
         * Get the seconds.
         * @return {number}
         */
  
      }, {
        key: "seconds",
        get: function get() {
          return this.isValid ? this.values.seconds || 0 : NaN;
        }
        /**
         * Get the milliseconds.
         * @return {number}
         */
  
      }, {
        key: "milliseconds",
        get: function get() {
          return this.isValid ? this.values.milliseconds || 0 : NaN;
        }
        /**
         * Returns whether the Duration is invalid. Invalid durations are returned by diff operations
         * on invalid DateTimes or Intervals.
         * @return {boolean}
         */
  
      }, {
        key: "isValid",
        get: function get() {
          return this.invalid === null;
        }
        /**
         * Returns an error code if this Duration became invalid, or null if the Duration is valid
         * @return {string}
         */
  
      }, {
        key: "invalidReason",
        get: function get() {
          return this.invalid ? this.invalid.reason : null;
        }
        /**
         * Returns an explanation of why this Duration became invalid, or null if the Duration is valid
         * @type {string}
         */
  
      }, {
        key: "invalidExplanation",
        get: function get() {
          return this.invalid ? this.invalid.explanation : null;
        }
      }]);
  
      return Duration;
    }();
  
    var INVALID$1 = "Invalid Interval"; // checks if the start is equal to or before the end
  
    function validateStartEnd(start, end) {
      if (!start || !start.isValid) {
        return Interval.invalid("missing or invalid start");
      } else if (!end || !end.isValid) {
        return Interval.invalid("missing or invalid end");
      } else if (end < start) {
        return Interval.invalid("end before start", "The end of an interval must be after its start, but you had start=" + start.toISO() + " and end=" + end.toISO());
      } else {
        return null;
      }
    }
    /**
     * An Interval object represents a half-open interval of time, where each endpoint is a {@link DateTime}. Conceptually, it's a container for those two endpoints, accompanied by methods for creating, parsing, interrogating, comparing, transforming, and formatting them.
     *
     * Here is a brief overview of the most commonly used methods and getters in Interval:
     *
     * * **Creation** To create an Interval, use {@link Interval#fromDateTimes}, {@link Interval#after}, {@link Interval#before}, or {@link Interval#fromISO}.
     * * **Accessors** Use {@link Interval#start} and {@link Interval#end} to get the start and end.
     * * **Interrogation** To analyze the Interval, use {@link Interval#count}, {@link Interval#length}, {@link Interval#hasSame}, {@link Interval#contains}, {@link Interval#isAfter}, or {@link Interval#isBefore}.
     * * **Transformation** To create other Intervals out of this one, use {@link Interval#set}, {@link Interval#splitAt}, {@link Interval#splitBy}, {@link Interval#divideEqually}, {@link Interval#merge}, {@link Interval#xor}, {@link Interval#union}, {@link Interval#intersection}, or {@link Interval#difference}.
     * * **Comparison** To compare this Interval to another one, use {@link Interval#equals}, {@link Interval#overlaps}, {@link Interval#abutsStart}, {@link Interval#abutsEnd}, {@link Interval#engulfs}
     * * **Output** To convert the Interval into other representations, see {@link Interval#toString}, {@link Interval#toISO}, {@link Interval#toISODate}, {@link Interval#toISOTime}, {@link Interval#toFormat}, and {@link Interval#toDuration}.
     */
  
  
    var Interval = /*#__PURE__*/function () {
      /**
       * @private
       */
      function Interval(config) {
        /**
         * @access private
         */
        this.s = config.start;
        /**
         * @access private
         */
  
        this.e = config.end;
        /**
         * @access private
         */
  
        this.invalid = config.invalid || null;
        /**
         * @access private
         */
  
        this.isLuxonInterval = true;
      }
      /**
       * Create an invalid Interval.
       * @param {string} reason - simple string of why this Interval is invalid. Should not contain parameters or anything else data-dependent
       * @param {string} [explanation=null] - longer explanation, may include parameters and other useful debugging information
       * @return {Interval}
       */
  
  
      Interval.invalid = function invalid(reason, explanation) {
        if (explanation === void 0) {
          explanation = null;
        }
  
        if (!reason) {
          throw new InvalidArgumentError("need to specify a reason the Interval is invalid");
        }
  
        var invalid = reason instanceof Invalid ? reason : new Invalid(reason, explanation);
  
        if (Settings.throwOnInvalid) {
          throw new InvalidIntervalError(invalid);
        } else {
          return new Interval({
            invalid: invalid
          });
        }
      }
      /**
       * Create an Interval from a start DateTime and an end DateTime. Inclusive of the start but not the end.
       * @param {DateTime|Date|Object} start
       * @param {DateTime|Date|Object} end
       * @return {Interval}
       */
      ;
  
      Interval.fromDateTimes = function fromDateTimes(start, end) {
        var builtStart = friendlyDateTime(start),
            builtEnd = friendlyDateTime(end);
        var validateError = validateStartEnd(builtStart, builtEnd);
  
        if (validateError == null) {
          return new Interval({
            start: builtStart,
            end: builtEnd
          });
        } else {
          return validateError;
        }
      }
      /**
       * Create an Interval from a start DateTime and a Duration to extend to.
       * @param {DateTime|Date|Object} start
       * @param {Duration|Object|number} duration - the length of the Interval.
       * @return {Interval}
       */
      ;
  
      Interval.after = function after(start, duration) {
        var dur = Duration.fromDurationLike(duration),
            dt = friendlyDateTime(start);
        return Interval.fromDateTimes(dt, dt.plus(dur));
      }
      /**
       * Create an Interval from an end DateTime and a Duration to extend backwards to.
       * @param {DateTime|Date|Object} end
       * @param {Duration|Object|number} duration - the length of the Interval.
       * @return {Interval}
       */
      ;
  
      Interval.before = function before(end, duration) {
        var dur = Duration.fromDurationLike(duration),
            dt = friendlyDateTime(end);
        return Interval.fromDateTimes(dt.minus(dur), dt);
      }
      /**
       * Create an Interval from an ISO 8601 string.
       * Accepts `<start>/<end>`, `<start>/<duration>`, and `<duration>/<end>` formats.
       * @param {string} text - the ISO string to parse
       * @param {Object} [opts] - options to pass {@link DateTime#fromISO} and optionally {@link Duration#fromISO}
       * @see https://en.wikipedia.org/wiki/ISO_8601#Time_intervals
       * @return {Interval}
       */
      ;
  
      Interval.fromISO = function fromISO(text, opts) {
        var _split = (text || "").split("/", 2),
            s = _split[0],
            e = _split[1];
  
        if (s && e) {
          var start, startIsValid;
  
          try {
            start = DateTime.fromISO(s, opts);
            startIsValid = start.isValid;
          } catch (e) {
            startIsValid = false;
          }
  
          var end, endIsValid;
  
          try {
            end = DateTime.fromISO(e, opts);
            endIsValid = end.isValid;
          } catch (e) {
            endIsValid = false;
          }
  
          if (startIsValid && endIsValid) {
            return Interval.fromDateTimes(start, end);
          }
  
          if (startIsValid) {
            var dur = Duration.fromISO(e, opts);
  
            if (dur.isValid) {
              return Interval.after(start, dur);
            }
          } else if (endIsValid) {
            var _dur = Duration.fromISO(s, opts);
  
            if (_dur.isValid) {
              return Interval.before(end, _dur);
            }
          }
        }
  
        return Interval.invalid("unparsable", "the input \"" + text + "\" can't be parsed as ISO 8601");
      }
      /**
       * Check if an object is an Interval. Works across context boundaries
       * @param {object} o
       * @return {boolean}
       */
      ;
  
      Interval.isInterval = function isInterval(o) {
        return o && o.isLuxonInterval || false;
      }
      /**
       * Returns the start of the Interval
       * @type {DateTime}
       */
      ;
  
      var _proto = Interval.prototype;
  
      /**
       * Returns the length of the Interval in the specified unit.
       * @param {string} unit - the unit (such as 'hours' or 'days') to return the length in.
       * @return {number}
       */
      _proto.length = function length(unit) {
        if (unit === void 0) {
          unit = "milliseconds";
        }
  
        return this.isValid ? this.toDuration.apply(this, [unit]).get(unit) : NaN;
      }
      /**
       * Returns the count of minutes, hours, days, months, or years included in the Interval, even in part.
       * Unlike {@link Interval#length} this counts sections of the calendar, not periods of time, e.g. specifying 'day'
       * asks 'what dates are included in this interval?', not 'how many days long is this interval?'
       * @param {string} [unit='milliseconds'] - the unit of time to count.
       * @return {number}
       */
      ;
  
      _proto.count = function count(unit) {
        if (unit === void 0) {
          unit = "milliseconds";
        }
  
        if (!this.isValid) return NaN;
        var start = this.start.startOf(unit),
            end = this.end.startOf(unit);
        return Math.floor(end.diff(start, unit).get(unit)) + 1;
      }
      /**
       * Returns whether this Interval's start and end are both in the same unit of time
       * @param {string} unit - the unit of time to check sameness on
       * @return {boolean}
       */
      ;
  
      _proto.hasSame = function hasSame(unit) {
        return this.isValid ? this.isEmpty() || this.e.minus(1).hasSame(this.s, unit) : false;
      }
      /**
       * Return whether this Interval has the same start and end DateTimes.
       * @return {boolean}
       */
      ;
  
      _proto.isEmpty = function isEmpty() {
        return this.s.valueOf() === this.e.valueOf();
      }
      /**
       * Return whether this Interval's start is after the specified DateTime.
       * @param {DateTime} dateTime
       * @return {boolean}
       */
      ;
  
      _proto.isAfter = function isAfter(dateTime) {
        if (!this.isValid) return false;
        return this.s > dateTime;
      }
      /**
       * Return whether this Interval's end is before the specified DateTime.
       * @param {DateTime} dateTime
       * @return {boolean}
       */
      ;
  
      _proto.isBefore = function isBefore(dateTime) {
        if (!this.isValid) return false;
        return this.e <= dateTime;
      }
      /**
       * Return whether this Interval contains the specified DateTime.
       * @param {DateTime} dateTime
       * @return {boolean}
       */
      ;
  
      _proto.contains = function contains(dateTime) {
        if (!this.isValid) return false;
        return this.s <= dateTime && this.e > dateTime;
      }
      /**
       * "Sets" the start and/or end dates. Returns a newly-constructed Interval.
       * @param {Object} values - the values to set
       * @param {DateTime} values.start - the starting DateTime
       * @param {DateTime} values.end - the ending DateTime
       * @return {Interval}
       */
      ;
  
      _proto.set = function set(_temp) {
        var _ref = _temp === void 0 ? {} : _temp,
            start = _ref.start,
            end = _ref.end;
  
        if (!this.isValid) return this;
        return Interval.fromDateTimes(start || this.s, end || this.e);
      }
      /**
       * Split this Interval at each of the specified DateTimes
       * @param {...DateTime} dateTimes - the unit of time to count.
       * @return {Array}
       */
      ;
  
      _proto.splitAt = function splitAt() {
        var _this = this;
  
        if (!this.isValid) return [];
  
        for (var _len = arguments.length, dateTimes = new Array(_len), _key = 0; _key < _len; _key++) {
          dateTimes[_key] = arguments[_key];
        }
  
        var sorted = dateTimes.map(friendlyDateTime).filter(function (d) {
          return _this.contains(d);
        }).sort(),
            results = [];
        var s = this.s,
            i = 0;
  
        while (s < this.e) {
          var added = sorted[i] || this.e,
              next = +added > +this.e ? this.e : added;
          results.push(Interval.fromDateTimes(s, next));
          s = next;
          i += 1;
        }
  
        return results;
      }
      /**
       * Split this Interval into smaller Intervals, each of the specified length.
       * Left over time is grouped into a smaller interval
       * @param {Duration|Object|number} duration - The length of each resulting interval.
       * @return {Array}
       */
      ;
  
      _proto.splitBy = function splitBy(duration) {
        var dur = Duration.fromDurationLike(duration);
  
        if (!this.isValid || !dur.isValid || dur.as("milliseconds") === 0) {
          return [];
        }
  
        var s = this.s,
            idx = 1,
            next;
        var results = [];
  
        while (s < this.e) {
          var added = this.start.plus(dur.mapUnits(function (x) {
            return x * idx;
          }));
          next = +added > +this.e ? this.e : added;
          results.push(Interval.fromDateTimes(s, next));
          s = next;
          idx += 1;
        }
  
        return results;
      }
      /**
       * Split this Interval into the specified number of smaller intervals.
       * @param {number} numberOfParts - The number of Intervals to divide the Interval into.
       * @return {Array}
       */
      ;
  
      _proto.divideEqually = function divideEqually(numberOfParts) {
        if (!this.isValid) return [];
        return this.splitBy(this.length() / numberOfParts).slice(0, numberOfParts);
      }
      /**
       * Return whether this Interval overlaps with the specified Interval
       * @param {Interval} other
       * @return {boolean}
       */
      ;
  
      _proto.overlaps = function overlaps(other) {
        return this.e > other.s && this.s < other.e;
      }
      /**
       * Return whether this Interval's end is adjacent to the specified Interval's start.
       * @param {Interval} other
       * @return {boolean}
       */
      ;
  
      _proto.abutsStart = function abutsStart(other) {
        if (!this.isValid) return false;
        return +this.e === +other.s;
      }
      /**
       * Return whether this Interval's start is adjacent to the specified Interval's end.
       * @param {Interval} other
       * @return {boolean}
       */
      ;
  
      _proto.abutsEnd = function abutsEnd(other) {
        if (!this.isValid) return false;
        return +other.e === +this.s;
      }
      /**
       * Return whether this Interval engulfs the start and end of the specified Interval.
       * @param {Interval} other
       * @return {boolean}
       */
      ;
  
      _proto.engulfs = function engulfs(other) {
        if (!this.isValid) return false;
        return this.s <= other.s && this.e >= other.e;
      }
      /**
       * Return whether this Interval has the same start and end as the specified Interval.
       * @param {Interval} other
       * @return {boolean}
       */
      ;
  
      _proto.equals = function equals(other) {
        if (!this.isValid || !other.isValid) {
          return false;
        }
  
        return this.s.equals(other.s) && this.e.equals(other.e);
      }
      /**
       * Return an Interval representing the intersection of this Interval and the specified Interval.
       * Specifically, the resulting Interval has the maximum start time and the minimum end time of the two Intervals.
       * Returns null if the intersection is empty, meaning, the intervals don't intersect.
       * @param {Interval} other
       * @return {Interval}
       */
      ;
  
      _proto.intersection = function intersection(other) {
        if (!this.isValid) return this;
        var s = this.s > other.s ? this.s : other.s,
            e = this.e < other.e ? this.e : other.e;
  
        if (s >= e) {
          return null;
        } else {
          return Interval.fromDateTimes(s, e);
        }
      }
      /**
       * Return an Interval representing the union of this Interval and the specified Interval.
       * Specifically, the resulting Interval has the minimum start time and the maximum end time of the two Intervals.
       * @param {Interval} other
       * @return {Interval}
       */
      ;
  
      _proto.union = function union(other) {
        if (!this.isValid) return this;
        var s = this.s < other.s ? this.s : other.s,
            e = this.e > other.e ? this.e : other.e;
        return Interval.fromDateTimes(s, e);
      }
      /**
       * Merge an array of Intervals into a equivalent minimal set of Intervals.
       * Combines overlapping and adjacent Intervals.
       * @param {Array} intervals
       * @return {Array}
       */
      ;
  
      Interval.merge = function merge(intervals) {
        var _intervals$sort$reduc = intervals.sort(function (a, b) {
          return a.s - b.s;
        }).reduce(function (_ref2, item) {
          var sofar = _ref2[0],
              current = _ref2[1];
  
          if (!current) {
            return [sofar, item];
          } else if (current.overlaps(item) || current.abutsStart(item)) {
            return [sofar, current.union(item)];
          } else {
            return [sofar.concat([current]), item];
          }
        }, [[], null]),
            found = _intervals$sort$reduc[0],
            final = _intervals$sort$reduc[1];
  
        if (final) {
          found.push(final);
        }
  
        return found;
      }
      /**
       * Return an array of Intervals representing the spans of time that only appear in one of the specified Intervals.
       * @param {Array} intervals
       * @return {Array}
       */
      ;
  
      Interval.xor = function xor(intervals) {
        var _Array$prototype;
  
        var start = null,
            currentCount = 0;
  
        var results = [],
            ends = intervals.map(function (i) {
          return [{
            time: i.s,
            type: "s"
          }, {
            time: i.e,
            type: "e"
          }];
        }),
            flattened = (_Array$prototype = Array.prototype).concat.apply(_Array$prototype, ends),
            arr = flattened.sort(function (a, b) {
          return a.time - b.time;
        });
  
        for (var _iterator = _createForOfIteratorHelperLoose(arr), _step; !(_step = _iterator()).done;) {
          var i = _step.value;
          currentCount += i.type === "s" ? 1 : -1;
  
          if (currentCount === 1) {
            start = i.time;
          } else {
            if (start && +start !== +i.time) {
              results.push(Interval.fromDateTimes(start, i.time));
            }
  
            start = null;
          }
        }
  
        return Interval.merge(results);
      }
      /**
       * Return an Interval representing the span of time in this Interval that doesn't overlap with any of the specified Intervals.
       * @param {...Interval} intervals
       * @return {Array}
       */
      ;
  
      _proto.difference = function difference() {
        var _this2 = this;
  
        for (var _len2 = arguments.length, intervals = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
          intervals[_key2] = arguments[_key2];
        }
  
        return Interval.xor([this].concat(intervals)).map(function (i) {
          return _this2.intersection(i);
        }).filter(function (i) {
          return i && !i.isEmpty();
        });
      }
      /**
       * Returns a string representation of this Interval appropriate for debugging.
       * @return {string}
       */
      ;
  
      _proto.toString = function toString() {
        if (!this.isValid) return INVALID$1;
        return "[" + this.s.toISO() + " \u2013 " + this.e.toISO() + ")";
      }
      /**
       * Returns an ISO 8601-compliant string representation of this Interval.
       * @see https://en.wikipedia.org/wiki/ISO_8601#Time_intervals
       * @param {Object} opts - The same options as {@link DateTime#toISO}
       * @return {string}
       */
      ;
  
      _proto.toISO = function toISO(opts) {
        if (!this.isValid) return INVALID$1;
        return this.s.toISO(opts) + "/" + this.e.toISO(opts);
      }
      /**
       * Returns an ISO 8601-compliant string representation of date of this Interval.
       * The time components are ignored.
       * @see https://en.wikipedia.org/wiki/ISO_8601#Time_intervals
       * @return {string}
       */
      ;
  
      _proto.toISODate = function toISODate() {
        if (!this.isValid) return INVALID$1;
        return this.s.toISODate() + "/" + this.e.toISODate();
      }
      /**
       * Returns an ISO 8601-compliant string representation of time of this Interval.
       * The date components are ignored.
       * @see https://en.wikipedia.org/wiki/ISO_8601#Time_intervals
       * @param {Object} opts - The same options as {@link DateTime#toISO}
       * @return {string}
       */
      ;
  
      _proto.toISOTime = function toISOTime(opts) {
        if (!this.isValid) return INVALID$1;
        return this.s.toISOTime(opts) + "/" + this.e.toISOTime(opts);
      }
      /**
       * Returns a string representation of this Interval formatted according to the specified format string.
       * @param {string} dateFormat - the format string. This string formats the start and end time. See {@link DateTime#toFormat} for details.
       * @param {Object} opts - options
       * @param {string} [opts.separator =  ' – '] - a separator to place between the start and end representations
       * @return {string}
       */
      ;
  
      _proto.toFormat = function toFormat(dateFormat, _temp2) {
        var _ref3 = _temp2 === void 0 ? {} : _temp2,
            _ref3$separator = _ref3.separator,
            separator = _ref3$separator === void 0 ? " – " : _ref3$separator;
  
        if (!this.isValid) return INVALID$1;
        return "" + this.s.toFormat(dateFormat) + separator + this.e.toFormat(dateFormat);
      }
      /**
       * Return a Duration representing the time spanned by this interval.
       * @param {string|string[]} [unit=['milliseconds']] - the unit or units (such as 'hours' or 'days') to include in the duration.
       * @param {Object} opts - options that affect the creation of the Duration
       * @param {string} [opts.conversionAccuracy='casual'] - the conversion system to use
       * @example Interval.fromDateTimes(dt1, dt2).toDuration().toObject() //=> { milliseconds: 88489257 }
       * @example Interval.fromDateTimes(dt1, dt2).toDuration('days').toObject() //=> { days: 1.0241812152777778 }
       * @example Interval.fromDateTimes(dt1, dt2).toDuration(['hours', 'minutes']).toObject() //=> { hours: 24, minutes: 34.82095 }
       * @example Interval.fromDateTimes(dt1, dt2).toDuration(['hours', 'minutes', 'seconds']).toObject() //=> { hours: 24, minutes: 34, seconds: 49.257 }
       * @example Interval.fromDateTimes(dt1, dt2).toDuration('seconds').toObject() //=> { seconds: 88489.257 }
       * @return {Duration}
       */
      ;
  
      _proto.toDuration = function toDuration(unit, opts) {
        if (!this.isValid) {
          return Duration.invalid(this.invalidReason);
        }
  
        return this.e.diff(this.s, unit, opts);
      }
      /**
       * Run mapFn on the interval start and end, returning a new Interval from the resulting DateTimes
       * @param {function} mapFn
       * @return {Interval}
       * @example Interval.fromDateTimes(dt1, dt2).mapEndpoints(endpoint => endpoint.toUTC())
       * @example Interval.fromDateTimes(dt1, dt2).mapEndpoints(endpoint => endpoint.plus({ hours: 2 }))
       */
      ;
  
      _proto.mapEndpoints = function mapEndpoints(mapFn) {
        return Interval.fromDateTimes(mapFn(this.s), mapFn(this.e));
      };
  
      _createClass(Interval, [{
        key: "start",
        get: function get() {
          return this.isValid ? this.s : null;
        }
        /**
         * Returns the end of the Interval
         * @type {DateTime}
         */
  
      }, {
        key: "end",
        get: function get() {
          return this.isValid ? this.e : null;
        }
        /**
         * Returns whether this Interval's end is at least its start, meaning that the Interval isn't 'backwards'.
         * @type {boolean}
         */
  
      }, {
        key: "isValid",
        get: function get() {
          return this.invalidReason === null;
        }
        /**
         * Returns an error code if this Interval is invalid, or null if the Interval is valid
         * @type {string}
         */
  
      }, {
        key: "invalidReason",
        get: function get() {
          return this.invalid ? this.invalid.reason : null;
        }
        /**
         * Returns an explanation of why this Interval became invalid, or null if the Interval is valid
         * @type {string}
         */
  
      }, {
        key: "invalidExplanation",
        get: function get() {
          return this.invalid ? this.invalid.explanation : null;
        }
      }]);
  
      return Interval;
    }();
  
    /**
     * The Info class contains static methods for retrieving general time and date related data. For example, it has methods for finding out if a time zone has a DST, for listing the months in any supported locale, and for discovering which of Luxon features are available in the current environment.
     */
  
    var Info = /*#__PURE__*/function () {
      function Info() {}
  
      /**
       * Return whether the specified zone contains a DST.
       * @param {string|Zone} [zone='local'] - Zone to check. Defaults to the environment's local zone.
       * @return {boolean}
       */
      Info.hasDST = function hasDST(zone) {
        if (zone === void 0) {
          zone = Settings.defaultZone;
        }
  
        var proto = DateTime.now().setZone(zone).set({
          month: 12
        });
        return !zone.isUniversal && proto.offset !== proto.set({
          month: 6
        }).offset;
      }
      /**
       * Return whether the specified zone is a valid IANA specifier.
       * @param {string} zone - Zone to check
       * @return {boolean}
       */
      ;
  
      Info.isValidIANAZone = function isValidIANAZone(zone) {
        return IANAZone.isValidZone(zone);
      }
      /**
       * Converts the input into a {@link Zone} instance.
       *
       * * If `input` is already a Zone instance, it is returned unchanged.
       * * If `input` is a string containing a valid time zone name, a Zone instance
       *   with that name is returned.
       * * If `input` is a string that doesn't refer to a known time zone, a Zone
       *   instance with {@link Zone#isValid} == false is returned.
       * * If `input is a number, a Zone instance with the specified fixed offset
       *   in minutes is returned.
       * * If `input` is `null` or `undefined`, the default zone is returned.
       * @param {string|Zone|number} [input] - the value to be converted
       * @return {Zone}
       */
      ;
  
      Info.normalizeZone = function normalizeZone$1(input) {
        return normalizeZone(input, Settings.defaultZone);
      }
      /**
       * Return an array of standalone month names.
       * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DateTimeFormat
       * @param {string} [length='long'] - the length of the month representation, such as "numeric", "2-digit", "narrow", "short", "long"
       * @param {Object} opts - options
       * @param {string} [opts.locale] - the locale code
       * @param {string} [opts.numberingSystem=null] - the numbering system
       * @param {string} [opts.locObj=null] - an existing locale object to use
       * @param {string} [opts.outputCalendar='gregory'] - the calendar
       * @example Info.months()[0] //=> 'January'
       * @example Info.months('short')[0] //=> 'Jan'
       * @example Info.months('numeric')[0] //=> '1'
       * @example Info.months('short', { locale: 'fr-CA' } )[0] //=> 'janv.'
       * @example Info.months('numeric', { locale: 'ar' })[0] //=> '١'
       * @example Info.months('long', { outputCalendar: 'islamic' })[0] //=> 'Rabiʻ I'
       * @return {Array}
       */
      ;
  
      Info.months = function months(length, _temp) {
        if (length === void 0) {
          length = "long";
        }
  
        var _ref = _temp === void 0 ? {} : _temp,
            _ref$locale = _ref.locale,
            locale = _ref$locale === void 0 ? null : _ref$locale,
            _ref$numberingSystem = _ref.numberingSystem,
            numberingSystem = _ref$numberingSystem === void 0 ? null : _ref$numberingSystem,
            _ref$locObj = _ref.locObj,
            locObj = _ref$locObj === void 0 ? null : _ref$locObj,
            _ref$outputCalendar = _ref.outputCalendar,
            outputCalendar = _ref$outputCalendar === void 0 ? "gregory" : _ref$outputCalendar;
  
        return (locObj || Locale.create(locale, numberingSystem, outputCalendar)).months(length);
      }
      /**
       * Return an array of format month names.
       * Format months differ from standalone months in that they're meant to appear next to the day of the month. In some languages, that
       * changes the string.
       * See {@link Info#months}
       * @param {string} [length='long'] - the length of the month representation, such as "numeric", "2-digit", "narrow", "short", "long"
       * @param {Object} opts - options
       * @param {string} [opts.locale] - the locale code
       * @param {string} [opts.numberingSystem=null] - the numbering system
       * @param {string} [opts.locObj=null] - an existing locale object to use
       * @param {string} [opts.outputCalendar='gregory'] - the calendar
       * @return {Array}
       */
      ;
  
      Info.monthsFormat = function monthsFormat(length, _temp2) {
        if (length === void 0) {
          length = "long";
        }
  
        var _ref2 = _temp2 === void 0 ? {} : _temp2,
            _ref2$locale = _ref2.locale,
            locale = _ref2$locale === void 0 ? null : _ref2$locale,
            _ref2$numberingSystem = _ref2.numberingSystem,
            numberingSystem = _ref2$numberingSystem === void 0 ? null : _ref2$numberingSystem,
            _ref2$locObj = _ref2.locObj,
            locObj = _ref2$locObj === void 0 ? null : _ref2$locObj,
            _ref2$outputCalendar = _ref2.outputCalendar,
            outputCalendar = _ref2$outputCalendar === void 0 ? "gregory" : _ref2$outputCalendar;
  
        return (locObj || Locale.create(locale, numberingSystem, outputCalendar)).months(length, true);
      }
      /**
       * Return an array of standalone week names.
       * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DateTimeFormat
       * @param {string} [length='long'] - the length of the weekday representation, such as "narrow", "short", "long".
       * @param {Object} opts - options
       * @param {string} [opts.locale] - the locale code
       * @param {string} [opts.numberingSystem=null] - the numbering system
       * @param {string} [opts.locObj=null] - an existing locale object to use
       * @example Info.weekdays()[0] //=> 'Monday'
       * @example Info.weekdays('short')[0] //=> 'Mon'
       * @example Info.weekdays('short', { locale: 'fr-CA' })[0] //=> 'lun.'
       * @example Info.weekdays('short', { locale: 'ar' })[0] //=> 'الاثنين'
       * @return {Array}
       */
      ;
  
      Info.weekdays = function weekdays(length, _temp3) {
        if (length === void 0) {
          length = "long";
        }
  
        var _ref3 = _temp3 === void 0 ? {} : _temp3,
            _ref3$locale = _ref3.locale,
            locale = _ref3$locale === void 0 ? null : _ref3$locale,
            _ref3$numberingSystem = _ref3.numberingSystem,
            numberingSystem = _ref3$numberingSystem === void 0 ? null : _ref3$numberingSystem,
            _ref3$locObj = _ref3.locObj,
            locObj = _ref3$locObj === void 0 ? null : _ref3$locObj;
  
        return (locObj || Locale.create(locale, numberingSystem, null)).weekdays(length);
      }
      /**
       * Return an array of format week names.
       * Format weekdays differ from standalone weekdays in that they're meant to appear next to more date information. In some languages, that
       * changes the string.
       * See {@link Info#weekdays}
       * @param {string} [length='long'] - the length of the month representation, such as "narrow", "short", "long".
       * @param {Object} opts - options
       * @param {string} [opts.locale=null] - the locale code
       * @param {string} [opts.numberingSystem=null] - the numbering system
       * @param {string} [opts.locObj=null] - an existing locale object to use
       * @return {Array}
       */
      ;
  
      Info.weekdaysFormat = function weekdaysFormat(length, _temp4) {
        if (length === void 0) {
          length = "long";
        }
  
        var _ref4 = _temp4 === void 0 ? {} : _temp4,
            _ref4$locale = _ref4.locale,
            locale = _ref4$locale === void 0 ? null : _ref4$locale,
            _ref4$numberingSystem = _ref4.numberingSystem,
            numberingSystem = _ref4$numberingSystem === void 0 ? null : _ref4$numberingSystem,
            _ref4$locObj = _ref4.locObj,
            locObj = _ref4$locObj === void 0 ? null : _ref4$locObj;
  
        return (locObj || Locale.create(locale, numberingSystem, null)).weekdays(length, true);
      }
      /**
       * Return an array of meridiems.
       * @param {Object} opts - options
       * @param {string} [opts.locale] - the locale code
       * @example Info.meridiems() //=> [ 'AM', 'PM' ]
       * @example Info.meridiems({ locale: 'my' }) //=> [ 'နံနက်', 'ညနေ' ]
       * @return {Array}
       */
      ;
  
      Info.meridiems = function meridiems(_temp5) {
        var _ref5 = _temp5 === void 0 ? {} : _temp5,
            _ref5$locale = _ref5.locale,
            locale = _ref5$locale === void 0 ? null : _ref5$locale;
  
        return Locale.create(locale).meridiems();
      }
      /**
       * Return an array of eras, such as ['BC', 'AD']. The locale can be specified, but the calendar system is always Gregorian.
       * @param {string} [length='short'] - the length of the era representation, such as "short" or "long".
       * @param {Object} opts - options
       * @param {string} [opts.locale] - the locale code
       * @example Info.eras() //=> [ 'BC', 'AD' ]
       * @example Info.eras('long') //=> [ 'Before Christ', 'Anno Domini' ]
       * @example Info.eras('long', { locale: 'fr' }) //=> [ 'avant Jésus-Christ', 'après Jésus-Christ' ]
       * @return {Array}
       */
      ;
  
      Info.eras = function eras(length, _temp6) {
        if (length === void 0) {
          length = "short";
        }
  
        var _ref6 = _temp6 === void 0 ? {} : _temp6,
            _ref6$locale = _ref6.locale,
            locale = _ref6$locale === void 0 ? null : _ref6$locale;
  
        return Locale.create(locale, null, "gregory").eras(length);
      }
      /**
       * Return the set of available features in this environment.
       * Some features of Luxon are not available in all environments. For example, on older browsers, relative time formatting support is not available. Use this function to figure out if that's the case.
       * Keys:
       * * `relative`: whether this environment supports relative time formatting
       * @example Info.features() //=> { relative: false }
       * @return {Object}
       */
      ;
  
      Info.features = function features() {
        return {
          relative: hasRelative()
        };
      };
  
      return Info;
    }();
  
    function dayDiff(earlier, later) {
      var utcDayStart = function utcDayStart(dt) {
        return dt.toUTC(0, {
          keepLocalTime: true
        }).startOf("day").valueOf();
      },
          ms = utcDayStart(later) - utcDayStart(earlier);
  
      return Math.floor(Duration.fromMillis(ms).as("days"));
    }
  
    function highOrderDiffs(cursor, later, units) {
      var differs = [["years", function (a, b) {
        return b.year - a.year;
      }], ["quarters", function (a, b) {
        return b.quarter - a.quarter;
      }], ["months", function (a, b) {
        return b.month - a.month + (b.year - a.year) * 12;
      }], ["weeks", function (a, b) {
        var days = dayDiff(a, b);
        return (days - days % 7) / 7;
      }], ["days", dayDiff]];
      var results = {};
      var lowestOrder, highWater;
  
      for (var _i = 0, _differs = differs; _i < _differs.length; _i++) {
        var _differs$_i = _differs[_i],
            unit = _differs$_i[0],
            differ = _differs$_i[1];
  
        if (units.indexOf(unit) >= 0) {
          var _cursor$plus;
  
          lowestOrder = unit;
          var delta = differ(cursor, later);
          highWater = cursor.plus((_cursor$plus = {}, _cursor$plus[unit] = delta, _cursor$plus));
  
          if (highWater > later) {
            var _cursor$plus2;
  
            cursor = cursor.plus((_cursor$plus2 = {}, _cursor$plus2[unit] = delta - 1, _cursor$plus2));
            delta -= 1;
          } else {
            cursor = highWater;
          }
  
          results[unit] = delta;
        }
      }
  
      return [cursor, results, highWater, lowestOrder];
    }
  
    function _diff (earlier, later, units, opts) {
      var _highOrderDiffs = highOrderDiffs(earlier, later, units),
          cursor = _highOrderDiffs[0],
          results = _highOrderDiffs[1],
          highWater = _highOrderDiffs[2],
          lowestOrder = _highOrderDiffs[3];
  
      var remainingMillis = later - cursor;
      var lowerOrderUnits = units.filter(function (u) {
        return ["hours", "minutes", "seconds", "milliseconds"].indexOf(u) >= 0;
      });
  
      if (lowerOrderUnits.length === 0) {
        if (highWater < later) {
          var _cursor$plus3;
  
          highWater = cursor.plus((_cursor$plus3 = {}, _cursor$plus3[lowestOrder] = 1, _cursor$plus3));
        }
  
        if (highWater !== cursor) {
          results[lowestOrder] = (results[lowestOrder] || 0) + remainingMillis / (highWater - cursor);
        }
      }
  
      var duration = Duration.fromObject(results, opts);
  
      if (lowerOrderUnits.length > 0) {
        var _Duration$fromMillis;
  
        return (_Duration$fromMillis = Duration.fromMillis(remainingMillis, opts)).shiftTo.apply(_Duration$fromMillis, lowerOrderUnits).plus(duration);
      } else {
        return duration;
      }
    }
  
    var numberingSystems = {
      arab: "[\u0660-\u0669]",
      arabext: "[\u06F0-\u06F9]",
      bali: "[\u1B50-\u1B59]",
      beng: "[\u09E6-\u09EF]",
      deva: "[\u0966-\u096F]",
      fullwide: "[\uFF10-\uFF19]",
      gujr: "[\u0AE6-\u0AEF]",
      hanidec: "[〇|一|二|三|四|五|六|七|八|九]",
      khmr: "[\u17E0-\u17E9]",
      knda: "[\u0CE6-\u0CEF]",
      laoo: "[\u0ED0-\u0ED9]",
      limb: "[\u1946-\u194F]",
      mlym: "[\u0D66-\u0D6F]",
      mong: "[\u1810-\u1819]",
      mymr: "[\u1040-\u1049]",
      orya: "[\u0B66-\u0B6F]",
      tamldec: "[\u0BE6-\u0BEF]",
      telu: "[\u0C66-\u0C6F]",
      thai: "[\u0E50-\u0E59]",
      tibt: "[\u0F20-\u0F29]",
      latn: "\\d"
    };
    var numberingSystemsUTF16 = {
      arab: [1632, 1641],
      arabext: [1776, 1785],
      bali: [6992, 7001],
      beng: [2534, 2543],
      deva: [2406, 2415],
      fullwide: [65296, 65303],
      gujr: [2790, 2799],
      khmr: [6112, 6121],
      knda: [3302, 3311],
      laoo: [3792, 3801],
      limb: [6470, 6479],
      mlym: [3430, 3439],
      mong: [6160, 6169],
      mymr: [4160, 4169],
      orya: [2918, 2927],
      tamldec: [3046, 3055],
      telu: [3174, 3183],
      thai: [3664, 3673],
      tibt: [3872, 3881]
    };
    var hanidecChars = numberingSystems.hanidec.replace(/[\[|\]]/g, "").split("");
    function parseDigits(str) {
      var value = parseInt(str, 10);
  
      if (isNaN(value)) {
        value = "";
  
        for (var i = 0; i < str.length; i++) {
          var code = str.charCodeAt(i);
  
          if (str[i].search(numberingSystems.hanidec) !== -1) {
            value += hanidecChars.indexOf(str[i]);
          } else {
            for (var key in numberingSystemsUTF16) {
              var _numberingSystemsUTF = numberingSystemsUTF16[key],
                  min = _numberingSystemsUTF[0],
                  max = _numberingSystemsUTF[1];
  
              if (code >= min && code <= max) {
                value += code - min;
              }
            }
          }
        }
  
        return parseInt(value, 10);
      } else {
        return value;
      }
    }
    function digitRegex(_ref, append) {
      var numberingSystem = _ref.numberingSystem;
  
      if (append === void 0) {
        append = "";
      }
  
      return new RegExp("" + numberingSystems[numberingSystem || "latn"] + append);
    }
  
    var MISSING_FTP = "missing Intl.DateTimeFormat.formatToParts support";
  
    function intUnit(regex, post) {
      if (post === void 0) {
        post = function post(i) {
          return i;
        };
      }
  
      return {
        regex: regex,
        deser: function deser(_ref) {
          var s = _ref[0];
          return post(parseDigits(s));
        }
      };
    }
  
    var NBSP = String.fromCharCode(160);
    var spaceOrNBSP = "( |" + NBSP + ")";
    var spaceOrNBSPRegExp = new RegExp(spaceOrNBSP, "g");
  
    function fixListRegex(s) {
      // make dots optional and also make them literal
      // make space and non breakable space characters interchangeable
      return s.replace(/\./g, "\\.?").replace(spaceOrNBSPRegExp, spaceOrNBSP);
    }
  
    function stripInsensitivities(s) {
      return s.replace(/\./g, "") // ignore dots that were made optional
      .replace(spaceOrNBSPRegExp, " ") // interchange space and nbsp
      .toLowerCase();
    }
  
    function oneOf(strings, startIndex) {
      if (strings === null) {
        return null;
      } else {
        return {
          regex: RegExp(strings.map(fixListRegex).join("|")),
          deser: function deser(_ref2) {
            var s = _ref2[0];
            return strings.findIndex(function (i) {
              return stripInsensitivities(s) === stripInsensitivities(i);
            }) + startIndex;
          }
        };
      }
    }
  
    function offset(regex, groups) {
      return {
        regex: regex,
        deser: function deser(_ref3) {
          var h = _ref3[1],
              m = _ref3[2];
          return signedOffset(h, m);
        },
        groups: groups
      };
    }
  
    function simple(regex) {
      return {
        regex: regex,
        deser: function deser(_ref4) {
          var s = _ref4[0];
          return s;
        }
      };
    }
  
    function escapeToken(value) {
      return value.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&");
    }
  
    function unitForToken(token, loc) {
      var one = digitRegex(loc),
          two = digitRegex(loc, "{2}"),
          three = digitRegex(loc, "{3}"),
          four = digitRegex(loc, "{4}"),
          six = digitRegex(loc, "{6}"),
          oneOrTwo = digitRegex(loc, "{1,2}"),
          oneToThree = digitRegex(loc, "{1,3}"),
          oneToSix = digitRegex(loc, "{1,6}"),
          oneToNine = digitRegex(loc, "{1,9}"),
          twoToFour = digitRegex(loc, "{2,4}"),
          fourToSix = digitRegex(loc, "{4,6}"),
          literal = function literal(t) {
        return {
          regex: RegExp(escapeToken(t.val)),
          deser: function deser(_ref5) {
            var s = _ref5[0];
            return s;
          },
          literal: true
        };
      },
          unitate = function unitate(t) {
        if (token.literal) {
          return literal(t);
        }
  
        switch (t.val) {
          // era
          case "G":
            return oneOf(loc.eras("short", false), 0);
  
          case "GG":
            return oneOf(loc.eras("long", false), 0);
          // years
  
          case "y":
            return intUnit(oneToSix);
  
          case "yy":
            return intUnit(twoToFour, untruncateYear);
  
          case "yyyy":
            return intUnit(four);
  
          case "yyyyy":
            return intUnit(fourToSix);
  
          case "yyyyyy":
            return intUnit(six);
          // months
  
          case "M":
            return intUnit(oneOrTwo);
  
          case "MM":
            return intUnit(two);
  
          case "MMM":
            return oneOf(loc.months("short", true, false), 1);
  
          case "MMMM":
            return oneOf(loc.months("long", true, false), 1);
  
          case "L":
            return intUnit(oneOrTwo);
  
          case "LL":
            return intUnit(two);
  
          case "LLL":
            return oneOf(loc.months("short", false, false), 1);
  
          case "LLLL":
            return oneOf(loc.months("long", false, false), 1);
          // dates
  
          case "d":
            return intUnit(oneOrTwo);
  
          case "dd":
            return intUnit(two);
          // ordinals
  
          case "o":
            return intUnit(oneToThree);
  
          case "ooo":
            return intUnit(three);
          // time
  
          case "HH":
            return intUnit(two);
  
          case "H":
            return intUnit(oneOrTwo);
  
          case "hh":
            return intUnit(two);
  
          case "h":
            return intUnit(oneOrTwo);
  
          case "mm":
            return intUnit(two);
  
          case "m":
            return intUnit(oneOrTwo);
  
          case "q":
            return intUnit(oneOrTwo);
  
          case "qq":
            return intUnit(two);
  
          case "s":
            return intUnit(oneOrTwo);
  
          case "ss":
            return intUnit(two);
  
          case "S":
            return intUnit(oneToThree);
  
          case "SSS":
            return intUnit(three);
  
          case "u":
            return simple(oneToNine);
  
          case "uu":
            return simple(oneOrTwo);
  
          case "uuu":
            return intUnit(one);
          // meridiem
  
          case "a":
            return oneOf(loc.meridiems(), 0);
          // weekYear (k)
  
          case "kkkk":
            return intUnit(four);
  
          case "kk":
            return intUnit(twoToFour, untruncateYear);
          // weekNumber (W)
  
          case "W":
            return intUnit(oneOrTwo);
  
          case "WW":
            return intUnit(two);
          // weekdays
  
          case "E":
          case "c":
            return intUnit(one);
  
          case "EEE":
            return oneOf(loc.weekdays("short", false, false), 1);
  
          case "EEEE":
            return oneOf(loc.weekdays("long", false, false), 1);
  
          case "ccc":
            return oneOf(loc.weekdays("short", true, false), 1);
  
          case "cccc":
            return oneOf(loc.weekdays("long", true, false), 1);
          // offset/zone
  
          case "Z":
          case "ZZ":
            return offset(new RegExp("([+-]" + oneOrTwo.source + ")(?::(" + two.source + "))?"), 2);
  
          case "ZZZ":
            return offset(new RegExp("([+-]" + oneOrTwo.source + ")(" + two.source + ")?"), 2);
          // we don't support ZZZZ (PST) or ZZZZZ (Pacific Standard Time) in parsing
          // because we don't have any way to figure out what they are
  
          case "z":
            return simple(/[a-z_+-/]{1,256}?/i);
  
          default:
            return literal(t);
        }
      };
  
      var unit = unitate(token) || {
        invalidReason: MISSING_FTP
      };
      unit.token = token;
      return unit;
    }
  
    var partTypeStyleToTokenVal = {
      year: {
        "2-digit": "yy",
        numeric: "yyyyy"
      },
      month: {
        numeric: "M",
        "2-digit": "MM",
        short: "MMM",
        long: "MMMM"
      },
      day: {
        numeric: "d",
        "2-digit": "dd"
      },
      weekday: {
        short: "EEE",
        long: "EEEE"
      },
      dayperiod: "a",
      dayPeriod: "a",
      hour: {
        numeric: "h",
        "2-digit": "hh"
      },
      minute: {
        numeric: "m",
        "2-digit": "mm"
      },
      second: {
        numeric: "s",
        "2-digit": "ss"
      }
    };
  
    function tokenForPart(part, locale, formatOpts) {
      var type = part.type,
          value = part.value;
  
      if (type === "literal") {
        return {
          literal: true,
          val: value
        };
      }
  
      var style = formatOpts[type];
      var val = partTypeStyleToTokenVal[type];
  
      if (typeof val === "object") {
        val = val[style];
      }
  
      if (val) {
        return {
          literal: false,
          val: val
        };
      }
  
      return undefined;
    }
  
    function buildRegex(units) {
      var re = units.map(function (u) {
        return u.regex;
      }).reduce(function (f, r) {
        return f + "(" + r.source + ")";
      }, "");
      return ["^" + re + "$", units];
    }
  
    function match(input, regex, handlers) {
      var matches = input.match(regex);
  
      if (matches) {
        var all = {};
        var matchIndex = 1;
  
        for (var i in handlers) {
          if (hasOwnProperty(handlers, i)) {
            var h = handlers[i],
                groups = h.groups ? h.groups + 1 : 1;
  
            if (!h.literal && h.token) {
              all[h.token.val[0]] = h.deser(matches.slice(matchIndex, matchIndex + groups));
            }
  
            matchIndex += groups;
          }
        }
  
        return [matches, all];
      } else {
        return [matches, {}];
      }
    }
  
    function dateTimeFromMatches(matches) {
      var toField = function toField(token) {
        switch (token) {
          case "S":
            return "millisecond";
  
          case "s":
            return "second";
  
          case "m":
            return "minute";
  
          case "h":
          case "H":
            return "hour";
  
          case "d":
            return "day";
  
          case "o":
            return "ordinal";
  
          case "L":
          case "M":
            return "month";
  
          case "y":
            return "year";
  
          case "E":
          case "c":
            return "weekday";
  
          case "W":
            return "weekNumber";
  
          case "k":
            return "weekYear";
  
          case "q":
            return "quarter";
  
          default:
            return null;
        }
      };
  
      var zone = null;
      var specificOffset;
  
      if (!isUndefined(matches.z)) {
        zone = IANAZone.create(matches.z);
      }
  
      if (!isUndefined(matches.Z)) {
        if (!zone) {
          zone = new FixedOffsetZone(matches.Z);
        }
  
        specificOffset = matches.Z;
      }
  
      if (!isUndefined(matches.q)) {
        matches.M = (matches.q - 1) * 3 + 1;
      }
  
      if (!isUndefined(matches.h)) {
        if (matches.h < 12 && matches.a === 1) {
          matches.h += 12;
        } else if (matches.h === 12 && matches.a === 0) {
          matches.h = 0;
        }
      }
  
      if (matches.G === 0 && matches.y) {
        matches.y = -matches.y;
      }
  
      if (!isUndefined(matches.u)) {
        matches.S = parseMillis(matches.u);
      }
  
      var vals = Object.keys(matches).reduce(function (r, k) {
        var f = toField(k);
  
        if (f) {
          r[f] = matches[k];
        }
  
        return r;
      }, {});
      return [vals, zone, specificOffset];
    }
  
    var dummyDateTimeCache = null;
  
    function getDummyDateTime() {
      if (!dummyDateTimeCache) {
        dummyDateTimeCache = DateTime.fromMillis(1555555555555);
      }
  
      return dummyDateTimeCache;
    }
  
    function maybeExpandMacroToken(token, locale) {
      if (token.literal) {
        return token;
      }
  
      var formatOpts = Formatter.macroTokenToFormatOpts(token.val);
  
      if (!formatOpts) {
        return token;
      }
  
      var formatter = Formatter.create(locale, formatOpts);
      var parts = formatter.formatDateTimeParts(getDummyDateTime());
      var tokens = parts.map(function (p) {
        return tokenForPart(p, locale, formatOpts);
      });
  
      if (tokens.includes(undefined)) {
        return token;
      }
  
      return tokens;
    }
  
    function expandMacroTokens(tokens, locale) {
      var _Array$prototype;
  
      return (_Array$prototype = Array.prototype).concat.apply(_Array$prototype, tokens.map(function (t) {
        return maybeExpandMacroToken(t, locale);
      }));
    }
    /**
     * @private
     */
  
  
    function explainFromTokens(locale, input, format) {
      var tokens = expandMacroTokens(Formatter.parseFormat(format), locale),
          units = tokens.map(function (t) {
        return unitForToken(t, locale);
      }),
          disqualifyingUnit = units.find(function (t) {
        return t.invalidReason;
      });
  
      if (disqualifyingUnit) {
        return {
          input: input,
          tokens: tokens,
          invalidReason: disqualifyingUnit.invalidReason
        };
      } else {
        var _buildRegex = buildRegex(units),
            regexString = _buildRegex[0],
            handlers = _buildRegex[1],
            regex = RegExp(regexString, "i"),
            _match = match(input, regex, handlers),
            rawMatches = _match[0],
            matches = _match[1],
            _ref6 = matches ? dateTimeFromMatches(matches) : [null, null, undefined],
            result = _ref6[0],
            zone = _ref6[1],
            specificOffset = _ref6[2];
  
        if (hasOwnProperty(matches, "a") && hasOwnProperty(matches, "H")) {
          throw new ConflictingSpecificationError("Can't include meridiem when specifying 24-hour format");
        }
  
        return {
          input: input,
          tokens: tokens,
          regex: regex,
          rawMatches: rawMatches,
          matches: matches,
          result: result,
          zone: zone,
          specificOffset: specificOffset
        };
      }
    }
    function parseFromTokens(locale, input, format) {
      var _explainFromTokens = explainFromTokens(locale, input, format),
          result = _explainFromTokens.result,
          zone = _explainFromTokens.zone,
          specificOffset = _explainFromTokens.specificOffset,
          invalidReason = _explainFromTokens.invalidReason;
  
      return [result, zone, specificOffset, invalidReason];
    }
  
    var nonLeapLadder = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334],
        leapLadder = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
  
    function unitOutOfRange(unit, value) {
      return new Invalid("unit out of range", "you specified " + value + " (of type " + typeof value + ") as a " + unit + ", which is invalid");
    }
  
    function dayOfWeek(year, month, day) {
      var d = new Date(Date.UTC(year, month - 1, day));
  
      if (year < 100 && year >= 0) {
        d.setUTCFullYear(d.getUTCFullYear() - 1900);
      }
  
      var js = d.getUTCDay();
      return js === 0 ? 7 : js;
    }
  
    function computeOrdinal(year, month, day) {
      return day + (isLeapYear(year) ? leapLadder : nonLeapLadder)[month - 1];
    }
  
    function uncomputeOrdinal(year, ordinal) {
      var table = isLeapYear(year) ? leapLadder : nonLeapLadder,
          month0 = table.findIndex(function (i) {
        return i < ordinal;
      }),
          day = ordinal - table[month0];
      return {
        month: month0 + 1,
        day: day
      };
    }
    /**
     * @private
     */
  
  
    function gregorianToWeek(gregObj) {
      var year = gregObj.year,
          month = gregObj.month,
          day = gregObj.day,
          ordinal = computeOrdinal(year, month, day),
          weekday = dayOfWeek(year, month, day);
      var weekNumber = Math.floor((ordinal - weekday + 10) / 7),
          weekYear;
  
      if (weekNumber < 1) {
        weekYear = year - 1;
        weekNumber = weeksInWeekYear(weekYear);
      } else if (weekNumber > weeksInWeekYear(year)) {
        weekYear = year + 1;
        weekNumber = 1;
      } else {
        weekYear = year;
      }
  
      return _extends({
        weekYear: weekYear,
        weekNumber: weekNumber,
        weekday: weekday
      }, timeObject(gregObj));
    }
    function weekToGregorian(weekData) {
      var weekYear = weekData.weekYear,
          weekNumber = weekData.weekNumber,
          weekday = weekData.weekday,
          weekdayOfJan4 = dayOfWeek(weekYear, 1, 4),
          yearInDays = daysInYear(weekYear);
      var ordinal = weekNumber * 7 + weekday - weekdayOfJan4 - 3,
          year;
  
      if (ordinal < 1) {
        year = weekYear - 1;
        ordinal += daysInYear(year);
      } else if (ordinal > yearInDays) {
        year = weekYear + 1;
        ordinal -= daysInYear(weekYear);
      } else {
        year = weekYear;
      }
  
      var _uncomputeOrdinal = uncomputeOrdinal(year, ordinal),
          month = _uncomputeOrdinal.month,
          day = _uncomputeOrdinal.day;
  
      return _extends({
        year: year,
        month: month,
        day: day
      }, timeObject(weekData));
    }
    function gregorianToOrdinal(gregData) {
      var year = gregData.year,
          month = gregData.month,
          day = gregData.day;
      var ordinal = computeOrdinal(year, month, day);
      return _extends({
        year: year,
        ordinal: ordinal
      }, timeObject(gregData));
    }
    function ordinalToGregorian(ordinalData) {
      var year = ordinalData.year,
          ordinal = ordinalData.ordinal;
  
      var _uncomputeOrdinal2 = uncomputeOrdinal(year, ordinal),
          month = _uncomputeOrdinal2.month,
          day = _uncomputeOrdinal2.day;
  
      return _extends({
        year: year,
        month: month,
        day: day
      }, timeObject(ordinalData));
    }
    function hasInvalidWeekData(obj) {
      var validYear = isInteger(obj.weekYear),
          validWeek = integerBetween(obj.weekNumber, 1, weeksInWeekYear(obj.weekYear)),
          validWeekday = integerBetween(obj.weekday, 1, 7);
  
      if (!validYear) {
        return unitOutOfRange("weekYear", obj.weekYear);
      } else if (!validWeek) {
        return unitOutOfRange("week", obj.week);
      } else if (!validWeekday) {
        return unitOutOfRange("weekday", obj.weekday);
      } else return false;
    }
    function hasInvalidOrdinalData(obj) {
      var validYear = isInteger(obj.year),
          validOrdinal = integerBetween(obj.ordinal, 1, daysInYear(obj.year));
  
      if (!validYear) {
        return unitOutOfRange("year", obj.year);
      } else if (!validOrdinal) {
        return unitOutOfRange("ordinal", obj.ordinal);
      } else return false;
    }
    function hasInvalidGregorianData(obj) {
      var validYear = isInteger(obj.year),
          validMonth = integerBetween(obj.month, 1, 12),
          validDay = integerBetween(obj.day, 1, daysInMonth(obj.year, obj.month));
  
      if (!validYear) {
        return unitOutOfRange("year", obj.year);
      } else if (!validMonth) {
        return unitOutOfRange("month", obj.month);
      } else if (!validDay) {
        return unitOutOfRange("day", obj.day);
      } else return false;
    }
    function hasInvalidTimeData(obj) {
      var hour = obj.hour,
          minute = obj.minute,
          second = obj.second,
          millisecond = obj.millisecond;
      var validHour = integerBetween(hour, 0, 23) || hour === 24 && minute === 0 && second === 0 && millisecond === 0,
          validMinute = integerBetween(minute, 0, 59),
          validSecond = integerBetween(second, 0, 59),
          validMillisecond = integerBetween(millisecond, 0, 999);
  
      if (!validHour) {
        return unitOutOfRange("hour", hour);
      } else if (!validMinute) {
        return unitOutOfRange("minute", minute);
      } else if (!validSecond) {
        return unitOutOfRange("second", second);
      } else if (!validMillisecond) {
        return unitOutOfRange("millisecond", millisecond);
      } else return false;
    }
  
    var INVALID = "Invalid DateTime";
    var MAX_DATE = 8.64e15;
  
    function unsupportedZone(zone) {
      return new Invalid("unsupported zone", "the zone \"" + zone.name + "\" is not supported");
    } // we cache week data on the DT object and this intermediates the cache
  
  
    function possiblyCachedWeekData(dt) {
      if (dt.weekData === null) {
        dt.weekData = gregorianToWeek(dt.c);
      }
  
      return dt.weekData;
    } // clone really means, "make a new object with these modifications". all "setters" really use this
    // to create a new object while only changing some of the properties
  
  
    function clone(inst, alts) {
      var current = {
        ts: inst.ts,
        zone: inst.zone,
        c: inst.c,
        o: inst.o,
        loc: inst.loc,
        invalid: inst.invalid
      };
      return new DateTime(_extends({}, current, alts, {
        old: current
      }));
    } // find the right offset a given local time. The o input is our guess, which determines which
    // offset we'll pick in ambiguous cases (e.g. there are two 3 AMs b/c Fallback DST)
  
  
    function fixOffset(localTS, o, tz) {
      // Our UTC time is just a guess because our offset is just a guess
      var utcGuess = localTS - o * 60 * 1000; // Test whether the zone matches the offset for this ts
  
      var o2 = tz.offset(utcGuess); // If so, offset didn't change and we're done
  
      if (o === o2) {
        return [utcGuess, o];
      } // If not, change the ts by the difference in the offset
  
  
      utcGuess -= (o2 - o) * 60 * 1000; // If that gives us the local time we want, we're done
  
      var o3 = tz.offset(utcGuess);
  
      if (o2 === o3) {
        return [utcGuess, o2];
      } // If it's different, we're in a hole time. The offset has changed, but the we don't adjust the time
  
  
      return [localTS - Math.min(o2, o3) * 60 * 1000, Math.max(o2, o3)];
    } // convert an epoch timestamp into a calendar object with the given offset
  
  
    function tsToObj(ts, offset) {
      ts += offset * 60 * 1000;
      var d = new Date(ts);
      return {
        year: d.getUTCFullYear(),
        month: d.getUTCMonth() + 1,
        day: d.getUTCDate(),
        hour: d.getUTCHours(),
        minute: d.getUTCMinutes(),
        second: d.getUTCSeconds(),
        millisecond: d.getUTCMilliseconds()
      };
    } // convert a calendar object to a epoch timestamp
  
  
    function objToTS(obj, offset, zone) {
      return fixOffset(objToLocalTS(obj), offset, zone);
    } // create a new DT instance by adding a duration, adjusting for DSTs
  
  
    function adjustTime(inst, dur) {
      var oPre = inst.o,
          year = inst.c.year + Math.trunc(dur.years),
          month = inst.c.month + Math.trunc(dur.months) + Math.trunc(dur.quarters) * 3,
          c = _extends({}, inst.c, {
        year: year,
        month: month,
        day: Math.min(inst.c.day, daysInMonth(year, month)) + Math.trunc(dur.days) + Math.trunc(dur.weeks) * 7
      }),
          millisToAdd = Duration.fromObject({
        years: dur.years - Math.trunc(dur.years),
        quarters: dur.quarters - Math.trunc(dur.quarters),
        months: dur.months - Math.trunc(dur.months),
        weeks: dur.weeks - Math.trunc(dur.weeks),
        days: dur.days - Math.trunc(dur.days),
        hours: dur.hours,
        minutes: dur.minutes,
        seconds: dur.seconds,
        milliseconds: dur.milliseconds
      }).as("milliseconds"),
          localTS = objToLocalTS(c);
  
      var _fixOffset = fixOffset(localTS, oPre, inst.zone),
          ts = _fixOffset[0],
          o = _fixOffset[1];
  
      if (millisToAdd !== 0) {
        ts += millisToAdd; // that could have changed the offset by going over a DST, but we want to keep the ts the same
  
        o = inst.zone.offset(ts);
      }
  
      return {
        ts: ts,
        o: o
      };
    } // helper useful in turning the results of parsing into real dates
    // by handling the zone options
  
  
    function parseDataToDateTime(parsed, parsedZone, opts, format, text, specificOffset) {
      var setZone = opts.setZone,
          zone = opts.zone;
  
      if (parsed && Object.keys(parsed).length !== 0) {
        var interpretationZone = parsedZone || zone,
            inst = DateTime.fromObject(parsed, _extends({}, opts, {
          zone: interpretationZone,
          specificOffset: specificOffset
        }));
        return setZone ? inst : inst.setZone(zone);
      } else {
        return DateTime.invalid(new Invalid("unparsable", "the input \"" + text + "\" can't be parsed as " + format));
      }
    } // if you want to output a technical format (e.g. RFC 2822), this helper
    // helps handle the details
  
  
    function toTechFormat(dt, format, allowZ) {
      if (allowZ === void 0) {
        allowZ = true;
      }
  
      return dt.isValid ? Formatter.create(Locale.create("en-US"), {
        allowZ: allowZ,
        forceSimple: true
      }).formatDateTimeFromString(dt, format) : null;
    }
  
    function _toISODate(o, extended) {
      var longFormat = o.c.year > 9999 || o.c.year < 0;
      var c = "";
      if (longFormat && o.c.year >= 0) c += "+";
      c += padStart(o.c.year, longFormat ? 6 : 4);
  
      if (extended) {
        c += "-";
        c += padStart(o.c.month);
        c += "-";
        c += padStart(o.c.day);
      } else {
        c += padStart(o.c.month);
        c += padStart(o.c.day);
      }
  
      return c;
    }
  
    function _toISOTime(o, extended, suppressSeconds, suppressMilliseconds, includeOffset) {
      var c = padStart(o.c.hour);
  
      if (extended) {
        c += ":";
        c += padStart(o.c.minute);
  
        if (o.c.second !== 0 || !suppressSeconds) {
          c += ":";
        }
      } else {
        c += padStart(o.c.minute);
      }
  
      if (o.c.second !== 0 || !suppressSeconds) {
        c += padStart(o.c.second);
  
        if (o.c.millisecond !== 0 || !suppressMilliseconds) {
          c += ".";
          c += padStart(o.c.millisecond, 3);
        }
      }
  
      if (includeOffset) {
        if (o.isOffsetFixed && o.offset === 0) {
          c += "Z";
        } else if (o.o < 0) {
          c += "-";
          c += padStart(Math.trunc(-o.o / 60));
          c += ":";
          c += padStart(Math.trunc(-o.o % 60));
        } else {
          c += "+";
          c += padStart(Math.trunc(o.o / 60));
          c += ":";
          c += padStart(Math.trunc(o.o % 60));
        }
      }
  
      return c;
    } // defaults for unspecified units in the supported calendars
  
  
    var defaultUnitValues = {
      month: 1,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0
    },
        defaultWeekUnitValues = {
      weekNumber: 1,
      weekday: 1,
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0
    },
        defaultOrdinalUnitValues = {
      ordinal: 1,
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0
    }; // Units in the supported calendars, sorted by bigness
  
    var orderedUnits = ["year", "month", "day", "hour", "minute", "second", "millisecond"],
        orderedWeekUnits = ["weekYear", "weekNumber", "weekday", "hour", "minute", "second", "millisecond"],
        orderedOrdinalUnits = ["year", "ordinal", "hour", "minute", "second", "millisecond"]; // standardize case and plurality in units
  
    function normalizeUnit(unit) {
      var normalized = {
        year: "year",
        years: "year",
        month: "month",
        months: "month",
        day: "day",
        days: "day",
        hour: "hour",
        hours: "hour",
        minute: "minute",
        minutes: "minute",
        quarter: "quarter",
        quarters: "quarter",
        second: "second",
        seconds: "second",
        millisecond: "millisecond",
        milliseconds: "millisecond",
        weekday: "weekday",
        weekdays: "weekday",
        weeknumber: "weekNumber",
        weeksnumber: "weekNumber",
        weeknumbers: "weekNumber",
        weekyear: "weekYear",
        weekyears: "weekYear",
        ordinal: "ordinal"
      }[unit.toLowerCase()];
      if (!normalized) throw new InvalidUnitError(unit);
      return normalized;
    } // this is a dumbed down version of fromObject() that runs about 60% faster
    // but doesn't do any validation, makes a bunch of assumptions about what units
    // are present, and so on.
  
  
    function quickDT(obj, opts) {
      var zone = normalizeZone(opts.zone, Settings.defaultZone),
          loc = Locale.fromObject(opts),
          tsNow = Settings.now();
      var ts, o; // assume we have the higher-order units
  
      if (!isUndefined(obj.year)) {
        for (var _iterator = _createForOfIteratorHelperLoose(orderedUnits), _step; !(_step = _iterator()).done;) {
          var u = _step.value;
  
          if (isUndefined(obj[u])) {
            obj[u] = defaultUnitValues[u];
          }
        }
  
        var invalid = hasInvalidGregorianData(obj) || hasInvalidTimeData(obj);
  
        if (invalid) {
          return DateTime.invalid(invalid);
        }
  
        var offsetProvis = zone.offset(tsNow);
  
        var _objToTS = objToTS(obj, offsetProvis, zone);
  
        ts = _objToTS[0];
        o = _objToTS[1];
      } else {
        ts = tsNow;
      }
  
      return new DateTime({
        ts: ts,
        zone: zone,
        loc: loc,
        o: o
      });
    }
  
    function diffRelative(start, end, opts) {
      var round = isUndefined(opts.round) ? true : opts.round,
          format = function format(c, unit) {
        c = roundTo(c, round || opts.calendary ? 0 : 2, true);
        var formatter = end.loc.clone(opts).relFormatter(opts);
        return formatter.format(c, unit);
      },
          differ = function differ(unit) {
        if (opts.calendary) {
          if (!end.hasSame(start, unit)) {
            return end.startOf(unit).diff(start.startOf(unit), unit).get(unit);
          } else return 0;
        } else {
          return end.diff(start, unit).get(unit);
        }
      };
  
      if (opts.unit) {
        return format(differ(opts.unit), opts.unit);
      }
  
      for (var _iterator2 = _createForOfIteratorHelperLoose(opts.units), _step2; !(_step2 = _iterator2()).done;) {
        var unit = _step2.value;
        var count = differ(unit);
  
        if (Math.abs(count) >= 1) {
          return format(count, unit);
        }
      }
  
      return format(start > end ? -0 : 0, opts.units[opts.units.length - 1]);
    }
  
    function lastOpts(argList) {
      var opts = {},
          args;
  
      if (argList.length > 0 && typeof argList[argList.length - 1] === "object") {
        opts = argList[argList.length - 1];
        args = Array.from(argList).slice(0, argList.length - 1);
      } else {
        args = Array.from(argList);
      }
  
      return [opts, args];
    }
    /**
     * A DateTime is an immutable data structure representing a specific date and time and accompanying methods. It contains class and instance methods for creating, parsing, interrogating, transforming, and formatting them.
     *
     * A DateTime comprises of:
     * * A timestamp. Each DateTime instance refers to a specific millisecond of the Unix epoch.
     * * A time zone. Each instance is considered in the context of a specific zone (by default the local system's zone).
     * * Configuration properties that effect how output strings are formatted, such as `locale`, `numberingSystem`, and `outputCalendar`.
     *
     * Here is a brief overview of the most commonly used functionality it provides:
     *
     * * **Creation**: To create a DateTime from its components, use one of its factory class methods: {@link DateTime#local}, {@link DateTime#utc}, and (most flexibly) {@link DateTime#fromObject}. To create one from a standard string format, use {@link DateTime#fromISO}, {@link DateTime#fromHTTP}, and {@link DateTime#fromRFC2822}. To create one from a custom string format, use {@link DateTime#fromFormat}. To create one from a native JS date, use {@link DateTime#fromJSDate}.
     * * **Gregorian calendar and time**: To examine the Gregorian properties of a DateTime individually (i.e as opposed to collectively through {@link DateTime#toObject}), use the {@link DateTime#year}, {@link DateTime#month},
     * {@link DateTime#day}, {@link DateTime#hour}, {@link DateTime#minute}, {@link DateTime#second}, {@link DateTime#millisecond} accessors.
     * * **Week calendar**: For ISO week calendar attributes, see the {@link DateTime#weekYear}, {@link DateTime#weekNumber}, and {@link DateTime#weekday} accessors.
     * * **Configuration** See the {@link DateTime#locale} and {@link DateTime#numberingSystem} accessors.
     * * **Transformation**: To transform the DateTime into other DateTimes, use {@link DateTime#set}, {@link DateTime#reconfigure}, {@link DateTime#setZone}, {@link DateTime#setLocale}, {@link DateTime.plus}, {@link DateTime#minus}, {@link DateTime#endOf}, {@link DateTime#startOf}, {@link DateTime#toUTC}, and {@link DateTime#toLocal}.
     * * **Output**: To convert the DateTime to other representations, use the {@link DateTime#toRelative}, {@link DateTime#toRelativeCalendar}, {@link DateTime#toJSON}, {@link DateTime#toISO}, {@link DateTime#toHTTP}, {@link DateTime#toObject}, {@link DateTime#toRFC2822}, {@link DateTime#toString}, {@link DateTime#toLocaleString}, {@link DateTime#toFormat}, {@link DateTime#toMillis} and {@link DateTime#toJSDate}.
     *
     * There's plenty others documented below. In addition, for more information on subtler topics like internationalization, time zones, alternative calendars, validity, and so on, see the external documentation.
     */
  
  
    var DateTime = /*#__PURE__*/function () {
      /**
       * @access private
       */
      function DateTime(config) {
        var zone = config.zone || Settings.defaultZone;
        var invalid = config.invalid || (Number.isNaN(config.ts) ? new Invalid("invalid input") : null) || (!zone.isValid ? unsupportedZone(zone) : null);
        /**
         * @access private
         */
  
        this.ts = isUndefined(config.ts) ? Settings.now() : config.ts;
        var c = null,
            o = null;
  
        if (!invalid) {
          var unchanged = config.old && config.old.ts === this.ts && config.old.zone.equals(zone);
  
          if (unchanged) {
            var _ref = [config.old.c, config.old.o];
            c = _ref[0];
            o = _ref[1];
          } else {
            var ot = zone.offset(this.ts);
            c = tsToObj(this.ts, ot);
            invalid = Number.isNaN(c.year) ? new Invalid("invalid input") : null;
            c = invalid ? null : c;
            o = invalid ? null : ot;
          }
        }
        /**
         * @access private
         */
  
  
        this._zone = zone;
        /**
         * @access private
         */
  
        this.loc = config.loc || Locale.create();
        /**
         * @access private
         */
  
        this.invalid = invalid;
        /**
         * @access private
         */
  
        this.weekData = null;
        /**
         * @access private
         */
  
        this.c = c;
        /**
         * @access private
         */
  
        this.o = o;
        /**
         * @access private
         */
  
        this.isLuxonDateTime = true;
      } // CONSTRUCT
  
      /**
       * Create a DateTime for the current instant, in the system's time zone.
       *
       * Use Settings to override these default values if needed.
       * @example DateTime.now().toISO() //~> now in the ISO format
       * @return {DateTime}
       */
  
  
      DateTime.now = function now() {
        return new DateTime({});
      }
      /**
       * Create a local DateTime
       * @param {number} [year] - The calendar year. If omitted (as in, call `local()` with no arguments), the current time will be used
       * @param {number} [month=1] - The month, 1-indexed
       * @param {number} [day=1] - The day of the month, 1-indexed
       * @param {number} [hour=0] - The hour of the day, in 24-hour time
       * @param {number} [minute=0] - The minute of the hour, meaning a number between 0 and 59
       * @param {number} [second=0] - The second of the minute, meaning a number between 0 and 59
       * @param {number} [millisecond=0] - The millisecond of the second, meaning a number between 0 and 999
       * @example DateTime.local()                                  //~> now
       * @example DateTime.local({ zone: "America/New_York" })      //~> now, in US east coast time
       * @example DateTime.local(2017)                              //~> 2017-01-01T00:00:00
       * @example DateTime.local(2017, 3)                           //~> 2017-03-01T00:00:00
       * @example DateTime.local(2017, 3, 12, { locale: "fr" })     //~> 2017-03-12T00:00:00, with a French locale
       * @example DateTime.local(2017, 3, 12, 5)                    //~> 2017-03-12T05:00:00
       * @example DateTime.local(2017, 3, 12, 5, { zone: "utc" })   //~> 2017-03-12T05:00:00, in UTC
       * @example DateTime.local(2017, 3, 12, 5, 45)                //~> 2017-03-12T05:45:00
       * @example DateTime.local(2017, 3, 12, 5, 45, 10)            //~> 2017-03-12T05:45:10
       * @example DateTime.local(2017, 3, 12, 5, 45, 10, 765)       //~> 2017-03-12T05:45:10.765
       * @return {DateTime}
       */
      ;
  
      DateTime.local = function local() {
        var _lastOpts = lastOpts(arguments),
            opts = _lastOpts[0],
            args = _lastOpts[1],
            year = args[0],
            month = args[1],
            day = args[2],
            hour = args[3],
            minute = args[4],
            second = args[5],
            millisecond = args[6];
  
        return quickDT({
          year: year,
          month: month,
          day: day,
          hour: hour,
          minute: minute,
          second: second,
          millisecond: millisecond
        }, opts);
      }
      /**
       * Create a DateTime in UTC
       * @param {number} [year] - The calendar year. If omitted (as in, call `utc()` with no arguments), the current time will be used
       * @param {number} [month=1] - The month, 1-indexed
       * @param {number} [day=1] - The day of the month
       * @param {number} [hour=0] - The hour of the day, in 24-hour time
       * @param {number} [minute=0] - The minute of the hour, meaning a number between 0 and 59
       * @param {number} [second=0] - The second of the minute, meaning a number between 0 and 59
       * @param {number} [millisecond=0] - The millisecond of the second, meaning a number between 0 and 999
       * @param {Object} options - configuration options for the DateTime
       * @param {string} [options.locale] - a locale to set on the resulting DateTime instance
       * @param {string} [options.outputCalendar] - the output calendar to set on the resulting DateTime instance
       * @param {string} [options.numberingSystem] - the numbering system to set on the resulting DateTime instance
       * @example DateTime.utc()                                              //~> now
       * @example DateTime.utc(2017)                                          //~> 2017-01-01T00:00:00Z
       * @example DateTime.utc(2017, 3)                                       //~> 2017-03-01T00:00:00Z
       * @example DateTime.utc(2017, 3, 12)                                   //~> 2017-03-12T00:00:00Z
       * @example DateTime.utc(2017, 3, 12, 5)                                //~> 2017-03-12T05:00:00Z
       * @example DateTime.utc(2017, 3, 12, 5, 45)                            //~> 2017-03-12T05:45:00Z
       * @example DateTime.utc(2017, 3, 12, 5, 45, { locale: "fr" })          //~> 2017-03-12T05:45:00Z with a French locale
       * @example DateTime.utc(2017, 3, 12, 5, 45, 10)                        //~> 2017-03-12T05:45:10Z
       * @example DateTime.utc(2017, 3, 12, 5, 45, 10, 765, { locale: "fr" }) //~> 2017-03-12T05:45:10.765Z with a French locale
       * @return {DateTime}
       */
      ;
  
      DateTime.utc = function utc() {
        var _lastOpts2 = lastOpts(arguments),
            opts = _lastOpts2[0],
            args = _lastOpts2[1],
            year = args[0],
            month = args[1],
            day = args[2],
            hour = args[3],
            minute = args[4],
            second = args[5],
            millisecond = args[6];
  
        opts.zone = FixedOffsetZone.utcInstance;
        return quickDT({
          year: year,
          month: month,
          day: day,
          hour: hour,
          minute: minute,
          second: second,
          millisecond: millisecond
        }, opts);
      }
      /**
       * Create a DateTime from a JavaScript Date object. Uses the default zone.
       * @param {Date} date - a JavaScript Date object
       * @param {Object} options - configuration options for the DateTime
       * @param {string|Zone} [options.zone='local'] - the zone to place the DateTime into
       * @return {DateTime}
       */
      ;
  
      DateTime.fromJSDate = function fromJSDate(date, options) {
        if (options === void 0) {
          options = {};
        }
  
        var ts = isDate(date) ? date.valueOf() : NaN;
  
        if (Number.isNaN(ts)) {
          return DateTime.invalid("invalid input");
        }
  
        var zoneToUse = normalizeZone(options.zone, Settings.defaultZone);
  
        if (!zoneToUse.isValid) {
          return DateTime.invalid(unsupportedZone(zoneToUse));
        }
  
        return new DateTime({
          ts: ts,
          zone: zoneToUse,
          loc: Locale.fromObject(options)
        });
      }
      /**
       * Create a DateTime from a number of milliseconds since the epoch (meaning since 1 January 1970 00:00:00 UTC). Uses the default zone.
       * @param {number} milliseconds - a number of milliseconds since 1970 UTC
       * @param {Object} options - configuration options for the DateTime
       * @param {string|Zone} [options.zone='local'] - the zone to place the DateTime into
       * @param {string} [options.locale] - a locale to set on the resulting DateTime instance
       * @param {string} options.outputCalendar - the output calendar to set on the resulting DateTime instance
       * @param {string} options.numberingSystem - the numbering system to set on the resulting DateTime instance
       * @return {DateTime}
       */
      ;
  
      DateTime.fromMillis = function fromMillis(milliseconds, options) {
        if (options === void 0) {
          options = {};
        }
  
        if (!isNumber(milliseconds)) {
          throw new InvalidArgumentError("fromMillis requires a numerical input, but received a " + typeof milliseconds + " with value " + milliseconds);
        } else if (milliseconds < -MAX_DATE || milliseconds > MAX_DATE) {
          // this isn't perfect because because we can still end up out of range because of additional shifting, but it's a start
          return DateTime.invalid("Timestamp out of range");
        } else {
          return new DateTime({
            ts: milliseconds,
            zone: normalizeZone(options.zone, Settings.defaultZone),
            loc: Locale.fromObject(options)
          });
        }
      }
      /**
       * Create a DateTime from a number of seconds since the epoch (meaning since 1 January 1970 00:00:00 UTC). Uses the default zone.
       * @param {number} seconds - a number of seconds since 1970 UTC
       * @param {Object} options - configuration options for the DateTime
       * @param {string|Zone} [options.zone='local'] - the zone to place the DateTime into
       * @param {string} [options.locale] - a locale to set on the resulting DateTime instance
       * @param {string} options.outputCalendar - the output calendar to set on the resulting DateTime instance
       * @param {string} options.numberingSystem - the numbering system to set on the resulting DateTime instance
       * @return {DateTime}
       */
      ;
  
      DateTime.fromSeconds = function fromSeconds(seconds, options) {
        if (options === void 0) {
          options = {};
        }
  
        if (!isNumber(seconds)) {
          throw new InvalidArgumentError("fromSeconds requires a numerical input");
        } else {
          return new DateTime({
            ts: seconds * 1000,
            zone: normalizeZone(options.zone, Settings.defaultZone),
            loc: Locale.fromObject(options)
          });
        }
      }
      /**
       * Create a DateTime from a JavaScript object with keys like 'year' and 'hour' with reasonable defaults.
       * @param {Object} obj - the object to create the DateTime from
       * @param {number} obj.year - a year, such as 1987
       * @param {number} obj.month - a month, 1-12
       * @param {number} obj.day - a day of the month, 1-31, depending on the month
       * @param {number} obj.ordinal - day of the year, 1-365 or 366
       * @param {number} obj.weekYear - an ISO week year
       * @param {number} obj.weekNumber - an ISO week number, between 1 and 52 or 53, depending on the year
       * @param {number} obj.weekday - an ISO weekday, 1-7, where 1 is Monday and 7 is Sunday
       * @param {number} obj.hour - hour of the day, 0-23
       * @param {number} obj.minute - minute of the hour, 0-59
       * @param {number} obj.second - second of the minute, 0-59
       * @param {number} obj.millisecond - millisecond of the second, 0-999
       * @param {Object} opts - options for creating this DateTime
       * @param {string|Zone} [opts.zone='local'] - interpret the numbers in the context of a particular zone. Can take any value taken as the first argument to setZone()
       * @param {string} [opts.locale='system's locale'] - a locale to set on the resulting DateTime instance
       * @param {string} opts.outputCalendar - the output calendar to set on the resulting DateTime instance
       * @param {string} opts.numberingSystem - the numbering system to set on the resulting DateTime instance
       * @example DateTime.fromObject({ year: 1982, month: 5, day: 25}).toISODate() //=> '1982-05-25'
       * @example DateTime.fromObject({ year: 1982 }).toISODate() //=> '1982-01-01'
       * @example DateTime.fromObject({ hour: 10, minute: 26, second: 6 }) //~> today at 10:26:06
       * @example DateTime.fromObject({ hour: 10, minute: 26, second: 6 }, { zone: 'utc' }),
       * @example DateTime.fromObject({ hour: 10, minute: 26, second: 6 }, { zone: 'local' })
       * @example DateTime.fromObject({ hour: 10, minute: 26, second: 6 }, { zone: 'America/New_York' })
       * @example DateTime.fromObject({ weekYear: 2016, weekNumber: 2, weekday: 3 }).toISODate() //=> '2016-01-13'
       * @return {DateTime}
       */
      ;
  
      DateTime.fromObject = function fromObject(obj, opts) {
        if (opts === void 0) {
          opts = {};
        }
  
        obj = obj || {};
        var zoneToUse = normalizeZone(opts.zone, Settings.defaultZone);
  
        if (!zoneToUse.isValid) {
          return DateTime.invalid(unsupportedZone(zoneToUse));
        }
  
        var tsNow = Settings.now(),
            offsetProvis = !isUndefined(opts.specificOffset) ? opts.specificOffset : zoneToUse.offset(tsNow),
            normalized = normalizeObject(obj, normalizeUnit),
            containsOrdinal = !isUndefined(normalized.ordinal),
            containsGregorYear = !isUndefined(normalized.year),
            containsGregorMD = !isUndefined(normalized.month) || !isUndefined(normalized.day),
            containsGregor = containsGregorYear || containsGregorMD,
            definiteWeekDef = normalized.weekYear || normalized.weekNumber,
            loc = Locale.fromObject(opts); // cases:
        // just a weekday -> this week's instance of that weekday, no worries
        // (gregorian data or ordinal) + (weekYear or weekNumber) -> error
        // (gregorian month or day) + ordinal -> error
        // otherwise just use weeks or ordinals or gregorian, depending on what's specified
  
        if ((containsGregor || containsOrdinal) && definiteWeekDef) {
          throw new ConflictingSpecificationError("Can't mix weekYear/weekNumber units with year/month/day or ordinals");
        }
  
        if (containsGregorMD && containsOrdinal) {
          throw new ConflictingSpecificationError("Can't mix ordinal dates with month/day");
        }
  
        var useWeekData = definiteWeekDef || normalized.weekday && !containsGregor; // configure ourselves to deal with gregorian dates or week stuff
  
        var units,
            defaultValues,
            objNow = tsToObj(tsNow, offsetProvis);
  
        if (useWeekData) {
          units = orderedWeekUnits;
          defaultValues = defaultWeekUnitValues;
          objNow = gregorianToWeek(objNow);
        } else if (containsOrdinal) {
          units = orderedOrdinalUnits;
          defaultValues = defaultOrdinalUnitValues;
          objNow = gregorianToOrdinal(objNow);
        } else {
          units = orderedUnits;
          defaultValues = defaultUnitValues;
        } // set default values for missing stuff
  
  
        var foundFirst = false;
  
        for (var _iterator3 = _createForOfIteratorHelperLoose(units), _step3; !(_step3 = _iterator3()).done;) {
          var u = _step3.value;
          var v = normalized[u];
  
          if (!isUndefined(v)) {
            foundFirst = true;
          } else if (foundFirst) {
            normalized[u] = defaultValues[u];
          } else {
            normalized[u] = objNow[u];
          }
        } // make sure the values we have are in range
  
  
        var higherOrderInvalid = useWeekData ? hasInvalidWeekData(normalized) : containsOrdinal ? hasInvalidOrdinalData(normalized) : hasInvalidGregorianData(normalized),
            invalid = higherOrderInvalid || hasInvalidTimeData(normalized);
  
        if (invalid) {
          return DateTime.invalid(invalid);
        } // compute the actual time
  
  
        var gregorian = useWeekData ? weekToGregorian(normalized) : containsOrdinal ? ordinalToGregorian(normalized) : normalized,
            _objToTS2 = objToTS(gregorian, offsetProvis, zoneToUse),
            tsFinal = _objToTS2[0],
            offsetFinal = _objToTS2[1],
            inst = new DateTime({
          ts: tsFinal,
          zone: zoneToUse,
          o: offsetFinal,
          loc: loc
        }); // gregorian data + weekday serves only to validate
  
  
        if (normalized.weekday && containsGregor && obj.weekday !== inst.weekday) {
          return DateTime.invalid("mismatched weekday", "you can't specify both a weekday of " + normalized.weekday + " and a date of " + inst.toISO());
        }
  
        return inst;
      }
      /**
       * Create a DateTime from an ISO 8601 string
       * @param {string} text - the ISO string
       * @param {Object} opts - options to affect the creation
       * @param {string|Zone} [opts.zone='local'] - use this zone if no offset is specified in the input string itself. Will also convert the time to this zone
       * @param {boolean} [opts.setZone=false] - override the zone with a fixed-offset zone specified in the string itself, if it specifies one
       * @param {string} [opts.locale='system's locale'] - a locale to set on the resulting DateTime instance
       * @param {string} [opts.outputCalendar] - the output calendar to set on the resulting DateTime instance
       * @param {string} [opts.numberingSystem] - the numbering system to set on the resulting DateTime instance
       * @example DateTime.fromISO('2016-05-25T09:08:34.123')
       * @example DateTime.fromISO('2016-05-25T09:08:34.123+06:00')
       * @example DateTime.fromISO('2016-05-25T09:08:34.123+06:00', {setZone: true})
       * @example DateTime.fromISO('2016-05-25T09:08:34.123', {zone: 'utc'})
       * @example DateTime.fromISO('2016-W05-4')
       * @return {DateTime}
       */
      ;
  
      DateTime.fromISO = function fromISO(text, opts) {
        if (opts === void 0) {
          opts = {};
        }
  
        var _parseISODate = parseISODate(text),
            vals = _parseISODate[0],
            parsedZone = _parseISODate[1];
  
        return parseDataToDateTime(vals, parsedZone, opts, "ISO 8601", text);
      }
      /**
       * Create a DateTime from an RFC 2822 string
       * @param {string} text - the RFC 2822 string
       * @param {Object} opts - options to affect the creation
       * @param {string|Zone} [opts.zone='local'] - convert the time to this zone. Since the offset is always specified in the string itself, this has no effect on the interpretation of string, merely the zone the resulting DateTime is expressed in.
       * @param {boolean} [opts.setZone=false] - override the zone with a fixed-offset zone specified in the string itself, if it specifies one
       * @param {string} [opts.locale='system's locale'] - a locale to set on the resulting DateTime instance
       * @param {string} opts.outputCalendar - the output calendar to set on the resulting DateTime instance
       * @param {string} opts.numberingSystem - the numbering system to set on the resulting DateTime instance
       * @example DateTime.fromRFC2822('25 Nov 2016 13:23:12 GMT')
       * @example DateTime.fromRFC2822('Fri, 25 Nov 2016 13:23:12 +0600')
       * @example DateTime.fromRFC2822('25 Nov 2016 13:23 Z')
       * @return {DateTime}
       */
      ;
  
      DateTime.fromRFC2822 = function fromRFC2822(text, opts) {
        if (opts === void 0) {
          opts = {};
        }
  
        var _parseRFC2822Date = parseRFC2822Date(text),
            vals = _parseRFC2822Date[0],
            parsedZone = _parseRFC2822Date[1];
  
        return parseDataToDateTime(vals, parsedZone, opts, "RFC 2822", text);
      }
      /**
       * Create a DateTime from an HTTP header date
       * @see https://www.w3.org/Protocols/rfc2616/rfc2616-sec3.html#sec3.3.1
       * @param {string} text - the HTTP header date
       * @param {Object} opts - options to affect the creation
       * @param {string|Zone} [opts.zone='local'] - convert the time to this zone. Since HTTP dates are always in UTC, this has no effect on the interpretation of string, merely the zone the resulting DateTime is expressed in.
       * @param {boolean} [opts.setZone=false] - override the zone with the fixed-offset zone specified in the string. For HTTP dates, this is always UTC, so this option is equivalent to setting the `zone` option to 'utc', but this option is included for consistency with similar methods.
       * @param {string} [opts.locale='system's locale'] - a locale to set on the resulting DateTime instance
       * @param {string} opts.outputCalendar - the output calendar to set on the resulting DateTime instance
       * @param {string} opts.numberingSystem - the numbering system to set on the resulting DateTime instance
       * @example DateTime.fromHTTP('Sun, 06 Nov 1994 08:49:37 GMT')
       * @example DateTime.fromHTTP('Sunday, 06-Nov-94 08:49:37 GMT')
       * @example DateTime.fromHTTP('Sun Nov  6 08:49:37 1994')
       * @return {DateTime}
       */
      ;
  
      DateTime.fromHTTP = function fromHTTP(text, opts) {
        if (opts === void 0) {
          opts = {};
        }
  
        var _parseHTTPDate = parseHTTPDate(text),
            vals = _parseHTTPDate[0],
            parsedZone = _parseHTTPDate[1];
  
        return parseDataToDateTime(vals, parsedZone, opts, "HTTP", opts);
      }
      /**
       * Create a DateTime from an input string and format string.
       * Defaults to en-US if no locale has been specified, regardless of the system's locale. For a table of tokens and their interpretations, see [here](https://moment.github.io/luxon/#/parsing?id=table-of-tokens).
       * @param {string} text - the string to parse
       * @param {string} fmt - the format the string is expected to be in (see the link below for the formats)
       * @param {Object} opts - options to affect the creation
       * @param {string|Zone} [opts.zone='local'] - use this zone if no offset is specified in the input string itself. Will also convert the DateTime to this zone
       * @param {boolean} [opts.setZone=false] - override the zone with a zone specified in the string itself, if it specifies one
       * @param {string} [opts.locale='en-US'] - a locale string to use when parsing. Will also set the DateTime to this locale
       * @param {string} opts.numberingSystem - the numbering system to use when parsing. Will also set the resulting DateTime to this numbering system
       * @param {string} opts.outputCalendar - the output calendar to set on the resulting DateTime instance
       * @return {DateTime}
       */
      ;
  
      DateTime.fromFormat = function fromFormat(text, fmt, opts) {
        if (opts === void 0) {
          opts = {};
        }
  
        if (isUndefined(text) || isUndefined(fmt)) {
          throw new InvalidArgumentError("fromFormat requires an input string and a format");
        }
  
        var _opts = opts,
            _opts$locale = _opts.locale,
            locale = _opts$locale === void 0 ? null : _opts$locale,
            _opts$numberingSystem = _opts.numberingSystem,
            numberingSystem = _opts$numberingSystem === void 0 ? null : _opts$numberingSystem,
            localeToUse = Locale.fromOpts({
          locale: locale,
          numberingSystem: numberingSystem,
          defaultToEN: true
        }),
            _parseFromTokens = parseFromTokens(localeToUse, text, fmt),
            vals = _parseFromTokens[0],
            parsedZone = _parseFromTokens[1],
            specificOffset = _parseFromTokens[2],
            invalid = _parseFromTokens[3];
  
        if (invalid) {
          return DateTime.invalid(invalid);
        } else {
          return parseDataToDateTime(vals, parsedZone, opts, "format " + fmt, text, specificOffset);
        }
      }
      /**
       * @deprecated use fromFormat instead
       */
      ;
  
      DateTime.fromString = function fromString(text, fmt, opts) {
        if (opts === void 0) {
          opts = {};
        }
  
        return DateTime.fromFormat(text, fmt, opts);
      }
      /**
       * Create a DateTime from a SQL date, time, or datetime
       * Defaults to en-US if no locale has been specified, regardless of the system's locale
       * @param {string} text - the string to parse
       * @param {Object} opts - options to affect the creation
       * @param {string|Zone} [opts.zone='local'] - use this zone if no offset is specified in the input string itself. Will also convert the DateTime to this zone
       * @param {boolean} [opts.setZone=false] - override the zone with a zone specified in the string itself, if it specifies one
       * @param {string} [opts.locale='en-US'] - a locale string to use when parsing. Will also set the DateTime to this locale
       * @param {string} opts.numberingSystem - the numbering system to use when parsing. Will also set the resulting DateTime to this numbering system
       * @param {string} opts.outputCalendar - the output calendar to set on the resulting DateTime instance
       * @example DateTime.fromSQL('2017-05-15')
       * @example DateTime.fromSQL('2017-05-15 09:12:34')
       * @example DateTime.fromSQL('2017-05-15 09:12:34.342')
       * @example DateTime.fromSQL('2017-05-15 09:12:34.342+06:00')
       * @example DateTime.fromSQL('2017-05-15 09:12:34.342 America/Los_Angeles')
       * @example DateTime.fromSQL('2017-05-15 09:12:34.342 America/Los_Angeles', { setZone: true })
       * @example DateTime.fromSQL('2017-05-15 09:12:34.342', { zone: 'America/Los_Angeles' })
       * @example DateTime.fromSQL('09:12:34.342')
       * @return {DateTime}
       */
      ;
  
      DateTime.fromSQL = function fromSQL(text, opts) {
        if (opts === void 0) {
          opts = {};
        }
  
        var _parseSQL = parseSQL(text),
            vals = _parseSQL[0],
            parsedZone = _parseSQL[1];
  
        return parseDataToDateTime(vals, parsedZone, opts, "SQL", text);
      }
      /**
       * Create an invalid DateTime.
       * @param {string} reason - simple string of why this DateTime is invalid. Should not contain parameters or anything else data-dependent
       * @param {string} [explanation=null] - longer explanation, may include parameters and other useful debugging information
       * @return {DateTime}
       */
      ;
  
      DateTime.invalid = function invalid(reason, explanation) {
        if (explanation === void 0) {
          explanation = null;
        }
  
        if (!reason) {
          throw new InvalidArgumentError("need to specify a reason the DateTime is invalid");
        }
  
        var invalid = reason instanceof Invalid ? reason : new Invalid(reason, explanation);
  
        if (Settings.throwOnInvalid) {
          throw new InvalidDateTimeError(invalid);
        } else {
          return new DateTime({
            invalid: invalid
          });
        }
      }
      /**
       * Check if an object is an instance of DateTime. Works across context boundaries
       * @param {object} o
       * @return {boolean}
       */
      ;
  
      DateTime.isDateTime = function isDateTime(o) {
        return o && o.isLuxonDateTime || false;
      } // INFO
  
      /**
       * Get the value of unit.
       * @param {string} unit - a unit such as 'minute' or 'day'
       * @example DateTime.local(2017, 7, 4).get('month'); //=> 7
       * @example DateTime.local(2017, 7, 4).get('day'); //=> 4
       * @return {number}
       */
      ;
  
      var _proto = DateTime.prototype;
  
      _proto.get = function get(unit) {
        return this[unit];
      }
      /**
       * Returns whether the DateTime is valid. Invalid DateTimes occur when:
       * * The DateTime was created from invalid calendar information, such as the 13th month or February 30
       * * The DateTime was created by an operation on another invalid date
       * @type {boolean}
       */
      ;
  
      /**
       * Returns the resolved Intl options for this DateTime.
       * This is useful in understanding the behavior of formatting methods
       * @param {Object} opts - the same options as toLocaleString
       * @return {Object}
       */
      _proto.resolvedLocaleOptions = function resolvedLocaleOptions(opts) {
        if (opts === void 0) {
          opts = {};
        }
  
        var _Formatter$create$res = Formatter.create(this.loc.clone(opts), opts).resolvedOptions(this),
            locale = _Formatter$create$res.locale,
            numberingSystem = _Formatter$create$res.numberingSystem,
            calendar = _Formatter$create$res.calendar;
  
        return {
          locale: locale,
          numberingSystem: numberingSystem,
          outputCalendar: calendar
        };
      } // TRANSFORM
  
      /**
       * "Set" the DateTime's zone to UTC. Returns a newly-constructed DateTime.
       *
       * Equivalent to {@link DateTime#setZone}('utc')
       * @param {number} [offset=0] - optionally, an offset from UTC in minutes
       * @param {Object} [opts={}] - options to pass to `setZone()`
       * @return {DateTime}
       */
      ;
  
      _proto.toUTC = function toUTC(offset, opts) {
        if (offset === void 0) {
          offset = 0;
        }
  
        if (opts === void 0) {
          opts = {};
        }
  
        return this.setZone(FixedOffsetZone.instance(offset), opts);
      }
      /**
       * "Set" the DateTime's zone to the host's local zone. Returns a newly-constructed DateTime.
       *
       * Equivalent to `setZone('local')`
       * @return {DateTime}
       */
      ;
  
      _proto.toLocal = function toLocal() {
        return this.setZone(Settings.defaultZone);
      }
      /**
       * "Set" the DateTime's zone to specified zone. Returns a newly-constructed DateTime.
       *
       * By default, the setter keeps the underlying time the same (as in, the same timestamp), but the new instance will report different local times and consider DSTs when making computations, as with {@link DateTime#plus}. You may wish to use {@link DateTime#toLocal} and {@link DateTime#toUTC} which provide simple convenience wrappers for commonly used zones.
       * @param {string|Zone} [zone='local'] - a zone identifier. As a string, that can be any IANA zone supported by the host environment, or a fixed-offset name of the form 'UTC+3', or the strings 'local' or 'utc'. You may also supply an instance of a {@link DateTime#Zone} class.
       * @param {Object} opts - options
       * @param {boolean} [opts.keepLocalTime=false] - If true, adjust the underlying time so that the local time stays the same, but in the target zone. You should rarely need this.
       * @return {DateTime}
       */
      ;
  
      _proto.setZone = function setZone(zone, _temp) {
        var _ref2 = _temp === void 0 ? {} : _temp,
            _ref2$keepLocalTime = _ref2.keepLocalTime,
            keepLocalTime = _ref2$keepLocalTime === void 0 ? false : _ref2$keepLocalTime,
            _ref2$keepCalendarTim = _ref2.keepCalendarTime,
            keepCalendarTime = _ref2$keepCalendarTim === void 0 ? false : _ref2$keepCalendarTim;
  
        zone = normalizeZone(zone, Settings.defaultZone);
  
        if (zone.equals(this.zone)) {
          return this;
        } else if (!zone.isValid) {
          return DateTime.invalid(unsupportedZone(zone));
        } else {
          var newTS = this.ts;
  
          if (keepLocalTime || keepCalendarTime) {
            var offsetGuess = zone.offset(this.ts);
            var asObj = this.toObject();
  
            var _objToTS3 = objToTS(asObj, offsetGuess, zone);
  
            newTS = _objToTS3[0];
          }
  
          return clone(this, {
            ts: newTS,
            zone: zone
          });
        }
      }
      /**
       * "Set" the locale, numberingSystem, or outputCalendar. Returns a newly-constructed DateTime.
       * @param {Object} properties - the properties to set
       * @example DateTime.local(2017, 5, 25).reconfigure({ locale: 'en-GB' })
       * @return {DateTime}
       */
      ;
  
      _proto.reconfigure = function reconfigure(_temp2) {
        var _ref3 = _temp2 === void 0 ? {} : _temp2,
            locale = _ref3.locale,
            numberingSystem = _ref3.numberingSystem,
            outputCalendar = _ref3.outputCalendar;
  
        var loc = this.loc.clone({
          locale: locale,
          numberingSystem: numberingSystem,
          outputCalendar: outputCalendar
        });
        return clone(this, {
          loc: loc
        });
      }
      /**
       * "Set" the locale. Returns a newly-constructed DateTime.
       * Just a convenient alias for reconfigure({ locale })
       * @example DateTime.local(2017, 5, 25).setLocale('en-GB')
       * @return {DateTime}
       */
      ;
  
      _proto.setLocale = function setLocale(locale) {
        return this.reconfigure({
          locale: locale
        });
      }
      /**
       * "Set" the values of specified units. Returns a newly-constructed DateTime.
       * You can only set units with this method; for "setting" metadata, see {@link DateTime#reconfigure} and {@link DateTime#setZone}.
       * @param {Object} values - a mapping of units to numbers
       * @example dt.set({ year: 2017 })
       * @example dt.set({ hour: 8, minute: 30 })
       * @example dt.set({ weekday: 5 })
       * @example dt.set({ year: 2005, ordinal: 234 })
       * @return {DateTime}
       */
      ;
  
      _proto.set = function set(values) {
        if (!this.isValid) return this;
        var normalized = normalizeObject(values, normalizeUnit),
            settingWeekStuff = !isUndefined(normalized.weekYear) || !isUndefined(normalized.weekNumber) || !isUndefined(normalized.weekday),
            containsOrdinal = !isUndefined(normalized.ordinal),
            containsGregorYear = !isUndefined(normalized.year),
            containsGregorMD = !isUndefined(normalized.month) || !isUndefined(normalized.day),
            containsGregor = containsGregorYear || containsGregorMD,
            definiteWeekDef = normalized.weekYear || normalized.weekNumber;
  
        if ((containsGregor || containsOrdinal) && definiteWeekDef) {
          throw new ConflictingSpecificationError("Can't mix weekYear/weekNumber units with year/month/day or ordinals");
        }
  
        if (containsGregorMD && containsOrdinal) {
          throw new ConflictingSpecificationError("Can't mix ordinal dates with month/day");
        }
  
        var mixed;
  
        if (settingWeekStuff) {
          mixed = weekToGregorian(_extends({}, gregorianToWeek(this.c), normalized));
        } else if (!isUndefined(normalized.ordinal)) {
          mixed = ordinalToGregorian(_extends({}, gregorianToOrdinal(this.c), normalized));
        } else {
          mixed = _extends({}, this.toObject(), normalized); // if we didn't set the day but we ended up on an overflow date,
          // use the last day of the right month
  
          if (isUndefined(normalized.day)) {
            mixed.day = Math.min(daysInMonth(mixed.year, mixed.month), mixed.day);
          }
        }
  
        var _objToTS4 = objToTS(mixed, this.o, this.zone),
            ts = _objToTS4[0],
            o = _objToTS4[1];
  
        return clone(this, {
          ts: ts,
          o: o
        });
      }
      /**
       * Add a period of time to this DateTime and return the resulting DateTime
       *
       * Adding hours, minutes, seconds, or milliseconds increases the timestamp by the right number of milliseconds. Adding days, months, or years shifts the calendar, accounting for DSTs and leap years along the way. Thus, `dt.plus({ hours: 24 })` may result in a different time than `dt.plus({ days: 1 })` if there's a DST shift in between.
       * @param {Duration|Object|number} duration - The amount to add. Either a Luxon Duration, a number of milliseconds, the object argument to Duration.fromObject()
       * @example DateTime.now().plus(123) //~> in 123 milliseconds
       * @example DateTime.now().plus({ minutes: 15 }) //~> in 15 minutes
       * @example DateTime.now().plus({ days: 1 }) //~> this time tomorrow
       * @example DateTime.now().plus({ days: -1 }) //~> this time yesterday
       * @example DateTime.now().plus({ hours: 3, minutes: 13 }) //~> in 3 hr, 13 min
       * @example DateTime.now().plus(Duration.fromObject({ hours: 3, minutes: 13 })) //~> in 3 hr, 13 min
       * @return {DateTime}
       */
      ;
  
      _proto.plus = function plus(duration) {
        if (!this.isValid) return this;
        var dur = Duration.fromDurationLike(duration);
        return clone(this, adjustTime(this, dur));
      }
      /**
       * Subtract a period of time to this DateTime and return the resulting DateTime
       * See {@link DateTime#plus}
       * @param {Duration|Object|number} duration - The amount to subtract. Either a Luxon Duration, a number of milliseconds, the object argument to Duration.fromObject()
       @return {DateTime}
       */
      ;
  
      _proto.minus = function minus(duration) {
        if (!this.isValid) return this;
        var dur = Duration.fromDurationLike(duration).negate();
        return clone(this, adjustTime(this, dur));
      }
      /**
       * "Set" this DateTime to the beginning of a unit of time.
       * @param {string} unit - The unit to go to the beginning of. Can be 'year', 'quarter', 'month', 'week', 'day', 'hour', 'minute', 'second', or 'millisecond'.
       * @example DateTime.local(2014, 3, 3).startOf('month').toISODate(); //=> '2014-03-01'
       * @example DateTime.local(2014, 3, 3).startOf('year').toISODate(); //=> '2014-01-01'
       * @example DateTime.local(2014, 3, 3).startOf('week').toISODate(); //=> '2014-03-03', weeks always start on Mondays
       * @example DateTime.local(2014, 3, 3, 5, 30).startOf('day').toISOTime(); //=> '00:00.000-05:00'
       * @example DateTime.local(2014, 3, 3, 5, 30).startOf('hour').toISOTime(); //=> '05:00:00.000-05:00'
       * @return {DateTime}
       */
      ;
  
      _proto.startOf = function startOf(unit) {
        if (!this.isValid) return this;
        var o = {},
            normalizedUnit = Duration.normalizeUnit(unit);
  
        switch (normalizedUnit) {
          case "years":
            o.month = 1;
          // falls through
  
          case "quarters":
          case "months":
            o.day = 1;
          // falls through
  
          case "weeks":
          case "days":
            o.hour = 0;
          // falls through
  
          case "hours":
            o.minute = 0;
          // falls through
  
          case "minutes":
            o.second = 0;
          // falls through
  
          case "seconds":
            o.millisecond = 0;
            break;
          // no default, invalid units throw in normalizeUnit()
        }
  
        if (normalizedUnit === "weeks") {
          o.weekday = 1;
        }
  
        if (normalizedUnit === "quarters") {
          var q = Math.ceil(this.month / 3);
          o.month = (q - 1) * 3 + 1;
        }
  
        return this.set(o);
      }
      /**
       * "Set" this DateTime to the end (meaning the last millisecond) of a unit of time
       * @param {string} unit - The unit to go to the end of. Can be 'year', 'quarter', 'month', 'week', 'day', 'hour', 'minute', 'second', or 'millisecond'.
       * @example DateTime.local(2014, 3, 3).endOf('month').toISO(); //=> '2014-03-31T23:59:59.999-05:00'
       * @example DateTime.local(2014, 3, 3).endOf('year').toISO(); //=> '2014-12-31T23:59:59.999-05:00'
       * @example DateTime.local(2014, 3, 3).endOf('week').toISO(); // => '2014-03-09T23:59:59.999-05:00', weeks start on Mondays
       * @example DateTime.local(2014, 3, 3, 5, 30).endOf('day').toISO(); //=> '2014-03-03T23:59:59.999-05:00'
       * @example DateTime.local(2014, 3, 3, 5, 30).endOf('hour').toISO(); //=> '2014-03-03T05:59:59.999-05:00'
       * @return {DateTime}
       */
      ;
  
      _proto.endOf = function endOf(unit) {
        var _this$plus;
  
        return this.isValid ? this.plus((_this$plus = {}, _this$plus[unit] = 1, _this$plus)).startOf(unit).minus(1) : this;
      } // OUTPUT
  
      /**
       * Returns a string representation of this DateTime formatted according to the specified format string.
       * **You may not want this.** See {@link DateTime#toLocaleString} for a more flexible formatting tool. For a table of tokens and their interpretations, see [here](https://moment.github.io/luxon/#/formatting?id=table-of-tokens).
       * Defaults to en-US if no locale has been specified, regardless of the system's locale.
       * @param {string} fmt - the format string
       * @param {Object} opts - opts to override the configuration options on this DateTime
       * @example DateTime.now().toFormat('yyyy LLL dd') //=> '2017 Apr 22'
       * @example DateTime.now().setLocale('fr').toFormat('yyyy LLL dd') //=> '2017 avr. 22'
       * @example DateTime.now().toFormat('yyyy LLL dd', { locale: "fr" }) //=> '2017 avr. 22'
       * @example DateTime.now().toFormat("HH 'hours and' mm 'minutes'") //=> '20 hours and 55 minutes'
       * @return {string}
       */
      ;
  
      _proto.toFormat = function toFormat(fmt, opts) {
        if (opts === void 0) {
          opts = {};
        }
  
        return this.isValid ? Formatter.create(this.loc.redefaultToEN(opts)).formatDateTimeFromString(this, fmt) : INVALID;
      }
      /**
       * Returns a localized string representing this date. Accepts the same options as the Intl.DateTimeFormat constructor and any presets defined by Luxon, such as `DateTime.DATE_FULL` or `DateTime.TIME_SIMPLE`.
       * The exact behavior of this method is browser-specific, but in general it will return an appropriate representation
       * of the DateTime in the assigned locale.
       * Defaults to the system's locale if no locale has been specified
       * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DateTimeFormat
       * @param formatOpts {Object} - Intl.DateTimeFormat constructor options and configuration options
       * @param {Object} opts - opts to override the configuration options on this DateTime
       * @example DateTime.now().toLocaleString(); //=> 4/20/2017
       * @example DateTime.now().setLocale('en-gb').toLocaleString(); //=> '20/04/2017'
       * @example DateTime.now().toLocaleString({ locale: 'en-gb' }); //=> '20/04/2017'
       * @example DateTime.now().toLocaleString(DateTime.DATE_FULL); //=> 'April 20, 2017'
       * @example DateTime.now().toLocaleString(DateTime.TIME_SIMPLE); //=> '11:32 AM'
       * @example DateTime.now().toLocaleString(DateTime.DATETIME_SHORT); //=> '4/20/2017, 11:32 AM'
       * @example DateTime.now().toLocaleString({ weekday: 'long', month: 'long', day: '2-digit' }); //=> 'Thursday, April 20'
       * @example DateTime.now().toLocaleString({ weekday: 'short', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }); //=> 'Thu, Apr 20, 11:27 AM'
       * @example DateTime.now().toLocaleString({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); //=> '11:32'
       * @return {string}
       */
      ;
  
      _proto.toLocaleString = function toLocaleString(formatOpts, opts) {
        if (formatOpts === void 0) {
          formatOpts = DATE_SHORT;
        }
  
        if (opts === void 0) {
          opts = {};
        }
  
        return this.isValid ? Formatter.create(this.loc.clone(opts), formatOpts).formatDateTime(this) : INVALID;
      }
      /**
       * Returns an array of format "parts", meaning individual tokens along with metadata. This is allows callers to post-process individual sections of the formatted output.
       * Defaults to the system's locale if no locale has been specified
       * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DateTimeFormat/formatToParts
       * @param opts {Object} - Intl.DateTimeFormat constructor options, same as `toLocaleString`.
       * @example DateTime.now().toLocaleParts(); //=> [
       *                                   //=>   { type: 'day', value: '25' },
       *                                   //=>   { type: 'literal', value: '/' },
       *                                   //=>   { type: 'month', value: '05' },
       *                                   //=>   { type: 'literal', value: '/' },
       *                                   //=>   { type: 'year', value: '1982' }
       *                                   //=> ]
       */
      ;
  
      _proto.toLocaleParts = function toLocaleParts(opts) {
        if (opts === void 0) {
          opts = {};
        }
  
        return this.isValid ? Formatter.create(this.loc.clone(opts), opts).formatDateTimeParts(this) : [];
      }
      /**
       * Returns an ISO 8601-compliant string representation of this DateTime
       * @param {Object} opts - options
       * @param {boolean} [opts.suppressMilliseconds=false] - exclude milliseconds from the format if they're 0
       * @param {boolean} [opts.suppressSeconds=false] - exclude seconds from the format if they're 0
       * @param {boolean} [opts.includeOffset=true] - include the offset, such as 'Z' or '-04:00'
       * @param {string} [opts.format='extended'] - choose between the basic and extended format
       * @example DateTime.utc(1983, 5, 25).toISO() //=> '1982-05-25T00:00:00.000Z'
       * @example DateTime.now().toISO() //=> '2017-04-22T20:47:05.335-04:00'
       * @example DateTime.now().toISO({ includeOffset: false }) //=> '2017-04-22T20:47:05.335'
       * @example DateTime.now().toISO({ format: 'basic' }) //=> '20170422T204705.335-0400'
       * @return {string}
       */
      ;
  
      _proto.toISO = function toISO(_temp3) {
        var _ref4 = _temp3 === void 0 ? {} : _temp3,
            _ref4$format = _ref4.format,
            format = _ref4$format === void 0 ? "extended" : _ref4$format,
            _ref4$suppressSeconds = _ref4.suppressSeconds,
            suppressSeconds = _ref4$suppressSeconds === void 0 ? false : _ref4$suppressSeconds,
            _ref4$suppressMillise = _ref4.suppressMilliseconds,
            suppressMilliseconds = _ref4$suppressMillise === void 0 ? false : _ref4$suppressMillise,
            _ref4$includeOffset = _ref4.includeOffset,
            includeOffset = _ref4$includeOffset === void 0 ? true : _ref4$includeOffset;
  
        if (!this.isValid) {
          return null;
        }
  
        var ext = format === "extended";
  
        var c = _toISODate(this, ext);
  
        c += "T";
        c += _toISOTime(this, ext, suppressSeconds, suppressMilliseconds, includeOffset);
        return c;
      }
      /**
       * Returns an ISO 8601-compliant string representation of this DateTime's date component
       * @param {Object} opts - options
       * @param {string} [opts.format='extended'] - choose between the basic and extended format
       * @example DateTime.utc(1982, 5, 25).toISODate() //=> '1982-05-25'
       * @example DateTime.utc(1982, 5, 25).toISODate({ format: 'basic' }) //=> '19820525'
       * @return {string}
       */
      ;
  
      _proto.toISODate = function toISODate(_temp4) {
        var _ref5 = _temp4 === void 0 ? {} : _temp4,
            _ref5$format = _ref5.format,
            format = _ref5$format === void 0 ? "extended" : _ref5$format;
  
        if (!this.isValid) {
          return null;
        }
  
        return _toISODate(this, format === "extended");
      }
      /**
       * Returns an ISO 8601-compliant string representation of this DateTime's week date
       * @example DateTime.utc(1982, 5, 25).toISOWeekDate() //=> '1982-W21-2'
       * @return {string}
       */
      ;
  
      _proto.toISOWeekDate = function toISOWeekDate() {
        return toTechFormat(this, "kkkk-'W'WW-c");
      }
      /**
       * Returns an ISO 8601-compliant string representation of this DateTime's time component
       * @param {Object} opts - options
       * @param {boolean} [opts.suppressMilliseconds=false] - exclude milliseconds from the format if they're 0
       * @param {boolean} [opts.suppressSeconds=false] - exclude seconds from the format if they're 0
       * @param {boolean} [opts.includeOffset=true] - include the offset, such as 'Z' or '-04:00'
       * @param {boolean} [opts.includePrefix=false] - include the `T` prefix
       * @param {string} [opts.format='extended'] - choose between the basic and extended format
       * @example DateTime.utc().set({ hour: 7, minute: 34 }).toISOTime() //=> '07:34:19.361Z'
       * @example DateTime.utc().set({ hour: 7, minute: 34, seconds: 0, milliseconds: 0 }).toISOTime({ suppressSeconds: true }) //=> '07:34Z'
       * @example DateTime.utc().set({ hour: 7, minute: 34 }).toISOTime({ format: 'basic' }) //=> '073419.361Z'
       * @example DateTime.utc().set({ hour: 7, minute: 34 }).toISOTime({ includePrefix: true }) //=> 'T07:34:19.361Z'
       * @return {string}
       */
      ;
  
      _proto.toISOTime = function toISOTime(_temp5) {
        var _ref6 = _temp5 === void 0 ? {} : _temp5,
            _ref6$suppressMillise = _ref6.suppressMilliseconds,
            suppressMilliseconds = _ref6$suppressMillise === void 0 ? false : _ref6$suppressMillise,
            _ref6$suppressSeconds = _ref6.suppressSeconds,
            suppressSeconds = _ref6$suppressSeconds === void 0 ? false : _ref6$suppressSeconds,
            _ref6$includeOffset = _ref6.includeOffset,
            includeOffset = _ref6$includeOffset === void 0 ? true : _ref6$includeOffset,
            _ref6$includePrefix = _ref6.includePrefix,
            includePrefix = _ref6$includePrefix === void 0 ? false : _ref6$includePrefix,
            _ref6$format = _ref6.format,
            format = _ref6$format === void 0 ? "extended" : _ref6$format;
  
        if (!this.isValid) {
          return null;
        }
  
        var c = includePrefix ? "T" : "";
        return c + _toISOTime(this, format === "extended", suppressSeconds, suppressMilliseconds, includeOffset);
      }
      /**
       * Returns an RFC 2822-compatible string representation of this DateTime
       * @example DateTime.utc(2014, 7, 13).toRFC2822() //=> 'Sun, 13 Jul 2014 00:00:00 +0000'
       * @example DateTime.local(2014, 7, 13).toRFC2822() //=> 'Sun, 13 Jul 2014 00:00:00 -0400'
       * @return {string}
       */
      ;
  
      _proto.toRFC2822 = function toRFC2822() {
        return toTechFormat(this, "EEE, dd LLL yyyy HH:mm:ss ZZZ", false);
      }
      /**
       * Returns a string representation of this DateTime appropriate for use in HTTP headers. The output is always expressed in GMT.
       * Specifically, the string conforms to RFC 1123.
       * @see https://www.w3.org/Protocols/rfc2616/rfc2616-sec3.html#sec3.3.1
       * @example DateTime.utc(2014, 7, 13).toHTTP() //=> 'Sun, 13 Jul 2014 00:00:00 GMT'
       * @example DateTime.utc(2014, 7, 13, 19).toHTTP() //=> 'Sun, 13 Jul 2014 19:00:00 GMT'
       * @return {string}
       */
      ;
  
      _proto.toHTTP = function toHTTP() {
        return toTechFormat(this.toUTC(), "EEE, dd LLL yyyy HH:mm:ss 'GMT'");
      }
      /**
       * Returns a string representation of this DateTime appropriate for use in SQL Date
       * @example DateTime.utc(2014, 7, 13).toSQLDate() //=> '2014-07-13'
       * @return {string}
       */
      ;
  
      _proto.toSQLDate = function toSQLDate() {
        if (!this.isValid) {
          return null;
        }
  
        return _toISODate(this, true);
      }
      /**
       * Returns a string representation of this DateTime appropriate for use in SQL Time
       * @param {Object} opts - options
       * @param {boolean} [opts.includeZone=false] - include the zone, such as 'America/New_York'. Overrides includeOffset.
       * @param {boolean} [opts.includeOffset=true] - include the offset, such as 'Z' or '-04:00'
       * @param {boolean} [opts.includeOffsetSpace=true] - include the space between the time and the offset, such as '05:15:16.345 -04:00'
       * @example DateTime.utc().toSQL() //=> '05:15:16.345'
       * @example DateTime.now().toSQL() //=> '05:15:16.345 -04:00'
       * @example DateTime.now().toSQL({ includeOffset: false }) //=> '05:15:16.345'
       * @example DateTime.now().toSQL({ includeZone: false }) //=> '05:15:16.345 America/New_York'
       * @return {string}
       */
      ;
  
      _proto.toSQLTime = function toSQLTime(_temp6) {
        var _ref7 = _temp6 === void 0 ? {} : _temp6,
            _ref7$includeOffset = _ref7.includeOffset,
            includeOffset = _ref7$includeOffset === void 0 ? true : _ref7$includeOffset,
            _ref7$includeZone = _ref7.includeZone,
            includeZone = _ref7$includeZone === void 0 ? false : _ref7$includeZone,
            _ref7$includeOffsetSp = _ref7.includeOffsetSpace,
            includeOffsetSpace = _ref7$includeOffsetSp === void 0 ? true : _ref7$includeOffsetSp;
  
        var fmt = "HH:mm:ss.SSS";
  
        if (includeZone || includeOffset) {
          if (includeOffsetSpace) {
            fmt += " ";
          }
  
          if (includeZone) {
            fmt += "z";
          } else if (includeOffset) {
            fmt += "ZZ";
          }
        }
  
        return toTechFormat(this, fmt, true);
      }
      /**
       * Returns a string representation of this DateTime appropriate for use in SQL DateTime
       * @param {Object} opts - options
       * @param {boolean} [opts.includeZone=false] - include the zone, such as 'America/New_York'. Overrides includeOffset.
       * @param {boolean} [opts.includeOffset=true] - include the offset, such as 'Z' or '-04:00'
       * @param {boolean} [opts.includeOffsetSpace=true] - include the space between the time and the offset, such as '05:15:16.345 -04:00'
       * @example DateTime.utc(2014, 7, 13).toSQL() //=> '2014-07-13 00:00:00.000 Z'
       * @example DateTime.local(2014, 7, 13).toSQL() //=> '2014-07-13 00:00:00.000 -04:00'
       * @example DateTime.local(2014, 7, 13).toSQL({ includeOffset: false }) //=> '2014-07-13 00:00:00.000'
       * @example DateTime.local(2014, 7, 13).toSQL({ includeZone: true }) //=> '2014-07-13 00:00:00.000 America/New_York'
       * @return {string}
       */
      ;
  
      _proto.toSQL = function toSQL(opts) {
        if (opts === void 0) {
          opts = {};
        }
  
        if (!this.isValid) {
          return null;
        }
  
        return this.toSQLDate() + " " + this.toSQLTime(opts);
      }
      /**
       * Returns a string representation of this DateTime appropriate for debugging
       * @return {string}
       */
      ;
  
      _proto.toString = function toString() {
        return this.isValid ? this.toISO() : INVALID;
      }
      /**
       * Returns the epoch milliseconds of this DateTime. Alias of {@link DateTime#toMillis}
       * @return {number}
       */
      ;
  
      _proto.valueOf = function valueOf() {
        return this.toMillis();
      }
      /**
       * Returns the epoch milliseconds of this DateTime.
       * @return {number}
       */
      ;
  
      _proto.toMillis = function toMillis() {
        return this.isValid ? this.ts : NaN;
      }
      /**
       * Returns the epoch seconds of this DateTime.
       * @return {number}
       */
      ;
  
      _proto.toSeconds = function toSeconds() {
        return this.isValid ? this.ts / 1000 : NaN;
      }
      /**
       * Returns the epoch seconds (as a whole number) of this DateTime.
       * @return {number}
       */
      ;
  
      _proto.toUnixInteger = function toUnixInteger() {
        return this.isValid ? Math.floor(this.ts / 1000) : NaN;
      }
      /**
       * Returns an ISO 8601 representation of this DateTime appropriate for use in JSON.
       * @return {string}
       */
      ;
  
      _proto.toJSON = function toJSON() {
        return this.toISO();
      }
      /**
       * Returns a BSON serializable equivalent to this DateTime.
       * @return {Date}
       */
      ;
  
      _proto.toBSON = function toBSON() {
        return this.toJSDate();
      }
      /**
       * Returns a JavaScript object with this DateTime's year, month, day, and so on.
       * @param opts - options for generating the object
       * @param {boolean} [opts.includeConfig=false] - include configuration attributes in the output
       * @example DateTime.now().toObject() //=> { year: 2017, month: 4, day: 22, hour: 20, minute: 49, second: 42, millisecond: 268 }
       * @return {Object}
       */
      ;
  
      _proto.toObject = function toObject(opts) {
        if (opts === void 0) {
          opts = {};
        }
  
        if (!this.isValid) return {};
  
        var base = _extends({}, this.c);
  
        if (opts.includeConfig) {
          base.outputCalendar = this.outputCalendar;
          base.numberingSystem = this.loc.numberingSystem;
          base.locale = this.loc.locale;
        }
  
        return base;
      }
      /**
       * Returns a JavaScript Date equivalent to this DateTime.
       * @return {Date}
       */
      ;
  
      _proto.toJSDate = function toJSDate() {
        return new Date(this.isValid ? this.ts : NaN);
      } // COMPARE
  
      /**
       * Return the difference between two DateTimes as a Duration.
       * @param {DateTime} otherDateTime - the DateTime to compare this one to
       * @param {string|string[]} [unit=['milliseconds']] - the unit or array of units (such as 'hours' or 'days') to include in the duration.
       * @param {Object} opts - options that affect the creation of the Duration
       * @param {string} [opts.conversionAccuracy='casual'] - the conversion system to use
       * @example
       * var i1 = DateTime.fromISO('1982-05-25T09:45'),
       *     i2 = DateTime.fromISO('1983-10-14T10:30');
       * i2.diff(i1).toObject() //=> { milliseconds: 43807500000 }
       * i2.diff(i1, 'hours').toObject() //=> { hours: 12168.75 }
       * i2.diff(i1, ['months', 'days']).toObject() //=> { months: 16, days: 19.03125 }
       * i2.diff(i1, ['months', 'days', 'hours']).toObject() //=> { months: 16, days: 19, hours: 0.75 }
       * @return {Duration}
       */
      ;
  
      _proto.diff = function diff(otherDateTime, unit, opts) {
        if (unit === void 0) {
          unit = "milliseconds";
        }
  
        if (opts === void 0) {
          opts = {};
        }
  
        if (!this.isValid || !otherDateTime.isValid) {
          return Duration.invalid("created by diffing an invalid DateTime");
        }
  
        var durOpts = _extends({
          locale: this.locale,
          numberingSystem: this.numberingSystem
        }, opts);
  
        var units = maybeArray(unit).map(Duration.normalizeUnit),
            otherIsLater = otherDateTime.valueOf() > this.valueOf(),
            earlier = otherIsLater ? this : otherDateTime,
            later = otherIsLater ? otherDateTime : this,
            diffed = _diff(earlier, later, units, durOpts);
  
        return otherIsLater ? diffed.negate() : diffed;
      }
      /**
       * Return the difference between this DateTime and right now.
       * See {@link DateTime#diff}
       * @param {string|string[]} [unit=['milliseconds']] - the unit or units units (such as 'hours' or 'days') to include in the duration
       * @param {Object} opts - options that affect the creation of the Duration
       * @param {string} [opts.conversionAccuracy='casual'] - the conversion system to use
       * @return {Duration}
       */
      ;
  
      _proto.diffNow = function diffNow(unit, opts) {
        if (unit === void 0) {
          unit = "milliseconds";
        }
  
        if (opts === void 0) {
          opts = {};
        }
  
        return this.diff(DateTime.now(), unit, opts);
      }
      /**
       * Return an Interval spanning between this DateTime and another DateTime
       * @param {DateTime} otherDateTime - the other end point of the Interval
       * @return {Interval}
       */
      ;
  
      _proto.until = function until(otherDateTime) {
        return this.isValid ? Interval.fromDateTimes(this, otherDateTime) : this;
      }
      /**
       * Return whether this DateTime is in the same unit of time as another DateTime.
       * Higher-order units must also be identical for this function to return `true`.
       * Note that time zones are **ignored** in this comparison, which compares the **local** calendar time. Use {@link DateTime#setZone} to convert one of the dates if needed.
       * @param {DateTime} otherDateTime - the other DateTime
       * @param {string} unit - the unit of time to check sameness on
       * @example DateTime.now().hasSame(otherDT, 'day'); //~> true if otherDT is in the same current calendar day
       * @return {boolean}
       */
      ;
  
      _proto.hasSame = function hasSame(otherDateTime, unit) {
        if (!this.isValid) return false;
        var inputMs = otherDateTime.valueOf();
        var adjustedToZone = this.setZone(otherDateTime.zone, {
          keepLocalTime: true
        });
        return adjustedToZone.startOf(unit) <= inputMs && inputMs <= adjustedToZone.endOf(unit);
      }
      /**
       * Equality check
       * Two DateTimes are equal iff they represent the same millisecond, have the same zone and location, and are both valid.
       * To compare just the millisecond values, use `+dt1 === +dt2`.
       * @param {DateTime} other - the other DateTime
       * @return {boolean}
       */
      ;
  
      _proto.equals = function equals(other) {
        return this.isValid && other.isValid && this.valueOf() === other.valueOf() && this.zone.equals(other.zone) && this.loc.equals(other.loc);
      }
      /**
       * Returns a string representation of a this time relative to now, such as "in two days". Can only internationalize if your
       * platform supports Intl.RelativeTimeFormat. Rounds down by default.
       * @param {Object} options - options that affect the output
       * @param {DateTime} [options.base=DateTime.now()] - the DateTime to use as the basis to which this time is compared. Defaults to now.
       * @param {string} [options.style="long"] - the style of units, must be "long", "short", or "narrow"
       * @param {string|string[]} options.unit - use a specific unit or array of units; if omitted, or an array, the method will pick the best unit. Use an array or one of "years", "quarters", "months", "weeks", "days", "hours", "minutes", or "seconds"
       * @param {boolean} [options.round=true] - whether to round the numbers in the output.
       * @param {number} [options.padding=0] - padding in milliseconds. This allows you to round up the result if it fits inside the threshold. Don't use in combination with {round: false} because the decimal output will include the padding.
       * @param {string} options.locale - override the locale of this DateTime
       * @param {string} options.numberingSystem - override the numberingSystem of this DateTime. The Intl system may choose not to honor this
       * @example DateTime.now().plus({ days: 1 }).toRelative() //=> "in 1 day"
       * @example DateTime.now().setLocale("es").toRelative({ days: 1 }) //=> "dentro de 1 día"
       * @example DateTime.now().plus({ days: 1 }).toRelative({ locale: "fr" }) //=> "dans 23 heures"
       * @example DateTime.now().minus({ days: 2 }).toRelative() //=> "2 days ago"
       * @example DateTime.now().minus({ days: 2 }).toRelative({ unit: "hours" }) //=> "48 hours ago"
       * @example DateTime.now().minus({ hours: 36 }).toRelative({ round: false }) //=> "1.5 days ago"
       */
      ;
  
      _proto.toRelative = function toRelative(options) {
        if (options === void 0) {
          options = {};
        }
  
        if (!this.isValid) return null;
        var base = options.base || DateTime.fromObject({}, {
          zone: this.zone
        }),
            padding = options.padding ? this < base ? -options.padding : options.padding : 0;
        var units = ["years", "months", "days", "hours", "minutes", "seconds"];
        var unit = options.unit;
  
        if (Array.isArray(options.unit)) {
          units = options.unit;
          unit = undefined;
        }
  
        return diffRelative(base, this.plus(padding), _extends({}, options, {
          numeric: "always",
          units: units,
          unit: unit
        }));
      }
      /**
       * Returns a string representation of this date relative to today, such as "yesterday" or "next month".
       * Only internationalizes on platforms that supports Intl.RelativeTimeFormat.
       * @param {Object} options - options that affect the output
       * @param {DateTime} [options.base=DateTime.now()] - the DateTime to use as the basis to which this time is compared. Defaults to now.
       * @param {string} options.locale - override the locale of this DateTime
       * @param {string} options.unit - use a specific unit; if omitted, the method will pick the unit. Use one of "years", "quarters", "months", "weeks", or "days"
       * @param {string} options.numberingSystem - override the numberingSystem of this DateTime. The Intl system may choose not to honor this
       * @example DateTime.now().plus({ days: 1 }).toRelativeCalendar() //=> "tomorrow"
       * @example DateTime.now().setLocale("es").plus({ days: 1 }).toRelative() //=> ""mañana"
       * @example DateTime.now().plus({ days: 1 }).toRelativeCalendar({ locale: "fr" }) //=> "demain"
       * @example DateTime.now().minus({ days: 2 }).toRelativeCalendar() //=> "2 days ago"
       */
      ;
  
      _proto.toRelativeCalendar = function toRelativeCalendar(options) {
        if (options === void 0) {
          options = {};
        }
  
        if (!this.isValid) return null;
        return diffRelative(options.base || DateTime.fromObject({}, {
          zone: this.zone
        }), this, _extends({}, options, {
          numeric: "auto",
          units: ["years", "months", "days"],
          calendary: true
        }));
      }
      /**
       * Return the min of several date times
       * @param {...DateTime} dateTimes - the DateTimes from which to choose the minimum
       * @return {DateTime} the min DateTime, or undefined if called with no argument
       */
      ;
  
      DateTime.min = function min() {
        for (var _len = arguments.length, dateTimes = new Array(_len), _key = 0; _key < _len; _key++) {
          dateTimes[_key] = arguments[_key];
        }
  
        if (!dateTimes.every(DateTime.isDateTime)) {
          throw new InvalidArgumentError("min requires all arguments be DateTimes");
        }
  
        return bestBy(dateTimes, function (i) {
          return i.valueOf();
        }, Math.min);
      }
      /**
       * Return the max of several date times
       * @param {...DateTime} dateTimes - the DateTimes from which to choose the maximum
       * @return {DateTime} the max DateTime, or undefined if called with no argument
       */
      ;
  
      DateTime.max = function max() {
        for (var _len2 = arguments.length, dateTimes = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
          dateTimes[_key2] = arguments[_key2];
        }
  
        if (!dateTimes.every(DateTime.isDateTime)) {
          throw new InvalidArgumentError("max requires all arguments be DateTimes");
        }
  
        return bestBy(dateTimes, function (i) {
          return i.valueOf();
        }, Math.max);
      } // MISC
  
      /**
       * Explain how a string would be parsed by fromFormat()
       * @param {string} text - the string to parse
       * @param {string} fmt - the format the string is expected to be in (see description)
       * @param {Object} options - options taken by fromFormat()
       * @return {Object}
       */
      ;
  
      DateTime.fromFormatExplain = function fromFormatExplain(text, fmt, options) {
        if (options === void 0) {
          options = {};
        }
  
        var _options = options,
            _options$locale = _options.locale,
            locale = _options$locale === void 0 ? null : _options$locale,
            _options$numberingSys = _options.numberingSystem,
            numberingSystem = _options$numberingSys === void 0 ? null : _options$numberingSys,
            localeToUse = Locale.fromOpts({
          locale: locale,
          numberingSystem: numberingSystem,
          defaultToEN: true
        });
        return explainFromTokens(localeToUse, text, fmt);
      }
      /**
       * @deprecated use fromFormatExplain instead
       */
      ;
  
      DateTime.fromStringExplain = function fromStringExplain(text, fmt, options) {
        if (options === void 0) {
          options = {};
        }
  
        return DateTime.fromFormatExplain(text, fmt, options);
      } // FORMAT PRESETS
  
      /**
       * {@link DateTime#toLocaleString} format like 10/14/1983
       * @type {Object}
       */
      ;
  
      _createClass(DateTime, [{
        key: "isValid",
        get: function get() {
          return this.invalid === null;
        }
        /**
         * Returns an error code if this DateTime is invalid, or null if the DateTime is valid
         * @type {string}
         */
  
      }, {
        key: "invalidReason",
        get: function get() {
          return this.invalid ? this.invalid.reason : null;
        }
        /**
         * Returns an explanation of why this DateTime became invalid, or null if the DateTime is valid
         * @type {string}
         */
  
      }, {
        key: "invalidExplanation",
        get: function get() {
          return this.invalid ? this.invalid.explanation : null;
        }
        /**
         * Get the locale of a DateTime, such 'en-GB'. The locale is used when formatting the DateTime
         *
         * @type {string}
         */
  
      }, {
        key: "locale",
        get: function get() {
          return this.isValid ? this.loc.locale : null;
        }
        /**
         * Get the numbering system of a DateTime, such 'beng'. The numbering system is used when formatting the DateTime
         *
         * @type {string}
         */
  
      }, {
        key: "numberingSystem",
        get: function get() {
          return this.isValid ? this.loc.numberingSystem : null;
        }
        /**
         * Get the output calendar of a DateTime, such 'islamic'. The output calendar is used when formatting the DateTime
         *
         * @type {string}
         */
  
      }, {
        key: "outputCalendar",
        get: function get() {
          return this.isValid ? this.loc.outputCalendar : null;
        }
        /**
         * Get the time zone associated with this DateTime.
         * @type {Zone}
         */
  
      }, {
        key: "zone",
        get: function get() {
          return this._zone;
        }
        /**
         * Get the name of the time zone.
         * @type {string}
         */
  
      }, {
        key: "zoneName",
        get: function get() {
          return this.isValid ? this.zone.name : null;
        }
        /**
         * Get the year
         * @example DateTime.local(2017, 5, 25).year //=> 2017
         * @type {number}
         */
  
      }, {
        key: "year",
        get: function get() {
          return this.isValid ? this.c.year : NaN;
        }
        /**
         * Get the quarter
         * @example DateTime.local(2017, 5, 25).quarter //=> 2
         * @type {number}
         */
  
      }, {
        key: "quarter",
        get: function get() {
          return this.isValid ? Math.ceil(this.c.month / 3) : NaN;
        }
        /**
         * Get the month (1-12).
         * @example DateTime.local(2017, 5, 25).month //=> 5
         * @type {number}
         */
  
      }, {
        key: "month",
        get: function get() {
          return this.isValid ? this.c.month : NaN;
        }
        /**
         * Get the day of the month (1-30ish).
         * @example DateTime.local(2017, 5, 25).day //=> 25
         * @type {number}
         */
  
      }, {
        key: "day",
        get: function get() {
          return this.isValid ? this.c.day : NaN;
        }
        /**
         * Get the hour of the day (0-23).
         * @example DateTime.local(2017, 5, 25, 9).hour //=> 9
         * @type {number}
         */
  
      }, {
        key: "hour",
        get: function get() {
          return this.isValid ? this.c.hour : NaN;
        }
        /**
         * Get the minute of the hour (0-59).
         * @example DateTime.local(2017, 5, 25, 9, 30).minute //=> 30
         * @type {number}
         */
  
      }, {
        key: "minute",
        get: function get() {
          return this.isValid ? this.c.minute : NaN;
        }
        /**
         * Get the second of the minute (0-59).
         * @example DateTime.local(2017, 5, 25, 9, 30, 52).second //=> 52
         * @type {number}
         */
  
      }, {
        key: "second",
        get: function get() {
          return this.isValid ? this.c.second : NaN;
        }
        /**
         * Get the millisecond of the second (0-999).
         * @example DateTime.local(2017, 5, 25, 9, 30, 52, 654).millisecond //=> 654
         * @type {number}
         */
  
      }, {
        key: "millisecond",
        get: function get() {
          return this.isValid ? this.c.millisecond : NaN;
        }
        /**
         * Get the week year
         * @see https://en.wikipedia.org/wiki/ISO_week_date
         * @example DateTime.local(2014, 12, 31).weekYear //=> 2015
         * @type {number}
         */
  
      }, {
        key: "weekYear",
        get: function get() {
          return this.isValid ? possiblyCachedWeekData(this).weekYear : NaN;
        }
        /**
         * Get the week number of the week year (1-52ish).
         * @see https://en.wikipedia.org/wiki/ISO_week_date
         * @example DateTime.local(2017, 5, 25).weekNumber //=> 21
         * @type {number}
         */
  
      }, {
        key: "weekNumber",
        get: function get() {
          return this.isValid ? possiblyCachedWeekData(this).weekNumber : NaN;
        }
        /**
         * Get the day of the week.
         * 1 is Monday and 7 is Sunday
         * @see https://en.wikipedia.org/wiki/ISO_week_date
         * @example DateTime.local(2014, 11, 31).weekday //=> 4
         * @type {number}
         */
  
      }, {
        key: "weekday",
        get: function get() {
          return this.isValid ? possiblyCachedWeekData(this).weekday : NaN;
        }
        /**
         * Get the ordinal (meaning the day of the year)
         * @example DateTime.local(2017, 5, 25).ordinal //=> 145
         * @type {number|DateTime}
         */
  
      }, {
        key: "ordinal",
        get: function get() {
          return this.isValid ? gregorianToOrdinal(this.c).ordinal : NaN;
        }
        /**
         * Get the human readable short month name, such as 'Oct'.
         * Defaults to the system's locale if no locale has been specified
         * @example DateTime.local(2017, 10, 30).monthShort //=> Oct
         * @type {string}
         */
  
      }, {
        key: "monthShort",
        get: function get() {
          return this.isValid ? Info.months("short", {
            locObj: this.loc
          })[this.month - 1] : null;
        }
        /**
         * Get the human readable long month name, such as 'October'.
         * Defaults to the system's locale if no locale has been specified
         * @example DateTime.local(2017, 10, 30).monthLong //=> October
         * @type {string}
         */
  
      }, {
        key: "monthLong",
        get: function get() {
          return this.isValid ? Info.months("long", {
            locObj: this.loc
          })[this.month - 1] : null;
        }
        /**
         * Get the human readable short weekday, such as 'Mon'.
         * Defaults to the system's locale if no locale has been specified
         * @example DateTime.local(2017, 10, 30).weekdayShort //=> Mon
         * @type {string}
         */
  
      }, {
        key: "weekdayShort",
        get: function get() {
          return this.isValid ? Info.weekdays("short", {
            locObj: this.loc
          })[this.weekday - 1] : null;
        }
        /**
         * Get the human readable long weekday, such as 'Monday'.
         * Defaults to the system's locale if no locale has been specified
         * @example DateTime.local(2017, 10, 30).weekdayLong //=> Monday
         * @type {string}
         */
  
      }, {
        key: "weekdayLong",
        get: function get() {
          return this.isValid ? Info.weekdays("long", {
            locObj: this.loc
          })[this.weekday - 1] : null;
        }
        /**
         * Get the UTC offset of this DateTime in minutes
         * @example DateTime.now().offset //=> -240
         * @example DateTime.utc().offset //=> 0
         * @type {number}
         */
  
      }, {
        key: "offset",
        get: function get() {
          return this.isValid ? +this.o : NaN;
        }
        /**
         * Get the short human name for the zone's current offset, for example "EST" or "EDT".
         * Defaults to the system's locale if no locale has been specified
         * @type {string}
         */
  
      }, {
        key: "offsetNameShort",
        get: function get() {
          if (this.isValid) {
            return this.zone.offsetName(this.ts, {
              format: "short",
              locale: this.locale
            });
          } else {
            return null;
          }
        }
        /**
         * Get the long human name for the zone's current offset, for example "Eastern Standard Time" or "Eastern Daylight Time".
         * Defaults to the system's locale if no locale has been specified
         * @type {string}
         */
  
      }, {
        key: "offsetNameLong",
        get: function get() {
          if (this.isValid) {
            return this.zone.offsetName(this.ts, {
              format: "long",
              locale: this.locale
            });
          } else {
            return null;
          }
        }
        /**
         * Get whether this zone's offset ever changes, as in a DST.
         * @type {boolean}
         */
  
      }, {
        key: "isOffsetFixed",
        get: function get() {
          return this.isValid ? this.zone.isUniversal : null;
        }
        /**
         * Get whether the DateTime is in a DST.
         * @type {boolean}
         */
  
      }, {
        key: "isInDST",
        get: function get() {
          if (this.isOffsetFixed) {
            return false;
          } else {
            return this.offset > this.set({
              month: 1
            }).offset || this.offset > this.set({
              month: 5
            }).offset;
          }
        }
        /**
         * Returns true if this DateTime is in a leap year, false otherwise
         * @example DateTime.local(2016).isInLeapYear //=> true
         * @example DateTime.local(2013).isInLeapYear //=> false
         * @type {boolean}
         */
  
      }, {
        key: "isInLeapYear",
        get: function get() {
          return isLeapYear(this.year);
        }
        /**
         * Returns the number of days in this DateTime's month
         * @example DateTime.local(2016, 2).daysInMonth //=> 29
         * @example DateTime.local(2016, 3).daysInMonth //=> 31
         * @type {number}
         */
  
      }, {
        key: "daysInMonth",
        get: function get() {
          return daysInMonth(this.year, this.month);
        }
        /**
         * Returns the number of days in this DateTime's year
         * @example DateTime.local(2016).daysInYear //=> 366
         * @example DateTime.local(2013).daysInYear //=> 365
         * @type {number}
         */
  
      }, {
        key: "daysInYear",
        get: function get() {
          return this.isValid ? daysInYear(this.year) : NaN;
        }
        /**
         * Returns the number of weeks in this DateTime's year
         * @see https://en.wikipedia.org/wiki/ISO_week_date
         * @example DateTime.local(2004).weeksInWeekYear //=> 53
         * @example DateTime.local(2013).weeksInWeekYear //=> 52
         * @type {number}
         */
  
      }, {
        key: "weeksInWeekYear",
        get: function get() {
          return this.isValid ? weeksInWeekYear(this.weekYear) : NaN;
        }
      }], [{
        key: "DATE_SHORT",
        get: function get() {
          return DATE_SHORT;
        }
        /**
         * {@link DateTime#toLocaleString} format like 'Oct 14, 1983'
         * @type {Object}
         */
  
      }, {
        key: "DATE_MED",
        get: function get() {
          return DATE_MED;
        }
        /**
         * {@link DateTime#toLocaleString} format like 'Fri, Oct 14, 1983'
         * @type {Object}
         */
  
      }, {
        key: "DATE_MED_WITH_WEEKDAY",
        get: function get() {
          return DATE_MED_WITH_WEEKDAY;
        }
        /**
         * {@link DateTime#toLocaleString} format like 'October 14, 1983'
         * @type {Object}
         */
  
      }, {
        key: "DATE_FULL",
        get: function get() {
          return DATE_FULL;
        }
        /**
         * {@link DateTime#toLocaleString} format like 'Tuesday, October 14, 1983'
         * @type {Object}
         */
  
      }, {
        key: "DATE_HUGE",
        get: function get() {
          return DATE_HUGE;
        }
        /**
         * {@link DateTime#toLocaleString} format like '09:30 AM'. Only 12-hour if the locale is.
         * @type {Object}
         */
  
      }, {
        key: "TIME_SIMPLE",
        get: function get() {
          return TIME_SIMPLE;
        }
        /**
         * {@link DateTime#toLocaleString} format like '09:30:23 AM'. Only 12-hour if the locale is.
         * @type {Object}
         */
  
      }, {
        key: "TIME_WITH_SECONDS",
        get: function get() {
          return TIME_WITH_SECONDS;
        }
        /**
         * {@link DateTime#toLocaleString} format like '09:30:23 AM EDT'. Only 12-hour if the locale is.
         * @type {Object}
         */
  
      }, {
        key: "TIME_WITH_SHORT_OFFSET",
        get: function get() {
          return TIME_WITH_SHORT_OFFSET;
        }
        /**
         * {@link DateTime#toLocaleString} format like '09:30:23 AM Eastern Daylight Time'. Only 12-hour if the locale is.
         * @type {Object}
         */
  
      }, {
        key: "TIME_WITH_LONG_OFFSET",
        get: function get() {
          return TIME_WITH_LONG_OFFSET;
        }
        /**
         * {@link DateTime#toLocaleString} format like '09:30', always 24-hour.
         * @type {Object}
         */
  
      }, {
        key: "TIME_24_SIMPLE",
        get: function get() {
          return TIME_24_SIMPLE;
        }
        /**
         * {@link DateTime#toLocaleString} format like '09:30:23', always 24-hour.
         * @type {Object}
         */
  
      }, {
        key: "TIME_24_WITH_SECONDS",
        get: function get() {
          return TIME_24_WITH_SECONDS;
        }
        /**
         * {@link DateTime#toLocaleString} format like '09:30:23 EDT', always 24-hour.
         * @type {Object}
         */
  
      }, {
        key: "TIME_24_WITH_SHORT_OFFSET",
        get: function get() {
          return TIME_24_WITH_SHORT_OFFSET;
        }
        /**
         * {@link DateTime#toLocaleString} format like '09:30:23 Eastern Daylight Time', always 24-hour.
         * @type {Object}
         */
  
      }, {
        key: "TIME_24_WITH_LONG_OFFSET",
        get: function get() {
          return TIME_24_WITH_LONG_OFFSET;
        }
        /**
         * {@link DateTime#toLocaleString} format like '10/14/1983, 9:30 AM'. Only 12-hour if the locale is.
         * @type {Object}
         */
  
      }, {
        key: "DATETIME_SHORT",
        get: function get() {
          return DATETIME_SHORT;
        }
        /**
         * {@link DateTime#toLocaleString} format like '10/14/1983, 9:30:33 AM'. Only 12-hour if the locale is.
         * @type {Object}
         */
  
      }, {
        key: "DATETIME_SHORT_WITH_SECONDS",
        get: function get() {
          return DATETIME_SHORT_WITH_SECONDS;
        }
        /**
         * {@link DateTime#toLocaleString} format like 'Oct 14, 1983, 9:30 AM'. Only 12-hour if the locale is.
         * @type {Object}
         */
  
      }, {
        key: "DATETIME_MED",
        get: function get() {
          return DATETIME_MED;
        }
        /**
         * {@link DateTime#toLocaleString} format like 'Oct 14, 1983, 9:30:33 AM'. Only 12-hour if the locale is.
         * @type {Object}
         */
  
      }, {
        key: "DATETIME_MED_WITH_SECONDS",
        get: function get() {
          return DATETIME_MED_WITH_SECONDS;
        }
        /**
         * {@link DateTime#toLocaleString} format like 'Fri, 14 Oct 1983, 9:30 AM'. Only 12-hour if the locale is.
         * @type {Object}
         */
  
      }, {
        key: "DATETIME_MED_WITH_WEEKDAY",
        get: function get() {
          return DATETIME_MED_WITH_WEEKDAY;
        }
        /**
         * {@link DateTime#toLocaleString} format like 'October 14, 1983, 9:30 AM EDT'. Only 12-hour if the locale is.
         * @type {Object}
         */
  
      }, {
        key: "DATETIME_FULL",
        get: function get() {
          return DATETIME_FULL;
        }
        /**
         * {@link DateTime#toLocaleString} format like 'October 14, 1983, 9:30:33 AM EDT'. Only 12-hour if the locale is.
         * @type {Object}
         */
  
      }, {
        key: "DATETIME_FULL_WITH_SECONDS",
        get: function get() {
          return DATETIME_FULL_WITH_SECONDS;
        }
        /**
         * {@link DateTime#toLocaleString} format like 'Friday, October 14, 1983, 9:30 AM Eastern Daylight Time'. Only 12-hour if the locale is.
         * @type {Object}
         */
  
      }, {
        key: "DATETIME_HUGE",
        get: function get() {
          return DATETIME_HUGE;
        }
        /**
         * {@link DateTime#toLocaleString} format like 'Friday, October 14, 1983, 9:30:33 AM Eastern Daylight Time'. Only 12-hour if the locale is.
         * @type {Object}
         */
  
      }, {
        key: "DATETIME_HUGE_WITH_SECONDS",
        get: function get() {
          return DATETIME_HUGE_WITH_SECONDS;
        }
      }]);
  
      return DateTime;
    }();
    function friendlyDateTime(dateTimeish) {
      if (DateTime.isDateTime(dateTimeish)) {
        return dateTimeish;
      } else if (dateTimeish && dateTimeish.valueOf && isNumber(dateTimeish.valueOf())) {
        return DateTime.fromJSDate(dateTimeish);
      } else if (dateTimeish && typeof dateTimeish === "object") {
        return DateTime.fromObject(dateTimeish);
      } else {
        throw new InvalidArgumentError("Unknown datetime argument: " + dateTimeish + ", of type " + typeof dateTimeish);
      }
    }
  
    var VERSION = "2.3.2";
  
    exports.DateTime = DateTime;
    exports.Duration = Duration;
    exports.FixedOffsetZone = FixedOffsetZone;
    exports.IANAZone = IANAZone;
    exports.Info = Info;
    exports.Interval = Interval;
    exports.InvalidZone = InvalidZone;
    exports.Settings = Settings;
    exports.SystemZone = SystemZone;
    exports.VERSION = VERSION;
    exports.Zone = Zone;
  
    Object.defineProperty(exports, '__esModule', { value: true });
  
    return exports;
  
  })({});

class DefaultHttpRequestOptions {    url = "";    method = HttpRequestMethod.GET;}class HttpRequest {    options = {};    url = '';    static getMethod(method) {        let genericMethod = method.toLowerCase().trim();        if (genericMethod == "get") {            return HttpRequestMethod.GET;        }        if (genericMethod == "post") {            return HttpRequestMethod.POST;        }        if (genericMethod == "delete") {            return HttpRequestMethod.DELETE;        }        if (genericMethod == "put") {            return HttpRequestMethod.PUT;        }        if (genericMethod == "option") {            return HttpRequestMethod.OPTION;        }        console.error("unknow type " + method + ". I ll return GET by default");        return HttpRequestMethod.GET;    }    getMethod(method) {        if (method == HttpRequestMethod.GET)            return "GET";        if (method == HttpRequestMethod.POST)            return "POST";        if (method == HttpRequestMethod.DELETE)            return "DELETE";        if (method == HttpRequestMethod.OPTION)            return "OPTION";        if (method == HttpRequestMethod.PUT)            return "PUT";        return "GET";    }    constructor(options) {        options = {            ...new DefaultHttpRequestOptions(),            ...options        };        let optionsToSend = {            method: this.getMethod(options.method),        };        if (options.data) {            if (options.data instanceof FormData) {                optionsToSend.body = options.data;            }            else {                let formData = new FormData();                for (let key in options.data) {                    formData.append(key, options.data[key]);                }                optionsToSend.body = formData;            }        }        this.options = optionsToSend;        this.url = options.url;    }    async send() {        let result = await fetch(this.url, this.options);        if (result.ok) {        }    }    static get(url) {        return fetch(url, {            method: "GET"        });    }    static async post(url, data) {        let formData = new FormData();        for (let key in data) {            formData.append(key, data[key]);        }        const response = await fetch(url, {            method: "POST",            body: formData        });        const content = await response.json();        return new Promise((resolve, reject) => {            if (response.ok) {                resolve(content);            }            else {                reject(content);            }        });    }}/** * List of HTTP Method allowed */var HttpRequestMethod;(function (HttpRequestMethod) {    HttpRequestMethod[HttpRequestMethod["GET"] = 0] = "GET";    HttpRequestMethod[HttpRequestMethod["POST"] = 1] = "POST";    HttpRequestMethod[HttpRequestMethod["DELETE"] = 2] = "DELETE";    HttpRequestMethod[HttpRequestMethod["PUT"] = 3] = "PUT";    HttpRequestMethod[HttpRequestMethod["OPTION"] = 4] = "OPTION";})(HttpRequestMethod || (HttpRequestMethod = {}));
Proxy.__maxProxyData = 0;
Error.stackTraceLimit = Infinity;
Object.transformIntoWatcher = function (obj, onDataChanged) {
    if (obj == undefined) {
        console.error("You must define an objet / array for your proxy");
        return;
    }
    if (obj.__isProxy) {
        obj.__subscribe(onDataChanged);
        return obj;
    }
    Proxy.__maxProxyData++;
    let setProxyPath = (newProxy, newPath) => {
        if (newProxy instanceof Object && newProxy.__isProxy) {
            newProxy.__path = newPath;
            if (!newProxy.__proxyData) {
                newProxy.__proxyData = {};
            }
            if (!newProxy.__proxyData[newPath]) {
                newProxy.__proxyData[newPath] = [];
            }
            if (newProxy.__proxyData[newPath].indexOf(proxyData) == -1) {
                newProxy.__proxyData[newPath].push(proxyData);
            }
        }
    };
    let removeProxyPath = (oldValue, pathToDelete, recursive = true) => {
        if (oldValue instanceof Object && oldValue.__isProxy) {
            let allProxies = oldValue.__proxyData;
            for (let triggerPath in allProxies) {
                if (triggerPath == pathToDelete) {
                    for (let i = 0; i < allProxies[triggerPath].length; i++) {
                        if (allProxies[triggerPath][i] == proxyData) {
                            allProxies[triggerPath].splice(i, 1);
                            i--;
                        }
                    }
                    if (allProxies[triggerPath].length == 0) {
                        delete allProxies[triggerPath];
                        if (Object.keys(allProxies).length == 0) {
                            delete oldValue.__proxyData;
                        }
                    }
                }
            }

            // apply recursive delete
        }
    };
    let currentTrace = new Error().stack.split("\n")
    currentTrace.shift();
    currentTrace.shift();
    let proxyData = {
        id: Proxy.__maxProxyData,
        callbacks: [onDataChanged],
        avoidUpdate: [],
        pathToRemove: [],
        history: [{
            object: JSON.parse(JSON.stringify(obj)),
            trace: currentTrace
        }],
        getProxyObject(target, element, prop) {
            let newProxy;
            if (element instanceof Object && element.__isProxy) {
                newProxy = element;
            }
            else {
                try {
                    if (element instanceof Object) {
                        newProxy = new Proxy(element, this);
                    } else {
                        return element;
                    }
                } catch {
                    // it's not an array or object
                    return element;
                }
            }
            let newPath = '';
            if (Array.isArray(target)) {
                if (prop != "length") {
                    if (target.__path) {
                        newPath = target.__path;
                    }
                    newPath += "[" + prop + "]";
                    setProxyPath(newProxy, newPath);
                }
            }
            else if (element instanceof Date) {
                return element;
            }
            else {
                if (target.__path) {
                    newPath = target.__path + '.';
                }
                newPath += prop;
                setProxyPath(newProxy, newPath);
            }
            return newProxy;

        },
        tryCustomFunction(target, prop, receiver) {
            if (prop == "__isProxy") {
                return true;
            }
            else if (prop == "__subscribe") {
                return (cb) => {
                    this.callbacks.push(cb);
                };
            }
            else if (prop == "__unsubscribe") {
                return (cb) => {
                    let index = this.callbacks.indexOf(cb);
                    if (index > -1) {
                        this.callbacks.splice(index, 1);
                    }
                };
            }
            else if (prop == "__proxyId") {
                return this.id;
            }
            return undefined;
        },
        get(target, prop, receiver) {
            if (prop == "__proxyData") {
                return target[prop];
            }
            else if(prop == "getHistory"){
                return () => {
                    return this.history;
                }
            }
            let customResult = this.tryCustomFunction(target, prop, receiver);
            if (customResult !== undefined) {
                return customResult;
            }

            let element = target[prop];
            if (typeof (element) == 'object') {
                return this.getProxyObject(target, element, prop);
            }
            else if (typeof (element) == 'function') {
                
                if (Array.isArray(target)) {
                    let result;
                    if (prop == 'push') {
                        if (target.__isProxy) {
                            result = (el) => {
                                let index = target.push(el);
                                return index;
                            };
                        }
                        else {
                            result = (el) => {
                                let index = target.push(el);
                                // get real objetct with proxy to have the correct subscription
                                let proxyEl = this.getProxyObject(target, el, (index - 1));
                                target.splice(target.length - 1, 1, proxyEl);
                                trigger('CREATED', target, receiver, proxyEl, "[" + (index - 1) + "]");
                                return index;
                            };
                        };
                    }
                    else if (prop == 'splice') {
                        if (target.__isProxy) {
                            result = (index, nbRemove, ...insert) => {
                                let res = target.splice(index, nbRemove, ...insert);
                                return res;
                            };
                        }
                        else {
                            result = (index, nbRemove, ...insert) => {
                                let res = target.splice(index, nbRemove, ...insert);
                                let path = target.__path ? target.__path : '';
                                for (let i = 0; i < res.length; i++) {
                                    trigger('DELETED', target, receiver, res[i], "[" + index + "]");
                                    removeProxyPath(res[i], path + "[" + (index + i) + "]");
                                }
                                for (let i = 0; i < insert.length; i++) {
                                    // get real objetct with proxy to have the correct subscription
                                    let proxyEl = this.getProxyObject(target, insert[i], (index + i));
                                    target.splice((index + i), 1, proxyEl);
                                    trigger('CREATED', target, receiver, proxyEl, "[" + (index + i) + "]");
                                }
                                let fromIndex = index + insert.length;
                                let baseDiff = index - insert.length + res.length + 1;
                                // update path and subscription
                                for (let i = fromIndex, j = 0; i < target.length; i++, j++) {
                                    let oldPath = path + "[" + (j + baseDiff) + "]";
                                    removeProxyPath(target[i], oldPath, false);
                                    let proxyEl = this.getProxyObject(target, target[i], i);

                                    let recuUpdate = (childEl) => {
                                        if (Array.isArray(childEl)) {
                                            for (let i = 0; i < childEl.length; i++) {
                                                if (childEl[i] instanceof Object && childEl[i].__path) {
                                                    let oldPathRecu = proxyEl[i].__path.replace(proxyEl.__path, oldPath);
                                                    removeProxyPath(childEl[i], oldPathRecu, false);
                                                    let newProxyEl = this.getProxyObject(childEl, childEl[i], i);
                                                    recuUpdate(newProxyEl);
                                                }
                                            }
                                        }
                                        else if (childEl instanceof Object && !(childEl instanceof Date)) {
                                            for (let key in childEl) {
                                                if (childEl[key] instanceof Object && childEl[key].__path) {
                                                    let oldPathRecu = proxyEl[key].__path.replace(proxyEl.__path, oldPath);
                                                    removeProxyPath(childEl[key], oldPathRecu, false);
                                                    let newProxyEl = this.getProxyObject(childEl, childEl[key], key);
                                                    recuUpdate(newProxyEl);
                                                }
                                            }
                                        }
                                    };
                                    recuUpdate(proxyEl);

                                }
                                return res;
                            };
                        }

                    }
                    else if (prop == 'pop') {
                        if (target.__isProxy) {
                            result = () => {
                                let res = target.pop();
                                return res;
                            };
                        }
                        else {
                            result = () => {
                                let index = target.length - 1;
                                let res = target.pop();
                                let path = target.__path ? target.__path : '';
                                trigger('DELETED', target, receiver, res, "[" + index + "]");
                                removeProxyPath(res, path + "[" + index + "]");
                                return res;
                            };
                        }
                    }
                    else {
                        result = element.bind(target);
                    }
                    return result;
                }
                return element.bind(target);
            }
            return Reflect.get(target, prop, receiver);
        },
        set(target, prop, value, receiver) {
            let triggerChange = false;
            if (["__path", "__proxyData"].indexOf(prop) == -1) {
                if (Array.isArray(target)) {
                    if (prop != "length") {
                        triggerChange = true;
                    }
                }
                else {
                    let oldValue = Reflect.get(target, prop, receiver);
                    if (oldValue !== value) {
                        triggerChange = true;
                    }
                }

            }

            let result = Reflect.set(target, prop, value, receiver);

            if (triggerChange) {
                let index = this.avoidUpdate.indexOf(prop);

                if (index == -1) {
                    trigger('UPDATED', target, receiver, value, prop);
                }
                else {
                    this.avoidUpdate.splice(index, 1);
                }
            }
            return result;
        },
        deleteProperty(target, prop) {
            let triggerChange = false;
            let pathToDelete = '';
            if (prop != "__path") {
                if (Array.isArray(target)) {
                    if (prop != "length") {
                        if (target.__path) {
                            pathToDelete = target.__path;
                        }
                        pathToDelete += "[" + prop + "]";
                        triggerChange = true;
                    }
                }
                else {
                    if (target.__path) {
                        pathToDelete = target.__path + '.';
                    }
                    pathToDelete += prop;
                    triggerChange = true;
                }
            }
            if (target.hasOwnProperty(prop)) {
                let oldValue = target[prop];
                delete target[prop];
                if (triggerChange) {
                    trigger('DELETED', target, null, oldValue, prop);
                    removeProxyPath(oldValue, pathToDelete);
                }
                return true;
            }
            return false;
        },
        defineProperty(target, prop, descriptor) {
            let triggerChange = false;
            let newPath = '';
            if (["__path", "__proxyData"].indexOf(prop) == -1) {
                if (Array.isArray(target)) {
                    if (prop != "length") {
                        if (target.__path) {
                            newPath = target.__path;
                        }
                        newPath += "[" + prop + "]";
                        if (!target.hasOwnProperty(prop)) {
                            triggerChange = true;
                        }
                    }
                }
                else {
                    if (target.__path) {
                        newPath = target.__path + '.';
                    }
                    newPath += prop;
                    if (!target.hasOwnProperty(prop)) {
                        triggerChange = true;
                    }
                }
            }
            let result = Reflect.defineProperty(target, prop, descriptor);
            if (triggerChange) {
                this.avoidUpdate.push(prop);
                let proxyEl = this.getProxyObject(target, descriptor.value, prop);
                target[prop] = proxyEl;
                trigger('CREATED', target, null, proxyEl, prop);
            }
            return result;
        }
    };
    const trigger = (type, target, receiver, value, prop) => {

        if (target.__isProxy) {
            return;
        }
        let allProxies = target.__proxyData;
        // trigger only if same id
        let receiverId = 0;
        if (receiver == null) {
            receiverId = proxyData.id;
        }
        else {
            receiverId = receiver.__proxyId;
        }
        if (proxyData.id == receiverId) {
            let stacks = [];
            let allStacks = new Error().stack.split("\n");
            for (let i = allStacks.length - 1; i >= 0; i--) {
                let current = allStacks[i].trim().replace("at ", "");
                if (current.startsWith("Object.set") || current.startsWith("Proxy.result")) {
                    break;
                }
                stacks.push(current);
            }
            proxyData.history.push({
                object: JSON.parse(JSON.stringify(target)),
                trace: stacks.reverse()
            });
            
            for (let triggerPath in allProxies) {

                for (let currentProxyData of allProxies[triggerPath]) {
                    [...currentProxyData.callbacks].forEach((cb) => {
                        let pathToSend = triggerPath;
                        if (pathToSend != "") {
                            if (!prop.startsWith("[")) {
                                pathToSend += ".";
                            }
                            pathToSend += prop;
                        }
                        else {
                            pathToSend = prop;
                        }
                        cb(WatchAction[type], pathToSend, value);
                    });
                }
            }
        }
    };


    let proxy = new Proxy(obj, proxyData);
    setProxyPath(proxy, '');
    return proxy;
};
Object.prepareByPath = function (obj, path, currentPath = "") {
    let objToApply = obj;
    let canApply = true;
    if(path.startsWith(currentPath)) {
        let missingPath = path.replace(currentPath, "");
        if(missingPath.startsWith(".")) { missingPath = missingPath.slice(1); }

        let splited = missingPath.split(".");
        for(let part of splited) {
            if(part == "") {
                continue;
            }
            if(part.startsWith("[")) {
                part = part.substring(1, part.length - 1);
            }
            if(objToApply.hasOwnProperty(part)) {
                objToApply = objToApply[part];
            }
            else {
                canApply = false;
                break;
            }
        }
    }
    else {
        canApply = false;
    }
    return {
        canApply: canApply,
        objToApply: objToApply
    };
};
Object.isPathMatching = function (p1, p2) {
    p1 = p1.replace(/\[\d*?\]/g, '[]');
    p2 = p2.replace(/\[\d*?\]/g, '[]');
    return p1 == p2;
}
Event.prototype.normalize = function () {
    if (
        this.type === "touchstart" ||
        this.type === "touchmove" ||
        this.type === "touchend"
    ) {
        const event = (typeof this.originalEvent === "undefined") ? this : this.originalEvent;
        const touch = event.touches[0] || event.changedTouches[0];
        this.pageX = touch.pageX;
        this.pageY = touch.pageY;
        this.clientX = touch.clientX;
        this.clientY = touch.clientY;
    }
};
Event.prototype.cancelEvent = function () {
    this.preventDefault();
    this.stopPropagation();
    if (this.currentTarget != document.body) {
        let cloneEvent = new this.constructor(this.type, this);
        document.body.dispatchEvent(cloneEvent);
    }
}
Event.prototype.realTarget = function(){
    var _realTarget = (e, el = null, i = 0) => {
        if (el == null) {
            el = e.target;
        }
        if (i == 50) {
            debugger;
        }
        if (el.shadowRoot && e.pageX && e.pageY) {
            var newEl = el.shadowRoot.elementFromPoint(e.pageX, e.pageY);
            if (newEl && newEl != el) {
                return _realTarget(e, newEl, i + 1);
            }
        }
        return el;
    }
    return _realTarget(this);
}
Element.prototype.findParentByTag = function (tagname, untilNode = undefined) {
    let el = this;
    if(Array.isArray(tagname)) {
        for(let i = 0; i < tagname.length; i++) {
            tagname[i] = tagname[i].toLowerCase();
        }
    } else {
        tagname = [tagname.toLowerCase()];
    }
    let checkFunc = (el) => {
        return tagname.indexOf((el.nodeName || el.tagName).toLowerCase()) != -1;
    };
    
    if(el) {
        if(el instanceof ShadowRoot) {
            el = el.host;
        } else {
            el = el.parentNode;
        }
    }
    while(el) {
        if(checkFunc(el)) {
            return el;
        }

        if(el instanceof ShadowRoot) {
            el = el.host;
        } else {
            el = el.parentNode;
        }
        if(el == untilNode) {
            break;
        }
    }
    return null;
};
Element.prototype.findParentByClass = function (classname, untilNode = undefined) {
    let el = this;
    if(!Array.isArray(classname)) {
        classname = [classname];
    }
    if(el) {
        if(el instanceof ShadowRoot) {
            el = el.host;
        } else {
            el = el.parentNode;
        }
    }
    while(el) {
        for(let classnameTemp of classname) {
            if(el.classList && el.classList.contains(classnameTemp)) {
                return el;
            }
        }


        if(el instanceof ShadowRoot) {
            el = el.host;
        } else {
            el = el.parentNode;
        }
        if(el == untilNode) {
            break;
        }
    }

    return null;
};
Element.prototype.findParentByType = function (type, untilNode = undefined) {
    let el = this;
    let checkFunc = (el) => {
        return false;
    };
    if(typeof type == "function" && type.prototype.constructor) {
        checkFunc = (el) => {
            if(el instanceof type) {
                return true;
            }
            return false;
        };

    }
    else {
        console.error("you must provide a class inside this function");
        return null;
    }

    if(el) {
        if(el instanceof ShadowRoot) {
            el = el.host;
        } else {
            el = el.parentNode;
        }
    }
    while(el) {
        if(checkFunc(el)) {
            return el;
        }

        if(el instanceof ShadowRoot) {
            el = el.host;
        } else {
            el = el.parentNode;
        }
        if(el == untilNode) {
            break;
        }
    }
    return null;
};
Element.prototype.findParents = function (tagname, untilNode = undefined) {
    let el = this;
    if(Array.isArray(tagname)) {
        for(let i = 0; i < tagname.length; i++) {
            tagname[i] = tagname[i].toLowerCase();
        }
    } else {
        tagname = [tagname.toLowerCase()];
    }
    let result = [];
    if(el) {
        if(el instanceof ShadowRoot) {
            el = el.host;
        } else {
            el = el.parentNode;
        }
    }
    while(el) {
        if(tagname.indexOf((el.nodeName || el.tagName).toLowerCase()) != -1) {
            result.push(el);
        }

        if(el instanceof ShadowRoot) {
            el = el.host;
        } else {
            el = el.parentNode;
        }
        if(el == untilNode) {
            break;
        }
    }

    return result;
};
Element.prototype.containsChild = function (el) {
    var rootScope = this.getRootNode();
    var elScope = el.getRootNode();
    while(elScope != rootScope) {
        if(!elScope.host) {
            return false;
        }
        el = elScope.host;
        elScope = elScope.host.getRootNode();
    }

    return this.contains(el);
};
Element.prototype.getPositionOnScreen = function (untilEl = undefined) {
    let el = this;
    let top = 0;
    let left = 0;
    while(el != untilEl) {
        top += el.offsetTop || 0;
        top -= el.scrollTop || 0;

        left += el.offsetLeft || 0;
        left -= el.scrollLeft || 0;
        el = el.offsetParent;
    }
    top -= window.scrollY;
    left -= window.scrollX;
    return {
        x: left,
        y: top,
    };
};
Element.prototype.getElementsInSlot = function () {
    if(this.shadowRoot) {
        let slotEl = this.shadowRoot.querySelector("slot");
        while(true) {
            if(!slotEl) {
                return [];
            }
            var listChild = Array.from(slotEl.assignedElements());
            if(!listChild) {
                return [];
            }
            let slotFound = false;
            for(let i = 0; i < listChild.length; i++) {
                if(listChild[i].nodeName == "SLOT") {
                    slotEl = listChild[i];
                    slotFound = true;
                    break;
                }
            }
            if(!slotFound) {
                return listChild;
            }
        }
    }
    return [];
}
Date.prototype.clone = function () {
    var newDate = new Date();
    newDate.setTime(this.getTime());
    return newDate;
}

Array.prototype.unique = function(){
    return [...new Set(this)]   
}
Array.prototype.last = function () {
    if (this.length == 0) {
        return null;
    }
    return this[this.length - 1];
}
class DragAndDrop {    static defaultOffsetDrag = 20;    pressManager;    options;    startCursorPosition;    startElementPosition;    constructor(options) {        this.options = this.getDefaultOptions();        this.mergeProperties(options);        this.mergeFunctions(options);        this.init();    }    getDefaultOptions() {        return {            applyDrag: true,            element: null,            elementTrigger: null,            offsetDrag: DragAndDrop.defaultOffsetDrag,            shadow: {                enable: false,                container: document.body            },            strict: false,            targets: [],            usePercent: false,            isDragEnable: () => true,            getZoom: () => 1,            getOffsetX: () => 0,            getOffsetY: () => 0,            onStart: (e) => { },            onMove: (e) => { },            onStop: (e) => { },            onDrop: (element, targets) => { }        };    }    mergeProperties(options) {        if (options.element === void 0) {            throw "You must define the element for the drag&drop";        }        this.options.element = options.element;        if (options.elementTrigger === void 0) {            this.options.elementTrigger = this.options.element;        }        this.defaultMerge(options, "applyDrag");        this.defaultMerge(options, "offsetDrag");        this.defaultMerge(options, "strict");        this.defaultMerge(options, "targets");        this.defaultMerge(options, "usePercent");        if (options.shadow !== void 0) {            this.options.shadow.enable = options.shadow.enable;            if (options.shadow.container !== void 0) {                this.options.shadow.container = options.shadow.container;            }        }    }    mergeFunctions(options) {        this.defaultMerge(options, "isDragEnable");        this.defaultMerge(options, "getZoom");        this.defaultMerge(options, "getOffsetX");        this.defaultMerge(options, "getOffsetY");        this.defaultMerge(options, "onStart");        this.defaultMerge(options, "onMove");        this.defaultMerge(options, "onStop");        this.defaultMerge(options, "onDrop");    }    defaultMerge(options, name) {        if (options[name] !== void 0) {            this.options[name] = options[name];        }    }    init() {        this.pressManager = new PressManager({            element: this.options.elementTrigger,            onDragStart: this.onDragStart.bind(this),            onDrag: this.onDrag.bind(this),            onDragEnd: this.onDragEnd.bind(this),            offsetDrag: this.options.offsetDrag        });    }    draggableElement;    positionShadowRelativeToElement;    onDragStart(e) {        this.draggableElement = this.options.element;        this.startCursorPosition = {            x: e.pageX,            y: e.pageY        };        this.startElementPosition = {            x: this.draggableElement.offsetLeft,            y: this.draggableElement.offsetTop        };        if (this.options.shadow.enable) {            this.draggableElement = this.options.element.cloneNode(true);            const posRelativeToContainer = this.options.element.getPositionOnScreen(this.options.shadow.container);            this.positionShadowRelativeToElement = {                x: this.startCursorPosition.x - posRelativeToContainer.x,                y: this.startCursorPosition.y - posRelativeToContainer.y            };            this.draggableElement.style.position = "absolute";            this.draggableElement.style.top = posRelativeToContainer.y / this.options.getZoom() + 'px';            this.draggableElement.style.left = posRelativeToContainer.x / this.options.getZoom() + 'px';            this.options.shadow.container.appendChild(this.draggableElement);        }        this.options.onStart(e);    }    onDrag(e) {        let zoom = this.options.getZoom();        let diff = {            x: 0,            y: 0        };        if (this.options.shadow.enable) {            diff = {                x: e.pageX - (this.positionShadowRelativeToElement.x / this.options.getZoom()) + this.options.getOffsetX(),                y: e.pageY - (this.positionShadowRelativeToElement.y / this.options.getZoom()) + this.options.getOffsetY(),            };        }        else {            diff = {                x: (e.pageX - this.startCursorPosition.x) / zoom + this.startElementPosition.x + this.options.getOffsetX(),                y: (e.pageY - this.startCursorPosition.y) / zoom + this.startElementPosition.y + this.options.getOffsetY()            };        }        let newPos = this.setPosition(diff);        this.options.onMove(e, newPos);    }    onDragEnd(e) {        let targets = this.getMatchingTargets();        if (this.options.shadow.enable) {            this.draggableElement.parentNode?.removeChild(this.draggableElement);        }        if (targets.length > 0) {            this.options.onDrop(this.draggableElement, targets);        }    }    setPosition(position) {        if (this.options.usePercent) {            let elementParent = this.draggableElement.offsetParent;            const percentLeft = (position.x / elementParent.offsetWidth) * 100;            const percentTop = (position.y / elementParent.offsetHeight) * 100;            if (this.options.applyDrag) {                this.draggableElement.style.left = percentLeft + '%';                this.draggableElement.style.top = percentTop + '%';            }            return {                x: percentLeft,                y: percentTop            };        }        else {            if (this.options.applyDrag) {                this.draggableElement.style.left = position.x + 'px';                this.draggableElement.style.top = position.y + 'px';            }        }        return position;    }    getMatchingTargets() {        let matchingTargets = [];        for (let target of this.options.targets) {            const elementCoordinates = this.draggableElement.getBoundingClientRect();            const targetCoordinates = target.getBoundingClientRect();            let offsetX = this.options.getOffsetX();            let offsetY = this.options.getOffsetY();            let zoom = this.options.getZoom();            targetCoordinates.x += offsetX;            targetCoordinates.y += offsetY;            targetCoordinates.width *= zoom;            targetCoordinates.height *= zoom;            if (this.options.strict) {                if ((elementCoordinates.x >= targetCoordinates.x && elementCoordinates.x + elementCoordinates.width <= targetCoordinates.x + targetCoordinates.width) &&                    (elementCoordinates.y >= targetCoordinates.y && elementCoordinates.y + elementCoordinates.height <= targetCoordinates.y + targetCoordinates.height)) {                    matchingTargets.push(target);                }            }            else {                let elementLeft = elementCoordinates.x;                let elementRight = elementCoordinates.x + elementCoordinates.width;                let elementTop = elementCoordinates.y;                let elementBottom = elementCoordinates.y + elementCoordinates.height;                let targetLeft = targetCoordinates.x;                let targetRight = targetCoordinates.x + targetCoordinates.width;                let targetTop = targetCoordinates.y;                let targetBottom = targetCoordinates.y + targetCoordinates.height;                if (!(elementRight < targetLeft ||                    elementLeft > targetRight ||                    elementBottom < targetTop ||                    elementTop > targetBottom)) {                    matchingTargets.push(target);                }            }        }        return matchingTargets;    }    setTargets(targets) {        this.options.targets = targets;    }}
class Color {    subscribers = [];    currentColor;    static createFromRgb(r, g, b) {        return new Color(`rgb(${r}, ${g}, ${b})`);    }    /**     * The hex format of the color     */    get hex() {        return this.rgbToHex(this.currentColor.r, this.currentColor.g, this.currentColor.b);    }    set hex(hexString) {        this.currentColor = this.hexStringToRgb(hexString);        this.emitEvent();    }    /**     * The rgb format of the color     */    get rgb() {        return this.currentColor;    }    set rgb(value) {        if (typeof value === 'object' &&            !Array.isArray(value) &&            value !== null) {            value.r = Math.min(Math.max(value.r, 0), 255);            value.g = Math.min(Math.max(value.g, 0), 255);            value.b = Math.min(Math.max(value.b, 0), 255);            this.currentColor = value;            this.emitEvent();        }    }    get r() {        return this.currentColor.r;    }    set r(newValue) {        if (newValue >= 0 && newValue <= 255) {            this.currentColor.r = newValue;            this.emitEvent();        }        else {            throw new Error("Invalid value");        }    }    get g() {        return this.currentColor.g;    }    set g(newValue) {        if (newValue >= 0 && newValue <= 255) {            this.currentColor.g = newValue;            this.emitEvent();        }        else {            throw new Error("Invalid value");        }    }    get b() {        return this.currentColor.b;    }    set b(newValue) {        if (newValue >= 0 && newValue <= 255) {            this.currentColor.b = newValue;            this.emitEvent();        }        else {            throw new Error("Invalid value");        }    }    /**     * Create a new color     */    constructor(colorString) {        let colorType = this.getColorType(colorString);        if (colorType !== ColorTypes.unkown) {            if (colorType === ColorTypes.rgb) {                this.currentColor = this.stringToRgb(colorString);            }            else if (colorType === ColorTypes.hex) {                this.currentColor = this.hexStringToRgb(colorString);            }            else if (colorType === ColorTypes.rgba) {                console.log("Not implemented yet");            }            else {                throw new Error("Unknown color type");            }        }        else {            throw new Error(`${colorString} is not a supported color`);        }    }    getColorType(colorString) {        let treatedColor = colorString.replaceAll(" ", "");        if (treatedColor[0] === "#") {            return ColorTypes.hex;        }        else if (/^rgb\((\d{1,3},*){3}\)$/.test(treatedColor)) {            return ColorTypes.rgb;        }        else if (/^rgb\((\d{1,3},*){4}\)$/.test(treatedColor)) {            return ColorTypes.rgba;        }        else {            console.warn(`Got an unknown color : ${treatedColor}`);            return ColorTypes.unkown;        }    }    stringToRgb(rgbColorString) {        let splitted = rgbColorString.replaceAll(/[\(\)rgb ]/g, "").split(",");        for (let i = 0; i < 3; i++) {            splitted[i] = Math.min(Math.max(parseInt(splitted[i])), 255);        }        return {            r: splitted[0],            g: splitted[1],            b: splitted[2]        };    }    hexStringToRgb(hexColorString) {        let shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;        hexColorString = hexColorString.replace(shorthandRegex, function (m, r, g, b) {            return r + r + g + g + b + b;        });        let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexColorString);        if (!result) {            console.error(`Invalid hex string : ${hexColorString}`);            return {                r: 0,                g: 0,                b: 0            };        }        else {            return {                r: parseInt(result[1], 16),                g: parseInt(result[2], 16),                b: parseInt(result[3], 16)            };        }    }    rgbToHex(r, g, b) {        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);    }    onChange(callback) {        if (this.subscribers.indexOf(callback) !== -1) {            console.error("Callback was already present in the subscribers");            return;        }        this.subscribers.push(callback);    }    offChange(callback) {        let index = this.subscribers.indexOf(callback);        if (index === -1) {            console.error("Callback was not present in the subscribers");            return;        }        else {            this.subscribers.splice(index, 1);        }    }    emitEvent() {        [...this.subscribers].forEach(subscriber => {            subscriber(this);        });    }}
class AnimationManager {    static FPS_DEFAULT = 60;    options;    nextFrame;    fpsInterval;    continueAnimation = false;    constructor(options) {        if (!options.animate) {            options.animate = () => { };        }        if (!options.stopped) {            options.stopped = () => { };        }        if (!options.fps) {            options.fps = AnimationManager.FPS_DEFAULT;        }        this.options = options;        this.fpsInterval = 1000 / this.options.fps;    }    animate() {        let now = window.performance.now();        let elapsed = now - this.nextFrame;        if (elapsed <= this.fpsInterval) {            requestAnimationFrame(() => this.animate());            return;        }        this.nextFrame = now - (elapsed % this.fpsInterval);        setTimeout(() => {            this.options.animate();        }, 0);        if (this.continueAnimation) {            requestAnimationFrame(() => this.animate());        }        else {            this.options.stopped();        }    }    /**     * Start the of animation     */    start() {        if (this.continueAnimation == false) {            this.continueAnimation = true;            this.nextFrame = window.performance.now();            this.animate();        }    }    /**     * Stop the animation     */    stop() {        this.continueAnimation = false;    }    /**     * Get the FPS     *     * @returns {number}     */    getFPS() {        return this.options.fps;    }    /**     * Set the FPS     *     * @param fps     */    setFPS(fps) {        this.options.fps = fps;        this.fpsInterval = 1000 / this.options.fps;    }    /**     * Get the animation status (true if animation is running)     *     * @returns {boolean}     */    isStarted() {        return this.continueAnimation;    }}


class WebComponent extends HTMLElement {    static get observedAttributes() {        return [];    }    _first;    _isReady;    get isReady() {        return this._isReady;    }    _translations;    currentState = "";    statesList;    _components;    __onChangeFct = {};    getSlugFct;    __watch;    __watchActions = {};    __prepareForCreate = [];    __prepareForUpdate = [];    __loopTemplate = {};    __watchActionsCb = {};    getClassName() {        return this.constructor.name;    }    ;    constructor() {        super();        if (this.constructor == WebComponent) {            throw "can't instanciate an abstract class";        }        this._first = true;        this._isReady = false;        this.__prepareVariables();        this.__prepareTranslations();        this.__prepareWatchesActions();        this.__initWatches();        this.__prepareTemplate();        this.__selectElementNeeded();        this.__registerOnChange();        this.__createStates();        this.__prepareForLoop();        this.__endConstructor();    }    __prepareVariables() { }    __prepareWatchesActions() {        if (Object.keys(this.__watchActions).length > 0) {            if (!this.__watch) {                this.__watch = Object.transformIntoWatcher({}, (type, path, element) => {                    let action = this.__watchActionsCb[path.split(".")[0]] || this.__watchActionsCb[path.split("[")[0]];                    action(type, path, element);                });            }        }    }    __initWatches() { }    __prepareForLoop() { }    __getLangTranslations() {        return [];    }    __prepareTranslations() {        this._translations = {};        let langs = this.__getLangTranslations();        for (let i = 0; i < langs.length; i++) {            this._translations[langs[i]] = {};        }        this.__setTranslations();    }    __setTranslations() {    }    __getStyle() {        return [":host{display:inline-block;box-sizing:border-box}:host *{box-sizing:border-box}"];    }    __getHtml() {        return {            html: '<slot></slot>',            slots: {                default: '<slot></slot>'            }        };    }    __prepareTemplate() {        let tmpl = document.createElement('template');        tmpl.innerHTML = `        <style>            ${this.__getStyle().join("\r\n")}        </style>${this.__getHtml().html}`;        let shadowRoot = this.attachShadow({ mode: 'open' });        shadowRoot.appendChild(tmpl.content.cloneNode(true));    }    __createStates() {        this.currentState = "default";        this.statesList = {            "default": this.getDefaultStateCallbacks()        };        this.getSlugFct = {};    }    getDefaultStateCallbacks() {        return {            active: () => { },            inactive: () => { }        };    }    __getMaxId() {        return [];    }    __selectElementNeeded(ids = null) {        if (ids == null) {            var _maxId = this.__getMaxId();            this._components = {};            for (var i = 0; i < _maxId.length; i++) {                for (let j = 0; j < _maxId[i][1]; j++) {                    let key = _maxId[i][0].toLowerCase() + "_" + j;                    this._components[key] = Array.from(this.shadowRoot.querySelectorAll('[_id="' + key + '"]'));                }            }        }        else {            for (let i = 0; i < ids.length; i++) {            }        }        this.__mapSelectedElement();    }    __mapSelectedElement() {    }    __registerOnChange() {    }    __endConstructor() { }    connectedCallback() {        this.__defaultValue();        this.__upgradeAttributes();        this.__addEvents();        if (this._first) {            this._first = false;            this.__applyTranslations();            setTimeout(() => {                this.__subscribeState();                this.postCreation();                this._isReady = true;                this.dispatchEvent(new CustomEvent('ready'));            });        }    }    __defaultValue() { }    __upgradeAttributes() { }    __listBoolProps() {        return [];    }    __upgradeProperty(prop) {        let boolProps = this.__listBoolProps();        if (boolProps.indexOf(prop) != -1) {            if (this.hasAttribute(prop) && (this.getAttribute(prop) === "true" || this.getAttribute(prop) === "")) {                let value = this.getAttribute(prop);                delete this[prop];                this[prop] = value;            }            else {                this.removeAttribute(prop);                this[prop] = false;            }        }        else {            if (this.hasAttribute(prop)) {                let value = this.getAttribute(prop);                delete this[prop];                this[prop] = value;            }        }    }    __addEvents() { }    __applyTranslations() { }    __getTranslation(key) {        if (!this._translations)            return;        var lang = localStorage.getItem('lang');        if (lang === null) {            lang = 'en';        }        if (key.indexOf('lang.') === 0) {            key = key.substring(5);        }        if (this._translations[lang] !== undefined) {            return this._translations[lang][key];        }        return key;    }    getStateManagerName() {        return undefined;    }    __subscribeState() {        var currentState = StateManager.getInstance(this.getStateManagerName()).getActiveState() || "";        var currentSlug = StateManager.getInstance(this.getStateManagerName()).getActiveSlug() || "*";        var stateSlugged = currentState.replace("*", currentSlug);        if (this.statesList.hasOwnProperty(stateSlugged)) {            this.statesList[stateSlugged].active(stateSlugged);        }        else {            this.statesList["default"].active("default");        }        for (let route in this.statesList) {            StateManager.getInstance(this.getStateManagerName()).subscribe(route, this.statesList[route]);        }    }    attributeChangedCallback(name, oldValue, newValue) {        if (oldValue !== newValue) {            if (this.__onChangeFct.hasOwnProperty(name)) {                for (let fct of this.__onChangeFct[name]) {                    fct('');                }            }        }    }    postCreation() { }    _unsubscribeState() {        if (this.statesList) {            for (let key in this.statesList) {                StateManager.getInstance(this.getStateManagerName()).unsubscribe(key, this.statesList[key]);            }        }    }}


var WatchAction;(function (WatchAction) {    WatchAction[WatchAction["SET"] = 0] = "SET";    WatchAction[WatchAction["CREATED"] = 1] = "CREATED";    WatchAction[WatchAction["UPDATED"] = 2] = "UPDATED";    WatchAction[WatchAction["DELETED"] = 3] = "DELETED";})(WatchAction || (WatchAction = {}));

class Coordinate {    x = 0;    y = 0;}
var ColorTypes;(function (ColorTypes) {    ColorTypes[ColorTypes["rgb"] = 0] = "rgb";    ColorTypes[ColorTypes["hex"] = 1] = "hex";    ColorTypes[ColorTypes["rgba"] = 2] = "rgba";    ColorTypes[ColorTypes["unkown"] = 3] = "unkown";})(ColorTypes || (ColorTypes = {}));
class ColorData {    r = 0;    g = 0;    b = 0;}



class AvScrollable extends WebComponent {
    static get observedAttributes() {return ["disable_scroll", "zoom"].concat(super.observedAttributes).filter((v, i, a) => a.indexOf(v) === i);}
    get 'disable_scroll'() {
                        return this.hasAttribute('disable_scroll');
                    }
                    set 'disable_scroll'(val) {
                        if(val === 1 || val === 'true' || val === ''){
                            val = true;
                        }
                        else if(val === 0 || val === 'false' || val === null || val === undefined){
                            val = false;
                        }
                        if(val !== false && val !== true){
                            console.error("error setting boolean in disable_scroll");
                            val = false;
                        }
                        if (val) {
                            this.setAttribute('disable_scroll', 'true');
                        } else{
                            this.removeAttribute('disable_scroll');
                        }
                    }get 'zoom'() {
                        return Number(this.getAttribute('zoom'));
                    }
                    set 'zoom'(val) {
                        this.setAttribute('zoom',val);
                    }get 'floating_scroll'() {
                        return this.hasAttribute('floating_scroll');
                    }
                    set 'floating_scroll'(val) {
                        if(val === 1 || val === 'true' || val === ''){
                            val = true;
                        }
                        else if(val === 0 || val === 'false' || val === null || val === undefined){
                            val = false;
                        }
                        if(val !== false && val !== true){
                            console.error("error setting boolean in floating_scroll");
                            val = false;
                        }
                        if (val) {
                            this.setAttribute('floating_scroll', 'true');
                        } else{
                            this.removeAttribute('floating_scroll');
                        }
                    }get 'only_vertical'() {
                        return this.hasAttribute('only_vertical');
                    }
                    set 'only_vertical'(val) {
                        if(val === 1 || val === 'true' || val === ''){
                            val = true;
                        }
                        else if(val === 0 || val === 'false' || val === null || val === undefined){
                            val = false;
                        }
                        if(val !== false && val !== true){
                            console.error("error setting boolean in only_vertical");
                            val = false;
                        }
                        if (val) {
                            this.setAttribute('only_vertical', 'true');
                        } else{
                            this.removeAttribute('only_vertical');
                        }
                    }    __prepareVariables() { super.__prepareVariables(); if(this.verticalScrollVisible === undefined) {this.verticalScrollVisible = false;}if(this.horizontalScrollVisible === undefined) {this.horizontalScrollVisible = false;}if(this.observer === undefined) {this.observer = undefined;}if(this.wheelAction === undefined) {this.wheelAction = undefined;}if(this.touchWheelAction === undefined) {this.touchWheelAction = undefined;}if(this.contentHidderWidth === undefined) {this.contentHidderWidth = 0;}if(this.contentHidderHeight === undefined) {this.contentHidderHeight = 0;}if(this.content === undefined) {this.content = {"vertical":{"value":0,"max":0},"horizontal":{"value":0,"max":0}};}if(this.scrollbar === undefined) {this.scrollbar = {"vertical":{"value":0,"max":0},"horizontal":{"value":0,"max":0}};}if(this.refreshTimeout === undefined) {this.refreshTimeout = 100;} }
    __getStyle() {
        let arrStyle = super.__getStyle();
        arrStyle.push(`:host{--internal-scrollbar-content-overflow: var(--scrollbar-content-overflow, hidden);--internal-scrollbar-content-height: var(--scrollbar-content-height, auto);--internal-scrollbar-content-width: var(--scrollbar-content-width, 100%);--internal-scrollbar-container-color: var(--scrollbar-container-color, transparent);--internal-scrollbar-color: var(--scrollbar-color, #757575);--internal-scrollbar-active-color: var(--scrollbar-active-color, #757575);--internal-scroller-width: var(--scroller-width, 6px);--internal-scroller-bottom: var(--scroller-bottom, 3px);--internal-scroller-right: var(--scroller-right, 3px);--internal-scroller-left: var(--scroller-left, 3px);--internal-scroller-top: var(--scroller-top, 3px);--internal-scroller-vertical-shadow: var(--scroller-shadow, var(--scroller-vertical-shadow, none));--internal-scroller-horizontal-shadow: var(--scroller-shadow, var(--scroller-horizontal-shadow, none));--internal-scollable-delay: var(--scrollable-delay, 0.3s)}:host{-webkit-user-drag:none;-khtml-user-drag:none;-moz-user-drag:none;-o-user-drag:none}:host *{-webkit-user-drag:none;-khtml-user-drag:none;-moz-user-drag:none;-o-user-drag:none;box-sizing:border-box}:host{display:block;position:relative;height:100%;width:100%}:host .scroll-main-container{display:block;position:relative;height:100%;width:100%}:host .scroll-main-container .content-zoom{display:block;position:relative;height:100%;width:100%;transform-origin:0 0}:host .scroll-main-container .content-hidder{overflow:var(--internal-scrollbar-content-overflow);width:100%;height:100%;position:relative;display:block}:host .scroll-main-container .content-wrapper{position:absolute;display:inline-block;top:0;left:0;height:var(--internal-scrollbar-content-height);width:var(--internal-scrollbar-content-width);transition:top var(--internal-scollable-delay) linear,left var(--internal-scollable-delay) linear}:host .scroll-main-container .container-scroller{position:absolute;background-color:var(--internal-scrollbar-container-color);border-radius:5px;z-index:5;display:none}:host .scroll-main-container .scroller{background-color:var(--internal-scrollbar-color);border-radius:5px;position:absolute;z-index:5;cursor:pointer}:host .scroll-main-container .scroller.active{background-color:var(--internal-scrollbar-active-color);transition:none !important}:host .scroll-main-container .container-scroller.vertical{width:calc(var(--internal-scroller-width) + var(--internal-scroller-left));padding-left:var(--internal-scroller-left);top:var(--internal-scroller-bottom);height:calc(100% - var(--internal-scroller-bottom)*2 - var(--internal-scroller-width));right:var(--internal-scroller-right)}:host .scroll-main-container .scroller.vertical{width:calc(100% - var(--internal-scroller-left));top:0;transition:top var(--internal-scollable-delay) linear;box-shadow:var(--internal-scroller-vertical-shadow)}:host .scroll-main-container .container-scroller.horizontal{height:calc(var(--internal-scroller-width) + var(--internal-scroller-top));padding-top:var(--internal-scroller-top);left:var(--internal-scroller-right);width:calc(100% - var(--internal-scroller-right)*2 - var(--internal-scroller-width));bottom:var(--internal-scroller-bottom)}:host .scroll-main-container .scroller.horizontal{height:calc(100% - var(--internal-scroller-top));left:0;transition:left var(--internal-scollable-delay) linear;box-shadow:var(--internal-scroller-horizontal-shadow)}:host([disable_scroll]) .content-wrapper{height:100%}:host([disable_scroll]) .scroller{display:none}:host(.scrolling) .content-wrapper *{user-select:none}:host(.scrolling) ::slotted{user-select:none}`);
        return arrStyle;
    }
    __getHtml() {
        let parentInfo = super.__getHtml();
        let info = {
            html: `<div class="scroll-main-container" _id="avscrollable_0">
    <div class="content-zoom" _id="avscrollable_1">
        <div class="content-hidder" _id="avscrollable_2">
            <div class="content-wrapper" _id="avscrollable_3">
                <slot></slot>
            </div>
        </div>
    </div>
    <div _id="avscrollable_4">
        <div class="container-scroller vertical" _id="avscrollable_5">
            <div class="scroller vertical" _id="avscrollable_6"></div>
        </div>
        <div class="container-scroller horizontal" _id="avscrollable_7">
            <div class="scroller horizontal" _id="avscrollable_8"></div>
        </div>
    </div>
</div>`,
            slots: {
                'default':`<slot></slot>`
            },
            blocks: {
                'default':`<div class="scroll-main-container" _id="avscrollable_0">
    <div class="content-zoom" _id="avscrollable_1">
        <div class="content-hidder" _id="avscrollable_2">
            <div class="content-wrapper" _id="avscrollable_3">
                <slot></slot>
            </div>
        </div>
    </div>
    <div _id="avscrollable_4">
        <div class="container-scroller vertical" _id="avscrollable_5">
            <div class="scroller vertical" _id="avscrollable_6"></div>
        </div>
        <div class="container-scroller horizontal" _id="avscrollable_7">
            <div class="scroller horizontal" _id="avscrollable_8"></div>
        </div>
    </div>
</div>`
            }
        }
        return info;
    }
    __getMaxId() {
        let temp = super.__getMaxId();
        temp.push(["AvScrollable", 9])
        return temp;
    }
    __mapSelectedElement() { super.__mapSelectedElement(); this.elToCalculate = this.shadowRoot.querySelector('[_id="avscrollable_0"]');this.contentZoom = this.shadowRoot.querySelector('[_id="avscrollable_1"]');this.contentHidder = this.shadowRoot.querySelector('[_id="avscrollable_2"]');this.contentWrapper = this.shadowRoot.querySelector('[_id="avscrollable_3"]');this.contentscroller = this.shadowRoot.querySelector('[_id="avscrollable_4"]');this.verticalScrollerContainer = this.shadowRoot.querySelector('[_id="avscrollable_5"]');this.verticalScroller = this.shadowRoot.querySelector('[_id="avscrollable_6"]');this.horizontalScrollerContainer = this.shadowRoot.querySelector('[_id="avscrollable_7"]');this.horizontalScroller = this.shadowRoot.querySelector('[_id="avscrollable_8"]');}
    __registerOnChange() { super.__registerOnChange(); this.__onChangeFct['disable_scroll'] = []this.__onChangeFct['disable_scroll'].push((path) => {((target) => {    if (target.disable_scroll) {        target.removeResizeObserver();        target.removeWheelAction();        target.contentZoom.style.width = '';        target.contentZoom.style.height = '';    }    else {        target.addResizeObserver();        target.addWheelAction();    }})(this);})this.__onChangeFct['zoom'] = []this.__onChangeFct['zoom'].push((path) => {((target) => {    target.changeZoom();})(this);}) }
    getClassName() {
        return "AvScrollable";
    }
    __defaultValue() { super.__defaultValue(); if(!this.hasAttribute('disable_scroll')) { this.attributeChangedCallback('disable_scroll', false, false); }if(!this.hasAttribute('zoom')){ this['zoom'] = '1'; }if(!this.hasAttribute('floating_scroll')) { this.attributeChangedCallback('floating_scroll', false, false); }if(!this.hasAttribute('only_vertical')) { this.attributeChangedCallback('only_vertical', false, false); } }
    __upgradeAttributes() { super.__upgradeAttributes(); this.__upgradeProperty('disable_scroll');this.__upgradeProperty('zoom'); }
    __listBoolProps() { return ["disable_scroll","floating_scroll","only_vertical"].concat(super.__listBoolProps()).filter((v, i, a) => a.indexOf(v) === i); }
     getVisibleBox(){return {    top: this.content.vertical.value,    left: this.content.horizontal.value,    width: this.contentHidder.offsetWidth,    height: this.contentHidder.offsetHeight};} changeZoom(){if (!this.disable_scroll) {    this.contentZoom.style.transform = 'scale(' + this.zoom + ')';    this.dimensionRefreshed();}} dimensionRefreshed(entries){this.calculateRealSize();if (this.contentWrapper.scrollHeight - this.contentHidderHeight > 2) {    if (!this.verticalScrollVisible) {        this.verticalScrollerContainer.style.display = "block";        this.verticalScrollVisible = true;        this.afterShowVerticalScroller();    }    var verticalScrollerHeight = (this.contentHidderHeight / this.contentWrapper.scrollHeight * 100);    this.verticalScroller.style.height = verticalScrollerHeight + '%';    this.scrollVerticalScrollbar(this.scrollbar.vertical.value);}else if (this.verticalScrollVisible) {    this.verticalScrollerContainer.style.display = "none";    this.verticalScrollVisible = false;    this.afterShowVerticalScroller();    this.scrollVerticalScrollbar(0);}if (!this.only_vertical) {    if (this.contentWrapper.scrollWidth - this.contentHidderWidth > 2) {        if (!this.horizontalScrollVisible) {            this.horizontalScrollerContainer.style.display = "block";            this.horizontalScrollVisible = true;            this.afterShowHorizontalScroller();        }        var horizontalScrollerWidth = (this.contentHidderWidth / this.contentWrapper.scrollWidth * 100);        this.horizontalScroller.style.width = horizontalScrollerWidth + '%';        this.scrollHorizontalScrollbar(this.scrollbar.horizontal.value);    }    else if (this.horizontalScrollVisible) {        this.horizontalScrollerContainer.style.display = "none";        this.horizontalScrollVisible = false;        this.afterShowHorizontalScroller();        this.scrollHorizontalScrollbar(0);    }}if (entries && entries[0].target == this) {    if (this.zoom != 1) {        this.contentZoom.style.width = '';        this.contentZoom.style.height = '';        this.changeZoom();    }}} calculateRealSize(){if (!this.disable_scroll) {    var currentOffsetWidth = this.contentZoom.offsetWidth;    var currentOffsetHeight = this.contentZoom.offsetHeight;    this.contentHidderHeight = currentOffsetHeight;    this.contentHidderWidth = currentOffsetWidth;    if (this.zoom < 1) {        this.contentZoom.style.width = this.elToCalculate.offsetWidth / this.zoom + 'px';        this.contentZoom.style.height = this.elToCalculate.offsetHeight / this.zoom + 'px';    }    else {        let inlineStyle = this.getAttribute("style");        if (inlineStyle) {            let arrStyle = inlineStyle.split(";");            for (let i = 0; i < arrStyle.length; i++) {                if (arrStyle[i].trim().startsWith("width") || arrStyle[i].trim().startsWith("height")) {                    this.contentZoom.style.width = '';                    this.contentZoom.style.height = '';                }            }        }        this.contentHidderHeight = currentOffsetHeight / this.zoom;        this.contentHidderWidth = currentOffsetWidth / this.zoom;    }}} afterShowVerticalScroller(){var leftMissing = this.elToCalculate.offsetWidth - this.verticalScrollerContainer.offsetLeft;if (leftMissing > 0 && this.verticalScrollVisible && !this.floating_scroll) {    this.contentHidder.style.width = 'calc(100% - ' + leftMissing + 'px)';    this.contentHidder.style.marginRight = leftMissing + 'px';}else {    this.contentHidder.style.width = '';    this.contentHidder.style.marginRight = '';}} afterShowHorizontalScroller(){var topMissing = this.elToCalculate.offsetHeight - this.horizontalScrollerContainer.offsetTop;if (topMissing > 0 && this.horizontalScrollVisible && !this.floating_scroll) {    this.contentHidder.style.height = 'calc(100% - ' + topMissing + 'px)';    this.contentHidder.style.marginBottom = topMissing + 'px';}else {    this.contentHidder.style.height = '';    this.contentHidder.style.marginBottom = '';}} createResizeObserver(){let inProgress = false;this.observer = new AvResizeObserver({    callback: entries => {        if (inProgress) {            return;        }        inProgress = true;        this.dimensionRefreshed(entries);        inProgress = false;    },    fps: 30});} addResizeObserver(){if (this.observer == undefined) {    this.createResizeObserver();}this.observer.observe(this.contentWrapper);this.observer.observe(this);} removeResizeObserver(){this.observer.unobserve(this.contentWrapper);this.observer.unobserve(this);} addVerticalScrollAction(){var diff = 0;var oldDiff = 0;var intervalTimer = undefined;var intervalMove = () => {    if (diff != oldDiff) {        oldDiff = diff;        this.scrollVerticalScrollbar(diff);    }};let mouseDown = (e) => {    e.normalize();    var startY = e.pageY;    var oldVerticalScrollPosition = this.verticalScroller.offsetTop;    this.classList.add("scrolling");    this.verticalScroller.classList.add("active");    intervalTimer = setInterval(intervalMove, this.refreshTimeout);    var mouseMove = (e) => {        e.normalize();        diff = oldVerticalScrollPosition + e.pageY - startY;    };    var mouseUp = (e) => {        clearInterval(intervalTimer);        this.scrollVerticalScrollbar(diff);        this.classList.remove("scrolling");        this.verticalScroller.classList.remove("active");        document.removeEventListener("mousemove", mouseMove);        document.removeEventListener("touchmove", mouseMove);        document.removeEventListener("mouseup", mouseUp);        document.removeEventListener("touchend", mouseUp);    };    document.addEventListener("mousemove", mouseMove);    document.addEventListener("touchmove", mouseMove);    document.addEventListener("mouseup", mouseUp);    document.addEventListener("touchend", mouseUp);    return false;};this.verticalScroller.addEventListener("mousedown", mouseDown);this.verticalScroller.addEventListener("touchstart", mouseDown);this.verticalScroller.addEventListener("dragstart", this.preventDrag);this.verticalScroller.addEventListener("drop", this.preventDrag);} addHorizontalScrollAction(){var diff = 0;var oldDiff = 0;var intervalTimer = undefined;var intervalMove = () => {    if (diff != oldDiff) {        oldDiff = diff;        this.scrollHorizontalScrollbar(diff);    }};let mouseDown = (e) => {    e.normalize();    var startX = e.pageX;    var oldHoritzontalScrollPosition = this.horizontalScroller.offsetLeft;    this.classList.add("scrolling");    this.horizontalScroller.classList.add("active");    intervalTimer = setInterval(intervalMove, this.refreshTimeout);    var mouseMove = (e) => {        e.normalize();        diff = oldHoritzontalScrollPosition + e.pageX - startX;    };    var mouseUp = (e) => {        clearInterval(intervalTimer);        this.scrollHorizontalScrollbar(diff);        this.classList.remove("scrolling");        this.horizontalScroller.classList.remove("active");        document.removeEventListener("mousemove", mouseMove);        document.removeEventListener("touchmove", mouseMove);        document.removeEventListener("mouseup", mouseUp);        document.removeEventListener("touchend", mouseUp);    };    document.addEventListener("mousemove", mouseMove);    document.addEventListener("touchmove", mouseMove);    document.addEventListener("mouseup", mouseUp);    document.addEventListener("touchend", mouseUp);};this.horizontalScroller.addEventListener("mousedown", mouseDown);this.horizontalScroller.addEventListener("touchstart", mouseDown);this.horizontalScroller.addEventListener("dragstart", this.preventDrag);this.horizontalScroller.addEventListener("drop", this.preventDrag);} createTouchWheelAction(){this.touchWheelAction = (e) => {    e.normalize();    let startX = e.pageX;    let startY = e.pageY;    let startVertical = this.scrollbar.vertical.value;    let startHorizontal = this.scrollbar.horizontal.value;    let touchMove = (e) => {        e.normalize();        let diffX = startX - e.pageX;        let diffY = startY - e.pageY;        this.scrollHorizontalScrollbar(startHorizontal + diffX);        this.scrollVerticalScrollbar(startVertical + diffY);    };    let touchEnd = () => {        window.removeEventListener("touchmove", touchMove);        window.removeEventListener("touchend", touchEnd);    };    window.addEventListener("touchmove", touchMove);    window.addEventListener("touchend", touchEnd);};} createWheelAction(){this.wheelAction = (e) => {    if (e.altKey) {        if (this.horizontalScrollVisible) {            var scrollX = e.deltaY / 5;            this.scrollHorizontalScrollbar(this.scrollbar.horizontal.value + scrollX);            let maxHorizontal = this.horizontalScrollerContainer.offsetWidth - this.horizontalScroller.offsetWidth;            if (this.scrollbar.horizontal.value != 0 && this.scrollbar.horizontal.value != maxHorizontal) {                e.preventDefault();                e.stopPropagation();            }        }    }    else {        if (this.verticalScrollVisible) {            var scrollY = e.deltaY / 5;            this.scrollVerticalScrollbar(this.scrollbar.vertical.value + scrollY);            let maxVertical = this.verticalScrollerContainer.offsetHeight - this.verticalScroller.offsetHeight;            if (this.scrollbar.vertical.value != 0 && this.scrollbar.vertical.value != maxVertical) {                e.preventDefault();                e.stopPropagation();            }        }    }};} addWheelAction(){if (!this.wheelAction) {    this.createWheelAction();}if (!this.touchWheelAction) {    this.createTouchWheelAction();}this.addEventListener("wheel", this.wheelAction);this.addEventListener("touchstart", this.touchWheelAction);} removeWheelAction(){if (this.wheelAction) {    this.removeEventListener("wheel", this.wheelAction);}if (this.touchWheelAction) {    this.removeEventListener("touchstart", this.touchWheelAction);}} scrollScrollbarTo(horizontalValue,verticalValue){this.scrollHorizontalScrollbar(horizontalValue);this.scrollVerticalScrollbar(verticalValue);} scrollHorizontalScrollbar(horizontalValue){if (!this.only_vertical) {    if (horizontalValue != undefined) {        var maxScroller = this.horizontalScrollerContainer.offsetWidth - this.horizontalScroller.offsetWidth;        this.scrollbar.horizontal.max = maxScroller;        var maxScrollContent = this.contentWrapper.scrollWidth - this.contentHidderWidth;        if (maxScrollContent < 0) {            maxScrollContent = 0;        }        this.content.horizontal.max = maxScrollContent;        if (horizontalValue < 0) {            horizontalValue = 0;        }        else if (horizontalValue > maxScroller) {            horizontalValue = maxScroller;        }        this.scrollbar.horizontal.value = horizontalValue;        this.horizontalScroller.style.left = horizontalValue + 'px';        if (maxScroller != 0) {            var percent = maxScrollContent / maxScroller;            this.content.horizontal.value = Math.round(horizontalValue * percent);        }        else {            this.content.horizontal.value = 0;        }        this.contentWrapper.style.left = -1 * this.content.horizontal.value + 'px';        this.emitScroll();    }}} scrollVerticalScrollbar(verticalValue){if (verticalValue != undefined) {    var maxScroller = this.verticalScrollerContainer.offsetHeight - this.verticalScroller.offsetHeight;    this.scrollbar.vertical.max = maxScroller;    var maxScrollContent = this.contentWrapper.scrollHeight - this.contentHidderHeight;    if (maxScrollContent < 0) {        maxScrollContent = 0;    }    this.content.vertical.max = maxScrollContent;    if (verticalValue < 0) {        verticalValue = 0;    }    else if (verticalValue > maxScroller) {        verticalValue = maxScroller;    }    this.scrollbar.vertical.value = verticalValue;    this.verticalScroller.style.top = verticalValue + 'px';    if (maxScroller != 0) {        var percent = maxScrollContent / maxScroller;        this.content.vertical.value = Math.round(verticalValue * percent);    }    else {        this.content.vertical.value = 0;    }    this.contentWrapper.style.top = -1 * this.content.vertical.value + 'px';    this.emitScroll();}} scrollHorizontal(horizontalValue){if (!this.only_vertical) {    if (horizontalValue != undefined) {        var maxScroller = this.horizontalScrollerContainer.offsetWidth - this.horizontalScroller.offsetWidth;        this.scrollbar.horizontal.max = maxScroller;        var maxScrollContent = this.contentWrapper.scrollWidth - this.contentHidderWidth;        if (maxScrollContent < 0) {            maxScrollContent = 0;        }        this.content.horizontal.max = maxScrollContent;        if (horizontalValue < 0) {            horizontalValue = 0;        }        else if (horizontalValue > maxScrollContent) {            horizontalValue = maxScrollContent;        }        this.content.horizontal.value = horizontalValue;        this.contentWrapper.style.left = -horizontalValue + 'px';        if (maxScroller != 0) {            var percent = maxScrollContent / maxScroller;            this.scrollbar.horizontal.value = Math.round(horizontalValue / percent);        }        else {            this.scrollbar.horizontal.value = 0;        }        this.horizontalScroller.style.left = this.scrollbar.horizontal.value + 'px';        this.emitScroll();    }}} scrollVertical(verticalValue){if (verticalValue != undefined) {    var maxScroller = this.verticalScrollerContainer.offsetHeight - this.verticalScroller.offsetHeight;    this.scrollbar.vertical.max = maxScroller;    var maxScrollContent = this.contentWrapper.scrollHeight - this.contentHidderHeight;    if (maxScrollContent < 0) {        maxScrollContent = 0;    }    this.content.vertical.max = maxScroller;    if (verticalValue < 0) {        verticalValue = 0;    }    else if (verticalValue > maxScrollContent) {        verticalValue = maxScrollContent;    }    this.content.vertical.value = verticalValue;    this.verticalScroller.style.top = -verticalValue + 'px';    if (maxScroller != 0) {        var percent = maxScrollContent / maxScroller;        this.scrollbar.vertical.value = Math.round(verticalValue / percent);    }    else {        this.scrollbar.vertical.value = 0;    }    this.verticalScroller.style.top = this.scrollbar.vertical.value + 'px';    this.contentWrapper.style.top = -1 * this.content.vertical.value + 'px';    this.emitScroll();}} scrollToPosition(horizontalValue,verticalValue){this.scrollHorizontal(horizontalValue);this.scrollVertical(verticalValue);} emitScroll(){var customEvent = new CustomEvent("scroll");this.dispatchEvent(customEvent);} preventDrag(e){e.preventDefault();return false;} postCreation(){if (!this.disable_scroll) {    this.addResizeObserver();    this.addWheelAction();}this.addVerticalScrollAction();this.addHorizontalScrollAction();this.contentHidder.addEventListener("scroll", () => {    if (this.contentHidder.scrollTop != 0) {        this.contentHidder.scrollTop = 0;    }});}}
window.customElements.define('av-scrollable', AvScrollable);
class AvRouterLink extends WebComponent {
    get 'state'() {
                        return this.getAttribute('state');
                    }
                    set 'state'(val) {
                        this.setAttribute('state',val);
                    }    __getStyle() {
        let arrStyle = super.__getStyle();
        arrStyle.push(``);
        return arrStyle;
    }
    __getHtml() {
        let parentInfo = super.__getHtml();
        let info = {
            html: `<slot></slot>`,
            slots: {
                'default':`<slot></slot>`
            },
            blocks: {
                'default':`<slot></slot>`
            }
        }
        return info;
    }
    __getMaxId() {
        let temp = super.__getMaxId();
        temp.push(["AvRouterLink", 0])
        return temp;
    }
    getClassName() {
        return "AvRouterLink";
    }
    __defaultValue() { super.__defaultValue(); if(!this.hasAttribute('state')){ this['state'] = ''; } }
     postCreation(){StateManager.getInstance("navigation").subscribe(this.state, {    active: () => {        this.classList.add("active");    },    inactive: () => {        this.classList.remove("active");    }});new PressManager({    element: this,    onPress: () => {        StateManager.getInstance("navigation").setActiveState(this.state);    }});}}
window.customElements.define('av-router-link', AvRouterLink);
class AvRouter extends WebComponent {
    constructor() { super(); if (this.constructor == AvRouter) { throw "can't instanciate an abstract class"; } }
    __prepareVariables() { super.__prepareVariables(); if(this.oldPage === undefined) {this.oldPage = undefined;} }
    __getStyle() {
        let arrStyle = super.__getStyle();
        arrStyle.push(``);
        return arrStyle;
    }
    __getHtml() {
        let parentInfo = super.__getHtml();
        let info = {
            html: `<slot name="before"></slot>
<div class="content" _id="avrouter_0"></div>
<slot name="after"></slot>`,
            slots: {
                'before':`<slot name="before"></slot>`,'after':`<slot name="after"></slot>`
            },
            blocks: {
                'default':`<slot name="before"></slot>
<div class="content" _id="avrouter_0"></div>
<slot name="after"></slot>`
            }
        }
        return info;
    }
    __getMaxId() {
        let temp = super.__getMaxId();
        temp.push(["AvRouter", 1])
        return temp;
    }
    __mapSelectedElement() { super.__mapSelectedElement(); this.contentEl = this.shadowRoot.querySelector('[_id="avrouter_0"]');}
    getClassName() {
        return "AvRouter";
    }
     register(){let routes = this.defineRoutes();for (let key in routes) {    this.initRoute(key, new routes[key]());}} initRoute(path,element){this.contentEl.appendChild(element);StateManager.getInstance("navigation").subscribe(path, {    active: (currentState) => {        if (this.oldPage && this.oldPage != element) {            this.oldPage.show = false;        }        element.show = true;        this.oldPage = element;        if (window.location.pathname != currentState) {            let newUrl = window.location.origin + currentState;            document.title = element.defineTitle();            window.history.pushState({}, element.defineTitle(), newUrl);        }    }});} postCreation(){this.register();if (window.localStorage.getItem("navigation_url")) {    StateManager.getInstance("navigation").setActiveState(window.localStorage.getItem("navigation_url"));    window.localStorage.removeItem("navigation_url");}else {    StateManager.getInstance("navigation").setActiveState(window.location.pathname);}window.onpopstate = (e) => {    if (window.location.pathname != StateManager.getInstance("navigation").getActiveState()) {        StateManager.getInstance("navigation").setActiveState(window.location.pathname);    }};}}
window.customElements.define('av-router', AvRouter);
class AvPage extends WebComponent {
    constructor() { super(); if (this.constructor == AvPage) { throw "can't instanciate an abstract class"; } }
    get 'show'() {
                        return this.hasAttribute('show');
                    }
                    set 'show'(val) {
                        if(val === 1 || val === 'true' || val === ''){
                            val = true;
                        }
                        else if(val === 0 || val === 'false' || val === null || val === undefined){
                            val = false;
                        }
                        if(val !== false && val !== true){
                            console.error("error setting boolean in show");
                            val = false;
                        }
                        if (val) {
                            this.setAttribute('show', 'true');
                        } else{
                            this.removeAttribute('show');
                        }
                    }    __getStyle() {
        let arrStyle = super.__getStyle();
        arrStyle.push(`:host{display:none}:host([show]){display:block}`);
        return arrStyle;
    }
    __getHtml() {
        let parentInfo = super.__getHtml();
        let info = {
            html: `<slot></slot>`,
            slots: {
                'default':`<slot></slot>`
            },
            blocks: {
                'default':`<slot></slot>`
            }
        }
        return info;
    }
    __getMaxId() {
        let temp = super.__getMaxId();
        temp.push(["AvPage", 0])
        return temp;
    }
    getClassName() {
        return "AvPage";
    }
    __defaultValue() { super.__defaultValue(); if(!this.hasAttribute('show')) { this.attributeChangedCallback('show', false, false); } }
    __listBoolProps() { return ["show"].concat(super.__listBoolProps()).filter((v, i, a) => a.indexOf(v) === i); }
}
window.customElements.define('av-page', AvPage);
class AvHideable extends WebComponent {
    get 'isVisible'() {
						return this.__watch["isVisible"];
					}
					set 'isVisible'(val) {
						this.__watch["isVisible"] = val;
					}    __prepareVariables() { super.__prepareVariables(); if(this.oldParent === undefined) {this.oldParent = "undefined";}if(this.options === undefined) {this.options = undefined;}if(this.checkCloseBinded === undefined) {this.checkCloseBinded = undefined;}if(this.pressManager === undefined) {this.pressManager = undefined;}if(this.onVisibilityChangeCallbacks === undefined) {this.onVisibilityChangeCallbacks = [];} }
    __prepareWatchesActions() {
					this.__watchActions["isVisible"] = [((target) => {    target.onVisibilityChangeCallbacks.forEach(callback => callback(target.isVisible));})];
						this.__watchActionsCb["isVisible"] = (action, path, value) => {
							for (let fct of this.__watchActions["isVisible"]) {
								fct(this, action, path, value);
							}
							if(this.__onChangeFct["isVisible"]){
								for(let fct of this.__onChangeFct["isVisible"]){
									fct("isVisible")
									/*if(path == ""){
										fct("isVisible")
									}
									else{
										fct("isVisible."+path);
									}*/
								}
							}
						}					super.__prepareWatchesActions();
				}__initWatches() {
					super.__initWatches();
					this["isVisible"] = false;
				}
    __getStyle() {
        let arrStyle = super.__getStyle();
        arrStyle.push(`:host{position:absolute;top:0;left:0;width:0;height:0;z-index:1000;overflow:visible;display:none}::slotted(.context-menu .context-menu-item){background-color:red}:host{--inserted: "here"}`);
        return arrStyle;
    }
    __getHtml() {
        let parentInfo = super.__getHtml();
        let info = {
            html: `<slot></slot>
<div _id="avhideable_0"></div>`,
            slots: {
                'default':`<slot></slot>`
            },
            blocks: {
                'default':`<slot></slot>
<div _id="avhideable_0"></div>`
            }
        }
        return info;
    }
    __getMaxId() {
        let temp = super.__getMaxId();
        temp.push(["AvHideable", 1])
        return temp;
    }
    __mapSelectedElement() { super.__mapSelectedElement(); this.content = this.shadowRoot.querySelector('[_id="avhideable_0"]');}
    __endConstructor() { super.__endConstructor(); (() => {    this.options = {        noHideItems: [this],        container: document.body,        beforeHide: this.defaultBeforeHide,        afterHide: this.defaultAfterHide,        canHide: this.defaultCanHide    };    this.checkCloseBinded = this.checkClose.bind(this);})() }
    getClassName() {
        return "AvHideable";
    }
    async  defaultBeforeHide(){}async  defaultAfterHide(){}async  defaultCanHide(){return true;} configure(options){if (options.noHideItems) {    this.options.noHideItems = options.noHideItems;}if (options.beforeHide) {    this.options.beforeHide = options.beforeHide;}if (options.afterHide) {    this.options.afterHide = options.afterHide;}if (options.canHide) {    this.options.canHide = options.canHide;}if (options.container) {    this.options.container = options.container;}} show(){if (this.isVisible) {    return;}this.isVisible = true;this.oldParent = this.parentNode;if (this.shadowRoot.querySelector("style").innerText.indexOf(":host{--inserted: \"here\"}") != -1) {    let newStyle = "";    const parentShadowRoot = this.oldParent.findParentByType(ShadowRoot);    if (parentShadowRoot instanceof ShadowRoot) {        let matchingArr = parentShadowRoot.querySelector("style").innerText.match(/av-hideable.*?\{.*?\}/g);        if (matchingArr) {            newStyle = matchingArr.join("").replace(/av-hideable/g, ":host");        }    }    this.shadowRoot.querySelector("style").innerText = this.shadowRoot.querySelector("style").innerText.replace(":host{--inserted: \"here\"}", newStyle);}this.loadCSSVariables();this.style.display = 'block';this.options.container.appendChild(this);this.options.container.addEventListener("pressaction_trigger", this.checkCloseBinded);this.pressManager = new PressManager({    element: this.options.container,    onPress: (e) => {        this.checkCloseBinded(e);    }});} getVisibility(){return this.isVisible;} onVisibilityChange(callback){this.onVisibilityChangeCallbacks.push(callback);} offVisibilityChange(callback){this.onVisibilityChangeCallbacks = this.onVisibilityChangeCallbacks.filter(cb => cb !== callback);} loadCSSVariables(){let styleSheets = this.shadowRoot.styleSheets;let realStyle = getComputedStyle(this);let propsToAdd = {};for (let i = 0; i < styleSheets.length; i++) {    let rules = styleSheets[i].cssRules;    for (let j = 0; j < rules.length; j++) {        for (let indexTxt in rules[j]["style"]) {            let index = Number(indexTxt);            if (isNaN(index)) {                break;            }            let prop = rules[j]["style"][index];            let value = rules[j]["style"][prop];            if (value.startsWith("var(")) {                let varToDef = value.match(/var\(.*?(\,|\))/g)[0].replace("var(", "").slice(0, -1);                let realValue = realStyle.getPropertyValue(varToDef);                propsToAdd[varToDef] = realValue.trim();            }        }    }}for (let key in propsToAdd) {    this.style.setProperty(key, propsToAdd[key]);}}async  hide(options){if (this.isVisible) {    if ((options === null || options === void 0 ? void 0 : options.force) || await this.options.canHide(options === null || options === void 0 ? void 0 : options.target)) {        await this.options.beforeHide();        this.isVisible = false;        this.style.display = 'none';        this.oldParent.appendChild(this);        this.options.container.removeEventListener("pressaction_trigger", this.checkCloseBinded);        this.pressManager.destroy();        await this.options.afterHide();    }}} checkClose(e){let realTargetEl;if (e instanceof PointerEvent) {    realTargetEl = e.realTarget();}else {    realTargetEl = e.detail.realEvent.realTarget();}for (var i = 0; i < this.options.noHideItems.length; i++) {    if (this.options.noHideItems[i].containsChild(realTargetEl)) {        return;    }}this.hide({    target: realTargetEl});} postCreation(){var listChild = this.getElementsInSlot();for (let i = 0; i < listChild.length; i++) {    this.content.appendChild(listChild[i]);}}}
window.customElements.define('av-hideable', AvHideable);
class AvFormElement extends WebComponent {
    constructor() { super(); if (this.constructor == AvFormElement) { throw "can't instanciate an abstract class"; } }
    get 'required'() {
                        return this.hasAttribute('required');
                    }
                    set 'required'(val) {
                        if(val === 1 || val === 'true' || val === ''){
                            val = true;
                        }
                        else if(val === 0 || val === 'false' || val === null || val === undefined){
                            val = false;
                        }
                        if(val !== false && val !== true){
                            console.error("error setting boolean in required");
                            val = false;
                        }
                        if (val) {
                            this.setAttribute('required', 'true');
                        } else{
                            this.removeAttribute('required');
                        }
                    }get 'name'() {
                        return this.getAttribute('name');
                    }
                    set 'name'(val) {
                        this.setAttribute('name',val);
                    }get 'focusable'() {
                        return this.hasAttribute('focusable');
                    }
                    set 'focusable'(val) {
                        if(val === 1 || val === 'true' || val === ''){
                            val = true;
                        }
                        else if(val === 0 || val === 'false' || val === null || val === undefined){
                            val = false;
                        }
                        if(val !== false && val !== true){
                            console.error("error setting boolean in focusable");
                            val = false;
                        }
                        if (val) {
                            this.setAttribute('focusable', 'true');
                        } else{
                            this.removeAttribute('focusable');
                        }
                    }get 'value'() {
						return this.__watch["value"];
					}
					set 'value'(val) {
						this.__watch["value"] = val;
					}get 'errors'() {
						return this.__watch["errors"];
					}
					set 'errors'(val) {
						this.__watch["errors"] = val;
					}    __prepareWatchesActions() {
					this.__watchActions["value"] = [];
						this.__watchActionsCb["value"] = (action, path, value) => {
							for (let fct of this.__watchActions["value"]) {
								fct(this, action, path, value);
							}
							if(this.__onChangeFct["value"]){
								for(let fct of this.__onChangeFct["value"]){
									fct("value")
									/*if(path == ""){
										fct("value")
									}
									else{
										fct("value."+path);
									}*/
								}
							}
						}this.__watchActions["errors"] = [((target) => {    console.log("Display errors");    target.displayErrors();})];
						this.__watchActionsCb["errors"] = (action, path, value) => {
							for (let fct of this.__watchActions["errors"]) {
								fct(this, action, path, value);
							}
							if(this.__onChangeFct["errors"]){
								for(let fct of this.__onChangeFct["errors"]){
									fct("errors")
									/*if(path == ""){
										fct("errors")
									}
									else{
										fct("errors."+path);
									}*/
								}
							}
						}					super.__prepareWatchesActions();
				}__initWatches() {
					super.__initWatches();
					this["value"] = this.getDefaultValue();this["errors"] = [];
				}
    __getStyle() {
        let arrStyle = super.__getStyle();
        arrStyle.push(``);
        return arrStyle;
    }
    __getHtml() {
        let parentInfo = super.__getHtml();
        let info = {
            html: `<slot></slot>`,
            slots: {
                'default':`<slot></slot>`
            },
            blocks: {
                'default':`<slot></slot>`
            }
        }
        return info;
    }
    __getMaxId() {
        let temp = super.__getMaxId();
        temp.push(["AvFormElement", 0])
        return temp;
    }
    getClassName() {
        return "AvFormElement";
    }
    __defaultValue() { super.__defaultValue(); if(!this.hasAttribute('required')) { this.attributeChangedCallback('required', false, false); }if(!this.hasAttribute('name')){ this['name'] = ''; }if(!this.hasAttribute('focusable')) { this.attributeChangedCallback('focusable', false, false); } }
    __listBoolProps() { return ["required","focusable"].concat(super.__listBoolProps()).filter((v, i, a) => a.indexOf(v) === i); }
     postCreation(){this.findParentByType(AvForm).subscribe(this);} onValueChanged(){this.dispatchEvent(new CustomEvent("change", {    detail: {        value: this.value    }}));} setFocus(){} validate(){return true;} setError(message){this.errors.push(message);} clearErrors(){this.errors = [];} displayErrors(){}}
window.customElements.define('av-form-element', AvFormElement);
class AvForm extends WebComponent {
    get 'loading'() {
                        return this.hasAttribute('loading');
                    }
                    set 'loading'(val) {
                        if(val === 1 || val === 'true' || val === ''){
                            val = true;
                        }
                        else if(val === 0 || val === 'false' || val === null || val === undefined){
                            val = false;
                        }
                        if(val !== false && val !== true){
                            console.error("error setting boolean in loading");
                            val = false;
                        }
                        if (val) {
                            this.setAttribute('loading', 'true');
                        } else{
                            this.removeAttribute('loading');
                        }
                    }get 'method'() {
                        return this.getAttribute('method');
                    }
                    set 'method'(val) {
                        this.setAttribute('method',val);
                    }get 'action'() {
                        return this.getAttribute('action');
                    }
                    set 'action'(val) {
                        this.setAttribute('action',val);
                    }get 'use_event'() {
                        return this.hasAttribute('use_event');
                    }
                    set 'use_event'(val) {
                        if(val === 1 || val === 'true' || val === ''){
                            val = true;
                        }
                        else if(val === 0 || val === 'false' || val === null || val === undefined){
                            val = false;
                        }
                        if(val !== false && val !== true){
                            console.error("error setting boolean in use_event");
                            val = false;
                        }
                        if (val) {
                            this.setAttribute('use_event', 'true');
                        } else{
                            this.removeAttribute('use_event');
                        }
                    }    __prepareVariables() { super.__prepareVariables(); if(this.fields === undefined) {this.fields = [];}if(this.submits === undefined) {this.submits = [];} }
    __getStyle() {
        let arrStyle = super.__getStyle();
        arrStyle.push(``);
        return arrStyle;
    }
    __getHtml() {
        let parentInfo = super.__getHtml();
        let info = {
            html: `<slot></slot>`,
            slots: {
                'default':`<slot></slot>`
            },
            blocks: {
                'default':`<slot></slot>`
            }
        }
        return info;
    }
    __getMaxId() {
        let temp = super.__getMaxId();
        temp.push(["AvForm", 0])
        return temp;
    }
    getClassName() {
        return "AvForm";
    }
    __defaultValue() { super.__defaultValue(); if(!this.hasAttribute('loading')) { this.attributeChangedCallback('loading', false, false); }if(!this.hasAttribute('method')){ this['method'] = 'get'; }if(!this.hasAttribute('action')){ this['action'] = ''; }if(!this.hasAttribute('use_event')) { this.attributeChangedCallback('use_event', false, false); } }
    __listBoolProps() { return ["loading","use_event"].concat(super.__listBoolProps()).filter((v, i, a) => a.indexOf(v) === i); }
    async  submit(){if (!this.validate()) {    return;}const data = {};this.fields.forEach(field => {    if (field.required) {        data[field.name] = field.value;    }    else {        if (field.value) {            data[field.name] = field.value;        }    }});if (this.use_event) {    const customEvent = new CustomEvent("submit", {        detail: {            data,            action: this.action,            method: this.method        },        bubbles: true,        composed: true    });    this.dispatchEvent(customEvent);}else {    this.loading = true;    const formData = new FormData();    for (const key in data) {        formData.append(key, data[key]);    }    const request = new HttpRequest({        url: this.action,        method: HttpRequest.getMethod(this.method),        data: formData    });    this.loading = false;}} registerSubmit(submitElement){this.submits.push({    element: submitElement,    pressInstance: new PressManager({        element: submitElement,        onPress: () => {            this.submit();        }    })});} unregisterSubmit(submitElement){const index = this.submits.findIndex(submit => submit.element === submitElement);if (index !== -1) {    this.submits[index].pressInstance.destroy();    this.submits.splice(index, 1);}} subscribe(fieldHTML){const fieldIndex = this.fields.push(fieldHTML);const _goNext = (e, index = fieldIndex) => {    if (e.keyCode === 13) {        if (this.fields[index]) {            if (this.fields[index].focusable) {                this.fields[index].setFocus();            }            else {                _goNext(e, index + 1);            }        }        else {            this.submit();        }    }};fieldHTML.addEventListener("keydown", _goNext);} validate(){let valid = true;this.fields.forEach(field => {    if (!field.validate()) {        if (valid === true) {            field.setFocus();        }        valid = false;    }});return valid;} setFocus(){if (this.fields.length > 0) {    this.fields[0].setFocus();}}}
window.customElements.define('av-form', AvForm);
class AvFor extends WebComponent {
    get 'item'() {
                        return this.getAttribute('item');
                    }
                    set 'item'(val) {
                        this.setAttribute('item',val);
                    }get 'in'() {
                        return this.getAttribute('in');
                    }
                    set 'in'(val) {
                        this.setAttribute('in',val);
                    }get 'index'() {
                        return this.getAttribute('index');
                    }
                    set 'index'(val) {
                        this.setAttribute('index',val);
                    }    __prepareVariables() { super.__prepareVariables(); if(this.template === undefined) {this.template = "";}if(this.parent === undefined) {this.parent = undefined;}if(this.parentIndex === undefined) {this.parentIndex = 0;}if(this.parentFor === undefined) {this.parentFor = undefined;}if(this.otherPart === undefined) {this.otherPart = undefined;}if(this.elementsByPath === undefined) {this.elementsByPath = {};}if(this.elementsRootByIndex === undefined) {this.elementsRootByIndex = {};}if(this.forInside === undefined) {this.forInside = {};}if(this.maxIndex === undefined) {this.maxIndex = 0;}if(this.watchElement === undefined) {this.watchElement = undefined;}if(this.watchActionArray === undefined) {this.watchActionArray = undefined;}if(this.watchObjectArray === undefined) {this.watchObjectArray = undefined;}if(this.watchObjectName === undefined) {this.watchObjectName = undefined;} }
    __getStyle() {
        let arrStyle = super.__getStyle();
        arrStyle.push(``);
        return arrStyle;
    }
    __getHtml() {
        let parentInfo = super.__getHtml();
        let info = {
            html: `<slot></slot>`,
            slots: {
                'default':`<slot></slot>`
            },
            blocks: {
                'default':`<slot></slot>`
            }
        }
        return info;
    }
    __getMaxId() {
        let temp = super.__getMaxId();
        temp.push(["AvFor", 0])
        return temp;
    }
    __endConstructor() { super.__endConstructor(); (() => {    this.init();})() }
    getClassName() {
        return "AvFor";
    }
    __defaultValue() { super.__defaultValue(); if(!this.hasAttribute('item')){ this['item'] = ''; }if(!this.hasAttribute('in')){ this['in'] = ''; }if(!this.hasAttribute('index')){ this['index'] = ''; } }
     init(){if (!this.parent) {    let shadow = this.getRootNode();    if (shadow.host) {        this.parent = shadow.host;        let parentsFor = this.findParents("av-for", this.parent);        let inParts = this.in.split(".");        let firstPart = inParts.splice(0, 1)[0];        if (this.parent["__watchActions"].hasOwnProperty(firstPart)) {            this.watchActionArray = this.parent["__watchActions"][firstPart];            this.watchObjectArray = this.parent["__watch"];            this.watchObjectName = firstPart;        }        else {            for (let parentFor of parentsFor) {                if (parentFor.item == firstPart) {                    this.parentFor = parentFor;                    this.watchActionArray = this.parentFor.watchActionArray;                    this.watchObjectArray = this.parentFor.watchObjectArray;                    this.watchObjectName = this.parentFor.watchObjectName;                    this.otherPart = inParts;                    break;                }            }        }        if (this.watchActionArray) {            let fctCb = (target, type, path, element) => {                path = path.replace(this.watchObjectName, "");                if (type == WatchAction.SET || path == this.getParentKey()) {                    this.reset();                    this.watchElement = element;                    let currentCreate = Object.prepareByPath(this.watchElement, this.getParentKey());                    if (currentCreate.canApply) {                        if (Array.isArray(currentCreate.objToApply)) {                            for (let i = 0; i < currentCreate.objToApply.length; i++) {                                this.createForElement(currentCreate.objToApply[i], "[" + i + "]");                            }                        }                        else {                            for (let key in currentCreate.objToApply) {                                this.createForElement(currentCreate.objToApply[key], key);                            }                        }                    }                    else if (!Array.isArray(element) && element !== undefined) {                        console.error("something went wrong, but I don't understand how this is possible");                    }                }                else {                    let otherPartRegexp = this.getParentKey().replace(/\[/g, "\\[").replace(/\]/g, "\\]");                    let regexNumberLoop = new RegExp("^" + otherPartRegexp + "\\[(\\d*?)\\]$", "g");                    let testPath = new RegExp("^" + otherPartRegexp + "(\\[\\d*?\\].*)$", "g").exec(path);                    if (testPath) {                        let pathToUse = testPath[1];                        let matchTemp = path.match(regexNumberLoop);                        if (matchTemp) {                            if (type == WatchAction.CREATED) {                                this.createForElement(element, pathToUse);                            }                            else if (type == WatchAction.UPDATED) {                                this.updateForElement(element, pathToUse);                            }                            else if (type == WatchAction.DELETED) {                                this.deleteForElement(element, pathToUse);                            }                        }                        else {                            if (type == WatchAction.CREATED) {                                this.updateForElement(element, pathToUse);                            }                            else if (type == WatchAction.UPDATED) {                                this.updateForElement(element, pathToUse);                            }                            else if (type == WatchAction.DELETED) {                                this.updateForElement(undefined, pathToUse);                            }                        }                    }                }            };            this.watchActionArray.push(fctCb);            if (this.watchObjectArray[this.watchObjectName]) {                fctCb(this.parentElement, WatchAction.SET, '', this.watchObjectArray[this.watchObjectName]);            }        }        else {            console.error("variable " + this.in + " in parent can't be found");        }    }}} createForElement(data,key){let temp = document.createElement("DIV");temp.innerHTML = this.parent["__loopTemplate"][this.getAttribute("_id")];let index = Number(key.replace("[", "").replace("]", ""));if (index > this.maxIndex) {    this.maxIndex = index;}let maxSaved = this.maxIndex;for (let i = maxSaved; i >= index; i--) {    if (this.elementsRootByIndex.hasOwnProperty(i)) {        if (i + 1 > this.maxIndex) {            this.maxIndex = i + 1;        }        this.elementsRootByIndex[i + 1] = this.elementsRootByIndex[i];        this.elementsByPath[i + 1] = this.elementsByPath[i];        this.forInside[i + 1] = this.forInside[i];        for (let elements of Object.values(this.elementsByPath[i + 1])) {            for (let element of elements) {                if (element["__values"].hasOwnProperty("$index$_" + this.index)) {                    element["__values"]["$index$_" + this.index] = i + 1;                    element["__templates"]["$index$_" + this.index].forEach((cb) => {                        cb(element);                    });                }            }        }        for (let forEl of this.forInside[i + 1]) {            forEl.parentIndex = i + 1;            forEl.updateIndexes(this.index, i + 1);        }    }}let result = this.parent['__prepareForCreate'][this.getAttribute("_id")](temp, data, key, this.getAllIndexes(index));let forEls = Array.from(temp.querySelectorAll("av-for"));this.forInside[index] = [];for (let forEl of forEls) {    forEl.parentIndex = index;    this.forInside[index].push(forEl);}this.elementsByPath[index] = result;this.elementsRootByIndex[index] = [];let appendChild = (el) => { this.appendChild(el); };if (index != this.maxIndex) {    let previous = this.elementsRootByIndex[index + 1][0];    appendChild = (el) => { this.insertBefore(el, previous); };}while (temp.children.length > 0) {    let el = temp.children[0];    this.elementsRootByIndex[index].push(el);    appendChild(el);}} updateForElement(data,key){let idendity = key.match(/\[\d*?\]/g)[0];let index = Number(idendity.replace("[", "").replace("]", ""));if (index > this.maxIndex) {    this.maxIndex = index;}key = key.replace(idendity, "");if (key.startsWith(".")) {    key = key.slice(1);}if (this.elementsByPath[index]) {    for (let pathName in this.elementsByPath[index]) {        for (let element of this.elementsByPath[index][pathName]) {            for (let valueName in element["__values"]) {                if (valueName == "") {                    element["__templates"][valueName].forEach((cb) => {                        cb(element, true);                    });                }                else if (valueName == key) {                    element["__values"][valueName] = data;                    element["__templates"][valueName].forEach((cb) => {                        cb(element);                    });                }                else if (valueName.startsWith(key)) {                    let temp = Object.prepareByPath(data, valueName, key);                    if (temp.canApply) {                        element["__values"][valueName] = temp.objToApply;                        element["__templates"][valueName].forEach((cb) => {                            cb(element);                        });                    }                }            }        }    }}else {    this.createForElement(this.watchElement[index], idendity);}} deleteForElement(data,key){let index = Number(key.replace("[", "").replace("]", ""));if (index > this.maxIndex) {    this.maxIndex = index;}if (this.elementsRootByIndex[index]) {    for (let el of this.elementsRootByIndex[index]) {        el.remove();    }    delete this.elementsRootByIndex[index];    delete this.elementsByPath[index];    for (let i = index; i <= this.maxIndex; i++) {        if (i == this.maxIndex) {            this.maxIndex--;        }        if (this.elementsRootByIndex.hasOwnProperty(i)) {            this.elementsRootByIndex[i - 1] = this.elementsRootByIndex[i];            this.elementsByPath[i - 1] = this.elementsByPath[i];            this.forInside[i - 1] = this.forInside[i];            for (let elements of Object.values(this.elementsByPath[i - 1])) {                for (let element of elements) {                    if (element["__values"].hasOwnProperty("$index$_" + this.index)) {                        element["__values"]["$index$_" + this.index] = i - 1;                        element["__templates"]["$index$_" + this.index].forEach((cb) => {                            cb(element);                        });                    }                }            }            for (let forEl of this.forInside[i - 1]) {                forEl.parentIndex = i - 1;                forEl.updateIndexes(this.index, i - 1);            }        }    }}} reset(){this.elementsByPath = {};this.elementsRootByIndex = {};this.forInside = {};this.maxIndex = 0;this.innerHTML = "";} postCreation(){this.init();} getParentKey(){let el = this;let result = "";while (el.parentFor) {    result = result + "[" + el.parentIndex + "]." + this.otherPart.join(".");    el = el.parentFor;}return result;} updateIndexes(indexName,indexValue){for (let position in this.elementsByPath) {    for (let elements of Object.values(this.elementsByPath[position])) {        for (let element of elements) {            if (element["__values"].hasOwnProperty("$index$_" + indexName)) {                element["__values"]["$index$_" + indexName] = indexValue;                element["__templates"]["$index$_" + indexName].forEach((cb) => {                    cb(element);                });            }        }    }}for (let index in this.forInside) {    this.forInside[index].forEach((forEl) => {        forEl.updateIndexes(indexName, indexValue);    });}} getAllIndexes(currentIndex){let result = {};let el = this;while (el.parentFor) {    result[el.parentFor.index] = el.parentIndex;    el = el.parentFor;}result[this.index] = currentIndex;return result;}}
window.customElements.define('av-for', AvFor);
class DisplayElement extends WebComponent {
    constructor() { super(); if (this.constructor == DisplayElement) { throw "can't instanciate an abstract class"; } }
    __prepareVariables() { super.__prepareVariables(); if(this.currentInstance === undefined) {this.currentInstance = undefined;}if(this.eventsFunctions === undefined) {this.eventsFunctions = {};} }
    __getStyle() {
        let arrStyle = super.__getStyle();
        arrStyle.push(``);
        return arrStyle;
    }
    __getHtml() {
        let parentInfo = super.__getHtml();
        let info = {
            html: `<slot></slot>
<div></div>`,
            slots: {
                'default':`<slot></slot>`
            },
            blocks: {
                'default':`<slot></slot>
<div></div>`
            }
        }
        return info;
    }
    __getMaxId() {
        let temp = super.__getMaxId();
        temp.push(["DisplayElement", 0])
        return temp;
    }
    getClassName() {
        return "DisplayElement";
    }
     onDeleteFunction(data){} onUpdateFunction(data){} destroy(){if (this.currentInstance) {    this.unsubscribeFromInstance();}} subscribeToInstance(){this.currentInstance.offUpdate(this.eventsFunctions.onUpdate);this.currentInstance.offDelete(this.eventsFunctions["onDelete"]);} unsubscribeFromInstance(){this.currentInstance.offUpdate(this.eventsFunctions["onUpdate"]);this.currentInstance.offDelete(this.eventsFunctions["onDelete"]);} switchInstance(newInstance){if (this.currentInstance) {    this.unsubscribeFromInstance();}this.currentInstance = newInstance;this.subscribeToInstance();this.displayInfos(newInstance);}}
window.customElements.define('display-element', DisplayElement);
class AvRessourceManager {    static memory = {};    static waiting = {};    static async get(url) {        if (AvRessourceManager.memory.hasOwnProperty(url)) {            return AvRessourceManager.memory[url];        }        else if (AvRessourceManager.waiting.hasOwnProperty(url)) {            await this.awaitFct(url);            return AvRessourceManager.memory[url];        }        else {            AvRessourceManager.waiting[url] = [];            if (url.endsWith('.svg')) {                let result = await fetch(url);                let text = await result.text();                AvRessourceManager.memory[url] = text;                this.releaseAwaitFct(url);                return AvRessourceManager.memory[url];            }            else {                let result = await fetch(url, {                    headers: {                        responseType: 'blob'                    }                });                let blob = await result.blob();                AvRessourceManager.memory[url] = await this.readFile(blob);                ;                this.releaseAwaitFct(url);                return AvRessourceManager.memory[url];            }        }    }    static releaseAwaitFct(url) {        if (AvRessourceManager.waiting[url]) {            for (let i = 0; i < AvRessourceManager.waiting[url].length; i++) {                AvRessourceManager.waiting[url][i]();            }            delete AvRessourceManager.waiting[url];        }    }    static awaitFct(url) {        return new Promise((resolve) => {            AvRessourceManager.waiting[url].push(() => {                resolve('');            });        });    }    static readFile(blob) {        return new Promise((resolve) => {            var reader = new FileReader();            reader.onloadend = function () {                resolve(reader.result);            };            reader.readAsDataURL(blob);        });    }}




class AvApp extends AvRouter {
    __getStyle() {
        let arrStyle = super.__getStyle();
        arrStyle.push(`:host{height:100%;width:100%;display:flex;flex-direction:column}:host .content{padding:15px 0;flex-grow:1}`);
        return arrStyle;
    }
    __getHtml() {
        let parentInfo = super.__getHtml();
        let info = {
            html: `<block name="before">
	    <av-navbar slot="before"></av-navbar>
	</block>
`,
            slots: {
            },
            blocks: {
                'before':`
	    <av-navbar slot="before"></av-navbar>
	`
            }
        }
                let newHtml = parentInfo.html
                for (let blockName in info.blocks) {
                    if (!parentInfo.slots.hasOwnProperty(blockName)) {
                        throw "can't found slot with name " + blockName;
                    }
                    newHtml = newHtml.replace(parentInfo.slots[blockName], info.blocks[blockName]);
                }
                info.html = newHtml;
        return info;
    }
    __getMaxId() {
        let temp = super.__getMaxId();
        temp.push(["AvApp", 0])
        return temp;
    }
    getClassName() {
        return "AvApp";
    }
     defineRoutes(){return {    "/": AvHome,    "/example": AvExample,    "/introduction": AvGettingStarted,    "/introduction/init": AvGettingStartedInitProject,    "/introduction/routing": AvGettingStartedRouting,    "/installation": AvInstallation,    "/api": AvApi,    "/api/configuration": AvApiConfiguration,};}}
window.customElements.define('av-app', AvApp);
class AvHome extends AvPage {
    __getStyle() {
        let arrStyle = super.__getStyle();
        arrStyle.push(`:host .logo{margin:50px auto;display:flex;align-items:center;justify-content:center;max-width:1000px}:host .logo av-img{width:50%}:host .logo .right-part{width:50%}:host .logo .right-part p{color:var(--darker);font-size:35px}:host .content{background-color:var(--lighter);box-shadow:0 -5px 5px var(--lighter);padding:50px 0}:host .content .advantages{max-width:1500px;margin:auto}:host .content .advantages av-col{padding:0 50px}:host .content .advantages av-col .title{font-weight:bold;margin-bottom:10px}:host .content .advantages av-col .description{text-align:justify}`);
        return arrStyle;
    }
    __getHtml() {
        let parentInfo = super.__getHtml();
        let info = {
            html: `<div class="logo">
    <av-img src="/img/aventus.gif"></av-img>
    <div class="right-part">
        <p>Keep a link <br>with your data</p>
        <av-router-link state="/introduction">
            <av-button>Getting started</av-button>
        </av-router-link>
    </div>
</div>
<div class="content">
    <div class="advantages">
        <av-row>
            <av-col size_xs="12" size_md="4">
                <div class="title">Easy to use</div>
                <div class="description">
                    <p>You can easly create component to keep your code clean and reuse complex logical part.</p>
                    <p>With the use of typescript, you will avoid a lot of mistakes and keep your code clean.</p>
                </div>
            </av-col>
            <av-col size_xs="12" size_md="4">
                <div class="title">Manage your data</div>
                <div class="description">
                    <p>You can easly write data and store to provide consistency inside your app.</p>
                    <p>When a change occurs, everythink is updated by magic.</p>
                </div>
            </av-col>
            <av-col size_xs="12" size_md="4">
                <div class="title">Strong backend interaction</div>
                <div class="description">
                    <p>With aventus, you can find a lot of plugin to manage your backend like c#, firebase, etc</p>
                    <p>A lot of code can be automatically generated. It's give you free time to focus on your design</p>
                </div>
            </av-col>
        </av-row>
    </div>
</div>`,
            slots: {
            },
            blocks: {
                'default':`<div class="logo">
    <av-img src="/img/aventus.gif"></av-img>
    <div class="right-part">
        <p>Keep a link <br>with your data</p>
        <av-router-link state="/introduction">
            <av-button>Getting started</av-button>
        </av-router-link>
    </div>
</div>
<div class="content">
    <div class="advantages">
        <av-row>
            <av-col size_xs="12" size_md="4">
                <div class="title">Easy to use</div>
                <div class="description">
                    <p>You can easly create component to keep your code clean and reuse complex logical part.</p>
                    <p>With the use of typescript, you will avoid a lot of mistakes and keep your code clean.</p>
                </div>
            </av-col>
            <av-col size_xs="12" size_md="4">
                <div class="title">Manage your data</div>
                <div class="description">
                    <p>You can easly write data and store to provide consistency inside your app.</p>
                    <p>When a change occurs, everythink is updated by magic.</p>
                </div>
            </av-col>
            <av-col size_xs="12" size_md="4">
                <div class="title">Strong backend interaction</div>
                <div class="description">
                    <p>With aventus, you can find a lot of plugin to manage your backend like c#, firebase, etc</p>
                    <p>A lot of code can be automatically generated. It's give you free time to focus on your design</p>
                </div>
            </av-col>
        </av-row>
    </div>
</div>`
            }
        }
                let newHtml = parentInfo.html
                for (let blockName in info.blocks) {
                    if (!parentInfo.slots.hasOwnProperty(blockName)) {
                        throw "can't found slot with name " + blockName;
                    }
                    newHtml = newHtml.replace(parentInfo.slots[blockName], info.blocks[blockName]);
                }
                info.html = newHtml;
        return info;
    }
    __getMaxId() {
        let temp = super.__getMaxId();
        temp.push(["AvHome", 0])
        return temp;
    }
    getClassName() {
        return "AvHome";
    }
     defineTitle(){return "Aventus";}}
window.customElements.define('av-home', AvHome);
class AvGenericPage extends AvPage {
    constructor() { super(); if (this.constructor == AvGenericPage) { throw "can't instanciate an abstract class"; } }
    __getStyle() {
        let arrStyle = super.__getStyle();
        arrStyle.push(`:host{height:100%}:host .content{height:100%;max-width:1000px;margin:0 auto}:host .content av-scrollable h1{margin-top:50px;text-align:center;display:inline-block;width:100%;color:var(--secondary-color);font-size:35px}:host .content av-scrollable h2{margin-left:0px;color:var(--secondary-color);font-size:25px}:host .content av-scrollable .table .header{font-weight:bold;border-bottom:1px solid var(--darker);padding:5px;font-size:20px}:host .content av-scrollable .table av-row{padding:10px;align-items:center}:host .content av-scrollable .table .title{font-size:18px;font-weight:600;margin-bottom:5px}:host .content av-scrollable .table.table-row av-row{border-bottom:1px solid #ddd}:host .content av-scrollable av-router-link{color:blue;text-decoration:underline;cursor:pointer}:host .content av-scrollable>*:last-child{margin-bottom:30px}:host .content av-scrollable section p{text-align:justify}:host .content av-scrollable .navigation av-img{height:40px}:host .content av-scrollable .navigation .previous{display:flex;align-items:center;justify-content:center}:host .content av-scrollable .navigation .previous av-router-link{display:flex;align-items:center;justify-content:center;cursor:pointer;color:#000;text-decoration:none}:host .content av-scrollable .navigation .previous av-router-link span{margin-left:15px}:host .content av-scrollable .navigation .next{display:flex;align-items:center;justify-content:center}:host .content av-scrollable .navigation .next av-router-link{display:flex;align-items:center;justify-content:center;cursor:pointer;color:#000;text-decoration:none}:host .content av-scrollable .navigation .next av-router-link span{margin-right:15px}`);
        return arrStyle;
    }
    __getHtml() {
        let parentInfo = super.__getHtml();
        let info = {
            html: `<div class="content">
    <av-scrollable _id="avgenericpage_0">
        <slot></slot>
    </av-scrollable>
</div>`,
            slots: {
                'default':`<slot></slot>`
            },
            blocks: {
                'default':`<div class="content">
    <av-scrollable _id="avgenericpage_0">
        <slot></slot>
    </av-scrollable>
</div>`
            }
        }
                let newHtml = parentInfo.html
                for (let blockName in info.blocks) {
                    if (!parentInfo.slots.hasOwnProperty(blockName)) {
                        throw "can't found slot with name " + blockName;
                    }
                    newHtml = newHtml.replace(parentInfo.slots[blockName], info.blocks[blockName]);
                }
                info.html = newHtml;
        return info;
    }
    __getMaxId() {
        let temp = super.__getMaxId();
        temp.push(["AvGenericPage", 1])
        return temp;
    }
    __mapSelectedElement() { super.__mapSelectedElement(); this.scrollElement = this.shadowRoot.querySelector('[_id="avgenericpage_0"]');}
    getClassName() {
        return "AvGenericPage";
    }
}
window.customElements.define('av-generic-page', AvGenericPage);
class AvInstallation extends AvGenericPage {
    __getStyle() {
        let arrStyle = super.__getStyle();
        arrStyle.push(``);
        return arrStyle;
    }
    __getHtml() {
        let parentInfo = super.__getHtml();
        let info = {
            html: `<h1>Aventus installation</h1>
<p>
    <span>Aventus is a vscode extension. You can download the installation file <i>(aventus-#version.vsix)</i></span>
    <a href="https://github.com/max529/Aventus/releases" target="_blank">here</a>
</p>
<p>
    <span>Then you can : </span>
    </p><ul>
        <li>Open your Visual Studio Code</li>
        <li>Go on the extensions tab</li>
        <li>Click on the three dots</li>
        <li>Choose "Install from VSIX..."</li>
        <li>Select the file you downloaded</li>
    </ul>
    <span>Well done! You are ready to use Aventus</span>
    <p>
        <span>Try the tutorial </span>
        <av-router-link state="/introduction">here</av-router-link>
    </p>
<p></p>`,
            slots: {
            },
            blocks: {
                'default':`<h1>Aventus installation</h1>
<p>
    <span>Aventus is a vscode extension. You can download the installation file <i>(aventus-#version.vsix)</i></span>
    <a href="https://github.com/max529/Aventus/releases" target="_blank">here</a>
</p>
<p>
    <span>Then you can : </span>
    </p><ul>
        <li>Open your Visual Studio Code</li>
        <li>Go on the extensions tab</li>
        <li>Click on the three dots</li>
        <li>Choose "Install from VSIX..."</li>
        <li>Select the file you downloaded</li>
    </ul>
    <span>Well done! You are ready to use Aventus</span>
    <p>
        <span>Try the tutorial </span>
        <av-router-link state="/introduction">here</av-router-link>
    </p>
<p></p>`
            }
        }
                let newHtml = parentInfo.html
                for (let blockName in info.blocks) {
                    if (!parentInfo.slots.hasOwnProperty(blockName)) {
                        throw "can't found slot with name " + blockName;
                    }
                    newHtml = newHtml.replace(parentInfo.slots[blockName], info.blocks[blockName]);
                }
                info.html = newHtml;
        return info;
    }
    __getMaxId() {
        let temp = super.__getMaxId();
        temp.push(["AvInstallation", 0])
        return temp;
    }
    getClassName() {
        return "AvInstallation";
    }
     defineTitle(){return "Aventus - Installation";}}
window.customElements.define('av-installation', AvInstallation);
class AvGettingStartedRouting extends AvGenericPage {
    __getStyle() {
        let arrStyle = super.__getStyle();
        arrStyle.push(``);
        return arrStyle;
    }
    __getHtml() {
        let parentInfo = super.__getHtml();
        let info = {
            html: `<section>
    <h1>Route configuration</h1>
</section>`,
            slots: {
            },
            blocks: {
                'default':`<section>
    <h1>Route configuration</h1>
</section>`
            }
        }
                let newHtml = parentInfo.html
                for (let blockName in info.blocks) {
                    if (!parentInfo.slots.hasOwnProperty(blockName)) {
                        throw "can't found slot with name " + blockName;
                    }
                    newHtml = newHtml.replace(parentInfo.slots[blockName], info.blocks[blockName]);
                }
                info.html = newHtml;
        return info;
    }
    __getMaxId() {
        let temp = super.__getMaxId();
        temp.push(["AvGettingStartedRouting", 0])
        return temp;
    }
    getClassName() {
        return "AvGettingStartedRouting";
    }
     defineTitle(){return "Aventus - Routing";} postCreation(){setTimeout(() => {    this.scrollElement.scrollToPosition(0, 99999);}, 100);}}
window.customElements.define('av-getting-started-routing', AvGettingStartedRouting);
class AvGettingStartedInitProject extends AvGenericPage {
    __getStyle() {
        let arrStyle = super.__getStyle();
        arrStyle.push(`:host av-img{max-width:100%}`);
        return arrStyle;
    }
    __getHtml() {
        let parentInfo = super.__getHtml();
        let info = {
            html: `<section>
    <h1>Init new Aventus project</h1>
    <p>In your file explorer create a new folder and open it with vscode. <br>For this tutorial the folder is called
        <i>aventus_todo</i></p>
    <p>You can right click inside the explorer part and click on <b>Aventus : Create...</b></p>
    <av-row>
        <av-col size="12" center="">
            <av-img src="/img/gettingStarted/init_right_click.PNG"></av-img>
        </av-col>
    </av-row>
    <p>A dropdown appears. You must select the option : <b>Init</b></p>
    <av-row>
        <av-col size="12" center="">
            <av-img src="/img/gettingStarted/init_select_create.PNG"></av-img>
        </av-col>
    </av-row>
    <p>Then you must enter the name for your project, by default the name used is the folder name</p>
    <av-row>
        <av-col size="12" center="">
            <av-img src="/img/gettingStarted/init_create_name.PNG"></av-img>
        </av-col>
    </av-row>
    <p>The extension will create for you the configuration file and the default structure. Then the config file is displayed</p>
</section>
<av-separation></av-separation>
<section>
    <h2>Definition of configuration file</h2>
    <p>The default configuration file. An explanation of each part of this JSON is provided below</p>
    <av-code language="json">
{
    "identifier": "Av",
    "build": [
        {
            "name": "aventus_todo",
            "version": "0.0.1",
            "inputPath": [
                "./src/*"
            ],
            "outputFile": "./dist/aventus_todo.js",
            "generateDefinition": true,
            "includeBase": true
        }
    ]
}
    </av-code>
    <p>First of all, we need to define an <b>identifier</b> for our project. This <b>identifier</b> is a prefix for all you Typescript
        classes. Futhermore, you will find it before each web component. For example if I created a button web
        component, I can use it in my HTML like that</p>
    <av-code language="html">
        <av-button></av-button>
    </av-code>
    <p>
        The section <b>build</b> allows you to define all Aventus input files you need to compile in a single Javascript file.
        You must provide two meta data fields : <b>build.name</b> and <b>build.version</b>.
        Then you can add all your input paths with the field <b>build.inputPath</b> and define the output file to generate with the field 
        <b>build.outputFile</b>. Conventionally your source code will be inside the folder <i>src/</i> and the output will be inside the folder
        <i>dist/</i>
    </p>
    <p>
        If the field <b>generateDefinition</b> is set to true, a definition file will be generated beside your javascript output file. This is useful
        if you want to share your code with someone else
    </p>
    <p>
        The field <b>includeBase</b> configure if you want the Aventus core JS file inside this build. You need to include Aventus core JS file
        only once on your final rendering.
    </p>
    <p>
        If you need more informations about others configuration options. You can check the <av-router-link state="/api/configuration">api section.</av-router-link>
    </p>
</section>
<section>
    <h2>Transform the configuration file</h2>
    <p>For this tutorial, we need a single page application (SPA) so we need a static index.html file as an entry point</p>
    <ul>
        <li>Change the field <b>generateDefinition</b> to False. We don't need a definition file because this is the final project</li>
        <li>Create a new directory <i>static</i> inside the src/ directory</li>
        <li>
            <span>Inside the configuration file add the section <i>static</i> to the root</span>
            <av-code language="json">
"static": [
    {
        "name": "Static files",
        "inputPath": "./src/static/",
        "outputPath": "./dist/"
    }
]
            </av-code>
        </li>
        <li>
            <span>Create a new file <i>index.html</i> insdie the static directory</span>
            <av-code language="html">
&lt;!DOCTYPE html&gt;
&lt;html lang="en"&gt;
&lt;head&gt;
    &lt;meta charset="UTF-8"&gt;
    &lt;meta http-equiv="X-UA-Compatible" content="IE=edge"&gt;
    &lt;meta name="viewport" content="width=device-width, initial-scale=1.0"&gt;
    &lt;title&gt;Aventus - Todo list&lt;/title&gt;
&lt;/head&gt;
&lt;body&gt;
&lt;/body&gt;
&lt;/html&gt;
            </av-code>
        </li>
    </ul>
    <p>Save all files. You can check inside you dist directory and see two files : <b>aventus_todo.js</b> and <b>index.html</b></p>
    <p>We must link the HTML and the Javascript. Inside the index.html, add this code</p>
    <av-code language="js">
        <script src="/aventus_todo.js"></script>
    </av-code>
    <p>Because of the SPA, we must create an entry point inside Aventus. Right click on the <i>src/</i> directory 
        and click on <b>Aventus : Create...</b>. <br>
        Select <b>Component</b> and fill the input with <i>App</i> and finally select <b>Single</b>
    </p>
    <p>A new folder <i>App/</i> and a new file <i>App/App.wc.avt</i> are created. This allows you to use the tag &lt;av-app&gt; in your html</p>
    <p>Go back inside <i>index.html</i> and update it like so: </p>
    <av-code language="html">
&lt;body&gt;
    <av-app></av-app>
&lt;/body&gt;
    </av-code>
    <p>In the next section, you will understand how you can use web component inside your porject and how to setup a router to navigate inside your app</p>
</section>
<section>
    <av-navigation-footer previous_state="/introduction" previous_name="Introduction" next_state="/introduction/routing" next_name="Routing"></av-navigation-footer>
</section>`,
            slots: {
            },
            blocks: {
                'default':`<section>
    <h1>Init new Aventus project</h1>
    <p>In your file explorer create a new folder and open it with vscode. <br>For this tutorial the folder is called
        <i>aventus_todo</i></p>
    <p>You can right click inside the explorer part and click on <b>Aventus : Create...</b></p>
    <av-row>
        <av-col size="12" center="">
            <av-img src="/img/gettingStarted/init_right_click.PNG"></av-img>
        </av-col>
    </av-row>
    <p>A dropdown appears. You must select the option : <b>Init</b></p>
    <av-row>
        <av-col size="12" center="">
            <av-img src="/img/gettingStarted/init_select_create.PNG"></av-img>
        </av-col>
    </av-row>
    <p>Then you must enter the name for your project, by default the name used is the folder name</p>
    <av-row>
        <av-col size="12" center="">
            <av-img src="/img/gettingStarted/init_create_name.PNG"></av-img>
        </av-col>
    </av-row>
    <p>The extension will create for you the configuration file and the default structure. Then the config file is displayed</p>
</section>
<av-separation></av-separation>
<section>
    <h2>Definition of configuration file</h2>
    <p>The default configuration file. An explanation of each part of this JSON is provided below</p>
    <av-code language="json">
{
    "identifier": "Av",
    "build": [
        {
            "name": "aventus_todo",
            "version": "0.0.1",
            "inputPath": [
                "./src/*"
            ],
            "outputFile": "./dist/aventus_todo.js",
            "generateDefinition": true,
            "includeBase": true
        }
    ]
}
    </av-code>
    <p>First of all, we need to define an <b>identifier</b> for our project. This <b>identifier</b> is a prefix for all you Typescript
        classes. Futhermore, you will find it before each web component. For example if I created a button web
        component, I can use it in my HTML like that</p>
    <av-code language="html">
        <av-button></av-button>
    </av-code>
    <p>
        The section <b>build</b> allows you to define all Aventus input files you need to compile in a single Javascript file.
        You must provide two meta data fields : <b>build.name</b> and <b>build.version</b>.
        Then you can add all your input paths with the field <b>build.inputPath</b> and define the output file to generate with the field 
        <b>build.outputFile</b>. Conventionally your source code will be inside the folder <i>src/</i> and the output will be inside the folder
        <i>dist/</i>
    </p>
    <p>
        If the field <b>generateDefinition</b> is set to true, a definition file will be generated beside your javascript output file. This is useful
        if you want to share your code with someone else
    </p>
    <p>
        The field <b>includeBase</b> configure if you want the Aventus core JS file inside this build. You need to include Aventus core JS file
        only once on your final rendering.
    </p>
    <p>
        If you need more informations about others configuration options. You can check the <av-router-link state="/api/configuration">api section.</av-router-link>
    </p>
</section>
<section>
    <h2>Transform the configuration file</h2>
    <p>For this tutorial, we need a single page application (SPA) so we need a static index.html file as an entry point</p>
    <ul>
        <li>Change the field <b>generateDefinition</b> to False. We don't need a definition file because this is the final project</li>
        <li>Create a new directory <i>static</i> inside the src/ directory</li>
        <li>
            <span>Inside the configuration file add the section <i>static</i> to the root</span>
            <av-code language="json">
"static": [
    {
        "name": "Static files",
        "inputPath": "./src/static/",
        "outputPath": "./dist/"
    }
]
            </av-code>
        </li>
        <li>
            <span>Create a new file <i>index.html</i> insdie the static directory</span>
            <av-code language="html">
&lt;!DOCTYPE html&gt;
&lt;html lang="en"&gt;
&lt;head&gt;
    &lt;meta charset="UTF-8"&gt;
    &lt;meta http-equiv="X-UA-Compatible" content="IE=edge"&gt;
    &lt;meta name="viewport" content="width=device-width, initial-scale=1.0"&gt;
    &lt;title&gt;Aventus - Todo list&lt;/title&gt;
&lt;/head&gt;
&lt;body&gt;
&lt;/body&gt;
&lt;/html&gt;
            </av-code>
        </li>
    </ul>
    <p>Save all files. You can check inside you dist directory and see two files : <b>aventus_todo.js</b> and <b>index.html</b></p>
    <p>We must link the HTML and the Javascript. Inside the index.html, add this code</p>
    <av-code language="js">
        <script src="/aventus_todo.js"></script>
    </av-code>
    <p>Because of the SPA, we must create an entry point inside Aventus. Right click on the <i>src/</i> directory 
        and click on <b>Aventus : Create...</b>. <br>
        Select <b>Component</b> and fill the input with <i>App</i> and finally select <b>Single</b>
    </p>
    <p>A new folder <i>App/</i> and a new file <i>App/App.wc.avt</i> are created. This allows you to use the tag &lt;av-app&gt; in your html</p>
    <p>Go back inside <i>index.html</i> and update it like so: </p>
    <av-code language="html">
&lt;body&gt;
    <av-app></av-app>
&lt;/body&gt;
    </av-code>
    <p>In the next section, you will understand how you can use web component inside your porject and how to setup a router to navigate inside your app</p>
</section>
<section>
    <av-navigation-footer previous_state="/introduction" previous_name="Introduction" next_state="/introduction/routing" next_name="Routing"></av-navigation-footer>
</section>`
            }
        }
                let newHtml = parentInfo.html
                for (let blockName in info.blocks) {
                    if (!parentInfo.slots.hasOwnProperty(blockName)) {
                        throw "can't found slot with name " + blockName;
                    }
                    newHtml = newHtml.replace(parentInfo.slots[blockName], info.blocks[blockName]);
                }
                info.html = newHtml;
        return info;
    }
    __getMaxId() {
        let temp = super.__getMaxId();
        temp.push(["AvGettingStartedInitProject", 0])
        return temp;
    }
    getClassName() {
        return "AvGettingStartedInitProject";
    }
     defineTitle(){return "Aventus - Init project";}}
window.customElements.define('av-getting-started-init-project', AvGettingStartedInitProject);
class AvGettingStarted extends AvGenericPage {
    __getStyle() {
        let arrStyle = super.__getStyle();
        arrStyle.push(``);
        return arrStyle;
    }
    __getHtml() {
        let parentInfo = super.__getHtml();
        let info = {
            html: `<section>
    <h1>Getting started with Aventus</h1>
    <p>Welcome to Aventus !</p>
    <p>This tutorial introduces you to the essentials of Aventus by walking through building a Todo list.</p>
    <p>Let's get started !!!</p>
</section>
<av-separation></av-separation>
<section>
    <h2>Prerequistes</h2>
    <p>Before everythink you need to : </p>
    <ul>
        <li>Have knowledge of HTML, CSS and Javascript</li>
        <li>Install Aventus : <av-router-link state="/installation">here</av-router-link>
        </li>
    </ul>
</section>
<av-separation></av-separation>
<section>
    <h2>The concept</h2>
    <p>Aventus is a framework that allow you to create complex user interfaces by splitting common parts of a
        front-end application in several well knowned files. It builds on top of standard HTML, CSS, Javascript
        and provide a way to keep your development under control.</p>
    <p>The core features are :</p>
    <ul>
        <li>Data consistency based on store</li>
        <li>Reusability with web component</li>
        <li>Simplified communication with websocket</li>
        <li>Reactivity</li>
    </ul>
</section>
<av-separation></av-separation>
<section>
    <h2>Understand files</h2>
    <p>
        First of all, you need to understand all files you can use inside Aventus. This is just a summary, a better
        explanation will be provided later
    </p>
    <div class="table">
        <av-row class="header">
            <av-col size_sm="4" center="">Extension</av-col>
            <av-col size_sm="8" center="">Role</av-col>
        </av-row>
        <av-row>
            <av-col size_sm="4" center="">aventus.conf.json</av-col>
            <av-col size_sm="8">
                <div class="title">Configuration</div>
                <div class="description">Inside this file you can find configuration for your project</div>
            </av-col>
        </av-row>
        <av-row>
            <av-col size_sm="4" center="">*.wcl.avt</av-col>
            <av-col size_sm="8">
                <div class="title">Web Component Logic</div>
                <div class="description">Inside this file you can find the logical part in Typescript for your
                    web
                    component</div>
            </av-col>
        </av-row>
        <av-row>
            <av-col size_sm="4" center="">*.wcs.avt</av-col>
            <av-col size_sm="8">
                <div class="title">Web Component Style</div>
                <div class="description">Inside this file you can find the style in SCSS for your web component
                </div>
            </av-col>
        </av-row>
        <av-row>
            <av-col size_sm="4" center="">*.wcv.avt</av-col>
            <av-col size_sm="8">
                <div class="title">Web Component View</div>
                <div class="description">Inside this file you can find the structure in HTML for your web
                    component
                </div>
            </av-col>
        </av-row>
        <av-row>
            <av-col size_sm="4" center="">*.data.avt</av-col>
            <av-col size_sm="8">
                <div class="title">Data</div>
                <div class="description">This file is a class / interface / enum representing usable objects for
                    your application</div>
            </av-col>
        </av-row>
        <av-row>
            <av-col size_sm="4" center="">*.lib.avt</av-col>
            <av-col size_sm="8">
                <div class="title">Library</div>
                <div class="description">This file allow you to create some logical part for your project
                    without
                    web component</div>
            </av-col>
        </av-row>
        <av-row>
            <av-col size_sm="4" center="">*.ram.avt</av-col>
            <av-col size_sm="8">
                <div class="title">RAM</div>
                <div class="description">This file allow you to create store for your data</div>
            </av-col>
        </av-row>
        <av-row>
            <av-col size_sm="4" center="">*.socket.avt</av-col>
            <av-col size_sm="8">
                <div class="title">WebSocket</div>
                <div class="description">This file allow you to create websocket instance to send message to
                    your
                    backend</div>
            </av-col>
        </av-row>
    </div>
</section>
<av-separation></av-separation>
<section>
    <av-navigation-footer no_previous="" next_state="/introduction/init" next_name="Init"></av-navigation-footer>
</section>`,
            slots: {
            },
            blocks: {
                'default':`<section>
    <h1>Getting started with Aventus</h1>
    <p>Welcome to Aventus !</p>
    <p>This tutorial introduces you to the essentials of Aventus by walking through building a Todo list.</p>
    <p>Let's get started !!!</p>
</section>
<av-separation></av-separation>
<section>
    <h2>Prerequistes</h2>
    <p>Before everythink you need to : </p>
    <ul>
        <li>Have knowledge of HTML, CSS and Javascript</li>
        <li>Install Aventus : <av-router-link state="/installation">here</av-router-link>
        </li>
    </ul>
</section>
<av-separation></av-separation>
<section>
    <h2>The concept</h2>
    <p>Aventus is a framework that allow you to create complex user interfaces by splitting common parts of a
        front-end application in several well knowned files. It builds on top of standard HTML, CSS, Javascript
        and provide a way to keep your development under control.</p>
    <p>The core features are :</p>
    <ul>
        <li>Data consistency based on store</li>
        <li>Reusability with web component</li>
        <li>Simplified communication with websocket</li>
        <li>Reactivity</li>
    </ul>
</section>
<av-separation></av-separation>
<section>
    <h2>Understand files</h2>
    <p>
        First of all, you need to understand all files you can use inside Aventus. This is just a summary, a better
        explanation will be provided later
    </p>
    <div class="table">
        <av-row class="header">
            <av-col size_sm="4" center="">Extension</av-col>
            <av-col size_sm="8" center="">Role</av-col>
        </av-row>
        <av-row>
            <av-col size_sm="4" center="">aventus.conf.json</av-col>
            <av-col size_sm="8">
                <div class="title">Configuration</div>
                <div class="description">Inside this file you can find configuration for your project</div>
            </av-col>
        </av-row>
        <av-row>
            <av-col size_sm="4" center="">*.wcl.avt</av-col>
            <av-col size_sm="8">
                <div class="title">Web Component Logic</div>
                <div class="description">Inside this file you can find the logical part in Typescript for your
                    web
                    component</div>
            </av-col>
        </av-row>
        <av-row>
            <av-col size_sm="4" center="">*.wcs.avt</av-col>
            <av-col size_sm="8">
                <div class="title">Web Component Style</div>
                <div class="description">Inside this file you can find the style in SCSS for your web component
                </div>
            </av-col>
        </av-row>
        <av-row>
            <av-col size_sm="4" center="">*.wcv.avt</av-col>
            <av-col size_sm="8">
                <div class="title">Web Component View</div>
                <div class="description">Inside this file you can find the structure in HTML for your web
                    component
                </div>
            </av-col>
        </av-row>
        <av-row>
            <av-col size_sm="4" center="">*.data.avt</av-col>
            <av-col size_sm="8">
                <div class="title">Data</div>
                <div class="description">This file is a class / interface / enum representing usable objects for
                    your application</div>
            </av-col>
        </av-row>
        <av-row>
            <av-col size_sm="4" center="">*.lib.avt</av-col>
            <av-col size_sm="8">
                <div class="title">Library</div>
                <div class="description">This file allow you to create some logical part for your project
                    without
                    web component</div>
            </av-col>
        </av-row>
        <av-row>
            <av-col size_sm="4" center="">*.ram.avt</av-col>
            <av-col size_sm="8">
                <div class="title">RAM</div>
                <div class="description">This file allow you to create store for your data</div>
            </av-col>
        </av-row>
        <av-row>
            <av-col size_sm="4" center="">*.socket.avt</av-col>
            <av-col size_sm="8">
                <div class="title">WebSocket</div>
                <div class="description">This file allow you to create websocket instance to send message to
                    your
                    backend</div>
            </av-col>
        </av-row>
    </div>
</section>
<av-separation></av-separation>
<section>
    <av-navigation-footer no_previous="" next_state="/introduction/init" next_name="Init"></av-navigation-footer>
</section>`
            }
        }
                let newHtml = parentInfo.html
                for (let blockName in info.blocks) {
                    if (!parentInfo.slots.hasOwnProperty(blockName)) {
                        throw "can't found slot with name " + blockName;
                    }
                    newHtml = newHtml.replace(parentInfo.slots[blockName], info.blocks[blockName]);
                }
                info.html = newHtml;
        return info;
    }
    __getMaxId() {
        let temp = super.__getMaxId();
        temp.push(["AvGettingStarted", 0])
        return temp;
    }
    getClassName() {
        return "AvGettingStarted";
    }
     defineTitle(){return "Aventus - Getting started";}}
window.customElements.define('av-getting-started', AvGettingStarted);
class AvExample extends AvGenericPage {
    __getStyle() {
        let arrStyle = super.__getStyle();
        arrStyle.push(``);
        return arrStyle;
    }
    __getHtml() {
        let parentInfo = super.__getHtml();
        let info = {
            html: `<slot></slot>
example`,
            slots: {
                'default':`<slot></slot>`
            },
            blocks: {
                'default':`<slot></slot>
example`
            }
        }
                let newHtml = parentInfo.html
                for (let blockName in info.blocks) {
                    if (!parentInfo.slots.hasOwnProperty(blockName)) {
                        throw "can't found slot with name " + blockName;
                    }
                    newHtml = newHtml.replace(parentInfo.slots[blockName], info.blocks[blockName]);
                }
                info.html = newHtml;
        return info;
    }
    __getMaxId() {
        let temp = super.__getMaxId();
        temp.push(["AvExample", 0])
        return temp;
    }
    getClassName() {
        return "AvExample";
    }
     defineTitle(){return "Aventus - Examples";}}
window.customElements.define('av-example', AvExample);
class AvApiConfiguration extends AvGenericPage {
    __getStyle() {
        let arrStyle = super.__getStyle();
        arrStyle.push(``);
        return arrStyle;
    }
    __getHtml() {
        let parentInfo = super.__getHtml();
        let info = {
            html: `<section>
    <h1>Configuration</h1>
    <p>The configuration file for all your aventus project is "aventus.conf.json". You can find below a full configuration file</p>
    <av-code language="json">
{
    "identifier": "Av",
    "components": {
        "disableIdentifier": false
    },
    "data": {
        "disableIdentifier": false
    },
    "libs": {
        "disableIdentifier": false
    },
    "ram": {
        "disableIdentifier": false
    },
    "build": [
        {
            "name": "example",
            "version": "0.0.1",
            "inputPath": [
                "./src/*"
            ],
            "outputFile": "./dist/example.js",
            "generateDefinition": true,
            "includeBase": true,
            "compileOnSave": true,
            "include": [
                {
                    "libraryName": "MyLib",
                    "definition": "./import/myLib.def.avt",
                    "src": "'./import.myLib.js"
                }
            ]
        }
    ],
    "static": [
        {
            "name": "static_files",
            "inputPath": "./src/static",
            "outputPath": "./dist/"
        }
    ]
}
    </av-code>
    <div class="table table-row">
        <av-row class="header">
            <av-col size="3" center="">Key</av-col>
            <av-col size="2" center="">Mandatory</av-col>
            <av-col size="7" center="">Meaning</av-col>
        </av-row>
        <av-row>
            <av-col size="3">identifier</av-col>
            <av-col size="2" center="">True</av-col>
            <av-col size="7">
                This is the identifier used to prefix all your classes. It allows you to keep consistency inside your project.
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">components</av-col>
            <av-col size="2" center="">False</av-col>
            <av-col size="7">
                In this section you can define special configuration for your web components
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;disableIdentifier</av-col>
            <av-col size="2" center="">False</av-col>
            <av-col size="7">
                Set it to true if you want to disable identifier check for all your web components
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">data</av-col>
            <av-col size="2" center="">False</av-col>
            <av-col size="7">
                In this section you can define special configuration for your web data
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;disableIdentifier</av-col>
            <av-col size="2" center="">False</av-col>
            <av-col size="7">
                Set it to true if you want to disable identifier check for all your web data
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">libs</av-col>
            <av-col size="2" center="">False</av-col>
            <av-col size="7">
                In this section you can define special configuration for your web libs
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;disableIdentifier</av-col>
            <av-col size="2" center="">False</av-col>
            <av-col size="7">
                Set it to true if you want to disable identifier check for all your web libs
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">ram</av-col>
            <av-col size="2" center="">False</av-col>
            <av-col size="7">
                In this section you can define special configuration for your web ram
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;disableIdentifier</av-col>
            <av-col size="2" center="">False</av-col>
            <av-col size="7">
                Set it to true if you want to disable identifier check for all your web ram
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">build</av-col>
            <av-col size="2" center="">True</av-col>
            <av-col size="7">
                In this section you can define builds needed. A build = one output file
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;name</av-col>
            <av-col size="2" center="">True</av-col>
            <av-col size="7">
                The name of the build
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;version</av-col>
            <av-col size="2" center="">True</av-col>
            <av-col size="7">
                The version of your build
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;inputPath</av-col>
            <av-col size="2" center="">True</av-col>
            <av-col size="7">
                An array of all paths to look for Avt files to compile
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;outputFile</av-col>
            <av-col size="2" center="">True</av-col>
            <av-col size="7">
                The location and the name of your output file
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;generateDefinition</av-col>
            <av-col size="2" center="">False</av-col>
            <av-col size="7">
                Set it to true if you need the definition file as output. The definition file is used in other project to import your lib and use it
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;includeBase</av-col>
            <av-col size="2" center="">False</av-col>
            <av-col size="7">
                Set it to true if you need to include Aventus core JS inside this build. You need import aventus only once in your final rendering
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;compileOnSave</av-col>
            <av-col size="2" center="">False</av-col>
            <av-col size="7">
                Set it to false if you need to disable compilation when you save your file
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;include</av-col>
            <av-col size="2" center="">False</av-col>
            <av-col size="7">
                An array where you can import other aventus library
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;&nbsp;&nbsp;definition</av-col>
            <av-col size="2" center="">True</av-col>
            <av-col size="7">
                The path / url to the *.def.avt file
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;&nbsp;&nbsp;src</av-col>
            <av-col size="2" center="">False</av-col>
            <av-col size="7">
                The path / url to the js file of the library. If defines, it ll import this js build in your final build
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;&nbsp;&nbsp;libraryName</av-col>
            <av-col size="2" center="">False</av-col>
            <av-col size="7">
                ???
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">static</av-col>
            <av-col size="2" center="">False</av-col>
            <av-col size="7">
                In this section you can define static file to copy. Scss file are compiled in css
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;name</av-col>
            <av-col size="2" center="">True</av-col>
            <av-col size="7">
                The name of the static part
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;exportOnChange</av-col>
            <av-col size="2" center="">False</av-col>
            <av-col size="7">
                Set it to false if you want to disable auto exporting
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;inputPath</av-col>
            <av-col size="2" center="">True</av-col>
            <av-col size="7">
                The path to the input static folder
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;outputPath</av-col>
            <av-col size="2" center="">True</av-col>
            <av-col size="7">
                The path to the output static folder
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;colorsMap</av-col>
            <av-col size="2" center="">False</av-col>
            <av-col size="7">
                TColor to map when transpile svg
            </av-col>
        </av-row>
    </div>
</section>`,
            slots: {
            },
            blocks: {
                'default':`<section>
    <h1>Configuration</h1>
    <p>The configuration file for all your aventus project is "aventus.conf.json". You can find below a full configuration file</p>
    <av-code language="json">
{
    "identifier": "Av",
    "components": {
        "disableIdentifier": false
    },
    "data": {
        "disableIdentifier": false
    },
    "libs": {
        "disableIdentifier": false
    },
    "ram": {
        "disableIdentifier": false
    },
    "build": [
        {
            "name": "example",
            "version": "0.0.1",
            "inputPath": [
                "./src/*"
            ],
            "outputFile": "./dist/example.js",
            "generateDefinition": true,
            "includeBase": true,
            "compileOnSave": true,
            "include": [
                {
                    "libraryName": "MyLib",
                    "definition": "./import/myLib.def.avt",
                    "src": "'./import.myLib.js"
                }
            ]
        }
    ],
    "static": [
        {
            "name": "static_files",
            "inputPath": "./src/static",
            "outputPath": "./dist/"
        }
    ]
}
    </av-code>
    <div class="table table-row">
        <av-row class="header">
            <av-col size="3" center="">Key</av-col>
            <av-col size="2" center="">Mandatory</av-col>
            <av-col size="7" center="">Meaning</av-col>
        </av-row>
        <av-row>
            <av-col size="3">identifier</av-col>
            <av-col size="2" center="">True</av-col>
            <av-col size="7">
                This is the identifier used to prefix all your classes. It allows you to keep consistency inside your project.
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">components</av-col>
            <av-col size="2" center="">False</av-col>
            <av-col size="7">
                In this section you can define special configuration for your web components
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;disableIdentifier</av-col>
            <av-col size="2" center="">False</av-col>
            <av-col size="7">
                Set it to true if you want to disable identifier check for all your web components
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">data</av-col>
            <av-col size="2" center="">False</av-col>
            <av-col size="7">
                In this section you can define special configuration for your web data
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;disableIdentifier</av-col>
            <av-col size="2" center="">False</av-col>
            <av-col size="7">
                Set it to true if you want to disable identifier check for all your web data
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">libs</av-col>
            <av-col size="2" center="">False</av-col>
            <av-col size="7">
                In this section you can define special configuration for your web libs
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;disableIdentifier</av-col>
            <av-col size="2" center="">False</av-col>
            <av-col size="7">
                Set it to true if you want to disable identifier check for all your web libs
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">ram</av-col>
            <av-col size="2" center="">False</av-col>
            <av-col size="7">
                In this section you can define special configuration for your web ram
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;disableIdentifier</av-col>
            <av-col size="2" center="">False</av-col>
            <av-col size="7">
                Set it to true if you want to disable identifier check for all your web ram
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">build</av-col>
            <av-col size="2" center="">True</av-col>
            <av-col size="7">
                In this section you can define builds needed. A build = one output file
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;name</av-col>
            <av-col size="2" center="">True</av-col>
            <av-col size="7">
                The name of the build
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;version</av-col>
            <av-col size="2" center="">True</av-col>
            <av-col size="7">
                The version of your build
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;inputPath</av-col>
            <av-col size="2" center="">True</av-col>
            <av-col size="7">
                An array of all paths to look for Avt files to compile
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;outputFile</av-col>
            <av-col size="2" center="">True</av-col>
            <av-col size="7">
                The location and the name of your output file
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;generateDefinition</av-col>
            <av-col size="2" center="">False</av-col>
            <av-col size="7">
                Set it to true if you need the definition file as output. The definition file is used in other project to import your lib and use it
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;includeBase</av-col>
            <av-col size="2" center="">False</av-col>
            <av-col size="7">
                Set it to true if you need to include Aventus core JS inside this build. You need import aventus only once in your final rendering
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;compileOnSave</av-col>
            <av-col size="2" center="">False</av-col>
            <av-col size="7">
                Set it to false if you need to disable compilation when you save your file
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;include</av-col>
            <av-col size="2" center="">False</av-col>
            <av-col size="7">
                An array where you can import other aventus library
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;&nbsp;&nbsp;definition</av-col>
            <av-col size="2" center="">True</av-col>
            <av-col size="7">
                The path / url to the *.def.avt file
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;&nbsp;&nbsp;src</av-col>
            <av-col size="2" center="">False</av-col>
            <av-col size="7">
                The path / url to the js file of the library. If defines, it ll import this js build in your final build
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;&nbsp;&nbsp;libraryName</av-col>
            <av-col size="2" center="">False</av-col>
            <av-col size="7">
                ???
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">static</av-col>
            <av-col size="2" center="">False</av-col>
            <av-col size="7">
                In this section you can define static file to copy. Scss file are compiled in css
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;name</av-col>
            <av-col size="2" center="">True</av-col>
            <av-col size="7">
                The name of the static part
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;exportOnChange</av-col>
            <av-col size="2" center="">False</av-col>
            <av-col size="7">
                Set it to false if you want to disable auto exporting
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;inputPath</av-col>
            <av-col size="2" center="">True</av-col>
            <av-col size="7">
                The path to the input static folder
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;outputPath</av-col>
            <av-col size="2" center="">True</av-col>
            <av-col size="7">
                The path to the output static folder
            </av-col>
        </av-row>
        <av-row>
            <av-col size="3">&nbsp;&nbsp;colorsMap</av-col>
            <av-col size="2" center="">False</av-col>
            <av-col size="7">
                TColor to map when transpile svg
            </av-col>
        </av-row>
    </div>
</section>`
            }
        }
                let newHtml = parentInfo.html
                for (let blockName in info.blocks) {
                    if (!parentInfo.slots.hasOwnProperty(blockName)) {
                        throw "can't found slot with name " + blockName;
                    }
                    newHtml = newHtml.replace(parentInfo.slots[blockName], info.blocks[blockName]);
                }
                info.html = newHtml;
        return info;
    }
    __getMaxId() {
        let temp = super.__getMaxId();
        temp.push(["AvApiConfiguration", 0])
        return temp;
    }
    getClassName() {
        return "AvApiConfiguration";
    }
     defineTitle(){return "Aventus - API Configuration";}}
window.customElements.define('av-api-configuration', AvApiConfiguration);
class AvNavigationFooter extends WebComponent {
    static get observedAttributes() {return ["previous_state", "previous_name", "next_state", "next_name"].concat(super.observedAttributes).filter((v, i, a) => a.indexOf(v) === i);}
    get 'no_previous'() {
                        return this.hasAttribute('no_previous');
                    }
                    set 'no_previous'(val) {
                        if(val === 1 || val === 'true' || val === ''){
                            val = true;
                        }
                        else if(val === 0 || val === 'false' || val === null || val === undefined){
                            val = false;
                        }
                        if(val !== false && val !== true){
                            console.error("error setting boolean in no_previous");
                            val = false;
                        }
                        if (val) {
                            this.setAttribute('no_previous', 'true');
                        } else{
                            this.removeAttribute('no_previous');
                        }
                    }get 'previous_state'() {
                        return this.getAttribute('previous_state');
                    }
                    set 'previous_state'(val) {
                        this.setAttribute('previous_state',val);
                    }get 'previous_name'() {
                        return this.getAttribute('previous_name');
                    }
                    set 'previous_name'(val) {
                        this.setAttribute('previous_name',val);
                    }get 'no_next'() {
                        return this.hasAttribute('no_next');
                    }
                    set 'no_next'(val) {
                        if(val === 1 || val === 'true' || val === ''){
                            val = true;
                        }
                        else if(val === 0 || val === 'false' || val === null || val === undefined){
                            val = false;
                        }
                        if(val !== false && val !== true){
                            console.error("error setting boolean in no_next");
                            val = false;
                        }
                        if (val) {
                            this.setAttribute('no_next', 'true');
                        } else{
                            this.removeAttribute('no_next');
                        }
                    }get 'next_state'() {
                        return this.getAttribute('next_state');
                    }
                    set 'next_state'(val) {
                        this.setAttribute('next_state',val);
                    }get 'next_name'() {
                        return this.getAttribute('next_name');
                    }
                    set 'next_name'(val) {
                        this.setAttribute('next_name',val);
                    }    __getStyle() {
        let arrStyle = super.__getStyle();
        arrStyle.push(`:host{display:flex;width:100%}:host .navigation av-img{height:40px}:host .navigation .previous{display:flex;align-items:center;justify-content:center}:host .navigation .previous av-router-link{display:flex;align-items:center;justify-content:center;cursor:pointer;color:#000;text-decoration:none}:host .navigation .previous av-router-link span{margin-left:15px}:host .navigation .next{display:flex;align-items:center;justify-content:center}:host .navigation .next av-router-link{display:flex;align-items:center;justify-content:center;cursor:pointer;color:#000;text-decoration:none}:host .navigation .next av-router-link span{margin-right:15px}:host([no_previous]) .previous{opacity:0;pointer-events:none}:host([no_next]) .next{opacity:0;pointer-events:none}`);
        return arrStyle;
    }
    __getHtml() {
        let parentInfo = super.__getHtml();
        let info = {
            html: `<av-row class="navigation">
    <av-col class="previous" offset_md="2" size_md="4">
        <av-router-link _id="avnavigationfooter_0">
            <av-img src="/img/angle-left.svg"></av-img>
            <span _id="avnavigationfooter_1"></span>
        </av-router-link>
    </av-col>
    <av-col class="next" size_md="4">
        <av-router-link _id="avnavigationfooter_2">
            <span _id="avnavigationfooter_3"></span>
            <av-img src="/img/angle-right.svg"></av-img>
        </av-router-link>
    </av-col>
</av-row>`,
            slots: {
            },
            blocks: {
                'default':`<av-row class="navigation">
    <av-col class="previous" offset_md="2" size_md="4">
        <av-router-link _id="avnavigationfooter_0">
            <av-img src="/img/angle-left.svg"></av-img>
            <span _id="avnavigationfooter_1"></span>
        </av-router-link>
    </av-col>
    <av-col class="next" size_md="4">
        <av-router-link _id="avnavigationfooter_2">
            <span _id="avnavigationfooter_3"></span>
            <av-img src="/img/angle-right.svg"></av-img>
        </av-router-link>
    </av-col>
</av-row>`
            }
        }
        return info;
    }
    __getMaxId() {
        let temp = super.__getMaxId();
        temp.push(["AvNavigationFooter", 4])
        return temp;
    }
    __registerOnChange() { super.__registerOnChange(); this.__onChangeFct['previous_state'] = []this.__onChangeFct['previous_state'].push((path) => {if("previous_state".startsWith(path)){
										for(var i = 0;i<this._components['avnavigationfooter_0'].length;i++){
											this._components['avnavigationfooter_0'][i].setAttribute("state", ""+this.previous_state+"");
										}
									}})this.__onChangeFct['previous_name'] = []this.__onChangeFct['previous_name'].push((path) => {if("previous_name".startsWith(path)){
									for(var i = 0;i<this._components['avnavigationfooter_1'].length;i++){
									this._components['avnavigationfooter_1'][i].innerHTML = ""+this.previous_name+"".toString();
								}
							}})this.__onChangeFct['next_state'] = []this.__onChangeFct['next_state'].push((path) => {if("next_state".startsWith(path)){
										for(var i = 0;i<this._components['avnavigationfooter_2'].length;i++){
											this._components['avnavigationfooter_2'][i].setAttribute("state", ""+this.next_state+"");
										}
									}})this.__onChangeFct['next_name'] = []this.__onChangeFct['next_name'].push((path) => {if("next_name".startsWith(path)){
									for(var i = 0;i<this._components['avnavigationfooter_3'].length;i++){
									this._components['avnavigationfooter_3'][i].innerHTML = ""+this.next_name+"".toString();
								}
							}}) }
    getClassName() {
        return "AvNavigationFooter";
    }
    __defaultValue() { super.__defaultValue(); if(!this.hasAttribute('no_previous')) { this.attributeChangedCallback('no_previous', false, false); }if(!this.hasAttribute('previous_state')){ this['previous_state'] = '/'; }if(!this.hasAttribute('previous_name')){ this['previous_name'] = 'Previous'; }if(!this.hasAttribute('no_next')) { this.attributeChangedCallback('no_next', false, false); }if(!this.hasAttribute('next_state')){ this['next_state'] = '/'; }if(!this.hasAttribute('next_name')){ this['next_name'] = 'Next'; } }
    __upgradeAttributes() { super.__upgradeAttributes(); this.__upgradeProperty('previous_state');this.__upgradeProperty('previous_name');this.__upgradeProperty('next_state');this.__upgradeProperty('next_name'); }
    __listBoolProps() { return ["no_previous","no_next"].concat(super.__listBoolProps()).filter((v, i, a) => a.indexOf(v) === i); }
}
window.customElements.define('av-navigation-footer', AvNavigationFooter);
class AvNavbar extends WebComponent {
    __getStyle() {
        let arrStyle = super.__getStyle();
        arrStyle.push(`:host{height:70px;padding:10px;width:100%;background-color:var(--primary-color);box-shadow:0 5px 5px #c8c8c8;display:flex;justify-content:space-between}:host .routing{display:flex;height:100%}:host .routing av-router-link{margin:0 8px;padding:0 8px;display:flex;height:100%;align-items:center;color:var(--secondary-color);transition:background .4s var(--bezier-curve);cursor:pointer;border-radius:5px}:host .routing av-router-link:hover{background-color:var(--lighter)}:host .routing av-router-link.active{background-color:var(--lighter)}`);
        return arrStyle;
    }
    __getHtml() {
        let parentInfo = super.__getHtml();
        let info = {
            html: `<av-img src="/img/icon.png"></av-img>
<div class="routing">
    <av-router-link state="/">Home</av-router-link>
    <av-router-link state="/example">Example</av-router-link>
    <av-router-link state="/api">API</av-router-link>
    <av-router-link state="/installation">Installation</av-router-link>
</div>`,
            slots: {
            },
            blocks: {
                'default':`<av-img src="/img/icon.png"></av-img>
<div class="routing">
    <av-router-link state="/">Home</av-router-link>
    <av-router-link state="/example">Example</av-router-link>
    <av-router-link state="/api">API</av-router-link>
    <av-router-link state="/installation">Installation</av-router-link>
</div>`
            }
        }
        return info;
    }
    __getMaxId() {
        let temp = super.__getMaxId();
        temp.push(["AvNavbar", 0])
        return temp;
    }
    getClassName() {
        return "AvNavbar";
    }
}
window.customElements.define('av-navbar', AvNavbar);
class AvSeparation extends WebComponent {
    __getStyle() {
        let arrStyle = super.__getStyle();
        arrStyle.push(`:host{height:1px;width:calc(100% - 50px);margin:25px;background-color:var(--darker)}`);
        return arrStyle;
    }
    __getHtml() {
        let parentInfo = super.__getHtml();
        let info = {
            html: ``,
            slots: {
            },
            blocks: {
            }
        }
        return info;
    }
    __getMaxId() {
        let temp = super.__getMaxId();
        temp.push(["AvSeparation", 0])
        return temp;
    }
    getClassName() {
        return "AvSeparation";
    }
}
window.customElements.define('av-separation', AvSeparation);
class AvRow extends WebComponent {
    get 'max_width'() {
                        return this.getAttribute('max_width');
                    }
                    set 'max_width'(val) {
                        this.setAttribute('max_width',val);
                    }    __prepareVariables() { super.__prepareVariables(); if(this.sizes === undefined) {this.sizes = {"xs":300,"sm":540,"md":720,"lg":960,"xl":1140};} }
    __getStyle() {
        let arrStyle = super.__getStyle();
        arrStyle.push(`:host{display:flex;width:100%;font-size:0}:host([max_width=""]) ::slotted(av-col[offset_xs="0"]){margin-left:0%}:host([max_width=""]) ::slotted(av-col[offset_right_xs="0"]){margin-right:0%}:host([max_width=""]) ::slotted(av-col[size_xs="0"]){width:0%;display:inline-block}:host([max_width=""]) ::slotted(av-col[offset_xs="1"]){margin-left:8.3333333333%}:host([max_width=""]) ::slotted(av-col[offset_right_xs="1"]){margin-right:8.3333333333%}:host([max_width=""]) ::slotted(av-col[size_xs="1"]){width:8.3333333333%;display:inline-block}:host([max_width=""]) ::slotted(av-col[offset_xs="2"]){margin-left:16.6666666667%}:host([max_width=""]) ::slotted(av-col[offset_right_xs="2"]){margin-right:16.6666666667%}:host([max_width=""]) ::slotted(av-col[size_xs="2"]){width:16.6666666667%;display:inline-block}:host([max_width=""]) ::slotted(av-col[offset_xs="3"]){margin-left:25%}:host([max_width=""]) ::slotted(av-col[offset_right_xs="3"]){margin-right:25%}:host([max_width=""]) ::slotted(av-col[size_xs="3"]){width:25%;display:inline-block}:host([max_width=""]) ::slotted(av-col[offset_xs="4"]){margin-left:33.3333333333%}:host([max_width=""]) ::slotted(av-col[offset_right_xs="4"]){margin-right:33.3333333333%}:host([max_width=""]) ::slotted(av-col[size_xs="4"]){width:33.3333333333%;display:inline-block}:host([max_width=""]) ::slotted(av-col[offset_xs="5"]){margin-left:41.6666666667%}:host([max_width=""]) ::slotted(av-col[offset_right_xs="5"]){margin-right:41.6666666667%}:host([max_width=""]) ::slotted(av-col[size_xs="5"]){width:41.6666666667%;display:inline-block}:host([max_width=""]) ::slotted(av-col[offset_xs="6"]){margin-left:50%}:host([max_width=""]) ::slotted(av-col[offset_right_xs="6"]){margin-right:50%}:host([max_width=""]) ::slotted(av-col[size_xs="6"]){width:50%;display:inline-block}:host([max_width=""]) ::slotted(av-col[offset_xs="7"]){margin-left:58.3333333333%}:host([max_width=""]) ::slotted(av-col[offset_right_xs="7"]){margin-right:58.3333333333%}:host([max_width=""]) ::slotted(av-col[size_xs="7"]){width:58.3333333333%;display:inline-block}:host([max_width=""]) ::slotted(av-col[offset_xs="8"]){margin-left:66.6666666667%}:host([max_width=""]) ::slotted(av-col[offset_right_xs="8"]){margin-right:66.6666666667%}:host([max_width=""]) ::slotted(av-col[size_xs="8"]){width:66.6666666667%;display:inline-block}:host([max_width=""]) ::slotted(av-col[offset_xs="9"]){margin-left:75%}:host([max_width=""]) ::slotted(av-col[offset_right_xs="9"]){margin-right:75%}:host([max_width=""]) ::slotted(av-col[size_xs="9"]){width:75%;display:inline-block}:host([max_width=""]) ::slotted(av-col[offset_xs="10"]){margin-left:83.3333333333%}:host([max_width=""]) ::slotted(av-col[offset_right_xs="10"]){margin-right:83.3333333333%}:host([max_width=""]) ::slotted(av-col[size_xs="10"]){width:83.3333333333%;display:inline-block}:host([max_width=""]) ::slotted(av-col[offset_xs="11"]){margin-left:91.6666666667%}:host([max_width=""]) ::slotted(av-col[offset_right_xs="11"]){margin-right:91.6666666667%}:host([max_width=""]) ::slotted(av-col[size_xs="11"]){width:91.6666666667%;display:inline-block}:host([max_width=""]) ::slotted(av-col[offset_xs="12"]){margin-left:100%}:host([max_width=""]) ::slotted(av-col[offset_right_xs="12"]){margin-right:100%}:host([max_width=""]) ::slotted(av-col[size_xs="12"]){width:100%;display:inline-block}:host([max_width~=xs]) ::slotted(av-col[offset_xs="0"]){margin-left:0%}:host([max_width~=xs]) ::slotted(av-col[offset_right_xs="0"]){margin-right:0%}:host([max_width~=xs]) ::slotted(av-col[size_xs="0"]){width:0%;display:inline-block}:host([max_width~=xs]) ::slotted(av-col[offset_xs="1"]){margin-left:8.3333333333%}:host([max_width~=xs]) ::slotted(av-col[offset_right_xs="1"]){margin-right:8.3333333333%}:host([max_width~=xs]) ::slotted(av-col[size_xs="1"]){width:8.3333333333%;display:inline-block}:host([max_width~=xs]) ::slotted(av-col[offset_xs="2"]){margin-left:16.6666666667%}:host([max_width~=xs]) ::slotted(av-col[offset_right_xs="2"]){margin-right:16.6666666667%}:host([max_width~=xs]) ::slotted(av-col[size_xs="2"]){width:16.6666666667%;display:inline-block}:host([max_width~=xs]) ::slotted(av-col[offset_xs="3"]){margin-left:25%}:host([max_width~=xs]) ::slotted(av-col[offset_right_xs="3"]){margin-right:25%}:host([max_width~=xs]) ::slotted(av-col[size_xs="3"]){width:25%;display:inline-block}:host([max_width~=xs]) ::slotted(av-col[offset_xs="4"]){margin-left:33.3333333333%}:host([max_width~=xs]) ::slotted(av-col[offset_right_xs="4"]){margin-right:33.3333333333%}:host([max_width~=xs]) ::slotted(av-col[size_xs="4"]){width:33.3333333333%;display:inline-block}:host([max_width~=xs]) ::slotted(av-col[offset_xs="5"]){margin-left:41.6666666667%}:host([max_width~=xs]) ::slotted(av-col[offset_right_xs="5"]){margin-right:41.6666666667%}:host([max_width~=xs]) ::slotted(av-col[size_xs="5"]){width:41.6666666667%;display:inline-block}:host([max_width~=xs]) ::slotted(av-col[offset_xs="6"]){margin-left:50%}:host([max_width~=xs]) ::slotted(av-col[offset_right_xs="6"]){margin-right:50%}:host([max_width~=xs]) ::slotted(av-col[size_xs="6"]){width:50%;display:inline-block}:host([max_width~=xs]) ::slotted(av-col[offset_xs="7"]){margin-left:58.3333333333%}:host([max_width~=xs]) ::slotted(av-col[offset_right_xs="7"]){margin-right:58.3333333333%}:host([max_width~=xs]) ::slotted(av-col[size_xs="7"]){width:58.3333333333%;display:inline-block}:host([max_width~=xs]) ::slotted(av-col[offset_xs="8"]){margin-left:66.6666666667%}:host([max_width~=xs]) ::slotted(av-col[offset_right_xs="8"]){margin-right:66.6666666667%}:host([max_width~=xs]) ::slotted(av-col[size_xs="8"]){width:66.6666666667%;display:inline-block}:host([max_width~=xs]) ::slotted(av-col[offset_xs="9"]){margin-left:75%}:host([max_width~=xs]) ::slotted(av-col[offset_right_xs="9"]){margin-right:75%}:host([max_width~=xs]) ::slotted(av-col[size_xs="9"]){width:75%;display:inline-block}:host([max_width~=xs]) ::slotted(av-col[offset_xs="10"]){margin-left:83.3333333333%}:host([max_width~=xs]) ::slotted(av-col[offset_right_xs="10"]){margin-right:83.3333333333%}:host([max_width~=xs]) ::slotted(av-col[size_xs="10"]){width:83.3333333333%;display:inline-block}:host([max_width~=xs]) ::slotted(av-col[offset_xs="11"]){margin-left:91.6666666667%}:host([max_width~=xs]) ::slotted(av-col[offset_right_xs="11"]){margin-right:91.6666666667%}:host([max_width~=xs]) ::slotted(av-col[size_xs="11"]){width:91.6666666667%;display:inline-block}:host([max_width~=xs]) ::slotted(av-col[offset_xs="12"]){margin-left:100%}:host([max_width~=xs]) ::slotted(av-col[offset_right_xs="12"]){margin-right:100%}:host([max_width~=xs]) ::slotted(av-col[size_xs="12"]){width:100%;display:inline-block}:host([max_width~=sm]) ::slotted(av-col[offset_sm="0"]){margin-left:0%}:host([max_width~=sm]) ::slotted(av-col[offset_right_sm="0"]){margin-right:0%}:host([max_width~=sm]) ::slotted(av-col[size_sm="0"]){width:0%;display:inline-block}:host([max_width~=sm]) ::slotted(av-col[offset_sm="1"]){margin-left:8.3333333333%}:host([max_width~=sm]) ::slotted(av-col[offset_right_sm="1"]){margin-right:8.3333333333%}:host([max_width~=sm]) ::slotted(av-col[size_sm="1"]){width:8.3333333333%;display:inline-block}:host([max_width~=sm]) ::slotted(av-col[offset_sm="2"]){margin-left:16.6666666667%}:host([max_width~=sm]) ::slotted(av-col[offset_right_sm="2"]){margin-right:16.6666666667%}:host([max_width~=sm]) ::slotted(av-col[size_sm="2"]){width:16.6666666667%;display:inline-block}:host([max_width~=sm]) ::slotted(av-col[offset_sm="3"]){margin-left:25%}:host([max_width~=sm]) ::slotted(av-col[offset_right_sm="3"]){margin-right:25%}:host([max_width~=sm]) ::slotted(av-col[size_sm="3"]){width:25%;display:inline-block}:host([max_width~=sm]) ::slotted(av-col[offset_sm="4"]){margin-left:33.3333333333%}:host([max_width~=sm]) ::slotted(av-col[offset_right_sm="4"]){margin-right:33.3333333333%}:host([max_width~=sm]) ::slotted(av-col[size_sm="4"]){width:33.3333333333%;display:inline-block}:host([max_width~=sm]) ::slotted(av-col[offset_sm="5"]){margin-left:41.6666666667%}:host([max_width~=sm]) ::slotted(av-col[offset_right_sm="5"]){margin-right:41.6666666667%}:host([max_width~=sm]) ::slotted(av-col[size_sm="5"]){width:41.6666666667%;display:inline-block}:host([max_width~=sm]) ::slotted(av-col[offset_sm="6"]){margin-left:50%}:host([max_width~=sm]) ::slotted(av-col[offset_right_sm="6"]){margin-right:50%}:host([max_width~=sm]) ::slotted(av-col[size_sm="6"]){width:50%;display:inline-block}:host([max_width~=sm]) ::slotted(av-col[offset_sm="7"]){margin-left:58.3333333333%}:host([max_width~=sm]) ::slotted(av-col[offset_right_sm="7"]){margin-right:58.3333333333%}:host([max_width~=sm]) ::slotted(av-col[size_sm="7"]){width:58.3333333333%;display:inline-block}:host([max_width~=sm]) ::slotted(av-col[offset_sm="8"]){margin-left:66.6666666667%}:host([max_width~=sm]) ::slotted(av-col[offset_right_sm="8"]){margin-right:66.6666666667%}:host([max_width~=sm]) ::slotted(av-col[size_sm="8"]){width:66.6666666667%;display:inline-block}:host([max_width~=sm]) ::slotted(av-col[offset_sm="9"]){margin-left:75%}:host([max_width~=sm]) ::slotted(av-col[offset_right_sm="9"]){margin-right:75%}:host([max_width~=sm]) ::slotted(av-col[size_sm="9"]){width:75%;display:inline-block}:host([max_width~=sm]) ::slotted(av-col[offset_sm="10"]){margin-left:83.3333333333%}:host([max_width~=sm]) ::slotted(av-col[offset_right_sm="10"]){margin-right:83.3333333333%}:host([max_width~=sm]) ::slotted(av-col[size_sm="10"]){width:83.3333333333%;display:inline-block}:host([max_width~=sm]) ::slotted(av-col[offset_sm="11"]){margin-left:91.6666666667%}:host([max_width~=sm]) ::slotted(av-col[offset_right_sm="11"]){margin-right:91.6666666667%}:host([max_width~=sm]) ::slotted(av-col[size_sm="11"]){width:91.6666666667%;display:inline-block}:host([max_width~=sm]) ::slotted(av-col[offset_sm="12"]){margin-left:100%}:host([max_width~=sm]) ::slotted(av-col[offset_right_sm="12"]){margin-right:100%}:host([max_width~=sm]) ::slotted(av-col[size_sm="12"]){width:100%;display:inline-block}:host([max_width~=md]) ::slotted(av-col[offset_md="0"]){margin-left:0%}:host([max_width~=md]) ::slotted(av-col[offset_right_md="0"]){margin-right:0%}:host([max_width~=md]) ::slotted(av-col[size_md="0"]){width:0%;display:inline-block}:host([max_width~=md]) ::slotted(av-col[offset_md="1"]){margin-left:8.3333333333%}:host([max_width~=md]) ::slotted(av-col[offset_right_md="1"]){margin-right:8.3333333333%}:host([max_width~=md]) ::slotted(av-col[size_md="1"]){width:8.3333333333%;display:inline-block}:host([max_width~=md]) ::slotted(av-col[offset_md="2"]){margin-left:16.6666666667%}:host([max_width~=md]) ::slotted(av-col[offset_right_md="2"]){margin-right:16.6666666667%}:host([max_width~=md]) ::slotted(av-col[size_md="2"]){width:16.6666666667%;display:inline-block}:host([max_width~=md]) ::slotted(av-col[offset_md="3"]){margin-left:25%}:host([max_width~=md]) ::slotted(av-col[offset_right_md="3"]){margin-right:25%}:host([max_width~=md]) ::slotted(av-col[size_md="3"]){width:25%;display:inline-block}:host([max_width~=md]) ::slotted(av-col[offset_md="4"]){margin-left:33.3333333333%}:host([max_width~=md]) ::slotted(av-col[offset_right_md="4"]){margin-right:33.3333333333%}:host([max_width~=md]) ::slotted(av-col[size_md="4"]){width:33.3333333333%;display:inline-block}:host([max_width~=md]) ::slotted(av-col[offset_md="5"]){margin-left:41.6666666667%}:host([max_width~=md]) ::slotted(av-col[offset_right_md="5"]){margin-right:41.6666666667%}:host([max_width~=md]) ::slotted(av-col[size_md="5"]){width:41.6666666667%;display:inline-block}:host([max_width~=md]) ::slotted(av-col[offset_md="6"]){margin-left:50%}:host([max_width~=md]) ::slotted(av-col[offset_right_md="6"]){margin-right:50%}:host([max_width~=md]) ::slotted(av-col[size_md="6"]){width:50%;display:inline-block}:host([max_width~=md]) ::slotted(av-col[offset_md="7"]){margin-left:58.3333333333%}:host([max_width~=md]) ::slotted(av-col[offset_right_md="7"]){margin-right:58.3333333333%}:host([max_width~=md]) ::slotted(av-col[size_md="7"]){width:58.3333333333%;display:inline-block}:host([max_width~=md]) ::slotted(av-col[offset_md="8"]){margin-left:66.6666666667%}:host([max_width~=md]) ::slotted(av-col[offset_right_md="8"]){margin-right:66.6666666667%}:host([max_width~=md]) ::slotted(av-col[size_md="8"]){width:66.6666666667%;display:inline-block}:host([max_width~=md]) ::slotted(av-col[offset_md="9"]){margin-left:75%}:host([max_width~=md]) ::slotted(av-col[offset_right_md="9"]){margin-right:75%}:host([max_width~=md]) ::slotted(av-col[size_md="9"]){width:75%;display:inline-block}:host([max_width~=md]) ::slotted(av-col[offset_md="10"]){margin-left:83.3333333333%}:host([max_width~=md]) ::slotted(av-col[offset_right_md="10"]){margin-right:83.3333333333%}:host([max_width~=md]) ::slotted(av-col[size_md="10"]){width:83.3333333333%;display:inline-block}:host([max_width~=md]) ::slotted(av-col[offset_md="11"]){margin-left:91.6666666667%}:host([max_width~=md]) ::slotted(av-col[offset_right_md="11"]){margin-right:91.6666666667%}:host([max_width~=md]) ::slotted(av-col[size_md="11"]){width:91.6666666667%;display:inline-block}:host([max_width~=md]) ::slotted(av-col[offset_md="12"]){margin-left:100%}:host([max_width~=md]) ::slotted(av-col[offset_right_md="12"]){margin-right:100%}:host([max_width~=md]) ::slotted(av-col[size_md="12"]){width:100%;display:inline-block}:host([max_width~=lg]) ::slotted(av-col[offset_lg="0"]){margin-left:0%}:host([max_width~=lg]) ::slotted(av-col[offset_right_lg="0"]){margin-right:0%}:host([max_width~=lg]) ::slotted(av-col[size_lg="0"]){width:0%;display:inline-block}:host([max_width~=lg]) ::slotted(av-col[offset_lg="1"]){margin-left:8.3333333333%}:host([max_width~=lg]) ::slotted(av-col[offset_right_lg="1"]){margin-right:8.3333333333%}:host([max_width~=lg]) ::slotted(av-col[size_lg="1"]){width:8.3333333333%;display:inline-block}:host([max_width~=lg]) ::slotted(av-col[offset_lg="2"]){margin-left:16.6666666667%}:host([max_width~=lg]) ::slotted(av-col[offset_right_lg="2"]){margin-right:16.6666666667%}:host([max_width~=lg]) ::slotted(av-col[size_lg="2"]){width:16.6666666667%;display:inline-block}:host([max_width~=lg]) ::slotted(av-col[offset_lg="3"]){margin-left:25%}:host([max_width~=lg]) ::slotted(av-col[offset_right_lg="3"]){margin-right:25%}:host([max_width~=lg]) ::slotted(av-col[size_lg="3"]){width:25%;display:inline-block}:host([max_width~=lg]) ::slotted(av-col[offset_lg="4"]){margin-left:33.3333333333%}:host([max_width~=lg]) ::slotted(av-col[offset_right_lg="4"]){margin-right:33.3333333333%}:host([max_width~=lg]) ::slotted(av-col[size_lg="4"]){width:33.3333333333%;display:inline-block}:host([max_width~=lg]) ::slotted(av-col[offset_lg="5"]){margin-left:41.6666666667%}:host([max_width~=lg]) ::slotted(av-col[offset_right_lg="5"]){margin-right:41.6666666667%}:host([max_width~=lg]) ::slotted(av-col[size_lg="5"]){width:41.6666666667%;display:inline-block}:host([max_width~=lg]) ::slotted(av-col[offset_lg="6"]){margin-left:50%}:host([max_width~=lg]) ::slotted(av-col[offset_right_lg="6"]){margin-right:50%}:host([max_width~=lg]) ::slotted(av-col[size_lg="6"]){width:50%;display:inline-block}:host([max_width~=lg]) ::slotted(av-col[offset_lg="7"]){margin-left:58.3333333333%}:host([max_width~=lg]) ::slotted(av-col[offset_right_lg="7"]){margin-right:58.3333333333%}:host([max_width~=lg]) ::slotted(av-col[size_lg="7"]){width:58.3333333333%;display:inline-block}:host([max_width~=lg]) ::slotted(av-col[offset_lg="8"]){margin-left:66.6666666667%}:host([max_width~=lg]) ::slotted(av-col[offset_right_lg="8"]){margin-right:66.6666666667%}:host([max_width~=lg]) ::slotted(av-col[size_lg="8"]){width:66.6666666667%;display:inline-block}:host([max_width~=lg]) ::slotted(av-col[offset_lg="9"]){margin-left:75%}:host([max_width~=lg]) ::slotted(av-col[offset_right_lg="9"]){margin-right:75%}:host([max_width~=lg]) ::slotted(av-col[size_lg="9"]){width:75%;display:inline-block}:host([max_width~=lg]) ::slotted(av-col[offset_lg="10"]){margin-left:83.3333333333%}:host([max_width~=lg]) ::slotted(av-col[offset_right_lg="10"]){margin-right:83.3333333333%}:host([max_width~=lg]) ::slotted(av-col[size_lg="10"]){width:83.3333333333%;display:inline-block}:host([max_width~=lg]) ::slotted(av-col[offset_lg="11"]){margin-left:91.6666666667%}:host([max_width~=lg]) ::slotted(av-col[offset_right_lg="11"]){margin-right:91.6666666667%}:host([max_width~=lg]) ::slotted(av-col[size_lg="11"]){width:91.6666666667%;display:inline-block}:host([max_width~=lg]) ::slotted(av-col[offset_lg="12"]){margin-left:100%}:host([max_width~=lg]) ::slotted(av-col[offset_right_lg="12"]){margin-right:100%}:host([max_width~=lg]) ::slotted(av-col[size_lg="12"]){width:100%;display:inline-block}:host([max_width~=xl]) ::slotted(av-col[offset_xl="0"]){margin-left:0%}:host([max_width~=xl]) ::slotted(av-col[offset_right_xl="0"]){margin-right:0%}:host([max_width~=xl]) ::slotted(av-col[size_xl="0"]){width:0%;display:inline-block}:host([max_width~=xl]) ::slotted(av-col[offset_xl="1"]){margin-left:8.3333333333%}:host([max_width~=xl]) ::slotted(av-col[offset_right_xl="1"]){margin-right:8.3333333333%}:host([max_width~=xl]) ::slotted(av-col[size_xl="1"]){width:8.3333333333%;display:inline-block}:host([max_width~=xl]) ::slotted(av-col[offset_xl="2"]){margin-left:16.6666666667%}:host([max_width~=xl]) ::slotted(av-col[offset_right_xl="2"]){margin-right:16.6666666667%}:host([max_width~=xl]) ::slotted(av-col[size_xl="2"]){width:16.6666666667%;display:inline-block}:host([max_width~=xl]) ::slotted(av-col[offset_xl="3"]){margin-left:25%}:host([max_width~=xl]) ::slotted(av-col[offset_right_xl="3"]){margin-right:25%}:host([max_width~=xl]) ::slotted(av-col[size_xl="3"]){width:25%;display:inline-block}:host([max_width~=xl]) ::slotted(av-col[offset_xl="4"]){margin-left:33.3333333333%}:host([max_width~=xl]) ::slotted(av-col[offset_right_xl="4"]){margin-right:33.3333333333%}:host([max_width~=xl]) ::slotted(av-col[size_xl="4"]){width:33.3333333333%;display:inline-block}:host([max_width~=xl]) ::slotted(av-col[offset_xl="5"]){margin-left:41.6666666667%}:host([max_width~=xl]) ::slotted(av-col[offset_right_xl="5"]){margin-right:41.6666666667%}:host([max_width~=xl]) ::slotted(av-col[size_xl="5"]){width:41.6666666667%;display:inline-block}:host([max_width~=xl]) ::slotted(av-col[offset_xl="6"]){margin-left:50%}:host([max_width~=xl]) ::slotted(av-col[offset_right_xl="6"]){margin-right:50%}:host([max_width~=xl]) ::slotted(av-col[size_xl="6"]){width:50%;display:inline-block}:host([max_width~=xl]) ::slotted(av-col[offset_xl="7"]){margin-left:58.3333333333%}:host([max_width~=xl]) ::slotted(av-col[offset_right_xl="7"]){margin-right:58.3333333333%}:host([max_width~=xl]) ::slotted(av-col[size_xl="7"]){width:58.3333333333%;display:inline-block}:host([max_width~=xl]) ::slotted(av-col[offset_xl="8"]){margin-left:66.6666666667%}:host([max_width~=xl]) ::slotted(av-col[offset_right_xl="8"]){margin-right:66.6666666667%}:host([max_width~=xl]) ::slotted(av-col[size_xl="8"]){width:66.6666666667%;display:inline-block}:host([max_width~=xl]) ::slotted(av-col[offset_xl="9"]){margin-left:75%}:host([max_width~=xl]) ::slotted(av-col[offset_right_xl="9"]){margin-right:75%}:host([max_width~=xl]) ::slotted(av-col[size_xl="9"]){width:75%;display:inline-block}:host([max_width~=xl]) ::slotted(av-col[offset_xl="10"]){margin-left:83.3333333333%}:host([max_width~=xl]) ::slotted(av-col[offset_right_xl="10"]){margin-right:83.3333333333%}:host([max_width~=xl]) ::slotted(av-col[size_xl="10"]){width:83.3333333333%;display:inline-block}:host([max_width~=xl]) ::slotted(av-col[offset_xl="11"]){margin-left:91.6666666667%}:host([max_width~=xl]) ::slotted(av-col[offset_right_xl="11"]){margin-right:91.6666666667%}:host([max_width~=xl]) ::slotted(av-col[size_xl="11"]){width:91.6666666667%;display:inline-block}:host([max_width~=xl]) ::slotted(av-col[offset_xl="12"]){margin-left:100%}:host([max_width~=xl]) ::slotted(av-col[offset_right_xl="12"]){margin-right:100%}:host([max_width~=xl]) ::slotted(av-col[size_xl="12"]){width:100%;display:inline-block}`);
        return arrStyle;
    }
    __getHtml() {
        let parentInfo = super.__getHtml();
        let info = {
            html: `<slot></slot>`,
            slots: {
                'default':`<slot></slot>`
            },
            blocks: {
                'default':`<slot></slot>`
            }
        }
        return info;
    }
    __getMaxId() {
        let temp = super.__getMaxId();
        temp.push(["AvRow", 0])
        return temp;
    }
    getClassName() {
        return "AvRow";
    }
     _calculateWidth(){var size = this.offsetWidth;var labels = [];for (var key in this.sizes) {    var value = this.sizes[key];    if (size > value) {        labels.push(key);    }    else {        break;    }}this.max_width = labels.join(" ");} postCreation(){this._calculateWidth();new ResizeObserver(entries => {    this._calculateWidth();}).observe(this);}}
window.customElements.define('av-row', AvRow);
class AvCol extends WebComponent {
    get 'size'() {
                        return Number(this.getAttribute('size'));
                    }
                    set 'size'(val) {
                        this.setAttribute('size',val);
                    }get 'size_xs'() {
                        return Number(this.getAttribute('size_xs'));
                    }
                    set 'size_xs'(val) {
                        this.setAttribute('size_xs',val);
                    }get 'size_sm'() {
                        return Number(this.getAttribute('size_sm'));
                    }
                    set 'size_sm'(val) {
                        this.setAttribute('size_sm',val);
                    }get 'size_md'() {
                        return Number(this.getAttribute('size_md'));
                    }
                    set 'size_md'(val) {
                        this.setAttribute('size_md',val);
                    }get 'size_lg'() {
                        return Number(this.getAttribute('size_lg'));
                    }
                    set 'size_lg'(val) {
                        this.setAttribute('size_lg',val);
                    }get 'size_xl'() {
                        return Number(this.getAttribute('size_xl'));
                    }
                    set 'size_xl'(val) {
                        this.setAttribute('size_xl',val);
                    }get 'offset'() {
                        return Number(this.getAttribute('offset'));
                    }
                    set 'offset'(val) {
                        this.setAttribute('offset',val);
                    }get 'offset_xs'() {
                        return Number(this.getAttribute('offset_xs'));
                    }
                    set 'offset_xs'(val) {
                        this.setAttribute('offset_xs',val);
                    }get 'offset_sm'() {
                        return Number(this.getAttribute('offset_sm'));
                    }
                    set 'offset_sm'(val) {
                        this.setAttribute('offset_sm',val);
                    }get 'offset_md'() {
                        return Number(this.getAttribute('offset_md'));
                    }
                    set 'offset_md'(val) {
                        this.setAttribute('offset_md',val);
                    }get 'offset_lg'() {
                        return Number(this.getAttribute('offset_lg'));
                    }
                    set 'offset_lg'(val) {
                        this.setAttribute('offset_lg',val);
                    }get 'offset_xl'() {
                        return Number(this.getAttribute('offset_xl'));
                    }
                    set 'offset_xl'(val) {
                        this.setAttribute('offset_xl',val);
                    }get 'offset_right'() {
                        return Number(this.getAttribute('offset_right'));
                    }
                    set 'offset_right'(val) {
                        this.setAttribute('offset_right',val);
                    }get 'offset_right_xs'() {
                        return Number(this.getAttribute('offset_right_xs'));
                    }
                    set 'offset_right_xs'(val) {
                        this.setAttribute('offset_right_xs',val);
                    }get 'offset_right_sm'() {
                        return Number(this.getAttribute('offset_right_sm'));
                    }
                    set 'offset_right_sm'(val) {
                        this.setAttribute('offset_right_sm',val);
                    }get 'offset_right_md'() {
                        return Number(this.getAttribute('offset_right_md'));
                    }
                    set 'offset_right_md'(val) {
                        this.setAttribute('offset_right_md',val);
                    }get 'offset_right_lg'() {
                        return Number(this.getAttribute('offset_right_lg'));
                    }
                    set 'offset_right_lg'(val) {
                        this.setAttribute('offset_right_lg',val);
                    }get 'offset_right_xl'() {
                        return Number(this.getAttribute('offset_right_xl'));
                    }
                    set 'offset_right_xl'(val) {
                        this.setAttribute('offset_right_xl',val);
                    }get 'nobreak'() {
                        return this.hasAttribute('nobreak');
                    }
                    set 'nobreak'(val) {
                        if(val === 1 || val === 'true' || val === ''){
                            val = true;
                        }
                        else if(val === 0 || val === 'false' || val === null || val === undefined){
                            val = false;
                        }
                        if(val !== false && val !== true){
                            console.error("error setting boolean in nobreak");
                            val = false;
                        }
                        if (val) {
                            this.setAttribute('nobreak', 'true');
                        } else{
                            this.removeAttribute('nobreak');
                        }
                    }get 'center'() {
                        return this.hasAttribute('center');
                    }
                    set 'center'(val) {
                        if(val === 1 || val === 'true' || val === ''){
                            val = true;
                        }
                        else if(val === 0 || val === 'false' || val === null || val === undefined){
                            val = false;
                        }
                        if(val !== false && val !== true){
                            console.error("error setting boolean in center");
                            val = false;
                        }
                        if (val) {
                            this.setAttribute('center', 'true');
                        } else{
                            this.removeAttribute('center');
                        }
                    }    __getStyle() {
        let arrStyle = super.__getStyle();
        arrStyle.push(`:host{display:flex;padding:0 10px;width:100%;margin-left:0;margin-right:0;font-size:16px}:host([nobreak]){white-space:nowrap;text-overflow:ellipsis;overflow:hidden}:host([center]){text-align:center}:host([size="1"]){width:8.3333333333%;display:inline-block}:host([offset="1"]){margin-left:8.3333333333%}:host([offset-right="1"]){margin-right:8.3333333333%}:host([size="2"]){width:16.6666666667%;display:inline-block}:host([offset="2"]){margin-left:16.6666666667%}:host([offset-right="2"]){margin-right:16.6666666667%}:host([size="3"]){width:25%;display:inline-block}:host([offset="3"]){margin-left:25%}:host([offset-right="3"]){margin-right:25%}:host([size="4"]){width:33.3333333333%;display:inline-block}:host([offset="4"]){margin-left:33.3333333333%}:host([offset-right="4"]){margin-right:33.3333333333%}:host([size="5"]){width:41.6666666667%;display:inline-block}:host([offset="5"]){margin-left:41.6666666667%}:host([offset-right="5"]){margin-right:41.6666666667%}:host([size="6"]){width:50%;display:inline-block}:host([offset="6"]){margin-left:50%}:host([offset-right="6"]){margin-right:50%}:host([size="7"]){width:58.3333333333%;display:inline-block}:host([offset="7"]){margin-left:58.3333333333%}:host([offset-right="7"]){margin-right:58.3333333333%}:host([size="8"]){width:66.6666666667%;display:inline-block}:host([offset="8"]){margin-left:66.6666666667%}:host([offset-right="8"]){margin-right:66.6666666667%}:host([size="9"]){width:75%;display:inline-block}:host([offset="9"]){margin-left:75%}:host([offset-right="9"]){margin-right:75%}:host([size="10"]){width:83.3333333333%;display:inline-block}:host([offset="10"]){margin-left:83.3333333333%}:host([offset-right="10"]){margin-right:83.3333333333%}:host([size="11"]){width:91.6666666667%;display:inline-block}:host([offset="11"]){margin-left:91.6666666667%}:host([offset-right="11"]){margin-right:91.6666666667%}:host([size="12"]){width:100%;display:inline-block}:host([offset="12"]){margin-left:100%}:host([offset-right="12"]){margin-right:100%}`);
        return arrStyle;
    }
    __getHtml() {
        let parentInfo = super.__getHtml();
        let info = {
            html: `<slot></slot>`,
            slots: {
                'default':`<slot></slot>`
            },
            blocks: {
                'default':`<slot></slot>`
            }
        }
        return info;
    }
    __getMaxId() {
        let temp = super.__getMaxId();
        temp.push(["AvCol", 0])
        return temp;
    }
    getClassName() {
        return "AvCol";
    }
    __defaultValue() { super.__defaultValue(); if(!this.hasAttribute('nobreak')) { this.attributeChangedCallback('nobreak', false, false); }if(!this.hasAttribute('center')) { this.attributeChangedCallback('center', false, false); } }
    __listBoolProps() { return ["nobreak","center"].concat(super.__listBoolProps()).filter((v, i, a) => a.indexOf(v) === i); }
     postCreation(){}}
window.customElements.define('av-col', AvCol);
class AvCode extends WebComponent {
    static get observedAttributes() {return ["language"].concat(super.observedAttributes).filter((v, i, a) => a.indexOf(v) === i);}
    static primsCSS = "";static isLoading = false;static waitingLoad = [];    get 'language'() {
                        return this.getAttribute('language');
                    }
                    set 'language'(val) {
                        this.setAttribute('language',val);
                    }    __getStyle() {
        let arrStyle = super.__getStyle();
        arrStyle.push(`:host{display:flex}:host pre{border-radius:5px;width:100%}:host .hided{display:none}`);
        return arrStyle;
    }
    __getHtml() {
        let parentInfo = super.__getHtml();
        let info = {
            html: `<pre>    <code _id="avcode_0">
    </code>
</pre>
<div class="hided">
    <slot></slot>
</div>`,
            slots: {
                'default':`<slot></slot>`
            },
            blocks: {
                'default':`<pre>    <code _id="avcode_0">
    </code>
</pre>
<div class="hided">
    <slot></slot>
</div>`
            }
        }
        return info;
    }
    __getMaxId() {
        let temp = super.__getMaxId();
        temp.push(["AvCode", 1])
        return temp;
    }
    __mapSelectedElement() { super.__mapSelectedElement(); this.codeEl = this.shadowRoot.querySelector('[_id="avcode_0"]');}
    __registerOnChange() { super.__registerOnChange(); this.__onChangeFct['language'] = []this.__onChangeFct['language'].push((path) => {((target) => {    if (window.Prism) {        if (!window.Prism.languages.hasOwnProperty(target.language)) {            target.language = 'plain';        }    }})(this);if("language".startsWith(path)){
										for(var i = 0;i<this._components['avcode_0'].length;i++){
											this._components['avcode_0'][i].setAttribute("class", "language-"+this.language+"");
										}
									}}) }
    getClassName() {
        return "AvCode";
    }
    __defaultValue() { super.__defaultValue(); if(!this.hasAttribute('language')){ this['language'] = 'plain'; } }
    __upgradeAttributes() { super.__upgradeAttributes(); this.__upgradeProperty('language'); }
    static async  loadScript(src){return new Promise((resolve, reject) => {    let script = document.createElement('script');    script.setAttribute('src', src);    document.head.appendChild(script);    script.addEventListener("load", () => {        resolve();    });    script.addEventListener("error", (ev) => {        reject();    });});}static async  loadingPrism(){if (!AvCode.isLoading) {    AvCode.isLoading = true;    await AvCode.loadScript("/libs/prism.js");    await AvCode.loadScript("/libs/prism-normalize-whitespace.min.js");    AvCode.primsCSS = await(await fetch("/libs/prism_vscode_theme.css")).text();    AvCode.releaseAwaitFct();    AvCode.isLoading = false;}else {    await AvCode.awaitFct();}}static  releaseAwaitFct(){for (let waiting of AvCode.waitingLoad) {    waiting();}AvCode.waitingLoad = [];}static  awaitFct(){return new Promise((resolve) => {    AvCode.waitingLoad.push(() => {        resolve('');    });});}async  loadFiles(){await AvCode.loadingPrism();this.init();} init(){if (!window.Prism.languages.hasOwnProperty(this.language)) {    this.language = 'plain';}this.codeEl.innerHTML = this.innerHTML.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;");this.innerHTML = "";let style = this.shadowRoot.querySelector("style");style.innerHTML = style.innerHTML.trim() + AvCode.primsCSS;window.Prism.highlightElement(this.codeEl);} postCreation(){if (!window.Prism) {    this.loadFiles();}else {    this.init();}}}
window.customElements.define('av-code', AvCode);
class AvImg extends WebComponent {
    static get observedAttributes() {return ["src", "mode"].concat(super.observedAttributes).filter((v, i, a) => a.indexOf(v) === i);}
    get 'src'() {
                        return this.getAttribute('src');
                    }
                    set 'src'(val) {
                        this.setAttribute('src',val);
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
                        this.setAttribute('mode',val);
                    }    __prepareVariables() { super.__prepareVariables(); if(this.bigImg === undefined) {this.bigImg = "undefined";}if(this.ratio === undefined) {this.ratio = 1;}if(this._maxCalculateSize === undefined) {this._maxCalculateSize = 10;}if(this._isCalculing === undefined) {this._isCalculing = false;}if(this.checkClose === undefined) {this.checkClose = "(e:Event) => {\r\n        if(e instanceof KeyboardEvent) {\r\n            if(e.key == 'Escape') {\r\n                this.close();\r\n            }\r\n        }\r\n        else {\r\n            let realTargetEl = e.realTarget();\r\n            if(realTargetEl != this.bigImg) {\r\n                this.close();\r\n            }\r\n        }\r\n\r\n    }";} }
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
    getClassName() {
        return "AvImg";
    }
    __defaultValue() { super.__defaultValue(); if(!this.hasAttribute('display_bigger')) { this.attributeChangedCallback('display_bigger', false, false); }if(!this.hasAttribute('mode')){ this['mode'] = 'contains'; } }
    __upgradeAttributes() { super.__upgradeAttributes(); this.__upgradeProperty('src');this.__upgradeProperty('mode'); }
    __listBoolProps() { return ["display_bigger"].concat(super.__listBoolProps()).filter((v, i, a) => a.indexOf(v) === i); }
     close(){this.bigImg.style.opacity = '0';document.body.removeEventListener('click', this.checkClose);setTimeout(() => {    this.bigImg.remove();}, 710);} calculateSize(attempt){if (this._isCalculing) {    return;}if (this.src == "") {    return;}this._isCalculing = true;if (getComputedStyle(this).display == 'none') {    return;}if (attempt == this._maxCalculateSize) {    this._isCalculing = false;    return;}let element = this.imgEl;if (this.src.endsWith(".svg")) {    element = this.svgEl;}this.style.width = '';this.style.height = '';element.style.width = '';element.style.height = '';if (element.offsetWidth == 0 && element.offsetHeight == 0) {    setTimeout(() => {        this._isCalculing = false;        this.calculateSize(attempt + 1);    }, 100);    return;}let style = getComputedStyle(this);let addedY = Number(style.paddingTop.replace("px", "")) + Number(style.paddingBottom.replace("px", "")) + Number(style.borderTopWidth.replace("px", "")) + Number(style.borderBottomWidth.replace("px", ""));let addedX = Number(style.paddingLeft.replace("px", "")) + Number(style.paddingRight.replace("px", "")) + Number(style.borderLeftWidth.replace("px", "")) + Number(style.borderRightWidth.replace("px", ""));let availableHeight = this.offsetHeight - addedY;let availableWidth = this.offsetWidth - addedX;let sameWidth = (element.offsetWidth == availableWidth);let sameHeight = (element.offsetHeight == availableHeight);this.ratio = element.offsetWidth / element.offsetHeight;if (sameWidth && !sameHeight) {    element.style.width = (availableHeight * this.ratio) + 'px';    element.style.height = availableHeight + 'px';}else if (!sameWidth && sameHeight) {    element.style.width = availableWidth + 'px';    element.style.height = (availableWidth / this.ratio) + 'px';}else if (!sameWidth && !sameHeight) {    if (this.mode == "stretch") {        element.style.width = '100%';        element.style.height = '100%';    }    else if (this.mode == "contains") {        let newWidth = (availableHeight * this.ratio);        if (newWidth <= availableWidth) {            element.style.width = newWidth + 'px';            element.style.height = availableHeight + 'px';        }        else {            element.style.width = availableWidth + 'px';            element.style.height = (availableWidth / this.ratio) + 'px';        }    }    else if (this.mode == "cover") {        let newWidth = (availableHeight * this.ratio);        if (newWidth >= availableWidth) {            element.style.width = newWidth + 'px';            element.style.height = availableHeight + 'px';        }        else {            element.style.width = availableWidth + 'px';            element.style.height = (availableWidth / this.ratio) + 'px';        }    }}let diffTop = (this.offsetHeight - element.offsetHeight - addedY) / 2;let diffLeft = (this.offsetWidth - element.offsetWidth - addedX) / 2;element.style.transform = "translate(" + diffLeft + "px, " + diffTop + "px)";element.style.opacity = '1';this._isCalculing = false;} showImg(e){if (this.display_bigger) {    let target = e.currentTarget;    let position = target.getPositionOnScreen();    let div = new HTMLDivElement();    div.style.position = 'absolute';    div.style.top = position.y + 'px';    div.style.left = position.x + 'px';    div.style.width = target.offsetWidth + 'px';    div.style.height = target.offsetHeight + 'px';    div.style.backgroundImage = 'url(' + this.src + ')';    div.style.backgroundSize = 'contain';    div.style.backgroundRepeat = 'no-repeat';    div.style.zIndex = '502';    div.style.transition = 'all 0.7s cubic-bezier(0.65, 0, 0.15, 1)';    div.style.backgroundPosition = 'center';    div.style.backgroundColor = 'black';    this.bigImg = div;    document.body.appendChild(div);    setTimeout(() => {        div.style.top = '50px';        div.style.left = '50px';        div.style.width = 'calc(100% - 100px)';        div.style.height = 'calc(100% - 100px)';        document.body.addEventListener('click', this.checkClose);        document.body.addEventListener('keydown', this.checkClose);    }, 100);}} postCreation(){this.addEventListener("click", (e) => { this.showImg(e); });new ResizeObserver(() => {    this.calculateSize();}).observe(this);}}
window.customElements.define('av-img', AvImg);
class AvButton extends WebComponent {
    __getStyle() {
        let arrStyle = super.__getStyle();
        arrStyle.push(`:host{background-color:var(--primary-color);color:var(--secondary-color);border-radius:900px;padding:10px 30px;cursor:pointer;box-shadow:0 0 2px var(--darker);transition:filter .4s var(--bezier-curve)}:host(:hover){filter:brightness(0.9)}`);
        return arrStyle;
    }
    __getHtml() {
        let parentInfo = super.__getHtml();
        let info = {
            html: `<slot></slot>`,
            slots: {
                'default':`<slot></slot>`
            },
            blocks: {
                'default':`<slot></slot>`
            }
        }
        return info;
    }
    __getMaxId() {
        let temp = super.__getMaxId();
        temp.push(["AvButton", 0])
        return temp;
    }
    getClassName() {
        return "AvButton";
    }
}
window.customElements.define('av-button', AvButton);
class AvApi extends AvGenericPage {
    __getStyle() {
        let arrStyle = super.__getStyle();
        arrStyle.push(``);
        return arrStyle;
    }
    __getHtml() {
        let parentInfo = super.__getHtml();
        let info = {
            html: `<section>
    <h1>API</h1>
    <p>In the part you can find informations about all parts</p>
    <ul>
        <li>Configuration</li>
        <li>WebComponent</li>
        <li>Data</li>
        <li>RAM</li>
        <li>WebScoket</li>
    </ul>
</section>`,
            slots: {
            },
            blocks: {
                'default':`<section>
    <h1>API</h1>
    <p>In the part you can find informations about all parts</p>
    <ul>
        <li>Configuration</li>
        <li>WebComponent</li>
        <li>Data</li>
        <li>RAM</li>
        <li>WebScoket</li>
    </ul>
</section>`
            }
        }
                let newHtml = parentInfo.html
                for (let blockName in info.blocks) {
                    if (!parentInfo.slots.hasOwnProperty(blockName)) {
                        throw "can't found slot with name " + blockName;
                    }
                    newHtml = newHtml.replace(parentInfo.slots[blockName], info.blocks[blockName]);
                }
                info.html = newHtml;
        return info;
    }
    __getMaxId() {
        let temp = super.__getMaxId();
        temp.push(["AvApi", 0])
        return temp;
    }
    getClassName() {
        return "AvApi";
    }
     defineTitle(){return 'Aventus - API';}}
window.customElements.define('av-api', AvApi);