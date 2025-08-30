//=============================================================================
// Diary of a Caravaneer - Dynamic Market System
// DoaC_DynamicMarket.js
//=============================================================================

/*:
 * @plugindesc [v1.1] Manages dynamic item prices based on supply, demand, and other factors.
 * @author TakaVII & Copilot
 *
 * @param ---General---
 * @default
 *
 * @param Price Update Variable ID
 * @parent ---General---
 * @type variable
 * @desc The ID of the game variable used to trigger market price updates. When this variable changes, prices are recalculated.
 * @default 1
 *
 * @param Base Price Formula
 * @parent ---General---
 * @desc The base formula to calculate the final price.
 * Default: base * supply * demand * random * location * event
 * @default base * supply * demand * random * location * event
 *
 * @param ---UI Display---
 * @default
 *
 * @param Show Price Fluctuation
 * @parent ---UI Display---
 * @type boolean
 * @on Show
 * @off Hide
 * @desc Show the percentage difference from the base price in the shop?
 * @default true
 *
 * @param Fluctuation Format
 * @parent ---UI Display---
 * @desc The format used to display the price fluctuation. %1 is the value.
 * @default (%1)
 *
 * @param Price Rise Color
 * @parent ---UI Display---
 * @type number
 * @min 0
 * @max 31
 * @desc The text color used when the price is higher than the base price. (Uses window.png colors)
 * @default 17
 *
 * @param Price Drop Color
 * @parent ---UI Display---
 * @type number
 * @min 0
 * @max 31
 * @desc The text color used when the price is lower than the base price. (Uses window.png colors)
 * @default 24
 *
 * @help
 * ============================================================================
 * Introduction
 * ============================================================================
 *
 * This plugin creates a dynamic market system for Diary of a Caravaneer. It
 * allows item prices in shops to fluctuate based on various economic factors,
 * such as supply, demand, location-specific modifiers, and game events.
 *
 * This system is designed to be modular and expandable, allowing you to create
 * a believable and engaging economy for the player to interact with.
 *
 * ============================================================================
 * How to Use
 * ============================================================================
 *
 * 1. Setup the Plugin Parameters:
 *    - Price Update Variable ID: Choose a game variable. When you want to
 *      update all market prices (e.g., at the start of a new day), simply
 *      change this variable's value in an event.
 *    - Other parameters control the UI and base formula. The defaults are
 *      generally fine to start with.
 *
 * 2. Item Notetags:
 *    Use these notetags in the notebox of items in the database to define
 *    their economic properties.
 *
 *    <Supply Variable: x>
 *    - The ID of the game variable that stores the current supply for this item.
 *
 *    <Demand Variable: x>
 *    - The ID of the game variable that stores the current demand for this item.
 *
 *    <Supply Elasticity: y>
 *    - A multiplier that determines how much supply affects the price.
 *    - Example: <Supply Elasticity: 0.5>
 *    - Formula: 1.0 - (currentSupply - 100) / 100 * elasticity
 *
 *    <Demand Elasticity: y>
 *    - A multiplier that determines how much demand affects the price.
 *    - Example: <Demand Elasticity: 1.2>
 *    - Formula: 1.0 + (currentDemand - 100) / 100 * elasticity
 *
 * 3. Map Notetags (for locations):
 *    Use these notetags in the notebox of a map to define its properties.
 *    All shops on this map will inherit these properties.
 *
 *    <Location ID: x>
 *    - A unique ID for this location (e.g., 1 for the starting town). This is
 *      used to manage location-specific data.
 *
 *    <Location Modifier: y>
 *    - A general price modifier for everything in this location.
 *    - Example: <Location Modifier: 1.1> (10% higher prices here)
 *
 *    <Item [item_id] Supply: +/-z>
 *    - Modifies the supply for a specific item at this location.
 *    - Example: <Item 5 Supply: +20> (This town has 20 more supply of item 5)
 *
 *    <Item [item_id] Demand: +/-z>
 *    - Modifies the demand for a specific item at this location.
 *    - Example: <Item 5 Demand: -15> (This town has 15 less demand for item 5)
 *
 * ============================================================================
 * How It Works
 * ============================================================================
 *
 * The final price of an item is calculated based on the formula in the plugin
 * parameters. Each component of the formula is calculated as follows:
 *
 * - base: The item's default price from the database.
 * - supply: Calculated using the item's supply variable and elasticity.
 *   A supply > 100 lowers the price, < 100 raises it.
 * - demand: Calculated using the item's demand variable and elasticity.
 *   A demand > 100 raises the price, < 100 lowers it.
 * - random: A small random fluctuation to make the market feel less static.
 * - location: The <Location Modifier: y> from the map notetag.
 * - event: A global event modifier (can be changed via plugin command).
 *
 * The system is designed to be called manually via the update variable. This
 * gives you full control over when the economy updates, for example, at the
 * beginning of each day, after a major story event, etc.
 *
 * ============================================================================
 * Changelog
 * ============================================================================
 *
 * v1.1:
 * - Fixed a crash on new game start caused by trying to access map data
 *   before a map is loaded. The price calculation is now safer and handles
 *   cases where `$gameMap` is not yet available.
 *
 */

var Imported = Imported || {};
Imported.DoaC_DynamicMarket = true;

var DoaC = DoaC || {};
DoaC.DynamicMarket = DoaC.DynamicMarket || {};

(function() {

    //=============================================================================
    // Parameter Management
    //=============================================================================
    var parameters = PluginManager.parameters('DoaC_DynamicMarket');
    DoaC.DynamicMarket.priceUpdateVarId = Number(parameters['Price Update Variable ID'] || 1);
    DoaC.DynamicMarket.basePriceFormula = String(parameters['Base Price Formula'] || 'base * supply * demand * random * location * event');
    DoaC.DynamicMarket.showFluctuation = eval(String(parameters['Show Price Fluctuation']));
    DoaC.DynamicMarket.fluctuationFormat = String(parameters['Fluctuation Format'] || '(%1)');
    DoaC.DynamicMarket.priceRiseColor = Number(parameters['Price Rise Color'] || 17);
    DoaC.DynamicMarket.priceDropColor = Number(parameters['Price Drop Color'] || 24);

    //=============================================================================
    // DynamicMarketManager
    //
    // Static class that manages all market data and calculations.
    //=============================================================================
    function DynamicMarketManager() {
        throw new Error('This is a static class');
    }

    DynamicMarketManager._marketData = {};
    DynamicMarketManager._eventModifier = 1.0;
    DynamicMarketManager._lastUpdateValue = null;

    /**
     * @static
     * @method initialize
     * @description Initializes the market data for all items. Should be called once on game load.
     */
    DynamicMarketManager.initialize = function() {
        this._lastUpdateValue = $gameVariables.value(DoaC.DynamicMarket.priceUpdateVarId);
        this.updateAllMarketPrices();
    };

    /**
     * @static
     * @method update
     * @description Checks if the update variable has changed and triggers a market update.
     */
    DynamicMarketManager.update = function() {
        if ($gameVariables.value(DoaC.DynamicMarket.priceUpdateVarId) !== this._lastUpdateValue) {
            this._lastUpdateValue = $gameVariables.value(DoaC.DynamicMarket.priceUpdateVarId);
            console.log('Diary of a Caravaneer: Market prices are being updated.');
            this.updateAllMarketPrices();
        }
    };

    /**
     * @static
     * @method updateAllMarketPrices
     * @description Recalculates the price for every item in the game.
     */
    DynamicMarketManager.updateAllMarketPrices = function() {
        this._marketData = {};
        for (var i = 1; i < $dataItems.length; i++) {
            var item = $dataItems[i];
            if (item && item.name) {
                this.calculatePrice(item);
            }
        }
    };

    /**
     * @static
     * @method getPrice
     * @param {Object} item The item object from the database.
     * @returns {number} The calculated dynamic price of the item.
     */
    DynamicMarketManager.getPrice = function(item) {
        if (!item) return 0;
        // Always recalculate price when in a shop scene to ensure location data is current.
        if (SceneManager._scene instanceof Scene_Shop) {
             return this.calculatePrice(item);
        }
        if (this._marketData[item.id]) {
            return this._marketData[item.id];
        }
        return this.calculatePrice(item);
    };

    /**
     * @static
     * @method calculatePrice
     * @param {Object} item The item object from the database.
     * @returns {number} The newly calculated price.
     */
    DynamicMarketManager.calculatePrice = function(item) {
        var base = item.price;
        if (base === 0) return 0;

        var supplyVarId = Number(item.meta['Supply Variable'] || 0);
        var demandVarId = Number(item.meta['Demand Variable'] || 0);
        var supplyElasticity = parseFloat(item.meta['Supply Elasticity'] || 0.5);
        var demandElasticity = parseFloat(item.meta['Demand Elasticity'] || 0.5);

        var currentSupply = supplyVarId > 0 ? $gameVariables.value(supplyVarId) : 100;
        var currentDemand = demandVarId > 0 ? $gameVariables.value(demandVarId) : 100;

        // --- FIX START ---
        // Location specific modifiers
        var locationSupplyMod = 0;
        var locationDemandMod = 0;
        var location = 1.0;

        // Check if $gameMap and its metadata exist before trying to access them.
        // This prevents crashes during initial game load.
        if ($gameMap && $gameMap.meta) {
            if ($gameMap.meta['Item ' + item.id + ' Supply']) {
                locationSupplyMod = Number($gameMap.meta['Item ' + item.id + ' Supply']);
            }
            if ($gameMap.meta['Item ' + item.id + ' Demand']) {
                locationDemandMod = Number($gameMap.meta['Item ' + item.id + ' Demand']);
            }
            location = parseFloat($gameMap.meta['Location Modifier'] || 1.0);
        }
        // --- FIX END ---

        currentSupply += locationSupplyMod;
        currentDemand += locationDemandMod;

        var supply = 1.0 - ((currentSupply - 100) / 100.0) * supplyElasticity;
        var demand = 1.0 + ((currentDemand - 100) / 100.0) * demandElasticity;
        
        // Ensure factors don't drop below a certain threshold to avoid negative prices
        supply = Math.max(0.1, supply);
        demand = Math.max(0.1, demand);

        var random = 1.0 + (Math.random() * 0.1 - 0.05); // +/- 5% random fluctuation
        var event = this._eventModifier;

        var formula = DoaC.DynamicMarket.basePriceFormula;
        var finalPrice = eval(formula);
        finalPrice = Math.max(1, Math.round(finalPrice));

        this._marketData[item.id] = finalPrice;
        return finalPrice;
    };

    /**
     * @static
     * @method setEventModifier
     * @param {number} value The new global event modifier.
     */
    DynamicMarketManager.setEventModifier = function(value) {
        this._eventModifier = value;
        this.updateAllMarketPrices(); // Recalculate prices when modifier changes
    };

    window.DynamicMarketManager = DynamicMarketManager;

    //=============================================================================
    // DataManager
    //=============================================================================
    var _DataManager_createGameObjects = DataManager.createGameObjects;
    DataManager.createGameObjects = function() {
        _DataManager_createGameObjects.call(this);
        DynamicMarketManager.initialize();
    };

    var _DataManager_makeSaveContents = DataManager.makeSaveContents;
    DataManager.makeSaveContents = function() {
        var contents = _DataManager_makeSaveContents.call(this);
        contents.marketData = DynamicMarketManager._marketData;
        contents.eventModifier = DynamicMarketManager._eventModifier;
        return contents;
    };

    var _DataManager_extractSaveContents = DataManager.extractSaveContents;
    DataManager.extractSaveContents = function(contents) {
        _DataManager_extractSaveContents.call(this, contents);
        DynamicMarketManager._marketData = contents.marketData || {};
        DynamicMarketManager._eventModifier = contents.eventModifier || 1.0;
        DynamicMarketManager._lastUpdateValue = $gameVariables.value(DoaC.DynamicMarket.priceUpdateVarId);
    };

    //=============================================================================
    // Game_Map
    //=============================================================================
    var _Game_Map_update = Game_Map.prototype.update;
    Game_Map.prototype.update = function(sceneActive) {
        _Game_Map_update.call(this, sceneActive);
        DynamicMarketManager.update();
    };

    //=============================================================================
    // Window_ShopBuy
    // Alias to integrate dynamic pricing and UI changes.
    //=============================================================================
    var _Window_ShopBuy_price = Window_ShopBuy.prototype.price;
    Window_ShopBuy.prototype.price = function(item) {
        if (item && !DataManager.isIndependent(item)) {
            return DynamicMarketManager.getPrice(item);
        }
        return _Window_ShopBuy_price.call(this, item);
    };

    var _Window_ShopBuy_drawItem = Window_ShopBuy.prototype.drawItem;
    Window_ShopBuy.prototype.drawItem = function(index) {
        _Window_ShopBuy_drawItem.call(this, index);

        if (!DoaC.DynamicMarket.showFluctuation) return;

        var item = this._data[index];
        if (!item) return;

        var currentPrice = this.price(item);
        var basePrice = item.price;

        if (basePrice <= 0 || currentPrice === basePrice) return;

        var fluctuation = Math.round(((currentPrice / basePrice) - 1) * 100);
        if (fluctuation === 0) return;

        var text = (fluctuation > 0 ? '+' : '') + fluctuation + '%';
        text = DoaC.DynamicMarket.fluctuationFormat.format(text);

        if (fluctuation > 0) {
            this.changeTextColor(this.textColor(DoaC.DynamicMarket.priceRiseColor));
        } else {
            this.changeTextColor(this.textColor(DoaC.DynamicMarket.priceDropColor));
        }

        var rect = this.itemRect(index);
        // Adjust the rect.y to draw the fluctuation text below the item name
        rect.y += this.lineHeight() / 2 - 8;
        this.drawText(text, rect.x, rect.y, rect.width, 'right');
        this.resetTextColor();
    };

    //=============================================================================
    // Window_ShopSell
    // Alias to ensure selling price is also dynamic.
    //=============================================================================
    var _Scene_Shop_sellingPrice = Scene_Shop.prototype.sellingPrice;
    Scene_Shop.prototype.sellingPrice = function() {
        if (!this._item) return 0;
        // Selling price is typically a fraction of the current market price.
        // Let's use the dynamic price / 2, which is the default engine behavior.
        var marketPrice = DynamicMarketManager.getPrice(this._item);
        return Math.floor(marketPrice / 2);
    };

})();