/// <reference path="../../../typings/tsd.d.ts" />
/// <reference path="../utils.ts" />
/// <reference path="../../common/models.ts" />
/// <reference path="nullgw.ts" />

import Config = require("../config");
import crypto = require('crypto');
import request = require('request');
import url = require("url");
import querystring = require("querystring");
import NullGateway = require("./nullgw");
import Models = require("../../common/models");
import Utils = require("../utils");
import Interfaces = require("../interfaces");
import moment = require("moment");
import util = require("util");
import Q = require("q");
var shortId = require("shortid");

class BtcEPublicApiClient {
    private _baseUrl: string;
    constructor(config: Config.IConfigProvider) {
        this._baseUrl = config.GetString("BtcEPublicAPIRestUrl") + "/";
    }

    public getFromEndpoint = <TResponse>(endpoint: string, params: any = null): Q.Promise<TResponse> => {
        var url = this._baseUrl + endpoint;

        var options: request.Options = {};
        if (params !== null)
            options.qs = params;

        var d = Q.defer<TResponse>();
        request.get(url, options, (err, resp, body) => {
            if (err) d.reject(err);
            else d.resolve(JSON.parse(body));
        });
        return d.promise;
    };
}

interface OrderBook {
    bids: [number, number][];
    asks: [number, number][];
}

interface MarketTrade {
    type: string;
    price: number;
    amount: number;
    tid: number;
    timestamp: number;
}

class BtcEMarketDataGateway implements Interfaces.IMarketDataGateway {
    MarketData = new Utils.Evt<Models.Market>();

    private static ConvertToMarketSide = (input: [number, number]) =>
        new Models.MarketSide(input[0], input[1]);

    private static ConvertToMarketSideList = (input: [number, number][]) =>
        input.map(BtcEMarketDataGateway.ConvertToMarketSide);

    private onRefreshMarketData = () => {
        this._client.getFromEndpoint("depth/" + this._pairKey, { limit: 5 }).then(p => {
            var orderBook: OrderBook = p[this._pairKey];
            var bids = BtcEMarketDataGateway.ConvertToMarketSideList(orderBook.bids);
            var asks = BtcEMarketDataGateway.ConvertToMarketSideList(orderBook.asks);
            var market = new Models.Market(bids, asks, moment.utc());
            this.MarketData.trigger(market);
        }).done();
    };

    MarketTrade = new Utils.Evt<Models.MarketSide>();

    private static ConvertToMarketTrade = (trd: MarketTrade): Models.GatewayMarketTrade =>
        new Models.GatewayMarketTrade(trd.price, trd.amount, moment.unix(trd.timestamp), false, null);

    private _seenMarketTradeIds: { [tid: number]: boolean } = {};
    private onRefreshMarketTrades = () => {
        this._client.getFromEndpoint("trades/" + this._pairKey, { limit: 5 }).then(p => {
            var tradesList: MarketTrade[] = p[this._pairKey];
            tradesList.forEach(t => {
                if (this._seenMarketTradeIds[t.tid] === true) return;
                this._seenMarketTradeIds[t.tid] = true;
                this.MarketTrade.trigger(BtcEMarketDataGateway.ConvertToMarketTrade(t));
            });
        });
    };

    ConnectChanged = new Utils.Evt<Models.ConnectivityStatus>();

    _log: Utils.Logger = Utils.log("tribeca:gateway:BtcEMD");
    constructor(
        private _pairKey: string,
        private _timeProvider: Utils.ITimeProvider,
        private _client: BtcEPublicApiClient) {
        _timeProvider.setInterval(this.onRefreshMarketData, moment.duration(2, "seconds"));
        _timeProvider.setInterval(this.onRefreshMarketData, moment.duration(2, "seconds"));

        _timeProvider.setImmediate(() => this.ConnectChanged.trigger(Models.ConnectivityStatus.Connected));
    }
}

interface Response<T> {
    success: number;
    return?: T;
    error?: string;
}

class BtcEAuthenticatedApiClient {
    private _baseUrl: string;
    private _key: string;
    private _secret: string;
    constructor(config: Config.IConfigProvider) {
        this._baseUrl = config.GetString("BtcETradeAPIRestUrl") + "/";
        this._key = config.GetString("BtcEKey");
        this._secret = config.GetString("BtcESecret");
    }

    private _lastTimeMs: number = 0;
    private getNonce = () => {
        var t = new Date().getTime();
        if (t === this._lastTimeMs) {
            this._lastTimeMs++;
        }
        else {
            this._lastTimeMs = t * 100;
        }

        return this._lastTimeMs;
    };

    public postToEndpoint = <TRequest, TResponse>(method: string, params: TRequest): Q.Promise<Response<TResponse>> => {
        var formData: any = {};
        for (var key in params) {
            formData[key] = params[key];
        }
        formData.method = method;

        var form = querystring.stringify(formData);
        var sign = crypto.createHmac('sha512', this._secret).update(new Buffer(form)).digest('hex').toString();

        var options: request.Options = {
            url: this._baseUrl + "/" + method,
            method: "POST",
            form: form,
            headers: {
                Sign: sign,
                Key: this._key
            }
        };

        var d = Q.defer<Response<TResponse>>();
        request(options, (err, resp, body) => {
            if (err) d.reject(err);
            else d.resolve(JSON.parse(body));
        });
        return d.promise;
    };
}

// aka new order
interface Trade {
    pair: string;
    type: string; // buy or sell
    rate: number;
    amount: number;
}

// aka order ack
interface TradeResponse {
    received: number;
    remains: number;
    order_id: number;
    funds: Object;
}

interface CancelOrder {
    order_id: number;
}

interface CancelOrderAck {
    order_id: number;
    funds: Object;
}

class BtcEOrderEntryGateway implements Interfaces.IOrderEntryGateway {
    OrderUpdate = new Utils.Evt<Models.OrderStatusReport>();

    public cancelsByClientOrderId = false;

    cancelOrder = (cancel: Models.BrokeredCancel): Models.OrderGatewayActionReport => {
        var req = { order_id: parseInt(cancel.exchangeId) };
        this._client.postToEndpoint<CancelOrder, CancelOrderAck>("CancelOrder", req).then(r => {
            if (r.success === 1) {
                this.OrderUpdate.trigger({
                    orderId: cancel.clientOrderId,
                    orderStatus: Models.OrderStatus.Cancelled
                });
            }
            else {
                this.OrderUpdate.trigger({
                    orderId: cancel.clientOrderId,
                    orderStatus: Models.OrderStatus.Rejected,
                    rejectMessage: r.error
                });
            }
        }).done();
        return new Models.OrderGatewayActionReport(Utils.date());
    };

    replaceOrder = (replace: Models.BrokeredReplace): Models.OrderGatewayActionReport => {
        this.cancelOrder(new Models.BrokeredCancel(replace.origOrderId, replace.orderId, replace.side, replace.exchangeId));
        return this.sendOrder(replace);
    };

    sendOrder = (order: Models.BrokeredOrder): Models.OrderGatewayActionReport => {
        var t: Trade = {
            pair: this._pairKey,
            type: order.side === Models.Side.Bid ? "buy" : "sell",
            rate: order.price,
            amount: order.quantity
        };

        this._client.postToEndpoint<Trade, TradeResponse>("Trade", t).then(r => {
            if (r.success === 1) {
                var rpt: Models.OrderStatusReport = {
                    orderId: order.orderId,
                    leavesQuantity: r.return.remains
                };

                var exchangeOrderId = r.return.order_id;
                if (exchangeOrderId === 0) {
                    rpt.orderStatus = Models.OrderStatus.Complete;
                }
                else {
                    rpt.orderStatus = Models.OrderStatus.Working;
                    rpt.exchangeId = exchangeOrderId.toString();
                }

                this.OrderUpdate.trigger(rpt);
            }
            else {
                this.OrderUpdate.trigger({
                    orderId: order.orderId,
                    orderStatus: Models.OrderStatus.Rejected,
                    rejectMessage: r.error
                });
            }
        });

        return new Models.OrderGatewayActionReport(Utils.date());
    };

    ConnectChanged = new Utils.Evt<Models.ConnectivityStatus>();

    generateClientOrderId = () => shortId.generate();

    _log: Utils.Logger = Utils.log("tribeca:gateway:BtcEOE");
    constructor(
        private _pairKey: string,
        private _timeProvider: Utils.ITimeProvider,
        private _client: BtcEAuthenticatedApiClient) {
            this._timeProvider.setImmediate(() => this.ConnectChanged.trigger(Models.ConnectivityStatus.Connected));
    }
}

class BtcEPositionGateway implements Interfaces.IPositionGateway {
    _log: Utils.Logger = Utils.log("tribeca:gateway:BtcEPG");
    PositionUpdate = new Utils.Evt<Models.CurrencyPosition>();

    constructor(
        private _pairKey: string,
        private _timeProvider: Utils.ITimeProvider,
        private _client: BtcEAuthenticatedApiClient) {
    }
}

class BtcEBaseGateway implements Interfaces.IExchangeDetailsGateway {
    public get hasSelfTradePrevention() {
        return false;
    }

    exchange(): Models.Exchange {
        return Models.Exchange.BtcE;
    }

    makeFee(): number {
        return -0.0001;
    }

    takeFee(): number {
        return 0.001;
    }

    name(): string {
        return "BtcE";
    }
}

export class BtcE extends Interfaces.CombinedGateway {
    constructor(pair: Models.CurrencyPair, timeProvider: Utils.ITimeProvider, config: Config.IConfigProvider) {
        var publicClient = new BtcEPublicApiClient(config);
        var authClient = new BtcEAuthenticatedApiClient(config);
        var pairKey = Models.Currency[pair.base].toLowerCase() + "_" + Models.Currency[pair.quote].toLowerCase();
        super(
            new BtcEMarketDataGateway(pairKey, timeProvider, publicClient),
            new BtcEOrderEntryGateway(pairKey, timeProvider, authClient),
            new BtcEPositionGateway(pairKey, timeProvider, authClient),
            new BtcEBaseGateway());
    }
}