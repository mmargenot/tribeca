# tribeca

[![Join the chat at https://gitter.im/michaelgrosner/tribeca](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/michaelgrosner/tribeca?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

`tribeca` is a very low latency cryptocurrency [market making](https://github.com/michaelgrosner/tribeca/wiki#what-is-market-making) trading bot with a full featured [web client](https://github.com/michaelgrosner/tribeca#web-ui), [backtester](https://github.com/michaelgrosner/tribeca/wiki#how-can-i-test-new-trading-strategies), and supports direct connectivity to [several cryptocoin exchanges](https://github.com/michaelgrosner/tribeca#configuration). On modern hardware, it can react to market data by placing and canceling orders in under a millisecond. 

![Web UI Preview](https://raw.githubusercontent.com/michaelgrosner/tribeca/master/docs/web_ui_preview.png)

It runs on v0.12 nodejs or the latest io.js. Persistence is acheived using mongodb. Installation is recommended via Docker, but manual installation everything is also supported.

### Docker Installation

0) Please install [docker](https://www.docker.com/) for your system before preceeding. Requires at least Docker 1.7.1. Mac/Windows only: Ensure boot2docker is already running. See [the docs](https://docs.docker.com/installation/mac/) for more help.

1) Set up mongodb. If you do not have a mongodb instance already running: `docker run -p 27017:27017 --name tribeca-mongo -d mongo`.

2) Copy the repository [Dockerfile](https://raw.githubusercontent.com/michaelgrosner/tribeca/master/Dockerfile) into a text editor. Change the environment variables to match your desired [configuration](https://github.com/michaelgrosner/tribeca#configuration). Input your exchange connectivity information, account information, and mongoDB credentials.

3) Save the Dockerfile, preferably in a secure location and in an empty directory. Build the image from the Dockerfile `docker build -t tribeca .`

4) Run the container `docker run -p 3000:3000 --link tribeca-mongo:mongo --name tribeca -d tribeca`. If you run `docker ps`, you should see tribeca and mongo containers running.

### Manual Installation

1) Ensure your target machine has node v0.12 or greater and mongoDB v3 or greater. Also, ensure Typescript 1.5, grunt, tsd, and, optionally, forever are installed (`npm install -g grunt-cli typescript tsd forever`).

2) Clone the repository.

3) In the cloned repository directory, `npm install` and then `tsd reinstall -s` to pull in all dependencies.

4) Compile typescript to javascript via `grunt compile`.

5) cd to the outputted JS files, in `tribeca/service`. 

6) Create a `tribeca.json` file based off the provided `sample-dev-tribeca.json` or `sample-prod-tribeca.json` files and save it in the current directory. Modify the config keys (see [configuration](https://github.com/michaelgrosner/tribeca#configuration) section) and point the instance towards the running mongoDB instance.

7) Run `forever start main.js` to start the app.

### Configuration

  * EXCHANGE
  
    1) `coinbase` - uses the WebSocket API. Ensure the Coinbase-specific properties have been set with your correct account information if you are using the sandbox or live-trading environment.
    
    2) `hitbtc` - WebSocket + socket.io API. Ensure the HitBtc-specific properties have been set with your correct account information if you are using the dev or prod environment.
    
    3) `okcoin` - Websocket.Ensure the OKCoin-specific properties have been set with your correct account information. Production environment only.
    
    4) `bitfinex` REST API only. Ensure the Bitfinex-specific properties have been filled out. REST API is not suitable to millisecond latency trading. Production environment only.
    
    5) `null` - Test in-memory exchange. No exchange-specific config needed.
    
  * TRIBECA_MODE
  
    1) `prod`
    
    2) `dev`
    
  * MongoDbUrl - If you are on OS X, change "tribeca-mongo" in the URL to the output of `boot2docker ip` on your host machine. If you are running an existing mongoDB instance, replace the URL with the existing instance's URL. If you are running from a Linux machine and set up mongo in step 1, you should not have to modify anything.
  
  * TradedPair - The following currency pairs are supported on these exchanges:
  
    1) `BTC/USD` - Coinbase, HitBtc, OkCoin, Null
    
    2) `BTC/EUR` - Coinbase, HitBtc, Null
    
    3) `BTC/GBP` - Coinbase, Null
    
  * WebClientUsername and WebClientPassword - Username and password for [web UI](https://github.com/michaelgrosner/tribeca#web-ui) access. If kept as `NULL`, no the web client will not require authentication (Not recommended at all!!)

Input your exchange connectivity information, account information, and API keys in the config properties for the exchange you intend on trading on.

### Application Usage

1) Open your web browser to connect to port 3000 of the machine running tribeca. If you're running tribeca locally on Mac/Windows on Docker, replace "localhost" with the address returned by `boot2docker ip`.

2) Read up on how to use tribeca and market making in the [wiki](https://github.com/michaelgrosner/tribeca/wiki).

3) Set up trading parameters to your liking in the web UI. Click the "BTC/USD" button so it is green to start making markets.

### Web UI

Once `tribeca` is up and running, visit port `3000` of the machine on which it is running to view the admin view. There are inputs for quoting parameters, grids to display market orders, market trades, your trades, your order history, your positions, and a big button with the currency pair you are trading. When you're ready, click that button green to begin sending out quotes. The UI uses a healthy mixture of socket.io and angularjs.

### REST API

Tribeca also exposes a REST API of all it's data. It's all the same data you would get via the Web UI, just a bit easier to connect up to via other applications. Visit `http://localhost:3000/data/md` for the current market data, for instance.

### TODO

TODO:

1) Add new exchanges

2) Add new, smarter trading strategies (as always!)

3) Support for currency pairs which do not trade in $0.01 increments (LTC, DOGE)

4) More documentation

5) More performant UI

### Donations

If you would like to support this project, please consider donating to 1BDpAKp8qqTA1ASXxK2ekk8b8metHcdTxj
