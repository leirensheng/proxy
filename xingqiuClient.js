let BaseSend = require("./baseSend");
let { sleep } = require("../maoyan/utils");
let { fetch, ProxyAgent, request } = require("undici");

class Client extends BaseSend {
  constructor(activityId, dataId, index) {
    super();
    this.index = index;
    this.platform = "xingqiu";
    this.valueType = "json";
    this.activityId = activityId;
    this.dataId = dataId;
    this.isNeedProxy = true;
  }

  async init() {
    if (this.isNeedProxy) {
      await new Promise((resolve) => {
        this.eventBus.once("connectedReady", resolve);
        this.tryConnect();
      });
    }
    await this.initAgent();
  }

  async initAgent() {
    let url = `https://m.piaoxingqiu.com/cyy_gatewayapi/show/pub/v5/show/${this.activityId}/session/${this.dataId}/seat_plans?src=WEB&ver=4.4.2&source=FROM_QUICK_ORDER`; //  url = `http://114.124.119.205:5000/ping`;

    let uniqueId = this.activityId + "_" + this.dataId + "_" + this.index;
    this.uniqueId = uniqueId;
    let options = {
      url,
      headers: {
        accept: "application/json, text/plain, */*",
        "channel-id": "",
        "content-type": "application/json;charset=UTF-8",
        "terminal-src": "H5",
        "x-requested-with": "XMLHttpRequest",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 Edg/114.0.1823.82",
        Referer:
          "https://m.piaoxingqiu.com/booking/64a54de04eee3c0001553912?from=content&isFree=false",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
      body: null,
      method: "GET",
    };
    this.options = options;
    if (this.isNeedProxy) {
      this.ip = await this.getAgent();
    }
    this.isReady = true;
  }

  async send() {
    if (!this.isReady) {
      return "";
    }
    let res;
    if (this.isNeedProxy) {
      res = await this.myProxy();
    } else {
      try {
        let p1 = fetch(this.options.url, {
          ...this.options,
          keepalive: true,
        }).then((res) => res.json());
        let p2 = sleep(2000);
        res = await Promise.race([p1, p2]);
      } catch (e) {
        console.log(e);
      }
    }
    if (!res) {
      return {
        errMsg: "超时",
        res: [],
      };
    }
    let {
      data: { seatPlans },
    } = res;
    return {
      err: "",
      res: seatPlans,
    };
  }
}

module.exports = Client;
