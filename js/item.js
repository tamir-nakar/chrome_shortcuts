
class Item {

    #displayName;
    #url;
    #alias;

    constructor(displayName, url, alias) {

        this.#displayName = displayName;
        this.#url = url;
        this.#alias = alias;
    }

    get displayName() {
        return this.#displayName;
    }
    get url() {
        return this.#url;
    }
    get alias() {
        return this.#alias;
    }


}

export default Item;